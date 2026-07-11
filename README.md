# Financial Analytics Platform (TexasBank Implementation)
> Before contributing, read WHY.md.
> **Current Status:** Active Development
>
> This repository contains the TexasBank implementation of the Financial Analytics Platform. It is the production implementation used to develop treasury analytics and reporting modules. A separate repository will contain the generic platform framework.

---

# Project Overview

This project began as a Yield Statement Dashboard but has evolved into a modular Financial Analytics Platform designed for community banks.

The philosophy of the platform is:

> **If the data cannot be trusted, the reports are worthless.**

Unlike traditional BI dashboards, this platform focuses on validating, translating, and reconciling financial data before analytics are produced.

The long-term goal is to create an integrated treasury platform capable of supporting:

- Yield Statement Reporting
- Liquidity Reporting
- Budget Planning
- Scenario Analysis
- FTP
- Allocation Processing
- Journal Generation
- Plug Generation
- Executive Reporting
- ALM (Future)
- Capital Planning (Future)

---

# Current Development Status

## Completed

✅ Yield Statement Dashboard

Features include:

- Multi-period Yield Statement (MTD / QTD / YTD)
- Overview Dashboard
- Budget Comparison
- Branch Filtering
- Organization Filtering
- Account Rollups
- KPI Cards
- Attribution Analysis
- Hierarchy Editor
- Mapping Review
- Data Validation
- Iterative GL Comparison
- Financial Control Checks

---

## In Progress

### Liquidity Dashboard

Current priority.

Purpose:

- Ad hoc liquidity stress testing
- Budget growth integration
- Deposit runoff modeling
- Available liquidity reporting
- Scenario analysis

Deadline:

Production deployment scheduled for Monday.

---

# Core Philosophy

The platform is NOT dashboard-first.

The platform is:

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

Every downstream report depends upon trusted source data.

---

# Platform Architecture

Current architecture consists of five major engines.

## Data Engine

Responsible for:

- GL Imports
- Budget Imports
- Historical Data
- Repository Management

---

## Validation Engine

Responsible for:

- Import Validation
- Mapping Validation
- Financial Control Totals
- Iterative GL Comparison
- Pro Forma Balance Sheet
- Pro Forma Income Statement

No reporting should occur unless validation passes.

---

## Metadata Engine

The Metadata Engine is the heart of the platform.

It stores institution-specific metadata including:

- Organization Hierarchy
- Account Hierarchy
- Statement Mapping
- Budget Mapping
- Liquidity Mapping
- Future FTP Mapping
- Future Allocation Mapping
- Display Configuration
- Custom Calculations

The Metadata Engine allows all modules to share one source of truth.

---

## Calculation Engine

Responsible for:

- NIM
- ROAA
- Yield Calculations
- Budget Calculations
- Liquidity Calculations
- Future FTP
- Future Allocations

---

## Presentation Engine

Responsible only for displaying validated data.

Modules include:

- Yield Statement
- Liquidity
- Budget
- Executive Reporting

---

# Metadata Philosophy

The platform does not build reports directly from GL accounts.

Instead:

```
GL Accounts

↓

Metadata Translation

↓

Module-Specific View
```

Examples:

GL

↓

Yield Statement Rollup

or

GL

↓

Liquidity Category

or

Budget

↓

Statement Rollup

This allows one source of financial data to support many independent reporting modules.

---

# Quick Mapping

Quick Mapping is one of the core differentiators of the platform.

Every month-end the platform detects:

- New GL Accounts
- Missing Mappings
- Missing Organizations
- Missing Budget Lines

Finance users map new items once.

Immediately every module understands the new account.

No code changes required.

---

# Validation Philosophy

Validation is more important than visualization.

The platform performs:

- Data Validation
- Mapping Validation
- Hierarchy Validation
- Financial Validation
- Reporting Validation

Examples:

✔ Assets = Liabilities + Capital

✔ Net Income Control

✔ Branch Rollups

✔ Mapping Completeness

✔ Budget Integrity

✔ Iterative GL Variance

---

# Current Repository Structure

```
powerpages/

    yield-statement/

    liquidity/

    shared/
```

The shared folder will gradually become the reusable platform foundation.

---

# Long-Term Vision

This repository represents the TexasBank implementation.

Future development will extract reusable platform functionality into a generic repository.

Eventually the generic platform will support:

- Multiple financial institutions
- Multiple deployment models
- Cloud hosting
- On-premise hosting

using institution-specific metadata.

---

# Development Priorities

Current

1. Finish Liquidity Dashboard
2. Refine Validation Engine
3. Improve Metadata Engine
4. Refine Quick Mapping

After Monday

5. Extract Shared Hierarchy
6. Build Shared Metadata Engine
7. Refactor Calculation Engine
8. Platform Modularization

Future

- Budget Engine
- FTP Engine
- Journal Generator
- Plug Generator
- Scenario Engine
- ALM

---

# Design Principles

Every new feature should satisfy these principles.

- Preserve existing behavior.
- Prefer configuration over code.
- Finance users should maintain mappings.
- Reports consume validated data.
- Modules share metadata.
- Refactor incrementally.
- Never rewrite working financial logic without validation.

---

# Vision Statement

The Financial Analytics Platform is intended to become an end-to-end treasury operating platform for community banks.

The objective is not simply to produce reports.

The objective is to transform raw accounting data into trusted financial information that supports operational workflows including validation, reconciliation, budgeting, liquidity management, financial reporting, and future treasury analytics.
