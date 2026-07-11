# AGENT.md
## Financial Analytics Platform Engineering Constitution

Version: 1.0

---

# Purpose

This document exists to guide every engineer and every AI agent that contributes to this repository.

It defines how the platform should evolve.

It is more important than implementation details.

If implementation and this document disagree, assume this document represents the intended architecture unless explicitly directed otherwise.

---

# Platform Identity

This project is NOT:

- A dashboard
- A reporting tool
- A BI application
- A JavaScript project

This project IS:

> A Financial Operating Platform for Community Banks.

Dashboards are only consumers of the platform.

The platform itself exists to transform raw accounting information into trusted financial information.

---

# Core Philosophy

The platform follows one guiding principle:

> If the data cannot be trusted, every downstream report is worthless.

Everything else exists to support this philosophy.

The platform follows this workflow:

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

Reports are the final output.

They are never the objective.

---

# Guiding Principles

## Principle 1

Validation precedes analytics.

No report should be trusted until validation succeeds.

---

## Principle 2

Metadata is the canonical source of truth.

The platform is metadata-driven.

Business rules should live inside metadata whenever possible.

---

## Principle 3

Configuration over code.

If finance users can configure something safely, it should not require a developer.

---

## Principle 4

Business logic is more important than clean code.

Financial correctness always outweighs elegance.

---

## Principle 5

Never change treasury behavior without understanding why it exists.

Many calculations represent operational experience accumulated over years.

If something appears redundant, assume it solves a treasury problem until proven otherwise.

---

# Product Vision

The platform exists to solve treasury operational problems.

It automates:

- Data validation
- Metadata management
- Mapping maintenance
- Financial reconciliation
- Budget translation
- Yield reporting
- Liquidity reporting
- Future FTP
- Future Journal Generation
- Future Plug Generation
- Future ALM

The platform is workflow-centric.

Not report-centric.

---

# Treasury Philosophy

Treasury teams spend significant time every month performing operational work before analysis begins.

Typical workflow:

GL Export

↓

Validation

↓

Finding new accounts

↓

Mapping

↓

Checking balances

↓

Reconciling differences

↓

Producing reports

The platform automates this workflow.

Every new feature should improve treasury operations.

Not simply improve visualization.

---

# Architecture

The platform consists of several major engines.

## Data Engine

Responsible for importing financial information.

Examples:

GL

Budget

Historical

Repository

---

## Validation Engine

Responsible for determining whether information can be trusted.

Validation includes:

Data

Mappings

Hierarchy

Financial Controls

Reporting

Future Journal Validation

Future ALM Validation

---

## Metadata Engine

The Metadata Engine is the heart of the platform.

It contains:

Organization Hierarchy

Account Hierarchy

Statement Hierarchy

Budget Mapping

Liquidity Mapping

FTP Mapping

Allocation Mapping

Display Configuration

Custom Calculations

Future Modules

Every module consumes Metadata.

Modules should never maintain independent mappings.

---

## Calculation Engine

Responsible for:

Yield

Rates

NIM

ROA

Budget

Liquidity

Future FTP

Future Allocation

Future ALM

---

## Workflow Engine

Responsible for guiding treasury operations.

Import

Validation

Quick Mapping

Hierarchy Review

Reporting

Journal Generation

Future Scenario Analysis

---

## Presentation Engine

Responsible only for displaying validated financial information.

Examples:

Yield Statement

Liquidity

Budget

Executive Dashboard

---

# Metadata Philosophy

Metadata is not a hierarchy.

Metadata describes how the institution interprets financial information.

Examples:

GL Account

↓

Statement Rollup

GL Account

↓

Liquidity Category

Budget Line

↓

Statement Rollup

Metadata allows multiple modules to consume the same financial information.

Metadata should become more configurable over time.

Never less.

---

# Validation Philosophy

Validation is a first-class subsystem.

Validation is NOT a feature.

Validation exists to produce confidence.

Examples:

Assets = Liabilities + Capital

Net Income Control

Hierarchy Validation

Mapping Completeness

Budget Validation

Iterative GL Validation

Future Journal Validation

If validation fails:

Reports should communicate that the dataset is not trusted.

---

# Quick Mapping Philosophy

Quick Mapping is one of the platform's core differentiators.

Finance users should maintain mappings.

Developers should not.

One mapping should immediately improve every downstream module.

Future modules should automatically consume existing mappings.

---

# Development Philosophy

Prefer:

Configuration

↓

Metadata

↓

Reusable Engines

↓

Modules

Avoid:

Hardcoded business rules

Duplicate hierarchy logic

Module-specific mappings

---

# Coding Philosophy

Extract existing functionality.

Do not rewrite working financial calculations.

Small refactors are preferred.

Incremental improvements are preferred.

Every change should leave the application working.

---

# Refactoring Rules

Preferred maximum change:

300 lines

Extract.

Test.

Repeat.

Never perform large rewrites.

Never optimize financial calculations unless output is verified to be identical.

---

# Financial Integrity

The following are considered critical.

Never modify without explicit validation.

lineMeasure()

periodLineMeasure()

NIM calculations

Rate calculations

Budget translation

Hierarchy traversal

Mapping logic

Financial controls

---

# Module Strategy

Modules should remain independent.

Modules should consume shared engines.

Current modules:

Yield Statement

Liquidity

Future modules:

Budget

FTP

Allocation

Journal Generator

Plug Generator

Scenario Engine

Executive Dashboard

ALM

Capital Planning

---

# AI Expectations

Before proposing code changes:

Understand the treasury problem.

Understand the metadata.

Understand the validation.

Understand the workflow.

Then implement.

AI should prefer explaining architectural tradeoffs before writing code.

---

# Things Never To Do

Never bypass Validation.

Never duplicate Metadata.

Never rewrite business calculations because they appear complicated.

Never simplify treasury logic without understanding its operational purpose.

Never move quickly at the expense of financial correctness.

Never assume code duplication should automatically be removed.

Sometimes duplication exists to preserve operational stability.

---

# Decision Framework

Every proposed feature should answer YES to at least one:

Does this improve treasury workflow?

Does this improve trust?

Does this improve validation?

Does this reduce duplicated business rules?

Does this move logic into metadata?

Does this reduce operational effort?

If not...

Question whether it belongs in the platform.

---

# Current Priorities

Current:

Finish Liquidity Dashboard

Improve Validation Engine

Improve Metadata Engine

Improve Quick Mapping

After current milestone:

Shared Metadata Engine

Shared Calculation Engine

Platform modularization

Future:

Budget

FTP

Journal Generation

Plug Generation

Scenario Engine

ALM

---

# Long-Term Vision

The Financial Analytics Platform should eventually become the operating system for treasury departments at community banks.

Every module should build upon the same trusted foundation.

Data.

↓

Validation.

↓

Metadata.

↓

Calculation.

↓

Workflow.

↓

Presentation.

This ordering should remain consistent throughout the life of the platform.

---

# Final Note

This software was designed by a treasury professional.

Many architectural decisions represent years of operational experience.

If something appears unnecessary, assume it solves a real treasury problem until proven otherwise.

The objective is not simply to produce reports.

The objective is to produce trusted financial information.
