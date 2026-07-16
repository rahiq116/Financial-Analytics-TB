# CURRENT_STATE.md

Version: 1.3

Last Updated: July 2026

---

# Current Milestone

## Yield Statement UI Unification

**Status**

Complete

**Business Objective**

Reduce treasury review friction by making the Yield Statement navigation, filters, report controls, and presentation consistent across Overview, Summary, Yield Statement, Budget, and Detail views.

**Approved Scope**

- Presentation and navigation code under `powerpages/yield-statement`
- Contextual control consolidation without capability loss
- Responsive validation from 768px through native 4K
- Accessibility improvements for tabs, focus states, and control labeling
- Shared statement-table contract: Yield MTD is the presentation baseline, and every table-level visual change must apply in the same change to Yield MTD/QTD/YTD, Budget MTD/QTD/YTD, and Detail tables unless a content or width difference is required by the report

**Deadline**

No fixed deadline is recorded.

**Out of Scope**

- Financial calculations and treasury business behavior
- Metadata, hierarchy, validation, mapping, import, and reconciliation behavior
- Data loading, workbook structures, print contents, and export contents
- Architectural refactoring or shared-engine extraction

---

# Current Focus

Maintain the verified Yield Statement presentation baseline while preserving financial results and all existing treasury capabilities.

---

# Current Architectural Constraints

For this milestone:

- Preserve existing treasury calculations and business behavior.
- Preserve metadata and validation behavior.
- Do not introduce major architectural refactoring.
- Prefer small, validated, incremental changes.
- Document decisions that affect architecture or business rules.
- Limit implementation to presentation, navigation, accessibility, and responsive layout behavior.
- Compare representative report outputs before and after the UI changes.
- Treat Yield MTD/QTD/YTD, Budget MTD/QTD/YTD, and Detail tables as one shared visual component; do not introduce report-only typography, spacing, row, header, section-bar, or scenario-header styling, and verify parity whenever the canonical Yield MTD table changes. Detail tables may retain wider minimum widths and horizontal scrolling when their column count requires it.

---

# Current Known Technical Debt

The following remains documented for future, incremental remediation:

- Monolithic Yield Statement implementation
- Duplicate hierarchy logic
- Duplicate rendering helpers
- Duplicate utility functions
- Shared Metadata Engine not yet extracted

No technical-debt work should begin without an approved milestone and a plan to preserve business behavior.

---

# Current Known Risks

Technical

- Regressions in production financial calculations
- Refactoring before business behavior is fully understood and validated
- Divergent module-specific metadata or mappings

Business

- Reports being used without trustworthy validation results
- Architecture decisions being made without a documented treasury workflow need

Mitigation

Documentation-first development, validation before reporting, finance-owned metadata, and incremental, verified change.

---

# Immediate Success Criteria

The Yield Statement UI milestone is complete when:

- Primary and contextual report navigation is clear, keyboard accessible, and free of overlap.
- Filters remain in a stable order and contextual controls appear only where applicable.
- Duplicate report controls are consolidated without capability loss.
- Layouts are visually verified at 768px, 1024px, 1280px, 1440px, 2560x1440, and 3840x2160.
- Representative KPIs, totals, yields, rates, and variances match the pre-change baseline.
- Print, Excel export, Settings, displayed-line preferences, Detail row mode, and maximize/restore continue to work.

---

# Future Roadmap

Near-Term

- Validation Engine improvements
- Shared Metadata Engine
- Shared utilities
- Shared calculations

Medium-Term

- Budget Planning
- FTP Engine
- Allocation Engine
- Journal Generator
- Plug Generator

Long-Term

- Scenario Engine
- Executive Dashboard
- ALM
- Capital Planning
- Multi-tenant architecture

---

# Active Development Principles

1. Deliver documented business value.
2. Preserve financial correctness.
3. Validation precedes reporting.
4. Prefer configuration and metadata over hardcoding.
5. Avoid unnecessary refactoring.
6. Document decisions before implementation.

---

# AI Guidance

Do not begin implementation until the active milestone and scope are documented.

Implementation must preserve documented business rules, metadata, validation, and treasury behavior. If a proposed change conflicts with the architecture or its business consequences are uncertain, stop and explain the conflict before proceeding.

---

# Current Repository Health

Documentation

Mature

Architecture

Mature

Business Rules

Mature

Product Vision

Mature

Implementation

Active Development

Metadata Extraction

Planned

Validation Engine

Planned

Budget Planning

Planned

FTP

Planned

ALM

Vision

---

# Reminder

Current success is measured by delivering the next approved treasury workflow safely, with validated and explainable financial results.
