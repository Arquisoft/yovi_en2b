import { describe, it, expect } from 'vitest'
import { getGameYPosition, getGameYPath, getGameYBoardDimensions } from './gameY'

describe('getGameYPosition', () => {
  it('apex cell (0,0) is centered horizontally', () => {
    const size = 4
    const cellSize = 30
    const apex = getGameYPosition(0, 0, cellSize, size)
    const baseLeft = getGameYPosition(size - 1, 0, cellSize, size)
    const baseRight = getGameYPosition(size - 1, size - 1, cellSize, size)

    // Apex should be horizontally centered between base-left and base-right
    const baseMidX = (baseLeft.x + baseRight.x) / 2
    expect(Math.abs(apex.x - baseMidX)).toBeLessThan(1)
  })

  it('cells in the same row have the same y', () => {
    const size = 5
    const y0 = getGameYPosition(2, 0, 30, size).y
    const y1 = getGameYPosition(2, 1, 30, size).y
    const y2 = getGameYPosition(2, 2, 30, size).y
    expect(y0).toBe(y1)
    expect(y1).toBe(y2)
  })

  it('y increases with row (apex at top)', () => {
    const size = 4
    const y0 = getGameYPosition(0, 0, 30, size).y
    const y1 = getGameYPosition(1, 0, 30, size).y
    const y2 = getGameYPosition(2, 0, 30, size).y
    expect(y0).toBeLessThan(y1)
    expect(y1).toBeLessThan(y2)
  })
})

describe('getGameYPath', () => {
  it('returns a valid SVG path string', () => {
    const path = getGameYPath(30)
    expect(path).toMatch(/^M /)
    expect(path).toMatch(/ Z$/)
    expect(path.split(' L ').length).toBe(6)
  })

  it('produces a larger path for a larger cell size', () => {
    const small = getGameYPath(10)
    const large = getGameYPath(40)
    // Larger cell size → larger coordinate values in the path
    const firstCoord = (p: string) => parseFloat(p.replace('M ', '').split(',')[0])
    expect(Math.abs(firstCoord(large))).toBeGreaterThan(Math.abs(firstCoord(small)))
  })
})

describe('getGameYBoardDimensions', () => {
  it('width and height are positive', () => {
    const { width, height } = getGameYBoardDimensions(5, 30)
    expect(width).toBeGreaterThan(0)
    expect(height).toBeGreaterThan(0)
  })

  it('larger board produces larger dimensions', () => {
    const small = getGameYBoardDimensions(4, 30)
    const large = getGameYBoardDimensions(9, 30)
    expect(large.width).toBeGreaterThan(small.width)
    expect(large.height).toBeGreaterThan(small.height)
  })

  it('larger cell size produces larger dimensions for the same board', () => {
    const d1 = getGameYBoardDimensions(5, 20)
    const d2 = getGameYBoardDimensions(5, 40)
    expect(d2.width).toBeGreaterThan(d1.width)
    expect(d2.height).toBeGreaterThan(d1.height)
  })
})
