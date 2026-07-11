# Financial Analytics Platform — Architecture Documentation

**Document Version:** 1.0  
**Document Date:** 2026-07-11  
**Target Audience:** Platform engineers, maintainers, future module authors  
**Repository:** `Financial-Analytics-TB`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Platform Philosophy](#2-platform-philosophy)
3. [Current Module Inventory](#3-current-module-inventory)
4. [System Architecture Overview](#4-system-architecture-overview)
5. [Complete Architecture Diagrams](#5-complete-architecture-diagrams)
6. [Call Graphs](#6-call-graphs)
7. [Function Dependency Graphs](#7-function-dependency-graphs)
8. [Data Flow Diagrams](#8-data-flow-diagrams)
9. [Metadata Flow Diagrams](#9-metadata-flow-diagrams)
10. [Validation Flow Diagrams](#10-validation-flow-diagrams)
11. [Module Dependency Diagrams](#11-module-dependency-diagrams)
12. [Suggested Subsystem Boundaries](#12-suggested-subsystem-boundaries)
13. [Technical Debt Inventory](#13-technical-debt-inventory)
14. [Refactoring Opportunities Ranked by Risk](#14-refactoring-opportunities-ranked-by-risk)
15. [Appendix: Complete Function Index](#15-appendix-complete-function-index)

---

## 1. Executive Summary

The Financial Analytics Platform is a Microsoft Power Pages-based application serving community banks. It currently contains two modules: the **Yield Statement Dashboard** (production-complete, ~11,660 lines of monolithic JavaScript) and the **Liquidity Dashboard** (under development, a single self-contained HTML file with embedded data). 

The platform's architecture follows a **self-contained dashboard** pattern: each module is a standalone HTML page that embeds all data, logic, and metadata at build time. There is no runtime server-side data processing. All calculations execute client-side in the browser.

The platform's design intent (evidenced by the empty `shared/` directory) is a **shared-services architecture** where a hierarchy engine, calculation engine, data engine, settings engine, and shared UI components serve multiple modules. However, this vision has not been realized yet — both modules currently duplicate logic independently.

---

## 2. Platform Philosophy

As articulated in the project's own design documents:

```
Validation precedes analytics.
If data is not trusted, reports are worthless.
Metadata is the canonical source of truth.
Finance users configure the platform.
Reports consume validated metadata.
Existing business behavior must NEVER change during refactoring.
```

### How This Manifesto Manifests in Code

| Principle | Implementation |
|---|---|
| **Validation precedes analytics** | Load test diagnostics panel; allocation row audit; mapping completeness tracking; soft-fallback data loading with status reporting |
| **Metadata is canonical truth** | `organizationNodes`, `accountNodes`, `statementNodes`, `referenceAccounts` arrays drive everything; quick GL mappings and budget line mappings override auto-detection |
| **Finance users configure** | Settings panels for hierarchies, GL mappings, budget mappings, branding; org picker, account rollup picker; display defaults persistence |
| **Reports consume metadata** | `lineMeasure()`, `periodLineMeasure()`, `statementRenderableLines()` all derive values by walking the metadata tree against raw data |
| **Never break existing behavior** | Fallback data; embedded default hierarchies; localStorage version keying; legacy compatibility constants |

---

## 3. Current Module Inventory

### 3.1 Yield Statement Dashboard

| Attribute | Value |
|---|---|
| **Files** | `index.html` (604 lines), `yield-dashboard.css` (612+ lines), `yield-dashboard.js` (11,660 lines) |
| **Status** | Production-complete |
| **Runtime** | Single HTML page loaded in browser; all data embedded or loaded from local filesystem/IndexedDB |
| **Data Sources** | Embedded CSV (gzip-base64), browser file uploads (CSV/XLSX), File System Access API folders, IndexedDB cache |
| **Reports** | Overview (KPIs, funding mix, loan mix, trend, account detail), Summary (MTD/QTD/YTD comparisons), Yield Statement (MoM, QoQ, YTD), Budget (MTD/QTD/YTD BtA), Detail (13M BS/IS, Variance BS/IS, BtA BS/IS/IS-YTD, Attribution MoM/QoQ) |
| **Configuration** | Branding (name, logo, color palettes), organization hierarchy, account hierarchy, statement hierarchy, frozen lines, display defaults, quick GL mappings, budget line mappings, custom statement calculations |

### 3.2 Liquidity Dashboard

| Attribute | Value |
|---|---|
| **Files** | `liquidity-dashboard.html` (731 lines, self-contained) |
| **Status** | In development |
| **Runtime** | Single HTML page with all data, styles, and logic embedded inline |
| **Data Sources** | Embedded JSON (`<script id="embeddedLiquidityData">`) containing hierarchy, GL data, contractual cashflows, ratio definitions, and liquidity assumptions |
| **Reports** | Report (liquidity waterfall, KPIs, ratios, available sources), Details (waterfall, proforma BS/IS, availability, contingent lines, contingent usage), Assumptions (growth rate grids, ratio thresholds), Settings (build diagnostics, file inventory, state) |
| **Calculation Model** | 13-month runoff projection engine with category-level growth assumptions and contractual cashflow schedules |

### 3.3 Planned Modules

| Module | Description | Current State |
|---|---|---|
| **Budget Planning** | Forward-looking budget engine | Not started |
| **FTP Engine** | Funds transfer pricing calculations | Not started |
| **Allocation Engine** | Cost allocation between branches/cost centers | Not started |
| **Journal Generator** | Automated journal entry creation | Not started |
| **Plug Generator** | Balance sheet plug/balancing | Not started |
| **Scenario Engine** | Multi-scenario stress testing | Not started |
| **Executive Dashboard** | Consolidated executive view | Not started |
| **ALM** | Asset-liability management | Not started |
| **Capital Planning** | Capital adequacy planning | Not started |

---

## 4. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        BROWSER RUNTIME                                   │
│                                                                          │
│  ┌──────────────────────────────┐  ┌──────────────────────────────────┐ │
│  │   Yield Statement Dashboard  │  │    Liquidity Dashboard            │ │
│  │   ┌──────────────────────────┤  │    ┌──────────────────────────────┤ │
│  │   │ index.html               │  │    │ liquidity-dashboard.html     │ │
│  │   │   ├─ Embedded CSV data    │  │    │   ├─ Embedded JSON data      │ │
│  │   │   ├─ Embedded budget data │  │    │   ├─ Embedded styles         │ │
│  │   │   ├─ yield-dashboard.css  │  │    │   ├─ Embedded HTML           │ │
│  │   │   └─ yield-dashboard.js   │  │    │   └─ Embedded JS (inline)    │ │
│  │   └──────────────────────────┘  │    └──────────────────────────────┤ │
│  └──────────────────────────────┘  └──────────────────────────────────┘ │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                        STORAGE LAYER                              │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────┐  │   │
│  │  │ localStorage │  │  IndexedDB   │  │ File System Access API  │  │   │
│  │  │              │  │              │  │                         │  │   │
│  │  │ • Brand      │  │ • Processed  │  │ • Input Files folder    │  │   │
│  │  │ • Hierarchy  │  │   cache      │  │ • Budget folder         │  │   │
│  │  │   edits      │  │ • Budget     │  │ • Settings folder       │  │   │
│  │  │ • Display    │  │   cache      │  │ (Dashboard Hierarchies  │  │   │
│  │  │   defaults   │  │ • Detail     │  │  .xlsx)                 │  │   │
│  │  │ • Quick GL   │  │   report     │  │ • Monthly GL files      │  │   │
│  │  │   mappings   │  │   cache      │  │ • Budget XLSX files     │  │   │
│  │  │ • Budget     │  │              │  │                         │  │   │
│  │  │   mappings   │  │              │  │                         │  │   │
│  │  └──────────────┘  └──────────────┘  └─────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                  SHARED SERVICES (intended, not yet built)         │   │
│  │  ┌───────────┐ ┌────────────┐ ┌──────────┐ ┌──────────────────┐  │   │
│  │  │ Hierarchy │ │ Calculation│ │  Data    │ │ Settings Engine  │  │   │
│  │  │ Engine    │ │ Engine     │ │ Engine   │ │                  │  │   │
│  │  │           │ │            │ │          │ │                  │  │   │
│  │  │ (EMPTY)   │ │ (EMPTY)    │ │ (EMPTY)  │ │ (EMPTY)          │  │   │
│  │  └───────────┘ └────────────┘ └──────────┘ └──────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │          EXTERNAL DATA REPOSITORY (Network File Shares)            │   │
│  │ F:\Accounting\Treasury\Codex\Yield Statement\                      │   │
│  │   ├─ Input Files\           (monthly GL CSV files)                  │   │
│  │   ├─ Settings\              (Dashboard Hierarchies.xlsx)            │   │
│  │   └─ Budget\                (budget and reforecast XLSX files)      │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Complete Architecture Diagrams

### 5.1 Yield Statement Dashboard — Internal Architecture

```
index.html
│
├─ <link rel="stylesheet" href="yield-dashboard.css">
│   └─ CSS custom properties (--ink, --muted, --paper, --burgundy, etc.)
│   └─ Print media styles (@media print)
│   └─ Responsive breakpoints (1180px, 780px)
│
├─ <script id="embeddedCsv" type="text/plain">       ← GZIP-base64 encoded CSV
│   └─ Parsed by parseCsv() → normalized rows
│
├─ <script id="embeddedApprovedBudget" type="text/plain">  ← GZIP-base64
│   └─ Budget rows for fallback
│
└─ <script src="yield-dashboard.js"></script>
    │
    ├─── PHASE 0: Error Handling Bootstrap ───────────────────
    │    window.__yieldStartupErrors, showStartupError(),
    │    global error/unhandledrejection listeners
    │
    ├─── PHASE 1: Data Constants ──────────────────────────
    │    palette[], referenceAccounts[], organizationNodes[],
    │    accountNodes[], referenceHierarchy[], categoryOverrides{},
    │    juneSupplementParentNodes[], juneAccountSupplements[],
    │    momLines[] (the master statement definition array, ~145 entries)
    │
    ├─── PHASE 2: State Initialization ─────────────────────
    │    expandedMom/Set, expandedQoq/Set, etc.
    │    budgetLineMappings, customStatementCalculations
    │    embeddedDisplayDefaults[], momDisplayDefault/Set, momAlwaysDisplay/Set
    │
    ├─── PHASE 3: Metadata Caches ──────────────────────────
    │    valueIndex/Map, branchValueIndex/Map, rollupValueIndex/Map
    │    orgChildMapCache, accountChildMapCache, accountLeavesCache
    │    orgDescendantCache, statementChildMapCache
    │    measureCache, periodMeasureCache
    │    currentFilterCache, trendFilterCache
    │
    ├─── PHASE 4: Hierarchy Boot ───────────────────────────
    │    ensureRequiredOrganizationNodes()
    │    → Holding Company, Big Country, Project Eagle
    │    applySavedHierarchyEdits()  ← localStorage
    │    normalizeKnownHierarchyMappings()
    │    removeRedundantDefaultHierarchyNodes()
    │    initializeStatementNodes()
    │    buildDefaultStatementNodes() ← rollupChildren
    │
    ├─── PHASE 5: Utility Functions ────────────────────────
    │    $(id), on(id, event, handler)
    │    clean(), num(), money(), pct()
    │    normalizedDate(), normalizedBranchId(), normalizedAccountCode()
    │    parseCsv(), normalize() ← data ingestion
    │
    ├─── PHASE 6: Data Engine ──────────────────────────────
    │    buildDataIndexes()  ← populates valueIndex, branchValueIndex
    │    categoryFor()       ← GL range → category mapping
    │    quickMappingLookup() ← GL→rollup resolution
    │
    ├─── PHASE 7: Hierarchy Engine ─────────────────────────
    │    orgChildrenMap(), descendantOrgMaps()
    │    orgOptionRows(), accountPickerChildMap(), accountRollupTreeRows()
    │    statementLabelKey(), categoryKey()
    │
    ├─── PHASE 8: Calculation Engine ───────────────────────
    │    lineMeasure(line, date)          ← CORE: single-month measure
    │    periodLineMeasure(line, dates)   ← CORE: multi-month measure
    │    lineBalanceCodes(), lineIncomeCodes()
    │    dateValues(), rollupDateValues()
    │    weightedChildRate(), periodWeightedChildRate()
    │    safeEvalStatementFormula()       ← custom formula evaluator
    │    customLineFormulaResult()        ← custom formula dispatch
    │    annualizationFactor(), dayCount conventions
    │    nimNetInterestIncome(), directNetIncome()
    │    taxExemptIncome()  ← UBPR NIM calculation
    │    adjustedAverageAssets()
    │
    ├─── PHASE 9: Display/Render Functions ─────────────────
    │    renderOverview()           → metrics, charts, account detail
    │    renderMetrics()            → 17 KPI cards
    │    svgLine()                  → 13-month trend chart
    │    svgDonut()                 → funding mix donut
    │    svgLoanMix()               → loan mix donut
    │    renderComparisons()        → MTD/QTD/YTD comparison tables
    │    renderPeriodTable()        → generic comparison table builder
    │    renderMomStatement()       → MoM yield statement
    │    renderQoqStatement()       → QoQ yield statement
    │    renderYtdStatement()       → YTD yield statement
    │    renderBudgetStatement()    → Budget comparison
    │    renderDetailReport()       → 13M BS/IS, variance, BtA, attribution
    │    renderSettingsTab()        → data, hierarchy, mappings, branding
    │    renderHierarchyEditor()    → org/account/statement/budget editor
    │    renderQuickMappingReview() → GL→rollup mapping UI
    │    renderBudgetMappingReview()→ budget line→rollup mapping UI
    │
    ├─── PHASE 10: Persistence Layer ───────────────────────
    │    localStorage — brand, display defaults, hierarchy edits,
    │         quick GL mappings, budget line mappings,
    │         custom statement calculations, budget cache key,
    │         repository folder settings
    │    IndexedDB — processedCache (activeRows), budgetCache,
    │         detailReportCache
    │    saveHierarchySnapshotLocally(), saveHierarchyEdits()
    │    saveQuickGlMappings(), saveBudgetLineMappings()
    │
    ├─── PHASE 11: Event Bindings ──────────────────────────
    │    Filter changes → scheduleRender()
    │    Tab switching → activateTab()
    │    Org/Account picker → popover open/close/toggle
    │    Hierarchy editor → add/delete/edit/save
    │    Quick mapping → map/unmap/export/import
    │    Budget mapping → map/ignore/remove
    │    Print → buildPrintReport() → printReport DOM
    │    Branding → name, logo, palette
    │    Settings folders → File System Access API
    │
    └─── PHASE 12: Startup ─────────────────────────────────
         loadInitialDashboardData()
         → try IndexedDB cache → try external folder → fallback embedded CSV
         scheduleDeferredStartupLoads()
         → shared hierarchy workbook startup
         → budget cache restore
         applyBranding()
         renderOverview()
```

### 5.2 Liquidity Dashboard — Internal Architecture

```
liquidity-dashboard.html
│
├─ <script id="embeddedLiquidityData" type="application/json">
│   ├─ raw.asOfDate, raw.builtAt, raw.sourceFolder, raw.settingsWorkbook
│   ├─ raw.sourceFiles[]          ← build-time file inventory
│   ├─ raw.hierarchy.accountRows[]← account hierarchy (Yield-compatible)
│   ├─ raw.hierarchy.liquidityRows[]
│   ├─ raw.hierarchy.ignoredSubtotalAccounts[]
│   ├─ raw.gl.byCategory{}        ← GL balances by liquidity category
│   ├─ raw.gl.detail[]            ← GL line-level detail
│   ├─ raw.contractualCashflows{} ← cashflow schedules by name/period
│   ├─ raw.defaults               ← scenario name, growth rates, liquidity config, ratios
│   └─ raw.referenceOutput        ← May 2026 actual benchmark
│
├─ <style>
│   ├─ CSS custom properties (matching Yield Statement palette)
│   ├─ Layout: tabs, panels, cards, tables
│   └─ Responsive breakpoints
│
├─ <body> HTML structure
│   ├─ .topbar (name, status badge)
│   ├─ .tabs (Report | Details | Assumptions | Settings)
│   └─ Four .panel sections (one per tab)
│
└─ <script> (inline, lines 228-729)
    │
    ├─ State initialization from embedded defaults + localStorage
    ├─ Utility functions: fmtMoney(), fmtPct(), esc(), monthLabel(), fmtBytes()
    ├─ Growth rate functions: growth(), setGrowth()
    │
    ├─ CORE CALCULATION: project()         ← 13-month projection engine
    │   ├─ Starts from raw.gl.byCategory base balances
    │   ├─ Each period calculates: securities paydowns/purchases,
    │   │   loan runoff/new business, deposit runoff/inflow,
    │   │   brokered/CDARS/FHLB/Correspondent maturity/issuance
    │   ├─ Rolls forward balance sheet balances
    │   └─ Returns {rows, balances} map
    │
    ├─ Liquidity functions:
    │   availableLiquidity(b)             ← sum of all liquidity sources
    │   availableLiquiditySources(b)      ← individual source breakdown
    │   ratioValue(ratio, b)              ← ratio calculation from balances
    │   ratioStatus(value, ratio)         ← OK/EWI 1/EWI 2/Limit classification
    │
    ├─ Render functions:
    │   renderOutput()                   ← waterfall table, ratio table, liquidity sources
    │   renderDetails()                  ← all detail schedules
    │   renderHierarchyBalanceSheet()    ← proforma BS with hierarchy display
    │   renderMoneySchedule()            ← generic table from line defs
    │   renderAssumptions()              ← growth rate grid, ratio threshold grid
    │   renderSettings()                 ← build diagnostics, file inventory, state
    │   render()                         ← top-level dispatch
    │
    └─ Event bindings:
        Tab selection, input changes → saveState() → render()
        Detail tab selection → show/hide schedules
        Period view toggle (monthly/quarterly)
        Collapse/expand group rows
```
```

---

## 6. Call Graphs

### 6.1 Yield Statement — Startup Call Sequence

```
loadInitialDashboardData()
├─ tryLoadProcessedCache()
│   └─ IndexedDB.read(processedCacheStoreName, processedCacheKey)
│       └─ applyRows()  [on success]
│           └─ buildDataIndexes()
│               └─ [populates valueIndex, branchValueIndex, datesCache]
│           └─ populateFilters()
│               └─ renderOrgPicker()
│               └─ renderAccountPicker()
│               └─ renderQuickMappingRollups()
│           └─ renderOverview()
│               └─ renderMetrics()
│               │   └─ lineByLabel() ← momLines
│               │   └─ measure()
│               │   │   └─ lineMeasure()
│               │   │       └─ lineBalanceCodes()
│               │   │       └─ lineIncomeCodes()
│               │   │       └─ dateValues()
│               │   │       └─ rollupDateValues()
│               │   │       └─ childCategoriesFor()
│               │   │       └─ customLineFormulaResult()
│               │   │       └─ weightedChildRate() / annualizationFactor()
│               │   └─ moneyHtml() / pctHtml() / rateHtml()
│               ├─ svgLine() → trend data → SVG path math
│               ├─ svgDonut() → funding mix → SVG donut
│               ├─ svgLoanMix() → loan composition → SVG donut
│               └─ topAccountCategoryItems() → account detail table
│
├─ tryLoadExternalData()
│   └─ [File System Access API → folder handle]
│       └─ read all .csv/.xlsx files
│       └─ parseCsv() / XLSX.read()
│       └─ normalize()
│       └─ applyRows()
│           └─ buildDataIndexes() → populateFilters() → renderOverview()
│
└─ loadEmbeddedFallbackData()  [fallback]
    └─ decode embeddedCsv script tag content (gzip → base64 → text)
    └─ parseCsv()
    └─ normalize()
    └─ applyRows()
        └─ ... same chain as above
```

### 6.2 Yield Statement — Filter Change → Re-render

```
handleFilterChange()  [debounced → scheduleRender()]
├─ activeTabId()
│
├─ [if overviewTab]
│   └─ renderOverview()
│       ├─ renderMetrics()
│       ├─ svgLine()
│       ├─ svgDonut()
│       ├─ svgLoanMix()
│       └─ [account detail table]
│
├─ [if momTab / qoqTab / ytdStatementTab]
│   └─ renderMomStatement() / renderQoqStatement() / renderYtdStatement()
│       └─ statementRenderableLines()
│           └─ [filter by frozen/always-display/hideWhenChild]
│       └─ lineMeasure() ← for each visible line, for each date column
│           └─ [builds HTML table rows with drill-down support]
│
├─ [if budgetTab]
│   └─ renderBudgetStatement()
│       └─ budgetIndexesForVersion()
│       └─ periodLineMeasure() ← using budget data indexes
│
├─ [if comparisonTab]
│   └─ renderComparisons()
│       ├─ periodMetrics() → MTD/QTD/YTD
│       └─ renderPeriodTable() → HTML tables
│
├─ [if reportingTab]
│   └─ renderDetailReport()
│       ├─ renderBalanceSheet13Report()
│       ├─ renderIncomeStatement13Report()
│       ├─ renderVarianceReport()
│       ├─ renderBudgetToActualReport()
│       └─ renderAttributionReport()
│
└─ [if settingsTab]
    └─ renderSettingsTab()
        ├─ renderRepositoryFolder()
        ├─ renderBudgetFolder()
        ├─ renderQuickMappingReview()
        ├─ renderBudgetMappingReview()
        ├─ renderHierarchyEditor()
        └─ renderLoadTestDiagnostics()
```

### 6.3 Yield Statement — `lineMeasure()` Call Graph (Single Month)

```
lineMeasure(line, date)
│
├─ [CACHE CHECK: measureCache]
│
├─ [REFERENCE DATA PATH]
│   └─ momReferenceByDate[date][line.label]  ← precomputed external reference
│
├─ [AVERAGE BALANCE]
│   ├─ lineBalanceCodes(line)
│   │   ├─ quickMappedCodesForLine(line, 'balance')
│   │   ├─ accountDimensionLeaves(balanceDimensionLabel)
│   │   ├─ supplementalBalanceCodes(label)
│   │   └─ statementInputCodes(line.bal) → lowestMappedDescendantCodes()
│   ├─ dateValues(date, balanceCodes, 'Average Balance')
│   │   └─ valueIndex.get(key) || branchValueIndex loop
│   ├─ rollupDateValues(date, line.label, 'Average Balance')
│   │   └─ rollupValueIndex.get(key)
│   ├─ [if earningAssetsCalc]
│   │   └─ lineMeasure(GrossLoans).avg + lineMeasure(TotalInvestments).avg
│   │       - lineMeasure(TotalSecuritiesMTM).avg
│   ├─ [if excludeMtm]
│   │   └─ - lineMeasure(TotalSecuritiesMTM).avg
│   └─ customLineFormulaResult(line, date, 'Balance')
│       └─ safeEvalStatementFormula() ← [Line A] + [Line B] parser
│
├─ [ENDING BALANCE]
│   ├─ [same pattern as average, but view='Ending Balance']
│   └─ customLineFormulaResult(line, date, 'EndingBalance')
│
├─ [INCOME]
│   ├─ lineIncomeCodes(line)
│   │   ├─ quickMappedCodesForLine(line, 'income')
│   │   ├─ accountDimensionLeaves(incomeDimensionLabel)
│   │   └─ statementInputCodes(line.inc)
│   ├─ childIncRaw = Σ childCategoriesFor(label).inc
│   ├─ directIncRaw = dateValues(date, incCodes, 'IncExp')
│   ├─ incRaw = rollupInc ? (childIncRaw + quick) : directIncRaw
│   │   + rollupDateValues(date, line.label, 'IncExp')
│   ├─ [SPECIAL CALCULATIONS]
│   │   ├─ netInterestSpreadCalc → EarningAssets.inc - TotalFundingLiabilities.inc
│   │   ├─ niiAfterFtpCalc → NII.inc + FTP.inc
│   │   ├─ preProvisionCalc → NII.inc + FTP.inc + NonInterestIncome.inc
│   │   │                     - NonInterestExpense.inc
│   │   ├─ netIncomeBeforeAllocationsCalc → PreProvision.inc - PLL.inc
│   │   └─ netIncomeCalc → branch?
│   │       ? NIBeforeAlloc.inc - TotalAllocations.inc
│   │       : PreProvision.inc - PLL.inc
│   └─ customLineFormulaResult(line, date, 'Income')
│
└─ [RATE]
    ├─ customLineFormulaResult(line, date, 'Rate')
    ├─ spread → earningRate - fundingRate
    ├─ nim → NII * 12 / adjustedAverageAssets(date)
    │   ├─ ubprNim → tax-equivalent NII (÷0.79 gross-up)
    │   └─ monthlyNim → nimNetInterestIncome(date)
    ├─ roa → directNetIncome * 12 / directAverageBalance(TotalAssets)
    ├─ roe → directNetIncome * 12 / directAverageBalance(TotalCapital)
    ├─ earningAssetsCalc → weightedChildRate(line, date)
    │   └─ Σ (child.rate * child.avg) / Σ child.avg
    └─ default → |inc| / |avg| * annualizationFactor(date, convention)
        ├─ 30/360 → 360/30 = 12
        ├─ 90/360 → 360/90 = 4
        ├─ ACT/360 → 360 / daysInMonth
        └─ Actual/365 → 365 / daysInMonth
```

### 6.4 Liquidity Dashboard — `project()` Call Graph

```
project()
│
├─ INITIALIZATION
│   ├─ val(category) → raw.gl.byCategory[category]['Ending Balance']
│   ├─ cf(name, period) → raw.contractualCashflows[name][period]
│   └─ b = {cash, overnight, securities, loans, nib, ib, cb, cdars,
│            brokered, fhlb, otherAssets, otherLiab, msr, capital, retained}
│
├─ FOR EACH PERIOD (starting at 2026-05):
│   │
│   ├─ [MAY 2026: ACTUAL LOCK]
│   │   └─ all values from raw.referenceOutput.actualMay
│   │
│   ├─ [FORECAST: each subsequent month]
│   │   ├─ Securities Paydowns = cf('Securities Paydowns', period)
│   │   ├─ Securities Purchases = -(securities * growth('Securities', period))
│   │   ├─ Loan Runoff = cf('Loan Runoff', period)
│   │   ├─ Loan NB CF = -(loans * growth('Loans', period))
│   │   ├─ NIB Deposits Runoff = min(0, nib * growth('NIB Deposits', period))
│   │   ├─ NIB Deposits Inflow = max(0, nib * growth('NIB Deposits', period))
│   │   ├─ IB Deposits Runoff = cf('IB Deposits Runoff', period)
│   │   ├─ IB Deposits Inflow = max(0, ib * growth('IB Deposits', period))
│   │   ├─ Brokered/CDARS/FHLB/Correspondent maturity and issuance
│   │   ├─ Net Asset Activity = SecuritiesΔ + LoansΔ
│   │   ├─ Net Liability Activity = Σ all deposit/borrowing changes
│   │   ├─ Net Cash Provided = Net Asset + Net Liability + Net Other
│   │   │                     + Earnings + Dividends
│   │   ├─ Ending Overnight += Net Cash Provided
│   │   └─ [roll forward all balance sheet categories]
│   │
│   └─ availableLiquidity(b) = overnight + brokeredCapacity
│       + fhlbAvailability + frbLine + cash + cdarsCapacity
│       + unpledgedSecurities + knightDoss + fedFundsLines + msr + mortgageSales
│
└─ RETURN {rows, balances}
```

---

## 7. Function Dependency Graphs

### 7.1 Yield Statement — Function Dependency Matrix

```
                    ┌─────────────────────┐
                    │   MomLines Array     │ ← MASTER METADATA (145 entries)
                    └─────────┬───────────┘
                              │ consumed by:
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
  lineByLabel()       statementLabelKey()   categoryKey()
          │                   │                   │
          ▼                   ▼                   ▼
  lineBalanceCodes()  lineIncomeCodes()   childCategoriesFor()
          │                   │                   │
          └─────────┬─────────┘                   │
                    ▼                             │
            dateValues()                          │
            rollupDateValues()                    │
                    │                             │
                    ▼                             ▼
            ┌───────────────────┐     ┌──────────────────────┐
            │  lineMeasure()    │◄────│ childCategoriesFor() │
            │  (SINGLE MONTH)   │     └──────────────────────┘
            │                    │
            │  returns: {        │     ┌──────────────────────┐
            │    avg, balance,   │◄────│ quickMappedCodesFor- │
            │    inc, rate       │     │ Line()               │
            │  }                 │     └──────────────────────┘
            └─────────┬─────────┘
                      │              ┌──────────────────────┐
                      │              │ customLineFormula-    │
                      │◄─────────────│ Result() → safeEval-  │
                      │              │ StatementFormula()    │
                      │              └──────────────────────┘
                      ▼
            ┌───────────────────────┐
            │ periodLineMeasure()   │ ← CORE PERIOD CALC
            │ (MULTI-MONTH)         │
            │                       │
            │  returns: {           │
            │    avg, balance,      │
            │    inc, rate          │
            │  }                    │
            └───────────┬───────────┘
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
    renderMetrics  renderMomState-  renderComparisons
    (Overview KPIs) ment (MoM Table) (MTD/QTD/YTD)
```

### 7.2 Yield Statement — Render Function Dependencies

```
renderOverview()
├── renderMetrics()          ← 17 KPI cards
│   ├── lineByLabel()
│   ├── measure() → lineMeasure()
│   ├── moneyHtml() / pctHtml() / rateHtml()
│   └── [selected rollup aware logic]
├── svgLine()                ← 13-month trend chart
│   └── currentData()  [or trendData()]
├── svgDonut()               ← funding mix donut
│   └── lineBalanceCodes() + lineMeasure()
├── svgLoanMix()             ← loan mix donut
├── topAccountCategoryItems()
│   └── lineByLabel() + lineMeasure()
└── [account detail table]
    └── currentData() → byAccount()

renderComparisons()
├── periodMetrics(startDate, endDate) → {name, type, value}[]
├── periodComparisonRows(current, prior) → + variance, change
└── renderPeriodTable() → HTML

renderMomStatement()   / renderQoqStatement()  
renderYtdStatement()
├── statementRenderableLines()
│   ├── momAlwaysDisplay /Set
│   ├── isFrozenStatementLabel()
│   ├── isBaseVisibleMomLine()
│   └── [hideWhenChild logic]
├── lineMeasure() ← for each visible line
├── displayMeasureForLabel()
│   └─ lineMeasure() w/ cache
├── drillChildCategoriesFor()
└── [HTML table assembly with indent + drill buttons]

renderBudgetStatement()
├── budgetIndexesForVersion()
├── periodLineMeasure() ← using budget data
└── [HTML table assembly]

renderDetailReport()
├── renderBalanceSheet13Report()
├── renderIncomeStatement13Report()
├── renderVarianceReport()
├── renderBudgetToActualReport()
└── renderAttributionReport()
    └── [each uses accountDimensionLeaves() for 13M expansion]
```

### 7.3 Liquidity Dashboard — Function Dependencies

```
render()
├── renderOutput()
│   ├── project()                    ← CORE
│   │   ├── growth() / setGrowth()
│   │   ├── cf()                     ← contractual cashflows
│   │   └── availableLiquidity()
│   ├── [waterfall HTML table]
│   ├── [ratio table] → ratioValue() + ratioStatus()
│   └── [liquidity sources table]
├── renderDetails()
│   ├── renderMoneySchedule()
│   ├── renderHierarchyBalanceSheet()
│   │   ├── balanceSheetHierarchyRows()    ← filters raw.hierarchy.accountRows
│   │   └── projectedHierarchyAmounts()    ← proportionally scales GL to forecast
│   └── [detail schedule tables]
├── renderAssumptions()
│   └── [growth rate input grid + ratio threshold grid]
└── renderSettings()
    └── [build diagnostics, file inventory, state]
```

---

## 8. Data Flow Diagrams

### 8.1 Yield Statement — End-to-End Data Flow

```
┌─────────────┐    ┌──────────────┐    ┌────────────────┐
│  FILE       │    │   RAW PARSING│    │  NORMALIZATION  │
│  SOURCES    │───►│              │───►│                 │
│             │    │ parseCsv()   │    │ normalize()     │
│ • CSV       │    │ XLSX.read()  │    │                 │
│ • XLSX      │    │              │    │ • date→ISO      │
│ • Folder    │    │ returns:     │    │ • account→6digit│
│   API       │    │ [{headers}]  │    │ • branch→ID     │
│             │    │              │    │ • view→label    │
│ • Embedded  │    └──────────────┘    │ • amount→num    │
│   gzip CSV  │                        │                 │
└─────────────┘                        └────────┬────────┘
                                                │
                                                ▼
┌──────────────────────────────────────────────────────────────┐
│                    INDEXED DATA STRUCTURES                     │
│                                                               │
│  valueIndex: Map<"date|view|account", amount>                 │
│  branchValueIndex: Map<"date|view|account|branch", amount>    │
│  rollupValueIndex: Map<"date|view|label", amount>             │
│  firstRowByAccount: Map<account, row>                         │
│  datesCache: string[] (sorted ISO dates)                      │
│  accountSet: Set<account>                                     │
│                                                               │
└────────────────────────────┬───────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                    METADATA LAYER                              │
│                                                               │
│  organizationNodes[]  ← org hierarchy (holding→bank→region→   │
│                          county→branch)                        │
│  accountNodes[]       ← account hierarchy                     │
│  statementNodes[]     ← statement line hierarchy               │
│  momLines[]           ← line definitions (bal[], inc[],        │
│                          flags: rollupBal, noRate, spread,)    │
│  quickGlMappings[]    ← GL account → rollup + type             │
│  budgetLineMappings[] ← budget line key → rollup + type        │
│  rollupChildren{}     ← parent→child relationships             │
│                                                               │
└────────────────────────────┬───────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                    CALCULATION ENGINE                          │
│                                                               │
│  lineMeasure(line, date)                                      │
│    ├─ resolve balance codes: lineBalanceCodes(line)           │
│    │   → quickMappedCodesForLine()                            │
│    │   → accountDimensionLeaves()                             │
│    │   → supplementalBalanceCodes()                           │
│    │   → statementInputCodes(line.bal)                        │
│    ├─ resolve income codes: lineIncomeCodes(line)              │
│    ├─ sum from valueIndex: dateValues() / rollupDateValues()  │
│    ├─ child rollup: childCategoriesFor() → recursive measure  │
│    ├─ special calc: netInterestSpread, niiAfterFtp, etc.      │
│    ├─ custom formula: safeEvalStatementFormula()              │
│    └─ rate: weightedChildRate() * annualizationFactor()       │
│                                                               │
│  Returns: { avg, balance, inc, rate }                         │
│                                                               │
└────────────────────────────┬───────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                    RENDERING ENGINE                            │
│                                                               │
│  → HTML tables (mom-table, report-table, etc.)                │
│  → SVG charts (donut, bar, line)                              │
│  → Print reports (separate DOM fragment)                      │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### 8.2 Liquidity Dashboard — Data Flow

```
┌──────────────────────────────────┐
│  BUILD-TIME DATA ASSEMBLY         │
│                                   │
│  Build tool (external):           │
│  • Reads GL files                 │
│  • Reads hierarchy workbook       │
│  • Reads reference output         │
│  • Calculates contractual CFs     │
│  • Embeds everything into JSON    │
│    inside <script> tag             │
│                                   │
│  OUTPUT: liquidity-dashboard.html │
│  (fully self-contained)           │
└───────────────┬───────────────────┘
                │
                ▼
┌──────────────────────────────────────────────┐
│  RUNTIME: Browser parses embedded JSON        │
│                                               │
│  raw = JSON.parse(embeddedLiquidityData)      │
│  raw.gl.byCategory[category][view]            │
│  raw.gl.detail[].hierarchyKey, liquidityCat   │
│  raw.contractualCashflows[name][period]       │
│  raw.hierarchy.accountRows[]                  │
│  raw.defaults.{growthRates, liquidity, ratios}│
│  raw.referenceOutput.actualMay                │
│                                               │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────┐
│  USER STATE (localStorage)                    │
│                                               │
│  state.growthRates[category][period]          │
│  state.liquidity.{brokeredCdCapacity, etc.}   │
│  state.ratios[].{target, ewi1, ewi2, limit}  │
│  state.scenarioName, scenarioDescription      │
│                                               │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────┐
│  CALCULATION ENGINE                           │
│                                               │
│  project()                                    │
│    → {rows: Map<name, Map<period, amount>>}   │
│    → {balances: Map<period, {cash, loans...}>}│
│                                               │
│  ratioValue(ratio, balances)                  │
│  availableLiquidity(balances)                 │
│  projectedHierarchyAmounts(period, balances)  │
│                                               │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────┐
│  RENDERING ENGINE                             │
│                                               │
│  → Waterfall table (source/use breakdown)     │
│  → Ratio table (color-coded status)           │
│  → Liquidity sources table                    │
│  → Proforma BS/IS tables                      │
│  → Detail schedule tables                     │
│  → Assumption grids                           │
│  → Settings diagnostic tables                 │
│                                               │
└──────────────────────────────────────────────┘
```

---

## 9. Metadata Flow Diagrams

### 9.1 How Metadata Governs the Platform

```
┌───────────────────────────────────────────────────────────────┐
│  CANONICAL METADATA SOURCE                                     │
│  Dashboard Hierarchies.xlsx (shared workbook, Excel format)     │
│  Located at: F:\Accounting\Treasury\Codex\Yield Statement\      │
│              Settings\Dashboard Hierarchies.xlsx                │
│                                                                │
│  Sheets contained:                                              │
│  ├─ Organization (org tree: key, parent, name, map, sort)       │
│  ├─ Account (account tree: key, parent, name, map, type)        │
│  ├─ Statement (statement lines: key, parent, name, sort,        │
│  │             frozen, annualization)                            │
│  ├─ Quick GL Mappings (account → rollup → mapping type)         │
│  ├─ Budget Line Mappings (budget line → rollup → leaf/rollup)   │
│  ├─ Custom Statement Calculations (formulas)                    │
│  └─ Display Defaults (always-displayed statement lines)         │
│                                                                │
└───────────────────────────┬───────────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                  ▼
    ┌──────────┐    ┌─────────────┐    ┌──────────────┐
    │ Build    │    │ Settings    │    │ runtime      │
    │ Time     │    │ Tab         │    │ hardcoded    │
    │ Embed    │    │ Save/Load   │    │ defaults     │
    └──────────┘    └─────────────┘    └──────────────┘
          │                 │                  │
          ▼                 ▼                  ▼
    ┌──────────┐    ┌─────────────┐    ┌──────────────────┐
    │Liquidity │    │localStorage  │    │ embedded constants│
    │Dashboard │    │ hierarchyEdits│   │ in yield-dashboard│
    │JSON embed│    │ V2             │    │ .js              │
    └──────────┘    └─────────────┘    └──────────────────┘
```

### 9.2 Metadata Merge Strategy (Yield Statement)

```
METADATA LOADING ORDER (at startup):

Step 1: Hardcoded defaults in yield-dashboard.js
   ├─ organizationNodes[]     ← embedded org tree
   ├─ accountNodes[]          ← embedded account tree
   ├─ statementNodes[]        ← embedded statement tree
   ├─ momLines[]              ← embedded line definitions
   ├─ rollupChildren{}        ← embedded parent→child map
   ├─ embeddedDisplayDefaults[] ← always-displayed lines
   ├─ embeddedCustomStatementCalculations[] ← 8 built-in formulas
   └─ referenceAccounts[] / referenceHierarchy[]

Step 2: localStorage overrides
   ├─ yieldDashboardHierarchyEditsV2 → applyHierarchySnapshot()
   │   (mutates organizationNodes, accountNodes, statementNodes)
   ├─ momAlwaysDisplay → overrides default always-displayed set
   ├─ momDisplayDefault → default display preferences
   ├─ quickGlMappings → account → rollup mappings
   ├─ budgetLineMappings → budget line → rollup mappings
   └─ customStatementCalculations → user-defined formulas

Step 3: Runtime normalization
   ├─ ensureRequiredOrganizationNodes()
   │   (ensures Holding Company, Big Country, Project Eagle exist)
   ├─ normalizeKnownHierarchyMappings()
   │   (audit-forced rollup assignments for known accounts)
   ├─ removeRedundantDefaultHierarchyNodes()
   │   (removes "Total Liabilities & Equity" duplicate)
   ├─ applyJuneAccountSupplements()  [IIFE]
   │   (adds June-specific account entries to reference data)
   ├─ initializeStatementNodes()
   │   (merges hardcoded + saved statement nodes, enforces frozen)
   └─ enforceSingleStatementRollupAssignments()
       (ensures no GL account has conflicting rollup assignments)

Step 4: User edits (via Hierarchy Editor UI)
   ├─ saveHierarchyEdit() → localStorage
   └─ saveHierarchyEdits() → localStorage
       → refreshes data indexes, re-renders all views
```

### 9.3 Organization Hierarchy Metadata Structure

```json
{
  "OrganizationKey": 900,          // unique identifier
  "OrganizationParentKey": 0,      // parent reference (0 = root)
  "OrganizationName": "Holding Company",
  "UnaryOper": "+",                // + or - for consolidation
  "SortOrder": 0,                  // display order
  "Map": ""                        // branch ID mapping (leaf nodes only)
}
```

**Sample tree:**
```
900 Holding Company
├─ 999 TexasBank
│  ├─ 92 Commercial Banking Division
│  │  └─ 91 Central Texas
│  │     ├─ 68 Brown County
│  │     │  ├─ 1  → Map:"1"  (01 - Brownwood)
│  │     │  ├─ 2  → Map:"2"  (02 - Market Place)
│  │     │  ├─ 13 → Map:"3"  (03 - Bangs)
│  │     │  └─ 3  → Map:"4"  (04 - Camp Bowie)
│  │     ├─ 69 Comanche County
│  │     │  └─ 8  → Map:"10" (10 - Comanche)
│  │     └─ 70 Erath County
│  │        ├─ 4  → Map:"5"  (05 - Stephenville)
│  │        ├─ 5  → Map:"6"  (06 - Graham)
│  │        ├─ 6  → Map:"7"  (07 - Dublin)
│  │        └─ 7  → Map:"9"  (09 - Eastland)
│  └─ 1001 Big Country
│     └─ 1002 → Map:"12" (Project Eagle)
└─ ... (more branches)
```

---

## 10. Validation Flow Diagrams

### 10.1 Yield Statement — Validation Checkpoints

```
┌──────────────────────┐
│ DATA INGESTION       │
│ VALIDATION           │
│                      │
│ parseCsv() filters:  │
│ • Skip blank rows    │
│ • Require all fields │
│                      │
│ normalize() filters: │
│ • date must parse    │
│ • account or rollup  │
│   label required     │
│ • view must exist    │
│ • amount must be     │
│   finite number      │
│ • Skip income accts  │
│   with ending        │
│   balance view       │
│   (>= 300000)        │
│                      │
│ → loadTestSummary:   │
│   rawRows,           │
│   normalizedRows,    │
│   skippedRows        │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ MAPPING VALIDATION   │
│                      │
│ mappingReviewRows(): │
│ • Detect unmapped    │
│   GL accounts        │
│ • Detect unconfigured│
│   branch numbers     │
│ • Compare to         │
│   configuredGlCodes()│
│ • Cross-reference    │
│   orgNodeBranchMap() │
│                      │
│ organizationMapping  │
│ ReviewRows():        │
│ • Branch IDs not in  │
│   org hierarchy      │
│                      │
│ → mappingStatusCounts│
│ → unmappedCount      │
│ → org gap count      │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ ALLOCATION AUDIT     │
│                      │
│ allocationRowsAudit():│
│ • Count allocation   │
│   rows for date/view │
│ • Track branch       │
│   granularity        │
│ • Multi-level        │
│   fallback:          │
│   1. indexed leaf    │
│   2. indexed control │
│   3. rollup index    │
│   4. direct leaf     │
│   5. direct control  │
│   6. fallback branch │
│   7. global fallback │
│                      │
│ directAllocationRows │
│ Value():             │
│ • Same fallback chain│
│                      │
│ → allocationSource   │
│   WarningText()      │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ LOAD TEST DIAGNOSTICS│
│                      │
│ renderLoadTest-      │
│ Diagnostics():       │
│ • Files count        │
│ • Raw rows           │
│ • Normalized rows    │
│ • Skipped rows       │
│ • Dates found        │
│ • Unique accounts    │
│ • Unique branches    │
│ • Missing columns    │
│ • Unmapped active    │
│   accounts           │
│ • Allocation audit   │
│ • Source message     │
│                      │
│ display as 4-card    │
│ grid + details list  │
└──────────────────────┘
```

### 10.2 Hierarchy Integrity Validations

```
┌──────────────────────────┐
│ ORGANIZATION VALIDATION  │
│                          │
│ ensureRequiredOrganiza-  │
│ tionNodes():             │
│ • Remove vestigial       │
│   "no branch" nodes      │
│ • Ensure Holding Company │
│   (key 900, parent 0)    │
│ • Ensure Big Country     │
│   (key 1001)             │
│ • Ensure Project Eagle   │
│   (key 1002, map "12")   │
│ • Fix orphaned nodes:    │
│   parent→holding if      │
│   invalid parent but     │
│   has children/map       │
│ • clearOrganization-     │
│   RollupMaps():          │
│   nodes with children    │
│   cannot have Map values │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ ACCOUNT VALIDATION       │
│                          │
│ normalizeKnownHierarchy  │
│ Mappings():              │
│ • requiredRollupByAccount│
│   (8 hardcoded accounts) │
│   → enforce Statement-   │
│     Rollup & AccountType │
│ • requiredBudgetRollup-  │
│   ByKey (14 entries)     │
│   → enforce budget line  │
│     mapping rollups      │
│ • requiredBudgetAuditKeys│
│   (30+ entries)          │
│   → auto-create missing  │
│     budget line mappings │
│ • requiredBudgetAudit-   │
│   Names (30+ entries)    │
│   → ensure names match   │
│ • Auto-fix quick GL      │
│   mapping rollups        │
│ • Apply to reference-    │
│   Accounts & reference-  │
│   Hierarchy              │
│                          │
│ removeRedundantDefault-  │
│ HierarchyNodes():        │
│ • Remove duplicate       │
│   "Total Liabilities &   │
│   Equity" branch         │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ MAPPING CONSISTENCY      │
│                          │
│ enforceSingleStatement-  │
│ RollupAssignments():     │
│ • Build canonical map    │
│   from quick GL mappings │
│   AND account node field │
│ • Apply single rollup    │
│   to all account nodes   │
│   for each GL code       │
│ • Prevent conflicting    │
│   rollup assignments     │
│                          │
│ applySingleStatement-    │
│ RollupForAccount():      │
│ • Sets StatementRollup,  │
│   AccountType, Mapping-  │
│   Type on all account    │
│   nodes with same code   │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ STATEMENT VALIDATION     │
│                          │
│ initializeStatementNodes:│
│ • Normalize existing     │
│   nodes                   │
│ • Build defaults from    │
│   rollupChildren{}       │
│ • Add missing defaults   │
│ • Enforce embeddedFrozen │
│   StatementDefaults      │
│   (29 labels)            │
│ • Add missing frozen     │
│   nodes                  │
│ • Deduplicate keys       │
│ • Assign annualization   │
│   based on line flags    │
│                          │
│ Version-keyed migrations:│
│ • embeddedSubtotalStyle  │
│   DefaultsVersion        │
│ • embeddedEditableFrozen │
│   Defaults               │
│ • childRollupDisplay-    │
│   ResetKey               │
└──────────────────────────┘
```

---

## 11. Module Dependency Diagrams

### 11.1 Current State — Implicit Dependencies

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  yield-dashboard.js  ◄════════════════╗                          │
│  (11,660 lines)                      ║                          │
│                                       ║ references same          │
│  ├─ OWN hierarchy engine              ║ settings workbook        │
│  ├─ OWN calculation engine            ║ path                     │
│  ├─ OWN data engine                   ║                          │
│  ├─ OWN rendering engine              ║                          │
│  └─ OWN persistence layer             ║                          │
│                                       ║                          │
│                    ┌──────────────────╣                          │
│                    │                  ║                          │
│  liquefy-dashboard │                  ║                          │
│  .html             │                  ║                          │
│  (731 lines)       │                  ║                          │
│                    │                  ║                          │
│  ├─ OWN hierarchy  │                  ║                          │
│  ├─ OWN calculation│                  ▼                          │
│  ├─ OWN data       │     Dashboard Hierarchies.xlsx              │
│  ├─ OWN rendering  │     (shared workbook — only at build time)   │
│  └─ OWN state      │                                             │
│                    │                                             │
│                    │     shared/hierarchy.js  (EMPTY)             │
│                    │     shared/readme.md      (EMPTY)            │
│                    │                                             │
│  DUPLICATED:       │                                             │
│  • hierarchy walk  │                                             │
│  • money formatting│                                             │
│  • date parsing    │                                             │
│  • category mapping│                                             │
│  • balance rollup  │                                             │
└────────────────────┴─────────────────────────────────────────────┘
```

### 11.2 Target State — Proposed Shared Services Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │              SHARED SERVICES LAYER                       │     │
│  │                                                          │     │
│  │  shared/hierarchy.js                                     │     │
│  │  ├─ organizationNodes[]    (org tree data)                │     │
│  │  ├─ accountNodes[]         (account tree data)            │     │
│  │  ├─ statementNodes[]       (statement tree data)          │     │
│  │  ├─ orgChildrenMap()       (tree index)                   │     │
│  │  ├─ descendantOrgMaps()    (branch resolution)            │     │
│  │  ├─ leafAccountsForLabel() (GL → rollup resolver)         │     │
│  │  └─ hierarchy snapshot/restore                           │     │
│  │                                                          │     │
│  │  shared/data-engine.js    (FUTURE)                       │     │
│  │  ├─ parseCsv()                                            │     │
│  │  ├─ normalize()                                           │     │
│  │  ├─ buildDataIndexes()                                    │     │
│  │  └─ IndexedDB CRUD                                       │     │
│  │                                                          │     │
│  │  shared/calc-engine.js    (FUTURE)                        │     │
│  │  ├─ lineMeasure()                                         │     │
│  │  ├─ periodLineMeasure()                                   │     │
│  │  ├─ rate calculations                                     │     │
│  │  └─ annualization                                         │     │
│  │                                                          │     │
│  │  shared/settings-engine.js (FUTURE)                       │     │
│  │  ├─ quick GL mappings                                     │     │
│  │  ├─ budget line mappings                                  │     │
│  │  ├─ custom calculations                                   │     │
│  │  └─ shared workbook read/write                            │     │
│  │                                                          │     │
│  │  shared/ui-components.css (FUTURE)                        │     │
│  │  ├─ theme variables                                       │     │
│  │  ├─ card/panel styles                                     │     │
│  │  ├─ table styles                                          │     │
│  │  └─ picker components                                     │     │
│  │                                                          │     │
│  └────────────────────────────────────────────────────────┘     │
│                            │                                     │
│          ┌─────────────────┼─────────────────┐                  │
│          ▼                 ▼                  ▼                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐        │
│  │ Yield        │ │ Liquidity    │ │ Future Modules    │        │
│  │ Statement    │ │ Dashboard    │ │ (Budget, FTP,     │        │
│  │              │ │              │ │  Allocation, etc.) │        │
│  │ OWN:         │ │ OWN:         │ │                    │        │
│  │ • render*()  │ │ • render*()  │ │ OWN:               │        │
│  │ • UI handlers│ │ • UI handlers│ │ • module-specific  │        │
│  │ • charts     │ │ • projection │ │   logic            │        │
│  │ • print      │ │ • ratios     │ │                    │        │
│  └──────────────┘ └──────────────┘ └──────────────────┘        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. Suggested Subsystem Boundaries

### 12.1 Identified Subsystems

| # | Subsystem | Files Involved | Current State | Role |
|---|---|---|---|---|
| **S1** | **Hierarchy Engine** | `shared/hierarchy.js` (empty), `yield-dashboard.js` (inlined) | Duplicated, not extracted | Tree structure, branch resolution, leaf→root traversal |
| **S2** | **Data Engine** | `yield-dashboard.js` (inlined) | Embedded in Yield Statement only | CSV/XLSX parsing, normalization, indexing |
| **S3** | **Calculation Engine** | `yield-dashboard.js` (inlined), `liquidity-dashboard.html` (own impl) | Two independent engines | Line measure, rate calc, annualization, formulas |
| **S4** | **Settings/Mapping Engine** | `yield-dashboard.js` (inlined) | Embedded in Yield Statement | Quick GL mappings, budget line mappings, custom formulas |
| **S5** | **Persistence Layer** | `yield-dashboard.js` (inlined) | Embedded in Yield Statement | localStorage, IndexedDB, File System Access API |
| **S6** | **UI Component Library** | `yield-dashboard.css`, `liquidity-dashboard.html <style>` | Nearly identical CSS duplicated | Cards, panels, tables, pickers, tabs |
| **S7** | **Rendering Engine** | `yield-dashboard.js` (inlined), `liquidity-dashboard.html` | Duplicated patterns | Table generation, SVG charts, drill-down |
| **S8** | **Branding/Theming** | `yield-dashboard.js` | Embedded in Yield Statement | Color palettes, bank name/logo |
| **S9** | **Print Engine** | `yield-dashboard.js` | Embedded in Yield Statement | Print DOM generation, section selection |
| **S10** | **Hierarchy Editor** | `yield-dashboard.js` | Embedded in Yield Statement | Add/delete/edit tree nodes, mapping assignment |

### 12.2 Proposed Extraction Order

```
Phase 1: Hierarchy Engine (S1)           ← LOWEST RISK, HIGHEST VALUE
  → Extract data + tree-walking functions to shared/hierarchy.js
  → Both modules import from single source
  → Yield Statement falls back to embedded data if shared module absent

Phase 2: Settings/Mapping Engine (S4)    ← MEDIUM RISK, HIGH VALUE
  → Extract quick GL mapping and budget line mapping persistence
  → Normalize into shared data format
  → Both modules use same mapping tables

Phase 3: Data Engine (S2)                ← MEDIUM RISK, MEDIUM VALUE
  → Extract parseCsv(), normalize(), buildDataIndexes()
  → Shared data ingestion pipeline
  → Standardize row format across modules

Phase 4: Calculation Engine (S3)         ← HIGH RISK, VERY HIGH VALUE
  → Extract lineMeasure() and periodLineMeasure()
  → This is the "brain" of the Yield Statement
  → MUST NOT change behavior — extract verbatim

Phase 5: UI Component Library (S6)       ← LOW RISK, MEDIUM VALUE
  → Extract shared CSS variables
  → Extract card, panel, table, picker styles
  → Create UI component patterns

Phase 6: Print Engine (S9)               ← LOW RISK, LOW VALUE
  → Extract print DOM generation
  → Generalize for multi-module use

Phase 7: Persistence Layer (S5)          ← LOW RISK, LOW VALUE
  → Extract IndexedDB helpers
  → Extract localStorage schema management

Phase 8: Branding/Theming (S8)           ← LOW RISK, LOW VALUE
  → Extract palette definitions
  → Extract brand state management

Phase 9: Rendering Engine (S7)           ← HIGH RISK, LOW VALUE
  → Extract table/chart generation
  → Requires major generalization work

Phase 10: Hierarchy Editor (S10)         ← HIGH RISK, LOW VALUE
  → Extract tree editor UI
  → Higher priority for Yield Statement maintenance
```

---

## 13. Technical Debt Inventory

### 13.1 Critical Debt

| # | Item | Severity | Location | Impact |
|---|---|---|---|---|
| TD-01 | **`shared/hierarchy.js` is empty** | CRITICAL | `powerpages/shared/hierarchy.js` | Both modules duplicate hierarchy logic; future modules will duplicate again |
| TD-02 | **`yield-dashboard.js` is 11,660 lines** | CRITICAL | `yield-statement/yield-dashboard.js` | Single file contains everything; impossible to maintain, test, or onboard new engineers |
| TD-03 | **No separation of concerns** | CRITICAL | `yield-dashboard.js` | Data, metadata, calculation, rendering, and persistence all interleaved in one file |
| TD-04 | **No tests exist** | CRITICAL | Entire repository | Zero test coverage; any change risks breaking existing calculations |
| TD-05 | **Hardcoded `momLines[]` duplicates `rollupChildren{}`** | CRITICAL | `yield-dashboard.js:2529-2673` vs `yield-dashboard.js:3573-3607` | Two sources of truth for statement hierarchy; must be maintained in sync |

### 13.2 High Debt

| # | Item | Severity | Location | Impact |
|---|---|---|---|---|
| TD-06 | **Hardcoded GL account codes in momLines[]** | HIGH | `yield-dashboard.js:2529-2673` | 145 line definitions with ~500 individual GL codes; changes require code edits |
| TD-07 | **Hardcoded organization tree** | HIGH | `yield-dashboard.js:23` | Tree structure embedded as JS constant; not loadable at runtime |
| TD-08 | **Hardcoded account hierarchy tree** | HIGH | `yield-dashboard.js:24` | Same as above — should be loaded from shared workbook |
| TD-09 | **Hardcoded `rollupChildren{}`** | HIGH | `yield-dashboard.js:3573-3607` | Parent→child relationships hardcoded; duplicates statement hierarchy info |
| TD-10 | **Duplicate CSS across modules** | HIGH | `yield-dashboard.css` vs `liquidity-dashboard.html` | --ink, --muted, --paper, --burgundy etc. defined twice |
| TD-11 | **No data schema definition** | HIGH | N/A | No formal specification of what a GL row, org node, or statement line looks like |
| TD-12 | **Version key management ad-hoc** | HIGH | `yield-dashboard.js` | Multiple version keys scattered (v2, v3, v5, v21); no central migration system |

### 13.3 Medium Debt

| # | Item | Severity | Location | Impact |
|---|---|---|---|---|
| TD-13 | **Duplicate utility functions** | MEDIUM | Both modules | `money()`, `fmtMoney()`, `esc()`, `clean()` duplicated |
| TD-14 | **No module boundary contracts** | MEDIUM | N/A | No defined API between future shared services and modules |
| TD-15 | **Magic strings for version keys** | MEDIUM | `yield-dashboard.js` | `processedCacheVersion = 21`, `budgetCacheVersion = 21` etc. |
| TD-16 | **Embedded sample data in production code** | MEDIUM | `index.html:598` | 250KB+ embedded CSV; should be external |
| TD-17 | **Legacy compatibility keys** | MEDIUM | `yield-dashboard.js` | `yieldDashboardHierarchyEditsV1`, `yieldDashboardHierarchyEditsV2` — migration path unclear |
| TD-18 | **Global variable namespace pollution** | MEDIUM | `yield-dashboard.js` | Hundreds of variables in global scope; no module pattern |
| TD-19 | **Inline script in liquidity dashboard** | MEDIUM | `liquidity-dashboard.html` | All JS inline; cannot be cached, linted, or tested separately |

### 13.4 Low Debt

| # | Item | Severity | Location | Impact |
|---|---|---|---|---|
| TD-20 | **`shared/readme.md` is empty** | LOW | `powerpages/shared/readme.md` | Missing documentation for the shared directory |
| TD-21 | **Case inconsistency in data keys** | LOW | `yield-dashboard.js` | Some use PascalCase (OrganizationKey), some use camelCase |
| TD-22 | **Commented-out code** | LOW | `.gitignore` | Huge standard .gitignore with irrelevant entries |
| TD-23 | **No linter or formatter config** | LOW | Root | No `.eslintrc`, `.prettierrc`, or similar |

---

## 14. Refactoring Opportunities Ranked by Risk

### Risk Assessment Criteria

- **Business Risk:** Could refactoring change reported numbers?
- **Scope Risk:** How many modules/files are affected?
- **Complexity Risk:** How intertwined is the code being refactored?
- **Value:** How much does this reduce future maintenance cost?

| Rank | Opportunity | Biz Risk | Scope | Complexity | Value | Total Score |
|---|---|---|---|---|---|---|
| **1** | **Populate `shared/hierarchy.js`** with tree data + functions | VERY LOW | LOW | LOW | VERY HIGH | ★★★★★ |
| **2** | **Extract utility functions** (`clean`, `money`, `pct`, `normalizedDate`) to `shared/utils.js` | VERY LOW | LOW | LOW | HIGH | ★★★★☆ |
| **3** | **Extract shared CSS variables** to `shared/theme.css` | VERY LOW | LOW | LOW | MEDIUM | ★★★☆☆ |
| **4** | **Extract `momLines[]` + `rollupChildren{}`** to a single JSON data file | MEDIUM | LOW | MEDIUM | HIGH | ★★★☆☆ |
| **5** | **Extract GL mapping persistence** to shared module | MEDIUM | MEDIUM | MEDIUM | HIGH | ★★★☆☆ |
| **6** | **Extract `parseCsv()` + `normalize()`** to `shared/data-engine.js` | MEDIUM | MEDIUM | MEDIUM | HIGH | ★★★☆☆ |
| **7** | **Split `yield-dashboard.js`** into sub-files by concern | HIGH | HIGH | VERY HIGH | VERY HIGH | ★★★☆☆ |
| **8** | **Extract `lineMeasure()` + `periodLineMeasure()`** to shared calc engine | VERY HIGH | HIGH | VERY HIGH | VERY HIGH | ★★☆☆☆ |
| **9** | **Extract rendering functions** to separate UI layer | HIGH | VERY HIGH | HIGH | MEDIUM | ★★☆☆☆ |
| **10** | **Add TypeScript/ESLint/Prettier** | LOW | HIGH | MEDIUM | MEDIUM | ★★☆☆☆ |

### Detailed Refactoring Plans

---

**RANK 1: Populate `shared/hierarchy.js`**

*Risk: VERY LOW — Read-only extraction; fallback pattern preserves existing behavior*

**What to extract:**
- `organizationNodes[]`, `accountNodes[]`, `statementNodes[]` (data arrays)
- `orgChildrenMap()`, `descendantOrgMaps()`, `orgOptionRows()` (tree walking)
- `accountPickerChildMap()`, `accountRollupTreeRows()` (account tree)
- `hierarchySnapshotFromCurrent()`, `applyHierarchySnapshot()` (snapshots)
- `ensureRequiredOrganizationNodes()`, `normalizeKnownHierarchyMappings()` (validation)

**Fallback pattern:**
```javascript
// In yield-dashboard.js, replace:
const organizationNodes = [...];
// With:
const organizationNodes = window.SharedHierarchy?.organizationNodes || [...hardcoded...];
```

**Verification:** Compare `lineMeasure()` output for all lines across all dates before and after. Must match exactly.

**Estimated effort:** 4-6 hours

---

**RANK 2: Extract Utility Functions**

*Risk: VERY LOW — Pure functions with no side effects*

**What to extract:**
- `clean()`, `num()`, `esc()` / `printEscape()`
- `money()`, `pct()`, `moneyHtml()`, `pctHtml()`, `rateHtml()`
- `normalizedDate()`, `normalizedBranchId()`, `normalizedAccountCode()`
- `displayDate()`, `dateOption()`
- `categoryKey()`, `statementLabelKey()`
- `uniqueCodes()`, `isNegative()`, `negativeClass()`

**Verification:** Unit-testable in isolation. Compare all callsites that return formatted values.

**Estimated effort:** 2-3 hours

---

**RANK 3: Extract Shared CSS Variables**

*Risk: VERY LOW — CSS-only extraction*

**What to extract:**
```css
:root {
  --ink: #10233f;
  --muted: #607089;
  --paper: #f4f7fb;
  --panel: #ffffff;
  --line: #d8e2f0;
  --burgundy: #00408A;
  --burgundy-2: #0059B8;
  --gold: #C00000;
  --navy: #00408A;
  --blue: #00408A;
  --teal: #2B6CA3;
  --sage: #6F86A6;
  --rose: #C00000;
  --accent-rgb: 0, 64, 138;
  --danger-rgb: 192, 0, 0;
  --shadow: 0 18px 45px rgba(var(--accent-rgb), .12);
  --shadow-soft: 0 10px 24px rgba(var(--accent-rgb), .10);
  --radius: 20px;
}
```

**Verification:** Visual comparison of both dashboards before and after.

**Estimated effort:** 1 hour

---

**RANK 4: Extract `momLines[]` + `rollupChildren{}` to JSON**

*Risk: MEDIUM — Data format change, but structure preserved*

**What to extract:**
- `momLines[]` (~145 entries, currently in JS) → `statement-lines.json`
- `rollupChildren{}` (~50 entries, JS object) → part of same JSON or separate
- `embeddedFrozenStatementDefaults[]` → part of JSON metadata

**Verification:** Load the JSON at startup instead of using embedded JS constants. All `lineMeasure()` outputs must match exactly.

**Estimated effort:** 4-6 hours

---

**RANK 5: Extract GL Mapping Persistence**

*Risk: MEDIUM — localStorage schema preserved*

**What to extract:**
- `quickGlMappings` state and CRUD operations
- `budgetLineMappings` state and CRUD operations
- `normalizedQuickMappings()`, `quickMappingLookup()`, `saveQuickGlMappings()`
- `normalizedBudgetLineMappings()`, `budgetMappingLookup()`, `saveBudgetLineMappings()`
- Version key management (`budgetLineMappingSchemaVersion`)

**Verification:** Verify that all mapping lookups return the same results. Verify localStorage keys remain identical.

**Estimated effort:** 6-8 hours

---

**RANK 6: Extract Data Engine (parseCsv + normalize + buildDataIndexes)**

*Risk: MEDIUM — Core ingestion pipeline; must not change data structure*

**What to extract:**
- `parseCsv()` — custom CSV parser
- `normalize()` — row normalization with field mapping
- `buildDataIndexes()` — creates valueIndex, branchValueIndex, etc.
- `categoryFor()` — GL range → category classification
- IndexedDB store names and versions

**Verification:** Feed the same CSV through old and new pipelines. Compare `valueIndex` size, `datesCache` length, key distribution.

**Estimated effort:** 8-12 hours

---

**RANK 7: Split `yield-dashboard.js` into Sub-files**

*Risk: HIGH — Monolith split; dependency order critical*

**Recommended split:**
```
yield-statement/
├── index.html
├── yield-dashboard.css
├── js/
│   ├── 00-bootstrap.js      (error handling, utility shortcuts)
│   ├── 01-constants.js      (data arrays, momLines, rollupChildren)
│   ├── 02-state.js          (Set/Map initializations)
│   ├── 03-hierarchy.js      (tree walking, option rows)
│   ├── 04-mappings.js       (quick GL, budget line mappings)
│   ├── 05-data-engine.js    (parseCsv, normalize, buildDataIndexes)
│   ├── 06-calc-engine.js    (lineMeasure, periodLineMeasure)
│   ├── 07-render-overview.js
│   ├── 08-render-statement.js
│   ├── 09-render-detail.js
│   ├── 10-render-budget.js
│   ├── 11-render-settings.js
│   ├── 12-render-hierarchy-editor.js
│   ├── 13-persistence.js    (localStorage, IndexedDB)
│   ├── 14-charts.js         (SVG charts)
│   ├── 15-print.js          (print report builder)
│   ├── 16-events.js         (event bindings)
│   └── 17-init.js           (startup orchestration)
```

**Verification:** All existing reports must produce identical output. Full regression test of all tabs, all filter combinations, all date ranges, both balance views.

**Estimated effort:** 24-40 hours

---

**RANK 8: Extract Calculation Engine to Shared Module**

*Risk: VERY HIGH — Changes to lineMeasure() affect every number on every report*

**What to extract (verbatim):**
- `lineMeasure(line, date)` — single month calculation (~110 lines)
- `periodLineMeasure(line, dates)` — period calculation (~105 lines)
- All supporting functions: `lineBalanceCodes()`, `lineIncomeCodes()`, `dateValues()`, `rollupDateValues()`, `childCategoriesFor()`, `displayMeasureForLabel()`, `weightedChildRate()`, `periodWeightedChildRate()`, `safeEvalStatementFormula()`, `customLineFormulaResult()`, `customPeriodFormulaResult()`, `annualizationFactor()`, `daysInIsoMonth()`, `periodAnnualizationFactor()`, `periodIncomeAnnualizationFactor()`
- All special calc functions: `nimNetInterestIncome()`, `directNetIncome()`, `taxExemptIncome()`, `directAverageBalance()`, `adjustedAverageAssets()`, `periodNimNetInterestIncome()`, `periodTaxExemptIncome()`, `directPeriodAverageBalance()`, `adjustedPeriodAverageAssets()`, `directPeriodNetIncome()`

**Verification:** Exhaustive. Compare `lineMeasure()` output for all 145 lines × all dates × all branch selections × both balance views. Any deviation is a bug. Must match to the cent.

**Estimated effort:** 16-24 hours for extraction + 40+ hours for verification

---

**RANK 9: Extract Rendering Functions to Separate UI Layer**

*Risk: HIGH — Tightly coupled to data structures*

This is the lowest-priority high-value extraction because rendering functions are module-specific (Yield Statement tables look different from Liquidity tables). Only shared UI patterns (pickers, tabs, expand/collapse) make sense to extract.

**Estimated effort:** 20-40 hours

---

**RANK 10: Add Tooling (TypeScript, ESLint, Prettier)**

*Risk: LOW — Tooling only, but touches every file*

- Add `.eslintrc.json` with browser environment
- Add `.prettierrc` with consistent formatting
- Add lint-staged for pre-commit hooks
- Consider JSDoc type annotations as stepping stone to TypeScript

**Estimated effort:** 4-8 hours

---

## 15. Appendix: Complete Function Index

### 15.1 Yield Statement Dashboard — All Functions

| Function | Lines (approx) | Category | Purpose |
|---|---|---|---|
| `showStartupError()` | 2-14 | Bootstrap | Error banner display |
| `storedStringArray()` | 196-203 | Utility | Safe localStorage array read |
| `clean()` | 924 | Utility | Trim string |
| `num()` | 925-930 | Utility | Parse number from string |
| `money()` | 911-918 | Utility | Format currency |
| `pct()` | 919 | Utility | Format percentage |
| `isNegative()` | 920 | Utility | Check negative |
| `negativeClass()` | 921 | Utility | CSS class for negative |
| `moneyHtml()` | 922 | Utility | HTML-wrapped currency |
| `pctHtml()` | 923 | Utility | HTML-wrapped percentage |
| `normalizedDate()` | 937-960 | Utility | Date string → ISO |
| `normalizedBranchId()` | 961-966 | Utility | Branch string → ID |
| `normalizedAccountCode()` | 974-976 | Utility | Account code normalizer |
| `displayDate()` | 977-981 | Utility | ISO → display date |
| `dateOption()` | 982-984 | Utility | Date → select option |
| `uniqueCodes()` | 2685-2692 | Utility | Deduplicate code array |
| `printEscape()` | [inline] | Utility | HTML-escape string |
| `toBool()` | [inline] | Utility | Truthy to boolean |
| `parseCsv()` | 986-1004 | Data | CSV text → row objects |
| `normalize()` | 1006-1023 | Data | Raw rows → normalized |
| `buildDataIndexes()` | 1025-1055 | Data | Build valueIndex, branchValueIndex |
| `categoryFor()` | 1057-1068 | Data | GL range → category |
| `latestDate()` | 1070-1072 | Data | Most recent date |
| `quickMappingTypeLabel()` | 1073-1082 | Mapping | Type → display name |
| `normalizeQuickMapping()` | 1083-1090 | Mapping | Validate/canonicalize mapping |
| `normalizedQuickMappings()` | 1091-1099 | Mapping | Deduplicate quick mappings |
| `quickMappingLookup()` | 1100-1109 | Mapping | Build mapping lookup map |
| `saveQuickGlMappings()` | 1110-1119 | Mapping | Persist to localStorage |
| `quickMappingForAccount()` | 1124-1127 | Mapping | Find mapping for account |
| `quickMappingAppliesToBalance()` | 1193-1198 | Mapping | Balance vs income check |
| `quickMappingAppliesToIncome()` | 1199-1204 | Mapping | Income vs balance check |
| `accountHierarchyMappingForNode()` | 1205-1214 | Mapping | Node → mapping |
| `quickMappedCodesForLabel()` | 1226-1237 | Mapping | Label → GL codes |
| `quickMappedCodesForLine()` | 1238-1240 | Mapping | Line → GL codes |
| `quickMappedCodesAny()` | 1247-1249 | Mapping | Line → all codes |
| `configuredGlCodes()` | 1250-1264 | Mapping | All known GL codes |
| `latestAccountActivity()` | 1265-1273 | Mapping | Account → balance/income |
| `organizationMapSet()` | 1274-1276 | Mapping | All org branch maps |
| `mappingReviewSnapshot()` | 1290-1364 | Mapping | Unmapped accounts/orgs |
| `mappingReviewRows()` | 1368-1370 | Mapping | Account review rows |
| `organizationMappingReviewRows()` | 1365-1367 | Mapping | Org review rows |
| `budgetMappingCandidateRows()` | 1371-1441 | Mapping | Budget mapping candidates |
| `setBudgetMappingsForKeys()` | 1449-1485 | Mapping | Save budget mappings |
| `renderBudgetMappingReview()` | 1501-1538 | Render | Budget mapping UI |
| `renderQuickMappingReview()` | 4058-4093 | Render | Quick mapping UI |
| `renderMappingTestReceipt()` | 4024-4034 | Render | Mapping status display |
| `renderOrganizationMappingReview()` | 4035-4057 | Render | Org mapping status |
| `quickMappingRollupOptions()` | 3986-3998 | Render | Rollup select options |
| `renderQuickMappingRollups()` | 3999-4005 | Render | Populate rollup select |
| `renderBudgetMappingRollups()` | 4006-4012 | Render | Populate budget rollup select |
| `orgChildrenMap()` | 1552-1563 | Hierarchy | Build org child index |
| `descendantOrgMaps()` | 1564-1576 | Hierarchy | Subtree → branch codes |
| `freshDescendantOrgMaps()` | 1577-1585 | Hierarchy | Non-cached version |
| `selectedBranchMaps()` | 1586-1595 | Hierarchy | Current branch selection |
| `isBranchFiltered()` | 1596-1599 | Hierarchy | Check filter active |
| `branchMatches()` | 1600-1602 | Hierarchy | Row → branch match |
| `orgOptionRows()` | 1620-1652 | Hierarchy | Organization picker rows |
| `unmappedOrgOptionRows()` | 1653-1672 | Hierarchy | Unmapped branch rows |
| `selectedOrgPickerLabel()` | 1673-1679 | Hierarchy | Current org label |
| `syncOrgPickerLabel()` | 1680-1684 | Hierarchy | Update picker button |
| `orgPickerVisibleRows()` | 1689-1712 | Hierarchy | Filtered picker rows |
| `renderOrgPicker()` | 1713-1740 | Hierarchy | Render org picker UI |
| `setOrgPickerOpen()` | 1741-1751 | Hierarchy | Toggle picker |
| `selectOrgPickerValue()` | 1752-1759 | Hierarchy | Pick org value |
| `accountPickerChildMap()` | 1760-1773 | Hierarchy | Statement child index |
| `accountRollupTreeRows()` | 1774-1804 | Hierarchy | Account picker rows |
| `selectedAccountPickerLabel()` | 1805-1810 | Hierarchy | Current account label |
| `syncAccountPickerLabel()` | 1811-1815 | Hierarchy | Update account picker |
| `accountPickerVisibleRows()` | 1820-1843 | Hierarchy | Filtered account rows |
| `renderAccountPicker()` | 1844-1867 | Hierarchy | Render account picker |
| `setAccountPickerOpen()` | 1868-1878 | Hierarchy | Toggle account picker |
| `selectAccountPickerValue()` | 1879-1886 | Hierarchy | Pick account value |
| `accountCodeForNode()` | 2693-2698 | Hierarchy | Node → GL code |
| `accountNodeForMap()` | 2699-2701 | Hierarchy | GL code → node |
| `lowestMappedDescendantCodes()` | 2702-2720 | Hierarchy | Expand subtotal codes |
| `statementInputCodes()` | 2721-2726 | Hierarchy | Expand input codes |
| `categoryKey()` | 3538-3551 | Hierarchy | Normalize category key |
| `isAccountLeafLabel()` | 3552-3554 | Hierarchy | Check leaf label |
| `statementLabelKey()` | 3646-3648 | Hierarchy | Label → canonical key |
| `statementLineLabels()` | 3659-3670 | Hierarchy | All statement labels |
| `buildDefaultStatementNodes()` | 3671-3692 | Hierarchy | Build default statement |
| `normalizeStatementNode()` | 3693-3705 | Hierarchy | Canonicalize statement node |
| `initializeStatementNodes()` | 3706-3752 | Hierarchy | Merge + validate statement nodes |
| `lineByLabel()` | 3790-3793 | Hierarchy | Label → line definition |
| `statementNodeForLabel()` | 3794-3797 | Hierarchy | Label → statement node |
| `statementRenderableLines()` | 3798-3820 | Hierarchy | Filtered visible lines |
| `childCategoriesFor()` | 3821-3830 | Hierarchy | Parent → child labels |
| `accountRollupDrillRootForLabel()` | 3831-3837 | Hierarchy | Drill root finder |
| `accountRollupDrillChildrenFor()` | 3838-3854 | Hierarchy | Drill children |
| `drillChildCategoriesFor()` | 3855-3863 | Hierarchy | Combined drill children |
| `accountRollupDisplayLabel()` | 3864-3877 | Hierarchy | Label → display name |
| `accountRollupOptions()` | 3878-3896 | Hierarchy | Account picker options |
| `selectedRollupAccountCodes()` | 3897-3897 | Hierarchy | Current rollup codes |
| `isFrozenStatementLabel()` | 3902-3905 | Hierarchy | Check frozen |
| `isProtectedStatementLabel()` | 3906-3908 | Hierarchy | Check protected |
| `isStatementSubtotalStyledLabel()` | 3909-3912 | Hierarchy | Check subtotal style |
| `baseStatementChildLabels()` | 3913-3917 | Hierarchy | Children set |
| `isBaseVisibleMomLine()` | 3918-3925 | Hierarchy | MoM visibility |
| `isBaseVisibleDetailLine()` | 3926-3932 | Hierarchy | Detail visibility |
| `statementRowClass()` | 3936-3940 | Hierarchy | Row CSS class |
| `visibleMomIndent()` | 3941-3955 | Hierarchy | Indent depth |
| `drillAccountsForLine()` | 4889-4916 | Hierarchy | Line → drill accounts |
| `accountsForCategory()` | 4917-4945 | Hierarchy | Category → accounts |
| `incomeDimensionLabel()` | 4946-4980 | Hierarchy | Label → income dimension |
| `balanceDimensionLabel()` | 4981-4989 | Hierarchy | Label → balance dimension |
| `balanceCodeExclusions()` | 4990-4994 | Hierarchy | Exclude codes |
| `lineBalanceCodes()` | 4995-5005 | Hierarchy | Line → balance codes |
| `supplementalBalanceCodes()` | 5006-5036 | Hierarchy | Additional codes |
| `lineIncomeCodes()` | 5037-5046+ | Hierarchy | Line → income codes |
| `ensureRequiredOrganizationNodes()` | 544-618 | Hierarchy | Validate org tree |
| `clearOrganizationRollupMaps()` | 619-628 | Hierarchy | Clear parent maps |
| `saveHierarchySnapshotLocally()` | 629-638 | Hierarchy | Persist snapshot |
| `saveHierarchyEdits()` | 634-638 | Hierarchy | Save hierarchy edits |
| `hierarchyFrozenCount()` | 639-642 | Hierarchy | Count frozen nodes |
| `hierarchySnapshotSavedAtMs()` | 643-647 | Hierarchy | Snapshot timestamp |
| `localHierarchySnapshotInfo()` | 648-673 | Hierarchy | Get local snapshot |
| `localHierarchySavedAtMs()` | 674-676 | Hierarchy | Get saved timestamp |
| `applySavedHierarchyEdits()` | 677-688 | Hierarchy | Apply saved edits |
| `removeRedundantDefaultHierarchyNodes()` | 689-702 | Hierarchy | Cleanup |
| `hierarchySnapshotIsValid()` | 339-342 | Hierarchy | Validate snapshot |
| `hierarchySnapshotFromCurrent()` | 343-359 | Hierarchy | Build snapshot |
| `applyHierarchySnapshot()` | 360-388 | Hierarchy | Apply snapshot |
| `normalizeKnownHierarchyMappings()` | 389-543 | Hierarchy | Audit fix mappings |
| `hierarchyConfig()` | 4184-4189 | Hierarchy | Editor config |
| `hierarchyNodeKey()` | 4190-4192 | Hierarchy | Node → key |
| `hierarchyParentKey()` | 4193-4195 | Hierarchy | Node → parent |
| `hierarchyNodeName()` | 4196-4198 | Hierarchy | Node → name |
| `hierarchyNodeDisplayName()` | 4199-4202 | Hierarchy | Node → display |
| `hierarchyMapValue()` | 4203-4205 | Hierarchy | Node → map |
| `hierarchyTreeMaps()` | 4206-4218 | Hierarchy | Tree index builder |
| `statementRollupMatchKey()` | 4219-4229 | Hierarchy | Alias resolver |
| `statementMappedAccountsForLabel()` | 4230-4248 | Hierarchy | Mapped GL accounts |
| `budgetMappedRowsForLabel()` | 4249-4290 | Hierarchy | Mapped budget rows |
| `budgetVirtualNodeForKey()` | 4291-4315 | Hierarchy | Virtual budget node |
| `hierarchyDescendantKeys()` | 4316-4327 | Hierarchy | Descendant key list |
| `hierarchySearchMatches()` | 4328-4335 | Hierarchy | Search filter |
| `hierarchyVisibleRows()` | 4336-4360 | Hierarchy | Visible editor rows |
| `renderHierarchyTree()` | 4361-4393 | Render | Hierarchy tree UI |
| `hierarchyParentOptions()` | 4394-4406 | Render | Parent select |
| `accountNodeMappedAccount()` | 4407-4411 | Hierarchy | Account → code |
| `hierarchyMappingTypeOptions()` | 4412-4421 | Render | Type select |
| `hierarchyAnnualizationOptions()` | 4422-4432 | Render | Ann. select |
| `customCalculationForLabel()` | 4433-4436 | Calc | Find custom calc |
| `saveStatementCalculationFields()` | 4437-4460 | Calc | Save formulas |
| `renderHierarchyStatementMappingFields()` | 4461-4505 | Render | Mapping fields |
| `saveHierarchyNodeStatementMapping()` | 4506-4530 | Hierarchy | Save node mapping |
| `renderBudgetLeafDetail()` | 4531-4562 | Render | Budget leaf detail |
| `saveBudgetLeafEdit()` | 4563-4591 | Hierarchy | Save budget edit |
| `renderHierarchyDetail()` | 4592-4646 | Render | Hierarchy detail |
| `shortHierarchyButtonName()` | 4647-4650 | Utility | Truncate name |
| `renderHierarchyEditor()` | 4651-4677 | Render | Full editor |
| `refreshAfterHierarchyEditorChange()` | 4678-4689 | Render | Post-edit refresh |
| `saveHierarchyEdit()` | 4690-4714 | Hierarchy | Persist edit |
| `deleteHierarchyNode()` | 4715-4762 | Hierarchy | Delete node |
| `mappedAccountParentKey()` | 4763-4777 | Hierarchy | Mapping parent |
| `syncMappedAccountsToAccountHierarchy()` | 4778-4806 | Hierarchy | Sync mappings |
| `applySingleStatementRollupForAccount()` | 4807-4818 | Hierarchy | Apply rollup |
| `enforceSingleStatementRollupAssignments()` | 4819-4842 | Hierarchy | Enforce consistency |
| `nextHierarchyKey()` | 4843-4845 | Hierarchy | Next key |
| `addHierarchyChild()` | 4846-4876 | Hierarchy | Add node |
| `setHierarchyExpandedState()` | 4877-4888 | Hierarchy | Expand/collapse |
| `currentData()` | 1887-1896 | Data | Filtered rows |
| `trendData()` | 1898-1907 | Data | Trend rows |
| `populateFilters()` | 1909-1925 | Data | Populate selects |
| `captureFilterSelection()` | 1927-1937 | Data | Snapshot filters |
| `selectOptionIfPresent()` | 1939-1946 | Data | Set select |
| `restoreBranchSelection()` | 1948-1963 | Data | Restore branch |
| `restoreFilterSelection()` | 1965-1974 | Data | Restore filters |
| `renderMetrics()` | 1976-2179 | Render | KPI cards |
| `svgLine()` | 2182-2231 | Render | Trend line chart |
| `svgDonut()` | 2233-2258 | Render | Funding donut |
| `svgBars()` | 2260-2263 | Render | Bar chart |
| `svgLoanMix()` | 2264-2292 | Render | Loan donut |
| `topAccountCategoryItems()` | 2293-2341 | Render | Account detail |
| `parseLocalDate()` | 2344-2347 | Utility | ISO → Date |
| `isoDate()` | 2348-2350 | Utility | Date → ISO |
| `monthEnd()` | 2351-2353 | Utility | Month end date |
| `addMonths()` | 2354-2356 | Utility | Add months |
| `periodFilteredRows()` | 2357-2360 | Data | Period rows |
| `endingAt()` | 2361-2364 | Calc | Ending value |
| `flowSum()` | 2365-2372 | Calc | Period flow sum |
| `periodMetrics()` | 2373-2409 | Calc | Period KPIs |
| `periodComparisonRows()` | 2410-2417 | Calc | Prior comparison |
| `periodComparisonStatementLabel()` | 2418-2429 | Calc | Label aliases |
| `periodComparisonValue()` | 2430-2434 | Calc | Measure → value |
| `periodComparisonRowHtml()` | 2435-2444 | Render | Comparison row |
| `periodComparisonMeasureGetter()` | 2445-2453 | Calc | Measure getter |
| `periodComparisonDrillRow()` | 2454-2463 | Calc | Drill row |
| `periodComparisonAccountRows()` | 2464-2483 | Render | Account drill |
| `renderPeriodComparisonDrill()` | 2484-2500 | Render | Drill recursion |
| `renderPeriodTable()` | 2501-2521 | Render | Period table |
| `svgComparisonBars()` | 2522-2528 | Render | Comparison chart |
| `dateValues()` | 2727-2736 | Calc | Index lookup |
| `directAllocationRowsForBranches()` | 2760-2766 | Calc | Scan allocations |
| `directAllocationRowsValue()` | 2767-2786 | Calc | Allocation value |
| `allocationRowsAudit()` | 2787-2805 | Calc | Allocation audit |
| `rawAllocationRowsAudit()` | 2806-2824 | Calc | Raw allocation audit |
| `currentDataLoadAudit()` | 2825-2853 | Calc | Load audit |
| `currentDataLoadAuditText()` | 2854-2861 | Render | Audit text |
| `latestLoadedDateAllocationAudit()` | 2862-2874 | Calc | Latest audit |
| `allocationSourceWarningText()` | 2875-2881 | Render | Warning |
| `rollupDateValues()` | 2882-2891 | Calc | Rollup lookup |
| `accountValue()` | 2892-2900 | Calc | Account value |
| `priorDate()` | 2901-2905 | Calc | Prior date |
| `populateOverviewCompareDate()` | 2906-2920 | Data | Overview compare |
| `populateMomCompareDate()` | 2921-2936 | Data | MoM compare |
| `populateAttributionMomCompareDate()` | 2937-2951 | Data | Attribution compare |
| `populateReviewCompareDate()` | 2952-2966 | Data | Review compare |
| `daysInIsoMonth()` | 2967-2970 | Calc | Days in month |
| `annualizationFactor()` | 2971-2976 | Calc | Rate factor |
| `normalizeAnnualization()` | 2977-3009 | Calc | Convention normalizer |
| `statementAnnualizationForLabel()` | 3010-3013 | Calc | Annualization |
| `lineDayCount()` | 3014-3018 | Calc | Day count |
| `customCalculationMeasure()` | 3019-3025 | Calc | Measure parser |
| `normalizeCustomStatementCalculation()` | 3026-3037 | Calc | Calc normalizer |
| `normalizedCustomStatementCalculations()` | 3038-3052 | Calc | Deduplicate |
| `customStatementCalculation()` | 3053-3056 | Calc | Lookup |
| `selectedFormulaText()` | 3057-3060 | Calc | Formula text |
| `safeEvalStatementFormula()` | 3061-3081 | Calc | Formula evaluator |
| `lineFormulaValue()` | 3082-3093 | Calc | Formula value |
| `periodLineFormulaValue()` | 3094-3105 | Calc | Period formula |
| `customLineFormulaResult()` | 3106-3112 | Calc | Custom calc |
| `customPeriodFormulaResult()` | 3113-3119 | Calc | Period custom calc |
| `quarterKey()` | 3120-3123 | Utility | Date → quarter |
| `quarterLabel()` | 3124-3127 | Utility | Quarter → label |
| `previousQuarterKey()` | 3128-3133 | Utility | Prior quarter |
| `quarterSortValue()` | 3134-3137 | Utility | Quarter sort |
| `quarterDates()` | 3138-3140 | Utility | Quarter dates |
| `populateQoqCompareQuarter()` | 3141-3155 | Data | QoQ compare |
| `populateAttributionQoqCompareQuarter()` | 3156-3170 | Data | Attrib compare |
| `periodDays()` | 3171-3176 | Calc | Period days |
| `periodAnnualizationFactor()` | 3177-3182 | Calc | Period factor |
| `periodIncomeAnnualizationFactor()` | 3183-3185 | Calc | Income factor |
| `periodDateValues()` | 3186-3188 | Calc | Period sum |
| `periodRollupDateValues()` | 3189-3199 | Calc | Period rollup sum |
| `periodAverageValues()` | 3200-3207 | Calc | Period avg |
| `selectedStatementBalanceView()` | 3208-3210 | Utility | Current view |
| `selectedStatementBalanceLabel()` | 3211-3213 | Utility | View label |
| `selectedStatementEntityLabel()` | 3214-3218 | Utility | Entity label |
| `displayBalanceValue()` | 3219-3221 | Utility | Balance display |
| `directNetInterestIncome()` | 3222-3224 | Calc | Direct NII |
| `directPeriodNetInterestIncome()` | 3225-3227 | Calc | Period NII |
| `nimNetInterestIncome()` | 3228-3231 | Calc | NIM NII |
| `periodNimNetInterestIncome()` | 3232-3235 | Calc | Period NIM NII |
| `directNetIncome()` | 3236-3242 | Calc | Direct NI |
| `directPeriodNetIncome()` | 3243-3249 | Calc | Period NI |
| `taxExemptIncome()` | 3250-3252 | Calc | Tax exempt |
| `periodTaxExemptIncome()` | 3253-3255 | Calc | Period tax exempt |
| `directAverageBalance()` | 3256-3262 | Calc | Direct avg |
| `directPeriodAverageBalance()` | 3263-3269 | Calc | Period avg |
| `adjustedAverageAssets()` | 3270-3278 | Calc | Adjusted assets |
| `adjustedPeriodAverageAssets()` | 3279-3287 | Calc | Period adjusted |
| `weightedRateChildrenFor()` | 3288-3293 | Calc | Weight children |
| `weightedChildRate()` | 3294-3306 | Calc | Weighted rate |
| `lineMeasure()` | 3309-3421 | **CORE CALC** | Single month measure |
| `periodWeightedChildRate()` | 3422-3433 | Calc | Period weighted rate |
| `periodLineMeasure()` | 3434-3537 | **CORE CALC** | Multi-month measure |
| `saveMomDisplayPrefs()` | 3956-3958 | Persist | Save display |
| `saveMomDisplayDefault()` | 3959-3963 | Persist | Save default |
| `renderStatementDisplayGrid()` | 3964-3982 | Render | Display grid |
| `renderGlobalDisplayGrid()` | 3983-3985 | Render | Global grid |
| `selectedQuickMappingAccounts()` | 4013-4015 | Mapping | Selected |
| `mappingStatusCounts()` | 4016-4023 | Mapping | Counts |
| `saveSelectedQuickMappings()` | 4106-4122 | Mapping | Save mappings |
| `removeQuickMappings()` | 4123-4131 | Mapping | Remove mappings |
| `csvEscape()` | 4132-4135 | Utility | CSV escape |
| `exportQuickMappings()` | 4136-4153 | Render | Export CSV |
| `importQuickMappings()` | 4154-4183 | Mapping | Import CSV/XLSX |
| `budgetLineKey()` | Budget | Mapping | Name → key |
| `budgetStatementRollupExists()` | Budget | Mapping | Check rollup |
| `budgetFallbackRollupForMappedName()` | Budget | Mapping | Fallback rollup |
| `isBudgetSubtotalRowName()` | Budget | Mapping | Check subtotal |
| `budgetControlLabelForRowName()` | Budget | Mapping | Control label |
| `budgetNameTranslationsReady` | Budget | State | Translation flag |
| `normalizeBudgetLineMapping()` | 1132-1144 | Budget | Normalize mapping |
| `normalizeBudgetMappingView()` | 1145-1151 | Budget | View normalizer |
| `budgetMappingViewForRow()` | 1152-1154 | Budget | View type |
| `budgetMappingLookupKey()` | 1155-1157 | Budget | Lookup key |
| `normalizedBudgetLineMappings()` | 1158-1171 | Budget | Deduplicate |
| `budgetMappingLookup()` | 1172-1175 | Budget | Build lookup |
| `saveBudgetLineMappings()` | 1176-1186 | Budget | Persist |
| `budgetMappingForName()` | 1187-1192 | Budget | Name → mapping |
| `isBudgetStartupSubtotalName()` | 1127-1131 | Budget | Startup check |
| `budgetSourceRowsFromCandidates()` | Budget | Data | Source rows |
| `populateBudgetVersionFilter()` | Budget | Render | Version filter |
| `populatePeriodCompareFilter()` | Budget | Render | Period filter |
| `populateReviewBudgetVersion()` | Budget | Render | Review budget |
| `budgetIndexesForVersion()` | Budget | Calc | Budget indexes |
| `withStatementIndexes()` | Budget | Calc | Indexes wrapper |
| `periodAccountMeasure()` | Budget | Calc | Account measure |
| `displayMeasureForLabel()` | Calc | Calc | Measure display |
| `displayPeriodMeasureForLabel()` | Calc | Calc | Period display |
| `statementMeasureHasValue()` | Calc | Calc | Value check |
| `leafAccountsForLabel()` | Calc | Calc | Leaf accounts |
| `accountDimensionLeaves()` | Calc | Calc | Dimension leaves |
| `accountChildMap()` | Calc | Calc | Account children |
| `accountDescendants()` | Calc | Calc | Account descendants |
| `hasMappedChild()` | Calc | Calc | Child check |
| `accountNodeForLabel()` | Calc | Calc | Label → node |
| `statementLabelForKey()` | Calc | Calc | Key → label |
| `fmtStmtMoney()` | Utility | Utility | Statement money |
| `renderOverview()` | Render | Render | Overview tab |
| `renderComparisons()` | Render | Render | Comparison tab |
| `renderMomStatement()` | Render | Render | MoM statement |
| `renderQoqStatement()` | Render | Render | QoQ statement |
| `renderYtdStatement()` | Render | Render | YTD statement |
| `renderBudgetStatement()` | Render | Render | Budget tab |
| `renderDetailReport()` | Render | Render | Detail tab |
| `renderBalanceSheet13Report()` | Render | Render | 13M BS |
| `renderIncomeStatement13Report()` | Render | Render | 13M IS |
| `renderVarianceReport()` | Render | Render | Variance |
| `renderBudgetToActualReport()` | Render | Render | BtA |
| `renderAttributionReport()` | Render | Render | Attribution |
| `renderSettingsTab()` | Render | Render | Settings tab |
| `renderRepositoryFolder()` | Render | Render | Repo settings |
| `renderBudgetFolder()` | Render | Render | Budget settings |
| `renderSharedHierarchyWorkbookStatus()` | Render | Render | Workbook status |
| `renderLoadTestDiagnostics()` | Render | Render | Load test |
| `activateTab()` | Render | Render | Tab switch |
| `activeTabId()` | Render | Render | Current tab |
| `scheduleRender()` | Render | Render | Debounced render |
| `handleFilterChange()` | Render | Render | Filter handler |
| `loadInitialDashboardData()` | Data | Data | Startup load |
| `tryLoadProcessedCache()` | Data | Data | IndexedDB load |
| `tryLoadExternalData()` | Data | Data | External load |
| `loadEmbeddedFallbackData()` | Data | Data | Embedded load |
| `applyRows()` | Data | Data | Set active rows |
| `resetSampleData()` | Data | Data | Reset to embedded |
| `loadExternalRepositoryData()` | Data | Data | Folder load |
| `loadBudgetRepositoryData()` | Data | Data | Budget load |
| `applyBudgetRows()` | Data | Data | Set budget rows |
| `saveProcessedCache()` | Data | Data | Save to IDB |
| `saveBudgetCache()` | Data | Data | Save budget IDB |
| `restoreFullBudgetCache()` | Data | Data | Restore budget |
| `showBudgetLoadedPopup()` | Render | Render | Budget notice |
| `commitApprovedBudgetFromUi()` | Persist | Persist | Approve budget |
| `scheduleSharedHierarchyStartupLoad()` | Data | Data | Workbook load |
| `chooseRepositoryFolder()` | Data | Data | Folder picker |
| `chooseBudgetFolder()` | Data | Data | Budget picker |
| `chooseSettingsFolder()` | Data | Data | Settings picker |
| `saveSharedHierarchyFromUi()` | Persist | Persist | Save to workbook |
| `exportSelectedBranchExcel()` | Render | Render | Excel export |
| `buildPrintReport()` | Render | Render | Print build |
| `selectedPrintSections()` | Render | Render | Print sections |
| `ensureBudgetForPrintSections()` | Render | Render | Budget print |
| `applyBranding()` | Render | Render | Apply brand |
| `saveBrandSettings()` | Persist | Persist | Save brand |
| `brandPaletteKey()` | Utility | Utility | Palette key |
| `bankName()` | Utility | Utility | Bank name |
| `bankLogo()` | Utility | Utility | Bank logo |
| `brandSubtitle()` | Utility | Utility | Subtitle |
| `applyBrandPalette()` | Render | Render | Apply palette |
| `renderBrandPalettes()` | Render | Render | Palette selector |
| `resetBranding()` | Render | Render | Reset brand |
| `resetHierarchyCaches()` | Hierarchy | Hierarchy | Clear caches |

### 15.2 Liquidity Dashboard — All Functions

| Function | Purpose |
|---|---|
| `fmtMoney()` | Format currency |
| `fmtPct()` | Format percentage |
| `fmtNum()` | Format number |
| `fmtBytes()` | Format file size |
| `esc()` | HTML escape |
| `monthLabel()` | Date → month label |
| `val()` | Category → GL balance |
| `cf()` | Contractual cashflow lookup |
| `saveState()` | Persist state to localStorage |
| `saveCollapse()` | Persist collapse state |
| `growth()` | Growth rate for category/period |
| `setGrowth()` | Set growth rate |
| `project()` | **CORE: 13-month projection engine** |
| `availableLiquidity()` | Total liquidity calculation |
| `availableLiquiditySources()` | Source breakdown |
| `ratioValue()` | Ratio from balances |
| `ratioStatus()` | OK/EWI 1/EWI 2/Limit |
| `visiblePeriods()` | Monthly or quarterly |
| `quarterMonths()` | Quarter → months |
| `valueFor()` | Row value for period |
| `periodHeader()` | Period → header |
| `moneyCell()` | Money table cell |
| `pctCell()` | Percentage table cell |
| `balanceFor()` | Period → balances |
| `hierarchyDepth()` | Row depth |
| `balanceSheetHierarchyRows()` | Filter BS rollup rows |
| `projectedHierarchyAmounts()` | Scale GL to forecast |
| `renderOutput()` | Output tab |
| `renderDetails()` | Details tab |
| `renderHierarchyBalanceSheet()` | Proforma BS |
| `renderMoneySchedule()` | Generic table |
| `renderAssumptions()` | Assumptions tab |
| `renderSettings()` | Settings tab |
| `render()` | Top-level dispatch |

---

## Document Change Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-07-11 | Architecture Review | Initial comprehensive documentation |

---

**End of Architecture Documentation**
