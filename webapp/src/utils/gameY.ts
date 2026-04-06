const SQRT3 = Math.sqrt(3)

/**
 * Calculate cell center position for SVG rendering.
 * Uses pointy-top hexagons on a centered equilateral triangular board.
 *
 * Row 0 = apex (1 cell), Row size-1 = base (size cells).
 * Each row is horizontally centered, forming a proper equilateral triangle.
 */
export function getGameYPosition(
  row: number,
  col: number,
  cellSize: number,
  size: number
): { x: number; y: number } {
  const cellWidth = SQRT3 * cellSize       // pointy-top: w = sqrt(3) * r
  const cellHeight = 2 * cellSize          // pointy-top: h = 2 * r
  const vertSpacing = cellHeight * 0.75    // vertical distance between row centers
  const padding = cellSize

  // Centering offset: shorter rows (near apex) are shifted right so the
  // triangle is centered, not left-aligned into a parallelogram.
  const centeringOffset = (size - 1 - row) * (cellWidth / 2)

  // x and y are cell centers, so add half-cell offsets
  const x = centeringOffset + col * cellWidth + cellWidth / 2 + padding
  const y = row * vertSpacing + cellSize + padding

  return { x, y }
}

/**
 * Generate SVG polygon points for a pointy-top hexagon centered at (0, 0).
 */
export function getGameYPath(cellSize: number): string {
  const points: string[] = []
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i - 30
    const angleRad = (Math.PI / 180) * angleDeg
    const x = cellSize * Math.cos(angleRad)
    const y = cellSize * Math.sin(angleRad)
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`)
  }
  return `M ${points.join(' L ')} Z`
}

/**
 * Calculate total SVG canvas dimensions for a board of the given size.
 */
export function getGameYBoardDimensions(
  size: number,
  cellSize: number
): { width: number; height: number } {
  const cellWidth = SQRT3 * cellSize
  const cellHeight = 2 * cellSize
  const vertSpacing = cellHeight * 0.75
  const padding = cellSize

  // Width: the base row (size cells) spans size cell widths plus padding on both sides
  const width = size * cellWidth + padding * 2

  // Height: (size-1) vertical steps plus one full cell height plus padding on both sides
  const height = (size - 1) * vertSpacing + cellHeight + padding * 2

  return { width, height }
}
