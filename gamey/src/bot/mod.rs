//! Bot module for the Game of Y and WhY Not?.
//!
//! This module provides the infrastructure for creating and managing AI bots.
//! It includes:
//!
//! - [`YBot`] — the trait that defines the bot interface.
//! - [`YBotRegistry`] — name-keyed registry consumed by the HTTP server.
//! - [`RandomBot`] — random move selection (EASY for both variants).
//! - [`MinimaxBot`] — single configurable bot wrapping the minimax engine,
//!   with built-in factories for the four difficulty/variant combinations.
//!
//! Adding a new variant or difficulty only requires extending [`minimax::Goal`]
//! (if needed) and adding a factory on `MinimaxBot` — the trait, registry, and
//! HTTP plumbing remain untouched.

pub mod minimax;
pub mod minimax_bot;
pub mod random;
pub mod ybot;
pub mod ybot_registry;

pub use minimax::Goal;
pub use minimax_bot::*;
pub use random::*;
pub use ybot::*;
pub use ybot_registry::*;
