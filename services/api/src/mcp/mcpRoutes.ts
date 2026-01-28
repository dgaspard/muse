
import express from 'express';
import { EpicDerivationWorkflow } from '../governance/EpicDerivationWorkflow';

const router = express.Router();

// GET /api/mcp/list_derived_prompts
router.get('/list_derived_prompts', async (_req, res) => {
  try {
    const workflow = new EpicDerivationWorkflow();
    const data = workflow['loadMuseYaml']();
    const prompts = Array.isArray((data.artifacts as any)?.prompts)
      ? ((data.artifacts as any).prompts as any[])
      : [];
    const result = prompts
      .map((p: any) => ({
        prompt_id: p.prompt_id,
        story_id: p.story_id,
        content: p.content,
      }))
      .sort((a: any, b: any) => a.prompt_id.localeCompare(b.prompt_id));
    res.json({ prompts: result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list derived prompts', details: String(err) });
  }
});

// GET /api/mcp/list_derived_user_stories
router.get('/list_derived_user_stories', async (_req, res) => {
  try {
    const workflow = new EpicDerivationWorkflow();
    const data = workflow['loadMuseYaml']();
    const stories = Array.isArray((data.artifacts as any)?.stories)
      ? ((data.artifacts as any).stories as any[])
      : [];
    const result = stories
      .map((s: any) => ({
        story_id: s.story_id,
        feature_id: s.feature_id,
        epic_id: s.epic_id,
        governance_reference: s.governance_reference,
      }))
      .sort((a: any, b: any) => a.story_id.localeCompare(b.story_id));
    res.json({ stories: result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list derived user stories', details: String(err) });
  }
});

// GET /api/mcp/list_derived_features
router.get('/list_derived_features', async (_req, res) => {
  try {
    const workflow = new EpicDerivationWorkflow();
    const data = workflow['loadMuseYaml']();
    const features = Array.isArray(data.artifacts?.features)
      ? (data.artifacts?.features as any[])
      : [];
    const result = features
      .map((f: any) => ({
        feature_id: f.feature_id,
        epic_id: f.epic_id,
        user_story_ids: f.user_story_ids || [],
      }))
      .sort((a: any, b: any) => a.feature_id.localeCompare(b.feature_id));
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
    const data = workflow['loadMuseYaml']();
    const epics = Array.isArray(data.artifacts?.epics)
      ? (data.artifacts?.epics as any[])
      : [];
    const result = epics
      .map((e: any) => ({
        epic_id: e.epic_id,
        title: e.epic_id, // TODO: Replace with actual title if available in artifact
        governance_reference: e.derived_from,
        generated_at: e.generated_at,
      }))
      .sort((a: any, b: any) => a.epic_id.localeCompare(b.epic_id)); // Deterministic ordering
    res.json({ epics: result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list derived epics', details: String(err) });
  }
});

export default router;
