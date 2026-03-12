// ──────────────────────────────────────────────────────────────────────────────
// __tests__/gameService.test.ts
//
// Unit tests for services/gameService.ts.
//
// WHY mocks are used here:
//   gameService has two external dependencies that we must not hit in unit
//   tests: the in-memory store (gameStore) and the Rust engine (axios).
//   Mocking them means tests are: fast, deterministic, and can exercise every
//   branch (timeout, no-moves, auth errors) without needing a running server.
//
// Scope covered:
//   createGame   — happy path
//   getGameState — found / not found
//   playMove     — valid move + bot replies fast (200)
//                — valid move + bot times out (202)
//                — valid move + bot reports no moves (human wins)
//                — invalid layout (validation error → 400)
//                — wrong player's turn (403 NOT_YOUR_TURN)
//                — not a participant (403 NOT_PLAYING)
//                — game already finished (409)
//   surrender    — happy path → opponent wins
//                — not a participant → 403
// ──────────────────────────────────────────────────────────────────────────────

import axios from 'axios';
import * as gameStore from '../services/gameStore';
import * as gameService from '../services/gameService';
import { emptyYEN } from '../services/yenService';
import type { GameState } from '../models/game';

// ── Mock axios so we never make real HTTP calls ───────────────────────────────
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;
// axios.isAxiosError is not on the mocked type by default; restore it.
(mockedAxios as any).isAxiosError = axios.isAxiosError;

// ── Mock gameStore so tests are isolated from each other ─────────────────────
jest.mock('../services/gameStore');
const mockedStore = gameStore as jest.Mocked<typeof gameStore>;

// ── Shared test fixtures ──────────────────────────────────────────────────────

const HUMAN_USER_ID = 42;

const makeOngoingGame = (overrides: Partial<GameState> = {}): GameState => ({
  gameId: 1,
  yen: emptyYEN(3),          // "./../..."  — size-3 empty board
  players: {
    B: { type: 'HUMAN', id: HUMAN_USER_ID },
    R: { type: 'BOT', strategy: 'EASY' },
  },
  timers: { B: 600_000, R: 600_000 },
  turn: 'B',
  status: 'ONGOING',
  ...overrides,
});

// A valid proposed layout: place B at the top cell
const PROPOSED_LAYOUT_B_TOP = 'B/../...';

beforeEach(() => {
  jest.clearAllMocks();
});

// ── createGame ────────────────────────────────────────────────────────────────

describe('createGame', () => {
  it('allocates an ID, builds an empty board, saves to store, and returns the game', () => {
    mockedStore.allocateGameId.mockReturnValue(7);

    const game = gameService.createGame(3, {
      B: { type: 'HUMAN', id: HUMAN_USER_ID },
      R: { type: 'BOT', strategy: 'EASY' },
    });

    expect(game.gameId).toBe(7);
    expect(game.status).toBe('ONGOING');
    expect(game.turn).toBe('B');
    expect(game.yen.size).toBe(3);
    // All cells are empty on a fresh board
    expect(game.yen.layout).toBe('./../...');
    expect(mockedStore.saveToMemory).toHaveBeenCalledWith(game);
  });

  it('respects custom timer values', () => {
    mockedStore.allocateGameId.mockReturnValue(1);

    const game = gameService.createGame(
      3,
      { B: { type: 'HUMAN', id: 1 }, R: { type: 'BOT', strategy: 'EASY' } },
      { B: 30_000, R: 30_000 }
    );

    expect(game.timers.B).toBe(30_000);
    expect(game.timers.R).toBe(30_000);
  });
});

// ── getGameState ──────────────────────────────────────────────────────────────

describe('getGameState', () => {
  it('returns the game when it exists in the store', () => {
    const game = makeOngoingGame();
    mockedStore.getFromMemory.mockReturnValue(game);

    const result = gameService.getGameState(1);

    expect(result).toBe(game);
    expect(mockedStore.getFromMemory).toHaveBeenCalledWith(1);
  });

  it('throws a 404 GAME_NOT_FOUND error when the game is missing', () => {
    mockedStore.getFromMemory.mockReturnValue(undefined);

    expect(() => gameService.getGameState(999)).toThrow(
      expect.objectContaining({ code: 'GAME_NOT_FOUND', httpStatus: 404 })
    );
  });
});

// ── playMove ──────────────────────────────────────────────────────────────────

describe('playMove', () => {

  // ── happy path: bot replies within timeout ──────────────────────────────────
  it('returns httpStatus 200 and a PlayResult when bot replies fast', async () => {
    const game = makeOngoingGame();
    mockedStore.getFromMemory.mockReturnValue(game);

    // Rust engine replies with coords for bottom-left cell of a size-3 board
    // index 3 → {x:0,y:0,z:2}
    mockedAxios.post.mockResolvedValue({
      data: {
        api_version: 'v1',
        bot_id: 'random_bot',
        coords: { x: 0, y: 0, z: 2 },
      },
    });

    const { result, httpStatus } = await gameService.playMove(
      1,
      PROPOSED_LAYOUT_B_TOP,
      HUMAN_USER_ID
    );

    expect(httpStatus).toBe(200);
    expect(result.status).toBe('ONGOING');
    expect(result.fastMove).toBe('0,0,2');
    // Board now has B at top AND R at bottom-left
    expect(result.yen).toContain('B');
    expect(result.yen).toContain('R');
    expect(mockedStore.saveToMemory).toHaveBeenCalled();
    // Game is still ongoing — must NOT be removed from store
    expect(mockedStore.removeFromMemory).not.toHaveBeenCalled();
  });

  // ── bot times out → 202 ─────────────────────────────────────────────────────
  it('returns httpStatus 202 when the Rust engine times out', async () => {
    const game = makeOngoingGame();
    mockedStore.getFromMemory.mockReturnValue(game);

    // Simulate axios timeout (ECONNABORTED)
    const timeoutError = Object.assign(new Error('timeout'), {
      code: 'ECONNABORTED',
      isAxiosError: true,
    });
    mockedAxios.post.mockRejectedValue(timeoutError);
    (mockedAxios as any).isAxiosError = () => true;

    const { result, httpStatus } = await gameService.playMove(
      1,
      PROPOSED_LAYOUT_B_TOP,
      HUMAN_USER_ID
    );

    expect(httpStatus).toBe(202);
    expect(result.status).toBe('ONGOING');
    expect(result.fastMove).toBeNull();
    // Turn passes to the bot even though it hasn't moved yet
    expect(result.nextTurn).toBe('R');
  });

  // ── bot reports no moves → human wins ───────────────────────────────────────
  it('finalises the game with PLAYER_B_WINS when Rust reports no moves', async () => {
    const game = makeOngoingGame();
    mockedStore.getFromMemory.mockReturnValue(game);

    const noMovesError = Object.assign(new Error('No valid moves available'), {
      isAxiosError: true,
      response: { data: { message: 'No valid moves for bot' } },
    });
    mockedAxios.post.mockRejectedValue(noMovesError);
    (mockedAxios as any).isAxiosError = () => true;

    const { result, httpStatus } = await gameService.playMove(
      1,
      PROPOSED_LAYOUT_B_TOP,
      HUMAN_USER_ID
    );

    expect(httpStatus).toBe(200);
    expect(result.status).toBe('PLAYER_B_WINS');
    expect(result.nextTurn).toBeNull();
    // Finished game must be persisted and evicted
    expect(mockedStore.removeFromMemory).toHaveBeenCalledWith(1);
  });

  // ── illegal move ────────────────────────────────────────────────────────────
  it('throws a validation error (no httpStatus) for an illegal layout', async () => {
    const game = makeOngoingGame();
    mockedStore.getFromMemory.mockReturnValue(game);

    // Two B tokens placed at once
    await expect(
      gameService.playMove(1, 'B/../B..', HUMAN_USER_ID)
    ).rejects.toThrow(/exactly 1/);

    // The Rust engine must never be called for invalid moves
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  // ── wrong player's turn ─────────────────────────────────────────────────────
  it('throws NOT_YOUR_TURN (403) when it is not the caller\'s turn', async () => {
    // Game is on B's turn, but the caller is user 99, who is NOT user 42 (B)
    const game = makeOngoingGame({
      players: {
        B: { type: 'HUMAN', id: 99 },   // different user
        R: { type: 'HUMAN', id: HUMAN_USER_ID },
      },
    });
    mockedStore.getFromMemory.mockReturnValue(game);

    await expect(
      gameService.playMove(1, PROPOSED_LAYOUT_B_TOP, HUMAN_USER_ID)
    ).rejects.toMatchObject({ code: 'NOT_YOUR_TURN', httpStatus: 403 });
  });

  // ── not a participant ───────────────────────────────────────────────────────
  it('throws NOT_PLAYING (403) when the caller is not in the game', async () => {
    const game = makeOngoingGame(); // only user 42 is in the game
    mockedStore.getFromMemory.mockReturnValue(game);

    await expect(
      gameService.playMove(1, PROPOSED_LAYOUT_B_TOP, 999) // stranger
    ).rejects.toMatchObject({ code: 'NOT_PLAYING', httpStatus: 403 });
  });

  // ── game already finished ────────────────────────────────────────────────────
  it('throws GAME_ALREADY_FINISHED (409) on a completed game', async () => {
    const game = makeOngoingGame({ status: 'PLAYER_B_WINS', turn: null });
    mockedStore.getFromMemory.mockReturnValue(game);

    await expect(
      gameService.playMove(1, PROPOSED_LAYOUT_B_TOP, HUMAN_USER_ID)
    ).rejects.toMatchObject({ code: 'GAME_ALREADY_FINISHED', httpStatus: 409 });
  });

  // ── game not found ───────────────────────────────────────────────────────────
  it('throws GAME_NOT_FOUND (404) for an unknown game ID', async () => {
    mockedStore.getFromMemory.mockReturnValue(undefined);

    await expect(
      gameService.playMove(999, PROPOSED_LAYOUT_B_TOP, HUMAN_USER_ID)
    ).rejects.toMatchObject({ code: 'GAME_NOT_FOUND', httpStatus: 404 });
  });
});

// ── surrender ─────────────────────────────────────────────────────────────────

describe('surrender', () => {
  it('sets status to PLAYER_R_WINS and removes the game from store when B surrenders', async () => {
    const game = makeOngoingGame(); // B's turn
    mockedStore.getFromMemory.mockReturnValue(game);

    const finalState = await gameService.surrender(1, HUMAN_USER_ID);

    expect(finalState.status).toBe('PLAYER_R_WINS');
    expect(finalState.turn).toBeNull();
    expect(mockedStore.removeFromMemory).toHaveBeenCalledWith(1);
  });

  it('throws NOT_PLAYING (403) when a non-participant tries to surrender', async () => {
    const game = makeOngoingGame();
    mockedStore.getFromMemory.mockReturnValue(game);

    await expect(
      gameService.surrender(1, 999)
    ).rejects.toMatchObject({ code: 'NOT_PLAYING', httpStatus: 403 });
  });

  it('throws GAME_ALREADY_FINISHED (409) on a finished game', async () => {
    const game = makeOngoingGame({ status: 'PLAYER_B_WINS', turn: null });
    mockedStore.getFromMemory.mockReturnValue(game);

    await expect(
      gameService.surrender(1, HUMAN_USER_ID)
    ).rejects.toMatchObject({ code: 'GAME_ALREADY_FINISHED', httpStatus: 409 });
  });
});
