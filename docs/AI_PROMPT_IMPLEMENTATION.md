# AI Prompt Implementation Guide

## Overview

Muse now uses AI-powered agents (Claude Sonnet 4) for Epic and Feature derivation, implementing the strict validation prompts from `prompts/Prompt-muse-Userstory-Validation.md`.

## What Was Implemented

### 1. GovernanceIntentAgent (Epic Derivation)

**File:** `services/api/src/governance/GovernanceIntentAgent.ts`

**Purpose:** Derives a single Epic capturing the HIGH-LEVEL BUSINESS AND GOVERNANCE INTENT from governance documents.

**Key Constraints:**

- Only derives intent explicitly supported by governance content
- MUST NOT reference: document upload, file storage, metadata capture, markdown conversion, pipelines, artifact generation, AI/agents/automation
- MUST NOT describe how Muse works
- MUST NOT invent requirements or outcomes
- If governance intent cannot be determined, MUST FAIL

**Output Format:**

```yaml
epic:
  epic_id: <string>
  objective: <string>
  success_criteria:
    - <string>
    - <string>
    - <string>
  derived_from: <document_id>
```

**Fallback:** If `ANTHROPIC_API_KEY` is not set, falls back to rule-based extraction.

### 2. EpicDecompositionAgent (Feature Derivation)

**File:** `services/api/src/features/EpicDecompositionAgent.ts`

**Purpose:** Decomposes a single Epic into a small set of IMPLEMENTABLE PRODUCT FEATURES.

**Key Constraints:**

- Each Feature MUST describe a SYSTEM CAPABILITY
- Each Feature MUST include:
  - Actor (system, user, auditor, service)
  - Behavioral verb (log, record, retain, query, export, protect, etc.)
  - Domain noun (access, authentication, authorization, logs, etc.)
- MUST NOT repeat Epic text
- MUST NOT describe pipeline steps
- MUST NOT describe documentation or metadata handling
- MUST NOT invent scope not implied by the Epic

**Output Format:**

```yaml
features:
  - feature_id: <string>
    title: <string>
    description: <string>
    derived_from_epic: <epic_id>
```

**Validation:** Features are validated for presence of behavioral verbs and domain nouns. Fails explicitly if features are vague or generic.

### 3. Integration

**File:** `services/api/src/features/FeatureDerivationWorkflow.ts`

The workflow now:

1. Tries AI-powered feature derivation first (if `ANTHROPIC_API_KEY` is set)
2. Falls back to rule-based derivation if AI fails
3. Logs which approach was used

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Required for AI-powered Epic and Feature derivation
ANTHROPIC_API_KEY=your_api_key_here
```

### Getting an API Key

1. Sign up at <https://console.anthropic.com/>
2. Navigate to API Keys
3. Create a new API key
4. Add to `.env` file

## Usage

### AI-Powered Mode (Recommended)

```bash
# Set API key
export ANTHROPIC_API_KEY=your_key

# Start services
docker-compose up -d

# Upload a governance document via web UI
# Navigate to http://localhost:3000/governance
```

The pipeline will automatically:

1. Convert document to markdown
2. Validate content quality
3. **Use AI to derive Epic** (GovernanceIntentAgent)
4. **Use AI to derive Features** (EpicDecompositionAgent)
5. Derive User Stories (existing agent)

### Fallback Mode

If `ANTHROPIC_API_KEY` is not set:

- Epic derivation uses rule-based extraction (extracts from bullets/paragraphs)
- Feature derivation uses rule-based extraction (one feature per success criterion)

## Validation

### Epic Validation

✅ **Valid Epic:**

- Describes a governance or business outcome
- Phrased independently of implementation details
- Meaningful to product owner or compliance leader
- Includes concise objective (1-2 sentences)
- Includes 3-6 success criteria reflecting policy outcomes

❌ **Invalid Epic (will be rejected):**

- References pipeline mechanics
- Could apply to any document
- Success criteria are generic or tool-oriented
- Cannot be traced to governance text

### Feature Validation

✅ **Valid Feature:**

- "Log all authentication and authorization events for system access."
- "Retain access logs for a minimum of 365 days to support audits."
- "Allow authorized auditors to query and export access logs."

❌ **Invalid Feature (will be rejected):**

- "Governance documents are stored." (describes Muse, not system)
- "Metadata is tracked." (vague, no behavioral verb)
- "Markdown is generated." (pipeline step, not capability)

## Monitoring

### Check AI Usage

```bash
# View API logs to see which agent mode was used
docker-compose logs api | grep "GovernanceIntentAgent\|FeatureDerivationWorkflow"
```

Example output:

```text
api-1 | [GovernanceIntentAgent] Using AI-powered epic derivation
api-1 | [FeatureDerivationWorkflow] Using AI-powered feature derivation
api-1 | [FeatureDerivationWorkflow] Successfully derived 4 features using AI
```

### Fallback Indicators

```text
api-1 | [GovernanceIntentAgent] ANTHROPIC_API_KEY not set, using rule-based extraction
api-1 | [FeatureDerivationWorkflow] AI derivation failed, falling back to rule-based
```

## Testing

### Unit Tests

Tests exist for rule-based agents:

- `services/api/tests/governance/GovernanceIntentAgent.test.ts`
- Feature derivation tests (to be added)

### Integration Tests

Test the full pipeline:

```bash
# 1. Start services with API key
export ANTHROPIC_API_KEY=your_key
docker-compose up -d

# 2. Upload a governance document
curl -F "file=@your_document.pdf" \
     -F "projectId=test-project" \
     http://localhost:4000/api/pipeline/execute

# 3. Check output for AI-derived Epic and Features
```

## Cost Considerations

### Claude Sonnet 4 Pricing

- Input: $3.00 per million tokens
- Output: $15.00 per million tokens

### Estimated Costs Per Document

Assuming:

- Governance document: ~2000 tokens
- Epic derivation: ~500 output tokens
- Feature derivation: ~1000 output tokens

**Cost per document:** ~$0.03 - $0.05

### Optimization Tips

1. **Use validation gating:** Documents that fail validation don't reach AI agents
2. **Temperature=0:** Ensures deterministic, minimal token usage
3. **Structured prompts:** Clear constraints reduce retry/correction needs
4. **Fallback available:** Can operate without AI if needed

## Troubleshooting

### Error: "ANTHROPIC_API_KEY not set"

**Solution:** Add API key to `.env` file and restart containers.

### Error: "Feature validation failed"

**Cause:** AI returned features that don't meet validation rules (missing verbs, vague descriptions).

**Solution:**

1. Check API logs for detailed error
2. Review governance document quality
3. Try again (AI has some randomness even at temperature=0)
4. Falls back to rule-based automatically

### Error: "Agent response missing epic structure"

**Cause:** AI returned invalid YAML or missing required fields.

**Solution:**

1. Falls back to rule-based extraction automatically
2. Check governance document has clear structure
3. Verify API key is valid

## Future Enhancements

### Planned

- [ ] Add AI-powered User Story derivation agent
- [ ] Cache AI responses for identical governance documents
- [ ] Add feedback loop for refining prompts
- [ ] Add telemetry for AI quality metrics

### Under Consideration

- [ ] Support for multiple LLM providers (OpenAI, Azure OpenAI)
- [ ] Fine-tuning on governance document corpus
- [ ] Interactive refinement (user feedback on derived artifacts)

## References

- **Prompt Source:** `prompts/Prompt-muse-Userstory-Validation.md`
- **Epic Agent:** `services/api/src/governance/GovernanceIntentAgent.ts`
- **Feature Agent:** `services/api/src/features/EpicDecompositionAgent.ts`
- **Workflow:** `services/api/src/features/FeatureDerivationWorkflow.ts`
- **Anthropic Docs:** <https://docs.anthropic.com/>

## Support

For issues or questions:

1. Check logs: `docker-compose logs api`
2. Review validation guide above
3. Open an issue with governance document sample and error logs
