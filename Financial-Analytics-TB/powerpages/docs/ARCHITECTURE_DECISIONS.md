# Architecture Decision Records

**Document:** Formal record of every major architectural decision embedded in this codebase.  
**Format:** [Michael Nygard ADR template](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)  
**Date Range:** Decisions span from initial build (late 2024) through current state (mid 2026)

---

## ADR-001: Metadata-Driven Architecture

**Status:** Accepted (implemented)  
**Date:** Initial platform build  
**Deciders:** Original platform architect

### Context

The platform must serve community banks with varying organizational structures, GL charts of accounts, reporting line hierarchies, and calculation preferences. A bank with 25 branches organized into 4 regions needs different report structures than a bank with 5 branches and no regional hierarchy. Hardcoding every bank's specific structure into the source code is not maintainable.

An alternative approach would be to build a report designer where each bank's finance team constructs reports from scratch. However, the target users are not report developers — they are treasury analysts who need consistent, standardized financial reports that match regulatory expectations.

### Decision

All report structure — organization hierarchy, account classification, statement line definitions, rollup relationships, mapping rules, display preferences — is governed by three metadata trees (`organizationNodes[]`, `accountNodes[]`, `statementNodes[]`) and associated configuration arrays (`momLines[]`, `referenceAccounts[]`, `rollupChildren{}`). Reports are generic — they consume the metadata to determine what to show, how to calculate it, and how to structure the output. No report layout is hardcoded; every table, every chart, every drill path is derived from metadata.

Additionally, a set of "frozen" core lines (29 statement labels) are protected from deletion and always visible, ensuring a minimum viable report structure regardless of user edits. Users can add to this structure but cannot destroy it.

### Consequences

**Positive:**
- A new bank can be onboarded by loading its hierarchy data — no code changes required
- Finance users can modify the reporting structure through the hierarchy editor without developer involvement
- The same calculation engine serves both the Yield Statement and Liquidity Dashboard (and future modules)
- Reports automatically adapt when the statement hierarchy is reorganized
- Standard banking report structure is guaranteed by the frozen line system

**Negative:**
- The metadata structures are complex and have a steep learning curve for new developers
- 11,660 lines of code are tightly coupled to the specific shape of these metadata arrays
- Two sources of truth exist for parent-child relationships: `rollupChildren{}` (hardcoded) and `statementNodes[].StatementParentKey` (dynamic from user edits). These must be kept consistent
- Adding a new statement line currently requires touching both `momLines[]` and sometimes `rollupChildren{}`
- The full metadata is loaded into memory at startup; very large hierarchies could impact performance

### Alternatives Considered

**Alternative 1: Hardcoded report templates per bank.** Each bank gets a customized build of the HTML/JS. Rejected because it does not scale — every bank deployment would be a fork of the codebase. Bug fixes and feature additions would need to be applied across all forks.

**Alternative 2: Database-backed metadata (server-side).** Store hierarchy data in a SQL database, load via API. Rejected for the initial iteration because the target deployment environment (Power Pages) does not provide server-side database access. This remains a viable future evolution path for the SaaS phase.

**Alternative 3: Report designer GUI.** Drag-and-drop report builder. Rejected because it overcomplicates a well-understood domain. Community banks expect standard yield statements, balance sheets, and income statements — not custom-designed reports. The frozen line system provides enough flexibility without the complexity of a full designer.

---

## ADR-002: Validation Before Reporting

**Status:** Accepted (implemented)  
**Date:** Initial platform build  
**Deciders:** Original platform architect

### Context

Financial reports distributed to boards, regulators, and ALCO committees must be trustworthy. A report that looks correct but contains silently corrupted data is worse than no report — it leads to bad decisions. The platform ingests data from external sources (core banking system exports, Excel workbooks, network file shares) where data quality cannot be guaranteed.

Finance users should not need to be data engineers. They should not need to inspect raw CSV files, count rows, or manually verify that allocations ran. The platform must make data quality issues VISIBLE and UNAVOIDABLE.

### Decision

Every data load triggers a comprehensive validation pass. Validation results are surfaced in the UI at three levels: (1) a permanent load test diagnostics panel showing source, file count, raw/normalized/skipped row counts, date coverage, account coverage, branch coverage, missing columns, and unmapped accounts; (2) mapping completeness counts displayed prominently in the Mapping Review panel; (3) Balance Check and Income Check reconciliation rows rendered at the bottom of every yield statement view.

Validation is NOT optional. The Balance Check (Assets − Liabilities & Capital, tolerance $1) and Income Check (Yield Statement Net Income − GL Control Net Income) appear on every yield statement report — including printed/PDF output. A board member reading a printed report can see whether the balance sheet balanced.

Additionally, allocation rows are audited on every render. If the most recent month has zero allocation rows but prior months had activity, a warning is displayed. This catches the common operational error of connecting to the wrong input files folder.

### Consequences

**Positive:**
- Data quality issues cannot be hidden — they appear on printed board reports
- Finance users can self-diagnose most data problems without developer assistance
- The load test panel provides immediate feedback when a new file is uploaded ("48,231 rows loaded, 12 skipped, 3 accounts unmapped")
- The fallback chain (IndexedDB cache → external folder → embedded sample) ensures data is always available
- Prevents the platform from silently producing wrong numbers

**Negative:**
- Validation adds startup latency — every data load must scan all rows
- The load test panel adds UI complexity; some finance users may ignore it
- False positives are possible (e.g., a legitimate zero-allocation month might trigger the warning)
- Validation results are ephemeral — they are recomputed on every render but not persisted for historical comparison

### Alternatives Considered

**Alternative 1: Trust the data source.** Assume GL extracts are always correct. Rejected because operational reality contradicts this assumption — GL files arrive late, with missing columns, from wrong folders, with corrupted rows. Trust-but-verify is essential.

**Alternative 2: Separate validation dashboard.** A standalone data quality tool. Rejected because validation results need to be visible in context — a board member reading a printed yield statement should see the Balance Check on the same page, not need to cross-reference a separate tool.

**Alternative 3: Block reports when validation fails.** Refuse to render if balance sheet doesn't balance. Rejected because in practice, small imbalances ($1–$100) are common due to rounding and do not invalidate the report's usefulness. The tolerance approach ($1 threshold) balances rigor with practicality.

---

## ADR-003: Quick GL Mapping System

**Status:** Accepted (implemented)  
**Date:** Initial platform build  
**Deciders:** Original platform architect

### Context

The platform auto-classifies GL accounts into statement rollups based on GL code ranges (Assets 100000–199999, Income 300000–399999, etc.). This automatic classification is a starting point — it gets ~80% of accounts into the right ballpark but fails for accounts that don't follow the standard scheme. For example:

- GL 202125 (Correspondent Money Market) is in the 200000 range (Liabilities) but needs to roll up to "Correspondent Money Market" specifically, not the generic "Deposits" category
- GL 501220 (Gain on Sale of Assets) is in the 500000 range (Non-Interest Income) but needs to roll up to "Gain on Sale of MTG Assets" for mortgage banking P&L
- Some accounts are memo/suspense accounts that should be excluded entirely

Finance users need the ability to override automatic classification on a per-account basis. These overrides must persist across sessions and be shareable across dashboard copies (via the shared hierarchy workbook).

### Decision

A Quick GL Mapping is a user-saved record linking a 6-digit GL account code to a statement rollup label with a mapping type (auto, balance, incexp, ftp, allocation, ignore). Mappings are stored in localStorage (`quickGlMappings[]`) and synced to the shared hierarchy workbook. A mapping with type `ignore` completely excludes the account from all calculations.

Mappings take priority over automatic classification. The calculation engine consults quick mappings FIRST, then falls back to account dimension leaves (from the account tree), then to GL range-based classification. This means a single mapping overrides all other classification mechanisms.

Mappings are also synced into the account hierarchy tree via `syncMappedAccountsToAccountHierarchy()`. When a new mapping is saved for an account that has no account tree node, a node is automatically created. This ensures the hierarchy editor shows a complete picture.

### Consequences

**Positive:**
- Finance users have complete control over GL account classification without code changes
- Mappings are immediately visible — the mapping review panel shows exactly which accounts are unmapped
- The `ignore` type provides an explicit "reviewed and excluded" designation (vs. silently unmapped)
- Mappings can be imported/exported as CSV for bulk management
- Syncing to the account hierarchy keeps the tree editor consistent

**Negative:**
- Mappings are a separate concept from account hierarchy nodes — one GL account can be "mapped" in two places (mapping system + account tree node), requiring reconciliation via `enforceSingleStatementRollupAssignments()`
- Audit-forced corrections in `normalizeKnownHierarchyMappings()` can silently override user mappings — this is powerful but opaque
- Mapping type semantics (auto vs. balance vs. incexp) are subtle and may confuse new finance users
- Mappings are stored in localStorage, which has a ~5MB limit per origin

### Alternatives Considered

**Alternative 1: Purely automatic classification.** No user overrides. Rejected because GL charts of accounts vary across core banking systems and automatic classification is never 100% accurate.

**Alternative 2: Excel-based mapping only.** All mappings maintained in the shared workbook. Rejected because requiring Excel for every mapping change adds friction — the inline mapping review panel is faster for one-off corrections.

**Alternative 3: AI/ML-based classification.** Train a model to classify GL accounts based on account name patterns. Rejected because: (a) the classification is deterministic (every GL account has exactly one correct rollup), (b) the training data doesn't exist (each bank's chart of accounts is unique), (c) finance users need to trust the classification — a "95% confidence" label is unacceptable for financial reporting.

---

## ADR-004: Shared Hierarchy Workbook (Excel as Canonical Source)

**Status:** Accepted (implemented)  
**Date:** Initial platform build  
**Deciders:** Original platform architect

### Context

The platform's metadata (organization tree, account tree, statement tree, GL mappings, budget mappings, custom calculations, display defaults) must be shared across multiple dashboard copies. A finance team might have the Yield Statement Dashboard deployed to 10+ users, all of whom need to see the same reporting structure. Additionally, the metadata must survive browser cache clears, new deployments, and dashboard rebuilds.

The metadata must be editable by non-developers. Finance users need to be able to add a new branch, reorganize a statement category, or correct a GL mapping without involving IT.

### Decision

The canonical source of all metadata is an Excel workbook named `Dashboard Hierarchies.xlsx`, stored on a shared network drive. The workbook contains multiple sheets — one for each hierarchy type (Organization, Account, Statement) plus sheets for Quick GL Mappings, Budget Line Mappings, Custom Statement Calculations, and Display Defaults.

The dashboard reads the workbook on startup (if a settings folder is connected) and loads the hierarchy data. User edits made in the dashboard's Hierarchy Editor are saved to localStorage for immediate use AND can be written back to the shared workbook via an explicit "Save to shared workbook" button. This two-tier persistence (localStorage for speed, Excel for sharing) balances responsiveness with data sharing.

The File System Access API provides persistent folder handles, so the workbook path only needs to be configured once per user.

### Consequences

**Positive:**
- Single source of truth for all hierarchy data across all dashboard copies
- Finance users can edit hierarchies using Excel (familiar tool) OR the Hierarchy Editor (convenient in-browser tool)
- Workbooks can be version-controlled (e.g., saved to SharePoint with version history)
- No database or server infrastructure required
- Hierarchy data survives dashboard rebuilds (the embedded defaults are overridden by the workbook)

**Negative:**
- Excel as a database has well-known limitations: no concurrent edit protection, no schema enforcement, manual conflict resolution
- Two users editing the workbook simultaneously can overwrite each other's changes
- The File System Access API is only supported in Chromium-based browsers
- The workbook schema is fragile — a mistyped column header or extra sheet can break loading
- Saving from browser to Excel requires the XLSX.js library (lazy-loaded, adds page weight)

### Alternatives Considered

**Alternative 1: Central database.** Store hierarchy in SQL Server, access via API. Rejected because the initial deployment target (Power Pages) cannot host custom APIs. This becomes viable in the SaaS phase.

**Alternative 2: localStorage only.** No shared source. Rejected because each user would have their own divergent copy of the hierarchy. A mapping added by one user would be invisible to others.

**Alternative 3: JSON file on network share.** Use a `.json` file instead of `.xlsx`. Rejected because finance users cannot easily edit JSON (syntax errors, encoding issues) but are comfortable with Excel. The platform serves finance users, not developers.

---

## ADR-005: Iterative GL Validation

**Status:** Accepted (implemented)  
**Date:** Initial platform build  
**Deciders:** Original platform architect

### Context

The platform processes general ledger data from the bank's core system. This data contains three categories of accounts: (1) leaf transaction accounts that represent actual financial activity, (2) subtotal/control accounts that are the core system's own consolidation output, and (3) informational accounts that should not appear in any report. Loading all accounts naively would produce incorrect results — subtotal accounts would double-count leaf accounts, and informational accounts would pollute the reporting structure.

Additionally, bank core systems use different conventions for subtotal codes. Some use `xx9999` (e.g., 105999 = Total Loans), some use `xx999` (e.g., 203989 = Total Time Deposits), and some use unpredictable codes. A one-size-fits-all exclusion rule would miss some subtotals or incorrectly exclude real accounts.

### Decision

The platform uses a multi-layered approach to GL account validation:

**Layer 1 — Explicit Subtotals Exclusion:** A hardcoded Set of 138 known subtotal/control account codes (`ignoredSubtotalAccounts`) that are excluded from all calculations. This Set is comprehensive for TexasBank's specific core system but must be configurable for other banks.

**Layer 2 — Subtotal Code Expansion:** When the calculation engine encounters a GL code, it checks if the code is a known subtotal. If so, it expands the code to its leaf descendants via `lowestMappedDescendantCodes()`, walking the account hierarchy tree to find all leaf GL codes under that subtotal. This means `dateValues(date, [105999], 'Ending Balance')` doesn't return the value of the subtotal account 105999 — it returns the sum of all individual loan account codes.

**Layer 3 — Mapping Completeness Tracking:** After every data load, the platform counts unmapped accounts (active GL codes with balances but no rollup assignment) and displays the count prominently. This ensures that newly added GL accounts are not silently excluded.

**Layer 4 — Balance/Income Checks:** The Balance Check (Assets − Liabilities & Capital) and Income Check (Yield Statement NI − GL Control NI) provide end-to-end validation that the entire calculation chain produced consistent results.

### Consequences

**Positive:**
- Double-counting from subtotal accounts is prevented automatically
- Newly added GL accounts are flagged for mapping review
- The balance check catches any systemic data issue before reports are distributed
- The layered approach catches problems at multiple stages (ingestion, classification, calculation)

**Negative:**
- The 138-code Set is TexasBank-specific — deploying to a new bank requires updating this list
- Subtotal code expansion adds complexity to every data lookup
- If a legitimate account is accidentally added to the subtotal exclusion Set, its balances silently vanish from reports
- The layered approach means an error might be caught at layer 4 (balance check) even though it could have been prevented at layer 1 (subtotal exclusion) — debugging requires tracing through all layers

### Alternatives Considered

**Alternative 1: Pattern-based subtotal detection.** Use regex patterns (e.g., all codes matching `\d{4}99`) instead of an explicit list. Rejected because some legitimate leaf accounts match these patterns (e.g., 101015 "VAULT CASH" matches no pattern but 105100 "Total Commercial Bank" matches `\d{4}00`). A hybrid approach (patterns + explicit overrides) is planned for the multi-tenant phase.

**Alternative 2: Trust the core system's data structure.** Load only leaf accounts and assume the core system provides clean data. Rejected because core system extracts are inconsistent — different departments run different reports with different filtering. The platform must be defensive.

**Alternative 3: Require manual data cleansing before upload.** Finance users clean the GL extract before loading. Rejected because it adds a manual step that will be skipped under time pressure, leading to wrong reports.

---

## ADR-006: Virtual Index for Budget Data

**Status:** Accepted (implemented)  
**Date:** Budget module integration  
**Deciders:** Original platform architect

### Context

The platform needs to compare actual financial results against budget projections. Budget data comes from a completely different source (budgeting workbooks in XLSX format) than actual GL data (core system CSV exports). Budget data has a different structure — it is organized by budget line name and version, not by GL account code. Budget lines must be mapped to statement rollups before they can be compared.

The platform must support multiple budget versions (original budget, Q1 reforecast, Q2 reforecast) and allow comparison between any two versions or between a version and actuals.

### Decision

Budget data is stored in a completely separate index system (`budgetIndexCache` and `budgetLeafIndex`) from the actual GL data indexes (`valueIndex`, `branchValueIndex`, `rollupValueIndex`). When the Budget tab is active, the calculation engine is temporarily redirected to use the budget index via `withStatementIndexes()`. This is a **virtual index** pattern — the same `lineMeasure()` function runs against either actual data or budget data depending on which index is active.

Budget data is NEVER merged into the main data arrays. It lives in a parallel universe and is queried only when explicitly requested.

### Consequences

**Positive:**
- Clear data provenance — actuals and budget are never confused or mixed
- The calculation engine needs no modification to support budget data — it's the same `lineMeasure()` code with a different data source
- Multiple budget versions can coexist without conflict
- Budget data can be loaded, indexed, and cached independently of actual data loading

**Negative:**
- Two indexing systems to maintain (actual GL and budget)
- The `withStatementIndexes()` wrapper adds a layer of indirection that can be confusing to debug
- Budget leaf indexes require complex consolidation-aware deduplication logic (a budget row marked "All" branch should not be double-counted when viewing consolidated)
- Budget period calculations (QTD, YTD) require their own day-weighting logic separate from actual period calculations

### Alternatives Considered

**Alternative 1: Merge budget data into main rows array.** Add a `source` field distinguishing actual from budget. Rejected because: (a) the main indexing system assumes one value per date/view/account — budget data for the same date would collide, (b) budget data uses budget line keys, not GL account codes, (c) the indexing key space would need to be extended with a version dimension.

**Alternative 2: Separate budget calculation engine.** Build a parallel `budgetLineMeasure()` that operates on budget data independently. Rejected because it duplicates ~1,200 lines of calculation logic. The virtual index approach achieves the same result with zero code duplication.

**Alternative 3: Pre-compute budget comparisons at data load time.** Rejected because users can change budget version selection at runtime — recomputing on selection is more responsive than precomputing for every possible version pair.

---

## ADR-007: Self-Contained Dashboard Build

**Status:** Accepted (implemented)  
**Date:** Initial platform build  
**Deciders:** Original platform architect

### Context

The dashboard must be deployable as a single HTML file to Microsoft Power Pages, which hosts static content and does not support server-side processing. Users must be able to open the dashboard and see data immediately, without configuring folders, uploading files, or waiting for data loads. The initial experience must demonstrate the platform's value before asking users to configure complex data connections.

Additionally, the platform must remain functional when the bank's network file shares are unavailable (VPN down, server maintenance, remote work scenarios).

### Decision

At build time, a representative dataset is embedded directly into the HTML file. For the Yield Statement, this is a gzip-base64 encoded CSV containing ~18 months of GL trial balance data. For the Liquidity Dashboard, this is a JSON object containing hierarchy data, GL balances, contractual cashflows, and reference output.

At runtime, the dashboard first attempts to load fresher data from IndexedDB cache or external folders. If those sources are unavailable, it falls back to the embedded data. This ensures the dashboard always renders something — it will never show a blank page.

The embedded data also serves as a self-contained demonstration: a new user can open the dashboard and immediately explore reports without any configuration.

### Consequences

**Positive:**
- Zero-configuration first experience — open the file, see the reports
- Works offline — no network dependency for basic functionality
- Survives data source failures gracefully
- Serves as a self-contained demo/proof-of-concept

**Negative:**
- The embedded data bloats the HTML file (~250KB+ for the Yield Statement)
- Embedded data becomes stale — the numbers are from the build date, not the current month
- Confidential financial data is embedded in a distributable HTML file — security concern
- The embedded data must be manually updated by rebuilding the dashboard
- Adding the embedded data as a build step is not documented in the repository

### Alternatives Considered

**Alternative 1: No embedded data — require folder connection on first use.** Rejected because it creates a poor first experience. A finance user opening the dashboard for the first time would see "Connect a folder to see data" — they cannot evaluate the platform before going through IT to set up folder access.

**Alternative 2: Embedded synthetic/anonymized data.** Use realistic-but-fake numbers. Rejected because users need to see their institution's actual data to evaluate the platform. Synthetic data raises questions: "Are these real numbers? If not, why are they here?"

**Alternative 3: Server-rendered initial state.** Pre-render the dashboard on a server and serve the HTML. Rejected because Power Pages does not support server-side rendering.

---

## ADR-008: Client-Side Calculation Engine

**Status:** Accepted (implemented)  
**Date:** Initial platform build  
**Deciders:** Original platform architect

### Context

All financial calculations — yield/rate computation, balance rollup, income aggregation, budget-to-actual comparison, liquidity projection — execute entirely in the user's browser. There is no server-side calculation. The deployment target (Microsoft Power Pages) serves static HTML/CSS/JS and cannot host computation APIs.

This means the platform must perform acceptably on a finance user's laptop, processing 50,000+ GL rows, computing 145+ statement line measures across multiple dates, and rendering tables and SVG charts — all in JavaScript.

### Decision

All calculations are client-side JavaScript. The calculation engine uses heavily indexed data structures (Maps keyed by date/view/account) to achieve O(1) lookup for the most common operations. Computed measures are cached in `measureCache` and `periodMeasureCache` to avoid redundant recalculation when the same line/date/branch combination is referenced multiple times during a single render.

The platform makes no network requests for calculations. The only network activity is reading data files from the filesystem (File System Access API) and loading the XLSX.js library on demand.

### Consequences

**Positive:**
- No server infrastructure required — the platform runs entirely on the client
- Calculations are instant once data is indexed (no network latency)
- The platform works offline after initial data load
- No sensitive financial data leaves the user's browser
- No server scaling concerns — each user's browser does its own computation

**Negative:**
- Performance is bounded by the user's hardware — a slow laptop means slow calculations
- Very large datasets (100K+ rows, 10+ years of history) may exceed browser memory limits
- JavaScript floating-point arithmetic requires careful handling (the platform compares to $0.005 tolerance rather than exact zero)
- The calculation engine is tightly coupled to the in-memory data structures — it cannot be easily extracted to a server-side implementation

### Alternatives Considered

**Alternative 1: Server-side calculation with API.** A Node.js/Python backend computing measures and serving them as JSON. Rejected because Power Pages cannot host server-side code. This becomes viable in the SaaS phase.

**Alternative 2: WebAssembly for performance-critical paths.** Compile calculation-intensive code to WASM. Rejected as premature optimization — the current indexed-Map approach performs adequately for datasets up to 100K rows. This could be revisited if a bank with very large data volumes is onboarded.

**Alternative 3: Pre-compute all measures at data load time.** Compute every line × date × branch combination when data is loaded. Rejected because the number of combinations is unbounded (users can select any org node, any rollup, any date range). Lazy computation with caching is more memory-efficient.

---

## ADR-009: Dual Balance/Income Code Resolution

**Status:** Accepted (implemented)  
**Date:** Initial platform build  
**Deciders:** Original platform architect

### Context

When computing a statement line's balance or income, the platform must determine which GL accounts contribute. Two sources of information exist: (1) the hardcoded `bal[]` and `inc[]` arrays on each `momLines[]` entry, and (2) user-saved Quick GL Mappings that assign GL accounts to statement rollups. These sources can overlap, conflict, or be incomplete.

The hardcoded arrays represent the platform developer's understanding of the bank's chart of accounts. The user mappings represent the finance team's corrections and additions. Neither is a complete, authoritative source — both must be consulted.

### Decision

Statement line code resolution follows a cascading strategy:

1. **Explicit hardcoded codes** (`line.bal[]` and `line.inc[]`) — the base set of GL codes defined in the source code
2. **Quick-mapped codes** — GL codes that users have explicitly mapped to this statement line's rollup label via the mapping system
3. **Account dimension leaves** — GL codes assigned to this rollup via the account hierarchy tree's `StatementRollup` field
4. **Supplemental codes** — hardcoded additional codes for specific categories (securities supplemental codes, cash supplemental codes, etc.)
5. **Subtotal expansion** — if any of the above codes is a subtotal (e.g., 105999), expand to its leaf descendants

The final set of codes is the union of all resolution paths, deduplicated. The order of resolution does not imply priority — all paths contribute codes. The only priority rule is: quick mappings with type `ignore` exclude the account regardless of what other sources say.

Additionally, for rollup lines (`rollupBal: true`), the child categories' balances are summed rather than direct GL code resolution. The `quickMappedCodesForLine()` function provides an additional source of codes that supplement the child rollup.

### Consequences

**Positive:**
- No single source of truth failure — if hardcoded codes miss an account, user mappings cover it; if user mappings are missing, hardcoded codes provide a baseline
- User corrections are additive (they add to the baseline) unless explicitly marked `ignore`
- The platform works with partial configuration — some codes hardcoded, some mapped, some auto-classified
- Different resolution paths serve different use cases: hardcoded codes are fast (no mapping lookup), mapped codes are flexible (user-correctable)

**Negative:**
- Debugging "why is this account included?" requires checking 5 resolution paths
- If a hardcoded code and a user mapping assign different rollups to the same account, reconciliation is needed (handled by `enforceSingleStatementRollupAssignments()`)
- The cascading resolution is implicit in the code — there is no single function that returns "these are all the codes and why each one was included"
- Developers adding a new statement line must populate `bal[]` and `inc[]` arrays — if they forget, the line silently shows zeros

### Alternatives Considered

**Alternative 1: Pure mapping-based resolution.** Eliminate hardcoded `bal[]` and `inc[]` arrays. All code resolution goes through the mapping system. Rejected because: (a) mapping 500+ GL accounts is a significant setup burden for new deployments, (b) hardcoded codes provide a working baseline out of the box.

**Alternative 2: Pure hardcoded resolution.** Eliminate user mappings. Rejected because the chart of accounts changes over time (new loan products, new deposit types) and the platform must adapt without code changes.

**Alternative 3: Single unified resolution function.** Replace the 5-path cascade with a single function that queries one canonical source. Rejected because the canonical source doesn't exist yet — this is the target state for the shared hierarchy engine refactoring.

---

## ADR-010: Tree-Based Organization Filtering

**Status:** Accepted (implemented)  
**Date:** Initial platform build  
**Deciders:** Original platform architect

### Context

The bank has 12+ physical branches organized into a 5-level hierarchy (Holding Company → Bank → Division → Region → County → Branch). Finance users need to filter reports by any level: consolidated (all branches), by division, by region, by county, or by individual branch. Additionally, unmapped branch numbers (branches that exist in the GL data but not in the organization hierarchy) must be visible and selectable.

The filtering must be efficient — branch resolution must happen in O(depth) time, not O(n) scanning of all GL rows.

### Decision

Organization filtering uses tree descent. When a user selects an org node (e.g., "Central Texas", key 91), the platform walks the organization tree downward from that node, collecting all `Map` values from descendant leaf nodes. This produces a Set of branch numbers: `{1, 2, 3, 4, 10, 5, 6, 7, 9}`.

Data queries then filter by checking whether a row's branch number is in this Set. The branchValueIndex provides O(1) lookup per branch when a filter is active — `dateValues()` iterates the branch Set and queries `branchValueIndex.get(key)` for each branch.

The organization picker UI renders this tree as a searchable, expandable popover. Users can select any level — not just leaf branches but also parent nodes that represent regions or divisions. Selecting a parent node automatically resolves to all descendant branches.

### Consequences

**Positive:**
- Users navigate by organizational names ("Central Texas"), not branch numbers ("branches 1,2,3,4,5...")
- Branch resolution is automatic — selecting a region immediately filters to the correct branches
- Adding a new branch to the organization hierarchy automatically includes it in parent-level filters
- The same tree structure serves both the filter UI and the branch resolution logic
- Unmapped branches appear as a separate section in the picker, making data gaps visible

**Negative:**
- The tree must be complete — if a branch exists in the GL data but not in the hierarchy, it's invisible in organizational views (shown only via the unmapped section)
- Tree descent is recursive and must guard against circular references (the `visited` Set prevents infinite loops)
- Performance degrades with very deep trees (5+ levels) and many branches (100+), though this is not a practical concern for community banks
- Changes to the organization hierarchy affect which branches appear in filtered reports — a mistake in the hierarchy causes silent data omissions

### Alternatives Considered

**Alternative 1: Flat branch list with text search.** Users search for branch by name or number. Rejected because it doesn't support hierarchical selection ("show me all of Central Texas") and doesn't reflect the bank's actual management structure.

**Alternative 2: Pre-computed branch-to-parent mapping.** At data load time, compute a mapping from every branch number to every ancestor org key. Rejected because it's memory-inefficient for deep trees and must be recomputed whenever the hierarchy changes.

**Alternative 3: Separate dimension table for branches.** A standalone list of branches with region/division attributes, unrelated to the organization tree. Rejected because it duplicates hierarchy information and creates consistency problems.

---

## ADR-011: localStorage as Primary Configuration Store

**Status:** Accepted (implemented)  
**Date:** Initial platform build  
**Deciders:** Original platform architect

### Context

User configuration — brand settings, hierarchy edits, quick GL mappings, budget line mappings, display preferences, folder connections, and custom calculations — must persist across browser sessions. The platform cannot depend on a server-side database. Configuration must survive browser restarts, dashboard redeployments, and cache clears (to the extent possible given browser storage limitations).

### Decision

All user configuration is stored in the browser's localStorage with version-keyed schemas. Each category of configuration gets its own key:

- `dashboardBrandSettings` — bank name, logo, color palette
- `yieldDashboardHierarchyEditsV2` — full hierarchy snapshot
- `quickGlMappings` — GL account → rollup mappings
- `budgetLineMappings` — budget line → rollup mappings
- `customStatementCalculations` — user-defined formulas
- `momAlwaysDisplay` / `momDisplayDefault` — display preferences
- `yieldDashboardRepositoryFolder` — data folder connection
- `yieldDashboardBudgetFolder` — budget folder connection
- `liquidityDashboardRunoffAssumptions` — liquidity growth rates and capacities

Large datasets (processed GL rows, budget rows, detail report cache) are stored in IndexedDB, which offers significantly larger storage quotas (typically 50MB+ vs. 5MB for localStorage).

Configuration values are JSON-serialized. Schema migrations are handled by version keys — when a new platform version changes a data structure, the version key is incremented and old data is either migrated or reset.

### Consequences

**Positive:**
- Zero server infrastructure for configuration storage
- Configuration survives browser restarts and dashboard redeployments
- Simple to implement (native browser APIs, no libraries)
- Isolated per-browser — different users on different machines have independent configurations
- Version keys provide a migration path for schema changes

**Negative:**
- localStorage has a ~5MB limit — large mapping sets or hierarchy snapshots could approach this limit (not currently a practical concern)
- localStorage is synchronous — large reads/writes block the main thread (mitigated by keeping individual values small)
- Configuration is per-browser, not per-user — if two users share a machine (e.g., terminal server), they share configuration
- Clearing browser data wipes all user configuration with no recovery mechanism
- IndexedDB quota can be exceeded silently in some browsers
- No backup/restore mechanism built into the platform

### Alternatives Considered

**Alternative 1: Server-side configuration database.** Rejected for the initial deployment (no server available). This becomes viable in the SaaS phase.

**Alternative 2: Configuration in the shared workbook only.** All settings stored in Dashboard Hierarchies.xlsx, loaded on each startup. Rejected because: (a) loading from Excel is slow, (b) requires folder connection to be configured first (chicken-and-egg problem for folder path settings), (c) doesn't support per-user preferences (every user sees the same display defaults).

**Alternative 3: URL hash parameters.** Encode configuration in the URL. Rejected because URL length limits (~2000 characters) are too restrictive for the volume of configuration data.

---

## ADR-012: Embedded Fallback Data

**Status:** Accepted (implemented)  
**Date:** Initial platform build  
**Deciders:** Original platform architect

### Context

The dashboard must render something on first open — a blank page with "connect a folder" is a poor user experience. A new user (or a user whose IndexedDB cache has been cleared) needs to see a working dashboard immediately to evaluate the platform.

Additionally, the platform must be demonstrable without access to the bank's network file shares. Sales demonstrations, training sessions, and conference presentations require a self-contained working dashboard.

### Decision

A representative dataset is embedded in the HTML as a compressed `<script>` tag. For the Yield Statement, this is `<script id="embeddedCsv" data-encoding="gzip-base64">` containing a gzip-compressed, base64-encoded CSV string. At startup, if no fresher data source is available, this embedded data is decoded, decompressed, parsed, and loaded as the active dataset.

The embedded dataset covers ~18 months of GL data with enough accounts, branches, and transaction volumes to exercise all calculation paths and produce realistic-looking reports.

### Consequences

**Positive:**
- The dashboard always renders — zero-configuration first experience
- Works entirely offline — no network dependency
- Self-contained demo — one HTML file can be emailed or hosted anywhere
- Provides a known-good dataset for testing and development

**Negative:**
- Bloat — the embedded data adds ~250KB to the HTML file
- Staleness — the data is from the build date, not current
- Security — confidential bank financial data (even if historical) is embedded in a distributable file
- Maintenance — must be manually updated when the bank's data structure changes
- The embedded data is TexasBank-specific — deploying to a new bank requires replacing it

### Alternatives Considered

**Alternative 1: No embedded data.** Dashboard starts empty, prompts user to connect a folder. Rejected because the first experience must demonstrate value before asking for configuration.

**Alternative 2: Synthetic/anonymized embedded data.** Use randomized but realistic-looking numbers. Rejected because users seeing unfamiliar numbers may question whether the platform works correctly with real data.

**Alternative 3: Remote-hosted sample data.** Load from a CDN or API. Rejected because it adds a network dependency and the platform is designed to work offline.

---

## ADR-013: Day Count Convention System

**Status:** Accepted (implemented)  
**Date:** Initial platform build  
**Deciders:** Original platform architect

### Context

Annualizing a monthly income figure to an annual rate requires knowing how many days of accrual the income represents. Different financial instruments use different conventions:
- Mortgage-backed securities: 30/360 (assume 30-day months, 360-day years)
- FHLB stock: 90/360 (quarterly dividends — 90 days of accrual)
- Money market instruments: ACT/360 (actual days, 360-day year)
- Most other instruments: Actual/365 (actual days, 365-day year)

Using the wrong convention produces a rate that disagrees with the trading desk, the bond accounting system, and regulatory reports. The convention assignment must be correct and auditable.

### Decision

Day count conventions are assigned per statement line through a three-tier system:

1. **Explicit line flag:** The `dayCount` property on a `momLines[]` entry (e.g., `dayCount: '30/360'`)
2. **Statement node Annualization field:** The `Annualization` property on a `statementNodes[]` entry (user-editable in the hierarchy editor)
3. **Hardcoded lookup table:** A `fixed` Map in `normalizeAnnualization()` that maps statement label keys to conventions

Tier 1 takes priority over tier 2, which takes priority over tier 3. If no tier provides a convention, the default is `Actual/365`.

The hardcoded table maps specific labels to specific conventions (e.g., `'securities'` → `'30/360'`, `'fhlb stock'` → `'90/360'`, `'earning assets'` → `'Weighted'`). The `Weighted` convention signals that the rate should be computed as a weighted average of child rates rather than using a scalar annualization factor.

For period calculations (QTD, YTD), the period annualization factor is derived from the convention and the total days in the period: `periodAnnualizationFactor = conventionBase / totalDays`.

### Consequences

**Positive:**
- Rates match the bank's trading systems, bond accounting, and regulatory reports
- Conventions are auditable — each line's convention is visible in the hierarchy editor
- Users can override conventions for specific lines via the statement node editor
- The Weighted convention correctly handles parent lines that aggregate instruments with different conventions

**Negative:**
- The hardcoded lookup table is TexasBank-specific — a bank with different instrument types might need different assignments
- A misconfigured convention produces a wrong rate with no warning — there's no validation that "Securities" should use 30/360
- The three-tier resolution can be confusing: which tier assigned the convention for a given line?
- New statement lines added by users default to Actual/365, which may be wrong for their instrument type

### Alternatives Considered

**Alternative 1: Instrument-type-based convention.** Derive convention from GL account type (e.g., all accounts in the 104xxx range = securities = 30/360). Rejected because a single statement line can contain mixed instrument types, and the convention should be assigned at the reporting line level, not the GL account level.

**Alternative 2: Convention embedded in GL data.** The core system provides a convention code per account. Rejected because most core banking systems don't export this information in trial balance extracts.

**Alternative 3: Uniform Actual/365 for everything.** Rejected because it would produce rates that disagree with every other system in the bank.

---

## ADR-014: Frozen Statement Line System

**Status:** Accepted (implemented)  
**Date:** Initial platform build  
**Deciders:** Original platform architect

### Context

The yield statement is a standardized financial report. Its structure — assets flowing to earning assets, liabilities flowing to funding costs, netting to net interest income, through non-interest items to net income — is expected by regulators, examiners, ALCO committees, and boards. If a user could accidentally delete "Net Interest Income" from the statement hierarchy, board reports would be structurally invalid.

The platform must allow users to customize the statement structure (add new categories, reorder lines, change groupings) while guaranteeing that the core structure remains intact. This is the "configurable but safe" pattern.

### Decision

29 statement lines are designated as "frozen" — they are always visible in every yield statement view, cannot be collapsed or hidden by display settings, and cannot be deleted from the hierarchy. These 29 lines form the skeletal structure of the report. An additional 8 lines can be toggled between frozen and unfrozen by finance users.

Frozen lines are protected at multiple levels:
- The Hierarchy Editor disables the delete button and name/parent fields for frozen lines
- The Display Settings system cannot uncheck frozen lines
- The statement rendering engine always includes frozen lines regardless of display preferences
- `isProtectedStatementLabel()` and `isFrozenStatementLabel()` guard all access paths

The frozen line list is defined in `embeddedFrozenStatementDefaults[]` and enforced during `initializeStatementNodes()`. When a frozen line exists in the defaults but not in the active statement hierarchy, it is created automatically.

### Consequences

**Positive:**
- The yield statement always has a valid structure — guaranteed
- Board reports are structurally reliable — no missing critical lines
- Users can customize within safe boundaries — add non-frozen children to frozen parents
- New frozen lines can be added by updating the defaults array

**Negative:**
- The 29-line frozen set is TexasBank's chosen report structure — other banks may want different core lines
- Users cannot reorganize the fundamental report structure (e.g., move "Gross Loans" above "Earning Assets") — this may frustrate power users
- The frozen line list is hardcoded — changing it requires a code update
- Eight "editable frozen" lines create a confusing middle ground — they're frozen by default but unfreezable

### Alternatives Considered

**Alternative 1: No frozen lines — fully user-configurable structure.** Rejected because it allows structural errors that produce invalid reports. Financial reporting software must be opinionated about minimum structure.

**Alternative 2: All lines frozen — no user customization.** Rejected because different banks have different product lines and reporting categories. The platform must be flexible within a safe framework.

**Alternative 3: Role-based editing (admin vs. user).** Only administrators can edit the statement structure. Rejected because the platform currently has no user authentication system. All users have equal access.

---

## ADR-015: Measure Caching Strategy

**Status:** Accepted (implemented)  
**Date:** Implemented progressively as performance demands grew  
**Deciders:** Original platform architect

### Context

Rendering a yield statement requires computing `lineMeasure()` for ~70 visible statement lines × up to 3 date columns (current, prior, variance transformations) = 210+ measure calculations. Each measure calculation involves multiple Map lookups, child recursions, and potential custom formula evaluations. Without caching, rendering a single tab would repeat many of these expensive calculations (the same line appears in multiple contexts — as a top-level row, as a child in a drill-down, and potentially in the Balance Check).

### Decision

The platform uses an aggressive caching strategy with clear invalidation rules:

**`measureCache`** — Single-month measure cache. Keyed by `line.label|date|branchKey|balanceView`. Populated lazily by `lineMeasure()`. Invalidated entirely (`.clear()`) on filter change, branch selection change, or display settings change.

**`periodMeasureCache`** — Period measure cache. Same pattern but keyed by concatenated dates.

**`measureCache` shares across tabs** — When the user switches from MoM to QoQ tab, the QoQ tab's `periodLineMeasure()` calls may benefit from `measureCache` entries created during MoM rendering (same line, same date), though `periodMeasureCache` is cleared on each `renderQoqStatement()` call.

**Cache validation** — The cache is trusted until invalidated. There is no TTL or staleness check. This is valid because the underlying data (GL rows) only changes when the user explicitly refreshes data, which triggers a full cache clear.

### Consequences

**Positive:**
- Significant performance improvement — recalculating a measure that's already cached is O(1) vs. O(dozens of lookups)
- Transparent to consumers — `lineMeasure()` checks the cache internally; callers don't need to know about caching
- Simple invalidation — clear everything on filter change, no partial invalidation complexity

**Negative:**
- Aggressive clearing means every filter change triggers full recalculation of all visible lines
- No cache warming — the first render after a filter change is always the slowest
- Cache key construction is string-concatenation — fragile (a change in key format would cause cache misses)
- No cache size management — the cache can grow large during drill-down exploration (each expanded child creates new entries)
- The cache is per-render, not cross-session — closing the browser loses all cached measures

### Alternatives Considered

**Alternative 1: Pre-compute all measures at data load time.** Compute every line × date × branch combination upfront. Rejected because: (a) the number of combinations is large (145 lines × 18 dates × 20+ branch combinations), (b) most combinations are never viewed, (c) recomputation on mapping change would be very expensive.

**Alternative 2: Partial cache invalidation.** Only clear cache entries affected by a specific filter change. Rejected because the complexity of tracking which entries depend on which filters outweighs the performance benefit — clearing everything is simpler and the recalculation time is acceptable.

**Alternative 3: Web Worker for calculation.** Offload calculation to a background thread. Rejected because the calculation engine is tightly coupled to the DOM (reads filter values, uses string keys from the rendering context). Decoupling would be a significant architectural change.

---

## ADR-016: Custom Formula Engine

**Status:** Accepted (implemented)  
**Date:** Added after initial build (custom statement formulas feature)  
**Deciders:** Original platform architect

### Context

Some statement lines cannot be calculated by simple GL code aggregation or child rollup. For example:
- Earning Assets is NOT the sum of all asset GL codes — it's Gross Loans + Total Investments − Total Securities MTM (a specific formula)
- Net Income (consolidated) = Pre-Provision Net Revenue − Provision for Loan Losses
- Net Income (branch) = Net Income Before Allocations − Total Allocations

These formulas exist as hardcoded special cases in `lineMeasure()`. However, finance users may need to define additional formulas for bank-specific reporting lines. The hardcoded approach doesn't scale.

### Decision

The platform includes a restricted formula evaluation engine that allows users to define custom calculations in the Hierarchy Editor. Formulas use a bracket-reference syntax:

```
[Line A] + [Line B] - [Line C]
ABS([Line D])
WEIGHTED_CHILDREN()
```

The evaluator is intentionally restricted:

1. **Only `[Label]` references allowed** — Each bracket reference is resolved by calling `lineMeasure(label)` for the appropriate measure (Balance, Income, or Rate)
2. **Only three functions allowed:** `abs()`, `max()`, `min()` — no arbitrary function calls
3. **Only arithmetic operators:** `+`, `-`, `*`, `/`, `(`, `)`
4. **No property access, no global scope, no `eval()`** — The formula is parsed into a safe expression using `Function('abs','max','min', ...)` with explicit parameter binding
5. **Circular reference guard** — `customFormulaEvaluationStack` tracks which formulas are currently being evaluated; if a cycle is detected, returns 0 rather than recursing infinitely

Formulas can be defined independently for Balance, Income, and Rate measures. A line can have a custom formula for its balance but use standard calculation for income. Additionally, branch-specific formulas can be defined (`BranchFormula`) that override the standard formula when viewing a single branch.

### Consequences

**Positive:**
- Finance users can define new reporting lines without code changes
- The bracket-reference syntax is intuitive for Excel users
- The restricted evaluator prevents code injection while enabling flexible calculations
- Branch-specific formulas support the common pattern where consolidated and branch-level measures differ
- `WEIGHTED_CHILDREN()` handles the common rollup rate calculation without requiring a manual formula

**Negative:**
- The formula syntax has no error reporting — a typo in a bracket reference silently returns 0
- Formula evaluation is recursive (references to other lines may trigger their formulas), which can be slow for complex dependency chains
- The evaluator cannot handle conditional logic (IF/ELSE), aggregation functions (SUM of children), or lookup functions
- Formula results are not validated against expected ranges — a formula producing absurdly large numbers would go undetected
- The `customFormulaEvaluationStack` is a global Set — concurrent formula evaluations from different render paths could interfere

### Alternatives Considered

**Alternative 1: No custom formulas — all logic hardcoded.** This was the initial state. Rejected because it required code changes for every new reporting line and was identified as a blocker for multi-bank deployment.

**Alternative 2: Full JavaScript expressions.** Allow arbitrary JS in formulas. Rejected because: (a) it's a security risk (code injection), (b) finance users don't write JavaScript, (c) debugging user-written JS in a financial report is unacceptable.

**Alternative 3: Visual formula builder.** Drag-and-drop interface for building formulas. Rejected as over-engineered for the current user base. A text-based formula with bracket references is familiar to Excel users and simpler to implement.

---

## ADR Decision Cross-Reference

| ADR | Depends On | Enables |
|---|---|---|
| 001: Metadata-Driven | — | 003, 004, 005, 009, 014 |
| 002: Validation First | 001, 005 | Reliable reporting |
| 003: Quick GL Mapping | 001, 009 | User configuration |
| 004: Shared Workbook | 001 | Multi-user collaboration |
| 005: Iterative GL Validation | 001, 003 | Trustworthy data |
| 006: Virtual Budget Index | 001, 009 | Budget comparison |
| 007: Self-Contained Build | — | Offline/offline-first |
| 008: Client-Side Calc | 001 | No server dependency |
| 009: Dual Code Resolution | 001, 003 | Flexible line definitions |
| 010: Tree-Based Filtering | 001 | Intuitive org filtering |
| 011: localStorage Config | — | Persistence without server |
| 012: Embedded Fallback | 007 | Zero-config first run |
| 013: Day Count Conventions | 001 | Accurate rates |
| 014: Frozen Statement Lines | 001 | Safe user customization |
| 015: Measure Caching | 008 | Acceptable performance |
| 016: Custom Formula Engine | 001, 008 | User-defined calculations |

---

## Status Legend

- **Accepted:** Decision has been implemented and is in active use
- **Proposed:** Decision is under consideration but not yet implemented (none in this document)
- **Superseded:** Decision has been replaced by a later ADR (none in this document)
- **Deprecated:** Decision is still in effect but planned for replacement (ADR-007 partially — embedded data planned for removal in Phase 6 of multi-tenant migration)

---

**End of Architecture Decision Records**
