module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/Backend/tests/**/*.test.ts'],
  // Help Jest find its way when running on network shares
  rootDir: '.',
};
