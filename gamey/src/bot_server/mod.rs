//! HTTP server for Y and WhY Not? bots.
//!
//! This module provides an Axum-based REST API for querying game bots.
//! Both variants share the same handlers — they differ only in URL prefix
//! (`/v1/ybot/...` vs `/v1/whynot/...`) and in which bot names are valid for
//! lookups in the [`YBotRegistry`].
//!
//! # Endpoints
//! - `GET /status` — Health check
//! - `POST /{api_version}/{variant_prefix}/choose/{bot_id}` — Move selection
//! - `POST /{api_version}/{variant_prefix}/pie-decide/{bot_id}` — Pie decision
//! - `POST /{api_version}/{variant_prefix}/pie-opening/{bot_id}` — Pie opening
//!
//! `variant_prefix` is `ybot` for Y and `whynot` for WhY Not?.

pub mod choose;
pub mod error;
pub mod pie_decide;
pub mod pie_opening;
pub mod state;
pub mod version;
use axum::response::IntoResponse;
pub use choose::MoveResponse;
pub use error::ErrorResponse;
pub use pie_decide::PieDecideResponse;
pub use pie_opening::PieOpeningResponse;
use std::sync::Arc;
pub use version::*;

use crate::{GameYError, MinimaxBot, RandomBot, YBotRegistry, state::AppState};

/// Creates the Axum router with the given state.
///
/// This is useful for testing the API without binding to a network port.
pub fn create_router(state: AppState) -> axum::Router {
    axum::Router::new()
        .route("/status", axum::routing::get(status))
        // Y game bots
        .route(
            "/{api_version}/ybot/choose/{bot_id}",
            axum::routing::post(choose::choose),
        )
        .route(
            "/{api_version}/ybot/pie-decide/{bot_id}",
            axum::routing::post(pie_decide::pie_decide),
        )
        .route(
            "/{api_version}/ybot/pie-opening/{bot_id}",
            axum::routing::post(pie_opening::pie_opening),
        )
        // WhY Not? bots — same handlers, different URL prefix and bot names
        .route(
            "/{api_version}/whynot/choose/{bot_id}",
            axum::routing::post(choose::choose),
        )
        .route(
            "/{api_version}/whynot/pie-decide/{bot_id}",
            axum::routing::post(pie_decide::pie_decide),
        )
        .route(
            "/{api_version}/whynot/pie-opening/{bot_id}",
            axum::routing::post(pie_opening::pie_opening),
        )
        .with_state(state)
}

/// Creates the default application state with the standard bot registry.
///
/// Registered bots:
/// - `random_bot`        — random move selection (EASY for both Y and WhY Not?)
/// - `fast_bot`          — Y, MEDIUM   (minimax 500 ms, standard goal)
/// - `smart_bot`         — Y, HARD     (minimax 1 000–3 000 ms, standard goal)
/// - `whynot_fast_bot`   — WhY Not?, MEDIUM (same minimax, misère goal)
/// - `whynot_smart_bot`  — WhY Not?, HARD   (same minimax, misère goal)
///
/// `RandomBot` is reused for both variants because uniform random play is
/// independent of the win condition.
pub fn create_default_state() -> AppState {
    let bots = YBotRegistry::new()
        .with_bot(Arc::new(RandomBot))
        .with_bot(Arc::new(MinimaxBot::fast_y()))
        .with_bot(Arc::new(MinimaxBot::smart_y()))
        .with_bot(Arc::new(MinimaxBot::fast_whynot()))
        .with_bot(Arc::new(MinimaxBot::smart_whynot()));
    AppState::new(bots)
}

/// Starts the bot server on the specified port.
///
/// This function blocks until the server is shut down.
///
/// # Arguments
/// * `port` - The TCP port to listen on
///
/// # Errors
/// Returns `GameYError::ServerError` if:
/// - The TCP port cannot be bound (e.g., port already in use, permission denied)
/// - The server encounters an error while running
pub async fn run_bot_server(port: u16) -> Result<(), GameYError> {
    let state = create_default_state();
    let app = create_router(state);

    let addr = format!("0.0.0.0:{}", port);
    let listener =
        tokio::net::TcpListener::bind(&addr)
            .await
            .map_err(|e| GameYError::ServerError {
                message: format!("Failed to bind to {}: {}", addr, e),
            })?;

    println!("Server mode: Listening on http://{}", addr);
    axum::serve(listener, app)
        .await
        .map_err(|e| GameYError::ServerError {
            message: format!("Server error: {}", e),
        })?;

    Ok(())
}

/// Health check endpoint handler.
///
/// Returns "OK" to indicate the server is running.
pub async fn status() -> impl IntoResponse {
    "OK"
}
