import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { BoardCell, PieDecision, PlayerColor } from '../types/game'

// ── Hoisted mock objects (must be created before vi.mock is hoisted) ──────────
const { mockRules } = vi.hoisted(() => {
  const mockRules = {
    createBoard: vi.fn((): BoardCell[][] => []),
    applyMove: vi.fn((board: BoardCell[][]) => board),
    checkWinner: vi.fn((): PlayerColor | null => null),
    isValidMove: vi.fn((): boolean => true),
    getNeighbors: vi.fn((): Array<{ row: number; col: number }> => []),
    supportsPieRule: true,
    botMoveEndpoint: vi.fn((): string => '/v1/ybot/choose/fast_bot'),
    botPieOpeningEndpoint: vi.fn((): string => '/v1/ybot/pie-opening/fast_bot'),
    botPieDecideEndpoint: vi.fn((): string => '/v1/ybot/pie-decide/fast_bot'),
    serializeBoardForBot: vi.fn((): unknown => ({})),
    deserializeBotMove: vi.fn((): { row: number; col: number } => ({ row: 3, col: 1 })),
    deserializeBotPieDecision: vi.fn((): PieDecision => 'keep'),
    variant: 'y' as const,
  }
  return { mockRules }
})

// ── Module mocks ──────────────────────────────────────────────────────────────

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

vi.mock('../rules/registry', () => ({
  getRules: vi.fn(() => mockRules),
}))

vi.mock('../utils/gameY', () => ({
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
import { getOppositePlayer } from '../utils/gameY'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeTimerState(overrides: Record<string, unknown> = {}) {
  return {
    player1RemainingMs: 60_000,
    player2RemainingMs: 60_000,
    activePlayer: 'player1' as const,
    lastSyncTimestamp: Date.now(),
    ...overrides,
  }
}

function makeGame(overrides: Record<string, unknown> = {}) {
  return {
    id: 'game-1',
    status: 'playing',
    phase: 'playing',
    config: { mode: 'pvp-online', boardSize: 11, timerEnabled: false, timerSeconds: null, pieRule: false },
    boardState: [] as BoardCell[][],
    players: {
      player1: { id: '1', name: 'p1', color: 'player1' },
      player2: { id: '2', name: 'p2', color: 'player2' },
    },
    currentTurn: 'player1' as PlayerColor,
    winner: null as PlayerColor | null,
    timerState: null,
    player1Id: 1,
    player2Id: 2,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

function makeRepo(defaults: Record<string, unknown> = {}) {
  return {
    findOne: vi.fn().mockResolvedValue(null),
    find: vi.fn().mockResolvedValue([]),
    findAndCount: vi.fn().mockResolvedValue([[], 0]),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn((d: unknown) => ({ ...(d as object) })),
    save: vi.fn(async (e: unknown) => e),
    createQueryBuilder: vi.fn(),
    ...defaults,
  }
}

function getService() {
  let callCount = 0
  const gameRepo = makeRepo()
  const moveRepo = makeRepo()

  vi.mocked(AppDataSource.getRepository).mockImplementation(
    (() => {
      callCount++
      return callCount === 1 ? gameRepo : moveRepo
    }) as unknown as typeof AppDataSource.getRepository,
  )

  const service = new GameService()
  return { service, gameRepo, moveRepo }
}

// ── Suite ──────────────────────────────────────────────────────────────────────

describe('GameService – additional coverage', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    // Restore default mock behaviour after each clearAllMocks
    mockRules.createBoard.mockReturnValue([])
    mockRules.applyMove.mockImplementation((board: BoardCell[][]) => board)
    mockRules.checkWinner.mockReturnValue(null)
    mockRules.isValidMove.mockReturnValue(true)
    mockRules.deserializeBotMove.mockReturnValue({ row: 3, col: 1 })
    mockRules.deserializeBotPieDecision.mockReturnValue('keep')
    mockRules.serializeBoardForBot.mockReturnValue({})
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
      const saved = gameRepo.save.mock.calls[0][0] as ReturnType<typeof makeGame>
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

      const saved = gameRepo.save.mock.calls[0][0] as { players: { player2: Record<string, unknown> } }
      expect(saved.players.player2['extra']).toBe('keep-me')
    })
  })

  // ── computeUpdatedTimer (via playMove observable side-effects) ─────────────

  describe('computeUpdatedTimer', () => {
    it('does not deduct time when activePlayer does not match the mover', async () => {
      const { service, gameRepo, moveRepo } = getService()

      const now = Date.now()
      const timer = makeTimerState({ activePlayer: 'player2', lastSyncTimestamp: now - 5_000, player2RemainingMs: 60_000 })
      const game = makeGame({ timerState: timer })

      gameRepo.findOne.mockResolvedValue(game)
      moveRepo.find.mockResolvedValue([])
      moveRepo.create.mockImplementation((d: unknown) => ({ ...(d as object) }))
      moveRepo.save.mockResolvedValue({})

      const state = await service.playMove('game-1', 0, 0, 'player1')
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
      moveRepo.create.mockImplementation((d: unknown) => ({ ...(d as object) }))
      moveRepo.save.mockResolvedValue({})

      const state = await service.playMove('game-1', 0, 0, 'player1')
      expect(state.timer!.player1RemainingMs).toBeLessThan(60_000)
      expect(state.timer!.player1RemainingMs).toBeGreaterThan(56_000)
    })

    it('rejects with 409 when the active player timer has already expired', async () => {
      const { service, gameRepo } = getService()

      const now = Date.now()
      const timer = makeTimerState({
        activePlayer: 'player1',
        lastSyncTimestamp: now - 999_999,
        player1RemainingMs: 1_000,
      })
      const game = makeGame({ timerState: timer })
      gameRepo.findOne.mockResolvedValue(game)

      await expect(service.playMove('game-1', 0, 0, 'player1'))
        .rejects.toMatchObject({ message: 'Time expired', status: 409 })
    })

    it('returns null timer unchanged when game has no timer', async () => {
      const { service, gameRepo, moveRepo } = getService()

      const game = makeGame({ timerState: null })
      gameRepo.findOne.mockResolvedValue(game)
      moveRepo.find.mockResolvedValue([])
      moveRepo.create.mockImplementation((d: unknown) => ({ ...(d as object) }))
      moveRepo.save.mockResolvedValue({})

      const state = await service.playMove('game-1', 0, 0, 'player1')
      expect(state.timer).toBeNull()
    })
  })

  // ── timedOutWinner / timer guard ──────────────────────────────────────────

  describe('timer expiry guard', () => {
    it('rejects with 409 when player1 clock has run to zero before the move', async () => {
      const { service, gameRepo } = getService()

      const timer = makeTimerState({
        activePlayer: 'player1',
        lastSyncTimestamp: Date.now() - 999_999,
        player1RemainingMs: 1,
      })
      const game = makeGame({ timerState: timer })
      gameRepo.findOne.mockResolvedValue(game)

      await expect(service.playMove('game-1', 0, 0, 'player1'))
        .rejects.toMatchObject({ message: 'Time expired', status: 409 })
    })

    it('allows a move when neither player has timed out', async () => {
      const { service, gameRepo, moveRepo } = getService()

      const timer = makeTimerState({ player1RemainingMs: 30_000, player2RemainingMs: 30_000, lastSyncTimestamp: Date.now() })
      const game = makeGame({ timerState: timer })

      gameRepo.findOne.mockResolvedValue(game)
      moveRepo.find.mockResolvedValue([])
      moveRepo.create.mockImplementation((d: unknown) => ({ ...(d as object) }))
      moveRepo.save.mockResolvedValue({})
      mockRules.checkWinner.mockReturnValue(null)

      const state = await service.playMove('game-1', 0, 0, 'player1')
      expect(state.winner).toBeNull()
    })

    it('does not block moves when there is no timer', async () => {
      const { service, gameRepo, moveRepo } = getService()

      const game = makeGame({ timerState: null })
      gameRepo.findOne.mockResolvedValue(game)
      moveRepo.find.mockResolvedValue([])
      moveRepo.create.mockImplementation((d: unknown) => ({ ...(d as object) }))
      moveRepo.save.mockResolvedValue({})
      mockRules.checkWinner.mockReturnValue(null)

      const state = await service.playMove('game-1', 0, 0, 'player1')
      expect(state.timer).toBeNull()
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
      const board: BoardCell[][] = [
        [{ row: 0, col: 0, owner: 'player1' }, { row: 0, col: 1, owner: null }],
      ]
      const game = makeGame({ phase: 'pie-decision', boardState: board, currentTurn: 'player2' })
      const moves = [{ rowIndex: 0, colIndex: 0, playerColor: 'player1' }]

      gameRepo.findOne.mockResolvedValue(game)
      moveRepo.find.mockResolvedValue(moves)

      const state = await service.decidePie('game-1', 'keep')
      expect(state.board[0][0].owner).toBe('player1')
      expect(state.phase).toBe('playing')
    })

    it('swaps first-move ownership to player2 when decision is "swap"', async () => {
      const { service, gameRepo, moveRepo } = getService()
      const board: BoardCell[][] = [
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
      const timer = makeTimerState({ activePlayer: null as unknown as PlayerColor })
      const game = makeGame({ phase: 'pie-decision', timerState: timer, currentTurn: 'player2' })

      gameRepo.findOne.mockResolvedValue(game)
      moveRepo.find.mockResolvedValue([{ rowIndex: 1, colIndex: 1, playerColor: 'player1' }])

      const state = await service.decidePie('game-1', 'keep')
      expect(state.timer?.activePlayer).toBe('player2')
    })

    it('sets currentTurn to player1 when "swap" is chosen', async () => {
      const { service, gameRepo, moveRepo } = getService()
      const board: BoardCell[][] = [[{ row: 0, col: 0, owner: 'player1' }]]
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
      moveRepo.find.mockResolvedValue([])
      moveRepo.create.mockImplementation((d: unknown) => ({ ...(d as object), rowIndex: 0, colIndex: 0 }))
      moveRepo.save.mockResolvedValue({})
      mockRules.checkWinner.mockReturnValue(null)

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
      moveRepo.find.mockResolvedValue([{ rowIndex: 0, colIndex: 0 }])
      moveRepo.create.mockImplementation((d: unknown) => ({ ...(d as object), rowIndex: 1, colIndex: 1 }))
      moveRepo.save.mockResolvedValue({})
      mockRules.checkWinner.mockReturnValue(null)

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

      gameRepo.findOne
        .mockResolvedValueOnce(game)
        .mockResolvedValueOnce({ ...game, phase: 'pie-decision' })

      moveRepo.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ rowIndex: 0, colIndex: 0, playerColor: 'player1' }])

      moveRepo.create.mockImplementation((d: unknown) => ({ ...(d as object), rowIndex: 0, colIndex: 0 }))
      moveRepo.save.mockResolvedValue({})
      mockRules.checkWinner.mockReturnValue(null)
      vi.mocked(getOppositePlayer).mockReturnValue('player2')
      vi.mocked(getBotPieDecision).mockResolvedValue('keep')

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
      moveRepo.create.mockImplementation((d: unknown) => ({ ...(d as object), rowIndex: 0, colIndex: 0 }))
      moveRepo.save.mockResolvedValue({})
      mockRules.checkWinner.mockReturnValue(null)

      const state = await service.playMove('game-1', 0, 0, 'player1')
      expect(state.phase).toBe('pie-decision')
      expect(state.timer?.activePlayer).toBeNull()
    })
  })

  // ── recordMatchForAllPlayers ───────────────────────────────────────────────

  describe('recordMatchForAllPlayers (via surrender)', () => {
    it('does nothing when winner is null', async () => {
      const { service } = getService()
      const gameWithNoWinner = makeGame({ status: 'finished', winner: null })
      await (service as unknown as { recordMatchForAllPlayers: (g: unknown, t: unknown) => Promise<void> })
        .recordMatchForAllPlayers(gameWithNoWinner, 'tok')
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
      const urls = fetchMock.mock.calls.map((c: unknown[]) => c[0] as string)
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

      await service.surrender('game-1', 'player1', undefined)
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  // ── getUserGames ───────────────────────────────────────────────────────────

  describe('getUserGames', () => {
    function makeQbChain(rawRows: { gameId: string; cnt: string }[] = []) {
      const qb: Record<string, unknown> = {}
      qb['innerJoin'] = vi.fn(() => qb)
      qb['select'] = vi.fn(() => qb)
      qb['addSelect'] = vi.fn(() => qb)
      qb['where'] = vi.fn(() => qb)
      qb['groupBy'] = vi.fn(() => qb)
      qb['getRawMany'] = vi.fn().mockResolvedValue(rawRows)
      return qb
    }

    it('queries both player1Id and player2Id (OR condition)', async () => {
      const { service, gameRepo, moveRepo } = getService()
      gameRepo.findAndCount = vi.fn().mockResolvedValue([[], 0])
      gameRepo.count = vi.fn().mockResolvedValue(0)
      moveRepo.createQueryBuilder = vi.fn().mockReturnValue(makeQbChain())

      await service.getUserGames(7, 1)

      const opts = (gameRepo.findAndCount as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(opts.where).toEqual([{ player1Id: 7 }, { player2Id: 7 }])
    })

    it('includes a game where the user is player2', async () => {
      const { service, gameRepo, moveRepo } = getService()
      const game = makeGame({ player2Id: 42 })
      gameRepo.findAndCount = vi.fn().mockResolvedValue([[game], 1])
      gameRepo.count = vi.fn().mockResolvedValue(0)
      moveRepo.createQueryBuilder = vi.fn().mockReturnValue(makeQbChain([{ gameId: 'game-1', cnt: '3' }]))

      const result = await service.getUserGames(42, 1)

      expect(result.games).toHaveLength(1)
      expect(result.games[0].moveCount).toBe(3)
    })

    it('returns empty paginated result when no games', async () => {
      const { service, gameRepo } = getService()
      gameRepo.findAndCount = vi.fn().mockResolvedValue([[], 0])
      gameRepo.count = vi.fn().mockResolvedValue(0)

      const result = await service.getUserGames(1, 1)

      expect(result.games).toHaveLength(0)
      expect(result.total).toBe(0)
      expect(result.totalFinished).toBe(0)
      expect(result.totalPages).toBe(1)
    })

    it('totalFinished counts finished games for both player roles', async () => {
      const { service, gameRepo } = getService()
      gameRepo.findAndCount = vi.fn().mockResolvedValue([[], 0])
      gameRepo.count = vi.fn().mockResolvedValue(5)

      await service.getUserGames(9, 1)

      const countOpts = (gameRepo.count as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(countOpts.where).toEqual([
        { player1Id: 9, status: 'finished' },
        { player2Id: 9, status: 'finished' },
      ])
    })

    it('calculates pagination metadata correctly', async () => {
      const { service, gameRepo, moveRepo } = getService()
      const games = Array.from({ length: 5 }, (_, i) => makeGame({ id: `g${i}` }))
      gameRepo.findAndCount = vi.fn().mockResolvedValue([games, 12])
      gameRepo.count = vi.fn().mockResolvedValue(8)
      moveRepo.createQueryBuilder = vi.fn().mockReturnValue(makeQbChain([]))

      const result = await service.getUserGames(1, 1)

      expect(result.total).toBe(12)
      expect(result.totalFinished).toBe(8)
      expect(result.totalPages).toBe(3)
      expect(result.page).toBe(1)
    })
  })
})
