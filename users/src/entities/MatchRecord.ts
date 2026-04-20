import 'reflect-metadata';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from './User';

@Entity('match_records')
export class MatchRecord {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'int', name: 'user_id' })
  userId!: number;

  @Column({ type: 'varchar', length: 50 })
  opponentName!: string;

  @Column({ type: 'enum', enum: ['win', 'loss'] })
  result!: 'win' | 'loss';

  @Column({ type: 'int', unsigned: true })
  durationSeconds!: number;

  /**
   * Optional game mode used for difficulty-based ranking.
   * e.g. 'pve-easy', 'pve-medium', 'pve-hard', 'pvp-local', 'pvp-online'
   * Nullable for backwards compatibility with existing records.
   */
  @Column({ type: 'varchar', length: 30, nullable: true, name: 'game_mode' })
  gameMode!: string | null;

  @CreateDateColumn({ name: 'played_at' })
  playedAt!: Date;
}