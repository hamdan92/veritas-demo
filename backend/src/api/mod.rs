//! API handlers for VerITAS Demo

use actix_web::{web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use sysinfo::System;
use std::time::Instant;

use crate::image_io::{
    self, crop_pixels, grayscale_pixels, blur_pixels, resize_pixels,
    image_to_pixel_vectors, pixel_vectors_to_image, load_image_from_bytes, image_to_png_bytes,
};
use crate::jobs::{Job, JobType, JobResult, EditParams, TechnicalDetails};
use crate::veritas::{self, ProofConfig};
use crate::AppState;

/// Configure API routes
pub fn configure_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api")
            .route("/health", web::get().to(health_check))
            .route("/edit", web::post().to(create_edit_job))
            .route("/job/{id}", web::get().to(get_job_status))
            .route("/verify", web::post().to(verify_proof))
            .route("/demo/info", web::get().to(get_demo_info))
    );
}

/// Health check endpoint
async fn health_check() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok",
        "service": "veritas-demo",
        "version": "0.1.0"
    }))
}

/// Request body for edit operation
#[derive(Debug, Deserialize)]
pub struct EditRequest {
    /// Base64-encoded image data
    pub image: String,
    /// Edit operation type and parameters
    pub edit: EditParams,
}

/// Response for job creation
#[derive(Debug, Serialize)]
pub struct JobCreatedResponse {
    pub job_id: String,
    pub status: String,
    pub message: String,
}

/// Create an edit job
async fn create_edit_job(
    state: web::Data<AppState>,
    body: web::Json<EditRequest>,
) -> impl Responder {
    // Decode the image
    let image_bytes = match BASE64.decode(&body.image) {
        Ok(bytes) => bytes,
        Err(e) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": format!("Invalid base64 image: {}", e)
            }));
        }
    };
    
    // Load and process the image
    let img = match load_image_from_bytes(&image_bytes) {
        Ok(img) => img,
        Err(e) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": format!("Failed to load image: {}", e)
            }));
        }
    };
    
    let pixels = image_to_pixel_vectors(&img);
    
    // Determine job type from edit params
    let job_type = match &body.edit {
        EditParams::Crop { .. } => JobType::Crop,
        EditParams::Blur { .. } => JobType::Blur,
        EditParams::Resize { .. } => JobType::Resize,
        EditParams::Grayscale => JobType::Grayscale,
    };
    
    // Create a new job
    let mut job = Job::new(job_type.clone());
    let job_id = job.id.clone();
    
    job.set_processing("Starting proof generation...");
    
    // Store the job
    {
        let mut jobs = state.jobs.write().await;
        jobs.insert(job_id.clone(), job.clone());
    }
    
    // Spawn background task for proof generation
    let state_clone = state.clone();
    let edit_params = body.edit.clone();
    
    tokio::spawn(async move {
        process_edit_job(state_clone, job_id, pixels, edit_params).await;
    });
    
    HttpResponse::Accepted().json(JobCreatedResponse {
        job_id: job.id,
        status: "processing".to_string(),
        message: "Edit job created. Poll /api/job/{id} for status.".to_string(),
    })
}

/// Process an edit job in the background
async fn process_edit_job(
    state: web::Data<AppState>,
    job_id: String,
    pixels: image_io::PixelVectors,
    edit_params: EditParams,
) {
    let config = ProofConfig::default();
    
    // Update job progress
    {
        let mut jobs = state.jobs.write().await;
        if let Some(job) = jobs.get_mut(&job_id) {
            job.set_progress(10, "Processing image...");
        }
    }
    
    // Perform the edit and generate proof
    let result = match &edit_params {
        EditParams::Crop { x, y, width, height } => {
            process_crop(&pixels, *x, *y, *width, *height, &config).await
        }
        EditParams::Grayscale => {
            process_grayscale(&pixels, &config).await
        }
        EditParams::Blur { x, y, width, height } => {
            process_blur(&pixels, *x, *y, *width, *height, &config).await
        }
        EditParams::Resize { new_width, new_height } => {
            process_resize(&pixels, *new_width, *new_height, &config).await
        }
    };
    
    // Update job with result
    let mut jobs = state.jobs.write().await;
    if let Some(job) = jobs.get_mut(&job_id) {
        match result {
            Ok(job_result) => {
                job.set_completed(job_result);
            }
            Err(e) => {
                job.set_failed(&e.to_string());
            }
        }
    }
}

async fn process_crop(
    pixels: &image_io::PixelVectors,
    x: u32, y: u32, width: u32, height: u32,
    config: &ProofConfig,
) -> anyhow::Result<JobResult> {
    // Capture resource metrics before
    let memory_before = get_process_memory_mb();
    let wall_start = Instant::now();
    
    // Apply the crop to get edited image
    let cropped = crop_pixels(pixels, x, y, width, height)?;
    
    // Generate proof for R channel (demo - would do all channels in production)
    let proof_output = veritas::prove_crop(
        &pixels.r, pixels.width, pixels.height,
        x, y, width, height,
        config,
    )?;
    
    // Capture resource metrics after
    let wall_time_ms = wall_start.elapsed().as_millis() as u64;
    let memory_after = get_process_memory_mb();
    let peak_memory = memory_after.max(memory_before);
    
    // Convert edited pixels to image
    let edited_img = pixel_vectors_to_image(&cropped)?;
    let edited_bytes = image_to_png_bytes(&edited_img)?;
    
    let proof_stats = veritas::get_proof_stats(&proof_output, "crop");
    
    Ok(JobResult {
        edited_image: Some(BASE64.encode(&edited_bytes)),
        proof: Some(BASE64.encode(&proof_output.proof_data)),
        proof_size: Some(proof_output.proof_data.len()),
        proving_time_ms: Some(proof_output.proving_time_ms),
        verification_time_ms: None,
        verified: None,
        technical_details: Some(TechnicalDetails {
            image_pixels: cropped.pixel_count(),
            circuit_size: proof_stats.circuit_info.num_gates,
            num_constraints: None,
            hash_type: "Poseidon".to_string(),
            proof_system: "Plonky2 (PLONK + FRI)".to_string(),
            field_size_bits: 64,
            security_bits: 100,
            peak_memory_mb: Some(peak_memory),
            memory_before_mb: Some(memory_before),
            memory_after_mb: Some(memory_after),
            cpu_time_ms: Some(proof_output.proving_time_ms),
            wall_time_ms: Some(wall_time_ms),
        }),
    })
}

/// Get current memory usage in MB
fn get_process_memory_mb() -> f64 {
    let mut sys = System::new();
    sys.refresh_memory();
    // sysinfo returns memory in bytes
    sys.used_memory() as f64 / 1024.0 / 1024.0
}

/// Get process memory usage in MB (more accurate for our process)
fn get_process_memory_mb() -> f64 {
    let mut sys = System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
    
    if let Some(process) = sys.process(sysinfo::get_current_pid().unwrap_or(sysinfo::Pid::from(0))) {
        // Process memory is in bytes
        process.memory() as f64 / 1024.0 / 1024.0
    } else {
        0.0
    }
}

async fn process_grayscale(
    pixels: &image_io::PixelVectors,
    config: &ProofConfig,
) -> anyhow::Result<JobResult> {
    // Capture resource metrics before
    let memory_before = get_process_memory_mb();
    let wall_start = Instant::now();
    
    // Apply grayscale
    let gray = grayscale_pixels(pixels);
    
    // Generate proof
    let proof_output = veritas::prove_grayscale(
        &pixels.r, &pixels.g, &pixels.b,
        config,
    )?;
    
    // Capture resource metrics after
    let wall_time_ms = wall_start.elapsed().as_millis() as u64;
    let memory_after = get_process_memory_mb();
    let peak_memory = memory_after.max(memory_before);
    
    // Convert to image
    let edited_img = pixel_vectors_to_image(&gray)?;
    let edited_bytes = image_to_png_bytes(&edited_img)?;
    
    let proof_stats = veritas::get_proof_stats(&proof_output, "grayscale");
    
    Ok(JobResult {
        edited_image: Some(BASE64.encode(&edited_bytes)),
        proof: Some(BASE64.encode(&proof_output.proof_data)),
        proof_size: Some(proof_output.proof_data.len()),
        proving_time_ms: Some(proof_output.proving_time_ms),
        verification_time_ms: None,
        verified: None,
        technical_details: Some(TechnicalDetails {
            image_pixels: gray.pixel_count(),
            circuit_size: proof_stats.circuit_info.num_gates,
            num_constraints: None,
            hash_type: "Poseidon".to_string(),
            proof_system: "Plonky2 (PLONK + FRI)".to_string(),
            field_size_bits: 64,
            security_bits: 100,
            peak_memory_mb: Some(peak_memory),
            memory_before_mb: Some(memory_before),
            memory_after_mb: Some(memory_after),
            cpu_time_ms: Some(proof_output.proving_time_ms),
            wall_time_ms: Some(wall_time_ms),
        }),
    })
}

async fn process_blur(
    pixels: &image_io::PixelVectors,
    x: u32, y: u32, width: u32, height: u32,
    config: &ProofConfig,
) -> anyhow::Result<JobResult> {
    // Capture resource metrics before
    let memory_before = get_process_memory_mb();
    let wall_start = Instant::now();
    
    // Apply blur
    let blurred = blur_pixels(pixels, x, y, width, height)?;
    
    // Generate proof for R channel
    let proof_output = veritas::prove_blur(
        &pixels.r, pixels.width, pixels.height,
        x, y, width, height,
        config,
    )?;
    
    // Capture resource metrics after
    let wall_time_ms = wall_start.elapsed().as_millis() as u64;
    let memory_after = get_process_memory_mb();
    let peak_memory = memory_after.max(memory_before);
    
    // Convert to image
    let edited_img = pixel_vectors_to_image(&blurred)?;
    let edited_bytes = image_to_png_bytes(&edited_img)?;
    
    let proof_stats = veritas::get_proof_stats(&proof_output, "blur");
    
    Ok(JobResult {
        edited_image: Some(BASE64.encode(&edited_bytes)),
        proof: Some(BASE64.encode(&proof_output.proof_data)),
        proof_size: Some(proof_output.proof_data.len()),
        proving_time_ms: Some(proof_output.proving_time_ms),
        verification_time_ms: None,
        verified: None,
        technical_details: Some(TechnicalDetails {
            image_pixels: blurred.pixel_count(),
            circuit_size: proof_stats.circuit_info.num_gates,
            num_constraints: None,
            hash_type: "Poseidon".to_string(),
            proof_system: "Plonky2 (PLONK + FRI)".to_string(),
            field_size_bits: 64,
            security_bits: 100,
            peak_memory_mb: Some(peak_memory),
            memory_before_mb: Some(memory_before),
            memory_after_mb: Some(memory_after),
            cpu_time_ms: Some(proof_output.proving_time_ms),
            wall_time_ms: Some(wall_time_ms),
        }),
    })
}

async fn process_resize(
    pixels: &image_io::PixelVectors,
    new_width: u32, new_height: u32,
    config: &ProofConfig,
) -> anyhow::Result<JobResult> {
    // Capture resource metrics before
    let memory_before = get_process_memory_mb();
    let wall_start = Instant::now();
    
    // Apply resize
    let resized = resize_pixels(pixels, new_width, new_height);
    
    // Generate proof for R channel
    let proof_output = veritas::prove_resize(
        &pixels.r, pixels.width, pixels.height,
        new_width, new_height,
        config,
    )?;
    
    // Capture resource metrics after
    let wall_time_ms = wall_start.elapsed().as_millis() as u64;
    let memory_after = get_process_memory_mb();
    let peak_memory = memory_after.max(memory_before);
    
    // Convert to image
    let edited_img = pixel_vectors_to_image(&resized)?;
    let edited_bytes = image_to_png_bytes(&edited_img)?;
    
    let proof_stats = veritas::get_proof_stats(&proof_output, "resize");
    
    Ok(JobResult {
        edited_image: Some(BASE64.encode(&edited_bytes)),
        proof: Some(BASE64.encode(&proof_output.proof_data)),
        proof_size: Some(proof_output.proof_data.len()),
        proving_time_ms: Some(proof_output.proving_time_ms),
        verification_time_ms: None,
        verified: None,
        technical_details: Some(TechnicalDetails {
            image_pixels: resized.pixel_count(),
            circuit_size: proof_stats.circuit_info.num_gates,
            num_constraints: None,
            hash_type: "Poseidon".to_string(),
            proof_system: "Plonky2 (PLONK + FRI)".to_string(),
            field_size_bits: 64,
            security_bits: 100,
            peak_memory_mb: Some(peak_memory),
            memory_before_mb: Some(memory_before),
            memory_after_mb: Some(memory_after),
            cpu_time_ms: Some(proof_output.proving_time_ms),
            wall_time_ms: Some(wall_time_ms),
        }),
    })
}

/// Get job status
async fn get_job_status(
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> impl Responder {
    let job_id = path.into_inner();
    
    let jobs = state.jobs.read().await;
    match jobs.get(&job_id) {
        Some(job) => HttpResponse::Ok().json(job),
        None => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Job not found"
        })),
    }
}

/// Request body for verification
#[derive(Debug, Deserialize)]
pub struct VerifyRequest {
    pub proof: String,
    pub public_inputs: Vec<u64>,
    pub edit_type: String,
}

/// Verify a proof
async fn verify_proof(body: web::Json<VerifyRequest>) -> impl Responder {
    let proof_bytes = match BASE64.decode(&body.proof) {
        Ok(bytes) => bytes,
        Err(e) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": format!("Invalid base64 proof: {}", e)
            }));
        }
    };
    
    let result = veritas::verify_proof(&proof_bytes, &body.public_inputs, &body.edit_type);
    
    HttpResponse::Ok().json(result)
}

/// Get demo information
async fn get_demo_info() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "name": "VerITAS Demo",
        "description": "Verifying Image Transformations at Scale using Zero-Knowledge Proofs",
        "paper": {
            "title": "VerITAS: Verifying Image Transformations at Scale",
            "authors": ["Trisha Datta", "Binyi Chen", "Dan Boneh"],
            "institution": "Stanford University",
            "year": 2024
        },
        "supported_edits": [
            {
                "type": "crop",
                "description": "Extract a rectangular region from the image",
                "params": ["x", "y", "width", "height"]
            },
            {
                "type": "grayscale",
                "description": "Convert to grayscale using Photoshop formula (0.30R + 0.59G + 0.11B)",
                "params": []
            },
            {
                "type": "blur",
                "description": "Apply 3x3 box blur to a region",
                "params": ["x", "y", "width", "height"]
            },
            {
                "type": "resize",
                "description": "Resize using bilinear interpolation",
                "params": ["new_width", "new_height"]
            }
        ],
        "technical_details": {
            "proof_system": "Plonky2 (PLONK + FRI-PCS)",
            "field": "Goldilocks (64-bit prime)",
            "hash_function": "Lattice + Poseidon",
            "security_level": "~100 bits"
        }
    }))
}
