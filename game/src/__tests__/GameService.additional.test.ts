import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('../config/database', () => ({
  AppDataSource: {
    getRepository: vi.fn(() => ({
      findOne: vi.fn(),
      find: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      createQueryBuilder: vi.fn(),
    })),
  },
}))

vi.mock('../utils/gameY', () => ({
  createEmptyBoard: vi.fn(() => []),
  applyMove: vi.fn((board: any) => board),
  checkWinner: vi.fn(() => null),
  isValidMove: vi.fn(() => true),
  getOppositePlayer: vi.fn((p: string) => (p === 'player1' ? 'player2' : 'player1')),
}))

vi.mock('../services/BotService', () => ({
  getBotMove: vi.fn(),
  getBotPieOpening: vi.fn(),
  getBotPieDecision: vi.fn(),
}))

// global fetch mock
const fetchMock = vi.fn()
global.fetch = fetchMock

import { GameService } from '../services/GameService'
import { AppDataSource } from '../config/database'
import { getBotPieDecision } from '../services/BotService'
import { checkWinner, getOppositePlayer } from '../utils/gameY'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeTimerState(overrides: Record<string, any> = {}) {
  return {
    player1RemainingMs: 60_000,
    player2RemainingMs: 60_000,
    activePlayer: 'player1' as const,
    lastSyncTimestamp: Date.now(),
    ...overrides,
  }
}

function makeGame(overrides: Record<string, any> = {}) {
  return {
    id: 'game-1',
    status: 'playing',
    phase: 'playing',
    config: { mode: 'pvp-online', boardSize: 11, timerEnabled: false, timerSeconds: null, pieRule: false },
    boardState: [],
    players: {
      player1: { id: '1', name: 'p1', color: 'player1' },
      player2: { id: '2', name: 'p2', color: 'player2' },
    },
    currentTurn: 'player1',
    winner: null,
    timerState: null,
    player1Id: 1,
    player2Id: 2,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

function makeRepo(defaults: Record<string, any> = {}) {
  return {
    findOne: vi.fn().mockResolvedValue(null),
    find: vi.fn().mockResolvedValue([]),
    create: vi.fn((d: any) => ({ ...d })),
    save: vi.fn(async (e: any) => e),
    createQueryBuilder: vi.fn(),
    ...defaults,
  }
}

/** Creates a GameService with controllable repos injected via AppDataSource mock */
function getService() {
  let callCount = 0
  const gameRepo = makeRepo()
  const moveRepo = makeRepo()

  vi.mocked(AppDataSource.getRepository).mockImplementation(
    (() => {
      callCount++
      return callCount === 1 ? gameRepo : moveRepo
    }) as any,
  )

  const service = new GameService()
  return { service, gameRepo, moveRepo }
}

// ── Suite ──────────────────────────────────────────────────────────────────────

describe('GameService – additional coverage', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) })
  })

  // ── setPlayer2Id ───────────────────────────────────────────────────────────

  describe('setPlayer2Id', () => {
    it('does nothing when game is not found', async () => {
      const { service, gameRepo } = getService()
      gameRepo.findOne.mockResolvedValue(null)

      await service.setPlayer2Id('missing', 99, 'ghost')
      expect(gameRepo.save).not.toHaveBeenCalled()
    })

    it('updates player2Id and player2 name on the game', async () => {
      const { service, gameRepo } = getService()
      const game = makeGame()
      gameRepo.findOne.mockResolvedValue(game)

      await service.setPlayer2Id('game-1', 42, 'newcomer')

      expect(gameRepo.save).toHaveBeenCalledOnce()
      const saved = gameRepo.save.mock.calls[0][0]
      expect(saved.player2Id).toBe(42)
      expect(saved.players.player2.id).toBe('42')
      expect(saved.players.player2.name).toBe('newcomer')
    })

    it('preserves other player2 fields when updating', async () => {
      const { service, gameRepo } = getService()
      const game = makeGame({
        players: {
          player1: { id: '1', name: 'p1', color: 'player1' },
          player2: { id: 'waiting', name: 'Opponent', color: 'player2', extra: 'keep-me' },
        },
      })
      gameRepo.findOne.mockResolvedValue(game)

      await service.setPlayer2Id('game-1', 7, 'realPlayer')

      const saved = gameRepo.save.mock.calls[0][0]
      expect((saved.players.player2 as any).extra).toBe('keep-me')
    })
  })

  // ── computeUpdatedTimer (via playMove observable side-effects) ─────────────

  describe('computeUpdatedTimer', () => {
    it('does not mutate timer when activePlayer does not match the mover', async () => {
      const { service, gameRepo, moveRepo } = getService()

      const now = Date.now()
      const timer = makeTimerState({ activePlayer: 'player2', lastSyncTimestamp: now - 5_000, player2RemainingMs: 60_000 })
      const game = makeGame({ timerState: timer })

      gameRepo.findOne.mockResolvedValue(game)
      moveRepo.find.mockResolvedValue([])
      moveRepo.create.mockImplementation((d: any) => d)
      moveRepo.save.mockResolvedValue({})

      // player1 moves but activePlayer is player2 → player2 time should NOT decrease
      const state = await service.playMove('game-1', 0, 0, 'player1')
      // timer activePlayer is 'player2', player1 is moving → no time deducted from player2
      // the saved game.timerState should reflect no reduction for player2
      expect(state.timer?.player2RemainingMs).toBe(60_000)
    })

    it('deducts elapsed time from the active player', async () => {
      const { service, gameRepo, moveRepo } = getService()

      const now = Date.now()
      const elapsed = 3_000
      const timer = makeTimerState({
        activePlayer: 'player1',
        lastSyncTimestamp: now - elapsed,
        player1RemainingMs: 60_000,
      })
      const game = makeGame({ timerState: timer })

      gameRepo.findOne.mockResolvedValue(game)
      moveRepo.find.mockResolvedValue([])
      moveRepo.create.mockImplementation((d: any) => d)
      moveRepo.save.mockResolvedValue({})

      const state = await service.playMove('game-1', 0, 0, 'player1')
      // player1 should have ~57s left (within 500ms margin for test execution time)
      expect(state.timer!.player1RemainingMs).toBeLessThan(60_000)
      expect(state.timer!.player1RemainingMs).toBeGreaterThan(56_000)
    })

    it('clamps remaining time to 0, never goes negative', async () => {
      const { service, gameRepo, moveRepo } = getService()

      const now = Date.now()
      const timer = makeTimerState({
        activePlayer: 'player1',
        lastSyncTimestamp: now - 999_999, // way in the past
        player1RemainingMs: 1_000,
      })
      const game = makeGame({ timerState: timer })

      gameRepo.findOne.mockResolvedValue(game)
      moveRepo.find.mockResolvedValue([])
      moveRepo.create.mockImplementation((d: any) => d)
      moveRepo.save.mockResolvedValue({})

      const state = await service.playMove('game-1', 0, 0, 'player1')
      expect(state.timer!.player1RemainingMs).toBe(0)
    })

    it('returns null timer unchanged when no timer on game', async () => {
      const { service, gameRepo, moveRepo } = getService()

      const game = makeGame({ timerState: null })
      gameRepo.findOne.mockResolvedValue(game)
      moveRepo.find.mockResolvedValue([])
      moveRepo.create.mockImplementation((d: any) => d)
      moveRepo.save.mockResolvedValue({})

      const state = await service.playMove('game-1', 0, 0, 'player1')
      expect(state.timer).toBeNull()
    })
  })

  // ── timedOutWinner ─────────────────────────────────────────────────────────

  describe('timedOutWinner', () => {
    it('returns player2 as winner when player1 runs out of time', async () => {
      const { service, gameRepo, moveRepo } = getService()

      const now = Date.now()
      const timer = makeTimerState({
        activePlayer: 'player1',
        lastSyncTimestamp: now - 999_999,
        player1RemainingMs: 1, // will be consumed → 0
      })
      const game = makeGame({ timerState: timer })

      gameRepo.findOne.mockResolvedValue(game)
      moveRepo.find.mockResolvedValue([])
      moveRepo.create.mockImplementation((d: any) => d)
      moveRepo.save.mockResolvedValue({})
      fetchMock.mockResolvedValue({ ok: true })

      vi.mocked(checkWinner).mockReturnValue(null)
      vi.mocked(getOppositePlayer).mockReturnValue('player2')

      const state = await service.playMove('game-1', 0, 0, 'player1')
      expect(state.winner).toBe('player2')
      expect(state.status).toBe('finished')
    })

    it('returns null when neither player has timed out', async () => {
      // computeUpdatedTimer with healthy times → timedOutWinner returns null
      const { service, gameRepo, moveRepo } = getService()

      const timer = makeTimerState({ player1RemainingMs: 30_000, player2RemainingMs: 30_000, lastSyncTimestamp: Date.now() })
      const game = makeGame({ timerState: timer })

      gameRepo.findOne.mockResolvedValue(game)
      moveRepo.find.mockResolvedValue([])
      moveRepo.create.mockImplementation((d: any) => d)
      moveRepo.save.mockResolvedValue({})
      vi.mocked(checkWinner).mockReturnValue(null)

      const state = await service.playMove('game-1', 0, 0, 'player1')
      expect(state.winner).toBeNull()
    })
  })

  // ── decidePie ──────────────────────────────────────────────────────────────

  describe('decidePie', () => {
    it('throws 404 when game not found', async () => {
      const { service, gameRepo } = getService()
      gameRepo.findOne.mockResolvedValue(null)

      await expect(service.decidePie('missing', 'keep')).rejects.toMatchObject({ status: 404 })
    })

    it('throws 409 when game is not in pie-decision phase', async () => {
      const { service, gameRepo } = getService()
      const game = makeGame({ phase: 'playing' })
      gameRepo.findOne.mockResolvedValue(game)

      await expect(service.decidePie('game-1', 'keep')).rejects.toMatchObject({ status: 409 })
    })

    it('keeps board unchanged when decision is "keep"', async () => {
      const { service, gameRepo, moveRepo } = getService()
      const board = [
        [{ row: 0, col: 0, owner: 'player1' }, { row: 0, col: 1, owner: null }],
      ]
      const game = makeGame({ phase: 'pie-decision', boardState: board, currentTurn: 'player2' })
      const moves = [{ rowIndex: 0, colIndex: 0, playerColor: 'player1' }]

      gameRepo.findOne.mockResolvedValue(game)
      moveRepo.find.mockResolvedValue(moves)

      const state = await service.decidePie('game-1', 'keep')
      // board ownership of (0,0) should remain player1
      expect(state.board[0][0].owner).toBe('player1')
      expect(state.phase).toBe('playing')
    })

    it('swaps first-move ownership to player2 when decision is "swap"', async () => {
      const { service, gameRepo, moveRepo } = getService()
      const board = [
        [{ row: 0, col: 0, owner: 'player1' }, { row: 0, col: 1, owner: null }],
      ]
      const game = makeGame({ phase: 'pie-decision', boardState: board, currentTurn: 'player2' })
      const moves = [{ rowIndex: 0, colIndex: 0, playerColor: 'player1' }]

      gameRepo.findOne.mockResolvedValue(game)
      moveRepo.find.mockResolvedValue(moves)

      const state = await service.decidePie('game-1', 'swap')
      expect(state.board[0][0].owner).toBe('player2')
    })

    it('sets phase back to "playing" after decision', async () => {
      const { service, gameRepo, moveRepo } = getService()
      const game = makeGame({ phase: 'pie-decision', currentTurn: 'player2' })

      gameRepo.findOne.mockResolvedValue(game)
      moveRepo.find.mockResolvedValue([{ rowIndex: 0, colIndex: 0, playerColor: 'player1' }])

      const state = await service.decidePie('game-1', 'keep')
      expect(state.phase).toBe('playing')
    })

    it('updates timer activePlayer after decide-keep', async () => {
      const { service, gameRepo, moveRepo } = getService()
      const timer = makeTimerState({ activePlayer: null as any })
      const game = makeGame({ phase: 'pie-decision', timerState: timer, currentTurn: 'player2' })

      gameRepo.findOne.mockResolvedValue(game)
      moveRepo.find.mockResolvedValue([{ rowIndex: 1, colIndex: 1, playerColor: 'player1' }])

      const state = await service.decidePie('game-1', 'keep')
      expect(state.timer?.activePlayer).toBe('player2')
    })

    it('sets currentTurn to player1 when "swap" is chosen', async () => {
      const { service, gameRepo, moveRepo } = getService()
      const board = [[{ row: 0, col: 0, owner: 'player1' }]]
      const game = makeGame({ phase: 'pie-decision', boardState: board, currentTurn: 'player2' })

      gameRepo.findOne.mockResolvedValue(game)
      moveRepo.find.mockResolvedValue([{ rowIndex: 0, colIndex: 0, playerColor: 'player1' }])

      const state = await service.decidePie('game-1', 'swap')
      expect(state.currentTurn).toBe('player1')
    })
  })

  // ── isPieDecisionTrigger (inside playMove) ─────────────────────────────────

  describe('isPieDecisionTrigger (playMove)', () => {
    it('sets phase to pie-decision after the first move when pieRule is enabled', async () => {
      const { service, gameRepo, moveRepo } = getService()

      const game = makeGame({
        config: { mode: 'pvp-online', boardSize: 11, timerEnabled: false, pieRule: true },
        currentTurn: 'player1',
      })
      gameRepo.findOne.mockResolvedValue(game)
      moveRepo.find.mockResolvedValue([]) // 0 existing moves → first move
      moveRepo.create.mockImplementation((d: any) => ({ ...d, rowIndex: 0, colIndex: 0 }))
      moveRepo.save.mockResolvedValue({})
      vi.mocked(checkWinner).mockReturnValue(null)

      const state = await service.playMove('game-1', 0, 0, 'player1')
      expect(state.phase).toBe('pie-decision')
    })

    it('does NOT trigger pie-decision on the second move', async () => {
      const { service, gameRepo, moveRepo } = getService()

      const game = makeGame({
        config: { mode: 'pvp-online', boardSize: 11, timerEnabled: false, pieRule: true },
        currentTurn: 'player2',
      })
      gameRepo.findOne.mockResolvedValue(game)
      moveRepo.find.mockResolvedValue([{ rowIndex: 0, colIndex: 0 }]) // 1 existing move
      moveRepo.create.mockImplementation((d: any) => ({ ...d, rowIndex: 1, colIndex: 1 }))
      moveRepo.save.mockResolvedValue({})
      vi.mocked(checkWinner).mockReturnValue(null)

      const state = await service.playMove('game-1', 1, 1, 'player2')
      expect(state.phase).toBe('playing')
    })

    it('calls getBotPieDecision and decidePie when bot is the next player in pve+pieRule', async () => {
      const { service, gameRepo, moveRepo } = getService()

      const game = makeGame({
        config: { mode: 'pve', boardSize: 11, timerEnabled: false, pieRule: true, botLevel: 'medium' },
        players: {
          player1: { id: '1', name: 'human', color: 'player1', isBot: false },
          player2: { id: 'bot', name: 'Bot', color: 'player2', isBot: true },
        },
        currentTurn: 'player1',
      })

      gameRepo.findOne.mockResolvedValue(game)
      moveRepo.find.mockResolvedValue([])
      moveRepo.create.mockImplementation((d: any) => ({ ...d, rowIndex: 0, colIndex: 0 }))
      moveRepo.save.mockResolvedValue({})
      vi.mocked(checkWinner).mockReturnValue(null)
      vi.mocked(getOppositePlayer).mockReturnValue('player2')
      vi.mocked(getBotPieDecision).mockResolvedValue('keep')

      // decidePie will need the same game returned again
      gameRepo.findOne
        .mockResolvedValueOnce(game)   // playMove
        .mockResolvedValueOnce({ ...game, phase: 'pie-decision' }) // decidePie

      moveRepo.find
        .mockResolvedValueOnce([])  // playMove
        .mockResolvedValueOnce([{ rowIndex: 0, colIndex: 0, playerColor: 'player1' }]) // decidePie

      await service.playMove('game-1', 0, 0, 'player1')

      expect(getBotPieDecision).toHaveBeenCalled()
    })

    it('nullifies timer activePlayer when entering pie-decision phase', async () => {
      const { service, gameRepo, moveRepo } = getService()

      const timer = makeTimerState({ activePlayer: 'player1' })
      const game = makeGame({
        config: { mode: 'pvp-online', boardSize: 11, timerEnabled: true, timerSeconds: 60, pieRule: true },
        timerState: timer,
        currentTurn: 'player1',
      })

      gameRepo.findOne.mockResolvedValue(game)
      moveRepo.find.mockResolvedValue([])
      moveRepo.create.mockImplementation((d: any) => ({ ...d, rowIndex: 0, colIndex: 0 }))
      moveRepo.save.mockResolvedValue({})
      vi.mocked(checkWinner).mockReturnValue(null)

      const state = await service.playMove('game-1', 0, 0, 'player1')
      expect(state.phase).toBe('pie-decision')
      expect(state.timer?.activePlayer).toBeNull()
    })
  })

  // ── recordMatchForAllPlayers ───────────────────────────────────────────────

  describe('recordMatchForAllPlayers (via surrender)', () => {
    it('does nothing when winner is null', async () => {
      const { service } = getService()
      // Call the private method directly with a game that has no winner
      const gameWithNoWinner = makeGame({ status: 'finished', winner: null })
      await (service as any).recordMatchForAllPlayers(gameWithNoWinner, 'tok')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('calls internal stats endpoint for both pvp-online players on surrender', async () => {
      const { service, gameRepo, moveRepo } = getService()
      const game = makeGame({
        status: 'playing',
        config: { mode: 'pvp-online', boardSize: 11, timerEnabled: false },
        player1Id: 1,
        player2Id: 2,
      })
      gameRepo.findOne.mockResolvedValue(game)
      moveRepo.find.mockResolvedValue([])

      vi.mocked(getOppositePlayer).mockReturnValue('player2')

      await service.surrender('game-1', 'player1')

      expect(fetchMock).toHaveBeenCalledTimes(2)
      const urls = fetchMock.mock.calls.map((c: any) => c[0] as string)
      expect(urls.every((u: string) => u.includes('/api/stats/record/internal'))).toBe(true)
    })

    it('calls single pve stats endpoint using caller token', async () => {
      const { service, gameRepo, moveRepo } = getService()
      const game = makeGame({
        status: 'playing',
        config: { mode: 'pve', boardSize: 11, timerEnabled: false, botLevel: 'medium' },
        players: {
          player1: { id: '1', name: 'human', color: 'player1', isBot: false },
          player2: { id: 'bot', name: 'Bot', color: 'player2', isBot: true },
        },
        player1Id: 1,
        player2Id: null,
      })
      gameRepo.findOne.mockResolvedValue(game)
      moveRepo.find.mockResolvedValue([])
      vi.mocked(getOppositePlayer).mockReturnValue('player2')

      await service.surrender('game-1', 'player1', 'user-token')

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(url).toContain('/api/stats/record')
      expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer user-token')
    })

    it('does not call fetch for pvp-online when player IDs are missing', async () => {
      const { service, gameRepo, moveRepo } = getService()
      const game = makeGame({
        status: 'playing',
        config: { mode: 'pvp-online', boardSize: 11 },
        player1Id: null,
        player2Id: null,
      })
      gameRepo.findOne.mockResolvedValue(game)
      moveRepo.find.mockResolvedValue([])
      vi.mocked(getOppositePlayer).mockReturnValue('player2')

      await service.surrender('game-1', 'player1')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('does not record ranking for pvp-local mode', async () => {
      const { service, gameRepo, moveRepo } = getService()
      const game = makeGame({
        status: 'playing',
        config: { mode: 'pvp-local', boardSize: 11 },
      })
      gameRepo.findOne.mockResolvedValue(game)
      moveRepo.find.mockResolvedValue([])
      vi.mocked(getOppositePlayer).mockReturnValue('player2')

      await service.surrender('game-1', 'player1')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('does not record pve match when no caller token is provided', async () => {
      const { service, gameRepo, moveRepo } = getService()
      const game = makeGame({
        status: 'playing',
        config: { mode: 'pve', boardSize: 11, botLevel: 'easy' },
        players: {
          player1: { id: '1', name: 'human', color: 'player1', isBot: false },
          player2: { id: 'bot', name: 'Bot', color: 'player2', isBot: true },
        },
        player1Id: 1,
      })
      gameRepo.findOne.mockResolvedValue(game)
      moveRepo.find.mockResolvedValue([])
      vi.mocked(getOppositePlayer).mockReturnValue('player2')

      // No token passed
      await service.surrender('game-1', 'player1', undefined)
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })
})