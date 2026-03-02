/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Scanăm atât testele backend cât și cele frontend (logică pură, fără DOM)
  roots: [
    '<rootDir>/src',
    '<rootDir>/../frontend/src/__tests__',
  ],
  testMatch: ['**/*.test.ts'],
  modulePathIgnorePatterns: ['dist'],
  // ts-jest poate compila TypeScript atât din backend cât și din frontend
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        // Setări care să funcționeze pentru ambele proiecte
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        target: 'ES2022',
        module: 'commonjs',
      },
    }],
  },
};
