# AI Digest Refactoring Plan

## Overview
Systematic refactoring of the AI Digest codebase to improve code quality, reduce complexity, and eliminate duplication.

## Refactoring Tasks

### Phase 1: Infrastructure & Testing Setup
- [ ] Set up vitest and msw for testing
- [ ] Create test utilities and helpers
- [ ] Add baseline tests for existing functionality

### Phase 2: High Priority - Extract Methods (digest-processor.ts)
- [ ] Extract methods from processCleanupDigest()
  - [ ] fetchUnprocessedEmails()
  - [ ] processBatches()
  - [ ] performPostProcessingTasks()
- [ ] Extract methods from processWeeklyDigest()
  - [ ] validateAndFetchEmails()
  - [ ] generateAndSendDigest()
  - [ ] performCleanupTasks()
- [ ] Write tests for each extracted method

### Phase 3: Eliminate Duplication
- [ ] Create CloudWatchLogger in functions/lib/aws/
- [ ] Create SecretsLoader in functions/lib/aws/
- [ ] Update handlers to use shared implementations
- [ ] Write tests for new modules

### Phase 4: Design Patterns
- [ ] Implement StorageFactory (Strategy Pattern)
- [ ] Create BaseDigestProcessor (Template Method Pattern)
- [ ] Refactor digest processors to use base class
- [ ] Add comprehensive tests

### Phase 5: Gmail Refactoring
- [ ] Create Parameter Objects for Gmail methods
- [ ] Implement AI detection strategies
- [ ] Reduce cyclomatic complexity in isAIRelated()
- [ ] Test all Gmail detection logic

### Phase 6: Error Handling & Constants
- [ ] Create centralized ErrorHandler
- [ ] Extract all magic numbers to constants
- [ ] Consolidate error handling patterns
- [ ] Test error scenarios

### Phase 7: Type Safety & Cleanup
- [ ] Replace all 'any' types with proper interfaces
- [ ] Remove dead code
- [ ] Add missing return type annotations
- [ ] Final testing and validation

## Implementation Details

### 1. Extract Method Pattern - DigestProcessor

**Current Issues:**
- processCleanupDigest: 124 lines
- processWeeklyDigest: 159 lines
- Multiple responsibilities per method
- Difficult to test individual parts

**Solution:**
```typescript
private async fetchUnprocessedEmails(): Promise<EmailItem[]>
private async processBatches(emails: EmailItem[]): Promise<{count: number, batches: number}>
private async performPostProcessingTasks(emails: EmailItem[]): Promise<void>
```

### 2. CloudWatchLogger Implementation

**Location:** `functions/lib/aws/cloudwatch-logger.ts`

**Benefits:**
- Single implementation used across all handlers
- Consistent logging format
- Easier to mock in tests

### 3. Storage Factory Pattern

**Location:** `functions/lib/storage-factory.ts`

**Benefits:**
- Centralized storage selection logic
- Easy to add new storage providers
- Simplified testing with mock providers

### 4. Template Method Pattern - Digest Processing

**Benefits:**
- Eliminates duplication between weekly and cleanup digest
- Standardized error handling
- Easier to add new digest types

### 5. Gmail AI Detection Strategies

**Components:**
- KnownSenderDetector
- KeywordDetector
- PatternDetector
- EmailDomainDetector

**Benefits:**
- Each detector can be tested independently
- Easy to add/remove detection strategies
- Reduced complexity in main method

### 6. Constants Extraction

**Location:** `functions/lib/constants.ts`

**Categories:**
- BATCH_LIMITS
- TIMEOUTS
- RETENTION
- API_LIMITS

### 7. Error Handler

**Location:** `functions/lib/error-handler.ts`

**Features:**
- Centralized error handling
- Automatic notification for critical errors
- Consistent error response format

## Testing Strategy

### Unit Tests
- Test each extracted method independently
- Mock external dependencies (Gmail API, OpenAI, etc.)
- Test error scenarios

### Integration Tests
- Test full digest processing flow
- Test storage implementations
- Test email detection logic

### Tools
- **vitest**: Test runner
- **msw**: Mock API responses
- **@testing-library/jest-dom**: Assertions

## Success Metrics

- Cyclomatic complexity: 15 → 8 (-47%)
- Average function length: 60 → 25 lines (-58%)
- Code duplication: 15% → 5% (-67%)
- Test coverage: >80%
- All tests passing
- No regression in functionality

## Build & Validation Commands

```bash
npm run build:all       # Build for all platforms
npm run test           # Run all tests
npm run test:watch     # Watch mode for development
npm run lint           # Lint code
npm run typecheck      # TypeScript validation
```