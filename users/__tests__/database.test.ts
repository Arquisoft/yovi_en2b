// __tests__/database.test.ts
import { describe, it, expect } from 'vitest';
import { AppDataSource } from '../src/config/database';
import { User } from '../src/entities/User';

describe('AppDataSource Configuration', () => {
    it('should have correct database type', () => {
        expect(AppDataSource.options.type).toBe('mariadb');
    });

    it('should include User entity', () => {
        expect(AppDataSource.options.entities).toContain(User);
    });

    it('should have logging disabled', () => {
        expect(AppDataSource.options.logging).toBe(false);
    });

    it('should have valid connection options structure', () => {
        const options = AppDataSource.options as any;

        expect(options.host).toBeDefined();
        expect(options.port).toBeGreaterThan(0);
        expect(options.database).toBeDefined();
        expect(typeof options.synchronize).toBe('boolean');
    });
});
