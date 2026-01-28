import fs from 'fs';
import path from 'path';
import { EpicDerivationWorkflow } from '../governance/EpicDerivationWorkflow';
import { getEpicPaths, getFeaturePaths, getStoryPaths, getPromptPath } from '../utils/projectPaths';

/**
 * Epic artifact interface for materialization
 */
interface EpicArtifact {
  epic_id: string;
  title: string;
  objective: string;
  success_criteria: string[];
  governance_references: Array<{ section_id: string; rationale: string }>;
  derived_from?: string;
  generated_at?: string;
}

/**
 * Feature artifact interface for materialization
 */
interface FeatureArtifact {
  feature_id: string;
  title: string;
  epic_id: string;
  description: string;
  acceptance_criteria: string[];
  user_story_ids?: string[];
  governance_references: Array<{ section_id: string; rationale: string }>;
}

/**
 * Story artifact interface for materialization
 */
interface StoryArtifact {
  story_id: string;
  title: string;
  feature_id: string; // Required for hierarchical structure
  epic_id: string; // Required for hierarchical structure
  role: string;
  capability: string;
  benefit: string;
  acceptance_criteria: string[];
  governance_reference?: string;
}

/**
 * Prompt artifact interface for materialization
 */
interface PromptArtifact {
  prompt_id: string;
  story_id: string;
  feature_id: string; // Required for hierarchical structure
  epic_id: string; // Required for hierarchical structure
  role: string;
  task: string;
  content?: string;
  template: string;
  generated_at?: string;
}

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

  private formatEpicMarkdown(epic: EpicArtifact): string {
    return `# Epic: ${epic.title}

**Epic ID:** ${epic.epic_id}

## Objective
${epic.objective}

## Success Criteria
${Array.isArray(epic.success_criteria) ? epic.success_criteria.map((c: string) => `- ${c}`).join('\n') : epic.success_criteria}

## Governance References
${Array.isArray(epic.governance_references) ? epic.governance_references.map((ref: { section_id: string; rationale: string }) => `- ${ref.section_id}: ${ref.rationale}`).join('\n') : 'None'}

---
*Generated from governance document: ${epic.derived_from || 'Unknown'}*
*Generated at: ${epic.generated_at || new Date().toISOString()}*
`;
  }

  private formatFeatureMarkdown(feature: FeatureArtifact): string {
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
${Array.isArray(feature.governance_references) ? feature.governance_references.map((ref: { section_id: string; rationale: string }) => `- ${ref.section_id}: ${ref.rationale}`).join('\n') : 'None'}

---
*Generated at: ${new Date().toISOString()}*
`;
  }

  private formatStoryMarkdown(story: StoryArtifact): string {
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

  private formatPromptMarkdown(prompt: PromptArtifact): string {
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

  const epics: EpicArtifact[] = (museData.artifacts as Record<string, EpicArtifact[]>).epics || [];
  const features: FeatureArtifact[] = (museData.artifacts as Record<string, FeatureArtifact[]>).features || [];
  const stories: StoryArtifact[] = (museData.artifacts as Record<string, StoryArtifact[]>).stories || [];
  const prompts: PromptArtifact[] = (museData.artifacts as Record<string, PromptArtifact[]>).prompts || [];

      // Get projectId from muse.yaml or default
      const projectId = (museData as { project_id?: string }).project_id || 'default-project';

      // Materialize epics to new hierarchical structure
      for (const epic of epics) {
        try {
          const epicPaths = getEpicPaths(this.repoRoot, projectId, epic.epic_id, epic.title);
          this.ensureDirectory(epicPaths.epicRoot);
          
          const content = this.formatEpicMarkdown(epic);
          fs.writeFileSync(epicPaths.epicFile, content, 'utf-8');
          result.filesCreated.push(path.relative(this.repoRoot, epicPaths.epicFile));
          result.summary.epics++;
        } catch (err) {
          result.errors.push(`Failed to write epic ${epic.epic_id}: ${(err as Error).message}`);
        }
      }

      // Materialize features to epics/{epic-name-epic-id}/features/{feature-name-feature-id}/
      for (const feature of features) {
        try {
          // Find parent epic for name
          const parentEpic = epics.find(e => e.epic_id === feature.epic_id);
          
          const featurePaths = getFeaturePaths(
            this.repoRoot, 
            projectId, 
            feature.epic_id, 
            feature.feature_id,
            parentEpic?.title,
            feature.title
          );
          this.ensureDirectory(featurePaths.featureRoot);
          
          const content = this.formatFeatureMarkdown(feature);
          fs.writeFileSync(featurePaths.featureFile, content, 'utf-8');
          result.filesCreated.push(path.relative(this.repoRoot, featurePaths.featureFile));
          result.summary.features++;
        } catch (err) {
          result.errors.push(`Failed to write feature ${feature.feature_id}: ${(err as Error).message}`);
        }
      }

      // Materialize stories to epics/{epic-name-epic-id}/features/{feature-name-feature-id}/userstories/{story-title-story-id}/
      for (const story of stories) {
        try {
          // Find parent feature and epic for names
          const parentFeature = features.find(f => f.feature_id === story.feature_id);
          const parentEpic = epics.find(e => e.epic_id === story.epic_id);
          
          const storyPaths = getStoryPaths(
            this.repoRoot, 
            projectId, 
            story.epic_id, 
            story.feature_id, 
            story.story_id,
            parentEpic?.title,
            parentFeature?.title,
            story.title
          );
          this.ensureDirectory(storyPaths.storyRoot);
          
          const content = this.formatStoryMarkdown(story);
          fs.writeFileSync(storyPaths.storyFile, content, 'utf-8');
          result.filesCreated.push(path.relative(this.repoRoot, storyPaths.storyFile));
          result.summary.stories++;
        } catch (err) {
          result.errors.push(`Failed to write story ${story.story_id}: ${(err as Error).message}`);
        }
      }

      // Materialize prompts to epics/{epic-name-epic-id}/features/{feature-name-feature-id}/userstories/{story-title-story-id}/aiprompts/{role-prompt-id}.md
      for (const prompt of prompts) {
        try {
          // Find parent story, feature, and epic for names
          const parentStory = stories.find(s => s.story_id === prompt.story_id);
          const parentFeature = features.find(f => f.feature_id === prompt.feature_id);
          const parentEpic = epics.find(e => e.epic_id === prompt.epic_id);
          
          const promptPath = getPromptPath(
            this.repoRoot, 
            projectId, 
            prompt.epic_id, 
            prompt.feature_id, 
            prompt.story_id, 
            prompt.prompt_id,
            parentEpic?.title,
            parentFeature?.title,
            parentStory?.title,
            prompt.role
          );
          this.ensureDirectory(path.dirname(promptPath));
          
          const content = this.formatPromptMarkdown(prompt);
          fs.writeFileSync(promptPath, content, 'utf-8');
          result.filesCreated.push(path.relative(this.repoRoot, promptPath));
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
