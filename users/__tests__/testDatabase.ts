import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from '../src/entities/User';

export const TestDataSource = new DataSource({
  type: 'mariadb',
  host: 'localhost',
  port: 3307,
  username: 'test_user',
  password: process.env.TEST_DB_PASSWORD,
  database: 'test_db',
  entities: [User],
  synchronize: true,
  logging: false,
  dropSchema: true
});
