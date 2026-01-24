import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { EpicData, FeatureData, StoryData } from '../orchestration/MusePipelineOrchestrator';

interface AIPromptArtifact {
  prompt_id: string;
  story_id: string;
  feature_id?: string;
  epic_id?: string;
  content: string;
  role: string;
  task: string;
  generated_at: string;
  template: string;
}

interface MuseArtifacts {
  artifacts?: {
    governance_markdown?: any[];
    epics?: any[];
    features?: any[];
    stories?: any[];
    prompts?: AIPromptArtifact[];
  };
}

/**
 * Persist pipeline-generated artifacts to muse.yaml for MCP retrieval
 */
export class ArtifactPersistence {
  private repoRoot: string;

  constructor(repoRoot: string = process.cwd()) {
    this.repoRoot = repoRoot;
  }

  private getMuseYamlPath(): string {
    return path.join(this.repoRoot, 'muse.yaml');
  }

  private loadMuseYaml(): MuseArtifacts {
    const yamlPath = this.getMuseYamlPath();
    
    if (!fs.existsSync(yamlPath)) {
      return { artifacts: {} };
    }

    const content = fs.readFileSync(yamlPath, 'utf-8');
    const data = YAML.parse(content) as MuseArtifacts;
    
    if (!data.artifacts) {
      data.artifacts = {};
    }

    return data;
  }

  private saveMuseYaml(data: MuseArtifacts): void {
    const yamlPath = this.getMuseYamlPath();
    const yamlContent = YAML.stringify(data, { indent: 2 });
    fs.writeFileSync(yamlPath, yamlContent, 'utf-8');
  }

  /**
   * Persist epics, features, and stories from pipeline execution
   */
  persistPipelineOutput(
    documentId: string,
    epics: EpicData[],
    features: FeatureData[],
    stories: StoryData[]
  ): void {
    const data = this.loadMuseYaml();

    // Ensure artifact sections exist
    if (!data.artifacts) data.artifacts = {};
    if (!data.artifacts.epics) data.artifacts.epics = [];
    if (!data.artifacts.features) data.artifacts.features = [];
    if (!data.artifacts.stories) data.artifacts.stories = [];

    // Add epics (avoid duplicates by epic_id)
    for (const epic of epics) {
      const existing = data.artifacts.epics.findIndex((e: any) => e.epic_id === epic.epic_id);
      const epicArtifact = {
        epic_id: epic.epic_id,
        title: epic.title,
        objective: epic.objective,
        success_criteria: epic.success_criteria,
        governance_references: epic.governance_references,
        derived_from: documentId,
        generated_at: new Date().toISOString(),
      };

      if (existing >= 0) {
        data.artifacts.epics[existing] = epicArtifact;
      } else {
        data.artifacts.epics.push(epicArtifact);
      }
    }

    // Add features (avoid duplicates by feature_id)
    for (const feature of features) {
      const existing = data.artifacts.features.findIndex((f: any) => f.feature_id === feature.feature_id);
      const featureArtifact = {
        feature_id: feature.feature_id,
        title: feature.title,
        description: feature.description,
        acceptance_criteria: feature.acceptance_criteria,
        epic_id: feature.epic_id,
        governance_references: feature.governance_references,
        user_story_ids: stories.filter(s => s.derived_from_feature === feature.feature_id).map(s => s.story_id),
      };

      if (existing >= 0) {
        data.artifacts.features[existing] = featureArtifact;
      } else {
        data.artifacts.features.push(featureArtifact);
      }
    }

    // Add stories (avoid duplicates by story_id)
    for (const story of stories) {
      const existing = data.artifacts.stories.findIndex((s: any) => s.story_id === story.story_id);
      const storyArtifact = {
        story_id: story.story_id,
        title: story.title,
        role: story.role,
        capability: story.capability,
        benefit: story.benefit,
        acceptance_criteria: story.acceptance_criteria,
        feature_id: story.derived_from_feature,
        epic_id: story.derived_from_epic,
        governance_reference: story.governance_references.join(', '),
      };

      if (existing >= 0) {
        data.artifacts.stories[existing] = storyArtifact;
      } else {
        data.artifacts.stories.push(storyArtifact);
      }
    }

    this.saveMuseYaml(data);
    console.log(`[ArtifactPersistence] Saved ${epics.length} epics, ${features.length} features, ${stories.length} stories to muse.yaml`);
  }

  /**
   * Persist a generated AI prompt
   */
  persistPrompt(prompt: AIPromptArtifact): void {
    const data = this.loadMuseYaml();

    if (!data.artifacts) data.artifacts = {};
    if (!data.artifacts.prompts) data.artifacts.prompts = [];

    // Remove existing prompt with same prompt_id
    data.artifacts.prompts = data.artifacts.prompts.filter((p: AIPromptArtifact) => p.prompt_id !== prompt.prompt_id);
    
    // Add new prompt
    data.artifacts.prompts.push(prompt);

    this.saveMuseYaml(data);
    console.log(`[ArtifactPersistence] Saved prompt ${prompt.prompt_id} to muse.yaml`);
  }
}
