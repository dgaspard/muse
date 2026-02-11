# Testing Strategy

**Last Updated:** February 11, 2026  
**Status:** Active

## Overview

This document defines the testing strategy for Muse, a governance-to-delivery transformation tool for regulated industries. Given the compliance-critical nature of the project, testing emphasizes traceability, auditability, and correctness.

## Testing Principles

1. **Test behavior, not implementation** - Focus on what the code does, not how
2. **Maintain traceability** - Link tests to requirements (MUSE-XXX stories)
3. **Fail fast, fail clearly** - Tests should provide actionable error messages
4. **No test modification to pass** - Fix code or add new tests; never alter tests to force success
5. **Explicit over clever** - Clear, readable test code matching project constraints

## Test Pyramid

```
           /\
          /  \
         / E2E \              ← End-to-end workflows (5-10%)
        /______\
       /        \
      / Integration\          ← Service integration (20-30%)
     /____________\
    /              \
   /  Unit Tests    \         ← Component/function tests (60-70%)
  /__________________\
```

## Test Types

### 1. Unit Tests

**Purpose:** Validate individual components, functions, and classes in isolation

**Scope:** Single module or function

**Location:**
- API: `services/api/tests/<module>/*.test.ts`
- Web: `apps/web/tests/*.test.tsx`
- Workers: `services/workers/tests/*.test.ts` (future)

**Characteristics:**
- Fast execution (<100ms per test)
- No external dependencies (mock I/O, databases, APIs)
- High coverage of edge cases
- Deterministic (same input = same output)

**Examples:**
```typescript
// Document converter unit test
describe('BasicPdfToMarkdownConverter', () => {
  it('should generate Markdown with YAML front matter', async () => {
    const converter = new BasicPdfToMarkdownConverter()
    const result = await converter.convert(stream, 'application/pdf', metadata)
    
    expect(result.content).toContain('---')
    expect(result.content).toContain('document_id:')
    expect(result.metadata.derived_artifact).toBe('governance_markdown')
  })
})
```

**Current Coverage:**
- ✅ Document conversion (`documentToMarkdownConverter.test.ts`)
- ✅ Semantic pipeline components (`SectionSplitter.test.ts`, `SectionSummaryJob.test.ts`)
- ✅ AI agent logic (`FeatureGenerationAgent.test.ts`, `EpicDerivationWorkflow.test.ts`)
- ✅ Artifact validation (`ArtifactValidation.test.ts`)
- ✅ Storage abstraction (`documentStore.test.ts`)
- ⚠️ **Gap:** MCP tools unit tests (partial coverage)
- ⚠️ **Gap:** Web UI component tests (only 1 test)

**Run Command:**
```bash
# Run all unit tests
npm test --workspaces

# Run API tests only
cd services/api && npm test

# Run web tests only
cd apps/web && npm test
```

### 2. Integration Tests

**Purpose:** Validate interactions between multiple components or services

**Scope:** Multiple modules working together (e.g., orchestrator + agents + storage)

**Location:** `services/api/tests/integration/*.integration.test.ts`

**Characteristics:**
- Moderate execution time (1-5s per test)
- May use in-memory mocks for external services
- Tests real workflows across boundaries
- Validates data flow and state transitions

**Examples:**
```typescript
// Pipeline orchestration integration test
describe('MusePipelineOrchestrator Integration', () => {
  it('should execute full pipeline from upload to stories', async () => {
    const orchestrator = new MusePipelineOrchestrator(store, converter, workDir)
    const result = await orchestrator.executePipeline(buffer, metadata)
    
    expect(result.document.document_id).toBeDefined()
    expect(result.epics).toHaveLength(1)
    expect(result.features.length).toBeGreaterThan(0)
    expect(result.stories.length).toBeGreaterThan(0)
  })
})
```

**Current Coverage:**
- ✅ Semantic pipeline end-to-end (`semanticPipeline.integration.test.ts`)
- ✅ Epic to feature derivation (`epicToFeature.integration.test.ts`)
- ✅ Pipeline orchestration (`pipelineOrchestration.integration.test.ts`)
- ⚠️ **Gap:** MCP tool integration with file system
- ⚠️ **Gap:** API endpoint integration tests
- ⚠️ **Gap:** Database integration tests (when Postgres is used)

**Run Command:**
```bash
cd services/api && npm test -- --run integration
```

### 3. End-to-End (E2E) Tests

**Purpose:** Validate complete user workflows from browser to storage

**Scope:** Full system including UI, API, storage, and all dependencies

**Location:** `scripts/*.sh`

**Characteristics:**
- Slow execution (30s-5min per test)
- Uses real Docker containers
- Tests production-like scenarios
- Validates system behavior under realistic conditions

**Current Coverage:**

| Test | Script | Purpose | Runtime |
|------|--------|---------|---------|
| **Smoke Test** | `smoke_test.sh` | Verify all services start and health checks pass | ~30s |
| **E2E Upload** | `e2e_upload.sh` | Upload document and verify storage | ~45s |
| **E2E Content Quality** | `e2e_content_quality.sh` | Test content validation gating | ~60s |
| **Full Pipeline** | `test_full_pipeline.sh` | Complete governance-to-delivery flow | ~2min |
| **Story Derivation** | `test_story_derivation.sh` | Feature-to-story generation workflow | ~90s |
| **EPIC-003** | `test_epic_003.sh` | Artifact materialization workflow | ~60s |

**Example:**
```bash
# E2E upload test
npm run e2e-upload

# Full pipeline test
bash ./scripts/test_full_pipeline.sh
```

**Gaps:**
- ⚠️ **Gap:** Browser automation tests (Playwright/Cypress)
- ⚠️ **Gap:** Multi-user concurrency tests
- ⚠️ **Gap:** Large document handling (>50MB)

### 4. Contract Tests

**Purpose:** Ensure API contracts remain stable and backward-compatible

**Scope:** API request/response schemas, error codes, headers

**Location:** `services/api/tests/contracts/*.test.ts` (future)

**Characteristics:**
- Validates OpenAPI/JSON schemas
- Tests error responses match documentation
- Ensures backward compatibility

**Required Tests:**
```typescript
// Example contract test
describe('API Contracts', () => {
  describe('POST /pipeline/execute', () => {
    it('should match OpenAPI schema for success response', async () => {
      const response = await request(app)
        .post('/pipeline/execute')
        .attach('file', buffer, 'policy.pdf')
        .field('projectId', 'test-project')
      
      expect(response.status).toBe(200)
      expect(response.body).toMatchSchema(PipelineOutputSchema)
    })
    
    it('should return 422 for validation failure', async () => {
      const response = await request(app)
        .post('/pipeline/execute')
        .attach('file', invalidBuffer, 'bad.pdf')
        .field('projectId', 'test-project')
      
      expect(response.status).toBe(422)
      expect(response.body.validationBlockedPipeline).toBe(true)
    })
  })
})
```

**Status:** ⚠️ **Not yet implemented** - High priority for EPIC-003 completion

### 5. Security Tests

**Purpose:** Identify vulnerabilities, injection attacks, and security misconfigurations

**Scope:** Input validation, authentication, authorization, data exposure

**Location:**
- `.github/workflows/security.yml` (CodeQL scanning)
- `services/api/tests/security/*.test.ts` (future)

**Current Coverage:**
- ✅ CodeQL static analysis (automated via GitHub Actions)
- ✅ Dependency vulnerability scanning (npm audit)
- ⚠️ **Gap:** OWASP ZAP dynamic scanning
- ⚠️ **Gap:** Authentication/authorization tests (not yet implemented)
- ⚠️ **Gap:** SQL injection tests (future when using Postgres)

**Required Tests:**
```typescript
// Security test examples
describe('Security - Input Validation', () => {
  it('should reject path traversal in document paths', async () => {
    const maliciousPath = '../../etc/passwd'
    await expect(
      documentStore.getOriginal(maliciousPath)
    ).rejects.toThrow('invalid path')
  })
  
  it('should sanitize file names', async () => {
    const result = await request(app)
      .post('/uploads')
      .attach('file', buffer, '<script>alert(1)</script>.pdf')
      .field('projectId', 'test')
    
    expect(result.body.metadata.originalFilename).not.toContain('<script>')
  })
})
```

**Run Command:**
```bash
# Local security scan
npm audit

# CodeQL (automated via CI)
# See .github/workflows/security.yml
```

### 6. Performance Tests

**Purpose:** Validate system behavior under load and identify bottlenecks

**Scope:** Response times, throughput, resource usage, rate limiting

**Location:** `services/api/tests/performance/*.test.ts` (future)

**Characteristics:**
- Tests concurrent requests
- Validates rate limiting
- Measures response times
- Identifies memory leaks

**Required Tests:**
```typescript
// Performance test examples
describe('Performance - Pipeline Execution', () => {
  it('should complete pipeline in under 30 seconds for 10-page document', async () => {
    const startTime = Date.now()
    await orchestrator.executePipeline(buffer, metadata)
    const duration = Date.now() - startTime
    
    expect(duration).toBeLessThan(30000)
  })
  
  it('should handle 10 concurrent uploads without errors', async () => {
    const promises = Array(10).fill(null).map(() => 
      request(app)
        .post('/uploads')
        .attach('file', buffer, 'test.pdf')
        .field('projectId', 'perf-test')
    )
    
    const results = await Promise.all(promises)
    const successCount = results.filter(r => r.status === 200).length
    expect(successCount).toBe(10)
  })
  
  it('should enforce rate limits', async () => {
    // Send 11 requests (limit is 10 per 15min)
    const results = await Promise.all(
      Array(11).fill(null).map(() => 
        request(app).post('/uploads')
      )
    )
    
    const rateLimited = results.filter(r => r.status === 429)
    expect(rateLimited.length).toBeGreaterThan(0)
  })
})
```

**Status:** ⚠️ **Not yet implemented** - Required before production

### 7. Compliance/Audit Tests

**Purpose:** Ensure traceability, auditability, and regulatory compliance

**Scope:** Artifact lineage, audit logs, data retention, GDPR compliance

**Location:** `scripts/validate-traceability.mjs` (partial implementation)

**Characteristics:**
- Validates traceability chains
- Verifies audit log completeness
- Tests data retention policies
- Ensures compliance with regulations

**Current Coverage:**
- ✅ Traceability validation (`validate-traceability.mjs`)
- ✅ Artifact boundary validation (governance workflows)
- ⚠️ **Gap:** Audit log replay tests
- ⚠️ **Gap:** GDPR compliance tests (right to erasure)
- ⚠️ **Gap:** Data retention policy enforcement

**Required Tests:**
```typescript
// Compliance test examples
describe('Compliance - Traceability', () => {
  it('should maintain lineage from governance to prompt', async () => {
    const prompt = await getPrompt('MUSE-001-PROMPT-001')
    const story = await getStory(prompt.story_id)
    const feature = await getFeature(story.feature_id)
    const epic = await getEpic(feature.epic_id)
    const doc = await getDocument(epic.derived_from)
    
    expect(doc).toBeDefined()
    expect(doc.checksumSha256).toBe(epic.source_checksum)
  })
  
  it('should record all data access events', async () => {
    await documentStore.getOriginal('doc-123')
    
    const auditLog = await getAuditLog('doc-123')
    expect(auditLog).toContainEqual({
      event: 'document.accessed',
      documentId: 'doc-123',
      timestamp: expect.any(String),
      userId: expect.any(String)
    })
  })
})
```

**Run Command:**
```bash
# Validate traceability
npm run traceability:check
```

## Test Coverage Goals

| Component | Target Coverage | Current | Status |
|-----------|----------------|---------|--------|
| **Core Logic** | 80%+ | ~70% | 🟡 In Progress |
| **API Endpoints** | 70%+ | ~40% | 🔴 Below Target |
| **Web UI** | 60%+ | ~10% | 🔴 Below Target |
| **Integration** | 100% critical paths | ~60% | 🟡 In Progress |
| **E2E** | 100% user workflows | ~80% | 🟡 In Progress |

## Testing Workflow

### For Developers

1. **Before starting work:**
   ```bash
   # Ensure all tests pass
   npm test --workspaces
   npm run smoke
   ```

2. **During development:**
   ```bash
   # Run tests in watch mode
   cd services/api && npx vitest --watch
   ```

3. **Before committing:**
   ```bash
   # Run full test suite
   npm test --workspaces
   
   # Run E2E smoke test
   npm run smoke
   
   # Validate traceability (if applicable)
   npm run traceability:check
   ```

4. **In PR:**
   - All tests must pass in CI
   - Add tests for new functionality
   - Do not modify tests to make them pass

### For CI/CD

**Automated Test Execution:**

| Trigger | Tests Run | Workflow |
|---------|-----------|----------|
| **Push to any branch** | Smoke tests | `.github/workflows/smoke.yml` |
| **Pull Request** | Lint + Unit + Integration | `.github/workflows/ci-lint-test.yml` |
| **Pull Request** | E2E Upload | `.github/workflows/integration.yml` |
| **Pull Request** | Security (CodeQL) | `.github/workflows/security.yml` |
| **Daily** | Full E2E suite | (future) |

## Best Practices

### Writing Tests

1. **Use descriptive test names:**
   ```typescript
   // ❌ Bad
   it('works', () => { ... })
   
   // ✅ Good
   it('should convert PDF to Markdown with YAML front matter', () => { ... })
   ```

2. **Follow AAA pattern:**
   ```typescript
   it('should validate artifact lineage', async () => {
     // Arrange
     const epic = createMockEpic()
     const feature = createMockFeature(epic.epic_id)
     
     // Act
     const result = await validateLineage(feature)
     
     // Assert
     expect(result.isValid).toBe(true)
     expect(result.lineage).toContain(epic.epic_id)
   })
   ```

3. **Use meaningful assertions:**
   ```typescript
   // ❌ Vague
   expect(result).toBeTruthy()
   
   // ✅ Specific
   expect(result.ok).toBe(true)
   expect(result.documentId).toMatch(/^doc-[a-f0-9]{8}$/)
   ```

4. **Test edge cases:**
   - Empty inputs
   - Null/undefined values
   - Large data volumes
   - Concurrent operations
   - Error conditions

5. **Keep tests independent:**
   - No shared state between tests
   - Each test can run in isolation
   - Use `beforeEach` to reset state

6. **Mock external dependencies:**
   ```typescript
   // Mock AI API calls
   vi.mock('@anthropic-ai/sdk', () => ({
     Anthropic: vi.fn(() => ({
       messages: {
         create: vi.fn().mockResolvedValue(mockAIResponse)
       }
     }))
   }))
   ```

### Test Data Management

1. **Use fixtures for complex data:**
   ```typescript
   // tests/fixtures/governance-doc.ts
   export const sampleGovernanceDoc = {
     content: fs.readFileSync('./fixtures/sample-policy.md', 'utf-8'),
     metadata: { ... }
   }
   ```

2. **Generate test data programmatically:**
   ```typescript
   function createMockEpic(overrides = {}): EpicData {
     return {
       epic_id: 'EPIC-TEST-001',
       title: 'Test Epic',
       objective: 'Test objective',
       ...overrides
     }
   }
   ```

3. **Clean up after tests:**
   ```typescript
   afterEach(async () => {
     await cleanupTestFiles()
     await documentStore.clear()
   })
   ```

## Known Gaps and Priorities

### High Priority (P0)
- [ ] API endpoint contract tests
- [ ] Web UI component tests (React Testing Library)
- [ ] MCP tool integration tests
- [ ] Security penetration tests

### Medium Priority (P1)
- [ ] Performance/load tests
- [ ] Browser E2E tests (Playwright)
- [ ] Database integration tests
- [ ] Audit log verification tests

### Low Priority (P2)
- [ ] Chaos engineering tests
- [ ] Multi-region deployment tests
- [ ] Accessibility tests (WCAG compliance)
- [ ] Internationalization tests

## Tools and Frameworks

| Tool | Purpose | Configuration |
|------|---------|---------------|
| **Vitest** | Unit & integration testing | `vitest.config.ts` |
| **React Testing Library** | UI component testing | `apps/web/tests/setupTests.ts` |
| **Supertest** | API endpoint testing | (future) |
| **Playwright** | Browser E2E testing | (future) |
| **CodeQL** | Static security analysis | `.github/workflows/security.yml` |
| **npm audit** | Dependency vulnerability scanning | `package.json` |

## Related Documentation

- [Developer Guide](../guides/developer-guide.md) - Development workflow
- [Validation Guide](../guides/validation-guide.md) - Validation troubleshooting
- [Security Architecture](../architecture/security/) - Security design
- [API Documentation](../../services/api/README.md) - API specifications

## Glossary

- **Unit Test:** Tests a single function or class in isolation
- **Integration Test:** Tests multiple components working together
- **E2E Test:** Tests complete user workflows from UI to database
- **Contract Test:** Validates API request/response schemas
- **Smoke Test:** Quick checks to verify system is operational
- **Regression Test:** Ensures bugs don't reappear after fixes
- **Flaky Test:** Test that intermittently fails without code changes (should be fixed immediately)

---

**Next Steps:**
1. Implement contract tests for all API endpoints
2. Increase web UI test coverage to 60%+
3. Add performance test suite
4. Set up nightly E2E test runs
5. Configure test coverage reporting in CI

**Questions or Suggestions?**
- Open an issue with tag `testing`
- Review test examples in `services/api/tests/`
- See [CONTRIBUTING.md](../../CONTRIBUTING.md) for test requirements
