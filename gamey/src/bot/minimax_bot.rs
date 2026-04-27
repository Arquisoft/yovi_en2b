//! Generic minimax-based [`YBot`] implementation.
//!
//! [`MinimaxBot`] is the single concrete bot type that wraps the engine in
//! [`crate::bot::minimax`]. It is parameterised by:
//!
//! * **`name`** — registry key, used as `{bot_id}` in the HTTP route.
//! * **`move_min_ms` / `move_max_ms`** — soft and hard time gates for the
//!   per-move iterative-deepening search.
//! * **`pie_ms`** — time budget split between the two halves of a Pie Rule
//!   decision and across the candidate cells of a Pie Rule opening.
//! * **`goal`** — interpretation of terminal positions (standard Y or misère
//!   WhY Not?).
//!
//! The four built-in difficulties are provided as `const` factory functions:
//! [`MinimaxBot::fast_y`], [`MinimaxBot::smart_y`],
//! [`MinimaxBot::fast_whynot`], [`MinimaxBot::smart_whynot`].
//!
//! Adding a new difficulty or variant only requires adding another factory —
//! the engine and trait wiring stay untouched.

use crate::bot::minimax::{
    Goal, choose_move_with_minimax, choose_pie_opening_with_minimax, decide_pie_with_minimax,
};
use crate::bot::ybot::PieChoice;
use crate::{Coordinates, GameY, YBot};

/// A single minimax-driven [`YBot`] configuration.
pub struct MinimaxBot {
    name: &'static str,
    move_min_ms: u64,
    move_max_ms: u64,
    pie_ms: u64,
    goal: Goal,
}

impl MinimaxBot {
    /// Constructs a custom bot. Prefer the named factories below for the four
    /// difficulties wired into the HTTP server.
    pub const fn new(
        name: &'static str,
        move_min_ms: u64,
        move_max_ms: u64,
        pie_ms: u64,
        goal: Goal,
    ) -> Self {
        Self { name, move_min_ms, move_max_ms, pie_ms, goal }
    }

    /// Y, MEDIUM — minimax with a tight 500 ms move budget.
    pub const fn fast_y() -> Self {
        Self::new("fast_bot", 500, 500, 500, Goal::Standard)
    }

    /// Y, HARD — iterative deepening with a 1 000–3 000 ms move budget and
    /// 2 000 ms for Pie Rule decisions.
    pub const fn smart_y() -> Self {
        Self::new("smart_bot", 1000, 3000, 2000, Goal::Standard)
    }

    /// WhY Not?, MEDIUM — same cadence as [`Self::fast_y`] but optimising for
    /// the misère goal.
    pub const fn fast_whynot() -> Self {
        Self::new("whynot_fast_bot", 500, 500, 500, Goal::Misere)
    }

    /// WhY Not?, HARD — same cadence as [`Self::smart_y`] but optimising for
    /// the misère goal.
    pub const fn smart_whynot() -> Self {
        Self::new("whynot_smart_bot", 1000, 3000, 2000, Goal::Misere)
    }
}

impl YBot for MinimaxBot {
    fn name(&self) -> &str {
        self.name
    }

    fn choose_move(&self, game: &GameY) -> Option<Coordinates> {
        choose_move_with_minimax(game, self.move_min_ms, self.move_max_ms, self.goal)
    }

    fn choose_pie_opening(&self, game: &GameY) -> Option<Coordinates> {
        choose_pie_opening_with_minimax(game, self.pie_ms, self.goal)
    }

    fn decide_pie(&self, game: &GameY) -> PieChoice {
        decide_pie_with_minimax(game, self.pie_ms, self.goal)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{Coordinates, Movement, PlayerId, YBotRegistry};
    use std::sync::Arc;

    // ── Registry integration ────────────────────────────────────────────────
    //
    // Each bot's `name()` is the registry key and the {bot_id} URL parameter.
    // A mismatch silently breaks PvE games at the corresponding difficulty.

    #[test]
    fn fast_y_is_findable_in_registry() {
        let registry = YBotRegistry::new().with_bot(Arc::new(MinimaxBot::fast_y()));
        assert!(registry.find("fast_bot").is_some());
    }

    #[test]
    fn smart_y_is_findable_in_registry() {
        let registry = YBotRegistry::new().with_bot(Arc::new(MinimaxBot::smart_y()));
        assert!(registry.find("smart_bot").is_some());
    }

    #[test]
    fn fast_whynot_is_findable_in_registry() {
        let registry = YBotRegistry::new().with_bot(Arc::new(MinimaxBot::fast_whynot()));
        assert!(registry.find("whynot_fast_bot").is_some());
    }

    #[test]
    fn smart_whynot_is_findable_in_registry() {
        let registry = YBotRegistry::new().with_bot(Arc::new(MinimaxBot::smart_whynot()));
        assert!(registry.find("whynot_smart_bot").is_some());
    }

    // ── Move legality ───────────────────────────────────────────────────────

    fn assert_returns_available_cell(bot: &dyn YBot, board: &GameY) {
        let coords = bot
            .choose_move(board)
            .expect("bot must return a move on a non-empty board");
        let idx = coords.to_index(board.board_size());
        assert!(
            board.available_cells().contains(&idx),
            "{} returned out-of-bounds cell",
            bot.name()
        );
    }

    #[test]
    fn all_minimax_bots_return_available_cell_on_fresh_board() {
        let board = GameY::new(4);
        for bot in [
            MinimaxBot::fast_y(),
            MinimaxBot::smart_y(),
            MinimaxBot::fast_whynot(),
            MinimaxBot::smart_whynot(),
        ] {
            assert_returns_available_cell(&bot, &board);
        }
    }

    #[test]
    fn fast_y_avoids_occupied_cell() {
        let mut game = GameY::new(4);
        let occupied = Coordinates::new(1, 1, 1);
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: occupied,
        })
        .unwrap();

        let bot = MinimaxBot::fast_y();
        let chosen = bot.choose_move(&game).expect("bot must return a move");
        assert_ne!(chosen, occupied);
    }

    #[test]
    fn smart_y_avoids_occupied_cell() {
        let mut game = GameY::new(4);
        let occupied = Coordinates::new(1, 1, 1);
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: occupied,
        })
        .unwrap();

        let bot = MinimaxBot::smart_y();
        let chosen = bot.choose_move(&game).expect("bot must return a move");
        assert_ne!(chosen, occupied);
    }

    // ── Misère terminal scoring ─────────────────────────────────────────────
    //
    // On a fresh board no single placement can complete a 3-side connection,
    // so the misère bot must never accidentally suicide.

    #[test]
    fn fast_whynot_does_not_immediately_lose_on_fresh_board() {
        let board = GameY::new(4);
        let bot = MinimaxBot::fast_whynot();
        let coords = bot.choose_move(&board).unwrap();

        let mut sim = board.clone();
        sim.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords,
        })
        .unwrap();
        assert!(
            !sim.check_game_over(),
            "fast misère bot must not immediately complete the 3-side connection"
        );
    }

    #[test]
    fn smart_whynot_does_not_immediately_lose_on_fresh_board() {
        let board = GameY::new(4);
        let bot = MinimaxBot::smart_whynot();
        let coords = bot.choose_move(&board).unwrap();

        let mut sim = board.clone();
        sim.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords,
        })
        .unwrap();
        assert!(
            !sim.check_game_over(),
            "smart misère bot must not immediately complete the 3-side connection"
        );
    }

    #[test]
    fn smart_whynot_returns_none_on_full_board() {
        let mut board = GameY::new(1);
        board
            .add_move(Movement::Placement {
                player: PlayerId::new(0),
                coords: Coordinates::new(0, 0, 0),
            })
            .unwrap();
        assert!(MinimaxBot::smart_whynot().choose_move(&board).is_none());
    }

    // ── Pie Rule plumbing ───────────────────────────────────────────────────

    #[test]
    fn fast_y_pie_opening_returns_available_cell() {
        let board = GameY::new(5);
        let coords = MinimaxBot::fast_y()
            .choose_pie_opening(&board)
            .expect("pie opening must return a move on a fresh board");
        let idx = coords.to_index(board.board_size());
        assert!(board.available_cells().contains(&idx));
    }

    #[test]
    fn fast_whynot_pie_opening_returns_available_cell() {
        let board = GameY::new(5);
        let coords = MinimaxBot::fast_whynot()
            .choose_pie_opening(&board)
            .expect("pie opening must return a move on a fresh board");
        let idx = coords.to_index(board.board_size());
        assert!(board.available_cells().contains(&idx));
    }

    // The unique interior cell on a size-4 board is the strongest possible
    // opening: a rational standard-Y second player should swap to claim it.
    #[test]
    fn fast_y_swaps_strong_center_opening() {
        let mut game = GameY::new(4);
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(1, 1, 1),
        })
        .unwrap();

        assert_eq!(MinimaxBot::fast_y().decide_pie(&game), PieChoice::Swap);
    }

    #[test]
    fn smart_y_swaps_strong_center_opening() {
        let mut game = GameY::new(4);
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(1, 1, 1),
        })
        .unwrap();

        assert_eq!(MinimaxBot::smart_y().decide_pie(&game), PieChoice::Swap);
    }
}
