import fs from 'fs';
import path from 'path';
import { EpicDerivationWorkflow } from '../governance/EpicDerivationWorkflow';

export interface MaterializationResult {
  success: boolean;
  filesCreated: string[];
  errors: string[];
  summary: {
    epics: number;
    features: number;
    stories: number;
    prompts: number;
  };
}

/**
 * Service to materialize governance artifacts from muse.yaml into /docs markdown files
 */
export class MaterializationService {
  private repoRoot: string;
  private workflow: EpicDerivationWorkflow;

  constructor(repoRoot: string = process.cwd()) {
    this.repoRoot = repoRoot;
    this.workflow = new EpicDerivationWorkflow(repoRoot);
  }

  private ensureDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  private formatEpicMarkdown(epic: any): string {
    return `# Epic: ${epic.title}

**Epic ID:** ${epic.epic_id}

## Objective
${epic.objective}

## Success Criteria
${Array.isArray(epic.success_criteria) ? epic.success_criteria.map((c: string) => `- ${c}`).join('\n') : epic.success_criteria}

## Governance References
${Array.isArray(epic.governance_references) ? epic.governance_references.map((ref: any) => `- ${ref.section_id}: ${ref.rationale}`).join('\n') : 'None'}

---
*Generated from governance document: ${epic.derived_from || 'Unknown'}*
*Generated at: ${epic.generated_at || new Date().toISOString()}*
`;
  }

  private formatFeatureMarkdown(feature: any): string {
    return `# Feature: ${feature.title}

**Feature ID:** ${feature.feature_id}  
**Epic ID:** ${feature.epic_id}

## Description
${feature.description}

## Acceptance Criteria
${Array.isArray(feature.acceptance_criteria) ? feature.acceptance_criteria.map((c: string) => `- ${c}`).join('\n') : feature.acceptance_criteria}

## User Stories
${Array.isArray(feature.user_story_ids) ? feature.user_story_ids.map((id: string) => `- [${id}](../stories/${id}.md)`).join('\n') : 'None'}

## Governance References
${Array.isArray(feature.governance_references) ? feature.governance_references.map((ref: any) => `- ${ref.section_id}: ${ref.rationale}`).join('\n') : 'None'}

---
*Generated at: ${new Date().toISOString()}*
`;
  }

  private formatStoryMarkdown(story: any): string {
    return `# User Story: ${story.title}

**Story ID:** ${story.story_id}  
**Feature ID:** ${story.feature_id}  
**Epic ID:** ${story.epic_id}

## Story
As a **${story.role}**  
I want to **${story.capability}**  
So that **${story.benefit}**

## Acceptance Criteria
${Array.isArray(story.acceptance_criteria) ? story.acceptance_criteria.map((c: string) => `- ${c}`).join('\n') : story.acceptance_criteria}

## Governance Reference
${story.governance_reference || 'None'}

---
*Generated at: ${new Date().toISOString()}*
`;
  }

  private formatPromptMarkdown(prompt: any): string {
    return `# AI Prompt: ${prompt.prompt_id}

**Story ID:** ${prompt.story_id}  
**Feature ID:** ${prompt.feature_id || 'N/A'}  
**Epic ID:** ${prompt.epic_id || 'N/A'}

## Role
${prompt.role}

## Task
${prompt.task}

## Prompt Content
\`\`\`
${prompt.content}
\`\`\`

## Template
${prompt.template}

---
*Generated at: ${prompt.generated_at || new Date().toISOString()}*
`;
  }

  async materialize(): Promise<MaterializationResult> {
    const result: MaterializationResult = {
      success: false,
      filesCreated: [],
      errors: [],
      summary: {
        epics: 0,
        features: 0,
        stories: 0,
        prompts: 0,
      },
    };

    try {
      // Load artifacts from muse.yaml
      const museData = await this.workflow['loadMuseYaml']();
      
      if (!museData.artifacts) {
        result.errors.push('No artifacts found in muse.yaml');
        return result;
      }

      const epics = (museData.artifacts as any).epics || [];
      const features = (museData.artifacts as any).features || [];
      const stories = (museData.artifacts as any).stories || [];
      const prompts = (museData.artifacts as any).prompts || [];

      // Create directory structure
      const docsDir = path.join(this.repoRoot, 'docs');
      const epicsDir = path.join(docsDir, 'epics');
      const featuresDir = path.join(docsDir, 'features');
      const storiesDir = path.join(docsDir, 'stories');
      const promptsDir = path.join(docsDir, 'prompts');

      this.ensureDirectory(epicsDir);
      this.ensureDirectory(featuresDir);
      this.ensureDirectory(storiesDir);
      this.ensureDirectory(promptsDir);

      // Materialize epics
      for (const epic of epics) {
        try {
          const filename = `${epic.epic_id}.md`;
          const filepath = path.join(epicsDir, filename);
          const content = this.formatEpicMarkdown(epic);
          fs.writeFileSync(filepath, content, 'utf-8');
          result.filesCreated.push(path.relative(this.repoRoot, filepath));
          result.summary.epics++;
        } catch (err) {
          result.errors.push(`Failed to write epic ${epic.epic_id}: ${(err as Error).message}`);
        }
      }

      // Materialize features
      for (const feature of features) {
        try {
          const filename = `${feature.feature_id}.md`;
          const filepath = path.join(featuresDir, filename);
          const content = this.formatFeatureMarkdown(feature);
          fs.writeFileSync(filepath, content, 'utf-8');
          result.filesCreated.push(path.relative(this.repoRoot, filepath));
          result.summary.features++;
        } catch (err) {
          result.errors.push(`Failed to write feature ${feature.feature_id}: ${(err as Error).message}`);
        }
      }

      // Materialize stories
      for (const story of stories) {
        try {
          const filename = `${story.story_id}.md`;
          const filepath = path.join(storiesDir, filename);
          const content = this.formatStoryMarkdown(story);
          fs.writeFileSync(filepath, content, 'utf-8');
          result.filesCreated.push(path.relative(this.repoRoot, filepath));
          result.summary.stories++;
        } catch (err) {
          result.errors.push(`Failed to write story ${story.story_id}: ${(err as Error).message}`);
        }
      }

      // Materialize prompts
      for (const prompt of prompts) {
        try {
          const filename = `${prompt.prompt_id}.md`;
          const filepath = path.join(promptsDir, filename);
          const content = this.formatPromptMarkdown(prompt);
          fs.writeFileSync(filepath, content, 'utf-8');
          result.filesCreated.push(path.relative(this.repoRoot, filepath));
          result.summary.prompts++;
        } catch (err) {
          result.errors.push(`Failed to write prompt ${prompt.prompt_id}: ${(err as Error).message}`);
        }
      }

      result.success = result.filesCreated.length > 0;
      
      console.log(`[Materialization] Created ${result.filesCreated.length} files: ${result.summary.epics} epics, ${result.summary.features} features, ${result.summary.stories} stories, ${result.summary.prompts} prompts`);
      
      if (result.errors.length > 0) {
        console.warn(`[Materialization] Encountered ${result.errors.length} errors`, result.errors);
      }

      return result;
    } catch (err) {
      result.errors.push(`Materialization failed: ${(err as Error).message}`);
      console.error('[Materialization] Failed', err);
      return result;
    }
  }
}
