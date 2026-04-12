//! A simple random bot implementation.
//!
//! This module provides [`RandomBot`], a bot that makes random valid moves.
//! It is useful for testing and as a baseline opponent.

use crate::{Coordinates, GameY, YBot};
use crate::bot::ybot::PieChoice;
use rand::Rng;
use rand::prelude::IndexedRandom;

/// A bot that chooses moves randomly from the available cells.
///
/// This is the simplest possible bot implementation - it simply picks
/// a random empty cell on the board. While not strategic, it serves as
/// a useful baseline and testing tool.
///
/// # Example
///
/// ```
/// use gamey::{GameY, RandomBot, YBot};
///
/// let bot = RandomBot;
/// let game = GameY::new(5);
///
/// // The bot will always return Some when there are available moves
/// let chosen_move = bot.choose_move(&game);
/// assert!(chosen_move.is_some());
/// ```
pub struct RandomBot;

impl YBot for RandomBot {
    fn name(&self) -> &str {
        "random_bot"
    }

    fn choose_move(&self, board: &GameY) -> Option<Coordinates> {
        let available_cells = board.available_cells();
        let cell = available_cells.choose(&mut rand::rng())?;
        let coordinates = Coordinates::from_index(*cell, board.board_size());
        Some(coordinates)
    }

    fn decide_pie(&self, _board: &GameY) -> PieChoice {
        if rand::rng().random_bool(0.5) {
            PieChoice::Swap
        } else {
            PieChoice::Keep
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{Movement, PlayerId};

    // The bot name is the registry key used in HTTP routes.
    // A mismatch silently breaks all PvE games at easy difficulty.
    #[test]
    fn test_random_bot_is_findable_in_registry() {
        use crate::YBotRegistry;
        use std::sync::Arc;
        let registry = YBotRegistry::new().with_bot(Arc::new(RandomBot));
        assert!(
            registry.find("random_bot").is_some(),
            "RandomBot must be retrievable by its own name — name/key mismatch breaks the HTTP API"
        );
    }

    // choose_move must return a cell that is actually available; an occupied or
    // out-of-bounds index would crash the game service on move application.
    #[test]
    fn test_random_bot_choose_move_returns_available_cell() {
        let game = GameY::new(5);
        let coords = RandomBot
            .choose_move(&game)
            .expect("bot must return a move on a non-empty board");
        let idx = coords.to_index(game.board_size());
        assert!(
            game.available_cells().contains(&idx),
            "chosen cell index {idx} is not in available_cells"
        );
    }

    #[test]
    fn test_random_bot_returns_valid_coordinates() {
        let bot = RandomBot;
        let game = GameY::new(5);

        let coords = bot.choose_move(&game).unwrap();
        let index = coords.to_index(game.board_size());

        // Index should be within the valid range for a size-5 board
        // Total cells = (5 * 6) / 2 = 15
        assert!(index < 15);
    }

    #[test]
    fn test_random_bot_returns_none_on_full_board() {
        let bot = RandomBot;
        let mut game = GameY::new(2);

        // Fill the board (size 2 has 3 cells)
        let moves = vec![
            Movement::Placement {
                player: PlayerId::new(0),
                coords: Coordinates::new(1, 0, 0),
            },
            Movement::Placement {
                player: PlayerId::new(1),
                coords: Coordinates::new(0, 1, 0),
            },
            Movement::Placement {
                player: PlayerId::new(0),
                coords: Coordinates::new(0, 0, 1),
            },
        ];

        for mv in moves {
            game.add_move(mv).unwrap();
        }

        // Board is now full
        assert!(game.available_cells().is_empty());
        let chosen_move = bot.choose_move(&game);
        assert!(chosen_move.is_none());
    }

    #[test]
    fn test_random_bot_chooses_from_available_cells() {
        let bot = RandomBot;
        let mut game = GameY::new(3);

        // Make some moves to reduce available cells
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(2, 0, 0),
        })
        .unwrap();

        let coords = bot.choose_move(&game).unwrap();
        let index = coords.to_index(game.board_size());

        // The chosen index should be in the available cells
        assert!(game.available_cells().contains(&index));
    }

    #[test]
    fn test_random_bot_multiple_calls_return_valid_moves() {
        let bot = RandomBot;
        let game = GameY::new(7);

        // Call choose_move multiple times to exercise the randomness
        for _ in 0..10 {
            let coords = bot.choose_move(&game).unwrap();
            let index = coords.to_index(game.board_size());

            // Total cells for size 7 = (7 * 8) / 2 = 28
            assert!(index < 28);
            assert!(game.available_cells().contains(&index));
        }
    }

    // RandomBot.decide_pie is a fair 50/50 coin flip.  Across enough trials
    // both outcomes must appear; if only one is ever returned the random
    // source is broken or the implementation is hardcoded.
    // P(seeing only one outcome in 50 trials) ≈ 2 × 0.5^50 < 10^-14.
    #[test]
    fn test_random_bot_decide_pie_eventually_returns_both_choices() {
        let mut game = GameY::new(5);
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(2, 1, 1),
        })
        .unwrap();

        let mut saw_keep = false;
        let mut saw_swap = false;
        for _ in 0..50 {
            match RandomBot.decide_pie(&game) {
                PieChoice::Keep => saw_keep = true,
                PieChoice::Swap => saw_swap = true,
            }
            if saw_keep && saw_swap {
                break;
            }
        }
        assert!(saw_keep, "RandomBot.decide_pie never returned Keep across 50 trials");
        assert!(saw_swap, "RandomBot.decide_pie never returned Swap across 50 trials");
    }
}
