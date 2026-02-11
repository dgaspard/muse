# Test Requirements Checklist

**Quick Reference for Test Coverage**

Use this checklist when adding new features or reviewing test coverage.

## 📋 For Every New Feature

- [ ] **Unit tests** for core logic (60-80% coverage target)
- [ ] **Integration tests** for component interactions
- [ ] **E2E test** for critical user workflows
- [ ] **Security test** for input validation
- [ ] **Documentation** updated with test examples

## 🧪 Test Type Quick Reference

### Unit Tests (Required)
```typescript
// Location: services/api/tests/<module>/*.test.ts
// Framework: Vitest
// Run: npm test
```
- ✅ Fast (<100ms)
- ✅ Isolated (no external deps)
- ✅ Mock I/O, APIs, databases

### Integration Tests (Required for multi-component features)
```typescript
// Location: services/api/tests/integration/*.integration.test.ts
// Framework: Vitest
// Run: npm test -- integration
```
- ✅ Test component interactions
- ✅ Use in-memory mocks
- ✅ Validate data flow

### E2E Tests (Required for user-facing features)
```bash
# Location: scripts/*.sh
# Run: npm run smoke
```
- ✅ Full Docker stack
- ✅ Real workflows
- ✅ Production-like conditions

### Contract Tests (Required for API endpoints)
```typescript
// Location: services/api/tests/contracts/*.test.ts
// Status: To be implemented
```
- ✅ Validate request/response schemas
- ✅ Test error responses
- ✅ Ensure backward compatibility

### Security Tests (Required for input handling)
```typescript
// Framework: CodeQL + custom tests
// Run: npm audit
```
- ✅ Input validation
- ✅ Path traversal prevention
- ✅ SQL injection (when using Postgres)

### Performance Tests (Required before production)
```typescript
// Location: services/api/tests/performance/*.test.ts
// Status: To be implemented
```
- ✅ Response time benchmarks
- ✅ Concurrent request handling
- ✅ Rate limiting validation

### Compliance Tests (Required for regulated features)
```bash
# Location: scripts/validate-traceability.mjs
# Run: npm run traceability:check
```
- ✅ Artifact lineage
- ✅ Audit log completeness
- ✅ Data retention policies

## 🎯 Priority Matrix

| Feature Type | Unit | Integration | E2E | Contract | Security | Performance |
|--------------|------|-------------|-----|----------|----------|-------------|
| **API Endpoint** | ✅ Required | ✅ Required | 🟡 If user-facing | ✅ Required | ✅ Required | 🟡 If expensive |
| **UI Component** | ✅ Required | 🟡 If complex | ✅ Required | N/A | 🟡 If input | ⚪ Optional |
| **AI Agent** | ✅ Required | ✅ Required | 🟡 Optional | N/A | ⚪ Optional | 🟡 If slow |
| **Storage Layer** | ✅ Required | ✅ Required | 🟡 Optional | N/A | ✅ Required | ⚪ Optional |
| **Workflow** | 🟡 Optional | ✅ Required | ✅ Required | N/A | ⚪ Optional | ⚪ Optional |

Legend: ✅ Required | 🟡 Recommended | ⚪ Optional

## ✍️ Test Writing Checklist

Before submitting PR:
- [ ] Tests follow AAA pattern (Arrange, Act, Assert)
- [ ] Descriptive test names (`should do X when Y`)
- [ ] Tests are independent (no shared state)
- [ ] Edge cases covered (empty, null, large data)
- [ ] Mocks used for external dependencies
- [ ] All tests pass locally
- [ ] Smoke tests pass (`npm run smoke`)

## 🚨 Test Anti-Patterns (Don't Do This)

❌ **Modifying tests to make them pass** - Fix the code instead  
❌ **Sharing state between tests** - Use `beforeEach` to reset  
❌ **Testing implementation details** - Test behavior, not internals  
❌ **Flaky tests** - Fix immediately, don't ignore  
❌ **No assertions** - Tests must verify something  
❌ **Unclear test names** - Test name should describe what's tested  

## 📊 Coverage Goals

| Component | Target | Current | Status |
|-----------|--------|---------|--------|
| Core Logic | 80%+ | ~70% | 🟡 |
| API Endpoints | 70%+ | ~40% | 🔴 |
| Web UI | 60%+ | ~10% | 🔴 |
| Integration | 100% critical paths | ~60% | 🟡 |
| E2E | 100% user workflows | ~80% | 🟡 |

## 🔗 Quick Links

- [Full Testing Strategy](./testing-strategy.md)
- [Developer Guide - Testing](../guides/developer-guide.md#testing-strategy)
- [Existing Tests](../../services/api/tests/)
- [CI/CD Workflows](../../.github/workflows/)

## 📝 Examples

### Unit Test Template
```typescript
import { describe, it, expect, beforeEach } from 'vitest'

describe('FeatureName', () => {
  let subject: Subject

  beforeEach(() => {
    subject = new Subject()
  })

  it('should do X when Y', () => {
    // Arrange
    const input = 'test'
    
    // Act
    const result = subject.process(input)
    
    // Assert
    expect(result).toBe('expected')
  })
})
```

### Integration Test Template
```typescript
describe('FeatureIntegration', () => {
  it('should integrate A with B', async () => {
    // Arrange
    const orchestrator = new Orchestrator(serviceA, serviceB)
    
    // Act
    const result = await orchestrator.execute(input)
    
    // Assert
    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
  })
})
```

### E2E Test Template (Shell)
```bash
#!/bin/bash
set -e

# Arrange
docker compose up -d
sleep 5

# Act
response=$(curl -f http://localhost:4000/api/endpoint)

# Assert
echo "$response" | grep '"ok": true' || exit 1

# Cleanup
docker compose down
```

---

**Last Updated:** February 11, 2026  
**See:** [Testing Strategy](./testing-strategy.md) for detailed guidance
