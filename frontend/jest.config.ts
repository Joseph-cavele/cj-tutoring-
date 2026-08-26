import type { Config } from 'jest';
import nextJest from 'next/jest.js';

/**
 * next/jest wires up the SWC transform, the tsconfig path aliases (@/...) and
 * env loading, so no separate babel or ts-jest setup is needed.
 */
const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  // node, not jsdom: these suites cover server-side logic - slot arithmetic,
  // booking rules and validation schemas - none of which touch the DOM.
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/lib/**/*.ts',
    'src/validations/**/*.ts',
    '!src/lib/**/index.ts',
  ],
};

export default createJestConfig(config);
