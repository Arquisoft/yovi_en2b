import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Game } from '../entities/Game';
import { GameMove } from '../entities/GameMove';

export const TestDataSource = new DataSource({
  type: 'mariadb',
  host: 'localhost',
  port: 3306,
  username: 'test_user',
  password: 'test_password',
  database: 'users_db',
  entities: [Game, GameMove],
  synchronize: true,
  logging: false,
});
