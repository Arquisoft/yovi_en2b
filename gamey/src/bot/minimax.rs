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
    //size: u32,
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

            // Validar que la celda existe en el juego (en Y no todos los índices son válidos)
            if !coords.is_valid(size) {
                continue; // Salta celdas fuera del tablero
            }

            // Llenar vecinos (solo los que estén dentro del tablero)
            for n_coords in game.get_neighbors(&coords) {
                if n_coords.is_valid(size) {
                    // Filtra vecinos inválidos
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

        // 2. Copiar estado del tablero
        for (coords, (_, owner)) in game.board_map() {
            let idx = Coordinates::to_index(coords, size) as usize;
            board[idx] = owner.id() as u8 + 1; // 1-based (0 = vacío)
        }

        // 3. Poblar available_mask usando game.available_cells()
        for &cell_idx in game.available_cells() {
            available_mask.insert(cell_idx as usize);
        }

        Self {
            board,
            //size,
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

    fn available_moves(&self) -> impl Iterator<Item = usize> + '_ {
        self.available_mask.ones()
    }

    fn occupied_cells(&self) -> impl Iterator<Item = usize> + '_ {
        self.available_mask.zeroes()
    }

    /// Retorna true si el jugador conectó los 3 bordes
    fn check_win(&mut self, player: u8) -> bool {
        // Limpiar buffers (más rápido que crear nuevos)
        self.visited.fill(false);

        // Buscar todas las piezas del jugador que tocan al menos un borde
        for idx in 0..self.board.len() {
            if self.board[idx] == player && self.edges_cache[idx] != 0 && !self.visited[idx] {
                // Hacer DFS desde esta pieza y ver qué bordes alcanzamos
                let edges_reached = self.dfs_collect_edges(idx, player);

                // Si tocamos los 3 bordes (bits 0, 1, 2 activados)
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
            // Acumular bordes que toca esta celda
            edges_mask |= self.edges_cache[idx];

            // Early exit: Si ya tenemos los 3 bordes, no seguimos
            if edges_mask == 0b111 {
                return edges_mask;
            }

            // Explorar vecinos (usando cache precalculada)
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

        // if let Some(coordinates) = greedy_search(game, bot_player) {
        //     return Some(coordinates);
        // };

        let best_move = iterative_deepening_search(&mut state, self.max_time_ms);

        let coordinates = Coordinates::from_index(best_move as u32, game.board_size());
        Some(coordinates)
    }
}

// fn greedy_search(game: &GameY, bot_player: PlayerId) -> Option<Coordinates> {
//     let moves = game.available_cells();
//     if moves.is_empty() {
//         panic!("No available moves");
//     }

//     let opponent = game::other_player(bot_player);

//     for &move_idx in moves {
//         let next_game = simulate_move(game, move_idx);
//         if let &GameStatus::Finished { winner } = next_game.status()
//             && winner == bot_player
//         {
//             println!(">>> INSTANT WIN FOUND at {}", move_idx);
//             return Some(Coordinates::from_index(move_idx, next_game.board_size()));
//         }
//         let next_game = simulate_player_move(game, move_idx, opponent);
//         if let &GameStatus::Finished { winner } = next_game.status()
//             && winner == opponent
//         {
//             println!(">>> BLOCKING IMMEDIATE THREAT at {}", move_idx);
//             return Some(Coordinates::from_index(move_idx, next_game.board_size()));
//         }
//     }
//     None
// }

fn iterative_deepening_search(state: &mut MinimaxState, max_time_ms: u64) -> usize {
    let start_time = Instant::now();
    let time_limit = Duration::from_millis(max_time_ms);

    let mut best_move = state.available_moves().next().expect("No available moves"); // Fallback inicial
    let mut pv_move: Option<usize> = None;

    for depth in 5..=100 {
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
    let mut moves: Vec<usize> = state.available_moves().collect();

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

    let moves: SmallVec<[usize; 128]> = state.available_moves().collect();

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

// fn simulate_move(game: &GameY, move_idx: u32) -> GameY {
//     let mut game_clone = game.clone();

//     game_clone
//         .add_move(Movement::Placement {
//             player: game_clone
//                 .next_player()
//                 .expect("UNEXPECTED ERR: a move was simulated after the game was over"),

//             coords: Coordinates::from_index(move_idx, game_clone.board_size()),
//         })
//         .expect("UNEXPECTED ERR");

//     game_clone
// }

// fn simulate_player_move(game: &GameY, move_idx: u32, player: PlayerId) -> GameY {
//     let mut game_clone = game.clone();

//     game_clone
//         .add_move(Movement::Placement {
//             player: player,
//             coords: Coordinates::from_index(move_idx, game_clone.board_size()),
//         })
//         .expect("UNEXPECTED ERR");

//     game_clone
// }

fn evaluate_state(state: &mut MinimaxState) -> i32 {
    if state.check_win(state.bot_id) {
        return WIN_SCORE;
    }
    if state.check_win(state.human_id) {
        return LOSE_SCORE;
    }

    let my_center = center_control_score(state, state.bot_id);
    let opp_center = center_control_score(state, state.human_id);

    my_center - opp_center
}

fn center_control_score(state: &mut MinimaxState, player: u8) -> i32 {
    let mut score = 0;

    for move_idx in state.occupied_cells() {
        if state.board[move_idx] == player {
            let coords = state.coords_cache[move_idx];
            let x = coords.x() as i32;
            let y = coords.y() as i32;
            let z = coords.z() as i32;

            let off_center = (x - y).abs() + (y - z).abs() + (z - x).abs();

            score += 300 - off_center;
        }
    }
    score
}
