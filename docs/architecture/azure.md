# Muse on Microsoft Azure — Target Architecture

## 1. Overview

This document defines the target architecture for deploying **Muse**, an AI-enabled web platform, on **Microsoft Azure**. The architecture is designed to support secure, repeatable, and auditable deployments using managed Azure services, Infrastructure as Code (IaC), and automated CI/CD.

**Goals**
- Enable deterministic, automated deployments of Muse to Azure
- Enforce security best practices suitable for regulated and enterprise environments
- Clearly separate infrastructure, application runtime, and CI/CD responsibilities
- Provide a foundation that scales from development to production

**Non-Goals**
- Detailed application-level design (handled elsewhere)
- Cost optimization strategies beyond baseline best practices
- Multi-cloud or hybrid deployment scenarios

---

## 2. Core Azure Services

The following Azure services form the backbone of the Muse platform:

- **Azure Kubernetes Service (AKS)**  
  Hosts Muse application workloads in a managed Kubernetes environment.

- **Azure Container Registry (ACR)**  
  Stores versioned, immutable container images built from the Muse codebase.

- **Azure Key Vault**  
  Securely stores secrets, keys, and sensitive configuration values.

- **Azure Monitor & Log Analytics**  
  Provides centralized logging, metrics, and basic observability for AKS and containers.

---

## 3. Resource Group Strategy

Resource groups are organized by **application** and **environment** to enforce isolation and simplify governance.

**Naming Convention**
```
rg-muse-<environment>-<region>
```

**Examples**
- `rg-muse-dev-eastus`
- `rg-muse-prod-eastus`

**Rationale**
- Clear blast-radius containment between environments
- Simplified access control and cost attribution
- Independent lifecycle management (deploy, destroy, audit)

Each resource group contains:
- One AKS cluster
- One ACR instance (optionally shared across environments if approved)
- Supporting monitoring resources

---

## 4. Container & Compute Architecture

**AKS Cluster Design**
- One AKS cluster per environment (dev, prod)
- Managed identity enabled by default
- Kubernetes version pinned and upgraded intentionally

**Node Pool Strategy**
- System node pool for Kubernetes system workloads
- User node pool for Muse application containers
- Node sizing configurable via Bicep parameters

**Container Image Flow**
1. GitHub Actions builds Muse container images
2. Images are tagged with:
   - Git commit SHA
   - `latest`
3. Images are pushed to Azure Container Registry
4. AKS pulls images from ACR using managed identity

---

## 5. Networking Model

**Ingress Strategy**
- Public ingress enabled for Muse user access
- Azure Application Gateway Ingress Controller or NGINX Ingress Controller used
- TLS termination handled at ingress

**DNS & TLS**
- Public DNS record points to ingress endpoint
- TLS certificates managed via Azure-approved mechanism (e.g., cert-manager with Key Vault integration)

**Tradeoffs**
- Public ingress simplifies demos and external access
- Private ingress may be introduced later for stricter environments
- Architecture allows transition without major redesign

---

## 6. Secrets & Configuration Management

**Secrets Storage**
- All secrets stored exclusively in Azure Key Vault
- Examples:
  - Database credentials
  - API keys
  - OAuth secrets

**Access Model**
- AKS uses managed identity to access Key Vault
- Secrets injected into pods at runtime via:
  - CSI driver or environment variable mapping

**Strict Rules**
- No secrets committed to GitHub
- No secrets baked into container images
- No secrets stored in plaintext configuration files

---

## 7. CI/CD Integration (High Level)

**Source Control**
- GitHub repository is the system of record

**Build Phase**
- Triggered on pull requests and merges to `main`
- Linting and tests run on pull requests
- Container images built on merge to `main`

**Deploy Phase**
- Triggered after successful image build
- GitHub Actions authenticates to Azure using OIDC
- Deployment updates AKS with new image version

**Boundaries**
- CI = build, test, package
- CD = deploy only approved artifacts

---

## 8. Security & Governance Considerations

- **Identity & Access**
  - Azure AD used for all identities
  - Managed identities preferred over service principals

- **Least Privilege**
  - GitHub Actions granted only required Azure permissions
  - AKS granted pull-only access to ACR
  - Key Vault access scoped per workload

- **Auditability**
  - All infrastructure changes tracked via Git commits
  - All deployments traceable to a specific commit SHA
  - Azure activity logs retained per organizational policy

---

## 9. Architecture Diagram (Textual)

```
Developer
   |
   v
GitHub Repository
   |
   | (GitHub Actions)
   v
Azure Container Registry (ACR)
   |
   | (Managed Identity Pull)
   v
Azure Kubernetes Service (AKS)
   |
   |--> Muse Application Pods
   |
   |--> Azure Key Vault (Secrets)
   |
   |--> Azure Monitor / Log Analytics
   v
End Users (via Public Ingress)
```
