use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Job status enum
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum JobStatus {
    Pending,
    Processing,
    Completed,
    Failed,
}

/// Type of operation being performed
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JobType {
    Sign,
    Crop,
    Blur,
    Resize,
    Grayscale,
    Verify,
}

/// Edit parameters for different operations
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum EditParams {
    Crop {
        x: u32,
        y: u32,
        width: u32,
        height: u32,
    },
    Blur {
        x: u32,
        y: u32,
        width: u32,
        height: u32,
    },
    Resize {
        new_width: u32,
        new_height: u32,
    },
    Grayscale,
}

/// A job representing an async operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Job {
    pub id: String,
    pub job_type: JobType,
    pub status: JobStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub progress: u8,
    pub message: Option<String>,
    pub result: Option<JobResult>,
    pub error: Option<String>,
}

/// Result of a completed job
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobResult {
    /// Base64-encoded edited image
    pub edited_image: Option<String>,
    /// Base64-encoded proof
    pub proof: Option<String>,
    /// Proof size in bytes
    pub proof_size: Option<usize>,
    /// Time taken for proof generation in milliseconds
    pub proving_time_ms: Option<u64>,
    /// Time taken for verification in milliseconds
    pub verification_time_ms: Option<u64>,
    /// Whether verification passed
    pub verified: Option<bool>,
    /// Technical details for display
    pub technical_details: Option<TechnicalDetails>,
}

/// Technical details about the proof for educational display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TechnicalDetails {
    pub image_pixels: usize,
    pub circuit_size: Option<usize>,
    pub num_constraints: Option<usize>,
    pub hash_type: String,
    pub proof_system: String,
    pub field_size_bits: u32,
    pub security_bits: u32,
}

impl Job {
    pub fn new(job_type: JobType) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            job_type,
            status: JobStatus::Pending,
            created_at: now,
            updated_at: now,
            progress: 0,
            message: Some("Job created".to_string()),
            result: None,
            error: None,
        }
    }

    pub fn set_processing(&mut self, message: &str) {
        self.status = JobStatus::Processing;
        self.message = Some(message.to_string());
        self.updated_at = Utc::now();
    }

    pub fn set_progress(&mut self, progress: u8, message: &str) {
        self.progress = progress;
        self.message = Some(message.to_string());
        self.updated_at = Utc::now();
    }

    pub fn set_completed(&mut self, result: JobResult) {
        self.status = JobStatus::Completed;
        self.progress = 100;
        self.message = Some("Completed successfully".to_string());
        self.result = Some(result);
        self.updated_at = Utc::now();
    }

    pub fn set_failed(&mut self, error: &str) {
        self.status = JobStatus::Failed;
        self.message = Some("Job failed".to_string());
        self.error = Some(error.to_string());
        self.updated_at = Utc::now();
    }
}
