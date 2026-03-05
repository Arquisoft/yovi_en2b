export interface GameState {
    size: number;
    turn: 'B' | 'R';
    players: string[];
    layout: string;
    status: 'active' | 'finished';
}