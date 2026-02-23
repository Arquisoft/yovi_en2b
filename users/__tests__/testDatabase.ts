import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from '../src/entities/User';

export const TestDataSource = new DataSource({
  type: 'mariadb',
  host: 'localhost',
  port: 3306,
  username: 'test_user',
  password: process.env.DB_PASSWORD || 'test_password',
  database: 'users_db',
  entities: [User],
  synchronize: true,
  logging: false
});
