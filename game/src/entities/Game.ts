import 'reflect-metadata';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { GameMove } from './GameMove';
import type { GameConfig, GameStatus, PlayerColor, BoardCell, Player, TimerState } from '../types/game';

@Entity('games')
export class Game {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'int', name: 'player1_id' })
  player1Id!: number;

  @Column({ type: 'simple-json' })
  config!: GameConfig;

  @Column({
    type: 'enum',
    enum: ['waiting', 'playing', 'finished', 'abandoned'],
    default: 'playing',
  })
  status!: GameStatus;

  @Column({ type: 'simple-json', name: 'board_state' })
  boardState!: BoardCell[][];

  @Column({ type: 'simple-json' })
  players!: { player1: Player; player2: Player };

  @Column({
    type: 'enum',
    enum: ['player1', 'player2'],
    default: 'player1',
    name: 'current_turn',
  })
  currentTurn!: PlayerColor;

  @Column({
    type: 'enum',
    enum: ['player1', 'player2'],
    nullable: true,
    default: null,
  })
  winner!: PlayerColor | null;

  @Column({ type: 'simple-json', nullable: true, name: 'timer_state' })
  timerState!: TimerState | null;

  @OneToMany(() => GameMove, (move) => move.game, { eager: false })
  moves!: GameMove[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
