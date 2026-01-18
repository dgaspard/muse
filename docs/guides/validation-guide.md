# Governance Document Validation Guide

## Understanding the 422 Error

When you upload a document and receive a **422 Unprocessable Entity** error, it means the document failed validation before being processed by the pipeline. This is **intentional** and working as designed.

### What Validation Checks For

The Governance Markdown Validator ensures documents meet minimum quality standards:

1. **Section Headings**: Document must contain at least 1 section heading
   - Valid heading formats: `# Title`, `## Section`, `### Subsection`
   - Plain text headings (bold or not) are NOT recognized
   - Markdown heading syntax is **required**

2. **Content Length**: Document must be at least 500 characters after conversion

3. **Structure**: Content must follow governance document conventions

## Why Your Document Failed

### Issue: "No section headings found"

This means when your PDF was converted to text, the heading structure was not preserved or detected.

### Common Causes

1. **PDF is image-based (scanned)**: If your PDF is a scan or screenshot, the text extraction library cannot read it
   - Solution: Use a searchable PDF with actual text content

2. **PDF has visual formatting, not markdown headings**: If your PDF uses bold or larger fonts for headings instead of actual heading structure
   - Solution: Your document content was extracted, but it lacks markdown heading syntax

3. **PDF is too short**: If the extracted text is less than 500 characters
   - Solution: Provide a more substantial document

## How to Fix

### Option 1: Ensure Your PDF Has Clear Text (Recommended)

1. Create or download a PDF with actual text content (not scanned/image)
2. Make sure it has clear section structure with headings
3. Example structure:

   ```yaml
   # Governance Policy Document
   
   ## Section 1: Overview
   This policy outlines the governance requirements...
   
   ## Section 2: Requirements
   Organizations must implement the following:
   - Clear organizational structure
   - Regular compliance reviews
   - Documented procedures
   
   ## Section 3: Implementation
   Implementation follows these guidelines...
   ```

### Option 2: Convert Your Document First

If you have a document in Word, Google Docs, or another format:

1. Export to PDF as a searchable PDF (not image)
2. Ensure it has section headings using standard formatting
3. Upload to Muse

## Testing With a Valid Document

To test the pipeline end-to-end:

```bash
# Use the test script to create and upload a sample governance document
bash ./scripts/smoke_test.sh
```plaintext

The smoke test includes a sample governance document that passes validation.

## API Response Details

### Success Response (200 OK)

```json
{
  "ok": true,
  "document": { /* document metadata */ },
  "markdown": "# Document Title\n...",
  "epic": { /* derived epic */ },
  "features": [ /* derived features */ ],
  "user_stories": [ /* derived user stories */ ]
}
```plaintext

### Validation Failure (422 Unprocessable Entity)

```json
{
  "ok": false,
  "error": "governance content validation failed",
  "details": "[NO_STRUCTURE] Content has no section headings. Found 0, minimum required: 1.",
  "validationBlockedPipeline": true
}
```plaintext

The web UI now displays the full validation error message to help you understand what went wrong.

## Document Requirements Summary

| Requirement | Minimum | Notes |
| ----------- | ------- | ----- |
| Section Headings | 1 | Must use markdown syntax: `#`, `##`, etc. |
| Content Length | 500 chars | After text extraction from PDF |
| Document Type | Text PDF | Not scanned/image, must have searchable text |
| Formatting | Markdown | Headings must use markdown heading syntax |

## Need Help?

If your document meets these requirements but still fails:

1. Check the error message displayed in the web UI
2. Run `docker-compose logs api` to see validation details
3. Verify your PDF opens in a text editor and contains readable text

---

**Note**: This validation ensures that documents uploaded to Muse meet organizational governance standards. It prevents processing of incomplete or improperly structured documents.
