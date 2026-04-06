//! Bot module for the Game of Y.
//!
//! This module provides the infrastructure for creating and managing AI bots
//! that can play the Game of Y. It includes:
//!
//! - [`YBot`] - A trait that defines the interface for all bots
//! - [`YBotRegistry`] - A registry for managing multiple bot implementations
//! - [`RandomBot`] - A simple bot that makes random valid moves
//! - [`FastBot`] - Minimax bot with a 500 ms time budget (MEDIUM difficulty)
//! - [`SmartBot`] - Minimax bot with a 1 000–3 000 ms time budget (HARD difficulty)

pub mod fast_bot;
pub mod minimax;
pub mod random;
pub mod smart_bot;
pub mod ybot;
pub mod ybot_registry;
pub use fast_bot::*;
pub use minimax::choose_move_with_minimax;
pub use random::*;
pub use smart_bot::*;
pub use ybot::*;
pub use ybot_registry::*;
