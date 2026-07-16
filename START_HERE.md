# START_HERE.md
# Financial Analytics Platform

> **Important**
>
> This repository contains the product philosophy, architecture, business rules, and implementation of the Financial Analytics Platform.
>
> The documentation is the canonical source of truth.
>
> If implementation conflicts with documentation, identify the conflict before making changes.

---

# Welcome

Welcome to the Financial Analytics Platform.

This is **not** a dashboard project.

It is a **treasury operating platform** designed for community banks.

The platform exists to transform raw accounting information into **trusted financial information** through a validation-first, metadata-driven workflow.

Reports are consumers of the platform.

Trust is the product.

---

# Read Before Writing Code

Read the following documents in this order.

## Required Reading (Always)

1. PROJECT_CONTEXT.md

Purpose

Executive overview of the platform.

This document summarizes:

- Product philosophy
- Treasury workflow
- Architecture
- Metadata
- Validation
- Current roadmap

Every AI and every engineer should begin here.

---

2. CURRENT_STATE.md

Purpose

Current milestone.

Current priorities.

Current constraints.

This document changes frequently.

It overrides long-term planning.

---

## Reference Documentation (Read Only If Needed)

The following documents provide detailed guidance.

### Product

WHY.md

Explains why the platform exists.

---

README.md

General project overview.

---

PROJECT_PLAN.md

Long-term roadmap.

---

LESSONS_LEARNED.md

Historical architectural discoveries.

---

### Engineering

AGENT.md

Engineering constitution.

Coding philosophy.

Development standards.

---

ARCHITECTURE.md

Current technical architecture.

---

ARCHITECTURE_DECISIONS.md

Architecture Decision Records (ADRs).

---

BUSINESS_RULES.md

Treasury calculations and business behavior.

---

DESIGN_PHILOSOPHY.md

Design intent and treasury pain points.

---

FEATURE_INVENTORY.md

Complete feature catalog.

Useful for:

- Refactoring
- Planning
- Dependency analysis

---

MULTI_TENANT_MIGRATION.md

Future architecture.

Reference only.

Not part of the current milestone.

---

# Current Repository Structure

```
Financial-Analytics-TB/
