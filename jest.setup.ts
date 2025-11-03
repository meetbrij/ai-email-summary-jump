import '@testing-library/jest-dom'
import { loadEnvConfig } from '@next/env'

// Load environment variables for tests
loadEnvConfig(process.cwd())

// Set test environment variables
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long-for-testing-purposes'
process.env.NEXTAUTH_SECRET = 'test-nextauth-secret'
process.env.NEXTAUTH_URL = 'http://localhost:3000'
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db'

// Mock console methods to reduce noise in tests (optional)
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  // Keep log for debugging
  log: console.log,
}
