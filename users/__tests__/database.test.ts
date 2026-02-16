// __tests__/AppDataSource.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SnakeCaseNamingStrategy } from '../src/config/SnakeCaseNamingStrategy';
import { User } from '../src/entities/User';
import type { DataSourceOptions } from 'typeorm';

describe('AppDataSource Configuration', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('should use environment variables for database configuration', async () => {
        process.env.DB_HOST = 'test-host';
        process.env.DB_PORT = '3307';
        process.env.DB_USER = 'test-user';
        process.env.DB_PASSWORD = 'test-pass';
        process.env.DB_NAME = 'test-db';
        process.env.NODE_ENV = 'production';

        const { AppDataSource } = await import('../src/config/database');
        const options = AppDataSource.options as any;

        expect(options.host).toBe('test-host');
        expect(options.port).toBe(3307);
        expect(options.username).toBe('test-user');
        expect(options.password).toBe('test-pass');
        expect(options.database).toBe('test-db');
        expect(options.synchronize).toBe(false);
    });

    it('should use default values when environment variables are not set', async () => {
        delete process.env.DB_HOST;
        delete process.env.DB_PORT;

        const { AppDataSource } = await import('../src/config/database');
        const options = AppDataSource.options as any;

        expect(options.host).toBe('localhost');
        expect(options.port).toBe(3306);
    });

    it('should enable synchronize in development mode', async () => {
        process.env.NODE_ENV = 'development';

        const { AppDataSource } = await import('../src/config/database');
        const options = AppDataSource.options as any;

        expect(options.synchronize).toBe(true);
    });

    it('should have correct database type and entities', async () => {
        const { AppDataSource } = await import('../src/config/database');

        expect(AppDataSource.options.type).toBe('mariadb');
        expect(AppDataSource.options.entities).toContain(User);
        expect(AppDataSource.options.logging).toBe(false);
    });

    it('should use SnakeCaseNamingStrategy', async () => {
        const { AppDataSource } = await import('../src/config/database');

        expect(AppDataSource.options.namingStrategy).toBeInstanceOf(SnakeCaseNamingStrategy);
    });
});
