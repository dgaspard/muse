#!/bin/bash

# Test script for story derivation from MinIO-stored documents
# This demonstrates the end-to-end workflow for deriving stories from documents

set -e

API_URL="http://localhost:4000"

echo "=== Story Derivation from MinIO Documents Test ==="
echo ""

# Step 1: Check API health
echo "1. Checking API health..."
if ! curl -sf "${API_URL}/health" > /dev/null; then
  echo "❌ API is not responding. Make sure services are running with: docker-compose up"
  exit 1
fi
echo "✅ API is healthy"
echo ""

# Step 2: Create a sample feature markdown file
echo "2. Creating sample feature markdown..."
cat > /tmp/sample-feature.txt << 'EOF'
---
feature_id: test-project-test-epic-feature-01
epic_id: test-epic-01
---

# Feature: User Authentication

## Description
Users need a secure way to log in to the system using their email and password credentials.

## Acceptance Criteria
- User can navigate to the login page
- User can enter email and password
- System validates credentials against database
- User receives success message on valid login
- User receives error message on invalid login
- User session persists across page reloads
EOF
echo "✅ Sample feature created at /tmp/sample-feature.txt"
echo ""

# Step 3: Create a sample governance markdown file
echo "3. Creating sample governance markdown..."
cat > /tmp/sample-governance.txt << 'EOF'
---
policy_id: security-policy-001
title: Security and Authentication Policy
---

# Security Policy

## Authentication Requirements
All systems must implement secure authentication mechanisms that:
- Use industry-standard encryption for credentials
- Implement session management
- Provide clear user feedback
- Log authentication attempts for audit purposes

## Compliance
All features must comply with security standards.
EOF
echo "✅ Sample governance created at /tmp/sample-governance.txt"
echo ""

# Step 4: Upload the feature markdown to MinIO
echo "4. Uploading feature markdown to MinIO..."
FEATURE_UPLOAD=$(curl -sf -X POST "${API_URL}/uploads" \
  -F "projectId=test-project" \
  -F "file=@/tmp/sample-feature.txt")

FEATURE_DOC_ID=$(echo "$FEATURE_UPLOAD" | jq -r '.documentId')
if [ "$FEATURE_DOC_ID" = "null" ] || [ -z "$FEATURE_DOC_ID" ]; then
  echo "❌ Failed to upload feature document"
  echo "$FEATURE_UPLOAD" | jq .
  exit 1
fi
echo "✅ Feature uploaded with ID: $FEATURE_DOC_ID"
echo ""

# Step 5: Upload the governance markdown to MinIO
echo "5. Uploading governance markdown to MinIO..."
GOV_UPLOAD=$(curl -sf -X POST "${API_URL}/uploads" \
  -F "projectId=test-project" \
  -F "file=@/tmp/sample-governance.txt")

GOV_DOC_ID=$(echo "$GOV_UPLOAD" | jq -r '.documentId')
if [ "$GOV_DOC_ID" = "null" ] || [ -z "$GOV_DOC_ID" ]; then
  echo "❌ Failed to upload governance document"
  echo "$GOV_UPLOAD" | jq .
  exit 1
fi
echo "✅ Governance uploaded with ID: $GOV_DOC_ID"
echo ""

# Step 6: Call the story derivation endpoint
echo "6. Deriving stories from uploaded documents..."
STORY_RESULT=$(curl -sf -X POST "${API_URL}/api/stories/derive-from-documents" \
  -H "Content-Type: application/json" \
  -d "{
    \"featureDocumentId\": \"$FEATURE_DOC_ID\",
    \"governanceDocumentId\": \"$GOV_DOC_ID\",
    \"projectId\": \"test-project\",
    \"epicId\": \"test-epic-01\"
  }")

SUCCESS=$(echo "$STORY_RESULT" | jq -r '.success')
if [ "$SUCCESS" != "true" ]; then
  echo "❌ Story derivation failed"
  echo "$STORY_RESULT" | jq .
  exit 1
fi

STORY_COUNT=$(echo "$STORY_RESULT" | jq -r '.storiesGenerated')
echo "✅ Successfully generated $STORY_COUNT stories"
echo ""

# Step 7: Display the generated stories
echo "7. Generated Stories:"
echo "$STORY_RESULT" | jq -r '.stories[] | "  - Story ID: \(.story_id)\n    Title: \(.title)\n    As a \(.role), I want to \(.capability)\n    So that \(.benefit)\n"'

# Cleanup
rm -f /tmp/sample-feature.txt /tmp/sample-governance.txt

echo ""
echo "=== Test Complete ==="
echo "✅ All steps passed successfully!"
