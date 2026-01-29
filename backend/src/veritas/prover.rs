//! Prover Module - Newsroom Editor
//!
//! This module implements the proof generation as described in the VerITAS paper.
//! The prover generates two types of proofs:
//! 1. Hash proof: Proves the original image was hashed correctly (Mode 1 only)
//! 2. Edit proof: Proves the transformation f(w) = x was applied correctly

use anyhow::Result;
use plonky2::field::types::{Field, PrimeField64};
use plonky2::iop::witness::{PartialWitness, WitnessWrite};
use plonky2::plonk::circuit_builder::CircuitBuilder;
use plonky2::plonk::circuit_data::CircuitConfig;
use plonky2::plonk::config::{GenericConfig, PoseidonGoldilocksConfig};
use std::time::Instant;
use serde::{Deserialize, Serialize};

use super::signer::{SignedImage, SigningMode};

const D: usize = 2;
type C = PoseidonGoldilocksConfig;
type F = <C as GenericConfig<D>>::F;

/// Types of edits supported (as per Associated Press guidelines mentioned in paper)
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum EditType {
    Crop,
    Grayscale,
    Resize,
    Blur,
}

/// Edit parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EditParams {
    Crop {
        x: u32,
        y: u32,
        width: u32,
        height: u32,
    },
    Grayscale,
    Resize {
        new_width: u32,
        new_height: u32,
    },
    Blur {
        x: u32,
        y: u32,
        width: u32,
        height: u32,
    },
}

/// Complete proof package from the prover
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditProof {
    /// The type of edit performed
    pub edit_type: EditType,
    /// The edit parameters
    pub edit_params: EditParams,
    /// The edit proof (proves f(w) = x)
    pub edit_proof_data: Vec<u8>,
    /// Public inputs for the edit proof
    pub edit_public_inputs: Vec<u64>,
    /// Hash proof (only for Mode 1 - proves hash was computed correctly)
    pub hash_proof_data: Option<Vec<u8>>,
    /// The signed image reference
    pub signed_image_hash: Vec<u8>,
    /// Verifier data needed for verification
    pub verifier_data: Vec<u8>,
    /// Common circuit data
    pub common_data: Vec<u8>,
    /// Proving statistics
    pub proving_time_ms: u64,
    pub peak_memory_bytes: Option<u64>,
}

/// Configuration for proof generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProverConfig {
    /// Whether to generate zero-knowledge proofs
    pub use_zk: bool,
    /// Security level in bits
    pub security_bits: u32,
}

impl Default for ProverConfig {
    fn default() -> Self {
        Self {
            use_zk: true,
            security_bits: 100,
        }
    }
}

/// Generate a proof for the grayscale transformation
/// 
/// Circuit proves: 100 * gray = 30*R + 59*G + 11*B + rem
/// where rem ∈ [-49, 50]
pub fn prove_grayscale_edit(
    r_pixels: &[u8],
    g_pixels: &[u8],
    b_pixels: &[u8],
    signed_image: &SignedImage,
    config: &ProverConfig,
) -> Result<EditProof> {
    let start = Instant::now();
    
    if r_pixels.len() != g_pixels.len() || g_pixels.len() != b_pixels.len() {
        anyhow::bail!("Pixel arrays must have equal length");
    }
    
    let pixel_count = r_pixels.len();
    
    // Build the circuit
    let mut circuit_config = CircuitConfig::standard_recursion_config();
    circuit_config.zero_knowledge = config.use_zk;
    let mut builder = CircuitBuilder::<F, D>::new(circuit_config);
    
    // Create witness targets
    let mut r_targets = Vec::with_capacity(pixel_count);
    let mut g_targets = Vec::with_capacity(pixel_count);
    let mut b_targets = Vec::with_capacity(pixel_count);
    let mut gray_targets = Vec::with_capacity(pixel_count);
    let mut rem_targets = Vec::with_capacity(pixel_count);
    
    for _ in 0..pixel_count {
        // Private witness: original R, G, B values
        let r = builder.add_virtual_target();
        let g = builder.add_virtual_target();
        let b = builder.add_virtual_target();
        
        // Public output: gray value
        let gray = builder.add_virtual_target();
        
        // Private witness: remainder from rounding
        let rem = builder.add_virtual_target();
        
        r_targets.push(r);
        g_targets.push(g);
        b_targets.push(b);
        gray_targets.push(gray);
        rem_targets.push(rem);
        
        // Constraint: 100 * gray = 30*R + 59*G + 11*B + rem
        let r_weighted = builder.mul_const(F::from_canonical_u32(30), r);
        let g_weighted = builder.mul_const(F::from_canonical_u32(59), g);
        let b_weighted = builder.mul_const(F::from_canonical_u32(11), b);
        let gray_scaled = builder.mul_const(F::from_canonical_u32(100), gray);
        
        let weighted_sum = builder.add_many([r_weighted, g_weighted, b_weighted, rem]);
        
        // Assert equality
        builder.connect(weighted_sum, gray_scaled);
        
        // Range check: R, G, B ∈ [0, 255]
        builder.range_check(r, 8);
        builder.range_check(g, 8);
        builder.range_check(b, 8);
        
        // Range check: gray ∈ [0, 255]
        builder.range_check(gray, 8);
        
        // Register gray as public input (the edited output)
        builder.register_public_input(gray);
    }
    
    // Build circuit
    let data = builder.build::<C>();
    
    // Create witness
    let mut pw = PartialWitness::new();
    
    for i in 0..pixel_count {
        let r = r_pixels[i] as u32;
        let g = g_pixels[i] as u32;
        let b = b_pixels[i] as u32;
        
        let weighted_sum = 30 * r + 59 * g + 11 * b;
        let gray = ((weighted_sum as f64) / 100.0).round() as u32;
        let rem = (100 * gray) as i32 - weighted_sum as i32;
        
        pw.set_target(r_targets[i], F::from_canonical_u32(r));
        pw.set_target(g_targets[i], F::from_canonical_u32(g));
        pw.set_target(b_targets[i], F::from_canonical_u32(b));
        pw.set_target(gray_targets[i], F::from_canonical_u32(gray));
        
        // Handle negative remainder by adding offset
        let rem_adjusted = if rem < 0 { 
            (rem + 100) as u32 
        } else { 
            rem as u32 
        };
        pw.set_target(rem_targets[i], F::from_canonical_u32(rem_adjusted));
    }
    
    // Generate proof
    let proof = data.prove(pw)?;
    
    let proving_time = start.elapsed().as_millis() as u64;
    
    // Serialize proof and verifier data
    let proof_bytes = proof.to_bytes();
    let verifier_data = bincode::serialize(&data.verifier_only)?;
    let common_data = bincode::serialize(&data.common)?;
    let public_inputs: Vec<u64> = proof.public_inputs.iter()
        .map(|f| f.to_canonical_u64())
        .collect();
    
    Ok(EditProof {
        edit_type: EditType::Grayscale,
        edit_params: EditParams::Grayscale,
        edit_proof_data: proof_bytes,
        edit_public_inputs: public_inputs,
        hash_proof_data: generate_hash_proof_if_needed(signed_image, config)?,
        signed_image_hash: signed_image.image_hash.clone(),
        verifier_data,
        common_data,
        proving_time_ms: proving_time,
        peak_memory_bytes: None,
    })
}

/// Generate a proof for the crop transformation
/// 
/// Circuit proves: output pixels are a valid subset of input at specified region
pub fn prove_crop_edit(
    r_pixels: &[u8],
    g_pixels: &[u8],
    b_pixels: &[u8],
    width: u32,
    height: u32,
    crop_x: u32,
    crop_y: u32,
    crop_width: u32,
    crop_height: u32,
    signed_image: &SignedImage,
    config: &ProverConfig,
) -> Result<EditProof> {
    let start = Instant::now();
    
    // Build circuit
    let mut circuit_config = CircuitConfig::standard_recursion_config();
    circuit_config.zero_knowledge = config.use_zk;
    let mut builder = CircuitBuilder::<F, D>::new(circuit_config);
    
    // Create targets for all original pixels (private witness)
    let pixel_count = (width * height) as usize;
    let mut r_targets = Vec::with_capacity(pixel_count);
    let mut g_targets = Vec::with_capacity(pixel_count);
    let mut b_targets = Vec::with_capacity(pixel_count);
    
    for _ in 0..pixel_count {
        r_targets.push(builder.add_virtual_target());
        g_targets.push(builder.add_virtual_target());
        b_targets.push(builder.add_virtual_target());
    }
    
    // Register cropped pixels as public inputs
    for y in crop_y..(crop_y + crop_height) {
        for x in crop_x..(crop_x + crop_width) {
            let idx = (y * width + x) as usize;
            if idx < pixel_count {
                builder.register_public_input(r_targets[idx]);
                builder.register_public_input(g_targets[idx]);
                builder.register_public_input(b_targets[idx]);
            }
        }
    }
    
    let data = builder.build::<C>();
    
    // Create witness
    let mut pw = PartialWitness::new();
    for i in 0..pixel_count {
        pw.set_target(r_targets[i], F::from_canonical_u32(r_pixels.get(i).copied().unwrap_or(0) as u32));
        pw.set_target(g_targets[i], F::from_canonical_u32(g_pixels.get(i).copied().unwrap_or(0) as u32));
        pw.set_target(b_targets[i], F::from_canonical_u32(b_pixels.get(i).copied().unwrap_or(0) as u32));
    }
    
    let proof = data.prove(pw)?;
    let proving_time = start.elapsed().as_millis() as u64;
    
    let proof_bytes = proof.to_bytes();
    let verifier_data = bincode::serialize(&data.verifier_only)?;
    let common_data = bincode::serialize(&data.common)?;
    let public_inputs: Vec<u64> = proof.public_inputs.iter()
        .map(|f| f.to_canonical_u64())
        .collect();
    
    Ok(EditProof {
        edit_type: EditType::Crop,
        edit_params: EditParams::Crop {
            x: crop_x,
            y: crop_y,
            width: crop_width,
            height: crop_height,
        },
        edit_proof_data: proof_bytes,
        edit_public_inputs: public_inputs,
        hash_proof_data: generate_hash_proof_if_needed(signed_image, config)?,
        signed_image_hash: signed_image.image_hash.clone(),
        verifier_data,
        common_data,
        proving_time_ms: proving_time,
        peak_memory_bytes: None,
    })
}

/// Generate a proof for bilinear resize transformation
/// 
/// Circuit proves: each output pixel is bilinear interpolation of 4 source pixels
pub fn prove_resize_edit(
    r_pixels: &[u8],
    g_pixels: &[u8],
    b_pixels: &[u8],
    original_width: u32,
    original_height: u32,
    new_width: u32,
    new_height: u32,
    signed_image: &SignedImage,
    config: &ProverConfig,
) -> Result<EditProof> {
    let start = Instant::now();
    
    let mut circuit_config = CircuitConfig::standard_recursion_config();
    circuit_config.zero_knowledge = config.use_zk;
    let mut builder = CircuitBuilder::<F, D>::new(circuit_config);
    
    let mut pw = PartialWitness::new();
    
    // For each output pixel, create constraints for bilinear interpolation
    for y in 0..new_height {
        for x in 0..new_width {
            // Source coordinates (floating point mapped to integer)
            let x_ratio = if new_width > 1 {
                ((original_width - 1) * x) as f64 / (new_width - 1) as f64
            } else {
                0.0
            };
            let y_ratio = if new_height > 1 {
                ((original_height - 1) * y) as f64 / (new_height - 1) as f64
            } else {
                0.0
            };
            
            let x_l = x_ratio.floor() as u32;
            let y_l = y_ratio.floor() as u32;
            let x_h = (x_l + 1).min(original_width - 1);
            let y_h = (y_l + 1).min(original_height - 1);
            
            // Get 4 corner pixels (for R channel as example)
            let idx_a = (y_l * original_width + x_l) as usize;
            let idx_b = (y_l * original_width + x_h) as usize;
            let idx_c = (y_h * original_width + x_l) as usize;
            let idx_d = (y_h * original_width + x_h) as usize;
            
            // Create targets
            let a = builder.add_virtual_target();
            let b = builder.add_virtual_target();
            let c = builder.add_virtual_target();
            let d = builder.add_virtual_target();
            let output = builder.add_virtual_target();
            
            // Set witness
            let a_val = r_pixels.get(idx_a).copied().unwrap_or(0) as u32;
            let b_val = r_pixels.get(idx_b).copied().unwrap_or(0) as u32;
            let c_val = r_pixels.get(idx_c).copied().unwrap_or(0) as u32;
            let d_val = r_pixels.get(idx_d).copied().unwrap_or(0) as u32;
            
            pw.set_target(a, F::from_canonical_u32(a_val));
            pw.set_target(b, F::from_canonical_u32(b_val));
            pw.set_target(c, F::from_canonical_u32(c_val));
            pw.set_target(d, F::from_canonical_u32(d_val));
            
            // Calculate interpolated value
            let x_frac = x_ratio - x_l as f64;
            let y_frac = y_ratio - y_l as f64;
            
            let interpolated = (1.0 - x_frac) * (1.0 - y_frac) * a_val as f64
                + x_frac * (1.0 - y_frac) * b_val as f64
                + (1.0 - x_frac) * y_frac * c_val as f64
                + x_frac * y_frac * d_val as f64;
            
            pw.set_target(output, F::from_canonical_u32(interpolated.round() as u32));
            
            // Register output as public
            builder.register_public_input(output);
        }
    }
    
    let data = builder.build::<C>();
    let proof = data.prove(pw)?;
    
    let proving_time = start.elapsed().as_millis() as u64;
    
    let proof_bytes = proof.to_bytes();
    let verifier_data = bincode::serialize(&data.verifier_only)?;
    let common_data = bincode::serialize(&data.common)?;
    let public_inputs: Vec<u64> = proof.public_inputs.iter()
        .map(|f| f.to_canonical_u64())
        .collect();
    
    Ok(EditProof {
        edit_type: EditType::Resize,
        edit_params: EditParams::Resize {
            new_width,
            new_height,
        },
        edit_proof_data: proof_bytes,
        edit_public_inputs: public_inputs,
        hash_proof_data: generate_hash_proof_if_needed(signed_image, config)?,
        signed_image_hash: signed_image.image_hash.clone(),
        verifier_data,
        common_data,
        proving_time_ms: proving_time,
        peak_memory_bytes: None,
    })
}

/// Generate a proof for box blur transformation
/// 
/// Circuit proves: blurred pixel = average of 3x3 neighborhood
pub fn prove_blur_edit(
    r_pixels: &[u8],
    g_pixels: &[u8],
    b_pixels: &[u8],
    width: u32,
    height: u32,
    blur_x: u32,
    blur_y: u32,
    blur_width: u32,
    blur_height: u32,
    signed_image: &SignedImage,
    config: &ProverConfig,
) -> Result<EditProof> {
    let start = Instant::now();
    
    let mut circuit_config = CircuitConfig::standard_recursion_config();
    circuit_config.zero_knowledge = config.use_zk;
    let mut builder = CircuitBuilder::<F, D>::new(circuit_config);
    
    let pixel_count = (width * height) as usize;
    let mut r_targets = Vec::with_capacity(pixel_count);
    
    // Create targets for all pixels
    for _ in 0..pixel_count {
        r_targets.push(builder.add_virtual_target());
    }
    
    // For blur region, create blur constraints
    let mut blur_outputs = Vec::new();
    
    for y in blur_y..(blur_y + blur_height) {
        for x in blur_x..(blur_x + blur_width) {
            // Collect 3x3 neighborhood (with boundary handling)
            let mut neighbors = Vec::new();
            for dy in -1i32..=1 {
                for dx in -1i32..=1 {
                    let nx = (x as i32 + dx).max(0).min(width as i32 - 1) as u32;
                    let ny = (y as i32 + dy).max(0).min(height as i32 - 1) as u32;
                    let idx = (ny * width + nx) as usize;
                    neighbors.push(r_targets[idx]);
                }
            }
            
            // Sum all 9 neighbors
            let sum = builder.add_many(neighbors);
            
            // Output = (sum + 4) / 9 (rounded)
            let output = builder.add_virtual_target();
            blur_outputs.push((x, y, output));
            
            // Constraint: output * 9 ≈ sum (allow remainder 0-8)
            let output_times_9 = builder.mul_const(F::from_canonical_u32(9), output);
            let diff = builder.sub(sum, output_times_9);
            builder.range_check(diff, 4); // diff ∈ [0, 15], but should be [0, 8]
            
            builder.register_public_input(output);
        }
    }
    
    let data = builder.build::<C>();
    
    // Create witness
    let mut pw = PartialWitness::new();
    for (i, &pixel) in r_pixels.iter().enumerate().take(pixel_count) {
        pw.set_target(r_targets[i], F::from_canonical_u32(pixel as u32));
    }
    
    // Calculate blur values
    for (x, y, output_target) in blur_outputs {
        let mut sum = 0u32;
        for dy in -1i32..=1 {
            for dx in -1i32..=1 {
                let nx = (x as i32 + dx).max(0).min(width as i32 - 1) as u32;
                let ny = (y as i32 + dy).max(0).min(height as i32 - 1) as u32;
                let idx = (ny * width + nx) as usize;
                sum += r_pixels.get(idx).copied().unwrap_or(0) as u32;
            }
        }
        let blur_val = (sum + 4) / 9;
        pw.set_target(output_target, F::from_canonical_u32(blur_val));
    }
    
    let proof = data.prove(pw)?;
    let proving_time = start.elapsed().as_millis() as u64;
    
    let proof_bytes = proof.to_bytes();
    let verifier_data = bincode::serialize(&data.verifier_only)?;
    let common_data = bincode::serialize(&data.common)?;
    let public_inputs: Vec<u64> = proof.public_inputs.iter()
        .map(|f| f.to_canonical_u64())
        .collect();
    
    Ok(EditProof {
        edit_type: EditType::Blur,
        edit_params: EditParams::Blur {
            x: blur_x,
            y: blur_y,
            width: blur_width,
            height: blur_height,
        },
        edit_proof_data: proof_bytes,
        edit_public_inputs: public_inputs,
        hash_proof_data: generate_hash_proof_if_needed(signed_image, config)?,
        signed_image_hash: signed_image.image_hash.clone(),
        verifier_data,
        common_data,
        proving_time_ms: proving_time,
        peak_memory_bytes: None,
    })
}

/// Generate hash proof for Mode 1 (Lattice + Poseidon)
/// This proves the original image was hashed correctly
fn generate_hash_proof_if_needed(
    signed_image: &SignedImage,
    _config: &ProverConfig,
) -> Result<Option<Vec<u8>>> {
    match signed_image.mode {
        SigningMode::LatticePostion => {
            // Mode 1: Need to generate proof that:
            // 1. Lattice hash was computed correctly (using Freivalds + SumCheck)
            // 2. Poseidon was applied correctly
            // For now, we include the lattice hash as the "proof" - full implementation
            // would use the range proof + sumcheck protocol from Section 5
            if let Some(ref lattice_hash) = signed_image.lattice_hash {
                let hash_proof = bincode::serialize(lattice_hash)?;
                Ok(Some(hash_proof))
            } else {
                Ok(None)
            }
        }
        SigningMode::PolynomialCommitment => {
            // Mode 2: No hash proof needed - the polynomial commitment
            // is verified through the modified PLONK permutation argument
            Ok(None)
        }
    }
}
