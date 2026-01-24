#!/bin/bash

# EPIC-003 Integration Test Script
# Validates artifact retrieval and materialization workflow

set -e

API_URL="http://localhost:4000"
REPO_ROOT="/Users/dustingaspard/Documents/Excella/Workspace/Muse"

echo "=========================================="
echo "EPIC-003 Integration Test"
echo "=========================================="
echo ""

# Check API health
echo "[1] Checking API health..."
if curl -s "${API_URL}/health" | grep -q "ok"; then
  echo "✓ API is healthy"
else
  echo "✗ API is not responding"
  exit 1
fi

echo ""
echo "[2] Testing artifact retrieval (read-only)..."

# List epics
echo "  2a. List epics..."
EPICS=$(curl -s "${API_URL}/mcp/epics")
EPIC_COUNT=$(echo "$EPICS" | jq '.data.epic_count // 0')
echo "  Found $EPIC_COUNT epics"

if [ "$EPIC_COUNT" -gt 0 ]; then
  FIRST_EPIC=$(echo "$EPICS" | jq -r '.data.epics[0].epic_id')
  echo "  First epic: $FIRST_EPIC"
  
  # Get epic details
  echo "  2b. Get epic details..."
  EPIC=$(curl -s "${API_URL}/mcp/epics/${FIRST_EPIC}")
  EPIC_TITLE=$(echo "$EPIC" | jq -r '.data.title // "N/A"')
  echo "  Epic title: $EPIC_TITLE"
fi

# List features
echo "  2c. List features..."
FEATURES=$(curl -s "${API_URL}/mcp/features")
FEATURE_COUNT=$(echo "$FEATURES" | jq '.data.feature_count // 0')
echo "  Found $FEATURE_COUNT features"

# List stories
echo "  2d. List user stories..."
STORIES=$(curl -s "${API_URL}/mcp/stories")
STORY_COUNT=$(echo "$STORIES" | jq '.data.story_count // 0')
echo "  Found $STORY_COUNT stories"

# List prompts
echo "  2e. List prompts..."
PROMPTS=$(curl -s "${API_URL}/mcp/prompts")
PROMPT_COUNT=$(echo "$PROMPTS" | jq '.data.prompt_count // 0')
echo "  Found $PROMPT_COUNT prompts"

echo ""
echo "[3] Testing artifact validation..."
if [ "$EPIC_COUNT" -gt 0 ]; then
  echo "  Validating lineage for $FIRST_EPIC..."
  LINEAGE=$(curl -s -X POST "${API_URL}/mcp/validate-lineage" \
    -H "Content-Type: application/json" \
    -d "{\"epic_id\": \"${FIRST_EPIC}\"}")
  
  VALID=$(echo "$LINEAGE" | jq '.data.valid')
  echo "  Lineage valid: $VALID"
  
  if [ "$VALID" = "true" ]; then
    echo "  ✓ Artifact lineage is consistent"
  else
    ERRORS=$(echo "$LINEAGE" | jq '.data.errors')
    echo "  ✗ Lineage validation failed:"
    echo "$ERRORS" | jq '.'
  fi
else
  echo "  Skipping lineage validation (no epics found)"
fi

echo ""
echo "[4] Testing materialization (write)..."
echo "  Materializing artifacts to /docs..."

MATERIALIZE=$(curl -s -X POST "${API_URL}/mcp/materialize")
MATERIALIZE_SUCCESS=$(echo "$MATERIALIZE" | jq '.success')
FILES_CREATED=$(echo "$MATERIALIZE" | jq '.data.files_created | length // 0')

if [ "$MATERIALIZE_SUCCESS" = "true" ]; then
  echo "  ✓ Materialization succeeded"
  echo "  Files created: $FILES_CREATED"
  echo "$MATERIALIZE" | jq '.data.summary'
else
  echo "  ✗ Materialization failed"
  echo "$MATERIALIZE" | jq '.error'
fi

echo ""
echo "[5] Verifying materialized files..."
if [ "$FILES_CREATED" -gt 0 ]; then
  DOCS_DIR="${REPO_ROOT}/docs"
  
  # Count files in /docs subdirectories
  EPIC_FILES=$(find "${DOCS_DIR}/epics" -name "*.md" 2>/dev/null | wc -l)
  FEATURE_FILES=$(find "${DOCS_DIR}/features" -name "*.md" 2>/dev/null | wc -l)
  STORY_FILES=$(find "${DOCS_DIR}/stories" -name "*.md" 2>/dev/null | wc -l)
  PROMPT_FILES=$(find "${DOCS_DIR}/prompts" -name "*.md" 2>/dev/null | wc -l)
  
  echo "  Epic files: $EPIC_FILES"
  echo "  Feature files: $FEATURE_FILES"
  echo "  Story files: $STORY_FILES"
  echo "  Prompt files: $PROMPT_FILES"
else
  echo "  No files to verify"
fi

echo ""
echo "=========================================="
echo "EPIC-003 Integration Test Complete"
echo "=========================================="
