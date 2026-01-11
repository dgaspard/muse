import fs from 'fs'
import path from 'path'
import YAML from 'yaml'
import { FeatureDerivationAgent } from './FeatureDerivationAgent'

export interface FeatureArtifact {
  feature_id: string
  epic_id: string
  feature_path: string
  derived_from_epic: string
  generated_at: string
}

interface MuseYaml {
  artifacts?: {
    epics?: any[]
    features?: FeatureArtifact[]
  }
}

export class FeatureDerivationWorkflow {
  private agent: FeatureDerivationAgent
  private repoRoot: string

  constructor(repoRoot: string = process.cwd()) {
    this.repoRoot = repoRoot
    this.agent = new FeatureDerivationAgent()
  }

  private getMuseYamlPath(): string {
    return path.join(this.repoRoot, 'muse.yaml')
  }

  private loadMuseYaml(): MuseYaml {
    const p = this.getMuseYamlPath()
    if (!fs.existsSync(p)) return { artifacts: { features: [] } }
    const raw = fs.readFileSync(p, 'utf-8')
    const data = YAML.parse(raw) as MuseYaml
    if (!data.artifacts) data.artifacts = {}
    if (!data.artifacts.features) data.artifacts.features = []
    return data
  }

  private updateMuseYaml(featureArtifacts: FeatureArtifact[]): void {
    const data = this.loadMuseYaml()
    // Remove existing features for this epic
    const epicId = featureArtifacts[0]?.epic_id
    if (epicId && data.artifacts?.features) {
      data.artifacts.features = data.artifacts.features.filter(f => f.epic_id !== epicId)
    }
    // Add new ones
    data.artifacts!.features!.push(...featureArtifacts)
    const out = YAML.stringify(data, { indent: 2 })
    fs.writeFileSync(this.getMuseYamlPath(), out, 'utf-8')
  }

  async deriveFeaturesFromEpic(
    epicMarkdownPath: string,
    options: { outputDir?: string } = {}
  ): Promise<FeatureArtifact[]> {
    const { outputDir = path.join(this.repoRoot, 'docs/features') } = options

    const absoluteEpicPath = path.isAbsolute(epicMarkdownPath)
      ? epicMarkdownPath
      : path.join(this.repoRoot, epicMarkdownPath)

    const { features, featurePaths } = await this.agent.deriveAndWriteFeatures(
      absoluteEpicPath,
      undefined,
      outputDir
    )

    const artifacts: FeatureArtifact[] = features.map((f, idx) => ({
      feature_id: f.feature_id,
      epic_id: f.epic_id,
      feature_path: path.relative(this.repoRoot, featurePaths[idx]),
      derived_from_epic: path.relative(this.repoRoot, absoluteEpicPath),
      generated_at: f.generated_at
    }))

    this.updateMuseYaml(artifacts)
    return artifacts
  }
}

