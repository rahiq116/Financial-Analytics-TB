# Financial Analytics Platform — Complete Feature Inventory

**Purpose:** Catalog every feature, button, dialog, calculation, report, editor, import, export, validation, and setting in the platform.  
**Scope:** Yield Statement Dashboard + Liquidity Dashboard + Shared Infrastructure  
**Rating Scale:** Complexity (1-5), Reuse Potential (1-5), Business Value (1-5)

---

## Subsystem A: Metadata / Hierarchy Engine

### Hierarchy Data Management

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| A1 | **Organization Tree** | Bank organizational structure — holding company → bank → division → region → county → branch. Supports rollup consolidation, branch mapping, sort ordering. | 4 | 5 | 5 | `organizationNodes[]` |
| A2 | **Account Tree** | GL chart of accounts hierarchy — financial statements → balance sheet / income statement → asset/liability/capital/income/expense → detailed categories → leaf GL accounts. Each node carries StatementRollup, MappingType, and Map (GL code). | 4 | 5 | 5 | `accountNodes[]` |
| A3 | **Statement Tree** | Reporting line hierarchy — defines parent-child relationships between yield statement lines, frozen status, annualization conventions, and sort order. Drives report structure. | 3 | 5 | 5 | `statementNodes[]` |
| A4 | **Statement Line Definitions** | 145 master line definitions with explicit GL balance codes, income codes, and calculation flags (rollupBal, rollupInc, noRate, spread, nim, roa, roe, earningAssetsCalc, etc.). The central metadata that governs all calculations. | 5 | 4 | 5 | `momLines[]:2529` |
| A5 | **Parent-Child Rollup Map** | Defines which statement children roll into which parents. Used for automatic rollup calculation and for building default statement nodes when missing. | 3 | 4 | 4 | `rollupChildren{}:3573` |
| A6 | **Reference Account Registry** | ~500 GL account codes mapped to display titles, categories, and account types. Used for display, drill-down, and category resolution. | 2 | 5 | 5 | `referenceAccounts[]:22` |
| A7 | **Reference Hierarchy** | Display hierarchy for GL accounts — group, label, account, category, indent. Used for the detail drill-down views. | 2 | 3 | 3 | `referenceHierarchy[]:25` |

### Hierarchy Tree Operations

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| A8 | **Tree Child Index** | Builds parent→children maps for organization, account, and statement trees. Cached for O(1) lookup. | 1 | 5 | 5 | `orgChildrenMap()`, `accountChildMap()`, `accountPickerChildMap()` |
| A9 | **Descendant Branch Resolution** | Given an org node, returns the Set of all leaf branch numbers. Used for branch filtering — "Central Texas" → {1,2,3,4,10,5,6,7,9}. | 2 | 5 | 5 | `descendantOrgMaps()` |
| A10 | **Account Dimension Leaf Resolution** | Given a statement label, returns all leaf GL accounts. Used for GL code resolution in calculations. | 3 | 5 | 5 | `accountDimensionLeaves()`, `leafAccountsForLabel()` |
| A11 | **Subtotal Code Expansion** | Given a subtotal GL code (e.g., 105999), expands to all leaf descendant codes. Prevents double-counting by resolving subtotals to their components. | 3 | 4 | 5 | `lowestMappedDescendantCodes()`, `statementInputCodes()` |
| A12 | **Organization Option Rows** | Builds hierarchical option data for the organization picker popover — labels, paths, depths, counts, searchable text. | 3 | 4 | 4 | `orgOptionRows()` |
| A13 | **Account Rollup Tree Rows** | Same as A12 but for the account rollup picker. | 3 | 4 | 4 | `accountRollupTreeRows()` |
| A14 | **Statement Renderable Lines** | Filters the full statement line set to only those active in the current hierarchy, adding synthetic nodes for statement-only lines. | 2 | 4 | 5 | `statementRenderableLines()` |

### Hierarchy Validation & Enforcement

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| A15 | **Required Org Node Enforcement** | Ensures Holding Company (900), Big Country (1001), and Project Eagle (1002) always exist. Creates them if missing, fixes orphaned nodes. | 3 | 2 | 4 | `ensureRequiredOrganizationNodes()` |
| A16 | **Parent Map Clearance** | Erases branch Map values from org nodes that have children. Enforces that only leaf nodes carry branch mappings. | 1 | 4 | 4 | `clearOrganizationRollupMaps()` |
| A17 | **Vestigial Node Removal** | Deletes nodes named "no branch" — legacy cleanup. | 1 | 2 | 2 | In `ensureRequiredOrganizationNodes()` |
| A18 | **Audit-Forced Mapping Corrections** | Overrides user mappings for 8 specific GL accounts, 14 budget line keys, and 30+ audit keys. Ensures critical classifications cannot be broken. | 4 | 2 | 5 | `normalizeKnownHierarchyMappings()` |
| A19 | **Redundant Node Removal** | Deletes duplicate "Total Liabilities & Equity" branch from account tree. | 1 | 2 | 3 | `removeRedundantDefaultHierarchyNodes()` |
| A20 | **Single Rollup Enforcement** | Ensures every GL account has exactly one statement rollup assignment. Reconciles quick GL mappings with account hierarchy nodes. | 2 | 4 | 5 | `enforceSingleStatementRollupAssignments()` |
| A21 | **Statement Node Initialization** | Merges hardcoded defaults, saved edits, and version-keyed migrations into the active statement hierarchy. Enforces frozen status. | 3 | 3 | 5 | `initializeStatementNodes()` |

### Hierarchy Persistence

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| A22 | **Hierarchy Snapshot Save** | Serializes all three trees plus mappings into a JSON snapshot. Saved to localStorage. | 1 | 4 | 4 | `saveHierarchySnapshotLocally()`, `hierarchySnapshotFromCurrent()` |
| A23 | **Hierarchy Snapshot Load** | Reads saved snapshot from localStorage, validates, and applies. Includes fallback to legacy V1 key. | 2 | 4 | 4 | `applySavedHierarchyEdits()`, `applyHierarchySnapshot()` |
| A24 | **Shared Workbook Sync** | Saves hierarchy changes to the shared Excel workbook (`Dashboard Hierarchies.xlsx`) via File System Access API. | 3 | 3 | 4 | `saveSharedHierarchyFromUi()` |

---

## Subsystem B: Data Ingestion Pipeline

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| B1 | **CSV File Parser** | Handles quoted fields, escaped quotes, line endings, empty rows. Converts raw text to row objects. | 2 | 5 | 5 | `parseCsv()` |
| B2 | **XLSX File Parser** | Lazy-loads XLSX.js library. Reads workbook sheets. Converts to row objects. | 2 | 5 | 5 | `importQuickMappings()`, budget loading |
| B3 | **Data Normalization** | Standardizes dates (4 input formats), account codes, branch IDs, balance views, amounts (parentheses/commas/$). Drops invalid rows silently. | 4 | 5 | 5 | `normalize()` |
| B4 | **Date Parsing (Multi-Format)** | Handles ISO, slash format, month-name format, Excel serial numbers. | 3 | 5 | 5 | `normalizedDate()` |
| B5 | **Branch ID Normalization** | Strips prefixes, extracts leading numeric portion, normalizes decimals. | 1 | 5 | 4 | `normalizedBranchId()` |
| B6 | **Account Code Normalization** | Strips decimal suffixes, pads to 6 digits. | 1 | 5 | 4 | `normalizedAccountCode()` |
| B7 | **Number Parsing** | Handles currency symbols, commas, parentheses (negatives), Unicode minus. | 1 | 5 | 4 | `num()` |
| B8 | **Embedded CSV Decoding** | Gzip-base64 decompression of embedded sample data. | 2 | 2 | 3 | At startup |
| B9 | **External Folder Loading** | File System Access API — persistent folder handles, reads all CSV/XLSX files, tracks last-modified dates. | 4 | 4 | 5 | `loadExternalRepositoryData()` |
| B10 | **Data Refresh** | Re-reads external folder, re-parses all files, updates dataset in-place. | 2 | 3 | 4 | `refreshExternalDataBtn` handler |
| B11 | **Temporary Comparison Upload** | Loads a separate file for side-by-side comparison without replacing main dataset. | 3 | 2 | 3 | `temporaryComparison` |

---

## Subsystem C: Indexing Layer

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| C1 | **Value Index** | Map keyed by `date|view|account` → summed amount. O(1) lookup for consolidated queries. | 1 | 5 | 5 | `valueIndex` |
| C2 | **Branch Value Index** | Map keyed by `date|view|account|branch` → summed amount. O(1) lookup for branch-filtered queries. | 1 | 5 | 5 | `branchValueIndex` |
| C3 | **Rollup Value Index** | Map keyed by `date|view|statementLabel` → pre-summed amount. Fast rollup without GL code expansion. | 1 | 4 | 5 | `rollupValueIndex` |
| C4 | **Control Value Index** | Same as rollup but for control/subtotal accounts (e.g., Net Income 699999). | 1 | 3 | 4 | `controlValueIndex` |
| C5 | **Date Cache** | Sorted unique dates array. Drives filter dropdowns, prior date calculation, trend charts. | 1 | 5 | 5 | `datesCache` |
| C6 | **Measure Cache** | Caches `{avg, balance, inc, rate}` per line per date per branch per view. Invalided on filter change. | 1 | 5 | 5 | `measureCache` |
| C7 | **Period Measure Cache** | Same as C6 but for multi-date period calculations. | 1 | 5 | 5 | `periodMeasureCache` |
| C8 | **First Row By Account** | First GL row per account code — used for display name lookup. | 1 | 4 | 4 | `firstRowByAccount` |
| C9 | **Account Set** | All unique GL codes in data. Used for existence checks. | 1 | 4 | 4 | `accountSet` |
| C10 | **Budget Index Cache** | Parallel index for budget data — keyed by `version|month|view|budgetLineKey`. | 2 | 3 | 4 | `budgetIndexCache` |
| C11 | **Budget Leaf Index** | Multi-version leaf-level budget index with consolidated deduplication. | 4 | 2 | 4 | `budgetLeafIndexForStatement()`, `budgetLeafIndexForPeriod()` |
| C12 | **Cache Invalidation** | Clears measureCache, currentFilterCache, trendFilterCache, orgChildMapCache on filter change. | 1 | 3 | 4 | `resetHierarchyCaches()` |

---

## Subsystem D: Calculation Engine

### Single-Month Calculations

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| D1 | **Line Measure — Single Month** | Computes `{avg, balance, inc, rate}` for a statement line at a specific date. Handles rollupBal/rollupInc, child aggregation, custom formulas, special calculations, day count conventions. The core calculation function. | 5 | 5 | 5 | `lineMeasure()` |
| D2 | **Balance Code Resolution** | Resolves which GL codes contribute to a line's balance — from explicit codes, quick mappings, account dimension leaves, supplemental codes, and subtotal expansion. | 4 | 5 | 5 | `lineBalanceCodes()` |
| D3 | **Income Code Resolution** | Same as D2 but for income/expense codes. Special handling for securities income dimension. | 4 | 5 | 5 | `lineIncomeCodes()` |
| D4 | **Date Value Lookup** | Sums indexed values for a set of GL codes at a date/view. Branch-aware (uses branchValueIndex when filtered). | 2 | 5 | 5 | `dateValues()` |
| D5 | **Rollup Date Value Lookup** | Pre-summed rollup values via rollupValueIndex. Branch-aware. | 2 | 4 | 5 | `rollupDateValues()` |
| D6 | **Account Value Lookup** | Single-account value with allocation fallback chain. | 2 | 4 | 4 | `accountValue()` |
| D7 | **Direct GL Row Scan** | Scans raw rows for specific codes/branches. Used as fallback when indexes miss. | 2 | 3 | 3 | `directAllocationRowsForBranches()` |
| D8 | **Child Rollup Aggregation** | Sums measure values for all child statement lines. Used when rollupBal/rollupInc is true. | 2 | 5 | 5 | In `lineMeasure()` |
| D9 | **Quick-Mapped Code Aggregation** | Sums values from quick-mapped GL codes for a given line/category. | 2 | 4 | 5 | `quickMappedCodesForLine()`, `quickMappedCodesForLabel()` |
| D10 | **Display Measure For Label** | Convenience wrapper — computes measure for a label, falling back to direct account aggregation if no line definition exists. | 1 | 4 | 4 | `displayMeasureForLabel()` |
| D11 | **Account Measure** | Computes measure for a single GL account, respecting line definition's balance/income code membership. | 2 | 3 | 3 | `accountMeasure()` |

### Period Calculations

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| D12 | **Period Line Measure** | Multi-month version of lineMeasure. Day-weighted average balances, summed income, last-month ending balance, period annualization factors. | 5 | 5 | 5 | `periodLineMeasure()` |
| D13 | **Period Average Calculation** | Day-weighted average across months: Σ(monthAvg × daysInMonth) / Σ(daysInMonth). | 2 | 5 | 5 | `periodAverageValues()` |
| D14 | **Period Date Values** | Sum of date values across multiple months for a code set. | 1 | 5 | 5 | `periodDateValues()` |
| D15 | **Period Rollup Date Values** | Day-weighted rollup values across months. | 2 | 4 | 5 | `periodRollupDateValues()` |
| D16 | **Period Display Measure** | Period version of displayMeasureForLabel. | 1 | 4 | 4 | `displayPeriodMeasureForLabel()` |
| D17 | **Period Account Measure** | Period version of accountMeasure. | 2 | 3 | 3 | `periodAccountMeasure()` |
| D18 | **Quarter Utilities** | Date → quarter key, quarter label, previous quarter, quarter sort value, quarter date filtering. | 2 | 4 | 4 | `quarterKey()`, `quarterLabel()`, etc. |

### Rate Calculations

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| D19 | **Day Count Conventions** | Four conventions: 30/360 (securities/mortgages), 90/360 (FHLB stock), ACT/360, Actual/365 (default). Label-based assignment with hardcoded overrides. | 3 | 5 | 5 | `annualizationFactor()`, `normalizeAnnualization()`, `lineDayCount()` |
| D20 | **Period Annualization** | Period versions: period income factor (12/months), period balance factor (365/totalDays), convention-specific variants. | 3 | 5 | 5 | `periodAnnualizationFactor()`, `periodIncomeAnnualizationFactor()` |
| D21 | **Weighted Child Rate** | Computes parent rate as weighted average of children's rates by average balance. Used for rollup lines. | 3 | 5 | 5 | `weightedChildRate()` |
| D22 | **Period Weighted Child Rate** | Period version of weighted child rate. | 3 | 5 | 5 | `periodWeightedChildRate()` |
| D23 | **UBPR NIM (Tax-Equivalent)** | Grosses up tax-exempt income by dividing by 0.79 (21% tax rate). Computes tax-equivalent NII / earning assets × 12. | 4 | 2 | 4 | In `lineMeasure()` nim/ubprNim path |

### Special Calculations

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| D24 | **Net Interest Spread** | |Earning Assets Income| − |Total Funding Liabilities Expense|. | 2 | 5 | 5 | In `lineMeasure()` spread path |
| D25 | **NII After FTP** | NII + FTP (branch-only metric). | 1 | 4 | 4 | In `lineMeasure()` niiAfterFtpCalc path |
| D26 | **Pre-Provision Net Revenue** | NII + FTP + Non-Interest Income − Non-Interest Expense. | 2 | 5 | 5 | In `lineMeasure()` preProvisionCalc path |
| D27 | **Net Income (Branch)** | Pre-Provision − PLL − Total Allocations. | 2 | 5 | 5 | In `lineMeasure()` netIncomeCalc path |
| D28 | **Net Income (Consolidated)** | Pre-Provision − PLL (no allocations at consolidated). | 2 | 5 | 5 | In `lineMeasure()` netIncomeCalc path |
| D29 | **Earning Assets Build-Up** | Gross Loans + Total Investments − Total Securities MTM. Used for NIM denominator. | 2 | 5 | 5 | In `lineMeasure()` |
| D30 | **Monthly NIM** | NII × 12 / max(Total Deposits avg, Earning Asset Build avg). | 3 | 5 | 5 | In `lineMeasure()` monthlyNim path |
| D31 | **ROAA** | Net Income × 12 / Average Total Assets. Three-tier net income retrieval (direct GL 699999 → expanded → calculated). | 2 | 5 | 5 | In `lineMeasure()` roa path |
| D32 | **ROAE** | Net Income × 12 / Average Total Capital. | 2 | 5 | 5 | In `lineMeasure()` roe path |
| D33 | **Custom Formula Evaluation** | Safe expression evaluator for user-defined formulas. Syntax: `[Label A] + ABS([Label B])`. Restricted to abs/max/min identifiers only. Circular reference guard. | 4 | 4 | 5 | `safeEvalStatementFormula()`, `customLineFormulaResult()` |
| D34 | **Custom Period Formula** | Period version of custom formula evaluation. | 4 | 4 | 5 | `customPeriodFormulaResult()` |
| D35 | **Tax-Exempt Income** | Sums tax-exempt GL codes (300095, 303190, 303194). Used in UBPR NIM. | 1 | 3 | 3 | `taxExemptIncome()`, `periodTaxExemptIncome()` |
| D36 | **Adjusted Average Assets** | max(Total Deposits avg, Earning Asset Build sum). Conservative denominator for NIM. | 2 | 4 | 5 | `adjustedAverageAssets()` |
| D37 | **Direct Net Income** | Three-tier fallback for net income: direct GL 699999 → expanded descendant codes → calculated from line measure. | 2 | 4 | 4 | `directNetIncome()` |
| D38 | **Income Share Calculation** | Computes each line's income as a percentage of total income or total expense. Used in the 13-month income statement report. | 3 | 3 | 4 | `reportIncomeShare()`, `reportIncomeShareKind()` |
| D39 | **Allocation Value Fallback Chain** | Six-tier fallback for Total Allocations: indexed leaf → indexed control → rollup index → direct leaf scan → direct control scan → branch map fallback. | 4 | 2 | 4 | `directAllocationRowsValue()` |

---

## Subsystem E: Mapping Engine

### Quick GL Mappings

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| E1 | **Quick GL Mapping CRUD** | Create, read, update, delete mappings: GL account → statement rollup + mapping type. Saved to localStorage. | 2 | 5 | 5 | `normalizedQuickMappings()`, `saveQuickGlMappings()`, `removeQuickMappings()` |
| E2 | **Quick Mapping Lookup** | O(1) lookup of rollup and type for a GL account. Built from normalized mappings. | 1 | 5 | 5 | `quickMappingLookup()` |
| E3 | **Mapping Type Classification** | Six types: auto, balance, incexp, ftp, allocation, ignore. Each constrains how the account contributes to calculations. | 2 | 5 | 5 | `quickMappingAppliesToBalance()`, `quickMappingAppliesToIncome()` |
| E4 | **Mapping Review Panel** | Lists all unmapped accounts with current activity. Shows detected category, latest balance, income, branch gaps. Checkbox multi-select. | 3 | 4 | 5 | `renderQuickMappingReview()` |
| E5 | **Mapping Completeness Tracking** | Counts unmapped accounts, unmapped branches, saved mappings. Displayed as status banner. | 1 | 4 | 4 | `mappingStatusCounts()` |
| E6 | **Quick Mapping Import** | Import mappings from CSV or XLSX file. Merges with existing. | 2 | 4 | 4 | `importQuickMappings()` |
| E7 | **Quick Mapping Export** | Export all saved mappings to CSV file. | 1 | 4 | 3 | `exportQuickMappings()` |
| E8 | **Mapping → Account Hierarchy Sync** | Creates account tree nodes for newly mapped GL codes. Ensures editor and calculations stay consistent. | 3 | 3 | 4 | `syncMappedAccountsToAccountHierarchy()` |

### Budget Line Mappings

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| E9 | **Budget Line Mapping CRUD** | Create, update, delete budget line mappings: budget row key → statement rollup + type (leaf/rollup) + view + ignore flag. | 2 | 5 | 5 | `normalizedBudgetLineMappings()`, `saveBudgetLineMappings()` |
| E10 | **Budget Line Key Normalization** | Converts budget row names to lookup keys (lowercase, strip spaces and special chars). | 1 | 4 | 4 | `budgetLineKey()` |
| E11 | **Budget Mapping Review Panel** | Lists all budget lines — shows mapping status, suggested rollup, views, versions, row counts, latest amounts. Multi-select with Map/Ignore/Remove actions. | 3 | 4 | 5 | `renderBudgetMappingReview()` |
| E12 | **Budget Candidate Compilation** | Collects all unmapped budget lines from both budget rows and candidate rows. Deduplicates by key+view. | 3 | 3 | 4 | `budgetMappingCandidateRows()` |
| E13 | **Budget Row Mapping Decision** | For any budget row, determines: is it a leaf or rollup? What rollup should it map to? Should it be ignored? | 3 | 3 | 4 | `budgetRowMappingDecision()` |
| E14 | **Budget Leaf/Rollup Classification** | Classifies budget lines as leaf (included in calculations) or rollup (audit-only subtotal). Uses user mapping, name pattern matching, and subtotal flags. | 2 | 4 | 5 | In `normalizeBudgetLineMapping()` |

---

## Subsystem F: Budget Engine

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| F1 | **Budget Data Loading** | Reads budget XLSX files from folder, parses sheets, extracts rows with version/view/month/amount. | 3 | 4 | 5 | `loadBudgetRepositoryData()` |
| F2 | **Budget Row Application** | Sets budget rows, builds budget index cache, populates budget mapping candidates. | 2 | 3 | 5 | `applyBudgetRows()` |
| F3 | **Budget Version Indexing** | Builds parallel data index per budget version so the calculation engine can operate on budget data without modifying the main data structure. | 4 | 3 | 5 | `budgetIndexesForVersion()` |
| F4 | **Virtual Index Wrapper** | Temporarily swaps the calculation engine's data source from actual GL to budget index for budget-to-actual comparisons. | 3 | 3 | 5 | `withStatementIndexes()` |
| F5 | **Budget Version Management** | Multiple budget versions coexisting. User selects active version via dropdown. Approved version designation. | 2 | 4 | 5 | `budgetVersions()`, `approvedBudgetVersion` |
| F6 | **Budget Version Filter** | Dropdown populated with all available budget versions. Persists selection. | 1 | 4 | 4 | `populateBudgetVersionFilter()` |
| F7 | **Budget Side (Left/Right) Selection** | Enables comparisons between any two budget versions OR a version vs. actual. | 2 | 3 | 4 | `selectedBudgetLeftSide()`, `selectedBudgetRightSide()` |
| F8 | **Budget Leaf Index — Single Month** | Builds per-rollup lists of budget leaf rows for drill-down. Consolidation-aware deduplication. | 4 | 2 | 4 | `budgetLeafIndexForStatement()` |
| F9 | **Budget Leaf Index — Period** | Period version with day-weighted average balances and last-month ending balances. | 4 | 2 | 4 | `budgetLeafIndexForPeriod()` |
| F10 | **Budget Control Value** | Retrieves Net Income control value from budget index with multi-level fallback (index → rows). | 3 | 2 | 3 | `budgetNetIncomeControlValueForSide()` |
| F11 | **Budget Date Availability** | Checks whether a budget side has data for a specific date or period. | 1 | 3 | 4 | `budgetSideHasDate()`, `budgetDatesForSide()` |
| F12 | **Budget Period Date Filtering** | Gets YTD or QTD date ranges for a budget side, respecting calendar year boundaries. | 2 | 3 | 4 | `budgetYtdDatesForSide()`, `budgetQtdDatesForSide()` |
| F13 | **Budget Cache Restore** | Restores budget data from IndexedDB on startup for instant availability. | 2 | 3 | 4 | `restoreFullBudgetCache()` |
| F14 | **Approved Budget Commit** | Designates a budget version as the approved version. Persists to localStorage. | 1 | 3 | 4 | `commitApprovedBudgetFromUi()` |

---

## Subsystem G: Rendering Engine — Reports

### Overview Reports

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| G1 | **KPI Cards (17 metrics)** | Net Loans, Total Assets, Total Deposits, Capital, Core Deposits, Wholesale Funding, NII, Net Income, Yield on Loans, Yield on Total Assets, Cost of Funding, LDR, Efficiency Ratio, NIB/Deposits, NIM, ROAA/ROAE. Each shows value, variance vs prior month, delta badge. Rollup-aware. | 4 | 3 | 5 | `renderMetrics()` |
| G2 | **Funding Mix Donut Chart** | 5-segment SVG donut: Demand, Interest Bearing, High Wealth, Wholesale, Borrowings. Center total. | 3 | 3 | 4 | `svgDonut()` |
| G3 | **Loan Mix Donut Chart** | 9-segment SVG donut: Commercial, CRE, 1-4 Family, Consumer, Tax Exempt, Portfolio Mtg, Net Purchased, HFS, Participations. | 3 | 3 | 4 | `svgLoanMix()` |
| G4 | **Historical Trend Line Chart** | 13-month rolling SVG line chart. Consolidated shows 4 series (Commercial/Mortgage/CoreDeposits/Wholesale); filtered shows single series. | 3 | 3 | 4 | `svgLine()` |
| G5 | **Account Detail Table** | Filtered GL lines sorted by amount. Search box. Branch and rollup aware. | 2 | 2 | 3 | In `renderOverview()` |

### Yield Statement Reports

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| G6 | **MoM Yield Statement** | Month-over-month comparison table. Current month vs prior month. 9-column layout (Balance, Income, Rate × 2 sides + 3 variance columns). Frozen lines, always-display, inline children, drill-down. | 4 | 3 | 5 | `renderMomStatement()` |
| G7 | **QoQ Yield Statement** | Quarter-over-quarter comparison. Current quarter through selected date vs prior full quarter. Day-weighted period calculations. | 4 | 3 | 5 | `renderQoqStatement()` |
| G8 | **YTD Yield Statement** | Year-to-date comparison. Current YTD vs prior year YTD or budget YTD. Period calculations. | 4 | 3 | 5 | `renderYtdStatement()` |
| G9 | **Yield Statement Line Rendering** | Per-line: section headers (dark blue), spacer rows, total rows (light blue bg), metric rows (border-accented), drill rows (grey). Indent based on hierarchy depth. Icon for drill-down. | 3 | 3 | 5 | In all statement render functions |
| G10 | **Balance Check Row** | Assets − Liabilities & Capital. Shows balanced/out-of-balance status. $1 tolerance. | 1 | 4 | 5 | `renderBalanceCheckRow()` |
| G11 | **Income Check Row** | Yield Statement Net Income − GL Control Net Income. Cross-validates aggregation integrity. | 1 | 4 | 5 | `renderIncomeCheckRow()` |
| G12 | **Drill-Down — Category** | Click +/- to expand statement line to show child categories with their own balance/income/rate columns. Recursive. | 3 | 3 | 4 | `renderCategoryDrill()` |
| G13 | **Drill-Down — GL Account** | Click +/- to expand to individual GL accounts with 6-digit codes and titles. | 2 | 3 | 4 | `renderAccountDrillRows()` |
| G14 | **MoM/QoQ/YTD Drill Variants** | Separate drill functions for each period type (renderMomCategoryDrill, renderQoqCategoryDrill, renderYtdStatementCategoryDrill). | 3 | 2 | 4 | Various |
| G15 | **Measure Cell Rendering** | 9-value cell row: current balance/income/rate, prior balance/income/rate, variance balance/income/rate. | 2 | 3 | 5 | `renderMeasureCells()` |
| G16 | **Budget Measure Cell Rendering** | 9-value cell row with optional variance columns. Used for budget comparison tables. | 2 | 3 | 4 | `renderBudgetMeasureCells()` |

### Comparison Reports

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| G17 | **Period Comparison (MTD/QTD/YTD)** | Side-by-side tables: current period vs prior period. Variance and % change columns. Drill-down support. | 4 | 3 | 5 | `renderComparisons()`, `renderPeriodTable()` |
| G18 | **Period KPI Cards** | 4-card grid per period showing key metrics. | 2 | 3 | 3 | `periodMetrics()` |
| G19 | **Comparison Bar Chart** | Horizontal bar chart comparing YTD and QTD variances for 5 key metrics. | 2 | 2 | 3 | `svgComparisonBars()` |

### Budget Reports

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| G20 | **Budget MTD Comparison** | Month-over-month budget comparison. Left side vs right side (actual or budget version). | 4 | 3 | 5 | `renderBudgetMtdStatement()` |
| G21 | **Budget QTD Comparison** | Quarter-to-date budget comparison with period calculations. | 4 | 3 | 5 | `renderBudgetQtdStatement()` |
| G22 | **Budget YTD Comparison** | Year-to-date budget comparison. | 4 | 3 | 5 | `renderBudgetYtdStatement()` |
| G23 | **Budget Drill — Category** | Drill-down from statement line to child categories in budget mode. | 3 | 2 | 4 | `renderBudgetCategoryDrill()` |
| G24 | **Budget Drill — Leaf (Budget Lines)** | Drill-down showing individual budget lines with their amounts. | 3 | 2 | 4 | `renderBudgetLeafDrillRows()` |
| G25 | **Budget Drill — GL Account** | Drill-down to individual GL accounts under budget comparison. | 2 | 2 | 3 | `renderBudgetAccountDrillRows()` |
| G26 | **Budget Period Drill Variants** | Period versions of all budget drill functions. | 3 | 2 | 4 | Various `renderBudgetPeriod*` functions |

### Detail Reports (13-Month, Variance, BtA, Attribution)

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| G27 | **13-Month Balance Sheet** | Rolling 13-month balance sheet. Each column = month. Row hierarchy from statement lines. 13-month average column. | 4 | 3 | 5 | `renderThirteenMonthReport('balance')` |
| G28 | **13-Month Income Statement** | Same as G27 but for income. Additional columns: TTM, YTD Income, % Total per month, TTM, YTD, % Total YTD. Income share percentages. | 5 | 3 | 5 | `renderThirteenMonthReport('income')` |
| G29 | **Variance Report — Balance Sheet** | Branch-by-branch variance analysis. Org columns with drill-down expand. Current vs prior period variance. | 5 | 2 | 5 | `renderVarianceReport()` |
| G30 | **Variance Report — Income Statement** | Same as G29 but for income statement. | 5 | 2 | 5 | `renderVarianceReport()` |
| G31 | **Budget-to-Actual — Balance Sheet** | Branch-level BtA comparison. Budget version selectable for right side. | 5 | 2 | 5 | `renderBudgetToActualReport()` |
| G32 | **Budget-to-Actual — Income Statement** | Same as G31. | 5 | 2 | 5 | `renderBudgetToActualReport()` |
| G33 | **Budget-to-Actual — Income Statement YTD** | YTD variant of BtA. | 5 | 2 | 5 | `renderBudgetToActualReport()` |
| G34 | **Attribution — MoM** | Rate/volume/mix decomposition of balance and income changes. | 5 | 2 | 4 | `renderAttributionReport()` |
| G35 | **Attribution — QoQ** | Same as G34 but quarter-over-quarter. | 5 | 2 | 4 | `renderAttributionReport()` |
| G36 | **13-Month Drill-Down** | Recursive drill from statement line → child categories → GL accounts in 13-month views. | 3 | 2 | 4 | `renderThirteenMonthCategoryDrill()` |
| G37 | **Report Cache System** | Detail reports prewarmed and cached. Cache status indicator (processing/ready/expired). | 3 | 2 | 3 | `detailReportRenderCache`, `detailCacheStatus` |

---

## Subsystem H: Settings & Configuration

### Data Settings

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| H1 | **File Upload (GL)** | Upload CSV/XLSX files via hidden file input. Parsed and applied immediately. | 2 | 3 | 4 | `fileInput` handler |
| H2 | **External Folder Connection** | File System Access API folder picker. Persistent handle. Auto-refresh option. | 3 | 3 | 5 | `chooseRepositoryFolder()`, `chooseRepositoryFolderBtn` |
| H3 | **Data Refresh Button** | Re-reads external folder and refreshes all reports. | 1 | 3 | 4 | `refreshExternalDataBtn` |
| H4 | **Reset Sample Data** | Resets to embedded CSV sample data. | 1 | 2 | 3 | `resetBtn` |
| H5 | **Load Test Diagnostics** | 4-card grid + detail list showing source, file count, raw/normalized/skipped rows, dates, accounts, branches, missing columns, unmapped active. | 3 | 2 | 4 | `renderLoadTestDiagnostics()` |
| H6 | **Load Test Summary** | Memory object tracking all load statistics. Displayed in Settings panel. | 1 | 2 | 3 | `loadTestSummary` |
| H7 | **Temporary Comparison Panel** | Upload separate file for side-by-side comparison. Shows summary stats and detail tables. | 3 | 2 | 3 | `temporaryComparison` |

### Budget Settings

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| H8 | **Budget Folder Connection** | File System Access API folder picker for budget XLSX files. | 3 | 3 | 5 | `chooseBudgetFolder()`, `chooseBudgetFolderBtn` |
| H9 | **Budget Refresh** | Re-reads budget folder, re-parses all files, rebuilds indexes. | 2 | 3 | 4 | `loadBudgetRepositoryData()` |
| H10 | **Budget Loaded Popup** | Confirmation dialog when budget data loads successfully. | 1 | 2 | 2 | `showBudgetLoadedPopup()` |
| H11 | **Approved Budget Display** | Shows approved budget version with commit button. | 1 | 3 | 4 | `approvedBudgetStatus`, `commitApprovedBudgetBtn` |

### Hierarchy Settings

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| H12 | **Shared Hierarchy Folder Connection** | File System Access API folder picker for settings folder containing `Dashboard Hierarchies.xlsx`. | 3 | 3 | 5 | `chooseSettingsFolder()`, `chooseSettingsFolderBtn` |
| H13 | **Save to Shared Workbook** | Writes current hierarchy state (org, account, statement trees + mappings + calculations) to the shared Excel workbook. | 4 | 3 | 5 | `saveSharedHierarchyFromUi()`, `saveSharedHierarchyFromEditorBtn` |
| H14 | **Shared Hierarchy Startup Load** | On startup, attempts to load hierarchy from last-known shared workbook location. | 3 | 3 | 4 | `scheduleSharedHierarchyStartupLoad()` |
| H15 | **Hierarchy Workbook Status Display** | Shows connection status, last-saved timestamp, and action prompts for the shared workbook. | 1 | 2 | 3 | `renderSharedHierarchyWorkbookStatus()` |

### Display Settings

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| H16 | **Always-Display Checkbox Grid** | Checkbox grid for all non-frozen statement lines. Checked lines appear in yield statements. Persisted to localStorage. | 2 | 4 | 5 | `renderStatementDisplayGrid()`, `renderGlobalDisplayGrid()` |
| H17 | **Save Display Default** | Saves current checkbox state as the default. | 1 | 3 | 3 | `saveMomDisplayDefault()` |
| H18 | **Reset Display** | Resets checkboxes to default state. | 1 | 2 | 2 | `statementDisplayReset` |
| H19 | **Display Settings Panel** | Collapsible panel above tabs showing the display grid. Toggle button. | 1 | 3 | 3 | `statementDisplayBtn`, `statementDisplayPanel` |
| H20 | **Version-Keyed Default Migration** | Updates display defaults when version key changes. Merges saved with embedded. | 2 | 2 | 3 | `embeddedDisplayDefaultsVersion` |

### Mapping Settings

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| H21 | **Quick Mapping Save/Multi-Select** | Select multiple GL accounts, choose rollup + type, save all at once. | 2 | 4 | 5 | `saveSelectedQuickMappings()` |
| H22 | **Quick Mapping Remove** | Remove saved mappings for selected accounts. | 1 | 3 | 4 | `removeQuickMappings()` |
| H23 | **Budget Mapping Save** | Select budget lines, choose rollup + type, save. | 2 | 3 | 4 | `saveSelectedBudgetMappings()` |
| H24 | **Budget Mapping Ignore** | Mark selected budget lines as ignored. | 1 | 3 | 4 | `ignoreSelectedBudgetMappings()` |
| H25 | **Budget Mapping Remove** | Remove selected budget mappings. | 1 | 3 | 4 | `removeSelectedBudgetMappings()` |
| H26 | **Mapping Receipt Display** | Shows last mapping action message with counts. | 1 | 2 | 2 | `renderMappingTestReceipt()` |

---

## Subsystem I: Persistence Layer

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| I1 | **IndexedDB Processed Cache** | Stores normalized GL rows for instant startup. Versioned (v21). Auto-invalidates on version mismatch. | 3 | 4 | 5 | `saveProcessedCache()`, `tryLoadProcessedCache()` |
| I2 | **IndexedDB Budget Cache** | Stores budget rows for instant availability. Versioned (v21). | 3 | 3 | 5 | `saveBudgetCache()`, `restoreFullBudgetCache()` |
| I3 | **IndexedDB Detail Report Cache** | Precomputed detail report payloads. Reduces render time on tab switch. | 3 | 2 | 3 | `detailReportCacheStoreName` |
| I4 | **IndexedDB Import History** | Tracks monthly import files. | 2 | 2 | 2 | `importStoreName` |
| I5 | **localStorage Brand Settings** | Bank name, logo (base64), color palette selection. | 1 | 4 | 4 | `dashboardBrandSettings` |
| I6 | **localStorage Hierarchy Edits** | Full hierarchy snapshot (org + account + statement trees + mappings). | 1 | 4 | 5 | `yieldDashboardHierarchyEditsV2` |
| I7 | **localStorage Display Preferences** | Always-display checkboxes, display defaults. | 1 | 3 | 4 | `momAlwaysDisplay`, `momDisplayDefault` |
| I8 | **localStorage Quick GL Mappings** | All saved GL account → rollup mappings. | 1 | 4 | 5 | `quickGlMappings` |
| I9 | **localStorage Budget Line Mappings** | All saved budget line → rollup mappings. | 1 | 4 | 5 | `budgetLineMappings` |
| I10 | **localStorage Custom Calculations** | User-defined statement formulas. | 1 | 3 | 4 | `customStatementCalculations` |
| I11 | **localStorage Folder Settings** | Repository, budget, and settings folder handles (serialized). | 1 | 3 | 4 | `yieldDashboardRepositoryFolder`, etc. |
| I12 | **localStorage Version Keys** | Schema version tracking for migrations. Multiple version keys. | 1 | 3 | 3 | Various `*Version` constants |
| I13 | **localStorage Cashflow Assumptions** | Liquidity dashboard: growth rates, scenario name, liquidity capacities, ratio thresholds. | 1 | 3 | 4 | `liquidityDashboardRunoffAssumptions` |

---

## Subsystem J: Theming & Branding

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| J1 | **Color Palette Switcher** | Four palettes: Classic Blue, Heritage Green, Trust Navy, Modern Charcoal. Each maps to ~15 CSS custom properties. | 2 | 4 | 4 | `brandPalettes`, `applyBrandPalette()` |
| J2 | **Bank Name Customization** | Editable bank name. Updates title, subtitle, report headers, print output. | 1 | 4 | 4 | `bankNameInput` |
| J3 | **Logo Upload** | Upload image file, converted to base64 data URL. Displayed in topbar and print reports. | 1 | 4 | 4 | `logoInput` |
| J4 | **Brand Reset** | Resets name, logo, and palette to TexasBank defaults. | 1 | 2 | 2 | `resetBrandBtn` |
| J5 | **Brand Preview** | Shows current logo and name preview in branding panel. | 1 | 2 | 2 | Brand preview section |
| J6 | **Palette Swatch Grid** | Visual palette selector with active state highlighting. | 1 | 3 | 3 | `renderBrandPalettes()` |

---

## Subsystem K: Print Engine

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| K1 | **Print Section Selection** | Checkbox tree with 13 sections under 5 groups. Group-level select-all, subgroup select-all. | 3 | 3 | 5 | Print options in `index.html`, sync handlers |
| K2 | **Print Report Builder** | Generates detached DOM fragment with all selected sections. Page breaks, headers with bank brand, compact tables. | 4 | 3 | 5 | `buildPrintReport()` |
| K3 | **Print CSS** | Complete @media print stylesheet — landscape page support, compact sizing, table formatting, color preservation. | 3 | 3 | 5 | `yield-dashboard.css` @media print |
| K4 | **Print Select All / Deselect** | Toggle all sections on/off with one click. | 1 | 2 | 3 | `printSelectAll` |
| K5 | **Print to Browser** | Triggers `window.print()`. Beforeprint listener auto-builds if not pre-built. | 1 | 2 | 4 | `printSelectedBtn`, `beforeprint` listener |
| K6 | **Print Popover** | Dropdown menu with sections, open/close, outside-click-to-close. | 1 | 3 | 3 | `printMenu`, `printOptions` |

---

## Subsystem L: Hierarchy Editor

### Editor Core

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| L1 | **Four-Mode Editor** | Organization, Account, Statement, Budget tabs. Each mode has its own tree, detail panel, and operations. | 3 | 3 | 5 | `renderHierarchyEditor()` |
| L2 | **Tree Browser** | Expandable/collapsible tree with indent, selection highlighting, virtual leaf nodes (GL accounts under statement lines, budget lines under rollups). | 3 | 3 | 5 | `renderHierarchyTree()` |
| L3 | **Detail Panel** | Shows selected node's properties: name, parent, sort order, map/GL code, unary operator. Editable fields with auto-save on blur/change. | 3 | 3 | 5 | `renderHierarchyDetail()` |
| L4 | **Search Filter** | Text input filters tree to matching nodes. Expands ancestors to show matching descendants. | 2 | 3 | 4 | `hierarchySearchText`, `hierarchySearchMatches()` |
| L5 | **Expand All / Collapse All** | Bulk expand or collapse the entire tree. | 1 | 3 | 3 | `hierarchyExpandAll`, `hierarchyCollapseAll` |

### Editor Operations

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| L6 | **Add Child Node** | Creates a new node under selected parent. Auto-focuses name field. | 2 | 3 | 5 | `addHierarchyChild()`, `hierarchyAddChild` |
| L7 | **Delete Node** | Deletes selected node + all descendants. Confirmation dialog. Protected lines blocked. Cascading cleanup of mappings, display prefs, expansion state. | 3 | 3 | 4 | `deleteHierarchyNode()`, `hierarchyDeleteSelected` |
| L8 | **Edit Node Properties** | Name, parent reassignment, sort order, map/GL code, unary operator. Auto-saves on field change. | 2 | 3 | 5 | `saveHierarchyEdit()` |
| L9 | **Edit Node — Statement Tab** | Additional fields: Frozen toggle, annualization convention, custom balance/income/rate formulas, branch income formula. | 4 | 3 | 5 | Statement mapping fields |
| L10 | **Edit Node — Account Tab** | Statement rollup dropdown, mapping type dropdown for GL-mapped account nodes. | 2 | 3 | 5 | `renderHierarchyStatementMappingFields()` |
| L11 | **Edit Node — Budget Tab** | Parent reassignment and type toggle for budget leaf virtual nodes. | 2 | 2 | 3 | `renderBudgetLeafDetail()` |
| L12 | **Virtual Children — Statement** | Shows GL accounts mapped to a statement line as virtual leaf nodes under that line. | 2 | 3 | 4 | `statementMappedAccountsForLabel()` |
| L13 | **Virtual Children — Budget** | Shows budget lines mapped to a statement rollup as virtual leaf nodes. | 2 | 2 | 3 | `budgetMappedRowsForLabel()` |
| L14 | **Protected Line Blocking** | Frozen core statement lines cannot be deleted, renamed, or reparented. Add/delete disabled for Budget tab. | 1 | 3 | 4 | Various guards |

### Editor Persistence

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| L15 | **Auto-Save to localStorage** | Every edit triggers `saveHierarchyEdits()` → localStorage. | 1 | 3 | 4 | `saveHierarchyEdits()` |
| L16 | **Save to Shared Workbook** | Explicit "Save to shared workbook" button writes entire hierarchy state to the shared Excel file. | 3 | 2 | 5 | `saveSharedHierarchyFromUi()` |
| L17 | **Edit → Full Refresh** | After save, rebuilds data indexes, re-renders all reports, updates display grid. | 2 | 2 | 4 | `refreshAfterHierarchyEditorChange()` |

---

## Subsystem M: Liquidity Projection Engine

### Projection

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| M1 | **13-Month Projection** | Projects balance sheet 13 months forward. Monthly granularity with quarterly aggregation option. | 5 | 3 | 5 | `project()` |
| M2 | **Actual Month Lock** | First month locked to reference output (May 2026). Subsequent months are forecast. | 2 | 3 | 5 | In `project()` |
| M3 | **Category-Level Growth Assumptions** | Per-category, per-month growth rates. Configurable via input grid. Negative = runoff, positive = growth. | 3 | 3 | 5 | `growth()`, `setGrowth()` |
| M4 | **Contractual Cashflows** | Known paydown/maturity schedules applied before growth assumptions. Securities paydowns, loan runoff, deposit maturities. | 3 | 3 | 5 | `cf()` |
| M5 | **Balance Sheet Roll-Forward** | Each month's ending balance becomes next month's starting balance. Tracks 15 balance sheet categories. | 3 | 3 | 5 | In `project()` loop |
| M6 | **Quarterly Aggregation** | Groups monthly projections into quarters. Summation for flows, last-month for balances. | 2 | 3 | 4 | `quarterMonths()`, `valueFor()` |
| M7 | **Liquidity Waterfall** | Sources and uses cascading view: Beginning Overnight → Asset Activity → Liability Activity → Other Activity → Earnings/Dividends → Ending Overnight. | 3 | 3 | 5 | In `renderOutput()` waterfall section |

### Liquidity Analysis

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| M8 | **Available Liquidity Calculation** | Sums 11 liquidity sources: FRB + Brokered CD + FHLB (net) + FRB Line + Cash + CDARS + Unpledged Securities + Knight-Doss + Fed Funds + MSR + Mortgage Sales. | 2 | 3 | 5 | `availableLiquidity()` |
| M9 | **Liquidity Source Breakdown** | Individual source amounts with descriptions. Tiered: Primary / Secondary / Tertiary. | 2 | 3 | 5 | `availableLiquiditySources()` |
| M10 | **Liquidity Ratio Calculation** | 7 ratios: Loan-to-Deposits, FHLB Utilization, Brokered/Deposits, CDARS/Liabilities, Wholesale/Liabilities, NIB/Deposits, Liquid Asset Coverage. | 2 | 4 | 5 | `ratioValue()` |
| M11 | **Ratio Status Classification** | 4-level: Target, EWI 1 (yellow), EWI 2 (red), Limit (red). Direction-aware (min = lower is better, max = higher is better). | 2 | 4 | 5 | `ratioStatus()` |

### Liquidity Reports

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| M12 | **Report — Liquidity Waterfall** | Main output: waterfall table, 4 KPI cards, ratio table, liquidity sources table. | 3 | 2 | 5 | `renderOutput()` |
| M13 | **Report — Details** | Five detail schedules: Waterfall (detailed), Proforma BS, Proforma IS, Liquidity Availability, Contingent Lines, Contingent Usage. | 3 | 2 | 4 | `renderDetails()` |
| M14 | **Report — Proforma Balance Sheet** | Balance sheet projected from categories, proportionally scaled to GL detail via hierarchy. | 4 | 2 | 4 | `renderHierarchyBalanceSheet()` |
| M15 | **Report — Assumptions** | Growth rate input grid (category × month). Ratio threshold edit grid. | 2 | 2 | 4 | `renderAssumptions()` |
| M16 | **Report — Settings/Diagnostics** | Build metadata, file inventory, data card grid, model build diagnostics, local state display. | 2 | 2 | 3 | `renderSettings()` |
| M17 | **Generic Schedule Renderer** | `renderMoneySchedule()` — reusable line-definition-to-HTML-table function. | 2 | 4 | 4 | In liquidity details rendering |

---

## Subsystem N: Error Handling & Diagnostics

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| N1 | **Global Error Banner** | Fixed-position red banner on any unhandled error or unhandled rejection. Shows accumulated messages. | 1 | 5 | 5 | `showStartupError()`, error listeners |
| N2 | **Startup Error Registry** | Accumulates all startup errors in `window.__yieldStartupErrors`. | 1 | 3 | 4 | Lines 1-14 |
| N3 | **Allocation Row Audit** | Counts allocation rows for current date/view/branch. Multi-level fallback. Displayed in load test panel. | 3 | 2 | 4 | `allocationRowsAudit()`, `latestLoadedDateAllocationAudit()` |
| N4 | **Data Load Audit** | Complete audit of current data state: date, branch selection, maps, row counts, allocation totals, source files. | 2 | 2 | 4 | `currentDataLoadAudit()`, `currentDataLoadAuditText()` |
| N5 | **Allocation Source Warning** | Detects when most recent month has zero allocation rows but prior months had activity. Warns of stale/wrong folder. | 2 | 2 | 4 | `allocationSourceWarningText()` |
| N6 | **Import Persistence Status** | Tracked status messages for data loading pipeline. Displayed in load test panel. | 1 | 2 | 3 | `importPersistenceStatus` |
| N7 | **Budget Cache Status** | Tracked status for budget data loading. | 1 | 2 | 3 | `budgetCacheStatus` |
| N8 | **Version Mismatch Detection** | Detects when cache version in code differs from stored version. Auto-invalidates stale cache. | 1 | 3 | 4 | Cache version comparison |

---

## Subsystem O: Event System & UI Controls

### Tab Navigation

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| O1 | **Main Tab Switching** | 5 tabs: Overview, Summary, Yield Statement, Budget, Detail. Each activates its panel and shows relevant comparison controls. | 2 | 4 | 5 | `activateTab()`, `.tab-btn` handlers |
| O2 | **Yield Statement Sub-Tabs** | MTD / QTD / YTD within the Yield Statement tab. Shows as dropdown buttons next to parent tab. | 2 | 3 | 5 | `data-statement-tab-btn`, statement-tab-group |
| O3 | **Budget Sub-Tabs** | MTD / QTD / YTD within the Budget tab. | 2 | 3 | 5 | `data-budget-report-tab` |
| O4 | **Detail Sub-Tabs** | Four families: 13M (BS/IS), Var (BS/IS), BtA (BS/IS/IS YTD), Attr (MoM/QoQ). | 3 | 3 | 5 | `data-detail-family`, `detailFamilyDefaultReports` |

### Filter Controls

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| O5 | **Date Filter** | Dropdown of all available dates. Reverse chronological. Defaults to latest. | 1 | 4 | 5 | `dateFilter` |
| O6 | **Balance View Filter** | Ending Balance / Average Balance toggle. Affects all calculations and displays. | 1 | 4 | 5 | `viewFilter` |
| O7 | **Organization Picker** | Custom tree popover. Searchable. Expand/collapse with +/-. Shows branch counts. Auto-expands first levels on first open. | 4 | 5 | 5 | `renderOrgPicker()`, `setOrgPickerOpen()` |
| O8 | **Account Rollup Picker** | Same pattern as org picker but for statement rollups. Shows GL account counts. | 4 | 5 | 5 | `renderAccountPicker()`, `setAccountPickerOpen()` |
| O9 | **Comparison Date Filters** | Per-tab comparison date selectors. MoM prior month, QoQ prior quarter, Overview prior month, YTD period compare. | 2 | 3 | 4 | Various `populate*CompareDate()` functions |
| O10 | **Budget Side Filters** | Left side / Right side selectors for budget comparison. Each can be Actual or any budget version. | 2 | 3 | 4 | `budgetLeftFilter`, `budgetRightFilter` |

### Interactive Elements

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| O11 | **Drill-Down Toggle** | +/- buttons on statement lines to expand children. State persisted per session (Set objects). | 2 | 4 | 5 | `expandedMom`, `expandedQoq`, `expandedBudget`, drill button handlers |
| O12 | **Account Detail Search** | Text search box filters GL account detail table in real time. | 1 | 3 | 3 | `accountDetailSearch` |
| O13 | **Detail Display Rows Toggle** | Button to switch between basic and extended display for detail reports. | 1 | 2 | 2 | `detail-display-toggle` |
| O14 | **Detail Cache Status Indicator** | Pill-shaped indicator showing report cache status: processing (yellow), ready (green), expired (red). | 1 | 2 | 2 | `detailCacheStatus` |
| O15 | **Review Org Column Drill** | Expand/collapse org columns in variance/BtA reports. Click column header to show child columns. | 3 | 2 | 3 | `detailReviewExpandedOrgColumns`, review-org-drill handlers |

### Popovers & Dialogs

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| O16 | **Print Options Popover** | Dropdown with 13 section checkboxes. Click outside to close. Escape to close. | 2 | 3 | 4 | `printMenu`, `printOptions` |
| O17 | **Organization Picker Popover** | Tree in a positioned popover. Click outside to close. Escape to close. Click to select. | 2 | 4 | 5 | `orgPickerPopover` |
| O18 | **Account Picker Popover** | Same pattern for statement rollups. | 2 | 4 | 5 | `accountPickerPopover` |
| O19 | **Settings Dialog** | Inline settings panel (tab 6). Not a modal — full page section. | 1 | 2 | 3 | `settingsTab` |

---

## Subsystem P: Export & File Operations

### Exports

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| P1 | **Print to PDF** | Browser print → Save as PDF. Complete report formatting with branding. | 1 | 3 | 5 | `printSelectedBtn`, `window.print()` |
| P2 | **Export Selected Branch to Excel** | Exports current branch's report data to XLSX workbook using XLSX.js library. | 3 | 2 | 4 | `exportExcelBtn` |
| P3 | **Export Quick GL Mappings to CSV** | Downloads all saved GL mappings as CSV file. | 1 | 3 | 3 | `exportQuickMappings()` |

### Imports

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| P4 | **Import GL CSV/XLSX** | File upload → parse → normalize → apply. Multiple files via `multiple` attribute. | 2 | 3 | 4 | `fileInput` handler |
| P5 | **Import Budget CSV/XLSX** | Same for budget data. | 2 | 3 | 4 | `budgetFolderInput` handler |
| P6 | **Import External Folder** | Directory picker for GL data folder. Reads all CSV/XLSX files. | 3 | 3 | 4 | `externalFolderInput` handler |
| P7 | **Import Quick GL Mappings** | Upload CSV/XLSX of mappings → merge with existing. | 2 | 3 | 3 | `quickMappingFileInput` handler |
| P8 | **Import Logo Image** | FileReader → base64 → brand settings. | 1 | 2 | 2 | `logoInput` handler |

### File System API

| # | Feature | Description | Complexity | Reuse | Value | Location |
|---|---|---|---|---|---|---|
| P9 | **Persistent Folder Handle** | File System Access API — directory handles stored via IndexedDB for persistence across sessions. | 3 | 4 | 5 | `chooseRepositoryFolder()` |
| P10 | **Folder Contents Reading** | Iterates directory entries, filters by extension, reads file contents. | 2 | 3 | 4 | In folder loading functions |
| P11 | **XLSX Workbook Read/Write** | Lazy-loads XLSX.js. Reads sheets, writes sheets. Used for budget files, hierarchy workbook, and export. | 3 | 4 | 5 | Various |

---

## Summary Statistics

### By Category

| Category | Feature Count | Avg Complexity | Avg Reuse | Avg Value |
|---|---|---|---|---|
| Metadata / Hierarchy (A) | 24 | 2.75 | 4.00 | 4.50 |
| Data Ingestion (B) | 11 | 2.27 | 3.73 | 3.91 |
| Indexing Layer (C) | 12 | 1.50 | 4.33 | 4.50 |
| Calculation Engine (D) | 39 | 3.08 | 4.15 | 4.67 |
| Mapping Engine (E) | 14 | 2.29 | 3.93 | 4.43 |
| Budget Engine (F) | 14 | 2.57 | 3.07 | 4.43 |
| Rendering — Reports (G) | 37 | 3.35 | 2.73 | 4.35 |
| Settings & Config (H) | 26 | 2.04 | 3.04 | 3.85 |
| Persistence (I) | 13 | 1.69 | 3.15 | 4.00 |
| Theming & Branding (J) | 6 | 1.33 | 3.17 | 3.33 |
| Print Engine (K) | 6 | 2.17 | 2.83 | 4.17 |
| Hierarchy Editor (L) | 17 | 2.24 | 2.82 | 4.18 |
| Liquidity Projection (M) | 17 | 2.65 | 2.88 | 4.47 |
| Error Handling (N) | 8 | 1.50 | 2.75 | 3.88 |
| Event System (O) | 19 | 2.00 | 3.18 | 4.05 |
| Export & File Ops (P) | 11 | 2.00 | 2.91 | 3.45 |
| **TOTAL** | **274** | **2.35** | **3.36** | **4.24** |

### Top 5 by Business Value (all scored 5)

- A1-A7: Hierarchy data structures
- A8-A11: Tree operations
- C1-C7: Indexing layer
- D1-D21: Core calculations
- E1-E3: Quick GL mappings
- F1-F5: Budget engine
- G6-G8: Yield statement reports
- G20-G22: Budget reports
- G27-G34: Detail reports
- H12-H13: Shared hierarchy sync
- I1-I2: IndexedDB cache
- L1-L3: Hierarchy editor
- M1-M5: Liquidity projection
- N1: Error banner
- O7-O8: Organization/Account pickers
- P1: Print/PDF export

### Top 5 by Reuse Potential (all scored 5)

- A1-A11: Hierarchy engine (used by every calculation)
- B1-B7: Data ingestion (any module that loads data)
- C1-C7: Indexing layer (any module that queries data)
- D1-D21: Calculation engine (any report module)
- E1-E8: Mapping engine (any module with GL accounts)
- O7-O8: Picker components (any module with filters)

---

**End of Feature Inventory**
