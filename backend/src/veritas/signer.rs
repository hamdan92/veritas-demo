//! Signer Module - Simulates C2PA Camera/Signer
//!
//! This module implements the signing functionality as described in the VerITAS paper.
//! It supports two modes:
//! - Mode 1: Lattice hash + Poseidon hash (for computationally limited signers like cameras)
//! - Mode 2: FRI polynomial commitment (for powerful signers like OpenAI)

use anyhow::Result;
use plonky2::field::types::Field;
use plonky2::hash::poseidon::PoseidonHash;
use plonky2::plonk::config::{GenericConfig, Hasher, PoseidonGoldilocksConfig};
use rand::Rng;
use sha2::{Sha256, Digest};
use serde::{Deserialize, Serialize};
use std::time::Instant;

const D: usize = 2;
type C = PoseidonGoldilocksConfig;
type F = <C as GenericConfig<D>>::F;

/// Signing mode as per the VerITAS paper
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum SigningMode {
    /// Mode 1: Lattice hash + Poseidon - for computationally limited signers (cameras)
    LatticePostion,
    /// Mode 2: Polynomial commitment - for powerful signers
    PolynomialCommitment,
}

/// C2PA-style image metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageMetadata {
    pub timestamp: u64,
    pub location: Option<(f64, f64)>, // (latitude, longitude)
    pub device_id: String,
    pub image_width: u32,
    pub image_height: u32,
    pub color_depth: u8,
}

/// Signed image data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignedImage {
    /// The signing mode used
    pub mode: SigningMode,
    /// Image metadata (C2PA style)
    pub metadata: ImageMetadata,
    /// Hash of the image (lattice+poseidon for Mode 1, commitment digest for Mode 2)
    pub image_hash: Vec<u8>,
    /// ECDSA signature on the hash (simulated with SHA256-based signature)
    pub signature: Vec<u8>,
    /// Signer's public key (simulated)
    pub public_key: Vec<u8>,
    /// For Mode 1: The lattice hash output (before Poseidon)
    pub lattice_hash: Option<Vec<u64>>,
    /// For Mode 2: The polynomial commitment
    pub polynomial_commitment: Option<Vec<u8>>,
    /// Signing time in milliseconds
    pub signing_time_ms: u64,
}

/// Lattice hash parameters as per the paper
/// A ∈ F^{n×m} where n=128, m=num_pixels
const LATTICE_N: usize = 128;

/// Lattice hash matrix generator (deterministic from seed)
/// In production, this would be a truly random matrix stored publicly
fn generate_lattice_matrix_row(row_idx: usize, num_cols: usize, seed: u64) -> Vec<u64> {
    // Use linear congruential generator as mentioned in paper (Section 6.1)
    let mut lcg_state = seed.wrapping_add(row_idx as u64);
    let mut row = Vec::with_capacity(num_cols);
    
    for _ in 0..num_cols {
        // LCG: x_{n+1} = (a * x_n + c) mod m
        // Using constants from Numerical Recipes
        lcg_state = lcg_state.wrapping_mul(6364136223846793005)
                            .wrapping_add(1442695040888963407);
        // Take upper 32 bits for better randomness
        row.push((lcg_state >> 32) & 0xFFFFFFFF);
    }
    row
}

/// Compute lattice hash: h = A * v (mod q)
/// where A ∈ F^{n×m}, v is the pixel vector (low-norm: 0-255)
/// Returns n field elements (1KB when n=128 and q is 64-bit)
pub fn compute_lattice_hash(pixels: &[u8], seed: u64) -> Vec<u64> {
    let m = pixels.len();
    let mut hash = vec![0u64; LATTICE_N];
    
    // Compute h = A * v row by row
    for i in 0..LATTICE_N {
        let row = generate_lattice_matrix_row(i, m, seed);
        let mut sum: u128 = 0;
        for (j, &pixel) in pixels.iter().enumerate() {
            sum = sum.wrapping_add((row[j] as u128) * (pixel as u128));
        }
        // Reduce modulo Goldilocks prime (2^64 - 2^32 + 1)
        let goldilocks_prime: u128 = (1u128 << 64) - (1u128 << 32) + 1;
        hash[i] = (sum % goldilocks_prime) as u64;
    }
    
    hash
}

/// Compute Poseidon hash of lattice hash output
/// Reduces 1KB (128 field elements) to 32 bytes (4 field elements)
pub fn compute_poseidon_hash(lattice_output: &[u64]) -> Vec<u8> {
    use plonky2::field::types::PrimeField64;
    
    // Convert to field elements
    let field_elements: Vec<F> = lattice_output
        .iter()
        .map(|&x| F::from_canonical_u64(x))
        .collect();
    
    // Poseidon hash using Plonky2's implementation
    let hash_out = PoseidonHash::hash_no_pad(&field_elements);
    
    // Convert HashOut to bytes
    let mut bytes = Vec::with_capacity(32);
    for elem in hash_out.elements.iter() {
        let val: u64 = PrimeField64::to_canonical_u64(elem);
        bytes.extend_from_slice(&val.to_le_bytes());
    }
    bytes
}

/// Compute FRI polynomial commitment (Mode 2)
/// This commits to the polynomial interpolating the pixel values
pub fn compute_polynomial_commitment(pixels: &[u8]) -> Result<Vec<u8>> {
    use plonky2::field::polynomial::PolynomialValues;
    use plonky2::field::types::PrimeField64;
    
    // Convert pixels to field elements
    let values: Vec<F> = pixels
        .iter()
        .map(|&p| F::from_canonical_u32(p as u32))
        .collect();
    
    // Pad to power of 2
    let n = values.len().next_power_of_two();
    let mut padded_values = values;
    padded_values.resize(n, F::ZERO);
    
    // Create polynomial from values
    let poly_values = PolynomialValues::new(padded_values);
    
    // For simplicity, we'll hash the polynomial coefficients as commitment
    // In full implementation, this would use FRI-PCS
    let coeffs = poly_values.ifft();
    
    // Hash coefficients using Poseidon
    let hash_out = PoseidonHash::hash_no_pad(&coeffs.coeffs);
    
    let mut bytes = Vec::with_capacity(32);
    for elem in hash_out.elements.iter() {
        let val: u64 = PrimeField64::to_canonical_u64(elem);
        bytes.extend_from_slice(&val.to_le_bytes());
    }
    
    Ok(bytes)
}

/// Simulate ECDSA signature (in production, use actual ECDSA)
/// Signs the hash using a simulated private key
fn sign_hash(hash: &[u8], private_key: &[u8]) -> Vec<u8> {
    // Simulate signature: HMAC-SHA256(private_key, hash)
    // In production, use actual ECDSA (secp256k1 or ed25519)
    let mut hasher = Sha256::new();
    hasher.update(private_key);
    hasher.update(hash);
    hasher.finalize().to_vec()
}

/// Generate a simulated key pair
fn generate_keypair() -> (Vec<u8>, Vec<u8>) {
    let mut rng = rand::thread_rng();
    let private_key: Vec<u8> = (0..32).map(|_| rng.gen()).collect();
    
    // Derive public key (simulated: hash of private key)
    let mut hasher = Sha256::new();
    hasher.update(&private_key);
    let public_key = hasher.finalize().to_vec();
    
    (private_key, public_key)
}

/// Sign an image using the specified mode
/// 
/// This simulates what a C2PA-enabled camera or powerful signer would do.
pub fn sign_image(
    r_pixels: &[u8],
    g_pixels: &[u8],
    b_pixels: &[u8],
    width: u32,
    height: u32,
    mode: SigningMode,
) -> Result<SignedImage> {
    let start = Instant::now();
    
    // Generate simulated keypair
    let (private_key, public_key) = generate_keypair();
    
    // Create metadata
    let metadata = ImageMetadata {
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        location: None,
        device_id: "VerITAS-Demo-Camera-v1".to_string(),
        image_width: width,
        image_height: height,
        color_depth: 8,
    };
    
    // Concatenate all channels for hashing
    let mut all_pixels = Vec::with_capacity(r_pixels.len() * 3);
    all_pixels.extend_from_slice(r_pixels);
    all_pixels.extend_from_slice(g_pixels);
    all_pixels.extend_from_slice(b_pixels);
    
    let (image_hash, lattice_hash, polynomial_commitment) = match mode {
        SigningMode::LatticePostion => {
            // Mode 1: Lattice hash + Poseidon
            // Hash each channel separately, then combine
            let seed = 0x12345678u64; // Fixed seed for matrix generation
            
            let lattice_r = compute_lattice_hash(r_pixels, seed);
            let lattice_g = compute_lattice_hash(g_pixels, seed);
            let lattice_b = compute_lattice_hash(b_pixels, seed);
            
            // Combine lattice hashes
            let mut combined_lattice: Vec<u64> = Vec::with_capacity(LATTICE_N * 3);
            combined_lattice.extend_from_slice(&lattice_r);
            combined_lattice.extend_from_slice(&lattice_g);
            combined_lattice.extend_from_slice(&lattice_b);
            
            // Apply Poseidon to get final hash
            let poseidon_hash = compute_poseidon_hash(&combined_lattice);
            
            (poseidon_hash, Some(combined_lattice), None)
        }
        SigningMode::PolynomialCommitment => {
            // Mode 2: Polynomial commitment
            let commitment = compute_polynomial_commitment(&all_pixels)?;
            
            // Hash the commitment for signing
            let mut hasher = Sha256::new();
            hasher.update(&commitment);
            let hash = hasher.finalize().to_vec();
            
            (hash, None, Some(commitment))
        }
    };
    
    // Sign the hash with ECDSA (simulated)
    let signature = sign_hash(&image_hash, &private_key);
    
    let signing_time = start.elapsed().as_millis() as u64;
    
    Ok(SignedImage {
        mode,
        metadata,
        image_hash,
        signature,
        public_key,
        lattice_hash,
        polynomial_commitment,
        signing_time_ms: signing_time,
    })
}

/// Verify a C2PA signature
/// Returns true if the signature is valid
pub fn verify_signature(signed_image: &SignedImage, image_hash: &[u8]) -> bool {
    // In production, this would verify actual ECDSA signature
    // For demo, we verify the hash matches and signature structure is valid
    
    // Check hash matches
    if signed_image.image_hash != image_hash {
        return false;
    }
    
    // Check signature is non-empty and correct length
    if signed_image.signature.len() != 32 {
        return false;
    }
    
    // Check public key is present
    if signed_image.public_key.is_empty() {
        return false;
    }
    
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_lattice_hash() {
        let pixels: Vec<u8> = (0..100).map(|i| (i % 256) as u8).collect();
        let hash = compute_lattice_hash(&pixels, 12345);
        assert_eq!(hash.len(), LATTICE_N);
    }
    
    #[test]
    fn test_sign_image_mode1() {
        let r: Vec<u8> = vec![100; 64];
        let g: Vec<u8> = vec![150; 64];
        let b: Vec<u8> = vec![200; 64];
        
        let signed = sign_image(&r, &g, &b, 8, 8, SigningMode::LatticePostion).unwrap();
        assert!(signed.lattice_hash.is_some());
        assert!(signed.polynomial_commitment.is_none());
    }
    
    #[test]
    fn test_sign_image_mode2() {
        let r: Vec<u8> = vec![100; 64];
        let g: Vec<u8> = vec![150; 64];
        let b: Vec<u8> = vec![200; 64];
        
        let signed = sign_image(&r, &g, &b, 8, 8, SigningMode::PolynomialCommitment).unwrap();
        assert!(signed.lattice_hash.is_none());
        assert!(signed.polynomial_commitment.is_some());
    }
}
