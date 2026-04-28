import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { BoardCell, BotLevel, PlayerColor } from '../types/game'

const fetchMock = vi.fn()
global.fetch = fetchMock

const mockRules = {
  serializeBoardForBot: vi.fn(() => ({ board: 'YEN' })),
  deserializeBotMove: vi.fn(() => ({ row: 2, col: 3 })),
  deserializeBotPieDecision: vi.fn(() => 'keep' as const),
  botMoveEndpoint: vi.fn(() => '/v1/ybot/choose/fast_bot'),
  botPieOpeningEndpoint: vi.fn(() => '/v1/ybot/pie-opening/fast_bot'),
  botPieDecideEndpoint: vi.fn(() => '/v1/ybot/pie-decide/fast_bot'),
}

import { getBotMove, getBotPieOpening, getBotPieDecision } from '../services/BotService'

const board: BoardCell[][] = []
const boardSize = 5
const currentTurn: PlayerColor = 'player1'
const botLevel: BotLevel = 'medium'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getBotMove', () => {
  it('calls the engine and returns deserialized move', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ coords: { x: 2, y: 3, z: 0 } }),
    })
    const result = await getBotMove(mockRules as any, board, boardSize, currentTurn, botLevel)
    expect(result).toEqual({ row: 2, col: 3 })
    expect(mockRules.botMoveEndpoint).toHaveBeenCalledWith(botLevel)
  })

  it('throws when engine returns non-ok status', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 })
    await expect(getBotMove(mockRules as any, board, boardSize, currentTurn, botLevel)).rejects.toThrow(
      'Bot engine error'
    )
  })
})

describe('getBotPieOpening', () => {
  it('calls the pie-opening endpoint and returns deserialized move', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ coords: { x: 1, y: 1, z: 0 } }),
    })
    const result = await getBotPieOpening(mockRules as any, board, boardSize, currentTurn, botLevel)
    expect(result).toEqual({ row: 2, col: 3 })
    expect(mockRules.botPieOpeningEndpoint).toHaveBeenCalledWith(botLevel)
  })

  it('throws when engine returns non-ok status', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 })
    await expect(
      getBotPieOpening(mockRules as any, board, boardSize, currentTurn, botLevel)
    ).rejects.toThrow('Bot engine error')
  })
})

describe('getBotPieDecision', () => {
  it('calls the pie-decide endpoint and returns deserialized decision', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ decision: 'keep' }),
    })
    const result = await getBotPieDecision(mockRules as any, board, boardSize, currentTurn, botLevel)
    expect(result).toBe('keep')
    expect(mockRules.botPieDecideEndpoint).toHaveBeenCalledWith(botLevel)
  })

  it('throws when engine returns non-ok status', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400 })
    await expect(
      getBotPieDecision(mockRules as any, board, boardSize, currentTurn, botLevel)
    ).rejects.toThrow('Bot engine error')
  })
})
