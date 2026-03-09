import type { BoardCell, PlayerColor } from '@/types'

interface YEN {
    size: number
    turn: number
    players: ['B', 'R']
    layout: string
}

interface Coords {
    x: number
    y: number
    z: number
}

/**
 * Convierte el board[][] + turno al formato YEN que espera el bot de Rust
 */
export function boardToYEN(
    board: BoardCell[][],
    size: number,
    currentTurn: PlayerColor
): YEN {
    const rows: string[] = []

    for (let row = 0; row < size; row++) {
        let rowStr = ''
        for (let col = 0; col <= row; col++) {
            const cell = board[row]?.[col]
            if (!cell || cell.owner === null) {
                rowStr += '.'
            } else {
                rowStr += cell.owner === 'player1' ? 'B' : 'R'
            }
        }
        rows.push(rowStr)
    }

    return {
        size,
        turn: currentTurn === 'player1' ? 0 : 1,
        players: ['B', 'R'],
        layout: rows.join('/'),
    }
}

/**
 * Convierte coordenadas baricéntricas del bot a row/col del tablero
 * Usando Coordinates::to_index(row, col) = index → Coordinates::from_index(index)
 */
export function coordsToRowCol(coords: Coords, boardSize: number): { row: number; col: number } {
    const row = (boardSize - 1) - coords.x
    const col = coords.y
    return { row, col }
}
