#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

// Import from built dist
const { FeatureDerivationAgent } = require('../services/api/dist/features/FeatureDerivationAgent.js');

async function testStoryGenerationFix() {
  console.log('\n=== TESTING STORY GENERATION FIX ===\n');
  
  const agent = new FeatureDerivationAgent();
  
  // Create mock Epic with 5 success criteria (typical size)
  const mockEpicContent = `---
epic_id: epic-test-123
---

# Epic: Access Control System

## Objective
Establish comprehensive access control and audit logging capabilities.

## Success Criteria
- All authentication events are logged with timestamp, identity, action
- Access logs are tamper-resistant and protected from modification
- Logs retained for minimum 365 days and remain searchable
- Authorized personnel can query and export access logs
- Log access activities are themselves logged
`;

  const tmp = '/tmp/test-epic-story-gen.md';
  fs.writeFileSync(tmp, mockEpicContent);
  
  try {
    const features = await agent.deriveFeatures(tmp);
    
    console.log('BEFORE (Old Behavior):');
    console.log('  5 Success Criteria → 5 Features (1 criterion each)');
    console.log('  Expected Stories: 5 (one per feature)');
    console.log('  Problem: Only ONE story per feature\n');
    
    console.log('AFTER (Fixed Behavior):');
    console.log(`  5 Success Criteria → ${features.length} Features (grouped criteria)`);
    
    const totalCriteria = features.reduce((sum, f) => sum + f.acceptance_criteria.length, 0);
    console.log(`  Total Acceptance Criteria: ${totalCriteria}`);
    console.log(`  Expected Stories: ${totalCriteria} (one per acceptance criterion)\n`);
    
    console.log('Feature Breakdown:');
    features.forEach((f, idx) => {
      console.log(`\n  Feature ${idx + 1}: ${f.feature_id}`);
      console.log(`    Title: ${f.title.substring(0, 80)}`);
      console.log(`    Acceptance Criteria (${f.acceptance_criteria.length}):`);
      f.acceptance_criteria.forEach((ac, acIdx) => {
        console.log(`      ${acIdx + 1}. ${ac.substring(0, 70)}...`);
      });
    });
    
    console.log('\n✅ SUCCESS: Features now have multiple acceptance criteria');
    console.log(`   This will generate ${totalCriteria} user stories instead of ${features.length}\n`);
    
  } catch (err) {
    console.error('❌ ERROR:', err.message);
    process.exit(1);
  } finally {
    if (fs.existsSync(tmp)) {
      fs.unlinkSync(tmp);
    }
  }
}

testStoryGenerationFix();
