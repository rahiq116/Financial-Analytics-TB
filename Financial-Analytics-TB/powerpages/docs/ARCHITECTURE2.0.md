# Financial Analytics Platform — Engineering Documentation

**Document Version:** 3.0  
**Written For:** Incoming development team with no prior treasury domain knowledge  
**Document Date:** 2026-07-11  
**Repository:** `Financial-Analytics-TB`  
**Primary Codebase:** `powerpages/` directory — Microsoft Power Pages HTML/JS application  

---

## Table of Contents

1. [Repository Orientation](#1-repository-orientation)
2. [Treasury Domain Crash Course](#2-treasury-domain-crash-course)
3. [System Architecture Overview](#3-system-architecture-overview)
4. [Subsystem A: Metadata / Hierarchy Engine](#4-subsystem-a-metadata--hierarchy-engine)
5. [Subsystem B: Data Ingestion Pipeline](#5-subsystem-b-data-ingestion-pipeline)
6. [Subsystem C: Indexing Layer](#6-subsystem-c-indexing-layer)
7. [Subsystem D: Calculation Engine](#7-subsystem-d-calculation-engine)
8. [Subsystem E: Mapping Engine](#8-subsystem-e-mapping-engine)
9. [Subsystem F: Budget Engine](#9-subsystem-f-budget-engine)
10. [Subsystem G: Rendering Engine](#10-subsystem-g-rendering-engine)
11. [Subsystem H: Settings & Configuration](#11-subsystem-h-settings--configuration)
12. [Subsystem I: Persistence Layer](#12-subsystem-i-persistence-layer)
13. [Subsystem J: Theming & Branding](#13-subsystem-j-theming--branding)
14. [Subsystem K: Print Engine](#14-subsystem-k-print-engine)
15. [Subsystem L: Hierarchy Editor](#15-subsystem-l-hierarchy-editor)
16. [Subsystem M: Liquidity Projection Engine](#16-subsystem-m-liquidity-projection-engine)
17. [Subsystem N: Error Handling & Diagnostics](#17-subsystem-n-error-handling--diagnostics)
18. [Subsystem O: Event System](#18-subsystem-o-event-system)
19. [Cross-Subsystem Dependencies](#19-cross-subsystem-dependencies)
20. [Startup Sequence](#20-startup-sequence)
21. [Data Schema Reference](#21-data-schema-reference)
22. [Common Pitfalls](#22-common-pitfalls)
23. [Technical Debt Registry](#23-technical-debt-registry)

---

## 1. Repository Orientation

### 1.1 File Inventory

```
Financial-Analytics-TB-main/
│
├── .gitignore                          (429 lines — Visual Studio standard gitignore)
├── README.md                           (37 lines — Project overview, module list, architecture vision)
├── ARCHITECTURE.md                     ← YOU ARE HERE
│
└── Financial-Analytics-TB/
    └── powerpages/
        │
        ├── shared/                     ← INTENDED shared-services directory
        │   ├── hierarchy.js            (1 line — EMPTY. Presence confirms design intent to share)
        │   └── readme.md               (1 line — EMPTY)
        │
        ├── yield-statement/            ← Production module
        │   ├── index.html              (604 lines — HTML shell, embedded CSV data, UI structure)
        │   ├── yield-dashboard.css     (612 lines — All CSS including print styles)
        │   └── yield-dashboard.js      (11,660 lines — THE ENTIRE APPLICATION in one file)
        │
        └── liquidity/                  ← In-progress module
            └── liquidity-dashboard.html (731 lines — Self-contained HTML+CSS+JS+JSON data)
```

### 1.2 What Each File Actually Contains

**`index.html` (Yield Statement):**
- Standard HTML5 document structure
- `<link>` to `yield-dashboard.css`
- `<div class="shell">` — the entire UI: topbar (brand logo, print menu, settings button, hidden file inputs), filter rows (date, view, org picker, account picker, comparison dates), display settings panel, tab navigation (Overview, Summary, Yield Statement MTD/QTD/YTD, Budget MTD/QTD/YTD, Detail 13M/Var/BtA/Attr), all tab panels with placeholder elements for tables and charts, a hidden print report container
- `<script id="embeddedCsv">` — 250KB+ of gzip-base64 encoded CSV data containing ~18 months of GL trial balance data for all branches
- `<script id="embeddedApprovedBudget">` — gzip-base64 encoded budget data
- `<script src="yield-dashboard.js">` — the single script that makes everything work

**`yield-dashboard.css` (Yield Statement):**
- CSS custom properties defining the full color system with semantic names
- Global reset and body styles with a radial-gradient background
- Layout: `.shell` (max-width container), `.topbar` (header), `.filters` (filter grid), `.tabs` (tab navigation), `.tab-panel` (content panels)
- Component styles: `.metric-grid` (KPI cards), `.mini-grid` (donut charts), `.dashboard` (main content), `.panel` (card containers), `.statement-wrap` (scrollable tables)
- Table styles: `.mom-table`, `.report-table`, `.comparison-table`, `.attribution-table`, `.branch-variance-table`, `.thirteen-month-table` — each with specific column widths, frozen header behavior, border separators, color-coded rows (section-row, total-row, metric-row, drill-row)
- Interactive components: `.org-picker-popover`, `.account-picker-popover` (tree popovers with search), `.hierarchy-editor` (tree browser), `.mapping-table-wrap` (scrollable data tables), `.display-grid` (checkbox grid)
- Print styles (`@media print`): Complete page formatting with landscape page support, compact table sizing, header/branding reproduction
- Responsive breakpoints at 1180px and 780px
- The entire application visual identity in one file

**`yield-dashboard.js` (Yield Statement):**
- 11,660 lines. No imports. No exports. No modules. No classes.
- Everything is a `const`, `let`, `function`, or IIFE in the global scope.
- Contains: 200+ individual functions, ~10 major data arrays (totaling ~3000 lines of hardcoded hierarchy data), all business logic, all UI rendering, all event handling, all persistence, all calculations.
- This IS the application. The HTML and CSS are just the shell.

**`liquidity-dashboard.html` (Liquidity Dashboard):**
- Self-contained. No external CSS, no external JS.
- `<style>` block defines the visual identity (duplicated color variables from Yield Statement)
- `<body>` contains the HTML structure
- `<script id="embeddedLiquidityData">` contains the ENTIRE dataset as JSON: hierarchy, GL balances, contractual cashflows, ratio definitions, default assumptions, file inventory, build metadata
- `<script>` block at the bottom contains ~500 lines of inline JavaScript: projection engine, ratio calculator, rendering functions, event handlers
- This file is GENERATED by a build tool that reads source files, runs calculations, and produces a self-contained dashboard file

### 1.3 Code Volume Summary

| Component | Lines | % of Total |
|---|---|---|
| `yield-dashboard.js` | 11,660 | 85.6% |
| `liquidity-dashboard.html` | 731 | 5.4% |
| `yield-dashboard.css` | 612 | 4.5% |
| `index.html` | 604 | 4.4% |
| `.gitignore` | 429 | (utility) |
| `README.md` | 37 | (documentation) |
| `shared/hierarchy.js` | 1 | (placeholder) |
| `shared/readme.md` | 1 | (placeholder) |
| **Total** | **~13,600** | |

---

## 2. Treasury Domain Crash Course

Before reading the subsystem documentation, you need to understand the financial concepts this platform models. The following is deliberately simplified — it is enough to understand the code.

### 2.1 What is a Community Bank?

A community bank is a depository institution (like TexasBank in this codebase) that takes deposits from local customers and makes loans to local businesses and individuals. It typically has 5-30 physical branches serving a specific geographic region. The bank earns money from the spread between what it pays depositors (interest expense on savings accounts, CDs, money markets) and what it charges borrowers (interest income on commercial loans, mortgages, consumer loans).

### 2.2 The General Ledger (GL)

Every financial transaction in the bank flows through a general ledger account. GL accounts are identified by 6-digit numeric codes. The code ranges encode meaning:

| GL Range | Meaning |
|---|---|
| `100000–199999` | **Assets** — things the bank owns (cash, loans, securities, buildings) |
| `200000–209999` | **Liabilities** — obligations the bank owes (deposits, borrowings) |
| `209000–299999` | **Capital** — shareholders' equity |
| `300000–399999` | **Interest Income** — money earned from loans and investments |
| `400000–499999` | **Interest Expense** — money paid to depositors and lenders |
| `500000–599999` | **Non-Interest Income** — fees, service charges, gains on sales |
| `600000–699999` | **Non-Interest Expense** — salaries, rent, IT, operating costs |

Each month, the bank produces a trial balance: a list of every GL account, its ending balance, and (for income/expense accounts) the monthly activity. This is the raw input to the platform.

### 2.3 The Yield Statement

The yield statement answers one question: **"How much money is the bank making from the spread between what it earns on assets and what it pays on liabilities?"**

It looks like:
```
                        Avg Balance    Interest Inc/Exp    Rate
SHORT TERM INVESTMENTS    $12,500,000      $52,000         5.00%
SECURITIES               $45,000,000     $180,000         4.80%
TOTAL INVESTMENTS        $57,500,000     $232,000         4.84%

COMMERCIAL LOANS        $120,000,000     $540,000         5.40%
MORTGAGE LOANS           $85,000,000     $357,000         5.04%
GROSS LOANS             $205,000,000     $897,000         5.25%

EARNING ASSETS          $262,500,000   $1,129,000         5.16%

DEMAND DEPOSITS          $80,000,000          $0         0.00%  (no interest)
MONEY MARKET             $60,000,000      $45,000         0.90%
TIME DEPOSITS            $40,000,000      $30,000         0.90%
TOTAL DEPOSITS          $180,000,000      $75,000         0.50%

BORROWINGS               $25,000,000      $22,000         1.06%
TOTAL FUNDING LIAB.     $205,000,000      $97,000         0.57%

NET INTEREST INCOME                      $1,032,000
NET INTEREST MARGIN (NIM)                                   4.72%
```

**Key ratios calculated:**
- **Yield** = Annualized Interest Income / Average Balance (for earning assets)
- **Cost of Funds** = Annualized Interest Expense / Average Balance (for funding liabilities)
- **NIM (Net Interest Margin)** = Annualized Net Interest Income / Average Earning Assets
- **Spread** = Earning Asset Yield − Funding Liability Cost
- All rates are annualized: a monthly income number is multiplied by 12, 365/days, or 360/days depending on the day count convention

### 2.4 Average Balance vs. Ending Balance

- **Ending Balance:** What the account balance was on the last day of the month
- **Average Balance:** The average daily balance across the entire month (more accurate for rate calculations)

The platform calculates rates from Average Balance, not Ending Balance. If only ending balances are available, the rate calculation degrades but still works.

### 2.5 Annualization (Day Count Conventions)

A monthly income figure must be converted to an annual rate. The method depends on the instrument:

| Convention | Formula | Used For |
|---|---|---|
| `30/360` | `rate = income * 12 / avgBalance` | Mortgages, securities |
| `90/360` | `rate = income * 4 / avgBalance` | FHLB stock (quarterly dividends) |
| `Actual/365` | `rate = income * 365 / avgBalance / daysInMonth` | Most loans and deposits |
| `ACT/360` | `rate = income * 360 / avgBalance / daysInMonth` | Money market instruments |
| `Weighted` | Weighted average of child rates by their balances | Rollup/parent lines |

### 2.6 Funds Transfer Pricing (FTP)

FTP assigns a "transfer price" to every deposit and loan to measure the true profitability of each branch or business line. Conceptually: the treasury desk "buys" deposits from branches at a wholesale rate and "sells" funding to loan officers at a wholesale rate. The difference is the branch's contribution to net interest income.

In this platform, FTP appears as a line item on the yield statement when viewing a single branch (not consolidated). It contains special GL accounts (302010) that represent the transfer pricing credits and charges.

### 2.7 Branch Allocations (Cost Allocation)

Overhead costs (IT, HR, executive salaries) must be allocated to individual branches for branch-level P&L reporting. The platform handles this through allocation accounts (605010–605100 range). When viewing consolidated results, allocations are excluded. When viewing a single branch, allocations are included.

This is a critical validation concern: allocation rows must be verified for completeness before branch-level reports are trusted.

### 2.8 NIM (Net Interest Margin) — Two Versions

The platform calculates two NIM metrics:

1. **Monthly NIM*** — Uses adjusted average assets (max of deposits or earning asset build-up), simple NII ÷ earning assets × 12. Used internally for monthly performance tracking.

2. **UBPR NII/AEA**** — Uses tax-equivalent NII (grosses up tax-exempt municipal income by dividing by 0.79 to make it comparable to taxable income), divided by strict earning assets. This matches regulatory call report methodology.

### 2.9 Budget-to-Actual (BtA)

The bank produces an annual budget: projected balances and income/expense for each statement line, broken down by month. The platform compares actual results against the budget and shows variance (difference) and percentage change.

Budget data comes from XLSX workbooks that contain multiple "views" (Balance, IncExp) and multiple "versions" (original budget, reforecast 1, reforecast 2, etc.).

### 2.10 Liquidity (The Other Dashboard)

Liquidity measures the bank's ability to meet its cash obligations. A bank fails when it runs out of cash, not when it's unprofitable.

**Key concepts:**
- **Overnight position:** Cash at the Federal Reserve — the most liquid asset
- **Runoff:** Deposits that leave the bank as customers withdraw funds
- **Contingent liquidity:** Backup funding sources (FHLB line, Fed Funds lines, brokered CD capacity)
- **Liquidity waterfall:** A period-by-period projection of cash sources and uses
- **Liquidity coverage ratios:** Regulatory metrics measuring the bank's ability to survive a stress scenario

The Liquidity Dashboard projects 13 months forward, starting from the most recent actual month and applying category-level growth assumptions (defaulting to 0% for a "runoff view").

### 2.11 Organization Hierarchy (Branches)

The bank is organized as:
```
Holding Company (top-level)
└── TexasBank (the bank entity)
    ├── Commercial Banking Division
    │   └── Central Texas (region)
    │       ├── Brown County
    │       │   ├── 01 - Brownwood (branch #1)
    │       │   ├── 02 - Market Place (branch #2)
    │       │   ├── 03 - Bangs (branch #3)
    │       │   └── 04 - Camp Bowie (branch #4)
    │       ├── Comanche County
    │       │   └── 10 - Comanche (branch #10)
    │       └── Erath County
    │           ├── 05 - Stephenville (branch #5)
    │           ├── 06 - Graham (branch #6)
    │           ├── 07 - Dublin (branch #7)
    │           └── 09 - Eastland (branch #9)
    └── Big Country (region)
        └── Project Eagle (branch #12)
```

Every GL row has a branch number. The hierarchy maps branch numbers to organizational units. Leaf nodes (actual branches) have a `Map` value (the branch number). Parent nodes roll up all descendant branch balances (with `UnaryOper` indicating whether to add or subtract in consolidation).

### 2.12 Statement Hierarchy (Account Rollups)

The 500+ GL accounts are organized under statement lines:

```
Total Assets
├── Earning Assets
│   ├── Total Investments
│   │   ├── Short Term Investments
│   │   │   ├── Interest Bearing Cash  (GL: 102010, 102020)
│   │   │   └── Due From Banks         (GL: 102999)
│   │   ├── Securities                  (GL: 104299, 104399, ...)
│   │   ├── Total Securities MTM       (GL: 104292 — mark-to-market adjustment)
│   │   └── FHLB Stock                 (GL: 104500)
│   └── Net Loans
│       ├── Gross Loans
│       │   ├── Total Commercial Bank
│       │   │   ├── Commercial Loans
│       │   │   ├── Consumer Loans
│       │   │   ├── CRE Loans
│       │   │   ├── 1-4 Family Investment Loans
│       │   │   └── Tax Exempt Loans
│       │   ├── Total Mortgage Bank Loans
│       │   │   ├── Portfolio Mortgage Loans
│       │   │   ├── Net Loans Purchased
│       │   │   ├── Held For Sale
│       │   │   └── Participations
│       │   └── Other Loan Items
│       └── Loan Loss Reserve          (contra-asset, reduces loans)
└── Non Earning Assets
    ├── Cash & Cash Items
    ├── Accrued Interest Receivable
    ├── Total Premises & Equipment
    ├── Other Assets
    ├── Goodwill
    ├── MSR (Mortgage Servicing Rights)
    └── Other items
```

Each statement line definition includes lists of GL account codes that belong to it (`bal` for balance sheet accounts, `inc` for income/expense accounts) and flags that control calculation behavior.

---

## 3. System Architecture Overview

The platform is a **client-side single-page application** that runs entirely in the browser. There is no server-side processing. All data processing, calculation, and rendering happens in JavaScript.

### 3.1 Runtime Environment

- **Host:** Microsoft Power Pages (low-code platform)
- **Execution:** Standard browser JavaScript (no build step, no bundler, no framework)
- **Storage:** localStorage (small config), IndexedDB (large data caches), File System Access API (network file shares)
- **Dependencies:** None (except XLSX.js loaded at runtime for Excel parsing)

### 3.2 Architectural Pattern

The platform follows a **Self-Contained Data + Client-Side Calculation** pattern:

1. **Build time** (external to the application): Source GL files and hierarchy workbooks are processed and embedded into the HTML as compressed JSON or CSV data
2. **Runtime:** The dashboard decodes embedded data, applies user configurations, runs calculations, and renders reports
3. **Optional runtime:** Users can connect to live data folders on network shares for self-service refresh

### 3.3 Subsystem Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         THE APPLICATION                                   │
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  METADATA   │  │    DATA     │  │  MAPPING    │  │   BUDGET    │     │
│  │  HIERARCHY  │  │  INGESTION  │  │   ENGINE    │  │   ENGINE    │     │
│  │  ENGINE     │  │  PIPELINE   │  │             │  │             │     │
│  │  (A)        │  │  (B)        │  │  (E)        │  │  (F)        │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
│         │                │                │                │            │
│         └────────────────┼────────────────┼────────────────┘            │
│                          │                │                             │
│                   ┌──────┴──────┐  ┌──────┴──────┐                      │
│                   │  INDEXING   │  │ CALCULATION │                      │
│                   │   LAYER     │  │   ENGINE    │                      │
│                   │  (C)        │  │  (D)        │                      │
│                   └──────┬──────┘  └──────┬──────┘                      │
│                          │                │                             │
│                          └────────┬───────┘                             │
│                                   │                                     │
│                          ┌────────┴────────┐                            │
│                          │    RENDERING    │                            │
│                          │     ENGINE      │                            │
│                          │     (G)         │                            │
│                          └────────┬────────┘                            │
│                                   │                                     │
│         ┌───────────────┬─────────┼──────────┬──────────────┐           │
│         │               │         │          │              │           │
│  ┌──────┴──────┐ ┌──────┴──────┐ ┌┴────────┐ ┌┴───────────┐ ┌┴───────┐ │
│  │ PERSISTENCE │ │  SETTINGS  │ │ THEMING │ │   PRINT     │ │EVENT   │ │
│  │  LAYER      │ │   SYSTEM   │ │ (J)     │ │   ENGINE    │ │SYSTEM  │ │
│  │  (I)        │ │  (H)       │ │         │ │   (K)       │ │(O)     │ │
│  └─────────────┘ └─────────────┘ └─────────┘ └─────────────┘ └────────┘ │
│                                                                          │
│  MODULE-SPECIFIC ENGINES:                                                │
│  ┌──────────────────────┐  ┌──────────────────────┐                      │
│  │ HIERARCHY EDITOR     │  │ LIQUIDITY PROJECTION │                      │
│  │ (L)                  │  │ ENGINE (M)           │                      │
│  └──────────────────────┘  └──────────────────────┘                      │
│                                                                          │
│  CROSS-CUTTING:                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ ERROR HANDLING & DIAGNOSTICS (N)                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.4 How Subsystems Interact (Simplified)

```
Startup:
  Persistence(I) → reads IndexedDB cache → Data Pipeline(B)
  Data Pipeline(B) → parses → normalizes → Indexing Layer(C)
  Persistence(I) → reads localStorage → Metadata(A) + Settings(H)
  Metadata(A) → validates org/acct/statement trees
  Settings(H) → applies hierarchy edits from shared workbook
  
User Action (e.g., change date filter):
  Event System(O) → detects change → invokes Calculation Engine(D)
  Calculation(D) → reads Indexing Layer(C) for raw amounts
  Calculation(D) → reads Metadata(A) for which GL codes belong to which line
  Calculation(D) → reads Mapping Engine(E) for user-overridden mappings
  Calculation(D) → reads Budget Engine(F) if budget tab is active
  Calculation(D) → computes avg, balance, inc, rate → returns measure objects
  Rendering Engine(G) → receives measures → builds HTML tables + SVG charts
  Rendering Engine(G) → reads Theming(J) for colors
  Rendering Engine(G) → writes to DOM
```

---

## 4. Subsystem A: Metadata / Hierarchy Engine

**Location:** `yield-dashboard.js` (scattered), `liquidity-dashboard.html` (duplicated)  
**Lines:** ~2,500 across both files  
**Primary purpose:** Define and validate the three hierarchy trees that govern all calculations.

### 4.1 Why It Exists

Without a hierarchy engine, the platform would have no way to answer:
- "Which branches roll up into Central Texas?"
- "Which GL accounts contribute to 'Commercial Loans'?"
- "Is 'Net Interest Income' a parent of other lines?"

Every calculation in the platform depends on tree traversal. If hierarchy metadata were absent or wrong, every number on every report would be wrong.

### 4.2 The Three Hierarchy Trees

#### 4.2.1 Organization Tree (`organizationNodes[]`)

A parent-child tree representing the bank's organizational structure. Each node has:

| Field | Type | Meaning |
|---|---|---|
| `OrganizationKey` | number | Unique ID |
| `OrganizationParentKey` | number | Parent node ID (0 = root) |
| `OrganizationName` | string | Display name |
| `UnaryOper` | string | `"+"` or `"-"` for consolidation sign |
| `SortOrder` | number | Display ordering |
| `Map` | string | Branch number (leaf nodes only; empty for parent nodes) |

**Why `Map` is empty on parent nodes:** The code enforces this via `clearOrganizationRollupMaps()`. A parent node represents a conceptual grouping, not a physical branch. Only leaf nodes (actual branches) have branch number mappings.

**The Map field's purpose:** When a user selects "Central Texas" in the org picker, the system must know which branch numbers to filter. It walks the tree from the selected node downward, collecting all `Map` values from leaf descendants.

#### 4.2.2 Account Tree (`accountNodes[]`)

Organizes GL accounts into the financial statement structure. Each node:

| Field | Type | Meaning |
|---|---|---|
| `AccountKey` | number | Unique ID |
| `AccountParentKey` | number | Parent node ID |
| `AccountName` | string | Name (e.g., "101015 - VAULT CASH") |
| `UnaryOper` | string | `"+"` or `"-"` |
| `SortOrder` | number | Display ordering |
| `Map` | string | 6-digit GL account code (leaf nodes only) |
| `AccountType` | string | Statement rollup label (e.g., "Cash") |
| `StatementRollup` | string | Same as AccountType (used for statement line assignment) |
| `MappingType` | string | `"balance"`, `"incexp"`, `"ftp"`, `"allocation"`, `"ignore"`, or `"auto"` |

This tree is separate from `statementNodes[]` because it represents the *accounting* hierarchy, not the *reporting* hierarchy. The two merge through the `StatementRollup` field.

#### 4.2.3 Statement Tree (`statementNodes[]`)

Defines the reporting lines that appear on the yield statement. Each node:

| Field | Type | Meaning |
|---|---|---|
| `StatementKey` | number | Unique ID |
| `StatementParentKey` | number | Parent statement line ID |
| `StatementName` | string | Display name (e.g., "Commercial Loans") |
| `SortOrder` | number | Display ordering |
| `Frozen` | boolean | If true, always visible in statements (cannot be collapsed) |
| `Annualization` | string | Override for day count convention |

**Frozen lines** are the backbone of the report — they always appear at their default position. Users can configure additional "always display" lines via the Display Settings panel, but they appear with indentation and are not considered structural.

### 4.3 Tree Index Functions

These functions transform the flat arrays into lookup structures for efficient traversal:

#### `orgChildrenMap()`
```
Input: nothing (reads global organizationNodes[])
Output: Map<parentKey, childNode[]>
```
Builds a parent→children index. Sorted by `SortOrder`, then `OrganizationName`. Cached in `orgChildMapCache`.

#### `descendantOrgMaps(orgKey)`
```
Input: Organization key (e.g., 91 for "Central Texas")
Output: Set of branch number strings (e.g., {"1","2","3","4","10","5","6","7","9"})
```
Walks the tree from the given node downward. Collects `Map` values from all leaf descendants. Used by the branch filter to know which GL rows to include. Cached in `orgDescendantCache`.

#### `orgOptionRows()`
```
Input: nothing
Output: Array of {value, parentValue, key, label, path, depth, count, isLeaf, selectable, hasChildren, searchText}
```
Builds the hierarchical option data for the organization picker popover. Each row knows its display label, indent depth, how many branches it rolls up, whether it's selectable (has descendant branch maps), and a pre-built search text for filtering.

#### `statementRenderableLines()`
```
Input: nothing
Output: Array of statement line objects (from momLines[] + synthetic nodes)
```
Filters `momLines[]` to only include lines whose labels exist in the active statement hierarchy. Also adds synthetic lines for statement nodes that exist in the hierarchy but weren't defined in `momLines[]`.

#### `childCategoriesFor(label)`
```
Input: Statement line label (e.g., "Total Commercial Bank")
Output: Array of child label strings (e.g., ["Commercial Loans", "Consumer Loans", "CRE Loans", ...])
```
Finds statement nodes whose parent has the given label. Used by rollup calculations to sum child values.

### 4.4 Hierarchy Validation Functions

#### `ensureRequiredOrganizationNodes()`
Called at startup and after applying saved hierarchy edits. Performs:

1. **Remove vestigial nodes:** Deletes any node named "no branch" (a legacy placeholder)
2. **Ensure Holding Company exists:** Creates it at key 900 if absent, forces parent to 0
3. **Fix orphaned nodes:** Any node with children or a Map value that has no valid parent gets reparented to Holding Company
4. **Ensure Big Country exists:** Creates at key 1001 if absent
5. **Ensure Project Eagle exists:** Creates at key 1002 with Map "12" if absent
6. **Clear rollup maps:** Calls `clearOrganizationRollupMaps()` to ensure parent nodes don't have branch maps

This function is critical for data integrity. Without it, branch selections would silently miss branches or include wrong ones.

#### `normalizeKnownHierarchyMappings()`
Called at startup. Contains audit-forced rollup assignments. This function exists because the shared hierarchy workbook sometimes drifts from what finance expects. It hardcodes corrections for:

- **8 specific GL account codes** assigned to specific rollups (e.g., account 202125 → "Correspondent Money Market")
- **14 budget line keys** assigned to specific rollups (e.g., `assetbalancing` → "Short Term Investments")
- **30+ budget audit keys** auto-created with specific rollups and names

This function also creates missing budget line mappings for known keys, ensuring the budget tab works even before the finance team has completed their mapping review.

#### `enforceSingleStatementRollupAssignments()`
Prevents a GL account from being assigned to conflicting rollups. Builds a canonical map from quick GL mappings and account node fields, then applies the single authoritative assignment to all account nodes with that code.

### 4.5 How Other Subsystems Use the Hierarchy Engine

| Subsystem | What It Asks | Function Used |
|---|---|---|
| Calculation Engine (D) | "Which GL codes roll into 'Total Commercial Bank'?" | `lineBalanceCodes()` → `accountDimensionLeaves()` → `descendantOrgMaps()` |
| Calculation Engine (D) | "What are the child lines of 'Gross Loans'?" | `childCategoriesFor()` |
| Calculation Engine (D) | "Is 'Total Assets' a frozen line?" | `isFrozenStatementLabel()` → checks `statementNodes[].Frozen` |
| Rendering Engine (G) | "What indent level should 'Consumer Loans' have?" | `visibleMomIndent()` → walks parent chain |
| Rendering Engine (G) | "Which statement lines should appear on the MoM tab?" | `statementRenderableLines()` → `isBaseVisibleMomLine()` |
| Rendering Engine (G) | "What goes in the org picker popover?" | `orgOptionRows()` |
| Mapping Engine (E) | "Which rollups exist for mapping GL accounts to?" | `quickMappingRollupOptions()` → `accountRollupOptions()` |
| Hierarchy Editor (L) | "What's the current org tree?" | `hierarchyTreeMaps()` |
| Event System (O) | "Which branches are selected?" | `selectedBranchMaps()` → `descendantOrgMaps()` |

---

## 5. Subsystem B: Data Ingestion Pipeline

**Location:** `yield-dashboard.js` (parseCsv, normalize, applyRows)  
**Lines:** ~200  
**Primary purpose:** Convert raw financial data files into the normalized row format used by the indexing layer.

### 5.1 Why It Exists

The bank's core system exports GL data in various formats: CSV files with inconsistent headers, Excel workbooks with multiple sheets, and folder structures with date-encoded filenames. The ingestion pipeline normalizes all of these into a single consistent format.

### 5.2 Input Formats Accepted

1. **CSV files** (uploaded or from folder): Parsed by `parseCsv()`
2. **XLSX files** (uploaded or from folder): Parsed by the XLSX.js library (lazy-loaded)
3. **Embedded CSV** in `<script id="embeddedCsv">`: Gzip-base64 encoded, decoded at startup
4. **Embedded JSON** in `<script id="embeddedLiquidityData">`: Used by Liquidity Dashboard

### 5.3 The Pipeline

```
RAW FILE
    │
    ▼
parseCsv() / XLSX.read()
    │  Converts bytes/text → array of {columnName: value} objects
    │  Handles quoting, escaping, line endings
    │
    ▼
normalize(rows)
    │  Per-row transformations:
    │  • date → ISO format (handles mm/dd/yyyy, "Jan 31 2026", Excel serial numbers)
    │  • account → 6-digit string (strips leading zeros, decimal suffixes)
    │  • branch → normalized ID (extracts leading numeric portion, strips "Branch " prefix)
    │  • view → canonical label ("Ending Balance", "Average Balance", "IncExp")
    │  • amount → numeric (handles parentheses for negatives, comma separators, $ signs)
    │  • budgetVersion → string
    │  • rollupLabel / controlLabel → preserved if present
    │
    ▼
applyRows(rows)
    │  Replaces the global `rows` array
    │  Calls buildDataIndexes() → populates all index Maps
    │  Calls populateFilters() → updates date/org/account dropdowns
    │  Calls render functions for active tab
    │
    ▼
READY FOR CALCULATION
```

### 5.4 Validation During Ingestion

The `normalize()` function silently drops rows that fail validation:

| Condition | Action |
|---|---|
| No date OR no account AND no rollup label OR no view OR amount is NaN | Row skipped |
| Account ≥ 300000 AND view is "Ending Balance" | Row skipped (income accounts only carry monthly activity, not ending balances) |

Skipped rows are tracked in `loadTestSummary.skippedRows` and displayed in the Settings > Load Test panel.

### 5.5 Date Parsing Robustness

`normalizedDate()` handles four input formats:
1. **ISO:** `"2026-05-31"` → unchanged
2. **Slashes:** `"5/31/2026"` → `"2026-05-31"`
3. **Month name:** `"May 31 2026"` → `"2026-05-31"` (uses `monthNameMap` with 3-letter and full month names)
4. **Excel serial:** `46182` → converts from Excel's 1900-date system

### 5.6 How Other Subsystems Use the Data Pipeline

| Subsystem | What It Asks |
|---|---|
| Indexing Layer (C) | "Give me normalized rows to build indexes from" |
| Persistence Layer (I) | "Save these rows to IndexedDB for next startup" |
| Error Handling (N) | "How many rows were ingested? How many skipped?" |
| Settings (H) | "Load sample data" or "Refresh from external folder" |
| Liquidity (M) | Uses its own embedded JSON — does not go through this pipeline |

---

## 6. Subsystem C: Indexing Layer

**Location:** `yield-dashboard.js` (`buildDataIndexes()`)  
**Lines:** ~30  
**Primary purpose:** Build in-memory lookup structures that make data retrieval O(1) instead of O(n).

### 6.1 Why It Exists

Without indexes, every calculation would need to scan all ~50,000 rows for every GL code lookup. With indexes, `dateValues("2026-05-31", [105040], "Ending Balance")` is a single Map.get() call.

### 6.2 Index Structures

After `buildDataIndexes()` runs, these Maps and Sets are populated:

#### `valueIndex: Map<string, number>`
- **Key format:** `"{date}|{view}|{account}"`
- **Example:** `"2026-05-31|Ending Balance|105040"`
- **Value:** Sum of all amounts for that date/view/account combination (consolidating all branches)
- **Usage:** Single-point lookups when no branch filter is active

#### `branchValueIndex: Map<string, number>`
- **Key format:** `"{date}|{view}|{account}|{branch}"`
- **Example:** `"2026-05-31|Ending Balance|105040|1"`
- **Value:** Sum of amounts for a specific branch
- **Usage:** Branch-filtered lookups. The `dateValues()` function iterates over the selected branch set and sums from this index.

#### `rollupValueIndex: Map<string, number>`
- **Key format:** `"{date}|{view}|{statementLabelKey}"`
- **Example:** `"2026-05-31|Ending Balance|commercial loans"`
- **Value:** Pre-computed sum for a statement line at a given date/view
- **Usage:** Fast rollup lookups without needing to expand child GL codes

#### `datesCache: string[]`
- Sorted array of all unique dates in the data
- **Usage:** Date filter dropdown population, prior date calculation, trend chart x-axis

#### `accountSet: Set<string>`
- All unique GL account codes that appear in the data
- **Usage:** Validating that a code actually has data before calculating

#### `firstRowByAccount: Map<string, row>`
- First row encountered for each account (used for name lookup)
- **Usage:** The mapping review panel, GL account display names

### 6.3 The `measureCache` and `periodMeasureCache`

These are NOT populated by `buildDataIndexes()`. They are populated lazily by `lineMeasure()` and `periodLineMeasure()`:

- **`measureCache: Map<string, {avg, balance, inc, rate}>`**
  - Key: `"{label}|{date}|{branchKey}|{balanceView}"`
  - Caches the full measure object so repeated references to the same line/date/branch don't recalculate

- **`periodMeasureCache: Map<string, {avg, balance, inc, rate}>`**
  - Same concept but for multi-date period calculations

Both caches are invalidated (cleared) when filters change, via the `resetHierarchyCaches()` function.

### 6.4 How the Indexing Layer Is Used

```
User changes date filter
    → Event System calls handleFilterChange()
    → Calls buildDataIndexes() (rebuilds from rows)
    → measureCache.clear() (invalidates calc cache)
    → currentFilterCache = {key: null, data: null} (invalidates filter cache)
    → scheduleRender() → Rendering Engine
        → lineMeasure("Commercial Loans", "2026-05-31")
            → checks measureCache (miss)
            → calls dateValues("2026-05-31", [105040, 105050, 105070], "Ending Balance")
                → checks selectedBranchMaps() (null = consolidated)
                → valueIndex.get("2026-05-31|Ending Balance|105040") ← O(1) lookup
                → valueIndex.get("2026-05-31|Ending Balance|105050") ← O(1) lookup
                → valueIndex.get("2026-05-31|Ending Balance|105070") ← O(1) lookup
                → returns sum
            → stores result in measureCache
            → returns {avg: ..., balance: ..., inc: ..., rate: ...}
```

---

## 7. Subsystem D: Calculation Engine

**Location:** `yield-dashboard.js` (`lineMeasure()`, `periodLineMeasure()`, and all supporting functions)  
**Lines:** ~1,200 (the largest single subsystem)  
**Primary purpose:** Compute balance, average balance, income/expense, and rate for any statement line at any date.

### 7.1 Why It Exists

This is the brain of the platform. Every number on every report originates from `lineMeasure()` or `periodLineMeasure()`. This subsystem answers:
- "What was the average balance of Commercial Loans in May 2026?"
- "What rate did the bank earn on its securities portfolio in Q2?"
- "What is the month-over-month variance in Net Interest Income?"

### 7.2 The Core Function: `lineMeasure(line, date)`

This function takes a statement line definition and a date, and returns a measure object:

```javascript
{
    avg: number,      // Average balance (for rate calculation)
    balance: number,  // Ending balance (or avg if view is Average Balance)
    inc: number,      // Income or expense amount
    rate: number|''   // Annualized rate ('' if not calculable)
}
```

The calculation flow:

```
lineMeasure(line, date)
│
├── CHECK CACHE: measureCache → return cached if hit
│
├── RESOLVE BALANCE CODES
│   ├── lineBalanceCodes(line)
│   │   ├── quickMappedCodesForLine(line, 'balance')  [Mapping Engine]
│   │   │   └── normalizedQuickMappings() → filter by rollup match
│   │   ├── accountDimensionLeaves(balanceDimensionLabel)
│   │   │   └── walks accountNodes to find leaf codes for a dimension label
│   │   ├── supplementalBalanceCodes(label)
│   │   │   └── hardcoded additions for specific categories
│   │   └── statementInputCodes(line.bal)
│   │       └── lowestMappedDescendantCodes()
│   │           └── if code is a subtotal, recurse to find leaf codes
│   │
│   ├── If line.rollupBal:
│   │   └── Σ childCategoriesFor(label).forEach(child → lineMeasure(child).balance)
│   │       + Σ quick-mapped codes via dateValues()
│   │
│   └── Else:
│       └── dateValues(date, balanceCodes, view)
│           └── if no branch filter: valueIndex.get(key)
│           └── if branch filter: iterate branchSet, branchValueIndex.get(key)
│
├── CALCULATE AVERAGE BALANCE
│   ├── Same code resolution as balance
│   ├── dateValues(date, codes, 'Average Balance')
│   ├── PLUS: rollupDateValues(date, line.label, 'Average Balance')
│   │   └── rollupValueIndex lookup
│   └── Special cases:
│       ├── line.earningAssetsCalc → GrossLoans.avg + TotalInvestments.avg - TotalSecuritiesMTM.avg
│       └── line.excludeMtm → subtract TotalSecuritiesMTM.avg
│
├── RESOLVE INCOME CODES
│   ├── lineIncomeCodes(line)
│   │   ├── quickMappedCodesForLine(line, 'income')
│   │   ├── accountDimensionLeaves(incomeDimensionLabel)
│   │   └── statementInputCodes(line.inc)
│   │
│   └── Income calculation:
│       ├── childIncRaw = Σ childCategoriesFor → lineMeasure(child).inc
│       ├── directIncRaw = dateValues(date, incCodes, 'IncExp')
│       ├── If line.rollupInc AND children contribute:
│       │   └── incRaw = childIncRaw + quickMappedCodes
│       └── incRaw += rollupDateValues(date, line.label, 'IncExp')
│
├── APPLY SPECIAL CALCULATION OVERRIDES
│   ├── line.netInterestSpreadCalc → EarningAssets.inc - TotalFundingLiabilities.inc
│   ├── line.niiAfterFtpCalc → NII.inc + FTP.inc
│   ├── line.preProvisionCalc → NII + FTP + NonInterestIncome - NonInterestExpense
│   ├── line.netIncomeBeforeAllocationsCalc → PreProvision - PLL
│   └── line.netIncomeCalc:
│       ├── If branch filtered: NIBeforeAlloc - TotalAllocations
│       └── If consolidated: PreProvision - PLL
│
├── CHECK CUSTOM FORMULA (if exists)
│   └── customLineFormulaResult(line, date, 'Income')
│       └── safeEvalStatementFormula("[Earning Assets] - [Total Funding Liabilities]", resolver)
│           └── resolver(label) → lineMeasure(label).inc (with circular reference guard)
│
├── CALCULATE RATE
│   ├── customLineFormulaResult(line, date, 'Rate')
│   ├── line.spread → earningRate - fundingRate
│   ├── line.nim → NII * 12 / adjustedAverageAssets
│   │   ├── line.ubprNim → tax-equivalent NII (÷0.79 gross-up) * 12 / earning assets
│   │   └── line.monthlyNim → nimNetInterestIncome() * 12 / adjustedAverageAssets
│   ├── line.roa → netIncome * 12 / avgTotalAssets
│   ├── line.roe → netIncome * 12 / avgTotalCapital
│   ├── line.earningAssetsCalc → weightedChildRate(line, date)
│   └── default → |inc| / |avg| * annualizationFactor(date, lineDayCount(line))
│       └── annualizationFactor: 30/360→12, 90/360→4, ACT/360→360/days, Actual/365→365/days
│
└── CACHE & RETURN
    └── measureCache.set(key, result)
    └── return {avg, balance, inc, rate}
```

### 7.3 The Period Version: `periodLineMeasure(line, dates)`

Same logic as `lineMeasure()`, but operating across multiple dates (for QTD, YTD periods):

- Average balances use day-weighted averaging: `Σ(balancePerMonth × daysInMonth) / totalDays`
- Income values are summed across all dates
- Rates use period annualization factors: `12/months` for income-based rates, `365/totalDays` for balance-based rates
- The ending balance is taken from the LAST date in the period

### 7.4 Key Calculation Flags on Statement Lines

Each entry in `momLines[]` has flags that control how `lineMeasure()` handles it:

| Flag | Effect |
|---|---|
| `bal: [codes]` | Direct GL balance codes |
| `inc: [codes]` | Direct GL income codes |
| `rollupBal: true` | Sum child line balances instead of direct codes |
| `rollupInc: true` | Sum child line incomes instead of direct codes |
| `noRate: true` | Don't calculate a rate (always blank) |
| `total: true` | Styled as a total row (bold) |
| `spread: true` | Rate = earning rate - funding rate |
| `nim: true` | Special NIM rate calculation |
| `roa: true` | Return on Average Assets |
| `roe: true` | Return on Average Equity |
| `earningAssetsCalc: true` | Balance = GrossLoans + TotalInvestments - SecuritiesMTM; rate = weighted child |
| `netInterestSpreadCalc: true` | Income = EarningAssets.inc - TotalFundingLiabilities.inc |
| `niiAfterFtpCalc: true` | Income = NII + FTP |
| `preProvisionCalc: true` | Income = NII + FTP + NonII - NonIE |
| `netIncomeBeforeAllocationsCalc: true` | Income = PreProvision - PLL |
| `netIncomeCalc: true` | Custom net income calculation (branch-aware) |
| `branchOnly: true` | Only show when a single branch is selected |
| `hideWhenChild: true` | Hide when parent line displays children inline |
| `subtotal: true` | Treat as a subtotal (visible even if not frozen) |
| `dayCount: '30/360'` | Override annualization convention |
| `ownRate: true` | Always calculate own rate (don't use weighted child) |
| `securitiesInc: true` | Use direct codes for income (special securities handling) |
| `statementSynthetic: true` | Line was generated from statement hierarchy, not from momLines[] |

### 7.5 Custom Statement Formulas

Finance users can define custom calculations via the Settings > Hierarchy Editor > Statement tab. These are stored as `customStatementCalculations[]` and evaluated by `safeEvalStatementFormula()`.

**Formula syntax:**
```
[Line A] + [Line B] - [Line C]
ABS([Line D])
WEIGHTED_CHILDREN()
```

Each `[Label]` is resolved by calling `lineMeasure(label)` and extracting the appropriate measure (Balance, Income, or Rate).

**Safety:** The formula evaluator is restricted. Only identifiers `abs`, `max`, `min` and operators `+`, `-`, `*`, `/`, `(`, `)` are allowed. No function calls, no property access, no assignment. This prevents code injection.

**Circular reference guard:** The `customFormulaEvaluationStack` Set tracks which lines are currently being evaluated. If a formula references a line that references back, it returns 0 instead of recursing infinitely.

**Built-in formulas** (in `embeddedCustomStatementCalculations[]`):

| Line | Measure | Formula |
|---|---|---|
| Earning Assets | Balance | `[Gross Loans] + [Total Investments] - [Total Securities MTM]` |
| Earning Assets | Income | `[Total Investments] + [Gross Loans]` |
| Earning Assets | Rate | `WEIGHTED_CHILDREN()` |
| Net Interest Income/ Spread | Income | `ABS([Earning Assets]) - ABS([Total Funding Liabilities])` |
| NII after FTP | Income | `[Net Interest Income/ Spread] + [Funds Transfer Pricing]` |
| Pre Provision Net Revenue | Income | `[Net Interest Income/ Spread] + [Funds Transfer Pricing] + [Non Interest Income] - [Non Interest Expense]` |
| Net Income Before Allocations | Income | `[Pre Provision Net Revenue] - [Provision for Loan Losses]` |
| Net Income | Income (consolidated) | `[Pre Provision Net Revenue] - [Provision for Loan Losses]` |
| Net Income | Income (branch) | `[Net Income Before Allocations] - [Total Allocations]` |

### 7.6 How Other Subsystems Use the Calculation Engine

Every rendering function calls `lineMeasure()` or `periodLineMeasure()`. The rendering engine never accesses raw data directly — it always goes through these two functions.

---

## 8. Subsystem E: Mapping Engine

**Location:** `yield-dashboard.js` (quick GL mappings + budget line mappings)  
**Lines:** ~600  
**Primary purpose:** Allow finance users to override automatic GL account classification.

### 8.1 Why It Exists

The platform auto-classifies GL accounts based on their code ranges (via `categoryFor()`, which maps `1xxxxx` to Assets, `3xxxxx` to Interest Income, etc.). But the auto-classification is crude — it doesn't know that account 105300 should roll up to "1-4 Family Investment Loans" specifically, not just "Loans" generally.

The mapping engine lets finance users define:
- **Which statement rollup** each GL account belongs to
- **What mapping type** it uses (balance, income/expense, FTP, allocation, or ignore)

### 8.2 Quick GL Mappings

Stored as `quickGlMappings[]` in localStorage. Each mapping:

```javascript
{
    account: "105300",                    // 6-digit GL code
    name: "1-4 FAMILY INVESTMENT LOANS",  // Account name (for display)
    rollup: "1-4 Family Investment Loans", // Statement line label
    type: "auto"                          // "auto" | "balance" | "incexp" | "ftp" | "allocation" | "ignore"
}
```

**How mappings affect calculations:**

When `lineMeasure()` resolves which GL codes belong to a statement line, it consults two sources in order:
1. **Quick GL mappings:** `quickMappedCodesForLine(line, kind)` → finds mappings where `rollup` matches the line label
2. **Account dimension:** `accountDimensionLeaves(label)` → walks the account tree to find leaf codes with matching `StatementRollup`

If a GL code is mapped to "ignore", it is excluded from ALL calculations regardless of what other mappings or tree structures say.

**Mapping types:**

| Type | Meaning |
|---|---|
| `auto` | Default — account appears in both balance and income lookups as determined by its GL range |
| `balance` | Account contributes to BALANCE calculations only |
| `incexp` | Account contributes to INCOME calculations only |
| `ftp` | Account is a Funds Transfer Pricing account |
| `allocation` | Account is a cost allocation account (used for branch-level P&L only) |
| `ignore` | Account is completely excluded from all calculations |

### 8.3 Budget Line Mappings

Stored as `budgetLineMappings[]` in localStorage. These map budget workbook row names to statement rollups:

```javascript
{
    key: "commercialloans",               // Normalized key from budget row name
    name: "Commercial Loans",              // Original budget row name
    view: "Balance",                       // "Balance" | "IncExp" | ""
    rollup: "Commercial Loans",            // Statement line to map to
    ignore: false,                         // Exclude from calculations?
    type: "leaf"                           // "leaf" (include) or "rollup" (audit only)
}
```

**Key function:** `budgetLineKey(name)` normalizes a budget row name to a lookup key by lowercasing, stripping spaces and special characters.

### 8.4 How Mappings Sync with the Account Hierarchy

When a quick GL mapping is saved, `syncMappedAccountsToAccountHierarchy()` creates corresponding account tree nodes for any newly mapped GL codes that don't already have nodes. This ensures the hierarchy editor shows a complete picture.

### 8.5 How Other Subsystems Use the Mapping Engine

| Subsystem | What It Asks |
|---|---|
| Calculation Engine (D) | `quickMappedCodesForLine(line, 'balance')` → get GL codes from mappings |
| Calculation Engine (D) | `quickMappingLookup().get(account)` → resolve a single account's rollup |
| Budget Engine (F) | `budgetMappingForName(name, view)` → find budget→rollup mapping |
| Rendering Engine (G) | `mappingReviewRows()` → populate the mapping review table |
| Settings (H) | Save/load mappings from localStorage |
| Hierarchy Editor (L) | Show mapping assignments on statement/account nodes |

---

## 9. Subsystem F: Budget Engine

**Location:** `yield-dashboard.js` (budget loading, indexing, and calculation)  
**Lines:** ~500  
**Primary purpose:** Load budget data from XLSX workbooks, build parallel calculation indexes, and compute budget-to-actual comparisons.

### 9.1 Why It Exists

The bank's annual budgeting process produces detailed projections of every balance sheet and income statement line. The Budget Engine loads these projections and enables side-by-side comparison with actual results.

### 9.2 Budget Data Structure

Budget data comes from XLSX workbooks that contain rows with:
- Budget line name (e.g., "Commercial Loans", "Interest Income", "Net Income")
- View (Balance or IncExp)
- Month-by-month amounts
- Budget version identifier (e.g., "2026 Original Budget", "2026 Reforecast Q2")

Unlike GL data, budget data is NOT stored in the main `rows[]` array. It gets its own parallel index: `budgetIndexes` (built by `budgetIndexesForVersion()`).

### 9.3 Budget Loading Flow

```
User clicks "Refresh data" on budget folder
    │
    ▼
loadBudgetRepositoryData()
    ├── Opens File System Access API folder handle
    ├── Reads all .xlsx/.xls files
    ├── Parses each workbook
    │   └── Extracts budget rows (name, view, months, version)
    │
    ▼
applyBudgetRows(budgetRows, source, status)
    ├── Sets budgetDatesCache (all months with budget data)
    ├── Builds budgetIndexCache (parallel to valueIndex)
    │   └── Key: "{version}|{month}|{view}|{budgetLineKey}"
    │   └── Value: amount (negative expense convention applied)
    ├── Populates budgetMappingCandidates[]
    │   └── Lists every budget line name that needs mapping
    │
    ▼
renderBudgetStatement()
    ├── Gets current budget version from filter
    ├── For each statement line, calls periodLineMeasure()
    │   └── Uses withStatementIndexes() to temporarily redirect
    │       valueIndex lookups to budgetIndexCache
    ├── Builds comparison table: Actual | Budget | Variance | Variance %
```

### 9.4 How Budget Data Is Indexed

The `budgetIndexesForVersion(version)` function creates a temporary substitution for the normal data indexes. When the calculation engine calls `dateValues()`, the budget wrapper function `withStatementIndexes()` intercepts the call and returns budget values instead of actual values.

This is a **virtual index** approach — budget data is not merged into the main data arrays, but overlaid at query time.

### 9.5 Budget Version Management

Multiple budget versions can coexist. Users select the active version via a dropdown filter. The `approvedBudgetVersion` concept allows finance leadership to designate one version as authoritative.

### 9.6 How Other Subsystems Use the Budget Engine

| Subsystem | What It Asks |
|---|---|
| Calculation Engine (D) | `withStatementIndexes(indexes, fn)` → temporarily swap data source |
| Mapping Engine (E) | `budgetMappingCandidateRows()` → find unmapped budget lines |
| Rendering Engine (G) | `renderBudgetStatement()` → build BtA tables |
| Rendering Engine (G) | `renderBudgetToActualReport()` → detail BtA reports |
| Persistence (I) | `saveBudgetCache()` / `restoreFullBudgetCache()` → IndexedDB |
| Print Engine (K) | `ensureBudgetForPrintSections()` → load budget before printing |

---

## 10. Subsystem G: Rendering Engine

**Location:** `yield-dashboard.js` (all `render*()` functions), `liquidity-dashboard.html` (render functions)  
**Lines:** ~3,500 (Yield Statement) + ~300 (Liquidity)  
**Primary purpose:** Convert calculation results into visible DOM elements.

### 10.1 Why It Exists

This is the presentation layer. It translates the calculation engine's measure objects into HTML tables, SVG charts, and interactive controls. Every tab, every table, every chart, every popover is produced by this subsystem.

### 10.2 Rendering Dispatchers

#### `scheduleRender()`
Uses `requestAnimationFrame` with a timer-based fallback to debounce rapid filter changes. Only renders once per animation frame, no matter how many filters change in quick succession.

#### `renderOverview()`
Orchestrates the Overview tab:
1. `renderMetrics()` — 17 KPI cards (Net Loans, Total Assets, Total Deposits, Capital, Core Deposits, Wholesale Funding, NII, Net Income, Yield on Loans, Yield on Assets, Cost of Funds, LDR, Efficiency Ratio, NIB/Deposits, NIM, ROAA/ROAE)
2. `svgDonut()` — Funding mix pie chart
3. `svgLoanMix()` — Loan composition pie chart
4. `svgLine()` — 13-month trend line chart (or single-line chart if account filter is active)
5. Account detail table — filtered GL rows sorted by amount

#### `renderMomStatement()` / `renderQoqStatement()` / `renderYtdStatement()`
Builds the yield statement tables:
- Header row: dates across columns, metric labels down rows
- For each visible statement line:
  - `lineMeasure(line, date)` → balance, income, rate
  - Drill button if line has children or detail accounts
  - Indentation based on hierarchy depth
  - Row styling: section headers (dark blue), totals (light blue background), metrics (border-accented), drillee accounts (grey text)

#### `renderComparisons()`
MTD/QTD/YTD comparison tables with horizontal bar chart:
- Current period vs. prior period
- Variance and percentage change
- collapsible drill-down into detail accounts

### 10.3 The Display Visibility System

Not all statement lines are visible at all times. The visibility system is:

1. **Frozen lines** (29 hardcoded labels + user-frozen nodes): Always visible — these are the structural backbone
2. **Always-display lines** (`momAlwaysDisplay` Set): User-configurable via checkbox grid in Display Settings panel. Persisted to localStorage
3. **Children of frozen lines** (`baseStatementChildLabels()`): Hidden by default — they roll into their parent
4. **Inline children** (fee detail lines under "Service Charges", "ATM/Debit Card Income", etc.): Displayed inline with indentation instead of as separate rows in the main table

### 10.4 SVG Chart Generation

All charts are generated as inline SVG strings (not using a charting library):

#### `svgLine()` — Trend Chart
- 13 data points across x-axis
- Each data point = `|lineMeasure(line, date).balance|`
- SVG path with smooth lines, circle markers, axis labels
- When a rollup filter is active, shows single series. Otherwise, shows 4-series (Commercial/Mortgage/Core Deposits/Wholesale)

#### `svgDonut()` — Funding Mix
- 5 segments: Demand, Interest Bearing, High Wealth, Wholesale, Borrowings
- SVG circle elements with `stroke-dasharray` and `stroke-dashoffset` for proportional arcs
- Center text showing total

#### `svgLoanMix()` — Loan Composition
- Same donut technique applied to loan categories
- 9 segments: Commercial, CRE, 1-4 Family, Consumer, Tax Exempt, Portfolio Mtg, Net Purchased, HFS, Participations

### 10.5 How Other Subsystems Use the Rendering Engine

The Rendering Engine is a consumer — it reads from all other subsystems and writes to the DOM. It doesn't export data to any other subsystem.

---

## 11. Subsystem H: Settings & Configuration

**Location:** `yield-dashboard.js` (CONFIG, folder settings, version keys)  
**Lines:** ~400  
**Primary purpose:** Manage platform configuration, folder connections, and migration of settings between versions.

### 11.1 Why It Exists

The platform must work in different bank environments with different folder structures, different GL account schemes, and different reporting requirements. The Settings system provides configuration points without code changes.

### 11.2 Configuration Constants

```javascript
const CONFIG = {
    dataSource: 'local',  // 'local' | 'sharepoint' (future)
    flowEndpoint: '/_api/cloudflow/v1.0/trigger/...'  // (future Power Automate)
};
```

### 11.3 Folder Settings

Three folder connections are configured:

| Folder | Purpose | Default Path |
|---|---|---|
| **Input Files** | Monthly GL CSV/XLSX files | `F:\Accounting\Treasury\Codex\Yield Statement\Input Files` |
| **Budget** | Budget and reforecast XLSX workbooks | `F:\Accounting\Treasury\Codex\Yield Statement\Budget` |
| **Settings** | Shared hierarchy workbook | `F:\Accounting\Treasury\Codex\Yield Statement\Settings` |

These use the File System Access API (`window.showDirectoryPicker()`) to obtain persistent folder handles. Once granted, the browser remembers the handle and can re-open the folder on subsequent sessions without re-prompting.

### 11.4 Version Key System

The platform uses localStorage version keys to manage schema migrations. When a new version of a data structure is deployed, the version key changes and the old data is either migrated or reset:

| Version Key | Current Value | Controls |
|---|---|---|
| `processedCacheVersion` | 21 | IndexedDB processed data cache schema |
| `budgetCacheVersion` | 21 | IndexedDB budget cache schema |
| `minimumUsableDashboardDataCacheVersion` | 15 | Minimum acceptable cache version |
| `embeddedDisplayDefaultsVersion` | `self-contained-display-defaults-v5` | Display defaults migration |
| `statementSubtotalStyleDefaultsVersion` | `statement-subtotal-style-v2` | Statement style migration |
| `childRollupDisplayResetKey` | `statementChildRollupDisplayResetV1` | One-time reset of child rollup display |
| `budgetLineMappingSchemaVersion` | `budget-line-mappings-view-v3` | Budget mapping schema |
| `hierarchyEditsStorageKey` | `yieldDashboardHierarchyEditsV2` | Hierarchy edit storage |

### 11.5 How Other Subsystems Use Settings

| Subsystem | What It Reads |
|---|---|
| Persistence (I) | Folder handles for saving caches |
| Data Pipeline (B) | `repositoryFolderSettings` → which folder to read |
| Budget Engine (F) | `budgetFolderSettings` → which folder to read budget from |
| Metadata (A) | `hierarchyEditsStorageKey` → which localStorage key to read |
| Rendering (G) | Bank name, logo from brand settings |

---

## 12. Subsystem I: Persistence Layer

**Location:** `yield-dashboard.js` (IndexedDB CRUD, localStorage helpers)  
**Lines:** ~300  
**Primary purpose:** Save and restore data across browser sessions to avoid re-loading large files.

### 12.1 Why It Exists

The monthly GL file can be 50,000+ rows. Loading and parsing it takes seconds. The persistence layer caches processed data in IndexedDB so subsequent dashboard loads are instant.

### 12.2 Storage Tiers

#### Tier 1: localStorage
- **What:** Small configuration data (< 5MB per origin limit in most browsers)
- **Stored:** Brand settings, hierarchy edits, quick GL mappings, budget line mappings, custom statement calculations, display defaults, folder settings, version keys
- **Performance:** Synchronous reads, fast
- **Persistence:** Survives browser restarts

#### Tier 2: IndexedDB
- **What:** Large processed data caches
- **Stores:**
  - `processedCache` → `activeRows` (the normalized GL rows)
  - `budgetCache` → `budgetRows` (budget data rows)
  - `detailReportCache` → precomputed detail report payloads
- **Performance:** Async reads/writes, indexed queries
- **Persistence:** Survives browser restarts

#### Tier 3: File System Access API
- **What:** Persistent handle to network file shares
- **Stored:** Directory handles (not the data itself — handles are capability tokens)
- **Performance:** Depends on network speed to file share
- **Persistence:** Survives browser restarts (if user grants permission)

### 12.3 Cache Invalidation

Data caches are invalidated when:
1. The cache version number in code (`processedCacheVersion = 21`) doesn't match the stored version
2. The user explicitly refreshes data from the external folder
3. The user uploads a new GL file
4. A mapping change requires rebuilding data indexes

### 12.4 How Other Subsystems Use the Persistence Layer

| Subsystem | What It Reads/Writes |
|---|---|
| Data Pipeline (B) | Reads processed cache at startup; writes after loading new data |
| Budget Engine (F) | Reads budget cache at startup; writes after loading budget files |
| Mapping Engine (E) | Saves quick GL mappings and budget line mappings to localStorage |
| Metadata (A) | Saves/loads hierarchy snapshots from localStorage |
| Rendering (G) | Detail report cache for prewarmed reports |
| Settings (H) | Folder settings from localStorage |

---

## 13. Subsystem J: Theming & Branding

**Location:** `yield-dashboard.js` (brand palette definitions, applyBranding)  
**Lines:** ~150  
**Primary purpose:** Allow each bank to customize the dashboard colors and logo.

### 13.1 Why It Exists

The platform is designed to be deployed at multiple community banks. Each bank has its own brand colors, logo, and name. The theming system applies these via CSS custom properties.

### 13.2 Color Palettes

Four palettes are defined:

| Palette | Primary | Secondary | Accent |
|---|---|---|---|
| Classic Blue | `#00408A` (navy) | `#0059B8` | `#C00000` (red) |
| Heritage Green | `#0F5132` (forest) | `#198754` | `#B68A35` (gold) |
| Trust Navy | `#0B2545` (dark navy) | `#123C69` | `#D6A84A` (gold) |
| Modern Charcoal | `#263238` (charcoal) | `#455A64` | `#B66A3C` (copper) |

Each palette maps to the full set of CSS variables (`--ink`, `--muted`, `--paper`, `--panel`, `--line`, `--burgundy`, `--burgundy-2`, `--gold`, `--gold-2`, `--navy`, `--blue`, `--teal`, `--sage`, `--rose`, `--accent-rgb`, `--danger-rgb`).

### 13.3 Runtime Application

`applyBrandPalette(key)` sets each `--variable` on `document.documentElement.style`, which cascades to all elements. No DOM re-render is needed — the CSS variables are live.

### 13.4 Bank Name and Logo

- **Name:** Stored in `brandSettings.name`, displayed in document.title, subtitle, and print reports
- **Logo:** Stored as base64 data URL in `brandSettings.logo`, displayed in the topbar and print reports
- **Persistence:** `localStorage.getItem('dashboardBrandSettings')`

---

## 14. Subsystem K: Print Engine

**Location:** `yield-dashboard.js` (buildPrintReport, print section selection)  
**Lines:** ~200  
**Primary purpose:** Generate print-optimized HTML for board-ready PDF reports.

### 14.1 Why It Exists

Bank executives and board members expect printed (or PDF-exported) reports. The print engine generates clean, paginated output with bank branding, headers, and compact table layout — distinct from the interactive screen layout.

### 14.2 Print Section Selection

Users select which report sections to print via a checkbox menu with 13 individual sections organized under 5 groups: Overview, Summary, Yield Statement, Budget, Detail.

### 14.3 Print DOM Generation

`buildPrintReport(sections)` creates a detached DOM fragment in `#printReport` (hidden with `display: none`). Each section gets a `.print-page` div with:
- Print header (bank logo + name + date + report title)
- Report content (SVG charts converted to static, compact tables)

CSS `@media print` rules hide the main shell and show only `#printReport`, with page breaks between sections and landscape orientation for wide tables.

---

## 15. Subsystem L: Hierarchy Editor

**Location:** `yield-dashboard.js` (`renderHierarchyEditor()`, `saveHierarchyEdit()`, `deleteHierarchyNode()`, `addHierarchyChild()`)  
**Lines:** ~700  
**Primary purpose:** Provide a tree-based UI for editing all three hierarchy types without needing to edit Excel workbooks directly.

### 15.1 Why It Exists

The shared hierarchy workbook (`Dashboard Hierarchies.xlsx`) is the canonical source, but editing Excel in a browser is impractical. The hierarchy editor provides a friendlier interface for adding, renaming, re-parenting, and deleting hierarchy nodes.

### 15.2 The Four Editor Modes

The editor has four tabs:

1. **Organization:** Edit the org tree. Nodes can be added, renamed, re-parented, assigned branch Map values, and deleted
2. **Account:** Edit the account tree. Each leaf node can be assigned a GL account code (Map) and a statement rollup + mapping type
3. **Statement:** Edit the statement line tree. Nodes get Frozen state, Annualization, and optional custom calculation formulas
4. **Budget:** Read-only view of the budget hierarchy (driven by budget line mappings, not edited directly)

### 15.3 Virtual Children

In the Statement and Budget tabs, the tree shows "virtual children" — synthetic nodes that don't exist in the tree data but represent mapped GL accounts (Statement tab) or mapped budget lines (Budget tab). These appear as leaf nodes with a distinct style.

### 15.4 Edit Persistence

Changes are saved to localStorage via `saveHierarchyEdits()`. The "Save to shared workbook" button in Settings triggers `saveSharedHierarchyFromUi()` which writes back to `Dashboard Hierarchies.xlsx` using the File System Access API.

---

## 16. Subsystem M: Liquidity Projection Engine

**Location:** `liquidity-dashboard.html` (inline `<script>`, `project()` function)  
**Lines:** ~200  
**Primary purpose:** Project the bank's liquidity position 13 months forward under user-defined growth assumptions.

### 16.1 Why It Exists

Regulators and bank management need to know: "If deposits run off and loans grow as projected, will the bank have enough cash?" The Liquidity Dashboard answers this by modeling cash flows period by period.

### 16.2 The `project()` Function

```
project()
│
├── INITIALIZE balance sheet from raw.gl.byCategory
│   ├── cash, overnight, securities, loans
│   ├── nib (non-interest bearing deposits)
│   ├── ib (interest bearing deposits)
│   ├── cb (correspondent demand), cdars, brokered, fhlb
│   └── otherAssets, otherLiab, msr, capital, retained
│
├── FOR EACH PERIOD (May 2026 through June 2027):
│   │
│   ├── MAY 2026: LOCKED TO ACTUAL
│   │   └── All values from raw.referenceOutput.actualMay
│   │
│   ├── FORECAST MONTHS:
│   │   ├── Securities Paydowns = contractualCashflows['Securities Paydowns'][period]
│   │   ├── Securities Purchases = -(securities * growth('Securities', period))
│   │   ├── Loan Runoff = contractualCashflows['Loan Runoff'][period]
│   │   ├── Loan NB CF = -(loans * growth('Loans', period))
│   │   ├── Deposit Runoff/Inflow = balance * growth('Category', period)
│   │   ├── Brokered/CDARS/FHLB maturity (from contractual CFs) + issuance (from growth rates)
│   │   ├── Net Asset Activity = SecuritiesΔ + LoansΔ
│   │   ├── Net Liability Activity = Σ deposit/borrowing changes
│   │   ├── Net Cash Provided = Net Asset + Net Liability + Other + Earnings + Dividends
│   │   └── Ending Overnight += Net Cash Provided
│   │
│   └── availableLiquidity(balances) = overnight + brokeredCapacity
│       + fhlbAvailability + frbLine + cash + cdarsCapacity
│       + unpledgedSecurities + knightDoss + fedFundsLines + msr + mortgageSales
│
└── RETURN {rows, balances}
```

### 16.3 Liquidity Ratio Engine

The `ratioValue(ratio, balances)` function calculates 7 liquidity ratios:
1. **Loan to Deposits** — loans ÷ deposits
2. **FHLB Utilization** — FHLB balance ÷ FHLB line capacity
3. **Brokered Deposits / Total Deposits**
4. **CDARS / Total Liabilities**
5. **Wholesale Funding / Total Liabilities**
6. **Non-Interest Bearing / Total Deposits**
7. **FRB + Cash + Unpledged Securities / Total Liabilities** (liquid asset coverage)

Each ratio has thresholds (Target, EWI 1, EWI 2, Limit) and a direction (min = lower is better, max = higher is better). The `ratioStatus()` function returns a status: "OK" (green), "EWI 1" (yellow/warning), "EWI 2" (red), or "Limit" (red).

### 16.4 Growth Assumption Model

Users set growth rates per category per forecast month. Defaults are 0.00% for the "runoff view." Positive rates mean inflows (deposit growth, new loan business). Negative rates mean outflows (deposit runoff, loan paydowns).

For deposits: negative growth = runoff, positive growth = new inflows
For liabilities (borrowings): negative = paydowns, positive = new issuance
For assets (loans, securities): negative = paydowns/runoff, positive = new business

### 16.5 Quarter Aggregation

When "Quarterly" view is selected, monthly values are aggregated:
- Q3 2026 = Jul + Aug + Sep 2026
- Q4 2026 = Oct + Nov + Dec 2026
- Q1 2027 = Jan + Feb + Mar 2027
- Q2 2027 = Apr + May + Jun 2027

Beginning/ending overnight positions use the first/last month of the quarter. Available liquidity uses the last month.

---

## 17. Subsystem N: Error Handling & Diagnostics

**Location:** `yield-dashboard.js` (startup error banner, load test diagnostics)  
**Lines:** ~150  
**Primary purpose:** Surface data quality issues before they corrupt reports.

### 17.1 Why It Exists

"Validation precedes analytics." If data is not trusted, reports are worthless. This subsystem catches and reports data problems at every level.

### 17.2 Startup Error Banner

At the very top of `yield-dashboard.js` (lines 1-20), before any other code runs:

```javascript
window.__yieldStartupErrors = [];
function showStartupError(message) {
    // Creates a fixed-position banner at the top of the page
    // Displays all accumulated errors
}
window.addEventListener('error', event => showStartupError(...));
window.addEventListener('unhandledrejection', event => showStartupError(...));
```

This ensures that even if the main logic fails catastrophically, the user sees an error message rather than a blank page.

### 17.3 Load Test Diagnostics

The Settings > Data Loading Test panel displays:

| Metric | Source |
|---|---|
| **Source** | `loadTestSummary.source` — which data source was loaded |
| **Files** | Count of data files |
| **Raw Rows** | Total rows before filtering |
| **Normalized Rows** | Rows after validation |
| **Skipped Rows** | Rows rejected by validation |
| **Dates** | Unique months in data |
| **Accounts** | Unique GL codes |
| **Branches** | Unique branch IDs |
| **Missing Columns** | Columns absent from raw data |
| **Unmapped Active** | Accounts with balances but no rollup |
| **Allocation Audit** | Count/total/branches for allocation rows |
| **Source Warning** | If the data source appears stale or incomplete |

### 17.4 Mapping Completeness Tracking

The `mappingStatusCounts()` function reports:
- How many active GL accounts have no mapping
- How many organization branches have no hierarchy entry
- How many quick GL mappings are saved

This is surfaced in the Mapping Review panel and the Settings tab.

### 17.5 Fallback Chain

The startup data loading follows a multi-tier fallback:

```
1. Try IndexedDB processedCache
   └── FAIL? →
2. Try external folder (File System Access API)
   └── FAIL? →
3. Try localStorage temporary comparison data
   └── FAIL? →
4. Load embedded CSV fallback
```

Each tier's success or failure is reported in `importPersistenceStatus` and displayed in the load test panel.

---

## 18. Subsystem O: Event System

**Location:** `yield-dashboard.js` (event listeners, filter handlers, tab switching), `index.html` (tab button attributes), `liquidity-dashboard.html` (inline handlers)  
**Lines:** ~400  
**Primary purpose:** Connect user interactions to subsystem behavior.

### 18.1 Why It Exists

The platform is interactive: users change filters, switch tabs, toggle display settings, and edit hierarchies. The event system translates these UI actions into data recalculation and rendering.

### 18.2 Key Event Handlers

#### Filter Changes
```javascript
['dateFilter', 'viewFilter', 'branchFilter', 'searchFilter'].forEach(id => {
    on(id, 'input', handleFilterChange);
    on(id, 'change', handleFilterChange);
});
```

`handleFilterChange()` is the central dispatch:
1. Invalidates caches (measureCache, currentFilterCache, trendFilterCache)
2. Calls `scheduleRender()` (debounced via requestAnimationFrame)
3. `scheduleRender()` calls the appropriate render function based on `activeTabId()`

#### Tab Switching
HTML buttons have `data-tab` attributes. The `activateTab()` function:
1. Removes `active` class from all tabs and panels
2. Adds `active` to the selected tab and its panel
3. Calls the render function for that tab
4. Manages which comparison controls are visible (`.review-global-control.open`)

#### Organization Picker
A custom tree popover with:
- Click to select a value
- Click +/- to expand/collapse
- Search input to filter visible nodes
- Click-outside and Escape to close

#### Account Picker
Same pattern, applied to statement rollups instead of organizations.

#### Hierarchy Editor
Five separate event types:
- Mode switching (Organization/Account/Statement/Budget tabs)
- Tree node selection (highlight + detail panel)
- Expand/collapse toggle
- Add child button
- Delete selected button
- Detail panel field changes (blur → save)

### 18.3 How Events Flow

```
User clicks "Central Texas" in org picker
    │
    ▼
orgPickerTree click handler detects [data-org-value]
    │
    ▼
selectOrgPickerValue("org:91")
    ├── Sets branchFilter.value to "org:91"
    ├── Closes popover
    └── Dispatches 'change' event on branchFilter
        │
        ▼
handleFilterChange()
    ├── selectedBranchCache = {key: null, maps: null}  ← invalidation
    ├── measureCache.clear()
    ├── currentFilterCache = {key: null, data: null}
    └── scheduleRender()
        │
        ▼
renderOverview() (or active tab's render function)
    ├── renderMetrics()
    │   └── selectedBranchMaps() → descendantOrgMaps(91)
    │       → {1,2,3,4,10,5,6,7,9}
    │   └── dateValues() → branchValueIndex filtered by map set
    └── svgLine() → chart with filtered data
```

---

## 19. Cross-Subsystem Dependencies

### 19.1 Dependency Matrix

```
              ┌───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┐
              │ A │ B │ C │ D │ E │ F │ G │ H │ I │ J │ K │ L │ M │ N │ O │
              │MET│DAT│IDX│CAL│MAP│BDG│RND│SET│PRS│THM│PRT│EDT│LIQ│ERR│EVT│
┌─────────────┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┤
│A METADATA   │ - │ R │ - │ R │ R │ - │ R │ R │ R │ - │ - │ W │ - │ - │ - │
│B DATA PIPE  │ - │ - │ W │ - │ - │ - │ - │ R │ W │ - │ - │ - │ - │ W │ - │
│C INDEXING   │ - │ R │ - │ R │ - │ - │ - │ - │ - │ - │ - │ - │ - │ - │ - │
│D CALC ENG   │ R │ - │ R │ - │ R │ R │ - │ - │ - │ - │ - │ - │ - │ - │ - │
│E MAPPING    │ W │ - │ - │ - │ - │ - │ R │ W │ R │ - │ - │ R │ - │ - │ - │
│F BUDGET     │ - │ R │ - │ - │ - │ - │ R │ R │ R │ - │ - │ - │ - │ - │ - │
│G RENDERING  │ R │ - │ - │ R │ R │ R │ - │ R │ - │ R │ W │ - │ R │ - │ - │
│H SETTINGS   │ R │ R │ - │ - │ R │ R │ R │ - │ R │ R │ - │ - │ - │ - │ - │
│I PERSIST    │ R │ R │ - │ - │ R │ R │ R │ R │ - │ - │ - │ R │ - │ - │ - │
│J THEMING    │ - │ - │ - │ - │ - │ - │ - │ R │ - │ - │ - │ - │ - │ - │ - │
│K PRINT      │ R │ - │ - │ - │ - │ - │ R │ R │ - │ R │ - │ - │ - │ - │ - │
│L HIER EDIT  │ W │ - │ - │ - │ R │ - │ R │ R │ R │ - │ - │ - │ - │ - │ R │
│M LIQUIDITY  │ R*│ - │ - │ - │ - │ - │ R │ - │ R │ - │ - │ - │ - │ - │ R │
│N ERRORS     │ - │ R │ - │ - │ - │ - │ R │ R │ - │ - │ - │ - │ - │ - │ - │
│O EVENTS     │ - │ - │ - │ - │ - │ - │ R │ - │ - │ - │ - │ - │ - │ - │ - │
└─────────────┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┘

R = Reads from   W = Writes to   R* = Own copy (duplicated)
- = No dependency
```

### 19.2 Critical Dependency Chains

**Chain 1: Filter Change → Report Update**
```
O(Event) → C(Indexing) → D(Calculation) → G(Rendering) → DOM
                         ↑
                    A(Metadata) + E(Mapping)
```

**Chain 2: Data Loading → Dashboard Ready**
```
B(Data Pipeline) → C(Indexing) → D(Calculation) → G(Rendering)
                   ↑
              I(Persistence) ← startup read
```

**Chain 3: Hierarchy Edit → Everything Updates**
```
L(Hierarchy Editor) → A(Metadata) mutates → I(Persistence) saves
                     → C(Indexing) rebuilds
                     → D(Calculation) → G(Rendering)
```

**Chain 4: Mapping Change → Recalculate**
```
E(Mapping) mutates → C(Indexing) rebuilds → D(Calculation) → G(Rendering)
```

---

## 20. Startup Sequence

### 20.1 Yield Statement Dashboard — Complete Startup

```
1. HTML PARSED
   ├── CSS loaded and applied
   ├── Embedded CSV <script> parsed (deferred)
   └── yield-dashboard.js begins execution

2. ERROR HANDLING BOOT (lines 1-20)
   ├── window.__yieldStartupErrors = []
   ├── showStartupError() defined
   └── Global error/unhandledrejection listeners registered

3. DATA CONSTANTS (lines 21-41)
   ├── palette[] defined
   ├── referenceAccounts[] defined (500+ entries)
   ├── organizationNodes[] defined (~30 entries)
   ├── accountNodes[] defined (~500 entries)
   ├── referenceHierarchy[] defined (hardcoded display hierarchy)
   ├── categoryOverrides{} applied
   └── juneAccountSupplements IIFE runs → adds June-specific data

4. STATE INITIALIZATION (lines 133-330)
   ├── expandedMom, expandedQoq, etc. (Set objects)
   ├── rows = [], budgetRows = [] (empty arrays)
   ├── localStorage: budgetLineMappings, quickGlMappings loaded
   ├── embeddedDisplayDefaults merged with localStorage
   ├── customStatementCalculations loaded
   └── All cache Maps initialized as empty

5. HIERARCHY BOOT (lines 544-752)
   ├── applySavedHierarchyEdits() → try localStorage snapshots
   ├── normalizeKnownHierarchyMappings() → audit-forced corrections
   ├── removeRedundantDefaultHierarchyNodes() → cleanup
   ├── initializeStatementNodes() → merge defaults with saved
   ├── Version-keyed migrations applied:
   │   ├── statementSubtotalStyleDefaultsVersion
   │   └── childRollupDisplayResetKey
   └── momAlwaysDisplay cleaned of deleted/duplicate entries

6. MOM LINES DEFINED (lines 2529-2673)
   ├── momLines[] array of 145 line definitions
   ├── Each with bal[], inc[], and calculation flags
   └── momLinesReady = true

7. STATEMENT NODES INITIALIZED (line 3752)
   ├── initializeStatementNodes()
   └── statementNodes[] populated (~90 entries)

8. UTILITY FUNCTIONS DEFINED
   ├── $(), on(), clean(), num(), money(), pct()
   ├── parseCsv(), normalize()
   ├── All hierarchy functions
   └── All calculation functions

9. DATA LOADING (line 11649)
   ├── loadInitialDashboardData()
   │   ├── tryLoadProcessedCache() → IndexedDB
   │   │   └── SUCCESS → applyRows() → buildDataIndexes() → renderOverview()
   │   │
   │   ├── tryLoadExternalData() → File System Access API
   │   │   └── SUCCESS → applyRows() → buildDataIndexes() → renderOverview()
   │   │
   │   └── loadEmbeddedFallbackData() → embeddedCsv <script>
   │       └── SUCCESS → applyRows() → buildDataIndexes() → renderOverview()
   │
   └── scheduleDeferredStartupLoads(afterInitialData)
       └── After render: budget cache restore, shared hierarchy load

10. EVENT BINDINGS (lines 11363-11660)
    ├── Filter change handlers
    ├── Tab switching
    ├── Org/Account pickers
    ├── Print/Export buttons
    ├── Hierarchy editor
    ├── Quick/Budget mapping buttons
    ├── Branding inputs
    └── Settings folder buttons

11. FINAL DISPLAY (line 11621)
    ├── applyBranding() → set colors, logo, bank name
    ├── renderRepositoryFolder() → show folder connection status
    ├── renderBudgetFolder() → show budget folder status
    └── renderSharedHierarchyWorkbookStatus() → show workbook status
```

### 20.2 Liquidity Dashboard — Complete Startup

```
1. HTML PARSED
   ├── <style> applied
   └── <script id="embeddedLiquidityData"> parsed

2. DATA DECODED (line 229)
   └── raw = JSON.parse(embeddedLiquidityData.textContent)

3. STATE INITIALIZED (lines 230-244)
   ├── Read localStorage → saved growth assumptions, scenario name, ratios
   ├── Merge saved state over defaultState
   ├── state.periods, state.actualPeriods, state.forecastPeriods set
   └── state.growthRates deep-merged

4. UTILITY FUNCTIONS DEFINED
   ├── fmtMoney, fmtPct, fmtNum, fmtBytes
   ├── esc, monthLabel, val, cf
   └── growth, setGrowth

5. RENDER FUNCTIONS DEFINED
   ├── project() → projection engine
   ├── ratioValue() / ratioStatus() → liquidity ratios
   ├── availableLiquidity() → total liquidity
   ├── renderOutput() / renderDetails() / renderAssumptions() / renderSettings()
   └── render() → top-level dispatch

6. EVENT BINDINGS (lines 719-727)
   ├── Tab selection
   ├── Input change → saveState() → render()
   ├── Detail tab selection
   └── Period view toggle

7. RENDER CALLED (line 728)
   └── render() → renderOutput() + renderDetails() + renderAssumptions() + renderSettings()
```

---

## 21. Data Schema Reference

### 21.1 GL Row (normalized)

```javascript
{
    date: "2026-05-31",           // ISO date string
    account: "105040",            // 6-digit GL account code
    name: "COMMERCIAL LOANS",     // Account name
    branch: "1",                  // Branch number (or "All")
    view: "Ending Balance",       // "Ending Balance" | "Average Balance" | "IncExp"
    amount: 1250000.00,           // Numeric amount
    budgetVersion: "",            // Budget version (if budget row)
    rollupLabel: "",              // Explicit rollup label (if present)
    controlLabel: "",             // Control label override
    rawCode: "",                  // Raw account code from source
    budgetSubtotal: false,        // Is this a budget subtotal row?
    category: "Commercial Loans", // Computed category (filled by buildDataIndexes)
    searchText: "105040 commercial loans" // Pre-built search string
}
```

### 21.2 Organization Node

```javascript
{
    OrganizationKey: 91,             // Unique ID
    OrganizationParentKey: 92,       // Parent ID (0 = root)
    OrganizationName: "Central Texas", // Display name
    UnaryOper: "+",                  // "+" or "-" for consolidation
    SortOrder: 1,                    // Display order
    Map: ""                          // Branch number (leaf only, empty for parents)
}
```

### 21.3 Account Node

```javascript
{
    AccountKey: 123,                    // Unique ID
    AccountParentKey: 45,               // Parent ID
    AccountName: "105040 - COMMERCIAL LOANS", // Display name
    UnaryOper: "+",                     // "+" or "-"
    SortOrder: 8,                       // Display order
    Map: "105040",                      // GL account code (leaf only)
    AccountType: "Commercial Loans",    // Statement rollup label
    StatementRollup: "Commercial Loans", // Same as AccountType
    MappingType: "auto"                 // "auto" | "balance" | "incexp" | "ftp" | "allocation" | "ignore" | "rollup"
}
```

### 21.4 Statement Node

```javascript
{
    StatementKey: 8,                     // Unique ID
    StatementParentKey: 13,              // Parent ID
    StatementName: "Commercial Loans",   // Display name
    SortOrder: 8,                        // Display order
    Frozen: false,                       // Always visible?
    Annualization: "Actual/365"          // Day count convention override
}
```

### 21.5 Line Definition (momLines[] entry)

```javascript
{
    section: "Assets:",                    // Section header (no label = header)
    label: "Commercial Loans",             // Line label
    bal: [105040, 105050, 105070],         // Balance GL codes
    inc: [300010, 300011, 300020, 300090], // Income GL codes
    rollupBal: false,                      // Sum children for balance?
    rollupInc: false,                      // Sum children for income?
    total: false,                          // Styled as total?
    noRate: false,                         // Suppress rate calculation?
    dayCount: null,                        // Override annualization?
    spread: false,                         // Rate = earning - funding?
    nim: false,                            // NIM rate calculation?
    roa: false,                            // ROAA rate?
    roe: false,                            // ROAE rate?
    earningAssetsCalc: false,              // Special earning assets calc?
    hideWhenChild: false,                  // Hide when parent displays children?
    subtotal: false,                       // Treat as subtotal?
    branchOnly: false,                     // Only show for single branch?
    ownRate: false,                        // Always calculate own rate?
    securitiesInc: false,                  // Special securities income handling?
    statementSynthetic: false,             // Generated from statement hierarchy?
    // Special calculation flags:
    netInterestSpreadCalc: false,
    niiAfterFtpCalc: false,
    preProvisionCalc: false,
    netIncomeBeforeAllocationsCalc: false,
    netIncomeCalc: false
}
```

### 21.6 Quick GL Mapping

```javascript
{
    account: "105040",                    // 6-digit GL code
    name: "COMMERCIAL LOANS",             // Account name
    rollup: "Commercial Loans",            // Statement line label
    type: "auto"                          // "auto" | "balance" | "incexp" | "ftp" | "allocation" | "ignore"
}
```

### 21.7 Budget Line Mapping

```javascript
{
    key: "commercialloans",              // Normalized budget line key
    name: "Commercial Loans",             // Original name from budget workbook
    view: "Balance",                      // "Balance" | "IncExp" | ""
    rollup: "Commercial Loans",            // Statement line to map to
    ignore: false,                        // Exclude from calculations?
    type: "leaf"                          // "leaf" (include) or "rollup" (audit only)
}
```

### 21.8 Custom Statement Calculation

```javascript
{
    StatementName: "Earning Assets",      // Statement line
    Measure: "Balance",                   // "Balance" | "Income" | "Rate"
    Formula: "[Gross Loans] + [Total Investments] - [Total Securities MTM]",
    BranchFormula: "",                    // Optional branch-specific formula
    Description: "Custom balance formula for earning assets."
}
```

### 21.9 Measure Object

```javascript
{
    avg: 12500000.00,     // Average balance
    balance: 12550000.00, // Ending balance (or avg if view is Average Balance)
    inc: 52000.00,        // Income or expense
    rate: 0.05            // Annualized rate ('' if not calculable, NaN handled)
}
```

### 21.10 Liquidity Ratio

```javascript
{
    name: "Loan to Deposits",  // Ratio name
    direction: "max",          // "min" = lower is better, "max" = higher is better
    target: 0.85,              // Target threshold
    ewi1: 0.90,                // Early Warning Indicator 1
    ewi2: 0.95,                // Early Warning Indicator 2
    limit: 1.00                // Hard limit
}
```

---

## 22. Common Pitfalls

### 22.1 Calculation Gotchas

**The `allocationsAsIncomeView` pattern:**
Total Allocations must be calculated from `IncExp` view, not from income codes. The calculation engine has a special branch at line 3360-3363 that routes allocation calculations through `directAllocationRowsValue()` with a 6-level fallback chain.

**`momReferenceByDate` override:**
When loaded from a reference workbook, precomputed measures take priority over calculated ones. But the `computedMomLines` Set (line 3307) lists ~60 lines that must ALWAYS be computed regardless. If you add a new line that should always compute from GL data, add it to this Set.

**Day count convention fallback:**
`normalizeAnnualization()` at line 2977-3009 has a hardcoded `fixed` Map mapping statement labels to conventions. This is the single source of truth for which convention each line uses. If a new line is added without a `dayCount` flag, it defaults to `Actual/365`.

**Circular custom formulas:**
`safeEvalStatementFormula()` and `lineFormulaValue()` use `customFormulaEvaluationStack` to detect circular references. If Formula A references [Line B] and Formula B references [Line A], the second evaluation returns 0. This prevents infinite recursion but may produce unexpected results.

### 22.2 Data Gotchas

**Embedded CSV encoding:**
The `embeddedCsv` script tag uses `data-encoding="gzip-base64"`. It must be decoded with `atob()` then decompressed with `DecompressionStream('gzip')` before passing to `parseCsv()`.

**Excel serial date numbers:**
The `normalizedDate()` function at line 953-957 handles Excel serial numbers (days since 1900-01-01). These appear when XLSX files are parsed and date columns are read as numbers. The conversion uses `(serial - 25569) * 86400 * 1000`.

**Zero-branch rows:**
Some GL data has branch "0" or empty branch. These rows are always included in consolidated views but must be excluded from branch-specific views. The `normalizedBranchId()` function handles this normalization.

**Allocation accounts in the 600000 range:**
Allocation accounts (605010–605100) are in the 600000 range which normally means "Non-Interest Expense." But they're treated specially — they're only included in branch-filtered views, not consolidated.

### 22.3 Hierarchy Gotchas

**Dual key systems:**
The hierarchy uses TWO key systems: `OrganizationKey` / `AccountKey` / `StatementKey` (numeric, unique) AND `Map` values (string, branch number or GL code). The `Map` field is what connects a hierarchy node to actual data. A node with a `Map` value but no children is a leaf.

**Parent nodes cannot have Map values:**
`clearOrganizationRollupMaps()` enforces this. If a node has children AND a Map value, the Map is cleared. This prevents double-counting in rollups.

**Frozen lines cannot be deleted:**
The `isProtectedStatementLabel()` function (line 3906-3908) protects ~29 labels from deletion. Users can still rename them and change their annualization, but they cannot be removed from the hierarchy.

**Statement vs. Budget tabs in the editor:**
When editing the Budget hierarchy tab, the "add child" and "delete" buttons are disabled. Budget hierarchy is driven by budget line mappings, not by direct tree editing. Users must go to Budget Mapping Review to change budget hierarchy.

### 22.4 Performance Gotchas

**Cache invalidation is aggressive:**
Almost any filter change clears `measureCache`. This means re-rendering after a filter change recalculates every visible line. For the MoM Statement with ~70 visible lines and 6 date columns, that's ~420 calls to `lineMeasure()`. Each call does multiple Map lookups and sometimes recursive child calculations.

**No virtualization:**
Tables are rendered as full HTML strings. With 70+ rows and 7+ columns, this generates ~500 table cells per statement view. For the 13-month detail reports with 100+ rows and 13 columns, this balloons to 1300+ cells.

**SVG charts are recalculated on every render:**
The SVG donut and line charts are not cached. Every filter change rebuilds the full SVG markup strings.

### 22.5 Browser Compatibility Gotchas

**File System Access API:**
Used for external folder connections. Only available in Chromium-based browsers (Chrome, Edge). Not available in Firefox or Safari.

**IndexedDB:**
Used for processed data and budget caches. Available in all modern browsers but has a storage quota. Exceeding the quota causes silent failures.

**`requestIdleCallback`:**
Used for deferred startup loads (budget restore, shared hierarchy load). Not available in Safari. Has a `setTimeout` fallback.

---

## 23. Technical Debt Registry

### 23.1 Critical — Must Fix Before Adding Modules

| # | Item | Impact |
|---|---|---|
| TD-01 | `shared/hierarchy.js` is empty — both modules duplicate hierarchy logic | Every future module will duplicate again |
| TD-02 | `yield-dashboard.js` is 11,660 lines — single file contains everything | Impossible to maintain, test, or onboard |
| TD-03 | No separation of concerns | Data, metadata, calc, render, persistence all interleaved |
| TD-04 | No tests exist | Zero test coverage; any change risks breaking reported numbers |
| TD-05 | `momLines[]` and `rollupChildren{}` are independent hardcoded structures | Two sources of truth for statement hierarchy; must be maintained in sync |

### 23.2 High — Should Fix Before Major Features

| # | Item |
|---|---|
| TD-06 | ~500 individual GL codes hardcoded in `momLines[]` — changes require code edits |
| TD-07 | Organization tree hardcoded as JS constant — not loadable at runtime |
| TD-08 | Account hierarchy tree hardcoded as JS constant |
| TD-09 | Parent→child relationships hardcoded in `rollupChildren{}` — duplicates hierarchy info |
| TD-10 | CSS variables duplicated across two modules |
| TD-11 | No formal data schema specification |
| TD-12 | Version key management is ad-hoc — multiple version keys, no central migration system |

### 23.3 Medium

| # | Item |
|---|---|
| TD-13 | `money()` / `fmtMoney()` / `esc()` / `clean()` duplicated across modules |
| TD-14 | No defined module boundary contracts |
| TD-15 | Magic numbers for cache versions (`processedCacheVersion = 21`) |
| TD-16 | 250KB+ embedded CSV in production HTML |
| TD-17 | Legacy compatibility keys with unclear migration path |
| TD-18 | Hundreds of variables in global scope — no module pattern |
| TD-19 | All JS inline in Liquidity Dashboard — cannot be cached, linted, or tested separately |

### 23.4 Low

| # | Item |
|---|---|
| TD-20 | `shared/readme.md` is empty |
| TD-21 | Inconsistent key casing (PascalCase vs camelCase) in hierarchy data |
| TD-22 | Massive standard .gitignore with irrelevant entries |
| TD-23 | No linter or formatter configuration |

---

**End of Engineering Documentation**
