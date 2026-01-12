#!/bin/bash

# Quick test to verify story generation works with your uploaded governance document

API_URL="http://localhost:4000"
DOC_ID="4c989d68ea38698f1109fd5dac4a9a62207c0fdd7456211a44a4c673d527e73e"

echo "=== Testing Story Generation with Document $DOC_ID ==="
echo ""

# Try to get the document and re-run pipeline
echo "Attempting to download and re-process the governance document..."

# Get the original document
curl -sf "${API_URL}/documents/${DOC_ID}" -o /tmp/test-governance.bin

if [ $? -ne 0 ]; then
  echo "❌ Could not retrieve document ${DOC_ID}"
  echo "The document may have been purged from MinIO after container restart."
  echo ""
  echo "To test the complete workflow, please re-upload your governance PDF:"
  echo "  curl -X POST ${API_URL}/pipeline/execute \\"
  echo "    -F 'projectId=demo-project' \\"
  echo "    -F 'file=@YourGovernancePolicy.pdf'"
  exit 1
fi

echo "✅ Document retrieved from MinIO"
echo ""

# Re-run the pipeline
echo "Re-executing pipeline..."
RESULT=$(curl -sf -X POST "${API_URL}/pipeline/execute" \
  -F "projectId=demo-project" \
  -F "file=@/tmp/test-governance.bin")

if [ $? -ne 0 ]; then
  echo "❌ Pipeline execution failed"
  exit 1
fi

# Parse results
STORY_COUNT=$(echo "$RESULT" | jq -r '.stories | length')
FEATURE_COUNT=$(echo "$RESULT" | jq -r '.features | length')

echo "✅ Pipeline executed successfully!"
echo ""
echo "Results:"
echo "  Features: $FEATURE_COUNT"
echo "  Stories: $STORY_COUNT"
echo ""

if [ "$STORY_COUNT" -gt "0" ]; then
  echo "🎉 SUCCESS! Stories are now being generated!"
  echo ""
  echo "Sample stories:"
  echo "$RESULT" | jq -r '.stories[0:3][] | "  - \(.title)"'
else
  echo "❌ No stories generated. Checking logs..."
  docker-compose logs api --tail=50 | grep -E "Total stories|acceptance criteria|No stories"
fi

rm -f /tmp/test-governance.bin
