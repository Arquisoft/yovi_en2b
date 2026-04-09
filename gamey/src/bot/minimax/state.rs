//! Board state for the minimax search engine.

use crate::{Coordinates, GameY, PlayerId, game};
use fixedbitset::FixedBitSet;
use smallvec::SmallVec;
use std::collections::VecDeque;
use super::BLOCKED;
use super::tables::xorshift64;

// ============================================================================
// Incremental evaluation score
// ============================================================================

/// Heuristic components for one player, maintained incrementally on every
/// `make_move` / `undo_move`. Used as a secondary tiebreaker in the
/// evaluation function.
#[derive(Clone, Default)]
pub(super) struct IncrementalScore {
    /// Reference counts for each of the three board sides (index 0=A, 1=B, 2=C).
    pub edge_refs: [u8; 3],
    /// Sum of same-player neighbor counts across all placed pieces.
    pub connections: i32,
    /// Cumulative +40 bonus for every piece with >= 2 same-player neighbors.
    pub well_connected: i32,
    /// Sum of `(50 - off_center)` for all placed pieces.
    pub center_sum: i32,
}

impl IncrementalScore {
    pub fn evaluate(&self, game_progress: f32) -> i32 {
        let edges_touched: u8 = self
            .edge_refs
            .iter()
            .enumerate()
            .map(|(i, &r)| if r > 0 { 1 << i } else { 0 })
            .fold(0u8, |acc, b| acc | b);

        let center_weight = (1.0 - game_progress) * 5.0;

        self.well_connected
            + edges_touched.count_ones() as i32 * 5
            + self.connections * 25
            + (self.center_sum as f32 * center_weight) as i32
    }
}

// ============================================================================
// State
// ============================================================================

pub(crate) struct MinimaxState {
    pub(super) board: Vec<u8>,
    pub(super) size: u32,
    pub(super) available_mask: FixedBitSet,
    pub(super) neighbors_cache: Vec<Vec<usize>>,
    pub(super) edges_cache: Vec<u8>,
    pub(super) center_cache: Vec<i32>,
    pub(super) bot_id: u8,
    pub(super) human_id: u8,
    // Reusable buffers for check_win DFS.
    visited: Vec<bool>,
    stack: Vec<usize>,
    // Reusable buffer for BFS distance computation.
    bfs_dist: Vec<u32>,
    // Two auxiliary BFS buffers for connection_cost.
    eval_buf_a: Vec<u32>,
    eval_buf_b: Vec<u32>,
    // Reusable BFS queue.
    bfs_queue: VecDeque<usize>,
    // Incremental evaluation state.
    pub(super) scores: [IncrementalScore; 2],
    pub(super) piece_neighbor_counts: Vec<u8>,
    pub(super) occupied_count: usize,
    // Zobrist hashing.
    zobrist_keys: Vec<[u64; 2]>,
    pub(super) hash: u64,
}

impl MinimaxState {
    pub(crate) fn new(game: &GameY, bot_player: PlayerId) -> Self {
        let size = game.board_size();
        let total_cells = game.total_cells() as usize;

        let (neighbors_cache, edges_cache, center_cache) =
            Self::build_board_caches(game, size, total_cells);
        let board = Self::build_board(game, size, total_cells);
        let available_mask = Self::build_available_mask(game, total_cells);
        let zobrist_keys = Self::build_zobrist_keys(total_cells);

        let mut state = Self {
            board,
            size,
            available_mask,
            neighbors_cache,
            edges_cache,
            center_cache,
            bot_id: bot_player.id() as u8 + 1,
            human_id: game::other_player(bot_player).id() as u8 + 1,
            visited: vec![false; total_cells],
            stack: Vec::with_capacity(total_cells / 4),
            bfs_dist: vec![0u32; total_cells],
            eval_buf_a: vec![0u32; total_cells],
            eval_buf_b: vec![0u32; total_cells],
            bfs_queue: VecDeque::with_capacity(total_cells),
            scores: [IncrementalScore::default(), IncrementalScore::default()],
            piece_neighbor_counts: vec![0u8; total_cells],
            occupied_count: 0,
            zobrist_keys,
            hash: 0,
        };

        state.init_incremental_state();
        state
    }

    fn build_board_caches(
        game: &GameY,
        size: u32,
        total_cells: usize,
    ) -> (Vec<Vec<usize>>, Vec<u8>, Vec<i32>) {
        let mut neighbors_cache = vec![Vec::new(); total_cells];
        let mut edges_cache = vec![0u8; total_cells];
        let mut center_cache = vec![0i32; total_cells];

        for idx in 0..total_cells {
            let coords = Coordinates::from_index(idx as u32, size);

            let (x, y, z) = (coords.x() as i32, coords.y() as i32, coords.z() as i32);
            center_cache[idx] = 50 - ((x - y).abs() + (y - z).abs() + (z - x).abs());

            if !coords.is_valid(size) {
                continue;
            }

            neighbors_cache[idx] = game
                .get_neighbors(&coords)
                .into_iter()
                .filter(|n| n.is_valid(size))
                .map(|n| Coordinates::to_index(&n, size) as usize)
                .collect();

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

        (neighbors_cache, edges_cache, center_cache)
    }

    fn build_board(game: &GameY, size: u32, total_cells: usize) -> Vec<u8> {
        let mut board = vec![0u8; total_cells];
        for (coords, (_, owner)) in game.board_map() {
            board[Coordinates::to_index(coords, size) as usize] = owner.id() as u8 + 1;
        }
        board
    }

    fn build_available_mask(game: &GameY, total_cells: usize) -> FixedBitSet {
        let mut mask = FixedBitSet::with_capacity(total_cells);
        for &cell_idx in game.available_cells() {
            mask.insert(cell_idx as usize);
        }
        mask
    }

    fn build_zobrist_keys(total_cells: usize) -> Vec<[u64; 2]> {
        let mut rng: u64 = 0xDEAD_BEEF_CAFE_1337;
        (0..total_cells)
            .map(|_| [xorshift64(&mut rng), xorshift64(&mut rng)])
            .collect()
    }

    fn init_incremental_state(&mut self) {
        for idx in 0..self.board.len() {
            let player = self.board[idx];
            if player == 0 {
                continue;
            }

            let p = self.player_idx(player);
            let k = self.neighbors_cache[idx]
                .iter()
                .filter(|&&n| self.board[n] == player)
                .count() as u8;

            self.piece_neighbor_counts[idx] = k;

            let eb = self.edges_cache[idx];
            let score = &mut self.scores[p];
            if eb & 0b001 != 0 {
                score.edge_refs[0] += 1;
            }
            if eb & 0b010 != 0 {
                score.edge_refs[1] += 1;
            }
            if eb & 0b100 != 0 {
                score.edge_refs[2] += 1;
            }

            score.connections += k as i32;
            if k >= 2 {
                score.well_connected += 40;
            }
            score.center_sum += self.center_cache[idx];

            self.occupied_count += 1;
            self.hash ^= self.zobrist_keys[idx][p];
        }
    }

    // -------------------------------------------------------------------------
    // Board mutation
    // -------------------------------------------------------------------------

    pub(super) fn make_move(&mut self, idx: usize, player: u8) {
        let p = self.player_idx(player);

        let neighbors: SmallVec<[usize; 6]> = self.neighbors_cache[idx].iter().copied().collect();

        let k = neighbors
            .iter()
            .filter(|&&n| self.board[n] == player)
            .count() as u8;
        self.piece_neighbor_counts[idx] = k;

        {
            let eb = self.edges_cache[idx];
            let score = &mut self.scores[p];
            if eb & 0b001 != 0 {
                score.edge_refs[0] += 1;
            }
            if eb & 0b010 != 0 {
                score.edge_refs[1] += 1;
            }
            if eb & 0b100 != 0 {
                score.edge_refs[2] += 1;
            }
            score.connections += 2 * k as i32;
            if k >= 2 {
                score.well_connected += 40;
            }
            score.center_sum += self.center_cache[idx];
        }

        for &nb in &neighbors {
            if self.board[nb] == player {
                let old_k = self.piece_neighbor_counts[nb];
                self.piece_neighbor_counts[nb] += 1;
                if old_k == 1 {
                    self.scores[p].well_connected += 40;
                }
            }
        }

        self.board[idx] = player;
        self.available_mask.set(idx, false);
        self.occupied_count += 1;
        self.hash ^= self.zobrist_keys[idx][p];
    }

    pub(super) fn undo_move(&mut self, idx: usize) {
        let player = self.board[idx];
        let p = self.player_idx(player);

        self.hash ^= self.zobrist_keys[idx][p];

        let neighbors: SmallVec<[usize; 6]> = self.neighbors_cache[idx].iter().copied().collect();

        let k = self.piece_neighbor_counts[idx];

        {
            let eb = self.edges_cache[idx];
            let score = &mut self.scores[p];
            if eb & 0b001 != 0 {
                score.edge_refs[0] -= 1;
            }
            if eb & 0b010 != 0 {
                score.edge_refs[1] -= 1;
            }
            if eb & 0b100 != 0 {
                score.edge_refs[2] -= 1;
            }
            score.connections -= 2 * k as i32;
            if k >= 2 {
                score.well_connected -= 40;
            }
            score.center_sum -= self.center_cache[idx];
        }

        for &nb in &neighbors {
            if self.board[nb] == player {
                let cur_k = self.piece_neighbor_counts[nb];
                self.piece_neighbor_counts[nb] -= 1;
                if cur_k == 2 {
                    self.scores[p].well_connected -= 40;
                }
            }
        }

        self.board[idx] = 0;
        self.available_mask.set(idx, true);
        self.occupied_count -= 1;
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    #[inline]
    pub(super) fn player_idx(&self, player: u8) -> usize {
        if player == self.bot_id { 0 } else { 1 }
    }

    #[inline]
    pub(super) fn opponent_of(&self, player: u8) -> u8 {
        if player == self.bot_id {
            self.human_id
        } else {
            self.bot_id
        }
    }

    pub(super) fn available_cells(&self) -> impl Iterator<Item = usize> + '_ {
        self.available_mask.ones()
    }

    /// Returns 0 if `idx` is occupied by `player`, 1 if empty.
    #[inline]
    fn cell_cost(&self, idx: usize, player: u8) -> u32 {
        if self.board[idx] == player { 0 } else { 1 }
    }

    // -------------------------------------------------------------------------
    // Win detection
    // -------------------------------------------------------------------------

    pub(super) fn check_win(&mut self, player: u8) -> bool {
        self.visited.fill(false);

        for idx in 0..self.board.len() {
            if self.board[idx] == player && self.edges_cache[idx] != 0 && !self.visited[idx] {
                if self.dfs_collect_edges(idx, player) == 0b111 {
                    return true;
                }
            }
        }

        false
    }

    fn dfs_collect_edges(&mut self, start: usize, player: u8) -> u8 {
        let mut edges_mask = 0u8;

        self.stack.clear();
        self.stack.push(start);
        self.visited[start] = true;

        while let Some(idx) = self.stack.pop() {
            edges_mask |= self.edges_cache[idx];

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

    // -------------------------------------------------------------------------
    // BFS and connection cost
    // -------------------------------------------------------------------------

    fn bfs_from_side(&mut self, side_bit: u8, player: u8) {
        let opponent = self.opponent_of(player);
        let n = self.board.len();

        self.bfs_dist.iter_mut().for_each(|d| *d = BLOCKED);
        self.bfs_queue.clear();

        for idx in 0..n {
            if self.edges_cache[idx] & side_bit != 0 && self.board[idx] != opponent {
                self.bfs_dist[idx] = self.cell_cost(idx, player);
                self.bfs_queue.push_back(idx);
            }
        }

        while let Some(idx) = self.bfs_queue.pop_front() {
            let d = self.bfs_dist[idx];
            for &nb in &self.neighbors_cache[idx] {
                if self.bfs_dist[nb] == BLOCKED && self.board[nb] != opponent {
                    self.bfs_dist[nb] = d + self.cell_cost(nb, player);
                    self.bfs_queue.push_back(nb);
                }
            }
        }
    }

    /// Computes the approximate Steiner tree cost to connect all three board
    /// sides for `player`.
    pub(super) fn connection_cost(&mut self, player: u8) -> u32 {
        let opponent = self.opponent_of(player);
        let n = self.board.len();

        self.bfs_from_side(0b001, player);
        self.eval_buf_a.copy_from_slice(&self.bfs_dist);

        self.bfs_from_side(0b010, player);
        self.eval_buf_b.copy_from_slice(&self.bfs_dist);

        self.bfs_from_side(0b100, player);

        let mut min_cost = BLOCKED;
        for i in 0..n {
            if self.board[i] == opponent {
                continue;
            }
            let da = self.eval_buf_a[i];
            let db = self.eval_buf_b[i];
            let dc = self.bfs_dist[i];
            let raw = sat_add(sat_add(da, db), dc);
            if raw == BLOCKED {
                continue;
            }
            let cell_overcounting = if self.board[i] == player { 0 } else { 2 };
            let cost = raw - cell_overcounting;
            if cost < min_cost {
                min_cost = cost;
            }
        }

        min_cost
    }

    /// Computes the shortest-path delta for every available cell for `player`.
    pub(super) fn shortest_path_deltas(&mut self, player: u8) -> Vec<(usize, u32)> {
        let baseline = self.connection_cost(player);

        let available: Vec<usize> = self.available_mask.ones().collect();

        let mut deltas: Vec<(usize, u32)> = available
            .into_iter()
            .map(|idx| {
                self.board[idx] = player;
                let new_cost = self.connection_cost(player);
                self.board[idx] = 0;

                (idx, baseline.saturating_sub(new_cost))
            })
            .collect();

        deltas.sort_unstable_by(|a, b| b.1.cmp(&a.1));
        deltas
    }
}

/// Saturating addition that treats `BLOCKED` as infinity.
#[inline]
fn sat_add(a: u32, b: u32) -> u32 {
    if a == BLOCKED || b == BLOCKED {
        BLOCKED
    } else {
        a.saturating_add(b)
    }
}
