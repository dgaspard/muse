import fs from 'fs'
import path from 'path'
import YAML from 'yaml'
import matter from 'gray-matter'
import { FeatureDerivationAgent } from './FeatureDerivationAgent'
import { EpicDecompositionAgent } from './EpicDecompositionAgent'

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
  private aiAgent: EpicDecompositionAgent
  private repoRoot: string

  constructor(repoRoot: string = process.cwd()) {
    this.repoRoot = repoRoot
    this.agent = new FeatureDerivationAgent()
    this.aiAgent = new EpicDecompositionAgent()
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
    options: { outputDir?: string; useAI?: boolean } = {}
  ): Promise<FeatureArtifact[]> {
    const { outputDir = path.join(this.repoRoot, 'docs/features'), useAI = true } = options

    const absoluteEpicPath = path.isAbsolute(epicMarkdownPath)
      ? epicMarkdownPath
      : path.join(this.repoRoot, epicMarkdownPath)

    // Try AI-powered derivation first if enabled
    if (useAI && process.env.ANTHROPIC_API_KEY) {
      try {
        console.log('[FeatureDerivationWorkflow] Using AI-powered feature derivation')
        
        // Read epic markdown to extract Epic data
        const epicContent = fs.readFileSync(absoluteEpicPath, 'utf-8')
        const parsed = matter(epicContent)
        
        // Extract epic data from content
        const lines = epicContent.split('\n')
        let objective = ''
        const successCriteria: string[] = []
        
        let inSuccessCriteria = false
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          if (line.startsWith('## Objective')) {
            objective = lines[i + 1]?.trim() || ''
          } else if (line.startsWith('## Success Criteria')) {
            inSuccessCriteria = true
          } else if (line.startsWith('##')) {
            inSuccessCriteria = false
          } else if (inSuccessCriteria && line.startsWith('- ')) {
            successCriteria.push(line.replace('- ', '').trim())
          }
        }
        
        const epicData = {
          epic_id: parsed.data.epic_id,
          objective,
          success_criteria: successCriteria
        }
        
        // Call AI agent
        const aiFeatures = await this.aiAgent.deriveFeatures(epicData)
        
        // Write features to markdown files
        const featurePaths: string[] = []
        for (let i = 0; i < aiFeatures.length; i++) {
          const feature = aiFeatures[i]
          const filename = `${epicData.epic_id}-${feature.feature_id.split('-').slice(-1)[0]}.md`
          const outPath = path.join(outputDir, filename)
          
          // Ensure output directory exists
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true })
          }
          
          // Write feature markdown
          const frontMatter = {
            feature_id: feature.feature_id,
            epic_id: feature.derived_from_epic,
            generated_at: feature.generated_at
          }
          const content = [
            '---',
            ...Object.entries(frontMatter).map(([k, v]) => `${k}: ${v}`),
            '---',
            '',
            `# Feature: ${feature.title}`,
            '',
            '## Description',
            '',
            feature.description,
            '',
            '## Acceptance Criteria',
            '',
            '- Feature is implemented as described',
            ''
          ].join('\n')
          
          fs.writeFileSync(outPath, content, 'utf-8')
          featurePaths.push(outPath)
        }
        
        // Create artifacts
        const artifacts: FeatureArtifact[] = aiFeatures.map((f, idx) => ({
          feature_id: f.feature_id,
          epic_id: f.derived_from_epic,
          feature_path: path.relative(this.repoRoot, featurePaths[idx]),
          derived_from_epic: path.relative(this.repoRoot, absoluteEpicPath),
          generated_at: f.generated_at
        }))
        
        this.updateMuseYaml(artifacts)
        console.log(`[FeatureDerivationWorkflow] Successfully derived ${artifacts.length} features using AI`)
        return artifacts
      } catch (error) {
        console.warn('[FeatureDerivationWorkflow] AI derivation failed, falling back to rule-based:', error)
        // Fall through to rule-based approach
      }
    }

    // Fall back to rule-based derivation
    console.log('[FeatureDerivationWorkflow] Using rule-based feature derivation')
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

