# WHY.md
## Why This Platform Exists

Version: 1.0

---

# Before You Read Any Code

If you only read one document in this repository, read this one.

This platform was not created to build better dashboards.

It was created to solve operational treasury problems that exist in nearly every community bank.

Everything in this repository should be evaluated against one question:

> **Does this improve the treasury workflow?**

If the answer is no, question whether it belongs in the platform.

---

# The Problem

Every month a treasury department repeats nearly the same process.

The data changes.

The problems do not.

A typical month-end looks like this:

```
Core System

↓

GL Export

↓

Excel

↓

Validate

↓

Find New Accounts

↓

Map Accounts

↓

Update Reports

↓

Check Totals

↓

Reconcile

↓

Repeat

↓

Finally Produce Reports
```

The reports are the final step.

Most of the effort happens before anyone sees a dashboard.

This platform exists to automate everything that happens before the reports.

---

# The Biggest Lesson

Over years of treasury work one lesson became obvious.

> **If the data is not clean, every downstream report is worthless.**

Beautiful dashboards cannot compensate for bad data.

Sophisticated analytics cannot compensate for incorrect mappings.

ALM models cannot compensate for poor validation.

Every downstream calculation depends upon trusted inputs.

Therefore:

Validation always comes before reporting.

---

# This Is Not A Dashboard

Most financial software begins with reports.

This platform begins with trust.

The workflow is:

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

The dashboard is simply the final consumer.

It is not the platform.

---

The platform's primary product is trust.

Reports are one output of trusted financial information.

# Why Metadata Exists

Community banks are all different.

Different:

Charts of accounts.

Organizations.

Branches.

Budget structures.

Liquidity assumptions.

FTP methodologies.

Allocation methodologies.

Trying to hardcode every institution would create software that is impossible to maintain.

Instead:

The platform translates institution-specific data into a common financial model.

```
GL

↓

Metadata

↓

Module
```

Every module consumes metadata.

Nothing should bypass it.

---

# Why Quick Mapping Exists

Every month new GL accounts appear.

Traditionally someone must:

Find them.

Determine where they belong.

Update spreadsheets.

Update reports.

Hope nothing broke.

Quick Mapping exists so finance users—not developers—can teach the platform once.

One decision immediately updates every downstream module.

That is intentional.

---

# Why Validation Exists

Validation is not a feature.

Validation is the foundation.

The platform should never silently assume data is correct.

It should prove it.

Validation includes:

- Data integrity
- Mapping completeness
- Hierarchy integrity
- Financial controls
- Budget integrity
- Iterative GL comparisons
- Future journal balancing
- Future ALM reconciliation

Only after validation succeeds should reports be trusted.

---

# Why The Metadata Engine Exists

Hierarchy is only one part of the platform.

The Metadata Engine exists because every institution describes financial information differently.

Metadata defines:

Organization.

Accounts.

Statement structure.

Budget mappings.

Liquidity mappings.

FTP mappings.

Allocation mappings.

Display configuration.

Custom calculations.

Future modules should extend metadata.

Not replace it.

---

# Why The Platform Is Modular

The platform is expected to grow for years.

Future modules include:

- Liquidity
- Budget
- FTP
- Allocations
- Journal Generation
- Plug Generation
- Scenario Analysis
- Executive Reporting
- ALM
- Capital Planning

Every new module should reuse existing engines.

New modules should add functionality.

Not duplicate it.

---

# Why The Validation Engine Matters

Financial reporting software should never produce numbers it knows cannot be trusted.

If validation fails:

The platform should clearly communicate that the data is not trusted.

Confidence is an output of the platform.

Not just reports.

---

# Why The Workflow Matters

The platform models treasury operations.

Not accounting.

Not reporting.

Treasury.

The workflow should become:

```
Import

↓

Validation

↓

Metadata

↓

Quick Mapping

↓

Hierarchy Review

↓

Reporting

↓

Liquidity

↓

Budget

↓

Journal Generation

↓

Future ALM
```

Every feature should improve this workflow.

---

# The Long-Term Vision

The long-term objective is not to create another reporting package.

The objective is to build the operating platform used by treasury departments at community banks.

The platform should become the trusted source for:

Financial reporting.

Liquidity.

Budgeting.

Validation.

FTP.

Allocations.

Journal generation.

Scenario analysis.

Eventually ALM.

---

# Principles

Every future engineering decision should follow these principles.

Validation precedes analytics.

Metadata is the source of truth.

Configuration is preferred over code.

Finance users maintain mappings.

Business rules belong in metadata.

Refactor incrementally.

Preserve financial correctness.

Never sacrifice trust for convenience.

---

# To Future Engineers

Many pieces of this platform appear more complicated than necessary.

They probably are.

Most of that complexity exists because it solved a real treasury problem.

Before removing logic, ask:

What operational problem was this solving?

If the answer is unknown, investigate before simplifying.

Assume the platform contains years of accumulated treasury knowledge.

Treat that knowledge as carefully as the code itself.

---

# The Ultimate Goal

The platform should allow treasury professionals to spend less time preparing information...

...and more time making decisions.

That is why this software exists.
