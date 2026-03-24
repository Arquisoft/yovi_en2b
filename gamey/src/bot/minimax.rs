use crate::{Coordinates, GameY, PlayerId, YBot, game};
use fixedbitset::FixedBitSet;
use smallvec::SmallVec;
use std::{
    collections::VecDeque,
    time::{Duration, Instant},
};

pub const WIN_SCORE: i32 = 100_000;
pub const LOSE_SCORE: i32 = -WIN_SCORE;

const INFINITY: i32 = i32::MAX / 2;

/// Sentinel returned by `negamax` when the hard time limit is exceeded.
/// Every caller must propagate this value upward immediately without
/// updating its best-known result.
const ABORTED: i32 = i32::MIN;

/// BFS distance assigned to cells owned by the opponent (impassable).
const BLOCKED: u32 = u32::MAX;

/// Number of killer move slots per depth level.
const KILLER_SLOTS: usize = 2;

/// Number of buckets in the transposition table. Must be a power of two.
/// Each bucket holds two entries (depth-preferred + always-replace).
/// Total entries = 2 * TT_BUCKETS ≈ 2M entries × ~20 bytes ≈ 40 MB.
const TT_BUCKETS: usize = 1 << 20;

/// Default aspiration window half-width for iterative deepening.
const ASPIRATION_DELTA: i32 = 50;

/// History scores are scaled down when any entry exceeds this threshold.
const HISTORY_CEILING: u32 = 1_000_000;

// ============================================================================
// Incremental evaluation score
// ============================================================================

/// Heuristic components for one player, maintained incrementally on every
/// `make_move` / `undo_move`. Used as a secondary tiebreaker in the
/// evaluation function.
#[derive(Clone, Default)]
struct IncrementalScore {
    /// Reference counts for each of the three board sides (index 0=A, 1=B, 2=C).
    edge_refs: [u8; 3],
    /// Sum of same-player neighbor counts across all placed pieces.
    connections: i32,
    /// Cumulative +40 bonus for every piece with >= 2 same-player neighbors.
    well_connected: i32,
    /// Sum of `(50 - off_center)` for all placed pieces.
    center_sum: i32,
}

impl IncrementalScore {
    fn evaluate(&self, game_progress: f32) -> i32 {
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
// Transposition table
// ============================================================================

#[derive(Clone, Copy, PartialEq, Eq, Default, Debug)]
#[repr(u8)]
enum TtFlag {
    #[default]
    Exact = 0,
    LowerBound = 1,
    UpperBound = 2,
}

#[derive(Clone, Default)]
struct TtEntry {
    key: u64,
    score: i32,
    best_move: u32,
    depth: u8,
    flag: TtFlag,
}

impl TtEntry {
    fn is_empty(&self) -> bool {
        self.key == 0
    }
}

struct TranspositionTable {
    entries: Vec<TtEntry>,
    mask: usize,
}

impl TranspositionTable {
    fn new() -> Self {
        Self {
            entries: vec![TtEntry::default(); TT_BUCKETS * 2],
            mask: TT_BUCKETS - 1,
        }
    }

    #[inline]
    fn bucket_base(&self, key: u64) -> usize {
        (key as usize & self.mask) * 2
    }

    fn store(&mut self, key: u64, depth: u8, score: i32, flag: TtFlag, best_move: Option<usize>) {
        debug_assert_ne!(score, ABORTED, "must not store ABORTED in the TT");

        let base = self.bucket_base(key);
        let bm = best_move.map(|m| m as u32).unwrap_or(u32::MAX);

        let dp = &self.entries[base];
        if dp.is_empty() || depth >= dp.depth {
            self.entries[base] = TtEntry {
                key,
                score,
                best_move: bm,
                depth,
                flag,
            };
        }

        self.entries[base + 1] = TtEntry {
            key,
            score,
            best_move: bm,
            depth,
            flag,
        };
    }

    fn probe(&self, key: u64, depth: u8) -> Option<&TtEntry> {
        let base = self.bucket_base(key);
        for slot in 0..2 {
            let e = &self.entries[base + slot];
            if e.key == key && e.depth >= depth {
                return Some(e);
            }
        }
        None
    }

    fn best_move(&self, key: u64) -> Option<usize> {
        let base = self.bucket_base(key);
        for slot in 0..2 {
            let e = &self.entries[base + slot];
            if e.key == key && e.best_move != u32::MAX {
                return Some(e.best_move as usize);
            }
        }
        None
    }
}

// ============================================================================
// Zobrist hash helpers
// ============================================================================

fn xorshift64(state: &mut u64) -> u64 {
    *state ^= *state << 13;
    *state ^= *state >> 7;
    *state ^= *state << 17;
    *state
}

// ============================================================================
// State
// ============================================================================

pub struct MinimaxState {
    board: Vec<u8>,
    size: u32,
    available_mask: FixedBitSet,
    neighbors_cache: Vec<Vec<usize>>,
    edges_cache: Vec<u8>,
    center_cache: Vec<i32>,
    bot_id: u8,
    human_id: u8,
    // Reusable buffers for check_win DFS.
    visited: Vec<bool>,
    stack: Vec<usize>,
    // Reusable buffer for BFS distance computation.
    bfs_dist: Vec<u32>,
    // Two auxiliary BFS buffers for connection_cost (avoids cloning bfs_dist).
    eval_buf_a: Vec<u32>,
    eval_buf_b: Vec<u32>,
    // Reusable BFS queue (avoids allocation per BFS call).
    bfs_queue: VecDeque<usize>,
    // Incremental evaluation state.
    scores: [IncrementalScore; 2],
    piece_neighbor_counts: Vec<u8>,
    occupied_count: usize,
    // Zobrist hashing.
    zobrist_keys: Vec<[u64; 2]>,
    hash: u64,
}

impl MinimaxState {
    pub fn new(game: &GameY, bot_player: PlayerId) -> Self {
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

    fn make_move(&mut self, idx: usize, player: u8) {
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

    fn undo_move(&mut self, idx: usize) {
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
    fn player_idx(&self, player: u8) -> usize {
        if player == self.bot_id { 0 } else { 1 }
    }

    #[inline]
    fn opponent_of(&self, player: u8) -> u8 {
        if player == self.bot_id {
            self.human_id
        } else {
            self.bot_id
        }
    }

    fn available_cells(&self) -> impl Iterator<Item = usize> + '_ {
        self.available_mask.ones()
    }

    // -------------------------------------------------------------------------
    // Win detection
    // -------------------------------------------------------------------------

    fn check_win(&mut self, player: u8) -> bool {
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

    /// 0-1 BFS shortest-path distance from a virtual source connected to every
    /// cell touching `side_bit`. Own pieces cost 0, empty cells cost 1, opponent
    /// cells are walls (`BLOCKED`). Uses the reusable `self.bfs_queue`.
    fn bfs_from_side(&mut self, side_bit: u8, player: u8) {
        let opponent = self.opponent_of(player);
        let n = self.board.len();

        self.bfs_dist.iter_mut().for_each(|d| *d = BLOCKED);
        self.bfs_queue.clear();

        for idx in 0..n {
            if self.edges_cache[idx] & side_bit != 0 && self.board[idx] != opponent {
                self.bfs_dist[idx] = if self.board[idx] == player { 0 } else { 1 };
                self.bfs_queue.push_back(idx);
            }
        }

        while let Some(idx) = self.bfs_queue.pop_front() {
            let d = self.bfs_dist[idx];
            for &nb in &self.neighbors_cache[idx] {
                if self.bfs_dist[nb] == BLOCKED && self.board[nb] != opponent {
                    self.bfs_dist[nb] = d + if self.board[nb] == player { 0 } else { 1 };
                    self.bfs_queue.push_back(nb);
                }
            }
        }
    }

    /// Computes the approximate Steiner tree cost to connect all three board
    /// sides for `player`, using a meeting-point heuristic:
    ///
    ///   `min_c( d_A[c] + d_B[c] + d_C[c] - 2*cell_cost(c) )`
    ///
    /// where `cell_cost(c)` is 0 for own pieces and 1 for empty cells. The
    /// subtraction corrects for the meeting point being counted three times
    /// (once per BFS direction) when it should be counted once.
    ///
    /// Returns `BLOCKED` if no path exists.
    fn connection_cost(&mut self, player: u8) -> u32 {
        let opponent = self.opponent_of(player);
        let n = self.board.len();

        // BFS from side A → store in eval_buf_a.
        self.bfs_from_side(0b001, player);
        self.eval_buf_a.copy_from_slice(&self.bfs_dist);

        // BFS from side B → store in eval_buf_b.
        self.bfs_from_side(0b010, player);
        self.eval_buf_b.copy_from_slice(&self.bfs_dist);

        // BFS from side C → stays in bfs_dist.
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
            // Correct for the meeting point being counted 3 times.
            // An empty cell contributes cost 1 to each BFS direction, but
            // occupying it once serves all three paths.
            let cell_overcounting = if self.board[i] == player { 0 } else { 2 };
            let cost = raw - cell_overcounting;
            if cost < min_cost {
                min_cost = cost;
            }
        }

        min_cost
    }

    /// Computes the shortest-path delta for every available cell for `player`.
    ///
    /// For each available cell, the delta is how much the connection cost drops
    /// when that cell is occupied by `player`. Higher delta = more critical.
    ///
    /// Returns a `Vec<(cell_index, delta)>` sorted descending by delta.
    fn shortest_path_deltas(&mut self, player: u8) -> Vec<(usize, u32)> {
        let baseline = self.connection_cost(player);

        let available: Vec<usize> = self.available_mask.ones().collect();

        let mut deltas: Vec<(usize, u32)> = available
            .into_iter()
            .map(|idx| {
                // Temporarily place piece to measure impact.
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

// ============================================================================
// Killer table
// ============================================================================

struct KillerTable {
    slots: Vec<[Option<usize>; KILLER_SLOTS]>,
}

impl KillerTable {
    fn new(max_depth: usize) -> Self {
        Self {
            slots: vec![[None; KILLER_SLOTS]; max_depth + 1],
        }
    }

    fn store(&mut self, depth: usize, mv: usize) {
        let slot = &mut self.slots[depth];
        if slot[0] == Some(mv) || slot[1] == Some(mv) {
            return;
        }
        slot[1] = slot[0];
        slot[0] = Some(mv);
    }

    fn get(&self, depth: usize) -> [Option<usize>; KILLER_SLOTS] {
        self.slots[depth]
    }
}

// ============================================================================
// History table
// ============================================================================

/// Tracks which moves have historically produced beta-cutoffs.
/// Indexed by `[cell_index][player_index]`. Moves that consistently cause
/// cutoffs accumulate high scores and are searched earlier.
struct HistoryTable {
    scores: Vec<[u32; 2]>,
}

impl HistoryTable {
    fn new(total_cells: usize) -> Self {
        Self {
            scores: vec![[0u32; 2]; total_cells],
        }
    }

    #[inline]
    fn score(&self, cell: usize, player_idx: usize) -> u32 {
        self.scores[cell][player_idx]
    }

    /// Records a beta-cutoff at `cell` for `player_idx` with bonus `depth²`.
    fn record_cutoff(&mut self, cell: usize, player_idx: usize, depth: u8) {
        let bonus = (depth as u32) * (depth as u32);
        self.scores[cell][player_idx] = self.scores[cell][player_idx].saturating_add(bonus);

        // Scale down all entries when ceiling is reached to prevent overflow
        // and to give more weight to recent cutoffs.
        if self.scores[cell][player_idx] > HISTORY_CEILING {
            for entry in &mut self.scores {
                entry[0] >>= 1;
                entry[1] >>= 1;
            }
        }
    }

    /// Decays all scores by half. Called between depth iterations to give
    /// more weight to cutoffs from deeper (more accurate) searches.
    fn age(&mut self) {
        for entry in &mut self.scores {
            entry[0] >>= 1;
            entry[1] >>= 1;
        }
    }
}

// ============================================================================
// Move ordering
// ============================================================================

/// Sorts `moves` in-place with a three-tier priority:
///
/// 1. TT move placed first (most likely to produce a cutoff).
/// 2. Killer moves placed next in slot order.
/// 3. Remaining moves sorted by a blended key: `history_score * 8 + neighbors`,
///    so that history dominates when available but neighbor count breaks ties
///    and handles cold-start.
fn order_moves(
    moves: &mut SmallVec<[usize; 128]>,
    state: &MinimaxState,
    player: u8,
    tt_move: Option<usize>,
    killers: [Option<usize>; KILLER_SLOTS],
    history: &HistoryTable,
) {
    let p_idx = state.player_idx(player);
    let mut priority_front: SmallVec<[usize; 4]> = SmallVec::new();
    let mut rest: SmallVec<[(usize, u64); 128]> = SmallVec::new();

    for &idx in moves.iter() {
        if tt_move == Some(idx) {
            priority_front.insert(0, idx);
            continue;
        }
        if killers.iter().any(|&k| k == Some(idx)) {
            priority_front.push(idx);
            continue;
        }
        let neighbor_count = state.neighbors_cache[idx]
            .iter()
            .filter(|&&n| state.board[n] == player)
            .count() as u64;
        let hist = history.score(idx, p_idx) as u64;
        // History dominates; neighbor count as tiebreaker.
        let key = hist * 8 + neighbor_count;
        rest.push((idx, key));
    }

    rest.sort_unstable_by(|a, b| b.1.cmp(&a.1));

    let mut out = 0;
    for &m in &priority_front {
        moves[out] = m;
        out += 1;
    }
    for &(idx, _) in &rest {
        moves[out] = idx;
        out += 1;
    }
}

// ============================================================================
// Bot
// ============================================================================

pub struct MinimaxBot {
    min_time_ms: u64,
    max_time_ms: u64,
}

impl MinimaxBot {
    pub fn new(min_time_ms: u64, max_time_ms: u64) -> Self {
        Self {
            min_time_ms,
            max_time_ms,
        }
    }
}

impl YBot for MinimaxBot {
    fn name(&self) -> &str {
        "minimax_bot"
    }

    fn choose_move(&self, game: &GameY) -> Option<Coordinates> {
        let bot_player = game.next_player()?;
        let mut state = MinimaxState::new(game, bot_player);

        if let Some(coords) = greedy_search(&mut state) {
            return Some(coords);
        }

        let best_move = iterative_deepening_search(&mut state, self.min_time_ms, self.max_time_ms);

        Some(Coordinates::from_index(best_move as u32, game.board_size()))
    }
}

// ============================================================================
// Search
// ============================================================================

/// Checks every available cell for an immediate bot win or an immediate threat
/// that must be blocked. Returns the matching coordinate if found.
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

/// Runs iterative deepening with aspiration windows and two time gates.
///
/// A new depth iteration is only started if `min_time_ms` has not yet elapsed.
/// Within an iteration, `max_time_ms` acts as a hard cut: if `negamax` signals
/// an abort, the partial result is discarded.
///
/// From the second iteration onward, the search uses a narrow aspiration window
/// centered on the previous iteration's score. If the result falls outside the
/// window, the search is retried with progressively wider windows.
fn iterative_deepening_search(
    state: &mut MinimaxState,
    min_time_ms: u64,
    max_time_ms: u64,
) -> usize {
    let start_time = Instant::now();
    let min_limit = Duration::from_millis(min_time_ms);
    let max_limit = Duration::from_millis(max_time_ms);

    let mut tt = TranspositionTable::new();
    let mut history = HistoryTable::new(state.board.len());
    let mut best_move = state.available_cells().next().expect("no available moves");
    let mut prev_score: Option<i32> = None;

    for depth in 1..=100u8 {
        if start_time.elapsed() >= min_limit {
            println!("Min time reached, stopping after depth {}", depth - 1);
            break;
        }

        println!("Searching at depth {}...", depth);

        let mut killers = KillerTable::new(depth as usize);

        let (move_found, score) = if let Some(ps) = prev_score {
            // Aspiration window search.
            aspiration_search(
                state,
                depth,
                ps,
                &mut killers,
                &mut tt,
                &mut history,
                start_time,
                max_limit,
            )
        } else {
            // First iteration: full window.
            search_best_move(
                state,
                depth,
                -INFINITY,
                INFINITY,
                &mut killers,
                &mut tt,
                &mut history,
                start_time,
                max_limit,
            )
        };

        if score == ABORTED {
            println!(
                "Max time exceeded mid-depth {}, keeping result from depth {}",
                depth,
                depth - 1
            );
            break;
        }

        best_move = move_found;
        prev_score = Some(score);

        println!("Depth {}: best_move={} score={}", depth, move_found, score);

        // Decay history between iterations so deeper searches have priority.
        history.age();

        if score >= WIN_SCORE - 100 {
            println!("Winning move found at depth {}", depth);
            break;
        }
    }

    best_move
}

/// Aspiration window wrapper: tries a narrow window first, widens on fail.
fn aspiration_search(
    state: &mut MinimaxState,
    depth: u8,
    prev_score: i32,
    killers: &mut KillerTable,
    tt: &mut TranspositionTable,
    history: &mut HistoryTable,
    start_time: Instant,
    max_limit: Duration,
) -> (usize, i32) {
    let mut delta = ASPIRATION_DELTA;

    loop {
        let alpha = (prev_score - delta).max(-INFINITY);
        let beta = (prev_score + delta).min(INFINITY);

        let (mv, score) = search_best_move(
            state, depth, alpha, beta, killers, tt, history, start_time, max_limit,
        );

        if score == ABORTED {
            return (mv, ABORTED);
        }

        // If the score fits inside the window, we're done.
        if score > alpha && score < beta {
            return (mv, score);
        }

        // Widen the window and retry.
        delta *= 4;
        if delta >= INFINITY / 2 {
            // Fall back to full-width search.
            return search_best_move(
                state, depth, -INFINITY, INFINITY, killers, tt, history, start_time, max_limit,
            );
        }
    }
}

/// Root search: generates moves ordered by shortest-path delta, then searches
/// each with negamax+PVS under the given `[alpha, beta]` window.
fn search_best_move(
    state: &mut MinimaxState,
    depth: u8,
    mut alpha: i32,
    beta: i32,
    killers: &mut KillerTable,
    tt: &mut TranspositionTable,
    history: &mut HistoryTable,
    start_time: Instant,
    max_limit: Duration,
) -> (usize, i32) {
    // Shortest-path delta ordering at root — more accurate but expensive,
    // amortised over the single root call per iteration.
    let ordered = state.shortest_path_deltas(state.bot_id);
    let mut moves: Vec<usize> = ordered.into_iter().map(|(idx, _)| idx).collect();

    // The TT move supersedes the delta ordering.
    if let Some(tt_mv) = tt.best_move(state.hash) {
        if let Some(pos) = moves.iter().position(|&m| m == tt_mv) {
            moves.swap(0, pos);
        }
    }

    let player = state.bot_id;
    let opponent = state.human_id;
    let alpha_orig = alpha;
    let mut best_score = -INFINITY;
    let mut best_move = moves[0];
    let mut searched: u32 = 0;

    for &move_idx in &moves {
        state.make_move(move_idx, player);

        if state.check_win(player) {
            state.undo_move(move_idx);
            tt.store(state.hash, depth, WIN_SCORE, TtFlag::Exact, Some(move_idx));
            return (move_idx, WIN_SCORE);
        }

        // PVS: full window for first move, null window for the rest.
        let score;
        if searched == 0 {
            let child = negamax(
                state,
                depth - 1,
                -beta,
                -alpha,
                opponent,
                killers,
                tt,
                history,
                start_time,
                max_limit,
            );
            if child == ABORTED {
                state.undo_move(move_idx);
                return (best_move, ABORTED);
            }
            score = -child;
        } else {
            let child = negamax(
                state,
                depth - 1,
                -(alpha + 1),
                -alpha,
                opponent,
                killers,
                tt,
                history,
                start_time,
                max_limit,
            );
            if child == ABORTED {
                state.undo_move(move_idx);
                return (best_move, ABORTED);
            }
            let mut s = -child;
            if s > alpha && s < beta {
                let child2 = negamax(
                    state,
                    depth - 1,
                    -beta,
                    -alpha,
                    opponent,
                    killers,
                    tt,
                    history,
                    start_time,
                    max_limit,
                );
                if child2 == ABORTED {
                    state.undo_move(move_idx);
                    return (best_move, ABORTED);
                }
                s = -child2;
            }
            score = s;
        }

        state.undo_move(move_idx);
        searched += 1;

        if score > best_score {
            best_score = score;
            best_move = move_idx;
        }
        if score > alpha {
            alpha = score;
        }
        if alpha >= beta {
            break;
        }
    }

    // Correct bound flag for aspiration windows.
    let flag = if best_score <= alpha_orig {
        TtFlag::UpperBound
    } else if best_score >= beta {
        TtFlag::LowerBound
    } else {
        TtFlag::Exact
    };

    tt.store(state.hash, depth, best_score, flag, Some(best_move));
    (best_move, best_score)
}

/// Negamax with alpha-beta, PVS, transposition table, killer moves, and
/// history heuristic.
///
/// The score is always from the perspective of `player` (the side to move):
/// positive = good for `player`, negative = good for opponent.
///
/// At every internal node:
/// 1. TT probe for immediate cutoff or window narrowing.
/// 2. Win detection after `make_move` — instant return of `WIN_SCORE`.
/// 3. PVS: first move searched with full window, subsequent moves with a
///    null window and re-search on fail-high.
/// 4. Beta cutoffs update killer and history tables.
/// 5. Result stored in the TT before returning.
fn negamax(
    state: &mut MinimaxState,
    depth: u8,
    mut alpha: i32,
    mut beta: i32,
    player: u8,
    killers: &mut KillerTable,
    tt: &mut TranspositionTable,
    history: &mut HistoryTable,
    start_time: Instant,
    max_limit: Duration,
) -> i32 {
    if start_time.elapsed() >= max_limit {
        return ABORTED;
    }

    // --- TT probe ---
    let alpha_orig = alpha;
    let position_hash = state.hash;

    if let Some(entry) = tt.probe(position_hash, depth) {
        match entry.flag {
            TtFlag::Exact => return entry.score,
            TtFlag::LowerBound => alpha = alpha.max(entry.score),
            TtFlag::UpperBound => beta = beta.min(entry.score),
        }
        if alpha >= beta {
            return entry.score;
        }
    }

    if depth == 0 {
        let score = evaluate_state(state, player);
        tt.store(position_hash, 0, score, TtFlag::Exact, None);
        return score;
    }

    let opponent = state.opponent_of(player);
    let depth_idx = depth as usize;
    let killer_moves = killers.get(depth_idx);
    let tt_move = tt.best_move(position_hash);
    let mut moves: SmallVec<[usize; 128]> = state.available_cells().collect();

    order_moves(&mut moves, state, player, tt_move, killer_moves, history);

    let mut best_score = -INFINITY;
    let mut best_move_found: Option<usize> = None;
    let mut searched: u32 = 0;
    let p_idx = state.player_idx(player);

    for move_idx in moves {
        state.make_move(move_idx, player);

        if state.check_win(player) {
            state.undo_move(move_idx);
            killers.store(depth_idx, move_idx);
            let score = WIN_SCORE;
            tt.store(position_hash, depth, score, TtFlag::Exact, Some(move_idx));
            return score;
        }

        // PVS: full window for first move, null window for subsequent.
        let score;
        if searched == 0 {
            let child = negamax(
                state,
                depth - 1,
                -beta,
                -alpha,
                opponent,
                killers,
                tt,
                history,
                start_time,
                max_limit,
            );
            if child == ABORTED {
                state.undo_move(move_idx);
                return ABORTED;
            }
            score = -child;
        } else {
            let child = negamax(
                state,
                depth - 1,
                -(alpha + 1),
                -alpha,
                opponent,
                killers,
                tt,
                history,
                start_time,
                max_limit,
            );
            if child == ABORTED {
                state.undo_move(move_idx);
                return ABORTED;
            }
            let mut s = -child;
            if s > alpha && s < beta {
                // Null-window scout proved this move can beat alpha.
                // Re-search with full window to get exact score.
                let child2 = negamax(
                    state,
                    depth - 1,
                    -beta,
                    -alpha,
                    opponent,
                    killers,
                    tt,
                    history,
                    start_time,
                    max_limit,
                );
                if child2 == ABORTED {
                    state.undo_move(move_idx);
                    return ABORTED;
                }
                s = -child2;
            }
            score = s;
        }

        state.undo_move(move_idx);
        searched += 1;

        if score > best_score {
            best_score = score;
            best_move_found = Some(move_idx);
        }
        if score > alpha {
            alpha = score;
        }
        if alpha >= beta {
            killers.store(depth_idx, move_idx);
            history.record_cutoff(move_idx, p_idx, depth);
            break;
        }
    }

    // Determine and store the bound type.
    let flag = if best_score <= alpha_orig {
        TtFlag::UpperBound
    } else if best_score >= beta {
        TtFlag::LowerBound
    } else {
        TtFlag::Exact
    };

    tt.store(position_hash, depth, best_score, flag, best_move_found);
    best_score
}

// ============================================================================
// Evaluation
// ============================================================================

/// Heuristic evaluation from `player`'s perspective.
///
/// Primary component: BFS-based connection cost difference.
///     opponent_cost - own_cost  (positive = good for player)
///
/// This measures how many more empty cells the *opponent* needs to occupy to
/// connect all three sides compared to `player`. It captures global strategic
/// structure that the local incremental metrics miss.
///
/// Secondary component: incremental score (well-connected pieces, edge touches,
/// centrality) as a tiebreaker.
fn evaluate_state(state: &mut MinimaxState, player: u8) -> i32 {
    let opponent = state.opponent_of(player);

    let own_cost = state.connection_cost(player);
    let opp_cost = state.connection_cost(opponent);

    // BFS score: positive when opponent's connection is costlier.
    let bfs_score = match (own_cost == BLOCKED, opp_cost == BLOCKED) {
        (true, true) => 0,
        (true, false) => -(WIN_SCORE / 2),
        (false, true) => WIN_SCORE / 2,
        (false, false) => (opp_cost as i32 - own_cost as i32) * 150,
    };

    // Incremental tiebreaker from each player's perspective.
    let p_idx = state.player_idx(player);
    let o_idx = 1 - p_idx;
    let game_progress = state.occupied_count as f32 / state.board.len() as f32;
    let incr =
        state.scores[p_idx].evaluate(game_progress) - state.scores[o_idx].evaluate(game_progress);

    bfs_score + incr
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{GameY, PlayerId};

    fn create_empty_state(size: u32) -> MinimaxState {
        MinimaxState::new(&GameY::new(size), PlayerId::new(0))
    }

    fn get_valid_cells(state: &MinimaxState, count: usize) -> Vec<usize> {
        state.available_cells().take(count).collect()
    }

    fn make_search_context(
        max_depth: u8,
        total_cells: usize,
    ) -> (
        Instant,
        Duration,
        KillerTable,
        TranspositionTable,
        HistoryTable,
    ) {
        (
            Instant::now(),
            Duration::from_secs(60),
            KillerTable::new(max_depth as usize),
            TranspositionTable::new(),
            HistoryTable::new(total_cells),
        )
    }

    // ============================================================================
    // State and board mutation
    // ============================================================================

    #[test]
    fn test_state_initializes_correctly() {
        let game = GameY::new(3);
        let state = MinimaxState::new(&game, PlayerId::new(0));

        assert_eq!(state.size, 3);
        assert_eq!(state.bot_id, 1);
        assert_eq!(state.human_id, 2);

        for idx in state.available_cells() {
            assert_eq!(state.board[idx], 0);
        }

        assert!(state.available_mask.count_ones(..) > 0);
        assert_eq!(state.occupied_count, 0);
        assert_eq!(state.hash, 0, "empty board must have hash 0");
    }

    #[test]
    fn test_make_move_updates_hash() {
        let mut state = create_empty_state(3);
        let idx = state.available_cells().next().unwrap();

        let hash_before = state.hash;
        state.make_move(idx, state.bot_id);
        assert_ne!(state.hash, hash_before);
    }

    #[test]
    fn test_undo_move_restores_hash() {
        let mut state = create_empty_state(3);
        let idx = state.available_cells().next().unwrap();

        let hash_before = state.hash;
        state.make_move(idx, state.bot_id);
        state.undo_move(idx);

        assert_eq!(state.hash, hash_before);
    }

    #[test]
    fn test_make_undo_restores_incremental_score() {
        let mut state = create_empty_state(3);
        let idx = state.available_cells().next().unwrap();
        let scores_before = state.scores.clone();

        state.make_move(idx, state.bot_id);
        state.undo_move(idx);

        let s0 = &state.scores[0];
        let s1 = &state.scores[1];
        let b0 = &scores_before[0];
        let b1 = &scores_before[1];

        assert_eq!(s0.connections, b0.connections);
        assert_eq!(s0.well_connected, b0.well_connected);
        assert_eq!(s0.center_sum, b0.center_sum);
        assert_eq!(s0.edge_refs, b0.edge_refs);
        assert_eq!(s1.connections, b1.connections);
    }

    #[test]
    fn test_occupied_count_tracks_moves() {
        let mut state = create_empty_state(3);
        let cells = get_valid_cells(&state, 3);

        state.make_move(cells[0], state.bot_id);
        assert_eq!(state.occupied_count, 1);
        state.make_move(cells[1], state.human_id);
        assert_eq!(state.occupied_count, 2);
        state.undo_move(cells[1]);
        assert_eq!(state.occupied_count, 1);
    }

    // ============================================================================
    // Win detection
    // ============================================================================

    #[test]
    fn test_check_win_empty_board_returns_false() {
        let mut state = create_empty_state(3);
        assert!(!state.check_win(state.bot_id));
        assert!(!state.check_win(state.human_id));
    }

    #[test]
    fn test_check_win_single_piece_returns_false() {
        let mut state = create_empty_state(3);
        let cell = state.available_cells().next().unwrap();

        state.make_move(cell, state.bot_id);
        assert!(!state.check_win(state.bot_id));
    }

    #[test]
    fn test_check_win_does_not_crash_on_full_scan() {
        let mut state = create_empty_state(4);
        let cells: Vec<_> = state.available_cells().collect();
        let mut player = state.bot_id;
        for cell in cells {
            state.make_move(cell, player);
            player = state.opponent_of(player);
        }

        let _ = state.check_win(state.bot_id);
        let _ = state.check_win(state.human_id);
    }

    // ============================================================================
    // Connection cost
    // ============================================================================

    #[test]
    fn test_connection_cost_empty_board_is_finite() {
        let mut state = create_empty_state(4);
        let cost = state.connection_cost(state.bot_id);
        assert_ne!(
            cost, BLOCKED,
            "empty board should have a finite connection cost"
        );
        assert!(cost > 0, "empty board connection cost should be positive");
    }

    #[test]
    fn test_connection_cost_symmetric_on_empty_board() {
        let mut state = create_empty_state(4);
        let cost_bot = state.connection_cost(state.bot_id);
        let cost_human = state.connection_cost(state.human_id);
        assert_eq!(cost_bot, cost_human, "empty board should have equal costs");
    }

    #[test]
    fn test_connection_cost_decreases_with_own_piece() {
        let mut state = create_empty_state(4);
        let baseline = state.connection_cost(state.bot_id);

        // Place a piece in a central cell.
        let cells: Vec<_> = state.available_cells().collect();
        let mid = cells[cells.len() / 2];
        state.make_move(mid, state.bot_id);
        let after = state.connection_cost(state.bot_id);

        assert!(
            after <= baseline,
            "placing own piece should not increase connection cost"
        );
    }

    // ============================================================================
    // Move ordering
    // ============================================================================

    #[test]
    fn test_order_moves_places_tt_move_first() {
        let state = create_empty_state(4);
        let history = HistoryTable::new(state.board.len());
        let mut moves: SmallVec<[usize; 128]> = state.available_cells().take(8).collect();
        let tt_mv = moves[5];

        order_moves(
            &mut moves,
            &state,
            state.bot_id,
            Some(tt_mv),
            [None, None],
            &history,
        );

        assert_eq!(moves[0], tt_mv);
    }

    #[test]
    fn test_order_moves_tt_before_killer() {
        let state = create_empty_state(4);
        let history = HistoryTable::new(state.board.len());
        let mut moves: SmallVec<[usize; 128]> = state.available_cells().take(10).collect();
        let tt_mv = moves[7];
        let killer = moves[3];

        order_moves(
            &mut moves,
            &state,
            state.bot_id,
            Some(tt_mv),
            [Some(killer), None],
            &history,
        );

        assert_eq!(moves[0], tt_mv, "TT move must be first");
        assert_eq!(moves[1], killer, "killer must be second");
    }

    #[test]
    fn test_order_moves_preserves_all_moves() {
        let state = create_empty_state(4);
        let history = HistoryTable::new(state.board.len());
        let mut moves: SmallVec<[usize; 128]> = state.available_cells().take(10).collect();
        let original: std::collections::HashSet<usize> = moves.iter().copied().collect();

        order_moves(
            &mut moves,
            &state,
            state.bot_id,
            None,
            [None, None],
            &history,
        );

        let after: std::collections::HashSet<usize> = moves.iter().copied().collect();
        assert_eq!(original, after);
    }

    // ============================================================================
    // Negamax
    // ============================================================================

    #[test]
    fn test_negamax_depth_zero_matches_evaluate() {
        let mut state = create_empty_state(3);
        let cell = state.available_cells().next().unwrap();
        state.make_move(cell, state.bot_id);

        let bot = state.bot_id;
        let total = state.board.len();
        let (start, limit, mut killers, mut tt, mut hist) = make_search_context(0, total);
        let score = negamax(
            &mut state,
            0,
            -INFINITY,
            INFINITY,
            bot,
            &mut killers,
            &mut tt,
            &mut hist,
            start,
            limit,
        );
        assert_eq!(score, evaluate_state(&mut state, bot));
    }

    #[test]
    fn test_negamax_score_in_valid_range() {
        let mut state = create_empty_state(3);
        let cell = state.available_cells().next().unwrap();
        state.make_move(cell, state.bot_id);

        let human = state.human_id;
        let total = state.board.len();
        let (start, limit, mut killers, mut tt, mut hist) = make_search_context(1, total);
        let score = negamax(
            &mut state,
            1,
            -INFINITY,
            INFINITY,
            human,
            &mut killers,
            &mut tt,
            &mut hist,
            start,
            limit,
        );

        assert!(score >= LOSE_SCORE && score <= WIN_SCORE);
    }

    #[test]
    fn test_negamax_aborts_when_time_exceeded() {
        let mut state = create_empty_state(3);
        let start = Instant::now() - Duration::from_secs(100);
        let limit = Duration::from_millis(1);
        let mut killers = KillerTable::new(5);
        let mut tt = TranspositionTable::new();
        let mut hist = HistoryTable::new(state.board.len());
        let bot = state.bot_id;

        let score = negamax(
            &mut state,
            5,
            -INFINITY,
            INFINITY,
            bot,
            &mut killers,
            &mut tt,
            &mut hist,
            start,
            limit,
        );

        assert_eq!(score, ABORTED);
    }

    #[test]
    fn test_negamax_with_tt_returns_same_result_twice() {
        let mut state = create_empty_state(3);
        let total = state.board.len();
        let (start, limit, mut killers, mut tt, mut hist) = make_search_context(3, total);
        let bot = state.bot_id;

        let score1 = negamax(
            &mut state,
            3,
            -INFINITY,
            INFINITY,
            bot,
            &mut killers,
            &mut tt,
            &mut hist,
            start,
            limit,
        );

        let score2 = negamax(
            &mut state,
            3,
            -INFINITY,
            INFINITY,
            bot,
            &mut killers,
            &mut tt,
            &mut hist,
            start,
            limit,
        );

        assert_eq!(score1, score2);
    }

    // ============================================================================
    // Integration
    // ============================================================================

    #[test]
    fn test_greedy_search_empty_board_returns_none() {
        let mut state = create_empty_state(3);
        assert!(greedy_search(&mut state).is_none());
    }

    #[test]
    fn test_search_best_move_returns_valid_index() {
        let mut state = create_empty_state(3);
        let start = Instant::now();
        let limit = Duration::from_secs(60);
        let mut killers = KillerTable::new(2);
        let mut tt = TranspositionTable::new();
        let mut hist = HistoryTable::new(state.board.len());

        let (best_move, score) = search_best_move(
            &mut state,
            2,
            -INFINITY,
            INFINITY,
            &mut killers,
            &mut tt,
            &mut hist,
            start,
            limit,
        );

        assert!(best_move < state.board.len());
        assert!(state.available_mask.contains(best_move));
        assert!(score > LOSE_SCORE);
    }

    #[test]
    fn test_iterative_deepening_returns_valid_move() {
        let mut state = create_empty_state(3);
        let best_move = iterative_deepening_search(&mut state, 50, 200);
        assert!(best_move < state.board.len());
    }

    #[test]
    fn test_bot_choose_move_returns_valid_coords() {
        let game = GameY::new(3);
        let bot = MinimaxBot::new(50, 200);
        let coords = bot.choose_move(&game);

        assert!(coords.is_some());
        assert!(coords.unwrap().is_valid(3));
    }

    #[test]
    fn test_bot_name() {
        assert_eq!(MinimaxBot::new(50, 200).name(), "minimax_bot");
    }

    #[test]
    fn test_constants_are_consistent() {
        assert_eq!(WIN_SCORE, 100_000);
        assert_eq!(LOSE_SCORE, -100_000);
        assert!(INFINITY > WIN_SCORE);
        assert!(ABORTED < LOSE_SCORE);
    }

    #[test]
    fn test_complete_flow_make_evaluate_undo() {
        let mut state = create_empty_state(3);
        let initial_available = state.available_cells().count();
        let idx = state.available_cells().next().unwrap();
        let bot = state.bot_id;

        state.make_move(idx, state.bot_id);
        assert_ne!(evaluate_state(&mut state, bot), 0);
        state.undo_move(idx);

        assert_eq!(state.available_cells().count(), initial_available);
        assert_eq!(state.board[idx], 0);
        assert_eq!(state.occupied_count, 0);
        assert_eq!(state.hash, 0);
    }

    #[test]
    fn test_alternating_moves_and_undo_restores_board() {
        let mut state = create_empty_state(4);
        let moves = get_valid_cells(&state, 4);
        let bot = state.bot_id;

        state.make_move(moves[0], state.bot_id);
        state.make_move(moves[1], state.human_id);
        state.make_move(moves[2], state.bot_id);
        state.make_move(moves[3], state.human_id);

        let hash_mid = state.hash;
        assert!(evaluate_state(&mut state, bot).abs() < WIN_SCORE);

        for &m in moves.iter().rev() {
            state.undo_move(m);
        }

        assert_eq!(state.occupied_count, 0);
        assert_ne!(hash_mid, state.hash, "hash must change as moves are undone");
    }

    // ============================================================================
    // History heuristic
    // ============================================================================

    #[test]
    fn test_history_starts_at_zero() {
        let hist = HistoryTable::new(10);
        assert_eq!(hist.score(0, 0), 0);
        assert_eq!(hist.score(5, 1), 0);
    }

    #[test]
    fn test_history_records_and_ages() {
        let mut hist = HistoryTable::new(10);
        hist.record_cutoff(3, 0, 4); // bonus = 16
        assert_eq!(hist.score(3, 0), 16);

        hist.age();
        assert_eq!(hist.score(3, 0), 8);
    }

    // ============================================================================
    // Aspiration windows
    // ============================================================================

    #[test]
    fn test_aspiration_search_same_as_full_window() {
        // Aspiration should eventually converge to the same result.
        let mut state = create_empty_state(3);
        let start = Instant::now();
        let limit = Duration::from_secs(60);
        let mut killers = KillerTable::new(2);
        let mut tt = TranspositionTable::new();
        let mut hist = HistoryTable::new(state.board.len());

        let (mv_full, score_full) = search_best_move(
            &mut state,
            2,
            -INFINITY,
            INFINITY,
            &mut killers,
            &mut tt,
            &mut hist,
            start,
            limit,
        );

        // Reset TT for fair comparison.
        tt = TranspositionTable::new();
        hist = HistoryTable::new(state.board.len());
        killers = KillerTable::new(2);

        let (mv_asp, score_asp) = aspiration_search(
            &mut state,
            2,
            score_full,
            &mut killers,
            &mut tt,
            &mut hist,
            start,
            limit,
        );

        assert_eq!(
            score_full, score_asp,
            "aspiration must converge to same score"
        );
        assert_eq!(mv_full, mv_asp, "aspiration must find same best move");
    }
}
