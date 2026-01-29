//! VerITAS - Verifying Image Transformations at Scale
//! 
//! This module implements the complete VerITAS system as described in the paper:
//! "VerITAS: Verifying Image Transformations at Scale" by Datta, Chen, and Boneh (Stanford)
//!
//! The system has three main components:
//! 1. Signer (Camera) - Signs original images using C2PA with Mode 1 or Mode 2
//! 2. Prover (Editor) - Generates ZK proofs for image edits
//! 3. Verifier (Client) - Verifies proofs without seeing original image
//!
//! Supported signing modes:
//! - Mode 1: Lattice hash + Poseidon (for computationally limited signers)
//! - Mode 2: Polynomial commitment (for powerful signers)
//!
//! Supported edits (as per Associated Press guidelines):
//! - Cropping
//! - Grayscale conversion
//! - Bilinear resizing
//! - Box blur

pub mod signer;
pub mod prover;
pub mod verifier;
pub mod proofs;
pub mod types;

// Re-export main types for convenience
pub use signer::{SignedImage, SigningMode, sign_image};
pub use prover::{EditProof, EditType, EditParams, ProverConfig};
pub use prover::{prove_grayscale_edit, prove_crop_edit, prove_resize_edit, prove_blur_edit};
pub use verifier::{VerificationResult, VerificationStep, verify_proof, quick_verify};
pub use proofs::*;
pub use types::*;
