import { DataSource } from 'typeorm';
import { User } from '../entities/User';
import { SnakeCaseNamingStrategy } from './SnakeCaseNamingStrategy';

export const AppDataSource = new DataSource({
  type: 'mariadb',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [User],
  synchronize: process.env.NODE_ENV === 'development',
  logging: false,
  namingStrategy: new SnakeCaseNamingStrategy()
});
