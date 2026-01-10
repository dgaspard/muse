# Repo Structure That Enforces Muse Contracts

This document defines the canonical repository structure for Muse and explains how it enforces governance, traceability, and AI constraints.

## Core Principles
- Contracts over convention
- Git as the system of record
- Deterministic generation
- Human-in-the-loop governance

## Required Structure
/contracts      # Product + AI contracts (immutable by default)
/docs           # Source-of-truth converted governance documents
/backlog        # Epics, features, user stories
/prompts        # AI prompts derived from stories
/schemas        # Machine-validated schemas
/tools          # Deterministic generators and validators
/traceability   # Doc → story → prompt → code mappings

## Enforcement
- CI validates schemas and traceability
- CODEOWNERS protects contracts and tests
- Generated artifacts must not be hand-edited
