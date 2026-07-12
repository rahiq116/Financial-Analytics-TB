# START_HERE.md
# Financial Analytics Platform

> **Important**
>
> This repository contains the product philosophy, architecture, and implementation.
>
> Read the documentation before reading the code.
>
> The documentation is considered the canonical description of the intended platform architecture.

---

# Welcome

This repository contains the **Financial Analytics Platform**, a treasury operating platform designed for community banks.

The platform did **not** begin as a software product.

It began as a solution to recurring treasury operational problems experienced during month-end financial reporting.

Every major architectural decision was made to solve a real treasury workflow.

Before modifying any code, understand the philosophy behind the platform.

---

# Current Project Status

Current milestone:

**Liquidity Dashboard MVP**

Business deadline:

**Monday**

Current priority:

> Deliver a production-ready Liquidity Dashboard.

Architecture work is intentionally paused until this milestone is complete.

---

# Read These Documents In Order

## 1. WHY.md

Purpose

Understand why the platform exists.

Read this first.

Questions answered:

- Why was this platform built?
- What problems does it solve?
- What philosophy drives development?

---

## 2. README.md

Purpose

High-level project overview.

Questions answered:

- What is the platform?
- What modules exist?
- What is the long-term vision?

---

## 3. AGENT.md

Purpose

Engineering constitution.

Questions answered:

- How should contributors think?
- What principles guide development?
- What should never be changed?

Every AI model should read this before making implementation decisions.

---

## 4. CURRENT_STATE.md

Purpose

Current development status.

Questions answered:

- What are we working on today?
- What should be avoided?
- What happens after the current milestone?

This document changes frequently.

---

## 5. PROJECT_PLAN.md

Purpose

Long-term roadmap.

Questions answered:

- Where is the platform going?
- What modules are planned?
- What are the development phases?

---

# Engineering Documentation

Located in:

```
docs/
```

Read in this order.

---

## ARCHITECTURE.md

Describes the current technical architecture.

Read before making structural changes.

---

## ARCHITECTURE_DECISIONS.md

Architecture Decision Records (ADRs).

Explains why major engineering decisions were made.

Do not contradict these decisions without creating a new ADR.

---

## BUSINESS_RULES.md

Treasury business rules.

Explains calculations, assumptions, and operational workflows.

Business behavior is more important than implementation.

---

## DESIGN_PHILOSOPHY.md

One of the most important documents.

Explains:

- Treasury pain points
- Product philosophy
- Design intent

Read this before suggesting major architectural changes.

---

## FEATURE_INVENTORY.md

Complete inventory of platform functionality.

Useful when:

- Refactoring
- Planning new modules
- Understanding dependencies

---

## MULTI_TENANT_MIGRATION.md

Future architecture.

Do **not** implement this now.

It exists to document the long-term migration path toward a configurable multi-tenant platform.

Current priority is completing the Liquidity Dashboard.

---

## LESSONS_LEARNED.md

Historical architectural discoveries.

Every major insight should be documented here.

This document explains how the platform evolved.

---

# Current Repository Structure

```
Financial-Analytics-TB/

README.md
WHY.md
AGENT.md
CURRENT_STATE.md
PROJECT_PLAN.md
LESSONS_LEARNED.md
START_HERE.md

docs/

    ARCHITECTURE.md
    ARCHITECTURE_DECISIONS.md
    BUSINESS_RULES.md
    DESIGN_PHILOSOPHY.md
    FEATURE_INVENTORY.md
    MULTI_TENANT_MIGRATION.md

powerpages/

    shared/

    yield-statement/

    liquidity/
```

---

# Development Philosophy

The platform follows one guiding principle.

```
Import

↓

Validate

↓

Translate

↓

Reconcile

↓

Calculate

↓

Analyze

↓

Report
```

Reports are consumers.

Trust is the product.

---

# Before Writing Code

Ask yourself:

- Does this improve treasury workflow?

- Does this improve trust?

- Does this reduce duplicated business logic?

- Does this preserve existing financial behavior?

- Does this move business rules into metadata?

If not...

Question whether the change belongs in the platform.

---

# Current Development Rules

Until the Liquidity Dashboard is complete:

DO

- Finish liquidity functionality.
- Improve validation.
- Fix bugs.
- Polish the user experience.

DO NOT

- Extract shared modules.
- Rewrite the Yield Statement.
- Perform large architectural refactoring.
- Change business behavior.

These activities begin immediately after the current milestone.

---

# Future Development

Once Liquidity is complete:

1. Metadata Engine extraction
2. Validation Engine extraction
3. Shared Calculation Engine
4. Budget Planning
5. FTP Engine
6. Allocation Engine
7. Journal Generator
8. Plug Generator
9. Scenario Engine
10. ALM
11. Capital Planning

---

# Final Note

This platform was designed by a treasury professional.

Many architectural decisions represent years of operational experience.

If a piece of logic appears more complicated than necessary, assume it exists to solve a real treasury problem until proven otherwise.

Understand the business problem before proposing technical solutions.

The objective is not to build better dashboards.

The objective is to build better treasury operations.
