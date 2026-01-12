# Story Derivation from MinIO Implementation Summary

## Overview
Successfully implemented the ability to derive user stories from feature and governance markdown documents stored in MinIO, resolving the original error: `Property 'deriveAndWriteStories' does not exist on type 'FeatureToStoryAgent'`.

## Changes Made

### 1. Updated `FeatureToStoryAgent.ts`
- ✅ Added `parseMarkdownFromStream()` method to read markdown from MinIO streams
- ✅ Added `deriveStoriesFromDocuments()` method to derive stories from MinIO-stored documents
- ✅ Refactored `deriveStoriesFromContent()` as a private internal method supporting both file and stream sources
- ✅ Updated `deriveStories()` to use the new internal method

**Key Features:**
- Supports reading markdown files from both filesystem and MinIO/S3
- Maintains existing validation logic (INVEST compliance, schema validation)
- Generates one story per acceptance criterion
- Includes governance references in each story

### 2. Created `storyRoutes.ts`
- ✅ New API endpoint: `POST /api/stories/derive-from-documents`
- ✅ Validates required parameters (featureDocumentId, governanceDocumentId, projectId)
- ✅ Uses DocumentStore to retrieve documents from MinIO
- ✅ Returns generated stories in JSON format

**Request Body:**
```json
{
  "featureDocumentId": "9f4fb6b6ed8107b96aa12e5038da6a02...",
  "governanceDocumentId": "a417e7cbf252089728b55a9aa0c119...",
  "projectId": "test-project",
  "epicId": "test-epic-01"  // optional
}
```

**Response:**
```json
{
  "success": true,
  "storiesGenerated": 5,
  "stories": [...]
}
```

### 3. Created `documentStoreFactory.ts`
- ✅ Factory function to get appropriate DocumentStore implementation
- ✅ Supports S3/MinIO, filesystem, and in-memory stores
- ✅ Configurable via environment variables

**Environment Variables:**
- `DOCUMENT_STORE_DRIVER`: `s3`, `minio`, `filesystem`, `fs`, or `memory`
- `MINIO_ENDPOINT`: MinIO endpoint (default: http://localhost:9000)
- `MINIO_ACCESS_KEY`, `MINIO_ROOT_USER`: Access key
- `MINIO_SECRET_KEY`, `MINIO_ROOT_PASSWORD`: Secret key
- `MINIO_BUCKET`: Bucket name (default: muse-uploads)

### 4. Updated `index.ts`
- ✅ Registered story routes at `/api/stories`
- ✅ Imported and integrated storyRoutes

### 5. Created Test Script
- ✅ `scripts/test_story_derivation.sh` - End-to-end test script
- ✅ Uploads feature and governance markdown to MinIO
- ✅ Calls story derivation endpoint
- ✅ Validates generated stories

## Test Results

```bash
✅ API is healthy
✅ Sample feature created
✅ Sample governance created
✅ Feature uploaded with ID: 9f4fb6b6ed8107...
✅ Governance uploaded with ID: a417e7cbf252...
✅ Successfully generated 5 stories
```

## Usage Example

```bash
# 1. Upload documents to MinIO
curl -X POST http://localhost:4000/uploads \
  -F "projectId=myproject" \
  -F "file=@feature.txt"

# Returns: {"documentId": "abc123..."}

# 2. Derive stories
curl -X POST http://localhost:4000/api/stories/derive-from-documents \
  -H "Content-Type: application/json" \
  -d '{
    "featureDocumentId": "abc123...",
    "governanceDocumentId": "def456...",
    "projectId": "myproject",
    "epicId": "myproject-epic-01"
  }'
```

## Architecture

```
User → API (/api/stories/derive-from-documents)
       ↓
   storyRoutes
       ↓
   FeatureToStoryAgent.deriveStoriesFromDocuments()
       ↓
   DocumentStore.getOriginal() → MinIO
       ↓
   parseMarkdownFromStream()
       ↓
   deriveStoriesFromContent()
       ↓
   Returns StoryOutput[]
```

## Compliance with Project Constraints

✅ **No contract modifications** - No changes to files under `/contracts`
✅ **Explicit, readable code** - Added clear comments and logging
✅ **Small, incremental changes** - Each component has single responsibility
✅ **No test modifications** - Tests remain unchanged
✅ **Regulated environment ready** - Explicit validation, audit logging

## Future Enhancements

- Add pagination for large feature sets
- Support batch story derivation
- Add story persistence to database
- Implement story approval workflow
- Add LLM integration for intelligent story generation
