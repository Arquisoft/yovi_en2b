import 'reflect-metadata';
import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import { TestDataSource } from './testDatabase';

vi.mock('../src/config/database', () => ({
  AppDataSource: TestDataSource
}));

async function waitForDatabase(maxRetries = 20) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      if (!TestDataSource.isInitialized) {
        await TestDataSource.initialize();
      }
      console.log('Test database connected');
      return;
    } catch (error) {
      if (i === maxRetries - 1) {
        console.error('Failed to connect:', error);
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

beforeAll(async () => {
  await waitForDatabase();
}, 60000);

afterAll(async () => {
  if (TestDataSource.isInitialized) {
    await TestDataSource.destroy();
    console.log('✓ Test database disconnected');
  }
});

afterEach(async () => {
  const entities = TestDataSource.entityMetadatas;
  for (const entity of entities) {
    const repository = TestDataSource.getRepository(entity.name);
    await repository.clear();
  }
});
