
import express from 'express';
import { EpicDerivationWorkflow } from '../governance/EpicDerivationWorkflow';

const router = express.Router();

interface Prompt {
  prompt_id: string;
  story_id: string;
  content: string;
}

interface Story {
  story_id: string;
  feature_id: string;
  epic_id: string;
  governance_reference: string;
}

interface Feature {
  feature_id: string;
  epic_id: string;
  user_story_ids?: string[];
}

interface Epic {
  epic_id: string;
  derived_from: string;
  generated_at: string;
}

interface Artifacts {
  prompts?: unknown[];
  stories?: unknown[];
  features?: unknown[];
  epics?: unknown[];
}

interface MuseData {
  artifacts?: Artifacts;
}

// GET /api/mcp/list_derived_prompts
router.get('/list_derived_prompts', async (_req, res) => {
  try {
    const workflow = new EpicDerivationWorkflow();
    const data = workflow['loadMuseYaml']() as MuseData;
    const prompts = Array.isArray(data.artifacts?.prompts)
      ? (data.artifacts.prompts as Prompt[])
      : [];
    const result = prompts
      .map((p: Prompt) => ({
        prompt_id: p.prompt_id,
        story_id: p.story_id,
        content: p.content,
      }))
      .sort((a: Prompt, b: Prompt) => a.prompt_id.localeCompare(b.prompt_id));
    res.json({ prompts: result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list derived prompts', details: String(err) });
  }
});

// GET /api/mcp/list_derived_user_stories
router.get('/list_derived_user_stories', async (_req, res) => {
  try {
    const workflow = new EpicDerivationWorkflow();
    const data = workflow['loadMuseYaml']() as MuseData;
    const stories = Array.isArray(data.artifacts?.stories)
      ? (data.artifacts.stories as Story[])
      : [];
    const result = stories
      .map((s: Story) => ({
        story_id: s.story_id,
        feature_id: s.feature_id,
        epic_id: s.epic_id,
        governance_reference: s.governance_reference,
      }))
      .sort((a: Story, b: Story) => a.story_id.localeCompare(b.story_id));
    res.json({ stories: result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list derived user stories', details: String(err) });
  }
});

// GET /api/mcp/list_derived_features
router.get('/list_derived_features', async (_req, res) => {
  try {
    const workflow = new EpicDerivationWorkflow();
    const data = workflow['loadMuseYaml']() as MuseData;
    const features = Array.isArray(data.artifacts?.features)
      ? (data.artifacts.features as Feature[])
      : [];
    const result = features
      .map((f: Feature) => ({
        feature_id: f.feature_id,
        epic_id: f.epic_id,
        user_story_ids: f.user_story_ids || [],
      }))
      .sort((a: Feature, b: Feature) => a.feature_id.localeCompare(b.feature_id));
    res.json({ features: result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list derived features', details: String(err) });
  }
});


// GET /api/mcp/list_derived_epics
router.get('/list_derived_epics', async (_req, res) => {
  try {
    const workflow = new EpicDerivationWorkflow();
    // Load all epics from muse.yaml
    const data = workflow['loadMuseYaml']() as MuseData;
    const epics = Array.isArray(data.artifacts?.epics)
      ? (data.artifacts.epics as Epic[])
      : [];
    const result = epics
      .map((e: Epic) => ({
        epic_id: e.epic_id,
        title: e.epic_id, // TODO: Replace with actual title if available in artifact
        governance_reference: e.derived_from,
        generated_at: e.generated_at,
      }))
      .sort((a: Epic, b: Epic) => a.epic_id.localeCompare(b.epic_id)); // Deterministic ordering
    res.json({ epics: result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list derived epics', details: String(err) });
  }
});

export default router;
