# Design Philosophy, Pain Points & Product Vision

**A reconstruction of the original developer's intent, as inferred from the implementation.**  
**Written for the incoming development team.**

---

## The Original Developer's World

Imagine you are a software developer working inside a community bank. Your office is on the same floor as the treasury department. You hear their conversations. You see their screens.

Every month, the bank closes its books. A 50,000-row general ledger extract arrives from the core banking system. A treasury analyst opens Excel. They copy data. They paste data. They write VLOOKUPs. They build pivot tables. They manually color-code cells. They email the result to the CFO. The CFO asks why a number changed. The analyst spends two hours tracing the change through 15 Excel tabs. They find a formula error. They fix it. They re-email. The board meeting is in three hours.

This happens every month. At every community bank. For decades.

The developer decided to stop it.

---

## What Every Subsystem Reveals About the Developer's Intent

### 1. The Metadata / Hierarchy Engine

**The pain point it solves:** Treasury analysts maintain three separate spreadsheets that define the same organizational structure — one for the ALCO package, one for the board report, one for branch P&L. When a new branch opens, all three must be updated. One gets missed. Reports disagree.

**The design philosophy:** There should be exactly one definition of what the bank looks like. That definition should drive every report. The organization tree, the account classification, and the statement line structure are not configuration — they are *infrastructure*. They are as fundamental to the platform as the database schema is to a CRUD application.

**What the code reveals about intent:** The hierarchy engine is not an afterthought bolted onto a report builder. It is the FOUNDATION. Everything — every calculation, every filter, every drill-down, every chart — resolves through the hierarchy. The developer understood that in financial reporting, structure is everything. Get the structure right, and the numbers follow. Get the structure wrong, and no amount of calculation sophistication can save you.

**Evidence in the code:**
- Three separate tree types (organization, account, statement) — each serving a different domain concern
- Extensive validation on every load — `ensureRequiredOrganizationNodes()`, `normalizeKnownHierarchyMappings()`, `removeRedundantDefaultHierarchyNodes()`
- The hierarchy snapshot system — serialize and restore the entire state
- Frozen lines — a deliberate constraint on user freedom to protect report integrity
- Tree descent for branch resolution — hierarchical selection that mirrors how managers actually think about their organization

---

### 2. The Data Ingestion Pipeline

**The pain point it solves:** The GL extract from the core banking system is a CSV file. But it might use "May 31 2026" or "5/31/2026" or "2026-05-31" as the date format. Amounts might be "$1,250,000.00" or "1250000" or "(1250000)" for negatives. Account codes might be "0105040" or "105040" or "105040.00". Branch numbers might be "01" or "1" or "Branch 01 - Brownwood".

The treasury analyst's monthly ritual includes 30 minutes of manual data cleaning before any analysis can begin.

**The design philosophy:** The platform must accept data in whatever format the bank's core system produces it. The ingestion pipeline is a normalization layer that transforms "whatever the bank gives us" into "what the calculation engine expects." This is a recognition of operational reality: the platform cannot control the data source. It must be generous in what it accepts and rigorous in what it passes forward.

**What the code reveals about intent:** The `normalize()` function is not a simple type converter. It is a defensive boundary. It handles four date formats, three sign conventions, multiple branch ID patterns, and silently drops rows that cannot be salvaged. The developer understood that data quality is the #1 cause of support tickets in financial software. By accepting messy data silently, the platform eliminates an entire category of user frustration.

**Evidence in the code:**
- `normalizedDate()` — four format handlers (ISO, slash, month-name, Excel serial)
- `normalizedBranchId()` — strips prefixes, normalizes decimals, extracts numeric portion
- `num()` — handles dollar signs, commas, parentheses, Unicode minus signs
- Silent row dropping with statistics tracking — be generous in input, transparent about what was discarded
- The fallback chain — IndexedDB → external folder → embedded CSV — the platform will ALWAYS find data

---

### 3. The Indexing Layer

**The pain point it solves:** A treasury analyst opens the dashboard, changes the date filter, and waits. And waits. The dashboard is scanning 50,000 rows to recalculate every number. The analyst loses their train of thought. They go back to Excel because "it's faster."

**The design philosophy:** Financial analysis is iterative. The analyst asks a question, looks at the answer, asks a follow-up question. Each question-change-answer cycle must be instantaneous. If the platform imposes a 3-second delay between each filter change, the analyst's workflow is broken. They will not use the platform.

The indexing layer is the performance foundation. By pre-computing every lookup key at data load time, the platform can answer any query in O(1) time during analysis. The developer understood that you cannot make the calculation engine fast enough to compensate for slow data access. The data access must be instant. The calculation engine can then be as sophisticated as needed.

**What the code reveals about intent:** The developer built not one index but FOUR parallel indexes (`valueIndex`, `branchValueIndex`, `rollupValueIndex`, `controlValueIndex`). Each serves a different query pattern. The branchValueIndex avoids computing branch subtotals on the fly. The rollupValueIndex avoids expanding GL codes to compute rollup totals. This is deliberate redundancy for performance — the developer was willing to trade memory for speed.

**Evidence in the code:**
- Four index Maps with different key schemas
- `measureCache` and `periodMeasureCache` — caching the expensive calculation results
- Aggressive cache invalidation — clear everything on filter change, simple and safe
- O(1) lookup for the most common operations

---

### 4. The Calculation Engine

**The pain point it solves:** Three different people in the treasury department calculate Net Interest Margin three different ways. The CFO uses one methodology. The ALCO package uses another. The board report uses a third. When the numbers disagree (and they always do), nobody can explain why. The discrepancy erodes trust in ALL the numbers.

**The design philosophy:** There must be ONE calculation. One authoritative implementation of every formula, every rate, every rollup, every convention. When a number appears on a report, its provenance must be traceable: it came from these GL accounts, aggregated with this method, annualized with this convention, compared against this prior period.

The calculation engine is not just math. It is a *contract*. It says: "This is how this bank calculates yield. This is how this bank calculates NIM. This is the methodology, and it is applied consistently to every report, every month, every branch."

**What the code reveals about intent:** `lineMeasure()` is ~110 lines of branching logic. It is not a simple sum. It handles: GL code resolution (5 paths), child rollup aggregation, custom formulas, special calculations (10+ named calc types), rate derivation (7 paths depending on line type), and branch vs. consolidated logic. The developer was encoding the bank's actual calculation methodology — all the tribal knowledge about "we calculate Earning Assets as Gross Loans plus Total Investments minus MTM" and "Net Income for branches includes allocations but consolidated doesn't" — into executable code.

The special calculation flags (`netInterestSpreadCalc`, `preProvisionCalc`, `netIncomeBeforeAllocationsCalc`, `netIncomeCalc`) are not random. They correspond to the natural progression of a bank income statement: Interest Income → Net Interest Income → + FTP → + Non-Interest Income → − Non-Interest Expense → Pre-Provision → − Provision → Net Income. The developer was modeling the income statement's mathematical structure.

**Evidence in the code:**
- 10+ special calculation flags — each representing a distinct financial concept
- Dual income resolution (codes vs. children) — handling both leaf and rollup aggregation
- Rate calculation with 7 different paths — spread, NIM (monthly), NIM (UBPR), ROAA, ROAE, weighted child, default
- Branch-aware logic throughout — consolidated vs. branch-level calculations differ
- Custom formula engine — acknowledging that some calculations will always be bank-specific

---

### 5. The Mapping Engine

**The pain point it solves:** A new GL account is created in the core banking system (a new loan product). The next monthly report silently excludes it from the loan totals because the platform doesn't know where it belongs. Nobody notices for three months. Then an auditor asks why the loan portfolio suddenly grew $8M — it didn't grow, it was just invisible.

**The design philosophy:** GL account classification cannot be fully automated. Every bank has edge cases — accounts that don't follow the standard range conventions, accounts that need to roll up to specific subcategories, accounts that should be excluded entirely. The platform must make unmapped accounts VISIBLE. An unmapped account with a $5M balance is not a minor data issue — it is a report integrity failure. The platform's job is to surface it, not hide it.

The Mapping Engine gives finance users self-service control over classification. They don't need IT to change a code mapping. They open the Mapping Review panel, see the unmapped accounts, and map them in seconds. The platform validates that every account with activity is mapped, and shows the count prominently.

**What the code reveals about intent:** The Mapping Review panel is not an afterthought admin screen. It is one of the most prominent UI elements — the Settings tab devotes significant real estate to it, with a multi-select table, status banner, rollup dropdown, type selector, and import/export functionality. The developer understood that mapping is an ongoing operational task, not a one-time setup. New accounts appear every month. The mapping interface must be efficient enough for monthly use.

**Evidence in the code:**
- Audit-forced corrections — `normalizeKnownHierarchyMappings()` enforces non-negotiable classifications
- `enforceSingleStatementRollupAssignments()` — preventing classification conflicts
- Mapping completeness tracking with prominent status display
- `syncMappedAccountsToAccountHierarchy()` — keeping the hierarchy tree and mappings consistent
- Import/export — bulk mapping management for large changes

---

### 6. The Budget Engine

**The pain point it solves:** The annual budgeting process produces a 50-tab Excel workbook. Each tab is a different version (Original Budget, Q1 Reforecast, Q2 Reforecast). The treasury analyst manually copies numbers from the budget workbook into a comparison spreadsheet. Column references break. Formulas point to the wrong version. The CFO asks "what's the budget variance on Net Interest Income?" and the analyst says "let me check which version I'm comparing against."

**The design philosophy:** Budget data and actual data are fundamentally different things. They come from different sources. They have different structures. They serve different purposes. They must NEVER be merged. The virtual index pattern is a deliberate architectural choice: the calculation engine operates on either actual data or budget data depending on which index is active, but the two data sources never touch each other. This preserves data provenance — every number on the budget comparison report can be traced to either "actual GL data loaded on date X" or "budget workbook version Y."

**What the code reveals about intent:** The budget leaf index system (`budgetLeafIndexForStatement()`, `budgetLeafIndexForPeriod()`) is surprisingly sophisticated. It handles consolidation-aware deduplication (a budget row marked "All" branch should not be double-counted when viewing consolidated), day-weighted averaging for period balances, and multi-version coexistence. The developer was building for a real operational workflow: multiple budget versions, side-by-side comparison, drill-down to individual budget lines. This was not a minimum-viable feature — it was built for depth.

**Evidence in the code:**
- Completely separate index from actual data
- `withStatementIndexes()` — the virtual index wrapper
- Approved budget version designation
- Budget leaf index with consolidation deduplication
- Period-aware leaf index with day-weighted averages

---

### 7. The Rendering Engine

**The pain point it solves:** The board report must look professional. It must have consistent formatting. It must show the right level of detail (not too much, not too little). It must highlight important numbers without being garish. The treasury analyst currently spends 4 hours formatting Excel output for the board package.

**The design philosophy:** Reports should render correctly by default. The rendering engine applies the display rules (frozen lines, always-display, inline children, hide-when-child, non-significant row suppression) automatically. The board report is not a separate artifact from the interactive dashboard — it is the same data, the same calculations, with a print-optimized presentation.

The SVG chart generation is particularly telling. The developer chose to generate charts as inline SVG rather than using a charting library. This means: no external dependencies, full control over styling (charts use the bank's color palette), and charts render identically on screen and in print. The developer was willing to trade development effort (writing SVG path generation by hand) for deployment simplicity and visual consistency.

**What the code reveals about intent:** The display visibility system (frozen lines → always-display → base visible → hidden) is a deliberate hierarchy of importance. Not all statement lines are equal. The developer encoded a judgment about which lines are structurally essential, which are important enough to show by default, and which are detail-only. This judgment reflects understanding of how finance users consume reports — they need the major categories first, detail on demand.

**Evidence in the code:**
- `statementRenderableLines()` — visibility filtering
- Frozen lines with protected status — structural backbone
- Inline child pattern — detail without clutter
- SVG chart generation — no library dependency
- Print CSS — separate presentation for board output

---

### 8. The Hierarchy Editor

**The pain point it solves:** Adding a new branch to the organization hierarchy requires: (1) opening the shared Excel workbook, (2) finding the right sheet, (3) inserting a row in the correct parent section, (4) entering the correct key/parent/map values without breaking the tree structure, (5) saving, (6) hoping nobody else was editing it simultaneously. One wrong parent key and the branch disappears from all reports.

**The design philosophy:** Hierarchy editing should be visual and safe. The tree browser shows the structure — you can see where a new node will be inserted. The detail panel shows all properties of the selected node. Edits auto-save. The delete button warns about cascading deletions. Protected nodes cannot be accidentally destroyed. The developer understood that hierarchy editing is the most dangerous operation in the platform — a single mistake can break every report — and designed the editor to be forgiving.

**What the code reveals about intent:** The editor supports four modes (Organization, Account, Statement, Budget) — acknowledging that users need to edit different hierarchy types at different times. The virtual children (GL accounts under statement lines, budget lines under rollups) bridge the gap between the tree structure and the mapping data. The developer was building a tool that a finance user could use confidently without understanding the underlying data model.

**Evidence in the code:**
- Tree browser with expand/collapse, indent, search
- Detail panel with field-specific controls
- Auto-save on field change — no explicit "save" step needed
- Protected line blocking — safety constraints
- Virtual children — bridging hierarchy and mapping data

---

### 9. The Liquidity Projection Engine

**The pain point it solves:** The bank's ALCO committee asks: "If deposits run off at 2% per month and loan growth continues at 1%, where is our overnight cash position in 12 months?" The treasury analyst opens Excel, builds a waterfall model, and projects. It takes 4 hours. Next month, ALCO asks the same question with different assumptions. The analyst rebuilds the model.

**The design philosophy:** Forward-looking analysis should be parameterized, not rebuilt. The projection engine separates the projection logic (which is constant — the balance sheet roll-forward mathematics) from the assumptions (which change — growth rates, liquidity capacities, ratio thresholds). Users change assumptions in a grid. The engine recomputes instantly.

The particular design of the liquidity waterfall — sources and uses cascading from Beginning Overnight through Asset Activity, Liability Activity, Other Activity, and Earnings/Dividends to Ending Overnight — mirrors how a bank treasurer actually thinks about cash flows. Every movement of cash is categorized. The developer was encoding a financial analyst's mental model into code.

**What the code reveals about intent:** The startup actual-month lock (May 2026 data is not projected, it's actual) is deliberate. The developer understood that a projection must be anchored to reality. Projecting from a model-calculated starting point would compound errors. Starting from verified actual data establishes credibility — "the first month is real, the subsequent months are what-if."

**Evidence in the code:**
- `project()` — clean separation of model logic from assumptions
- Growth rate grid — assumptions as data, not code
- Actual month lock — credibility anchor
- Tiered liquidity sources — primary/secondary/tertiary reflects real availability timelines
- Ratio thresholds with 4-level classification — mirrors regulatory warning systems

---

### 10. The Validation & Diagnostics System

**The pain point it solves:** The CFO asks "Are these numbers right?" The treasury analyst says "I think so." The CFO is not reassured. The analyst cannot point to evidence that the data was loaded completely, that all accounts are mapped, that the balance sheet balances, and that the income statement reconciles to the GL.

**The design philosophy:** Trust must be earned, not assumed. Every data load produces a diagnostic trace. Every report includes reconciliation checks. Every unmapped account is counted and displayed. The platform does not just produce numbers — it produces evidence that the numbers are trustworthy.

The Balance Check (Assets = Liabilities + Capital, $1 tolerance) and Income Check (Yield Statement NI = GL Control NI) are particularly important. They appear at the bottom of every yield statement. They are printed on board reports. They are visible to regulators. The developer understood that these checks are not technical validation — they are *social proof*. A board member who sees "Balanced" at the bottom of a report trusts the numbers. A board member who sees "Out of balance" knows to question them.

**What the code reveals about intent:** The error banner that appears before any other code runs (lines 1-20) is telling. The developer's first priority was: if anything goes wrong, make it visible. A silent failure is worse than a visible error. The load test diagnostics panel is comprehensive — it shows source, file count, raw/normalized/skipped rows, dates, accounts, branches, missing columns, unmapped accounts. This is not a developer debugging tool. This is a *finance user self-service diagnostic*. The developer wanted finance users to be able to answer their own data quality questions.

**Evidence in the code:**
- Global error capture — lines 1-20, before any other logic
- Balance Check and Income Check — on every report, every view
- Load test diagnostics — comprehensive self-service
- Mapping completeness tracking — prominent counts
- Allocation audit with multi-level fallback and warning

---

### 11. The Persistence Architecture

**The pain point it solves:** The treasury analyst loads 50,000 rows of GL data. It takes 8 seconds to parse and index. The analyst checks a few numbers, closes the browser. Next morning, they open the dashboard again. It loads the data from the network share. Another 8 seconds. Every. Single. Time.

**The design philosophy:** Data that has been processed once should not need to be processed again. The IndexedDB cache stores the fully indexed dataset. Subsequent loads are instant. The File System Access API handles remember the folder location. The localStorage stores all configuration. The platform should feel like a native application — stateful, responsive, always ready — even though it's running in a browser.

The version-keyed schema migration is important. The developer knew that the data format would evolve. Rather than forcing users to manually clear their cache after an update, the platform detects version mismatches and auto-migrates or resets. This is the developer thinking ahead: "I will change this data structure in the future. How do I make that painless for users?"

**Evidence in the code:**
- IndexedDB with version keys
- File System Access API with persistent handles
- localStorage with version-keyed migration
- Fallback chain — cached → external → embedded

---

### 12. The Shared Services Vision (Unfinished)

**The pain point it solves (intended):** The Yield Statement and Liquidity Dashboard were built by the same team. They share the same hierarchy concepts (organization tree, account classification, GL code mapping). But they were built separately — the Yield Statement first, the Liquidity Dashboard later. They duplicate logic. A bug fixed in one module's hierarchy traversal is not automatically fixed in the other. A new mapping added in the Yield Statement is invisible to the Liquidity Dashboard.

**The design philosophy (intended):** The `shared/` directory was created with the intent of extracting common services. `hierarchy.js` is the first — it would contain the canonical hierarchy data and tree-walking functions. Both modules would import from it. This is the beginning of a platform architecture: shared engines consumed by module-specific dashboards.

**What the code reveals about intent:** The directory exists. The file exists. It is empty. This tells us: the developer recognized the duplication problem AND created the infrastructure to solve it BUT ran out of time before the extraction could be completed. The empty file is not an oversight — it is a bookmark. A note to the future: "This is where the shared hierarchy code goes. Extract it from yield-dashboard.js when you have time."

---

## The Inferred Product Vision

Piecing together every subsystem, every design decision, every unfinished piece, a coherent product vision emerges:

### Phase 1: Historical Reporting (Current — Yield Statement)

**Goal:** Replace the monthly Excel-based board reporting process with a validated, consistent, self-service platform.

**Key capabilities delivered:**
- Automated GL data ingestion and normalization
- Configurable reporting structure (hierarchy-driven, not hardcoded)
- Consistent calculation methodology (one engine, one answer)
- Self-service mapping and classification
- Board-ready printed output
- Built-in data validation

### Phase 2: Forward-Looking Analysis (In Progress — Liquidity Dashboard)

**Goal:** Add what-if projection capability. Move from "what happened?" to "what could happen?"

**Key capabilities delivered/planned:**
- Parameterized balance sheet projection
- Growth assumption modeling
- Liquidity ratio monitoring with early warning thresholds
- Scenario-based analysis (named scenarios with different assumptions)

### Phase 3: Full Treasury Platform (Planned — Budget, FTP, Allocations, etc.)

**Goal:** Build a complete treasury workstation. Every analysis that a community bank treasurer performs should be possible within the platform.

**Planned modules and their roles:**
- **Budget Planning:** Replace the Excel-based annual budgeting process. Link budget lines to statement lines. Enable versioning, reforecasting, and approval workflows.
- **FTP Engine:** Automate funds transfer pricing calculations. Replace the manual FTP spreadsheet that treasury analysts maintain.
- **Allocation Engine:** Automate cost allocation to branches. Replace the manual allocation workbook.
- **Journal Generator:** Close the loop — take the platform's analytical outputs (FTP charges, allocation entries, budget adjustments) and export them as journal entries for the core banking system.
- **Scenario Engine:** Formalize what-if analysis. Parameterized scenarios that can be applied across all modules (liquidity, yield statement projections, capital planning).
- **ALM:** Asset-liability management — interest rate risk measurement, gap analysis, earnings-at-risk.
- **Capital Planning:** Capital adequacy projections under various scenarios.
- **Executive Dashboard:** Consolidated view pulling from all modules.

### Phase 4: Platform (Future — Multi-Tenant SaaS)

**Goal:** Serve multiple banks from a single codebase. Each bank configures the platform to match its organizational structure, chart of accounts, reporting preferences, and calculation methodologies. The platform becomes a product, not a project.

### The Unifying Thread

Every subsystem serves the same purpose: **remove the treasury analyst from the role of data wrangler and put them in the role of financial analyst.**

The analyst should not be:
- Cleaning CSV files
- Fixing broken Excel formulas
- Manually formatting board reports
- Tracing discrepancies through 15 spreadsheet tabs
- Rebuilding projection models from scratch each month

The analyst should be:
- Interpreting trends
- Identifying anomalies
- Evaluating scenarios
- Presenting insights to management
- Making recommendations

The platform is not a report generator. It is a *decision support system*. Every design choice — the metadata-driven architecture, the validation-first philosophy, the self-service mapping engine, the parameterized projection engine, the one-click board report output — serves the goal of elevating the treasury analyst from data processor to financial advisor.

---

## What the Developer Would Say

If the retiring developer were briefing the incoming team, this is what they would say:

*"I built this for one bank. TexasBank. Every assumption in the code — the 500+ GL codes, the organization structure, the branch names, the file paths — is TexasBank-specific. That was the right call for version one. You can't build a platform for 'all banks' when you only know one bank's operations intimately.*

*"But I designed it to become a platform. The hierarchy engine is abstract — it doesn't care whether the bank is TexasBank or First National of Springfield. The calculation engine follows standard banking methodology. The mapping engine gives users control over classification. The shared services directory is empty, but it's there — that's where the platform extraction starts.*

*"My advice: extract before you extend. Before you build the Budget Planning module, extract the hierarchy engine into shared/. Before you build the Allocation Engine, extract the mapping engine. Otherwise you'll end up with five copies of the same tree-walking code in five different modules, and you'll never get them back in sync.*

*"And never, ever remove the Balance Check. That one row at the bottom of every yield statement has caught more data errors than every other validation combined. Finance users trust the platform because they can see, on every report, that Assets minus Liabilities equals Capital. Remove that, and you remove the trust."*

---

**End of Design Philosophy & Product Vision**
