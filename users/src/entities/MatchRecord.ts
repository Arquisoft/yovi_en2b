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

  @Column({ type: 'varchar', length: 20, default: 'pve-medium' })
  gameMode!: string;

  @CreateDateColumn({ name: 'played_at' })
  playedAt!: Date;
}