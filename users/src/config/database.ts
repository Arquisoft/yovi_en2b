import { DataSource } from 'typeorm';
import { User } from '../entities/User';
import { SnakeCaseNamingStrategy } from './SnakeCaseNamingStrategy';

export const AppDataSource = new DataSource({
  type: 'mariadb',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USER || 'test_user',
  password: process.env.DB_PASSWORD || 'test_password',
  database: process.env.DB_NAME || 'users_db',
  entities: [User],
  synchronize: process.env.NODE_ENV === 'development',
  logging: false,
  namingStrategy: new SnakeCaseNamingStrategy()
});
