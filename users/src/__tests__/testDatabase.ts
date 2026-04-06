import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from '../entities/User';
import { MatchRecord } from '../entities/MatchRecord';

export const TestDataSource = new DataSource({
  type: 'mariadb',
  host: 'localhost',
  port: 3306,
  username: 'test_user',
  password: 'test_password',
  database: 'users_db',
  entities: [User, MatchRecord],
  synchronize: true,
  logging: false
});
