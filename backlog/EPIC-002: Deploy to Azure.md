# EPIC-002: Deploy to Azure

## Phase 0 — Foundations & Non-Negotiables

### Story 0.1 — Define Azure target architecture

**As a** platform engineer  
**I want** a documented target architecture for Muse on Microsoft Azure  
**So that** infrastructure, security, and CI/CD decisions are aligned before automation begins.

#### Acceptance Criteria

Architecture doc covers:

- Azure Container Service (AKS)
- Container Registry (ACR)
- Resource Group structure
- Networking model (public ingress vs private)
- Secrets strategy (Key Vault)
- Diagram committed to `/docs/architecture/azure.md`

---

### Story 0.2 — Standardize Muse container build

**As a** developer  
**I want** a deterministic Docker build for Muse  
**So that** CI/CD produces repeatable artifacts.

#### Acceptance Criteria

- Single root Dockerfile (or clearly defined multi-service Dockerfiles)
- `docker build` succeeds locally
- Image runs with environment variables only (no hard-coded config)

---

## Phase 1 — Infrastructure as Code (Bicep)

### Story 1.1 — Create base Bicep project structure

**As a** platform engineer  
**I want** a Bicep project scaffold  
**So that** infrastructure is versioned and reviewable.

#### Acceptance Criteria

- `/infra/bicep/` directory exists
- Includes:
  - `main.bicep`
  - `parameters.dev.json`
  - `parameters.prod.json`
- Deployment works via `az deployment group create`

---

### Story 1.2 — Provision Azure Container Registry (ACR)

**As a** platform engineer  
**I want** an ACR instance created via Bicep  
**So that** GitHub Actions can push images securely.

#### Acceptance Criteria

- ACR created via Bicep
- Admin access disabled
- Output exposes registry login server
- Resource is tagged (`env`, `owner`, `app=muse`)

---

### Story 1.3 — Provision Azure Kubernetes Service (AKS)

**As a** platform engineer  
**I want** AKS provisioned via Bicep  
**So that** Muse can run in a managed container environment.

#### Acceptance Criteria

- AKS created with:
  - Managed identity
  - Node pool sizing configurable by parameters
- AKS granted pull access to ACR
- Kubeconfig accessible via Azure CLI

---

## Phase 2 — App Deployment (Manual First)

### Story 2.1 — Deploy Muse to AKS manually

**As a** developer  
**I want** to deploy Muse to AKS manually  
**So that** runtime issues are discovered before automation.

#### Acceptance Criteria

- Kubernetes manifests or Helm chart exist in `/deploy/`
- Muse is reachable via service or ingress
- App starts successfully in AKS

---

### Story 2.2 — Externalize configuration and secrets

**As a** security-minded engineer  
**I want** secrets stored in Azure Key Vault  
**So that** no secrets live in GitHub or container images.

#### Acceptance Criteria

- Secrets stored in Key Vault
- AKS can read secrets via managed identity
- No secrets committed to repo

---

## Phase 3 — GitHub Actions: Build & Push

### Story 3.1 — Create CI workflow for build & test

**As a** developer  
**I want** GitHub Actions to build and test Muse on PR  
**So that** broken code never reaches main.

#### Acceptance Criteria

- Workflow triggers on `pull_request`
- Runs lint + tests
- Does not deploy
- Fails PR on error

---

### Story 3.2 — Build and push container on merge to main

**As a** platform engineer  
**I want** GitHub Actions to build and push a container image to ACR  
**So that** deployments use immutable artifacts.

#### Acceptance Criteria

- Workflow triggers on push to `main`
- Image tagged with:
  - Git SHA
  - `latest`
- Image pushed to ACR successfully

---

## Phase 4 — Automated Deployment to Azure

### Story 4.1 — Deploy to AKS from GitHub Actions

**As a** platform engineer  
**I want** GitHub Actions to deploy Muse to AKS after image push  
**So that** deployment is automatic and repeatable.

#### Acceptance Criteria

- GitHub Actions authenticates to Azure via OIDC
- Uses `kubectl` or Helm
- Updates image tag in deployment
- Rolls out without downtime

---

### Story 4.2 — Environment separation (dev vs prod)

**As a** product owner  
**I want** separate environments  
**So that** experimentation does not affect demos or users.

#### Acceptance Criteria

- Separate namespaces or clusters
- Separate parameter files in Bicep
- `main` deploys to dev
- Manual approval required for prod

---

## Phase 5 — Safety, Observability, and Maturity

### Story 5.1 — Deployment verification & rollback

**As a** platform engineer  
**I want** post-deployment health checks  
**So that** failed releases automatically roll back.

#### Acceptance Criteria

- Liveness/readiness probes configured
- GitHub Actions fails if rollout fails
- Previous version remains available

---

### Story 5.2 — Observability baseline

**As an** operator  
**I want** logs and metrics visible in Azure  
**So that** issues are diagnosable.

#### Acceptance Criteria

- Container logs available in Azure Monitor
- Basic metrics dashboard exists
- Errors surfaced within 5 minutes

---

## Phase 6 — Muse-Specific Value Add (Optional but Powerful)

### Story 6.1 — Muse-driven infra governance

**As a** platform owner  
**I want** Muse to generate infra governance artifacts  
**So that** architecture, IaC, and CI policies stay aligned.

#### Acceptance Criteria

- Bicep and workflows referenced in Muse governance markdown
- PRs fail if infra drift is detected
- Muse treats infra as a first-class artifact
