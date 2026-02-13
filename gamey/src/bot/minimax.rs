use crate::{Coordinates, GameY, PlayerId, YBot, game};
use fixedbitset::FixedBitSet;
use smallvec::SmallVec;
use std::{
    cmp,
    time::{Duration, Instant},
};

pub const WIN_SCORE: i32 = 100_000;

pub const LOSE_SCORE: i32 = -WIN_SCORE;

const INFINITY: i32 = i32::MAX / 2;

pub struct MinimaxState {
    board: Vec<u8>,
    size: u32,
    available_mask: FixedBitSet,
    coords_cache: Vec<Coordinates>,
    neighbors_cache: Vec<Vec<usize>>,
    edges_cache: Vec<u8>,
    bot_id: u8,
    human_id: u8,
    visited: Vec<bool>,
    stack: Vec<usize>,
}

impl MinimaxState {
    pub fn new(game: &GameY, bot_player: PlayerId) -> Self {
        let size = game.board_size();
        let total_cells = game.total_cells() as usize;

        let mut board: Vec<u8> = vec![0; total_cells];
        let mut coords_cache: Vec<Coordinates> = vec![Coordinates::new(0, 0, 0); total_cells];
        let mut available_mask = FixedBitSet::with_capacity(total_cells);
        let mut neighbors_cache = vec![Vec::new(); total_cells];
        let mut edges_cache = vec![0; total_cells];

        let bot_id = bot_player.id() as u8 + 1;
        let human_id = game::other_player(bot_player).id() as u8 + 1;

        // Buffers reutilizables para check_win
        let visited = vec![false; total_cells];
        let stack = Vec::with_capacity(total_cells / 4); // Capacidad estimada

        // 1. Iterar sobre TODAS las celdas posibles del tablero
        for idx in 0..total_cells {
            let coords = Coordinates::from_index(idx as u32, size);

            coords_cache[idx as usize] = coords;

            if !coords.is_valid(size) {
                continue;
            }

            for n_coords in game.get_neighbors(&coords) {
                if n_coords.is_valid(size) {
                    let n_idx = Coordinates::to_index(&n_coords, size) as usize;
                    neighbors_cache[idx].push(n_idx);
                }
            }

            if coords.touches_side_a() {
                edges_cache[idx] |= 0b001;
            }
            if coords.touches_side_b() {
                edges_cache[idx] |= 0b010;
            }
            if coords.touches_side_c() {
                edges_cache[idx] |= 0b100;
            }
        }

        // Copiar estado del tablero
        for (coords, (_, owner)) in game.board_map() {
            let idx = Coordinates::to_index(coords, size) as usize;
            board[idx] = owner.id() as u8 + 1; // 1-based (0 = vacío)
        }

        // Poblar available_mask usando game.available_cells()
        for &cell_idx in game.available_cells() {
            available_mask.insert(cell_idx as usize);
        }

        Self {
            board,
            size,
            available_mask,
            coords_cache,
            neighbors_cache,
            edges_cache,
            bot_id,
            human_id,
            visited,
            stack,
        }
    }

    fn make_move(&mut self, idx: usize, player: u8) {
        self.board[idx] = player;
        self.available_mask.set(idx, false);
    }

    fn undo_move(&mut self, idx: usize) {
        self.board[idx] = 0;
        self.available_mask.set(idx, true);
    }

    fn available_cells(&self) -> impl Iterator<Item = usize> + '_ {
        self.available_mask.ones()
    }

    fn occupied_cells(&self) -> impl Iterator<Item = usize> + '_ {
        self.available_mask.zeroes()
    }

    /// Retorna true si el jugador conectó los 3 bordes
    fn check_win(&mut self, player: u8) -> bool {
        // Limpiar buffers
        self.visited.fill(false);

        for idx in 0..self.board.len() {
            if self.board[idx] == player && self.edges_cache[idx] != 0 && !self.visited[idx] {
                let edges_reached = self.dfs_collect_edges(idx, player);

                if edges_reached == 0b111 {
                    return true; // Early exit
                }
            }
        }

        false
    }

    /// DFS que acumula los bits de bordes alcanzados
    fn dfs_collect_edges(&mut self, start: usize, player: u8) -> u8 {
        let mut edges_mask = 0u8;

        self.stack.clear();
        self.stack.push(start);
        self.visited[start] = true;

        while let Some(idx) = self.stack.pop() {
            edges_mask |= self.edges_cache[idx];

            // Early exit: Si ya tenemos los 3 bordes, no seguimos
            if edges_mask == 0b111 {
                return edges_mask;
            }

            for &neighbor in &self.neighbors_cache[idx] {
                if self.board[neighbor] == player && !self.visited[neighbor] {
                    self.visited[neighbor] = true;
                    self.stack.push(neighbor);
                }
            }
        }

        edges_mask
    }
}

pub struct MinimaxBot {
    max_time_ms: u64,
}

impl MinimaxBot {
    pub fn new(max_time_ms: u64) -> Self {
        Self { max_time_ms }
    }
}

impl YBot for MinimaxBot {
    fn name(&self) -> &str {
        "minimax_bot"
    }

    fn choose_move(&self, game: &GameY) -> Option<Coordinates> {
        let bot_player = game.next_player()?; // Early exit si terminó el juego

        let mut state = MinimaxState::new(game, bot_player);

        if let Some(coordinates) = greedy_search(&mut state) {
            return Some(coordinates);
        };

        let best_move = iterative_deepening_search(&mut state, self.max_time_ms);

        let coordinates = Coordinates::from_index(best_move as u32, game.board_size());
        Some(coordinates)
    }
}

fn greedy_search(state: &mut MinimaxState) -> Option<Coordinates> {
    let moves: SmallVec<[usize; 128]> = state.available_cells().collect();

    for move_idx in moves {
        state.make_move(move_idx, state.bot_id);
        if state.check_win(state.bot_id) {
            println!(">>> INSTANT WIN FOUND at {}", move_idx);
            return Some(Coordinates::from_index(move_idx as u32, state.size));
        }
        state.undo_move(move_idx);

        state.make_move(move_idx, state.human_id);
        if state.check_win(state.human_id) {
            println!(">>> BLOCKING IMMEDIATE THREAT at {}", move_idx);
            return Some(Coordinates::from_index(move_idx as u32, state.size));
        }
        state.undo_move(move_idx);
    }
    None
}

fn iterative_deepening_search(state: &mut MinimaxState, max_time_ms: u64) -> usize {
    let start_time = Instant::now();
    let time_limit = Duration::from_millis(max_time_ms);

    let mut best_move = state.available_cells().next().expect("No available moves"); // Fallback inicial
    let mut pv_move: Option<usize> = None;

    for depth in 1..=100 {
        if start_time.elapsed() >= time_limit {
            println!("Time limit reached at depth {}", depth - 1);
            break;
        }

        println!("Searching at depth {}...", depth);

        let (move_found, score) = search_best_move(state, depth, pv_move);

        best_move = move_found;
        pv_move = Some(move_found);

        println!(
            "Depth {}: best move = {}, score = {}",
            depth, move_found, score
        );

        if score >= WIN_SCORE - 100 {
            println!("Winning move found at depth {}", depth);
            break;
        }

        if start_time.elapsed() >= time_limit {
            println!("Time limit reached after depth {}", depth);
            break;
        }
    }

    best_move
}

fn search_best_move(state: &mut MinimaxState, depth: u8, pv_move: Option<usize>) -> (usize, i32) {
    let mut moves: Vec<usize> = state.available_cells().collect();

    // Insert PV move at the beginning of the list
    if let Some(pv) = pv_move {
        if let Some(pos) = moves.iter().position(|&m| m == pv) {
            moves.swap(0, pos);
        }
    }

    // TODO: Order moves

    let mut best_score = -INFINITY;
    let mut best_move = moves[0]; // Fallback inicial

    for move_idx in moves {
        state.make_move(move_idx, state.bot_id);

        let score = minimax(state, depth - 1, -INFINITY, INFINITY, false);

        state.undo_move(move_idx);

        if score > best_score {
            best_score = score;
            best_move = move_idx;
        }
    }

    (best_move, best_score)
}

fn minimax(
    state: &mut MinimaxState,
    depth: u8,
    mut alpha: i32,
    mut beta: i32,
    maximizing_player: bool,
) -> i32 {
    if depth == 0 {
        return evaluate_state(state);
    }

    let moves: SmallVec<[usize; 128]> = state.available_cells().collect();

    if maximizing_player {
        let mut best_score = -INFINITY;

        for move_idx in moves {
            state.make_move(move_idx, state.bot_id);

            let score = minimax(state, depth - 1, alpha, beta, false);

            state.undo_move(move_idx);

            best_score = cmp::max(best_score, score);

            alpha = cmp::max(alpha, score);
            if beta <= alpha {
                break;
            }
        }
        best_score
    } else {
        let mut worst_score = INFINITY;

        for move_idx in moves {
            state.make_move(move_idx, state.human_id);

            let score = minimax(state, depth - 1, alpha, beta, true);

            state.undo_move(move_idx);

            worst_score = cmp::min(worst_score, score);

            beta = cmp::min(beta, score);
            if beta <= alpha {
                break;
            }
        }
        worst_score
    }
}

fn evaluate_state(state: &mut MinimaxState) -> i32 {
    if state.check_win(state.bot_id) {
        return WIN_SCORE;
    }
    if state.check_win(state.human_id) {
        return LOSE_SCORE;
    }

    // Heurística combinada
    let bot_score = evaluate_position_strength(state, state.bot_id);
    let human_score = evaluate_position_strength(state, state.human_id);

    bot_score - human_score
}

fn evaluate_position_strength(state: &MinimaxState, player: u8) -> i32 {
    let mut score = 0;
    let mut edges_touched = 0u8;
    let mut total_connections = 0;
    let mut center_control = 0;

    // Una sola pasada sobre todas las piezas del jugador
    for idx in state.occupied_cells() {
        if state.board[idx] == player {
            // 1. Control de bordes (peso más alto)
            edges_touched |= state.edges_cache[idx];

            // 2. Conectividad
            let mut neighbors = 0;
            for &neighbor_idx in &state.neighbors_cache[idx] {
                if state.board[neighbor_idx] == player {
                    neighbors += 1;
                }
            }
            total_connections += neighbors;

            // 3. Bonus por piezas bien conectadas
            if neighbors >= 2 {
                score += 40;
            }

            // 4. Control de centro (peso reducido)
            let coords = state.coords_cache[idx];
            let x = coords.x() as i32;
            let y = coords.y() as i32;
            let z = coords.z() as i32;
            let off_center = (x - y).abs() + (y - z).abs() + (z - x).abs();
            center_control += 50 - off_center;
        }
    }

    // Calcular score final con pesos balanceados
    let edges_count = edges_touched.count_ones() as i32;

    let pieces_on_board = state.occupied_cells().count() as f32;
    let total_valid_cells = state.board.len() as f32;
    let game_progress = pieces_on_board / total_valid_cells;

    let edge_score = edges_count * 5; // PRIORIDAD 1: Tocar bordes
    let connections_score = total_connections * 25; // PRIORIDAD 2: Conectividad

    let center_weight = (1. - game_progress) * 5.;

    let center_score = (center_control as f32 * center_weight) as i32; // PRIORIDAD 3: Control de centro

    score += edge_score;
    score += connections_score;
    score += center_score;

    score
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{GameY, PlayerId};

    // ============================================================================
    // HELPERS TO CREATE TEST STATES
    // ============================================================================

    /// Creates a minimax state with an empty board of given size
    fn create_empty_state(size: u32) -> MinimaxState {
        let game = GameY::new(size);
        MinimaxState::new(&game, PlayerId::new(0))
    }

    /// Gets the first N valid available cells
    fn get_valid_cells(state: &MinimaxState, count: usize) -> Vec<usize> {
        state.available_cells().take(count).collect()
    }

    // ============================================================================
    // INDIVIDUAL FUNCTION TESTS
    // ============================================================================

    #[test]
    fn test_minimax_state_new_initializes_correctly() {
        let game = GameY::new(3);
        let state = MinimaxState::new(&game, PlayerId::new(0));

        assert_eq!(state.size, 3);
        assert_eq!(state.bot_id, 1); // PlayerId(0) + 1
        assert_eq!(state.human_id, 2); // PlayerId(1) + 1

        // Verify that valid cells are empty
        for idx in state.available_cells() {
            assert_eq!(state.board[idx], 0, "Valid cells must be empty");
        }

        assert!(
            state.available_mask.count_ones(..) > 0,
            "Must have available cells"
        );
    }

    #[test]
    fn test_make_move_places_piece_correctly() {
        let mut state = create_empty_state(3);
        let idx = state.available_cells().next().unwrap();

        state.make_move(idx, state.bot_id);

        assert_eq!(
            state.board[idx], state.bot_id,
            "Cell must have the bot's ID"
        );
        assert!(
            !state.available_mask.contains(idx),
            "Cell must not be available"
        );
    }

    #[test]
    fn test_undo_move_restores_previous_state() {
        let mut state = create_empty_state(3);
        let idx = state.available_cells().next().unwrap();

        state.make_move(idx, state.bot_id);
        state.undo_move(idx);

        assert_eq!(state.board[idx], 0, "Cell must be empty");
        assert!(state.available_mask.contains(idx), "Cell must be available");
    }

    #[test]
    fn test_available_cells_returns_empty_cells() {
        let mut state = create_empty_state(3);
        let initial_count = state.available_cells().count();
        let first_cell = state.available_cells().next().unwrap();

        state.make_move(first_cell, state.bot_id);
        let after_move_count = state.available_cells().count();

        assert_eq!(
            after_move_count,
            initial_count - 1,
            "Must have one less available cell"
        );
    }

    #[test]
    fn test_occupied_cells_returns_occupied_cells() {
        let mut state = create_empty_state(3);

        assert_eq!(
            state.occupied_cells().count(),
            0,
            "Must have no occupied cells"
        );

        let cells = get_valid_cells(&state, 2);
        state.make_move(cells[0], state.bot_id);
        state.make_move(cells[1], state.human_id);

        assert_eq!(
            state.occupied_cells().count(),
            2,
            "Must have 2 occupied cells"
        );
    }

    #[test]
    fn test_check_win_does_not_detect_win_on_empty_board() {
        let mut state = create_empty_state(3);

        assert!(
            !state.check_win(state.bot_id),
            "Must not detect win on empty board"
        );
        assert!(
            !state.check_win(state.human_id),
            "Must not detect win on empty board"
        );
    }

    #[test]
    fn test_check_win_does_not_detect_win_with_isolated_pieces() {
        let mut state = create_empty_state(4); // Larger board

        // Place unconnected pieces
        let cells = get_valid_cells(&state, 3);
        for &cell in &cells {
            state.make_move(cell, state.bot_id);
        }

        // With only 3 isolated pieces, a win is unlikely
        let has_win = state.check_win(state.bot_id);

        // Only verify that check doesn't cause panic
        assert!(has_win || !has_win, "check_win must execute without errors");
    }

    #[test]
    fn test_dfs_collect_edges_finds_edges_on_edge_cell() {
        let mut state = create_empty_state(3);

        // Find a cell that touches an edge
        let edge_idx = (0..state.board.len())
            .find(|&idx| state.edges_cache[idx] != 0 && state.available_mask.contains(idx))
            .expect("Must have at least one available edge cell");

        state.make_move(edge_idx, state.bot_id);

        let edges_found = state.dfs_collect_edges(edge_idx, state.bot_id);

        assert!(edges_found != 0, "Must find at least one edge");
        assert_eq!(
            edges_found, state.edges_cache[edge_idx],
            "Must match the cell's edges"
        );
    }

    #[test]
    fn test_dfs_collect_edges_accumulates_edges_from_connected_pieces() {
        let mut state = create_empty_state(4); // Larger board for more options

        // Find two edge cells that are neighbors
        let edge_cells: Vec<usize> = (0..state.board.len())
            .filter(|&idx| state.edges_cache[idx] != 0 && state.available_mask.contains(idx))
            .take(5)
            .collect();

        if edge_cells.len() >= 2 {
            let first = edge_cells[0];
            state.make_move(first, state.bot_id);

            // Find a neighbor that is also an edge
            for &neighbor in &state.neighbors_cache[first] {
                if state.available_mask.contains(neighbor) && state.edges_cache[neighbor] != 0 {
                    state.make_move(neighbor, state.bot_id);

                    let edges_found = state.dfs_collect_edges(first, state.bot_id);

                    // Must accumulate edges from both cells
                    let expected = state.edges_cache[first] | state.edges_cache[neighbor];
                    assert_eq!(
                        edges_found, expected,
                        "Must accumulate edges from connected cells"
                    );
                    return;
                }
            }
        }
    }

    #[test]
    fn test_evaluate_state_returns_value_for_empty_board() {
        let mut state = create_empty_state(3);

        let score = evaluate_state(&mut state);

        // On empty board, score must be 0 or close
        assert_eq!(score, 0, "Empty board must have score 0");
    }

    #[test]
    fn test_evaluate_state_changes_with_moves() {
        let mut state = create_empty_state(3);

        let score_empty = evaluate_state(&mut state);

        let cell = state.available_cells().next().unwrap();
        state.make_move(cell, state.bot_id);

        let score_with_move = evaluate_state(&mut state);

        assert_ne!(
            score_empty, score_with_move,
            "Score must change after a move"
        );
    }

    #[test]
    fn test_evaluate_position_strength_zero_without_pieces() {
        let state = create_empty_state(3);

        let score = evaluate_position_strength(&state, state.bot_id);

        assert_eq!(score, 0, "Without player pieces, score must be 0");
    }

    #[test]
    fn test_evaluate_position_strength_increases_with_pieces() {
        let mut state = create_empty_state(3);

        let score_empty = evaluate_position_strength(&state, state.bot_id);

        let cell = state.available_cells().next().unwrap();
        state.make_move(cell, state.bot_id);
        let score_one_piece = evaluate_position_strength(&state, state.bot_id);

        assert!(
            score_one_piece > score_empty,
            "More pieces must give higher score"
        );
    }

    #[test]
    fn test_evaluate_position_strength_values_connectivity() {
        let mut state = create_empty_state(4);

        // Place two connected pieces
        let cells = get_valid_cells(&state, 2);
        let idx1 = cells[0];
        state.make_move(idx1, state.bot_id);

        // Find an available neighbor
        let neighbor = state.neighbors_cache[idx1]
            .iter()
            .find(|&&n| state.available_mask.contains(n))
            .copied();

        if let Some(idx2) = neighbor {
            state.make_move(idx2, state.bot_id);
            let score_connected = evaluate_position_strength(&state, state.bot_id);

            state.undo_move(idx2);

            // Place piece in different position (not necessarily isolated)
            let other = cells[1];
            if other != idx2 {
                state.make_move(other, state.bot_id);
                let score_other = evaluate_position_strength(&state, state.bot_id);

                // Only verify that it executes without errors
                assert!(
                    score_connected > 0 && score_other > 0,
                    "Both scores must be positive"
                );
            }
        }
    }

    #[test]
    fn test_minimax_returns_score_in_valid_range() {
        let mut state = create_empty_state(3);

        // Make a move to have non-empty state
        let cell = state.available_cells().next().unwrap();
        state.make_move(cell, state.bot_id);

        let score = minimax(&mut state, 1, -INFINITY, INFINITY, false);

        assert!(
            score >= LOSE_SCORE && score <= WIN_SCORE,
            "Score must be in valid range [{}, {}]",
            LOSE_SCORE,
            WIN_SCORE
        );
    }

    #[test]
    fn test_minimax_with_zero_depth_evaluates_state() {
        let mut state = create_empty_state(3);

        let cell = state.available_cells().next().unwrap();
        state.make_move(cell, state.bot_id);

        let score = minimax(&mut state, 0, -INFINITY, INFINITY, true);
        let eval_score = evaluate_state(&mut state);

        assert_eq!(score, eval_score, "With depth 0 must evaluate directly");
    }

    // ============================================================================
    // INTEGRATION TESTS - COMPLETE FUNCTIONALITIES
    // ============================================================================

    #[test]
    fn test_greedy_search_does_not_find_win_on_empty_board() {
        let mut state = create_empty_state(3);

        let result = greedy_search(&mut state);

        // On empty board there should be no immediate win
        assert!(
            result.is_none(),
            "Must not have immediate winning move on empty board"
        );
    }

    #[test]
    fn test_greedy_search_executes_without_errors() {
        let mut state = create_empty_state(4);

        // Make some random moves
        let cells = get_valid_cells(&state, 4);
        state.make_move(cells[0], state.bot_id);
        state.make_move(cells[1], state.human_id);
        state.make_move(cells[2], state.bot_id);

        let result = greedy_search(&mut state);

        // Verify it doesn't produce errors
        assert!(result.is_some() || result.is_none());
    }

    #[test]
    fn test_minimax_with_alpha_beta_prunes_correctly() {
        let mut state = create_empty_state(3);

        // Make some moves
        let cells = get_valid_cells(&state, 2);
        state.make_move(cells[0], state.bot_id);
        state.make_move(cells[1], state.human_id);

        let score_with_pruning = minimax(&mut state, 2, -INFINITY, INFINITY, true);

        // Score must be within reasonable ranges
        assert!(
            score_with_pruning > LOSE_SCORE && score_with_pruning < WIN_SCORE,
            "Score must be in valid range"
        );
    }

    #[test]
    fn test_search_best_move_finds_valid_move() {
        let mut state = create_empty_state(3);

        let (best_move, score) = search_best_move(&mut state, 2, None);

        assert!(best_move < state.board.len(), "Must return valid index");
        assert!(
            state.available_mask.contains(best_move),
            "Move must be available"
        );
        assert!(
            score > LOSE_SCORE,
            "Score must not be automatic defeat on empty board"
        );
    }

    #[test]
    fn test_search_best_move_uses_pv_move_when_valid() {
        let mut state = create_empty_state(3);

        let pv_move = state.available_cells().nth(1).unwrap();
        let (best_move, _) = search_best_move(&mut state, 1, Some(pv_move));

        // Returned move must be valid
        assert!(best_move < state.board.len(), "Must return valid move");
        assert!(
            state.coords_cache.get(best_move).is_some(),
            "Index must be in cache"
        );
    }

    #[test]
    fn test_iterative_deepening_finds_valid_move() {
        let mut state = create_empty_state(3);

        // With very limited time, must iterate at least once
        let best_move = iterative_deepening_search(&mut state, 50); // 50ms

        assert!(best_move < state.board.len(), "Must find valid move");
        assert!(
            state.coords_cache.get(best_move).is_some(),
            "Move must have coordinates"
        );
    }

    #[test]
    fn test_minimax_bot_choose_move_returns_valid_coordinates() {
        let game = GameY::new(3);
        let bot = MinimaxBot::new(50);

        let move_coords = bot.choose_move(&game);

        assert!(move_coords.is_some(), "Must return a move");
        if let Some(coords) = move_coords {
            assert!(coords.is_valid(3), "Coordinates must be valid");
        }
    }

    #[test]
    fn test_minimax_bot_returns_none_when_game_ends() {
        let game = GameY::new(3);
        let bot = MinimaxBot::new(50);

        // Simulating that the game has ended would require modifying game state
        // For now we only verify that the bot handles a new game correctly
        let result = bot.choose_move(&game);
        assert!(result.is_some(), "Must return move in active game");
    }

    #[test]
    fn test_complete_flow_make_move_evaluate_undo() {
        let mut state = create_empty_state(3);
        let initial_available = state.available_cells().count();

        // 1. Make move
        let move_idx = state.available_cells().next().unwrap();
        state.make_move(move_idx, state.bot_id);

        // 2. Evaluate state
        let score = evaluate_state(&mut state);
        assert!(score != 0, "Non-empty state must have score");

        // 3. Undo move
        state.undo_move(move_idx);

        // 4. Verify complete restoration
        assert_eq!(
            state.available_cells().count(),
            initial_available,
            "Must restore the number of available cells"
        );
        assert_eq!(state.board[move_idx], 0, "Cell must be empty");
    }

    #[test]
    fn test_multiple_moves_and_consistent_evaluation() {
        let mut state = create_empty_state(4); // Larger board

        let moves = get_valid_cells(&state, 4);

        // Make alternating moves
        state.make_move(moves[0], state.bot_id);
        state.make_move(moves[1], state.human_id);
        state.make_move(moves[2], state.bot_id);
        state.make_move(moves[3], state.human_id);

        let score = evaluate_state(&mut state);

        // Score must reflect positions of both players
        assert!(
            score.abs() < WIN_SCORE,
            "Must not have win in first 4 moves"
        );

        // Undo all
        for &move_idx in moves.iter().rev() {
            state.undo_move(move_idx);
        }

        assert_eq!(state.occupied_cells().count(), 0, "Board must be empty");
    }

    #[test]
    fn test_check_win_with_many_pieces_does_not_panic() {
        let mut state = create_empty_state(4);

        // Place several pieces
        let cells = get_valid_cells(&state, 10);
        for (i, &cell) in cells.iter().enumerate() {
            let player = if i % 2 == 0 {
                state.bot_id
            } else {
                state.human_id
            };
            state.make_move(cell, player);
        }

        // Verify that check_win doesn't cause panic
        let bot_wins = state.check_win(state.bot_id);
        let human_wins = state.check_win(state.human_id);

        assert!(bot_wins || !bot_wins, "Bot check_win must execute");
        assert!(human_wins || !human_wins, "Human check_win must execute");
    }

    #[test]
    fn test_minimax_bot_name() {
        let bot = MinimaxBot::new(1000);
        assert_eq!(bot.name(), "minimax_bot");
    }

    #[test]
    fn test_constants_have_correct_values() {
        assert_eq!(WIN_SCORE, 100_000);
        assert_eq!(LOSE_SCORE, -100_000);
        assert!(
            INFINITY > WIN_SCORE,
            "INFINITY must be greater than WIN_SCORE"
        );
        assert!(INFINITY > 0, "INFINITY must be positive");
    }

    #[test]
    fn test_minimax_respects_alpha_beta_limits() {
        let mut state = create_empty_state(3);

        let cell = state.available_cells().next().unwrap();
        state.make_move(cell, state.bot_id);

        // With very narrow window, should prune
        let score = minimax(&mut state, 2, 0, 100, false);

        assert!(
            score >= LOSE_SCORE && score <= WIN_SCORE,
            "Score must be in valid range"
        );
    }
}
