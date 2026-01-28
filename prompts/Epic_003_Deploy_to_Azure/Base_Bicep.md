# AI Prompt — Phase 1.1: Base Bicep Project Scaffold for Muse

## Role & Context

You are a senior Azure platform engineer responsible for establishing Infrastructure as Code (IaC) foundations for Muse, an AI-enabled web platform deployed on Microsoft Azure.

- Muse infrastructure is managed using Bicep, version-controlled in GitHub, and deployed via Azure CLI.
- This work represents the first committed infrastructure artifact and must be production-quality, reviewable, and extensible.

## Objective

Create the base Bicep project scaffold for Muse so that all Azure infrastructure can be defined, reviewed, and evolved in code.

You must generate:

- A directory structure
- Initial Bicep and parameter files
- Minimal but valid content that successfully deploys

## Required Output (Strict)

Generate all files below with correct paths and valid contents:

```
/infra/bicep/
├── main.bicep
├── parameters.dev.json
└── parameters.prod.json
```

Assume that:

- docs/architecture/azure.md already exists and is committed
- This scaffold is the foundation for future AKS, ACR, and Key Vault modules

## File Requirements

### infra/bicep/main.bicep

Must be deployable at resource group scope and must:

- Accept parameters for environment and location
- Define at least one real Azure resource (e.g., resource group–scoped resource such as a Log Analytics Workspace or Storage Account)
- Include clear parameter descriptions
- Use consistent naming conventions
- Apply tags including: app: muse, environment, owner

### infra/bicep/parameters.dev.json

- Targets a development environment
- Specifies environment name (dev) and Azure region (e.g., eastus)
- Uses realistic, non-placeholder values

### infra/bicep/parameters.prod.json

- Targets a production environment
- Specifies environment name (prod) and Azure region
- Mirrors dev structure but with production values

## Deployment Requirement

The generated files must successfully deploy using:

```
az deployment group create \
  --resource-group <existing-resource-group> \
  --template-file infra/bicep/main.bicep \
  --parameters infra/bicep/parameters.dev.json
```

- No syntax errors
- No missing parameters
- No TODOs

## Style & Governance Rules

- Prefer clarity over cleverness
- Use explicit names (no abbreviations)
- Do not generate AKS, ACR, or Key Vault yet
- Treat this as a long-lived foundation, not a demo
- Write as if this will be reviewed by platform engineers, security teams, and auditors

## Output Rules (Strict)

- Output only the file contents
- Separate each file clearly with its path as a heading
- Do not explain the files
- Do not include prose outside the files
- Do not include markdown backticks around file contents

## Success Criteria

A platform engineer should be able to:

- Commit these files directly to the Muse repo
- Deploy them successfully using Azure CLI
- Extend them in later stories without refactoring