//! Transposition table, killer table, history table, and Zobrist hashing.

/// Number of killer move slots per depth level.
pub(super) const KILLER_SLOTS: usize = 2;

/// Number of buckets in the transposition table. Must be a power of two.
/// Each bucket holds two entries (depth-preferred + always-replace).
/// Total entries = 2 * TT_BUCKETS ≈ 2M entries × ~20 bytes ≈ 40 MB.
const TT_BUCKETS: usize = 1 << 20;

/// Default aspiration window half-width for iterative deepening.
pub(super) const ASPIRATION_DELTA: i32 = 50;

/// History scores are scaled down when any entry exceeds this threshold.
const HISTORY_CEILING: u32 = 1_000_000;

// ============================================================================
// Transposition table
// ============================================================================

#[derive(Clone, Copy, PartialEq, Eq, Default, Debug)]
#[repr(u8)]
pub(super) enum TtFlag {
    #[default]
    Exact = 0,
    LowerBound = 1,
    UpperBound = 2,
}

#[derive(Clone, Default)]
pub(super) struct TtEntry {
    pub key: u64,
    pub score: i32,
    pub best_move: u32,
    pub depth: u8,
    pub flag: TtFlag,
}

impl TtEntry {
    pub fn is_empty(&self) -> bool {
        self.key == 0
    }
}

pub(super) struct TranspositionTable {
    entries: Vec<TtEntry>,
    mask: usize,
}

impl TranspositionTable {
    pub fn new() -> Self {
        Self {
            entries: vec![TtEntry::default(); TT_BUCKETS * 2],
            mask: TT_BUCKETS - 1,
        }
    }

    #[inline]
    fn bucket_base(&self, key: u64) -> usize {
        (key as usize & self.mask) * 2
    }

    pub fn store(&mut self, key: u64, depth: u8, score: i32, flag: TtFlag, best_move: Option<usize>) {
        debug_assert_ne!(score, super::ABORTED, "must not store ABORTED in the TT");

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

    pub fn probe(&self, key: u64, depth: u8) -> Option<&TtEntry> {
        let base = self.bucket_base(key);
        for slot in 0..2 {
            let e = &self.entries[base + slot];
            if e.key == key && e.depth >= depth {
                return Some(e);
            }
        }
        None
    }

    pub fn best_move(&self, key: u64) -> Option<usize> {
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

pub(super) fn xorshift64(state: &mut u64) -> u64 {
    *state ^= *state << 13;
    *state ^= *state >> 7;
    *state ^= *state << 17;
    *state
}

// ============================================================================
// Killer table
// ============================================================================

pub(super) struct KillerTable {
    slots: Vec<[Option<usize>; KILLER_SLOTS]>,
}

impl KillerTable {
    pub fn new(max_depth: usize) -> Self {
        Self {
            slots: vec![[None; KILLER_SLOTS]; max_depth + 1],
        }
    }

    pub fn store(&mut self, depth: usize, mv: usize) {
        let slot = &mut self.slots[depth];
        if slot[0] == Some(mv) || slot[1] == Some(mv) {
            return;
        }
        slot[1] = slot[0];
        slot[0] = Some(mv);
    }

    pub fn get(&self, depth: usize) -> [Option<usize>; KILLER_SLOTS] {
        self.slots[depth]
    }
}

// ============================================================================
// History table
// ============================================================================

/// Tracks which moves have historically produced beta-cutoffs.
/// Indexed by `[cell_index][player_index]`. Moves that consistently cause
/// cutoffs accumulate high scores and are searched earlier.
pub(super) struct HistoryTable {
    scores: Vec<[u32; 2]>,
}

impl HistoryTable {
    pub fn new(total_cells: usize) -> Self {
        Self {
            scores: vec![[0u32; 2]; total_cells],
        }
    }

    #[inline]
    pub fn score(&self, cell: usize, player_idx: usize) -> u32 {
        self.scores[cell][player_idx]
    }

    /// Records a beta-cutoff at `cell` for `player_idx` with bonus `depth²`.
    pub fn record_cutoff(&mut self, cell: usize, player_idx: usize, depth: u8) {
        let bonus = (depth as u32) * (depth as u32);
        self.scores[cell][player_idx] = self.scores[cell][player_idx].saturating_add(bonus);

        if self.scores[cell][player_idx] > HISTORY_CEILING {
            for entry in &mut self.scores {
                entry[0] >>= 1;
                entry[1] >>= 1;
            }
        }
    }

    /// Decays all scores by half.
    pub fn age(&mut self) {
        for entry in &mut self.scores {
            entry[0] >>= 1;
            entry[1] >>= 1;
        }
    }
}
