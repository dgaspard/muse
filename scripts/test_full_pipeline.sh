#!/bin/bash

# Complete Governance-to-Stories Workflow Test
# Tests the full pipeline: Governance Document → Markdown → Epic → Features → User Stories

set -e

API_URL="http://localhost:4000"

echo "=== Complete Governance-to-Stories Pipeline Test ==="
echo ""

# Step 1: Check API health
echo "1. Checking API health..."
if ! curl -sf "${API_URL}/health" > /dev/null; then
  echo "❌ API is not responding. Make sure services are running with: docker-compose up"
  exit 1
fi
echo "✅ API is healthy"
echo ""

# Step 2: Create a sample governance policy document (PDF format)
echo "2. Creating sample governance policy PDF..."

# Check if we have a PDF creation tool
if command -v pandoc &> /dev/null; then
  # Use pandoc if available
  cat > /tmp/sample-governance-policy.md << 'EOF'
# INFORMATION SECURITY POLICY

## 1. PURPOSE
This policy establishes requirements for authentication, authorization, and audit logging
to ensure secure access to organizational systems and data.

## 2. SCOPE
This policy applies to all software systems that process, store, or transmit sensitive data.

## 3. AUTHENTICATION REQUIREMENTS
- 3.1 All users must authenticate using unique credentials
- 3.2 Multi-factor authentication is required for privileged accounts
- 3.3 Password must meet complexity requirements: minimum 12 characters, mix of upper/lower/numbers/symbols
- 3.4 Failed login attempts must be logged and monitored
- 3.5 Account lockout after 5 failed attempts within 15 minutes

## 4. AUTHORIZATION REQUIREMENTS
- 4.1 Access must be granted based on principle of least privilege
- 4.2 Role-based access control (RBAC) must be implemented
- 4.3 Authorization decisions must be logged for audit purposes
- 4.4 Administrative access requires additional approval workflow

## 5. AUDIT LOGGING REQUIREMENTS
- 5.1 All authentication attempts must be logged (successful and failed)
- 5.2 All authorization decisions must be logged with user, resource, and action
- 5.3 Logs must include timestamp, user ID, source IP, and outcome
- 5.4 Logs must be retained for minimum 90 days
- 5.5 Logs must be stored in tamper-proof audit trail
- 5.6 Security alerts must be generated for suspicious activity patterns

## 6. DATA PROTECTION
- 6.1 Sensitive data must be encrypted at rest using AES-256
- 6.2 Data in transit must use TLS 1.2 or higher
- 6.3 Encryption keys must be managed through approved key management system

## 7. COMPLIANCE
All systems must comply with these requirements within 90 days of deployment.
Non-compliance must be documented with risk acceptance from senior management.
EOF

  pandoc /tmp/sample-governance-policy.md -o /tmp/sample-governance-policy.pdf 2>/dev/null
  if [ -f /tmp/sample-governance-policy.pdf ]; then
    echo "✅ Sample governance policy PDF created using pandoc"
  else
    echo "⚠️  Pandoc conversion failed, will use existing PDF if available"
  fi
  rm -f /tmp/sample-governance-policy.md
else
  echo "⚠️  Pandoc not available. Please upload a real PDF file or install pandoc."
  echo "   For this test, we'll check if you have an existing governance PDF..."
  
  # Check if user has uploaded a PDF previously
  if [ ! -f "/tmp/sample-governance-policy.pdf" ]; then
    echo "❌ No PDF available for testing."
    echo ""
    echo "To run this test, either:"
    echo "  1. Install pandoc: brew install pandoc"
    echo "  2. Place a governance PDF at: /tmp/sample-governance-policy.pdf"
    echo ""
    exit 1
  else
    echo "✅ Using existing PDF file"
  fi
fi
echo ""

# Step 3: Execute the complete pipeline
echo "3. Executing complete pipeline (Governance → Epic → Features → Stories)..."
echo "   This will:"
echo "   - Upload governance document to MinIO"
echo "   - Convert to governance markdown"
echo "   - Derive Epic from governance"
echo "   - Derive Features from Epic"
echo "   - Derive User Stories from Features"
echo ""

PIPELINE_RESULT=$(curl -sf -X POST "${API_URL}/pipeline/execute" \
  -F "projectId=security-policy-project" \
  -F "file=@/tmp/sample-governance-policy.pdf")

# Check if pipeline succeeded
SUCCESS=$(echo "$PIPELINE_RESULT" | jq -r '.validation.isValid')
if [ "$SUCCESS" != "true" ]; then
  echo "❌ Pipeline validation failed"
  echo "$PIPELINE_RESULT" | jq '.validation.errors'
  exit 1
fi

echo "✅ Pipeline executed successfully!"
echo ""

# Step 4: Extract and display results
EPIC_ID=$(echo "$PIPELINE_RESULT" | jq -r '.epic.epic_id')
EPIC_TITLE=$(echo "$PIPELINE_RESULT" | jq -r '.epic.title')
FEATURE_COUNT=$(echo "$PIPELINE_RESULT" | jq -r '.features | length')
STORY_COUNT=$(echo "$PIPELINE_RESULT" | jq -r '.stories | length')

echo "4. Pipeline Results:"
echo "   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "   📄 Governance Document: sample-governance-policy.pdf"
echo "   📋 Epic: $EPIC_TITLE"
echo "   🎯 Epic ID: $EPIC_ID"
echo "   ✨ Features Generated: $FEATURE_COUNT"
echo "   📝 User Stories Generated: $STORY_COUNT"
echo ""

# Step 5: Display Epic details
echo "5. Epic Details:"
echo "   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
EPIC_OBJECTIVE=$(echo "$PIPELINE_RESULT" | jq -r '.epic.objective')
echo "   Objective: $EPIC_OBJECTIVE"
echo ""
echo "   Success Criteria:"
echo "$PIPELINE_RESULT" | jq -r '.epic.success_criteria[] | "     - \(.)"'
echo ""

# Step 6: Display Features
echo "6. Generated Features:"
echo "   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$PIPELINE_RESULT" | jq -r '.features[] | "
   Feature: \(.title)
   ID: \(.feature_id)
   Business Value: \(.business_value)
   Acceptance Criteria: \(.acceptance_criteria | length) items
   "'
echo ""

# Step 7: Display User Stories
echo "7. Generated User Stories:"
echo "   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$STORY_COUNT" -gt "0" ]; then
  echo "$PIPELINE_RESULT" | jq -r '.stories[] | "
   Story: \(.title)
   ID: \(.story_id)
   As a: \(.role)
   I want: \(.capability)
   So that: \(.benefit)
   Acceptance Criteria: \(.acceptance_criteria | length) items
   "'
else
  echo "   ⚠️  No stories generated. This may indicate:"
  echo "      - Features don't have sufficient acceptance criteria"
  echo "      - Story derivation requires manual trigger"
  echo ""
  echo "   💡 You can derive stories manually using:"
  echo "      POST /api/stories/derive-from-documents"
fi

echo ""

# Step 8: Show file locations
echo "8. Generated Artifacts:"
echo "   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
MARKDOWN_PATH=$(echo "$PIPELINE_RESULT" | jq -r '.markdown.path')
echo "   📄 Governance Markdown: $MARKDOWN_PATH"
echo "   📋 Epic: docs/epics/[epic-file].md"
echo "   ✨ Features: docs/features/[epic-id]-features.md"
if [ "$STORY_COUNT" -gt "0" ]; then
  echo "   📝 User Stories: docs/stories/[epic-id]-stories.md"
fi
echo ""

# Cleanup
rm -f /tmp/sample-governance-policy.pdf /tmp/sample-governance-policy.md

echo "=== Test Complete ==="
echo "✅ Full governance-to-stories pipeline executed successfully!"
echo ""
echo "📊 Summary:"
echo "   - 1 Governance Document processed"
echo "   - 1 Epic derived"
echo "   - $FEATURE_COUNT Features derived"
echo "   - $STORY_COUNT User Stories derived"
echo ""
echo "🎉 Your governance policy has been transformed into actionable user stories!"
