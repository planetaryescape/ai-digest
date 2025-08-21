# Frontend Test Suite

## Overview

Comprehensive test coverage for the AI Digest frontend, including:
- Unit tests for API routes
- Component tests with React Testing Library
- Integration tests for Step Functions workflow
- Security tests for authentication and authorization
- Edge case and error scenario testing

## Running Tests

### With Bun (default)
```bash
bun test                 # Run all tests in watch mode
bun test:run            # Run tests once
bun test:coverage       # Run with coverage report
```

### With Node.js (fallback for MSW compatibility)
If you encounter MSW (Mock Service Worker) compatibility issues with Bun:
```bash
npm run test:node       # Run tests with Node.js
npm run test:ci         # Run tests for CI/CD with verbose output
```

## Known Issues

### MSW + Bun Runtime Compatibility
MSW v2.10.5 may have compatibility issues with Bun's runtime. If you encounter errors like:
- `SyntaxError: Export named 'HTTPParser' not found`
- Request/Response API issues

**Solutions:**
1. Use Node.js fallback: `npm run test:node`
2. Run tests with Bun's Node compatibility: `bun --bun test`
3. For CI/CD, use: `npm run test:ci`

## Test Organization

```
test/
├── mocks/              # MSW handlers and server setup
├── utils/              # Shared test utilities
├── integration/        # Integration tests
├── security/           # Security-focused tests
├── error-scenarios/    # Edge cases and error handling
├── setup.ts           # Full test setup with MSW
└── setup-simple.ts    # Simplified setup without MSW
```

## Test Coverage Goals

- **Target**: 80% coverage across all metrics
- **Current Status**: Tests written, pending runtime compatibility fixes
- **Priority Areas**:
  - API route authentication
  - Component user interactions
  - Error handling paths
  - Security vulnerabilities

## Best Practices

1. **Use test utilities** from `test/utils/test-helpers.ts`:
   ```typescript
   import { createQueryWrapper, mockConsole, setupTestEnv } from '@/test/utils/test-helpers';
   ```

2. **Mock external dependencies** consistently:
   - AWS SDK clients
   - Clerk authentication
   - Next.js router

3. **Clean up after tests**:
   - Clear all mocks
   - Reset environment variables
   - Restore console methods

## Troubleshooting

### Tests not running
1. Check Node/Bun version compatibility
2. Clear node_modules and reinstall: `rm -rf node_modules && bun install`
3. Use Node.js fallback if Bun issues persist

### MSW not intercepting requests
1. Ensure MSW server is started in setup file
2. Check handler patterns match request URLs
3. Verify environment is set to 'test'

### Type errors in tests
1. Use proper type assertions instead of `as any`
2. Import types from test utilities
3. Check tsconfig includes test files

## Contributing

When adding new tests:
1. Follow existing patterns and conventions
2. Use shared utilities for common setup
3. Add to appropriate test category
4. Update this README if adding new patterns