# Frontend Feature Generation Implementation

## Changes Made

### 1. **Removed Automatic Feature Generation** from Pipeline
- Removed `'deriving-features'` and `'deriving-stories'` from `PipelineStage` type
- Updated `renderStageIndicator()` to only show: Uploading → Converting to Markdown → Deriving Epics
- Pipeline execution now **only derives Epics** from governance documents
- Features are **only generated on-demand** when user clicks "Generate Features" button

### 2. **Added "Generate Features" Button** in Epic Detail View

**Location**: Inside each Epic card in the governance workflow page

**UI**:
```
[✨ Generate Features] [📋 Copy Epic]
```

**Behavior**:
- Shows "⏳ Generating..." while request is in progress
- Button is disabled while generating
- Works independently for each epic
- No impact on other epics or the overall pipeline

### 3. **Inline Feature Display** Under Each Epic

**When features are generated**:
- Appears in a collapsible section under the epic
- Shows count: "Generated Features (n)"
- Styled with light blue background (#F5F9FF)
- Each feature displays:
  - **Title** (capability-oriented)
  - **ID** (epic-id-feature-NN)
  - **Description** (1-2 sentences of system capability)
  - **Acceptance Criteria** (observable, testable outcomes)
  - **Governance References** (section IDs)
  - **Copy button** (📋) for each feature

**Visual Design**:
- Indented under Epic
- Blue border + light blue background
- Smaller font than Epic details
- Matches existing Story display styling

### 4. **Updated State Management**

**New State Variables**:
```typescript
const [generatingFeatures, setGeneratingFeatures] = useState<Set<string>>(new Set())
const [featuresByEpic, setFeaturesByEpic] = useState<Map<string, FeatureWithStories[]>>(new Map())
```

**Why**:
- `generatingFeatures`: Track which epics are currently generating (one epic can generate while others are idle)
- `featuresByEpic`: Store features grouped by epic ID for inline display under each epic

### 5. **Added `generateFeaturesForEpic()` Function**

**Purpose**: Call the feature generation API for a single epic

**Flow**:
1. Mark epic as generating (disable button, show spinner)
2. Fetch governance summaries referenced by epic
3. POST to `/api/epics/:epicId/generate-features`
4. On success:
   - Add features to output.features list
   - Store features in featuresByEpic map (grouped by epic)
   - Features appear inline under the epic
5. On error:
   - Show alert with error message
   - Button returns to enabled state
6. Always clean up generating state when done

### 6. **Epic Features Response Integration**

**Response Format** (from backend API):
```typescript
{
  ok: boolean
  epic_id: string
  feature_count: number
  features: FeatureData[]
}
```

**Integration**:
- Features added to both the flat `output.features` list (for overall stats)
- AND the epic-grouped `featuresByEpic` map (for inline display)
- This allows both top-level "Features" section AND epic-specific inline display

---

## File Changes

### `apps/web/pages/governance.tsx`

**Sections Modified**:

1. **Type Definitions** (Lines 44-67)
   - Changed `PipelineStage` type (removed feature/story stages)
   - Added `GeneratedFeatureResponse` interface
   - Added state variables for feature generation tracking

2. **New Function** (Lines 82-136)
   - `generateFeaturesForEpic(epic: EpicData)`: Async function to generate features for a single epic
   - Handles API calls, state management, and error handling
   - Updates featuresByEpic map for inline display

3. **Stage Indicator** (Line 356)
   - Updated to only show 3 stages (no feature/story derivation)

4. **Stage Condition** (Line 424)
   - Updated to only show indicator for uploading/converting/deriving-epic

5. **Epic Rendering** (Lines 475-556)
   - Added "Generate Features" button in Epic header
   - Button state tied to generatingFeatures set
   - Added inline feature display section below epic details
   - Features grouped and displayed per epic

---

## User Experience Flow

### Before (Old)
```
1. User uploads governance document
2. System automatically:
   - Converts to markdown
   - Derives Epics
   - Derives Features (auto) ❌ NOT IDEAL
   - Derives Stories (auto) ❌ NOT IDEAL
3. User sees everything generated
4. User must edit/delete if not happy
```

### After (New - Better UX)
```
1. User uploads governance document
2. System derives Epics (automatic)
3. User reviews Epics
4. User clicks "Generate Features" button on desired Epic
5. System generates Features ONLY for that Epic
6. Features appear inline under Epic
7. User can:
   - Review features
   - Copy features to clipboard
   - Generate stories from features (if needed)
   - Or generate features for other epics
```

---

## Integration with Backend

### API Endpoint Used
```
POST /api/epics/:epicId/generate-features
```

### Request Payload
```typescript
{
  epic: Epic                    // The full epic object
  summaries: SectionSummary[]   // Governance summaries referenced by epic
}
```

### Response
```typescript
{
  ok: boolean
  epic_id: string
  feature_count: number
  features: FeatureData[]
}
```

---

## Technical Details

### State Management Pattern
- Uses `Set<string>` to track which epics are currently generating
- Allows multiple epics to generate independently
- Button disabled only for the epic being generated

### Feature Grouping
- Features stored in `Map<string, FeatureWithStories[]>`
- Key is epic ID, value is array of features for that epic
- Allows inline display under correct epic
- Also merged into flat `output.features` list for stats

### Error Handling
- Try/catch around API call
- Shows alert if generation fails
- Returns button to enabled state on error
- Does not affect other epics

### Styling
- Inline features use blue color scheme (#2196F3, #1976D2, #90CAF9)
- Light blue background (#F5F9FF) distinguishes from regular features
- Matches existing UI patterns for consistency
- Responsive to window width

---

## Next Steps

1. **User Stories from Features** (Future)
   - Add "Create Stories" button on inline features
   - Similar on-demand pattern as feature generation

2. **Feature Editing** (Future)
   - Allow inline editing of feature titles, descriptions
   - Save edits to artifacts storage

3. **Bulk Operations** (Future)
   - "Generate Features for All Epics" button
   - "Collapse All" / "Expand All" for features

4. **Feature Persistence** (Future)
   - Save generated features to MinIO as markdown
   - Version tracking alongside epics

---

## Browser Testing Checklist

- [ ] Page loads without errors
- [ ] File upload works as before
- [ ] Epic derivation completes successfully
- [ ] "Generate Features" button appears on each epic
- [ ] Button disabled while generating, shows spinner
- [ ] Features appear inline under epic after generation
- [ ] Feature display shows title, description, criteria, references
- [ ] Copy feature button works
- [ ] Can generate features for multiple epics independently
- [ ] Error messages display if API fails
- [ ] No automatic feature generation on file upload ✓
- [ ] Inline features don't interfere with top-level "Features" section
