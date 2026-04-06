import 'reflect-metadata';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Game } from './Game';
import type { PlayerColor } from '../types/game';

@Entity('game_moves')
export class GameMove {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Game, (game) => game.moves, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'game_id' })
  game!: Game;

  @Column({
    type: 'enum',
    enum: ['player1', 'player2'],
    name: 'player_color',
  })
  playerColor!: PlayerColor;

  @Column({ type: 'int', name: 'row_index' })
  rowIndex!: number;

  @Column({ type: 'int', name: 'col_index' })
  colIndex!: number;

  @Column({ type: 'bigint', name: 'move_timestamp' })
  moveTimestamp!: number;

  @CreateDateColumn({ name: 'played_at' })
  playedAt!: Date;
}
