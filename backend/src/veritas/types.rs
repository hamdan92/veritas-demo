//! Types for VerITAS proofs

use serde::{Deserialize, Serialize};

/// Configuration for proof generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofConfig {
    /// Number of pixels in the image
    pub pixel_count: usize,
    /// Bit width for pixel values (typically 8 for 0-255)
    pub pixel_bits: u32,
    /// Whether to use zero-knowledge mode
    pub use_zk: bool,
    /// FRI rate bits
    pub rate_bits: usize,
    /// Merkle cap height
    pub cap_height: usize,
}

impl Default for ProofConfig {
    fn default() -> Self {
        Self {
            pixel_count: 1000,
            pixel_bits: 8,
            use_zk: true,
            rate_bits: 2,
            cap_height: 4,
        }
    }
}

/// Result of a proof generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofOutput {
    /// Serialized proof data
    pub proof_data: Vec<u8>,
    /// Public inputs (edited pixel values for verification)
    pub public_inputs: Vec<u64>,
    /// Time taken to generate proof in milliseconds
    pub proving_time_ms: u64,
    /// Peak memory usage in bytes (if available)
    pub peak_memory_bytes: Option<usize>,
}

/// Result of proof verification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationResult {
    /// Whether the proof verified successfully
    pub valid: bool,
    /// Time taken to verify in milliseconds
    pub verification_time_ms: u64,
    /// Error message if verification failed
    pub error: Option<String>,
}

/// Statistics about a proof
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofStats {
    /// Size of the proof in bytes
    pub proof_size_bytes: usize,
    /// Number of public inputs
    pub num_public_inputs: usize,
    /// Circuit information
    pub circuit_info: CircuitInfo,
}

/// Information about the circuit used
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CircuitInfo {
    /// Type of edit operation
    pub edit_type: String,
    /// Number of gates (approximate)
    pub num_gates: Option<usize>,
    /// Degree of the circuit
    pub degree: usize,
    /// Field used
    pub field: String,
}
