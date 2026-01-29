//! VerITAS proof generation and verification
//! 
//! This module wraps the original VerITAS implementation to provide
//! a cleaner interface for the web API.

pub mod proofs;
pub mod types;

pub use proofs::*;
pub use types::*;
