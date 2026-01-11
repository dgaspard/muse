import fs from 'fs'
import path from 'path'
import YAML from 'yaml'
import { FeatureToStoryAgent } from './FeatureToStoryAgent'

export interface StoryArtifact {
  story_id: string
  derived_from_feature: string
  derived_from_epic: string
  story_path: string
  generated_at: string
}

interface MuseYaml {
  artifacts?: {
    epics?: any[]
    features?: any[]
    stories?: StoryArtifact[]
  }
}

export class StoryDerivationWorkflow {
  private agent: FeatureToStoryAgent
  private repoRoot: string

  constructor(repoRoot: string = process.cwd()) {
    this.repoRoot = repoRoot
    this.agent = new FeatureToStoryAgent()
  }

  private getMuseYamlPath(): string {
    return path.join(this.repoRoot, 'muse.yaml')
  }

  private loadMuseYaml(): MuseYaml {
    const p = this.getMuseYamlPath()
    if (!fs.existsSync(p)) return { artifacts: { stories: [] } }
    const raw = fs.readFileSync(p, 'utf-8')
    const data = YAML.parse(raw) as MuseYaml
    if (!data.artifacts) data.artifacts = {}
    if (!data.artifacts.stories) data.artifacts.stories = []
    return data
  }

  private updateMuseYaml(storyArtifacts: StoryArtifact[]): void {
    const data = this.loadMuseYaml()

    // Remove existing stories for the same epic
    const epicId = storyArtifacts[0]?.derived_from_epic
    if (epicId && data.artifacts?.stories) {
      data.artifacts.stories = data.artifacts.stories.filter((s) => s.derived_from_epic !== epicId)
    }

    // Add new ones
    data.artifacts!.stories!.push(...storyArtifacts)
    const out = YAML.stringify(data, { indent: 2 })
    fs.writeFileSync(this.getMuseYamlPath(), out, 'utf-8')
  }

  async deriveStoriesFromFeatures(
    featureMarkdownPath: string,
    governanceMarkdownPath: string,
    options: { outputDir?: string } = {},
  ): Promise<StoryArtifact[]> {
    const { outputDir = path.join(this.repoRoot, 'docs/stories') } = options

    const absoluteFeaturePath = path.isAbsolute(featureMarkdownPath)
      ? featureMarkdownPath
      : path.join(this.repoRoot, featureMarkdownPath)

    const absoluteGovernancePath = path.isAbsolute(governanceMarkdownPath)
      ? governanceMarkdownPath
      : path.join(this.repoRoot, governanceMarkdownPath)

    const { stories, storyPath } = await this.agent.deriveAndWriteStories(
      absoluteFeaturePath,
      absoluteGovernancePath,
      undefined,
      outputDir,
    )

    const artifacts: StoryArtifact[] = stories.map((s) => ({
      story_id: s.story_id,
      derived_from_feature: s.derived_from_feature,
      derived_from_epic: s.derived_from_epic,
      story_path: path.relative(this.repoRoot, storyPath),
      generated_at: s.generated_at,
    }))

    this.updateMuseYaml(artifacts)
    return artifacts
  }
}
