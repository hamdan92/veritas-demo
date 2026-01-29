use actix_cors::Cors;
use actix_web::{web, App, HttpServer, middleware};
use tokio::sync::RwLock;
use std::collections::HashMap;

mod api;
mod image_io;
mod jobs;
mod veritas;

use jobs::Job;

/// Application state shared across handlers
pub struct AppState {
    pub jobs: RwLock<HashMap<String, Job>>,
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));

    let port = std::env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let host = std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());

    log::info!("Starting VerITAS Demo API on {}:{}", host, port);

    let app_state = web::Data::new(AppState {
        jobs: RwLock::new(HashMap::new()),
    });

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);

        App::new()
            .app_data(app_state.clone())
            .wrap(cors)
            .wrap(middleware::Logger::default())
            .configure(api::configure_routes)
    })
    .bind(format!("{}:{}", host, port))?
    .run()
    .await
}
