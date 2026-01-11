import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  GovernanceCommitService,
  GitRepositoryError,
  DirtyWorkingTreeError,
  ArtifactRegistrationError,
  type CommitMetadata,
} from '../../src/governance/GovernanceCommitService'
import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import os from 'os'
import YAML from 'yaml'

describe('GovernanceCommitService', () => {
  let tempDir: string
  let service: GovernanceCommitService

  beforeEach(() => {
    // Create a temporary directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'muse-git-test-'))

    // Initialize a Git repository in the temp directory
    execSync('git init', { cwd: tempDir })
    execSync('git config user.email "test@example.com"', { cwd: tempDir })
    execSync('git config user.name "Test User"', { cwd: tempDir })

    // Create an initial commit
    fs.writeFileSync(path.join(tempDir, 'README.md'), '# Test Repo\n')
    execSync('git add README.md', { cwd: tempDir })
    execSync('git commit -m "Initial commit"', { cwd: tempDir })

    // Create docs/governance directory
    fs.mkdirSync(path.join(tempDir, 'docs', 'governance'), { recursive: true })

    service = new GovernanceCommitService(tempDir)
  })

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      try {
        execSync(`rm -rf "${tempDir}"`, { stdio: 'pipe' })
      } catch (error) {
        // Fallback to fs.rmSync if execSync fails
        try {
          fs.rmSync(tempDir, { recursive: true, force: true })
        } catch (e) {
          console.warn(`Failed to clean up ${tempDir}:`, e)
        }
      }
    }
  })

  describe('validateRepository', () => {
    it('should not throw for a valid Git repository', () => {
      expect(() => service['validateRepository']()).not.toThrow()
    })

    it('should throw GitRepositoryError for invalid repository', () => {
      const invalidDir = fs.mkdtempSync(path.join(os.tmpdir(), 'not-git-'))
      const invalidService = new GovernanceCommitService(invalidDir)

      expect(() => invalidService['validateRepository']()).toThrow(GitRepositoryError)

      fs.rmSync(invalidDir, { recursive: true })
    })
  })

  describe('checkWorkingTree', () => {
    it('should not throw when working tree is clean', () => {
      expect(() => service['checkWorkingTree']()).not.toThrow()
    })

    it('should throw DirtyWorkingTreeError when there are modified files', () => {
      fs.writeFileSync(path.join(tempDir, 'README.md'), '# Modified\n')

      expect(() => service['checkWorkingTree']()).toThrow(DirtyWorkingTreeError)
    })

    it('should allow untracked files', () => {
      fs.writeFileSync(path.join(tempDir, 'untracked.txt'), 'untracked')

      expect(() => service['checkWorkingTree']()).not.toThrow()
    })
  })

  describe('commitGovernanceMarkdown', () => {
    it('should commit a governance Markdown file with correct metadata', async () => {
      const documentId = 'doc-7f3a-abc123'
      const originalFilename = 'governance-policy.pdf'
      const markdownPath = path.join(tempDir, 'docs', 'governance', `${documentId}.md`)

      // Create the markdown file with YAML front matter
      const markdownContent = `---
document_id: ${documentId}
source_checksum: sha256:abc123
generated_at: 2026-01-10T12:00:00Z
derived_artifact: governance_markdown
original_filename: ${originalFilename}
---

# Governance Policy

This is a sample governance document.`

      fs.writeFileSync(markdownPath, markdownContent)

      const metadata = await service.commitGovernanceMarkdown(markdownPath, documentId, originalFilename)

      expect(metadata.commit_hash).toBeDefined()
      expect(metadata.commit_hash).toMatch(/^[0-9a-f]{40}$/)
      expect(metadata.document_id).toBe(documentId)
      expect(metadata.original_filename).toBe(originalFilename)
      expect(metadata.artifact_path).toBe(`docs/governance/${documentId}.md`)
      expect(metadata.committed_at).toBeDefined()
    })

    it('should create proper commit message format', async () => {
      const documentId = 'doc-test-123'
      const originalFilename = 'test-policy.pdf'
      const markdownPath = path.join(tempDir, 'docs', 'governance', `${documentId}.md`)

      fs.writeFileSync(markdownPath, '# Test')

      await service.commitGovernanceMarkdown(markdownPath, documentId, originalFilename)

      const commitMessage = execSync('git log -1 --pretty=%B', {
        cwd: tempDir,
        encoding: 'utf-8',
      }).trim()

      expect(commitMessage).toContain(`docs(governance): add markdown derived from ${documentId}`)
      expect(commitMessage).toContain(`Source: ${originalFilename}`)
    })

    it('should update muse.yaml with commit metadata', async () => {
      const documentId = 'doc-yaml-test'
      const originalFilename = 'yaml-test.pdf'
      const markdownPath = path.join(tempDir, 'docs', 'governance', `${documentId}.md`)

      fs.writeFileSync(markdownPath, '# Test')

      await service.commitGovernanceMarkdown(markdownPath, documentId, originalFilename)

      const museYamlPath = path.join(tempDir, 'muse.yaml')
      expect(fs.existsSync(museYamlPath)).toBe(true)

      const museConfig = YAML.parse(fs.readFileSync(museYamlPath, 'utf-8'))
      const artifact = museConfig.artifacts.governance_markdown.find(
        (item: any) => item.document_id === documentId,
      )

      expect(artifact).toBeDefined()
      expect(artifact.document_id).toBe(documentId)
      expect(artifact.original_filename).toBe(originalFilename)
      expect(artifact.committed.commit_hash).toBeDefined()
      expect(artifact.committed.committed_at).toBeDefined()
    })

    it('should throw GitRepositoryError if not a valid repository', async () => {
      const invalidDir = fs.mkdtempSync(path.join(os.tmpdir(), 'not-git-'))
      const invalidService = new GovernanceCommitService(invalidDir)
      const filePath = path.join(invalidDir, 'test.md')

      fs.writeFileSync(filePath, '# Test')

      await expect(invalidService.commitGovernanceMarkdown(filePath, 'doc-123', 'test.pdf')).rejects.toThrow(
        GitRepositoryError,
      )

      fs.rmSync(invalidDir, { recursive: true })
    })

    it('should throw error if markdown file does not exist', async () => {
      await expect(
        service.commitGovernanceMarkdown('/nonexistent/path/test.md', 'doc-123', 'test.pdf'),
      ).rejects.toThrow()
    })

    it('should handle multiple commits for different documents', async () => {
      const doc1Id = 'doc-1'
      const doc2Id = 'doc-2'

      const path1 = path.join(tempDir, 'docs', 'governance', `${doc1Id}.md`)
      const path2 = path.join(tempDir, 'docs', 'governance', `${doc2Id}.md`)

      fs.writeFileSync(path1, '# Document 1')
      fs.writeFileSync(path2, '# Document 2')

      const meta1 = await service.commitGovernanceMarkdown(path1, doc1Id, 'doc1.pdf')
      const meta2 = await service.commitGovernanceMarkdown(path2, doc2Id, 'doc2.pdf')

      expect(meta1.commit_hash).toBeDefined()
      expect(meta2.commit_hash).toBeDefined()
      expect(meta1.commit_hash).not.toBe(meta2.commit_hash)

      // Verify both are in muse.yaml
      const museConfig = YAML.parse(
        fs.readFileSync(path.join(tempDir, 'muse.yaml'), 'utf-8'),
      )
      expect(museConfig.artifacts.governance_markdown).toHaveLength(2)
    })
  })

  describe('getCommitMetadata', () => {
    it('should retrieve commit metadata from muse.yaml', async () => {
      const documentId = 'doc-retrieve-123'
      const originalFilename = 'retrieve-test.pdf'
      const markdownPath = path.join(tempDir, 'docs', 'governance', `${documentId}.md`)

      fs.writeFileSync(markdownPath, '# Test')
      await service.commitGovernanceMarkdown(markdownPath, documentId, originalFilename)

      const metadata = service.getCommitMetadata(documentId)

      expect(metadata).toBeDefined()
      expect(metadata?.document_id).toBe(documentId)
      expect(metadata?.original_filename).toBe(originalFilename)
      expect(metadata?.commit_hash).toBeDefined()
    })

    it('should return null if document is not found', () => {
      const metadata = service.getCommitMetadata('nonexistent-doc')
      expect(metadata).toBeNull()
    })

    it('should return null if muse.yaml does not exist', () => {
      const newTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'no-muse-'))
      execSync('git init', { cwd: newTempDir })
      const newService = new GovernanceCommitService(newTempDir)

      const metadata = newService.getCommitMetadata('doc-123')
      expect(metadata).toBeNull()

      fs.rmSync(newTempDir, { recursive: true })
    })
  })

  describe('muse.yaml persistence', () => {
    it('should preserve existing artifacts when adding new ones', async () => {
      const doc1Id = 'doc-persist-1'
      const doc2Id = 'doc-persist-2'

      const path1 = path.join(tempDir, 'docs', 'governance', `${doc1Id}.md`)
      const path2 = path.join(tempDir, 'docs', 'governance', `${doc2Id}.md`)

      fs.writeFileSync(path1, '# Doc 1')
      fs.writeFileSync(path2, '# Doc 2')

      await service.commitGovernanceMarkdown(path1, doc1Id, 'doc1.pdf')
      await service.commitGovernanceMarkdown(path2, doc2Id, 'doc2.pdf')

      const meta1After = service.getCommitMetadata(doc1Id)
      expect(meta1After).toBeDefined()
      expect(meta1After?.document_id).toBe(doc1Id)
    })

    it('should update existing artifact record if document_id already exists', async () => {
      const documentId = 'doc-replace-test'
      const originalPath = path.join(tempDir, 'docs', 'governance', `${documentId}-v1.md`)
      const updatedPath = path.join(tempDir, 'docs', 'governance', `${documentId}-v2.md`)

      // First: Create and commit initial markdown with this document_id
      fs.writeFileSync(originalPath, '# Original Content')
      const meta1 = await service.commitGovernanceMarkdown(originalPath, documentId, 'original.pdf')
      expect(meta1.document_id).toBe(documentId)
      expect(meta1.artifact_path).toContain('doc-replace-test-v1.md')

      // Commit muse.yaml to have clean working tree
      execSync(`git add muse.yaml`, { cwd: tempDir })
      execSync('git commit -m "chore: add muse.yaml"', { cwd: tempDir })

      // Verify working tree is clean
      let status = execSync('git status --porcelain', { cwd: tempDir, encoding: 'utf-8' })
      expect(status.trim()).toBe('', 'Working tree must be clean')

      // Second: Create and commit a different markdown file but with the SAME document_id
      // This should update the record in muse.yaml instead of creating a new one
      fs.writeFileSync(updatedPath, '# Updated Content')
      const meta2 = await service.commitGovernanceMarkdown(updatedPath, documentId, 'updated.pdf')

      expect(meta2.document_id).toBe(documentId)
      expect(meta2.artifact_path).toContain('doc-replace-test-v2.md')
      expect(meta2.original_filename).toBe('updated.pdf')

      // Verify muse.yaml still has exactly 1 record for this document_id (not 2)
      const museum = YAML.parse(
        fs.readFileSync(path.join(tempDir, 'muse.yaml'), 'utf-8'),
      )

      const matchingArtifacts = museum.artifacts.governance_markdown.filter(
        (item: any) => item.document_id === documentId,
      )
      expect(matchingArtifacts).toHaveLength(1)
      
      const artifact = matchingArtifacts[0]
      expect(artifact.original_filename).toBe('updated.pdf')
      expect(artifact.artifact_path).toContain('doc-replace-test-v2.md')
      expect(artifact.committed.commit_hash).toBe(meta2.commit_hash)
    })
  })

  describe('error handling', () => {
    it('should throw DirtyWorkingTreeError if working tree has uncommitted changes', async () => {
      // Modify an existing file
      fs.writeFileSync(path.join(tempDir, 'README.md'), '# Modified')

      const markdownPath = path.join(tempDir, 'docs', 'governance', 'test.md')
      fs.writeFileSync(markdownPath, '# Test')

      await expect(
        service.commitGovernanceMarkdown(markdownPath, 'doc-123', 'test.pdf'),
      ).rejects.toThrow(DirtyWorkingTreeError)
    })
  })
})
