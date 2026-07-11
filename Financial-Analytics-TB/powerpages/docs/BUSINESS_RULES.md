# Financial Analytics Platform — Business Rules Catalog

**Audience:** Incoming treasury developers, business analysts, and finance stakeholders.  
**Purpose:** Document every business rule embedded in the code — what treasury problem it solves, what breaks if removed, who depends on it.  
**This document contains zero JavaScript.** Every rule is explained in treasury terms.

---

## Table of Contents

1. [Data Acceptance Rules](#1-data-acceptance-rules)
2. [General Ledger Classification Rules](#2-general-ledger-classification-rules)
3. [Organization Hierarchy Rules](#3-organization-hierarchy-rules)
4. [Account Hierarchy Rules](#4-account-hierarchy-rules)
5. [Statement Hierarchy Rules](#5-statement-hierarchy-rules)
6. [Rate Calculation Rules](#6-rate-calculation-rules)
7. [Income & Balance Calculation Rules](#7-income--balance-calculation-rules)
8. [Composite Metric Rules](#8-composite-metric-rules)
9. [Net Interest Margin Rules](#9-net-interest-margin-rules)
10. [Profitability Metric Rules](#10-profitability-metric-rules)
11. [Mapping & Classification Override Rules](#11-mapping--classification-override-rules)
12. [Budget Comparison Rules](#12-budget-comparison-rules)
13. [Branch Consolidation Rules](#13-branch-consolidation-rules)
14. [Cost Allocation Rules](#14-cost-allocation-rules)
15. [Funds Transfer Pricing Rules](#15-funds-transfer-pricing-rules)
16. [Display & Visibility Rules](#16-display--visibility-rules)
17. [Balance & Income Reconciliation Rules](#17-balance--income-reconciliation-rules)
18. [Liquidity Projection Rules](#18-liquidity-projection-rules)
19. [Liquidity Ratio Rules](#19-liquidity-ratio-rules)
20. [Data Validation & Audit Rules](#20-data-validation--audit-rules)

---

## 1. Data Acceptance Rules

### Rule 1.1 — GL Trial Balance Row Completeness

**Rule:** Every row in a general ledger extract must have a valid date, an account code (or recognized rollup label), a balance view type, and a finite numeric amount. Any row missing any of these is discarded from the dataset.

**What treasury problem does it solve?** Core banking system extracts frequently contain header rows, subtotal lines, blank rows, and corrupted data. Including these would produce garbage calculations. This rule ensures only clean, calculable data enters the platform.

**What would happen if removed?** Subtotal rows and header text would be parsed as numeric data, producing wildly incorrect balances. Missing dates would cause rows to be excluded from all period-specific views without warning. The dashboard would silently report wrong numbers.

**Who depends on it?** Every calculation, every report, every chart, every export — every number displayed anywhere on the platform.

---

### Rule 1.2 — Income Account Ending Balance Exclusion

**Rule:** GL accounts with codes 300000 and above carry income/expense activity. When these accounts appear with the view "Ending Balance," they are excluded from the dataset because income accounts reset to zero each fiscal year — their "ending balance" at any month-end is meaningless as a balance sheet concept. Only their IncExp (monthly activity) view is meaningful.

**What treasury problem does it solve?** A bank's income statement accounts are flow accounts — they measure activity over a period, not a point-in-time balance. Including the cumulative year-to-date balance of an income account as if it were an asset would double-count prior months' activity and inflate balance sheet totals.

**What would happen if removed?** Total Assets on the yield statement would include millions of dollars of income activity. The balance sheet would not balance. The Balance Check reconciliation would fail by massive amounts. Every rate calculation using average balances would be distorted.

**Who depends on it?** The balance sheet reports, rate calculations, the Balance Check, all reports that display balance amounts.

---

### Rule 1.3 — Data Source Fallback Chain

**Rule:** At startup, the platform attempts to load data in this order: (1) IndexedDB cached processed data from a previous session, (2) live external data folder on the network file share, (3) embedded sample CSV baked into the HTML at build time. If a source fails or returns stale data, the next source is tried. The platform is guaranteed to load something — it will never show a blank dashboard.

**What treasury problem does it solve?** Finance users must always have access to the last-known-good data, even when the network file share is unavailable, the VPN is down, or the browser's local cache has been cleared. An empty dashboard during a board meeting or regulatory exam is unacceptable.

**What would happen if removed?** Any network interruption would produce a blank dashboard. Users on laptops disconnected from the bank's network would have no data. The platform would be unreliable for time-sensitive analysis.

**Who depends on it?** Every user who opens the dashboard. Financial controllers. Board meeting presenters. ALCO (Asset-Liability Committee) members.

---

## 2. General Ledger Classification Rules

### Rule 2.1 — GL Range Classification

**Rule:** Every GL account is classified into a broad category purely from its numeric range:

| GL Range | Classification |
|---|---|
| 100000–199999 | Assets |
| 200000–209999 | Liabilities or Deposits (if name contains "DEPOSIT") |
| 209000–299999 | Capital |
| 300000–399999 | Interest Income |
| 400000–499999 | Interest Expense |
| 500000–599999 | Non-Interest Income |
| 600000–699999 | Operating Expense (or Net Income if name contains "NET INCOME") |
| Other | Unclassified |

**What treasury problem does it solve?** A community bank has 500+ GL accounts. Manually classifying every account would be error-prone and require constant updates as new accounts are added by the core system. The numeric range convention is standard in U.S. banking (following the FFIEC Call Report structure) — this rule leverages an existing industry convention.

**What would happen if removed?** Every new GL account would appear as "Unclassified" with no rollup. The mapping review panel would become unmanageable. Finance users would have to manually classify every single account before any report could be produced.

**Who depends on it?** The Mapping Engine (as the default mapping when no explicit mapping exists), the Mapping Review panel (for "detected as" displays), all account detail views.

---

### Rule 2.2 — Subtotals and Control Accounts Exclusion

**Rule:** 138 specific GL account codes are designated as "ignored subtotal accounts." These include every `xx9999` total account, every `xxxx99` subtotal account, and numerous other consolidation-level control accounts. These 138 codes are excluded from all balance and income calculations because they are the output of the core banking system's own consolidation logic — not leaf-level transaction accounts. Including them would double-count or triple-count amounts.

The excluded accounts span: cash totals (101999), due from totals (102999), loan subtotals (105100, 105199, 105209, 105499, 105599, 105999), deposit subtotals (201999, 202999, 203989, 203999, 204999), total asset (199999) and total liability (299999), income subtotals (301999, 302999, 303999, 399989, 399999), expense subtotals (400999, 499999, 599999, 604999, 699999), and numerous other consolidation codes.

**What treasury problem does it solve?** The core banking system's general ledger follows a hierarchical chart of accounts where parent accounts contain the sum of their children. Loading all accounts naively would mean that "Total Loans" appears both from the GL subtotal account (105999) AND from the sum of individual loan accounts (105040 + 105050 + 105070 + ...). This would double the loan balance.

**What would happen if removed?** Every balance on every report would be approximately double the actual amount. Loan totals, deposit totals, income, and expenses would all be inflated. The balance sheet would appear to show a bank twice its actual size. All regulatory ratios would be meaningless.

**Who depends on it?** Every single balance and income calculation. Every report. Every chart. Every rate.

---

## 3. Organization Hierarchy Rules

### Rule 3.1 — Holding Company as Ultimate Root

**Rule:** The organization tree must have exactly one root node: "Holding Company" at key 900, with no parent (parent key 0). If this node is missing, it is created automatically. If it exists but has a different parent, it is forcibly reparented to root. If it exists at a different key, key 900 is used.

**What treasury problem does it solve?** A bank holding company is the ultimate consolidating entity for regulatory reporting (FR Y-9C, Call Report). All subsidiaries, divisions, regions, and branches must roll up into a single consolidation point. Without this, consolidated financial statements would be ambiguous — which entity is at the top?

**What would happen if removed?** If no root existed, applying an organization filter at the top level would return no branches. Consolidated reports would be empty. The org picker would have no top-level selection.

**Who depends on it?** The org picker. Consolidated report views. Any analysis at the holding company level. Regulatory reporting exports.

---

### Rule 3.2 — Required Organizational Entities

**Rule:** Three specific organizational entities must always exist in the hierarchy:
- **TexasBank** (key 999, under Holding Company) — the primary bank entity
- **Big Country** (key 1001, under Central Texas or TexasBank) — a regional grouping
- **Project Eagle** (key 1002, under Big Country, with Map "12") — a specific branch
If any are missing at startup, they are created with the correct parentage.

**What treasury problem does it solve?** These entities exist in the bank's actual legal and operational structure. TexasBank is the FDIC-insured depository institution. Big Country and Project Eagle represent recent acquisitions or expansion markets. If they don't exist in the hierarchy, GL data for branch 12 cannot be assigned to any organizational unit, and that branch's activity becomes invisible in branch-filtered reports.

**What would happen if removed?** Branch 12 would appear as "unmapped" in the mapping review panel. Reports filtered to Big Country would be empty. Performance metrics for Project Eagle would be missing from regional comparisons.

**Who depends on it?** Branch-level P&L reporting for Big Country region. The organization mapping review. Any report filtered to branch 12.

---

### Rule 3.3 — Parent Nodes Cannot Carry Branch Maps

**Rule:** An organization node that has children (i.e., is a parent in the hierarchy) cannot have a Map value (a branch number). When `clearOrganizationRollupMaps()` is called, all parent nodes' Map fields are erased.

**What treasury problem does it solve?** A branch Map assigns a specific branch's GL data to a hierarchy node. If a parent node (e.g., "Central Texas") had a Map value, it would claim ownership of that branch's data directly, AND its children would also claim ownership via their own Maps. Every rollup would double-count the parent's mapped branch. The hierarchy represents organizational containment, not direct data ownership — only physical branches get Map values.

**What would happen if removed?** Selecting "Central Texas" in the org picker would sum all descendant branch data PLUS the parent's mapped branch data. That branch would be counted twice. Every rollup report for any organizational level would have incorrect totals.

**Who depends on it?** The `descendantOrgMaps()` function (used by branch filtering). All org-level rollup calculations. The organization picker. Branch-level P&L reporting.

---

### Rule 3.4 — Vestigial Node Removal

**Rule:** Any organization node named "no branch" is automatically deleted from the hierarchy at startup.

**What treasury problem does it solve?** During early implementation, a placeholder node named "no branch" was used as a catch-all for unmapped data. This is a legacy artifact from development. Keeping it would allow data to be incorrectly assigned to a non-existent organizational unit.

**What would happen if removed?** Unchanged — the platform works correctly with or without this rule, but it's a cleanliness enforcement.

**Who depends on it?** The org hierarchy editor. Data integrity during startup.

---

### Rule 3.5 — Orphan Reparenting

**Rule:** Any organization node that has no valid parent (its parent key doesn't match any existing node's key) but does have children or a branch Map is automatically reparented to the Holding Company.

**What treasury problem does it solve?** When the shared hierarchy workbook is edited externally (e.g., a parent node is deleted in Excel without reassigning its children), orphaned nodes can appear. These nodes still control real branch data but are invisible in the org tree — their branch data would be unreachable. Reparenting them to Holding Company ensures no branch data is lost.

**What would happen if removed?** Orphaned nodes would be invisible in the org picker. Their branch data would never appear in any branch-filtered view. Financial data for those branches would silently vanish from all reports.

**Who depends on it?** Any branch whose organizational parent was deleted. Branch-level reporting completeness. The org picker tree structure.

---

## 4. Account Hierarchy Rules

### Rule 4.1 — Redundant Corporate Structure Node Removal

**Rule:** The account hierarchy node named "Total Liabilities & Equity" is deleted from the account tree at startup. This node is a redundant default from the shared workbook that duplicates the "Total Liabilities and Capital" concept in the statement hierarchy.

**What treasury problem does it solve?** The accounting identity is: Assets = Liabilities + Equity (or Capital). Having two nodes representing the same concept ("Total Liabilities & Equity" and "Total Liabilities and Capital") creates confusion about which one is authoritative. One must be canonical.

**What would happen if removed?** Both nodes would coexist. Leaf GL accounts could be assigned to either one. The statement line "Total Liabilities and Capital" might miss accounts that were assigned to "Total Liabilities & Equity." The Balance Check could show a false imbalance.

**Who depends on it?** The balance sheet rollup structure. The Balance Check reconciliation. Account dimension resolution for the Total Liabilities and Capital line.

---

### Rule 4.2 — Mapping Type Constraints

**Rule:** Each account hierarchy node has a MappingType that constrains how its assigned GL account contributes to calculations:

| Mapping Type | Contributes to Balance? | Contributes to Income? | Special Behavior |
|---|---|---|---|
| `auto` | Yes (if GL < 300000) | Yes (if GL ≥ 300000) | Default — range-based |
| `balance` | Yes | No | Balance sheet accounts only |
| `incexp` | No | Yes | Income/expense only |
| `ftp` | No | Yes | Funds transfer pricing |
| `allocation` | No | Yes | Branch cost allocation |
| `ignore` | No | No | Completely excluded |
| `rollup` | No | No | Parent node — not a mapped leaf |

**What treasury problem does it solve?** Not every GL account is a simple asset or income account. FTP accounts represent internal transfer pricing credits/charges — they don't carry a meaningful balance. Allocation accounts represent distributed overhead — they only matter for branch-level P&L, not consolidated reporting. Some accounts are informational and should be excluded entirely. The mapping type gives finance users precise control over how each account behaves.

**What would happen if removed?** All accounts would default to `auto`, meaning every account with code < 300000 would contribute to balance calculations and every account ≥ 300000 would contribute to income. FTP accounts would inflate consolidated balance sheets. Allocation accounts would appear in consolidated views (incorrect — they should net to zero at consolidated level). Informational accounts would corrupt calculations.

**Who depends on it?** `quickMappingAppliesToBalance()` and `quickMappingAppliesToIncome()` (used by every code resolution). The consolidated vs. branch-level view split. Balance sheet accuracy.

---

## 5. Statement Hierarchy Rules

### Rule 5.1 — Frozen (Core) Statement Lines

**Rule:** 29 statement lines are designated as "frozen" — they are always visible in every yield statement view, cannot be collapsed, and cannot be deleted from the hierarchy. These lines form the skeletal structure of the yield statement:

```
Short Term Investments, Total Investments, Total Commercial Bank, 
Total Mortgage Bank Loans, Earning Assets, Gross Loans, Net Loans, 
Non Earning Assets, Total Assets, Demand Deposits, 
Total Interest Bearing Deposits, Total Deposits, 
Total Funding Liabilities, Total Liabilities, Total Capital, 
Total Liabilities and Capital, Net Interest Income/ Spread, 
Funds Transfer Pricing, NII after FTP, Monthly NIM*, 
Non Interest Income, Non Interest Expense, 
Pre Provision Net Revenue, Provision for Loan Losses, 
Net Income Before Allocations, Total Allocations, Net Income, 
Return on Avg Assets, Return on Avg Equity
```

Additionally, 8 more lines can be frozen/unfrozen by finance users: `Total Commercial Bank`, `Total Mortgage Bank Loans`, `Demand Deposits`, `Retail Interest Bearing Deposits`, `High Wealth Money Market`, `Wholesale Funding`, `Total Interest Bearing Deposits`, `Borrowings`.

**What treasury problem does it solve?** The yield statement is a standardized financial report format. Its structure — assets flowing down to net interest income, then through non-interest items to net income — is used by regulators, examiners, ALCO committees, and boards. If a user could accidentally delete "Net Interest Income," the entire report structure collapses. Frozen lines guarantee the report always has a valid skeleton regardless of user edits.

**What would happen if removed?** A user deleting "Total Assets" in the hierarchy editor would cause every asset rollup to break. The Balance Check would fail. Reports would be missing critical lines. Board-ready reports would be structurally invalid.

**Who depends on it?** The statement rendering engine. The Balance Check. Every yield statement view (MoM, QoQ, YTD). Board reports. Regulatory submissions.

---

### Rule 5.2 — Statement Line Child Rollup

**Rule:** Statement lines marked with `rollupBal: true` compute their balance by summing the balances of their child lines in the statement hierarchy, not by directly aggregating GL accounts. Statement lines marked with `rollupInc: true` do the same for income.

**What treasury problem does it solve?** In treasury reporting, parent lines in the yield statement represent subtotals that aggregate their children. "Total Commercial Bank" equals Commercial Loans + Consumer Loans + CRE Loans + 1-4 Family Investment Loans + Tax Exempt Loans — it is not independently calculated from its own set of GL codes. The rollup ensures the parent is mathematically consistent with its children.

**What would happen if removed?** A parent line might show a different value than the sum of its children, because it would use a potentially different set of GL codes. The yield statement would have internal inconsistencies — a subtotal wouldn't equal the sum of its detail lines. This would be flagged in any audit review and would destroy trust in the reports.

**Who depends on it?** All parent/section lines in the yield statement. Finance users who expand/collapse statement sections. Auditors who verify subtotal integrity.

---

### Rule 5.3 — Statement Node Hierarchy Validation

**Rule:** At startup, the statement hierarchy is validated and rebuilt. Every statement line from the defined list (`momLines[]`) is cross-referenced with the statement hierarchy (`statementNodes[]`). Lines that exist in the hierarchy but are missing from the hardcoded line definitions are created as "synthetic" rollup lines. This ensures the user's hierarchy edits (adding new statement categories) are reflected in reports without requiring code changes.

**What treasury problem does it solve?** Finance users may need to add new reporting categories (e.g., a new loan product line) to the yield statement. If these only existed in the hierarchy and not in the code, they would be invisible. Auto-generating synthetic lines means user-added hierarchy nodes appear on reports automatically.

**What would happen if removed?** Any statement line added by a finance user in the hierarchy editor would not appear in any report. The hierarchy editor would become useless — users could create categories that never show up in outputs.

**Who depends on it?** Finance users who modify the statement hierarchy. The statement rendering engine. Report completeness.

---

## 6. Rate Calculation Rules

### Rule 6.1 — Rate Derivation from Average Balance

**Rule:** A statement line's yield or cost rate is calculated as:

```
Rate = |Income or Expense| / |Average Balance| × Annualization Factor
```

The rate is ALWAYS derived from average balance, never from ending balance. If the average balance is zero or not available, the rate is blank (displayed as "n/a"), not zero.

**What treasury problem does it solve?** Rates measure return or cost over time. Using ending balance would be misleading — an account might have a large balance on the last day of the month but very low average balance throughout. The rate would appear artificially low. Average balance is the standard for all bank performance measurement (UBPR, Call Report, internal reporting).

**What would happen if removed?** Rates would fluctuate wildly based on month-end balance swings. A single large transaction on the last day of the month could dramatically change the reported rate. Comparisons between months would be meaningless. Regulatory reporting would deviate from Call Report methodology.

**Who depends on it?** Every rate displayed anywhere on the platform. The NIM calculation. ALCO reporting. Regulatory submissions. Board presentations.

---

### Rule 6.2 — Day Count Convention Assignment

**Rule:** Different financial instruments use different day count conventions to annualize monthly income:

| Convention | Formula | Applied To |
|---|---|---|
| **30/360** | Rate = Income × 12 / AvgBal | Securities, mortgages, borrowings |
| **90/360** | Rate = Income × 4 / AvgBal | FHLB stock (quarterly dividend instrument) |
| **ACT/360** | Rate = Income × 360 / AvgBal / DaysInMonth | Money market instruments |
| **Actual/365** | Rate = Income × 365 / AvgBal / DaysInMonth | Most other instruments (default) |
| **Weighted** | Σ(ChildRate × ChildAvgBal) / ΣChildAvgBal | Parent lines that aggregate multiple instruments |

The convention is determined by: (1) explicit `dayCount` on the line definition, (2) the statement node's `Annualization` field, (3) a hardcoded lookup table mapping statement labels to conventions, (4) defaulting to Actual/365.

**What treasury problem does it solve?** Different bond markets use different accrual conventions. A 30-year mortgage-backed security uses 30/360 (assuming 30-day months, 360-day years). A money market instrument uses ACT/360 (actual days, 360-day years). A commercial loan uses Actual/365. If every instrument used the same convention, rates would be inconsistent with market quotes, trade confirmations, and Bloomberg pricing. The yield statement would disagree with the bond accounting system.

**What would happen if removed?** Every rate would use Actual/365. Securities rates would disagree with the ASC 320 investment portfolio reports. FHLB dividends would be understated (treated as monthly instead of quarterly). The board would question why the reported securities yield differs from the broker statement.

**Who depends on it?** Rate calculations for securities, mortgages, FHLB stock, borrowings. Regulatory Call Report Schedule RI (income) consistency. Board ALCO package. Investment portfolio reporting.

---

### Rule 6.3 — Weighted Average Rate for Parent Lines

**Rule:** When a statement line is a parent (has children in the statement hierarchy), its rate is calculated as the weighted average of its children's rates, weighted by each child's average balance. This uses the formula:

```
Weighted Rate = Σ(ChildRate × ChildAvgBalance) / Σ(ChildAvgBalance)
```

If a child has no calculable rate, its weight is still included but its rate contribution is zero.

**What treasury problem does it solve?** "Total Loans" should not have a single rate calculated from total loan income / total loan average balance. That would give equal weight to a $10M commercial loan at 5.50% and a $100M mortgage portfolio at 4.00% — the blend would be mathematically correct but conceptually misleading because it would treat an aggregate as if it were a single homogeneous instrument. The weighted average approach preserves the economics: each category contributes to the blended rate in proportion to its size.

**What would happen if removed?** The "Total Loans" rate would be calculated as SimpleSum(Income) / SimpleSum(Balance). This produces the same number mathematically but loses the ability to decompose the rate into its components. Attribution analysis (how much of the rate change came from mix shift vs. pure rate change) would be impossible.

**Who depends on it?** The yield statement rate columns for all rollup lines. Attribution analysis. ALCO reporting on loan portfolio yield trends.

---

### Rule 6.4 — Rates Suppressed for Non-Earning Lines

**Rule:** Statement lines marked `noRate: true` never display a rate. This applies to: Cash & Cash Items, Accrued Interest Receivable, Premises & Equipment, Prepaid Assets, Other Real Estate Owned, Other Assets, Goodwill, MSR, Total Mortgage Other Assets, Non-Accrual Loans, Loan Loss Reserve, Demand Deposits, Accrued Interest Payable, Other Accrued Liabilities, Other Liabilities, Capital Stock, Capital Surplus, AOCI, Retained Earnings, Total Securities MTM, Loan DPAA, Loan Control, Overdrafts.

Additionally, lines marked with `spread`, `nim`, `roa`, or `roe` have their own specialized rate calculations and the standard rate formula does not apply.

**What treasury problem does it solve?** Not every balance sheet line earns or pays interest. Cash in the vault earns zero. Premises and equipment are non-earning assets. Demand deposit accounts pay no interest (by regulation for commercial DDA). Displaying a rate of 0.00% for these would imply they earn interest but at a low rate — misleading. A blank rate field correctly indicates "this line does not participate in the interest spread."

**What would happen if removed?** Every balance sheet line would show 0.00% rate. The report would be cluttered with meaningless zeroes. Users would wonder why the bank's buildings earn 0.00%. The visual distinction between earning and non-earning lines would be lost.

**Who depends on it?** The yield statement rate columns. Board report clarity. ALCO focus on earning asset yields and funding costs.

---

## 7. Income & Balance Calculation Rules

### Rule 7.1 — Dual Income Resolution Strategy

**Rule:** A statement line's income can come from two sources: explicit GL income codes defined on the line (`inc: [300010, 300011, ...]`) OR the sum of the line's children's income (when `rollupInc: true`). The platform uses whichever produces a non-zero result, preferring the children's sum when it's available. This dual strategy handles two use cases:

1. **Lines with their own income codes:** When income GL accounts directly map to a statement line (e.g., "Commercial Loans" income comes from GL 300010, 300011, 300020, 300090)
2. **Pure rollup lines:** When a parent line has no income GL accounts of its own and is simply the sum of its children (e.g., "Total Commercial Bank" = sum of Commercial Loans + Consumer Loans + CRE Loans income)

**What treasury problem does it solve?** In the GL, income is captured at the detailed account level. "Total Loan Income" doesn't exist as a single GL account — it's the sum of income from every loan category. The dual strategy allows parent lines to aggregate correctly even though no GL code captures their specific income directly.

**What would happen if removed?** Pure rollup lines (those without `inc` codes) would show zero income. The yield statement would show income only at the leaf level, with all rollup lines showing blanks. The report would be fragmentary and unusable for board presentations.

**Who depends on it?** Every yield statement report. Income rollup integrity.

---

### Rule 7.2 — Income as Absolute Value

**Rule:** For spread-related calculations (Net Interest Income, Pre-Provision Net Revenue), income and expense amounts are treated as absolute values — the sign convention in the GL (positive for income, negative for expense, or vice versa depending on the core system) is normalized by taking the absolute value. Net Interest Income = |Earning Assets Income| - |Funding Liabilities Expense|.

**What treasury problem does it solve?** Different core banking systems use different sign conventions. Some post interest income as positive and interest expense as negative. Others post both as positive but in different account ranges. Still others post expense as positive. The absolute value normalization makes the platform independent of the core system's sign convention.

**What would happen if removed?** The platform would only work correctly with one specific core banking system's sign convention. Deploying at a bank with a different core system would produce nonsensical NII (could show positive + positive instead of positive - positive). Cross-bank standardization would be impossible.

**Who depends on it?** Net Interest Income, NII after FTP, Pre-Provision Net Revenue, and Net Income calculations.

---

### Rule 7.3 — Average Balance Day-Weighting (Period)

**Rule:** When calculating average balances over multiple months (quarter, year-to-date), each month's average balance is weighted by the number of days in that month:

```
Period Average = Σ(MonthAvg × DaysInMonth) / Σ(DaysInMonth)
```

This ensures that a 31-day month (January) contributes proportionally more to the period average than a 28-day month (February).

**What treasury problem does it solve?** Simple averaging (sum of monthly averages / number of months) would give equal weight to a 28-day month and a 31-day month. Over a quarter, January (31 days) represents 34% of the quarter's time but would only get 33% weight in a simple average. Over many periods, this bias accumulates. Day-weighting is the regulatory standard (Call Report, UBPR).

**What would happen if removed?** Period average balances would have a small but systematic bias. Quarterly and annual yields would deviate from regulatory Call Report calculations. An examiner reviewing the bank's UBPR against the internal dashboard would find discrepancies.

**Who depends on it?** Quarterly and YTD rate calculations. Regulatory reporting consistency. Call Report Schedule RC-K (quarterly averages) reconciliation.

---

### Rule 7.4 — Ending Balance for Periods

**Rule:** For period calculations (QTD, YTD), the "balance" reported is the ending balance of the LAST month in the period, not the average balance across the period. This is consistent with how balance sheets are presented — a balance sheet is always "as of" a specific date.

**What treasury problem does it solve?** A balance sheet reports point-in-time positions. "Total Loans as of June 30" is meaningful. "Average Total Loans across Q2" is a different concept (used for rate calculations, not for the balance column).

**What would happen if removed?** The balance column on quarterly and YTD reports would show averages, not ending balances. Quarter-end balance sheet comparisons would be impossible. The reported loan portfolio size would differ from the bank's general ledger trial balance at quarter-end.

**Who depends on it?** The balance column on QTD and YTD yield statements. Balance sheet trend analysis. Board reporting on balance sheet growth.

---

## 8. Composite Metric Rules

### Rule 8.1 — Earning Assets Composition

**Rule:** Earning Assets = Gross Loans + Total Investments − Total Securities MTM

This is NOT the sum of all asset GL codes. It's a specific formula that:
- Includes all loans (through Gross Loans)
- Includes all investments (Short Term Investments + Securities + FHLB Stock)
- Excludes the mark-to-market adjustment on securities (Total Securities MTM is a valuation adjustment, not a real asset)

**What treasury problem does it solve?** Earning Assets is a regulatory and analytical concept: "What assets are actively generating interest income?" It excludes non-earning assets (cash, buildings, goodwill). It also excludes the securities MTM adjustment because that's an unrealized gain/loss on the available-for-sale portfolio — it changes the balance sheet value of securities but does not generate cash income.

**What would happen if removed?** If derived naively from GL codes, Earning Assets would either (a) include non-earning assets (overstating the base) or (b) include the MTM adjustment (creating a disconnect between the reported balance and the income base). The NIM calculation (Net Interest Income / Earning Assets) would use the wrong denominator.

**Who depends on it?** The NIM numerator (Net Interest Income). The Earning Assets rate. UBPR NII/AEA calculation. The yield statement structure. Board ALCO reporting.

---

### Rule 8.2 — Pre-Provision Net Revenue

**Rule:** Pre-Provision Net Revenue = Net Interest Income + Funds Transfer Pricing + Non-Interest Income − Non-Interest Expense

This is income before the provision for loan losses — it measures the bank's core operating profitability before credit costs.

**What treasury problem does it solve?** Loan loss provision is a judgment-based expense (management estimates future credit losses). Stripping it out reveals whether the bank's ongoing operations are profitable regardless of credit cycle decisions. This is a standard banking metric watched by analysts, regulators, and management.

**What would happen if removed?** Net Income would be the only bottom-line metric. Periods with large provisions (e.g., during a recession) would show losses even if the core business is healthy. Management couldn't separate operational performance from credit cycle effects.

**Who depends on it?** The yield statement's Pre-Provision Net Revenue line. Board reporting on core bank profitability. Analyst presentations. ALCO credit quality discussions.

---

## 9. Net Interest Margin Rules

### Rule 9.1 — Monthly NIM (Internal Metric)

**Rule:** Monthly NIM = Net Interest Income × 12 / max(Total Deposits Average Balance, Earning Asset Build Average Balance)

where "Earning Asset Build" = Short Term Investments avg + Securities avg + FHLB Stock avg + Gross Loans avg

The denominator uses the LARGER of total deposits or the earning asset build-up. This adjusted average assets approach ensures the denominator reflects the full balance sheet, not just the asset side.

**What treasury problem does it solve?** A bank can fund its earning assets with deposits OR with borrowings. If the bank has $200M in deposits but only $180M in earning assets, using earning assets as the denominator would overstate NIM (smaller denominator → higher ratio). Using the larger of deposits or earning assets ensures the denominator captures the full funding base, producing a more conservative and realistic NIM.

**What would happen if removed?** If the denominator were simply Earning Assets average balance, NIM would be systematically overstated for banks with deposit surpluses (more deposits than loans). Internal NIM would disagree with peer analysis and UBPR comparisons.

**Who depends on it?** The Monthly NIM* line. Board ALCO package. Performance trending. CEO/CFO dashboards.

---

### Rule 9.2 — UBPR NIM / NII/AEA (Regulatory Metric)

**Rule:** UBPR NII/AEA = Tax-Equivalent Net Interest Income × 12 / Earning Assets Average Balance

where Tax-Equivalent NII = Net Interest Income − Tax-Exempt Income + (Tax-Exempt Income / 0.79)

The tax-exempt gross-up uses a 21% tax rate assumption (1 / (1 − 0.21) = 1 / 0.79). Municipal bond income, which is exempt from federal income tax, is grossed up to a taxable-equivalent yield so it can be compared fairly against taxable bonds.

**What treasury problem does it solve?** A bank earning 3.00% on tax-exempt municipal bonds is actually earning MORE than a bank earning 3.50% on taxable corporate bonds — the municipal income is tax-free. The UBPR (Uniform Bank Performance Report) methodology grosses up tax-exempt income to a taxable equivalent to allow fair comparison. This is a regulatory standard — an examiner comparing the bank's UBPR to the internal dashboard must see the same number.

**What would happen if removed?** The bank's NIM would appear lower than peers who hold more taxable securities (an unfair comparison). The regulatory UBPR would show a different number than the internal dashboard. ALCO might make suboptimal investment decisions (selling municipals because they appear to have lower yield on a pre-tax basis).

**Who depends on it?** The UBPR Net Int Inc/AEA** metric. Call Report consistency. Regulatory examination. Peer bank comparison.

---

### Rule 9.3 — NIM Suppression for Branch Views

**Rule:** UBPR NIM (`ubprNim`) is hidden when viewing a single branch. ROAA and ROAE are also hidden for branch views. These metrics are meaningful only at the consolidated bank level, not for individual branches.

**What treasury problem does it solve?** UBPR metrics are designed for the consolidated bank entity. A single branch does not have its own capital structure or its own tax position. Computing a "branch ROAE" would require allocating capital to branches (an arbitrary exercise). Showing branch-level UBPR metrics would mislead users into thinking branches can be compared to banks.

**What would happen if removed?** Branch managers would see their branch's "NIM" and "ROAE" and compare them to the bank's overall numbers. This would produce meaningless conclusions because capital isn't allocated to branches, tax-exempt income isn't broken out by branch, and the branch's earning asset mix differs from the consolidated bank.

**Who depends on it?** Branch-level P&L report consumers. Branch managers. Regional directors.

---

## 10. Profitability Metric Rules

### Rule 10.1 — Return on Average Assets (ROAA)

**Rule:** ROAA = Net Income × 12 / Average Total Assets

Net Income is retrieved via `directNetIncome()` which tries GL account 699999 first (the direct net income control account), then expands the net income code through hierarchy descendants, then falls back to the calculated net income from the yield statement line.

**What treasury problem does it solve?** ROAA is the primary bank profitability metric — it measures how efficiently the bank generates profit from its asset base. It's reported in the Call Report (Schedule RI), UBPR, and every investor presentation. The multi-level fallback for net income ensures the calculation works regardless of how the specific core banking system posts net income.

**What would happen if removed?** The Overview tab would be missing a critical KPI card. Board profitability discussions would lack a key metric. Peer comparison analysis (which is built on ROAA) would be impossible.

**Who depends on it?** The Overview tab KPI cards. Board reporting. CEO dashboard. Regulatory performance analysis.

---

### Rule 10.2 — Return on Average Equity (ROAE)

**Rule:** ROAE = Net Income × 12 / Average Total Capital

Uses the same multi-level net income resolution as ROAA. The denominator is Total Capital (GL 209060), representing shareholders' equity.

**What treasury problem does it solve?** ROAE measures return to shareholders — how much profit the bank generates relative to invested capital. This is the metric that bank boards and investors care most about after ROAA.

**What would happen if removed?** Shareholder return analysis would be incomplete. CEO compensation discussions (often tied to ROAE targets) would lack data. Investor presentations would be missing a key metric.

**Who depends on it?** The Overview tab KPI cards. CEO performance dashboards. Board-level strategy discussions. Investor relations.

---

## 11. Mapping & Classification Override Rules

### Rule 11.1 — Mapping Override Authority

**Rule:** Quick GL mappings (user-saved in the platform) override the automatic GL range classification and the account hierarchy's built-in mapping. If a user maps GL account 105040 to "Commercial Loans" with type `balance`, that user-specified mapping is authoritative for all calculations — the automatic classification becomes irrelevant.

**What treasury problem does it solve?** The automatic classification (rule 2.1) is a blunt instrument — it can only classify by GL range. But in practice, a specific GL code might need to roll up to a different statement line than its range suggests. For example, GL 110276 is in the 100000 range (Assets) and would be auto-classified as such, but it's explicitly excluded from the "Other Assets" line and treated separately. User mappings give finance teams precise control.

**What would happen if removed?** Every GL account would be classified purely by its numeric range. Any account that doesn't fit the range-based scheme would appear in the wrong statement line. Finance users would be unable to correct misclassifications without changing the GL chart of accounts in the core banking system.

**Who depends on it?** The mapping review panel. Every statement line's GL code resolution. Report accuracy for accounts with non-standard classifications.

---

### Rule 11.2 — Ignored Mapping Exclusion

**Rule:** GL accounts mapped with type `ignore` are excluded from ALL calculations — they contribute zero to every balance, every income, every rate, and every rollup. They are also excluded from the mapping review panel (since they've been explicitly reviewed and dismissed).

**What treasury problem does it solve?** Not every GL account in the core system contains reportable financial data. Some are memo accounts, suspense accounts, inter-company eliminations, or system control accounts. These must be explicitly excluded. The `ignore` type provides a formal "we reviewed this and decided it's not reportable" designation — as opposed to silently excluding accounts because they're not mapped.

**What would happen if removed?** Unmapped GL accounts would automatically contribute to the broadest available rollup category. Memo accounts would inflate balance sheet totals. Suspense accounts (temporary holding accounts for items in research) would corrupt the reported numbers for whatever category they happened to be assigned to.

**Who depends on it?** The mapping engine. Report accuracy. Audit trail (which accounts were explicitly reviewed and excluded).

---

### Rule 11.3 — Audit-Forced Mapping Corrections

**Rule:** `normalizeKnownHierarchyMappings()` contains hardcoded corrections that override whatever is in the user's saved mappings. These are "audit-forced" — they represent decisions made by finance leadership that should not be overridden by individual users. The corrections cover:

1. **8 specific GL account codes** with forced rollup assignments. Examples:
   - GL 202125 → "Correspondent Money Market" (not "Deposits")
   - GL 501220, 501250, 501255 → "Gain on Sale of MTG Assets" (not "Other Income")
   - GL 501240, 501260 → "MSR Income" (not "Other Income")

2. **14 budget line keys** with forced rollup assignments. Examples:
   - `assetbalancing` → "Short Term Investments"
   - `fhlbstock` → "FHLB Stock"
   - `gainsaleofassets` → "Gain on Sale of MTG Assets"
   - `mortgageservicingincome` → "MSR Income"

3. **30+ budget audit keys** auto-created if missing from user mappings

**What treasury problem does it solve?** Some classifications are non-negotiable for regulatory or management reporting consistency. Correspondent Money Market deposits behave differently from regular deposits — they must be tracked separately because they are wholesale funding, not retail deposits. Gain on Sale of Mortgage Assets must be separated from general "Other Income" for mortgage banking profitability analysis. These audit-forced corrections prevent well-meaning users from accidentally breaking critical reporting categories.

**What would happen if removed?** A finance user could inadvertently reclassify Correspondent Money Market into regular Deposits, making wholesale funding analysis impossible. Mortgage gain-on-sale income would be buried in "Other Income," making mortgage banking P&L opaque. Budget-to-actual comparisons for specific categories would break.

**Who depends on it?** Wholesale funding analysis. Mortgage banking P&L. Budget-to-actual reporting. Regulatory liquidity reporting (wholesale funding ratios).

---

### Rule 11.4 — Single Rollup Enforcement

**Rule:** A GL account code can be assigned to exactly ONE statement rollup at any time. If a quick GL mapping assigns account 105040 to "Commercial Loans" and the account hierarchy also has a node with account 105040 mapped to "Business Loans," the two are reconciled into a single canonical assignment. The quick GL mapping takes priority, and the account hierarchy node is updated to match.

**What treasury problem does it solve?** Without this rule, a single GL account could contribute to multiple statement lines simultaneously, causing its balance to be double-counted. This is especially important when mappings come from two sources (quick GL mappings AND account hierarchy nodes).

**What would happen if removed?** GL accounts mapped in both places would appear in two different statement lines. Total Assets would exceed the actual balance because some accounts were counted twice. The balance sheet would not balance. The Balance Check would fail.

**Who depends on it?** `enforceSingleStatementRollupAssignments()`. The mapping consistency system. Balance sheet integrity.

---

## 12. Budget Comparison Rules

### Rule 12.1 — Budget Data Isolation

**Rule:** Budget data is NEVER merged with actual GL data. It lives in a completely separate index (`budgetIndexCache`) that is queried only when the Budget tab is active. The Calculation Engine switches to budget data via a virtual index wrapper (`withStatementIndexes()`).

**What treasury problem does it solve?** Budget and actual data serve different purposes and have different structures. Budget data contains projected balances across multiple versions (original budget, reforecast 1, reforecast 2). Actual data contains realized balances. Mixing them would make it impossible to distinguish which numbers are historical fact and which are forward-looking projections. Separation preserves data provenance.

**What would happen if removed?** The platform couldn't determine whether "Commercial Loans $120M" is an actual balance from May or a budget projection for November. Budget-to-actual variance would become undefined. Version tracking would be impossible.

**Who depends on it?** The Budget tab. Budget-to-actual reports. Approved budget version tracking. Reforecast analysis.

---

### Rule 12.2 — Budget Leaf vs. Rollup Classification

**Rule:** Each budget row is classified as either a "leaf" (an independently calculated line that contributes to totals) or a "rollup" (a subtotal that exists for audit purposes only). Only leaf rows are included in statement line calculations. Rollup rows appear only in the budget mapping review as reference points but are excluded from numerical output.

Classification is determined by: (1) explicit user mapping type, (2) name pattern matching (rows starting with "Total" are classified as rollups), (3) budget subtotal flags from the source workbook.

**What treasury problem does it solve?** Budget workbooks contain both detail lines and subtotal lines. "Total Interest Income" in a budget workbook is the sum of individual income line items — including it as a separate input would double-count. The leaf/rollup classification ensures only independently-sourced budget lines contribute to calculations.

**What would happen if removed?** Every budget subtotal would be added to the calculation alongside its component line items. The budget number for "Total Interest Income" would be roughly double the correct amount (the sum of components + the subtotal row itself).

**Who depends on it?** All Budget tab calculations. Budget-to-actual variance accuracy. Budget mapping review.

---

### Rule 12.3 — Approved Budget Version

**Rule:** Finance leadership can designate one budget version as the "approved" version. This version is highlighted in the UI and is the default shown in budget-to-actual comparisons. The approved version is persisted to localStorage and displayed in Settings.

**What treasury problem does it solve?** Banks produce multiple versions of budgets throughout the year (original, Q1 reforecast, Q2 reforecast, mid-year update). Board reporting should use the formally approved version, not the latest working draft. Designating an approved version ensures board presentations always reference the authorized budget.

**What would happen if removed?** Multiple budget versions would be selectable but none would be designated as authoritative. Board members might see different numbers than management presented. Budget-to-actual comparisons at board meetings would be ambiguous.

**Who depends on it?** The Budget tab version filter. Board reporting. CFO budget oversight.

---

### Rule 12.4 — Budget Income Negation Convention

**Rule:** Budget data follows a sign convention where expense items are stored as negative values. The platform preserves this convention by taking the absolute value for display purposes and negating internally as needed. The `spread` flag on income lines causes the raw income value to be wrapped in `Math.abs()` before use.

**What treasury problem does it solve?** Different departments produce budget workbooks with different sign conventions. Treasury may post expense as negative; accounting may post it as positive in a separate column. The platform normalizes these differences internally to produce consistent reports regardless of the source workbook's convention.

**What would happen if removed?** Budget-to-actual comparisons would show incorrect signs depending on which department produced the budget workbook. Net Interest Income could appear as a loss when it's actually a gain.

**Who depends on it?** Budget comparison report accuracy. Net Interest Income calculation consistency.

---

## 13. Branch Consolidation Rules

### Rule 13.1 — Consolidated vs. Branch View Split

**Rule:** The platform operates in two modes: **Consolidated** (all branches summed) and **Branch-level** (single branch or organizational unit). When the org picker shows "All Branches," all GL rows are aggregated into consolidated totals. When a specific branch or organizational unit is selected, only rows with matching branch numbers are included.

**What treasury problem does it solve?** Bank management needs both views: consolidated for board/regulatory reporting, branch-level for performance management and cost allocation. The split ensures branch managers see their own P&L and the CEO sees the whole bank.

**What would happen if removed?** Every report would always show consolidated data. Branch performance analysis would be impossible. Branch managers and regional directors would have no visibility into their units' financials.

**Who depends on it?** All report views. The org picker. Branch P&L reporting. Allocation analysis.

---

### Rule 13.2 — Branch Filter Resolution via Tree Descent

**Rule:** When a user selects a non-leaf organization node (e.g., "Central Texas"), the platform automatically resolves this to the set of leaf branch numbers by walking the organization tree downward from the selected node and collecting all `Map` values from descendant leaf nodes. "Central Texas" → branches {1, 2, 3, 4, 10, 5, 6, 7, 9}.

**What treasury problem does it solve?** Finance users think in terms of organizational units (regions, divisions), not individual branch numbers. A regional director wants to see "Central Texas" performance, not "branches 1, 2, 3, 4, 10, 5, 6, 7, 9 individually." The automatic resolution makes the org picker usable for non-technical finance staff.

**What would happen if removed?** Users would need to manually select every individual branch to see a regional view. For a 25-branch bank with 4 regions, this would be impractical. Regional performance reporting would be abandoned.

**Who depends on it?** The org picker. Regional directors. Division heads. Any user viewing data at above-branch organizational levels.

---

## 14. Cost Allocation Rules

### Rule 14.1 — Allocation Account Visibility

**Rule:** GL accounts in the allocation range (605010–605100) only appear in branch-filtered views. They are excluded from consolidated views because inter-branch cost allocations net to zero at the consolidated level. Including them would inflate both income and expense without changing net income.

**What treasury problem does it solve?** Cost allocation is the process of distributing centralized overhead (IT, HR, executive) to individual branches for performance measurement. At the consolidated level, these are internal transfers — one branch's expense is another branch's credit. They cancel out. Including them in consolidated reports would artificially inflate both sides of the income statement.

**What would happen if removed?** Consolidated total non-interest expense would include millions of inter-branch allocation transfers alongside real external expenses. The cost-to-income ratio would be meaningless. Regulators would question the discrepancy between the internal dashboard and the Call Report.

**Who depends on it?** Consolidated reporting. Branch P&L accuracy. Non-interest expense trend analysis.

---

### Rule 14.2 — Allocation Value Fallback Chain

**Rule:** When calculating Total Allocations for a branch, the platform tries six fallback methods in order until it finds a non-zero value:

1. Indexed leaf allocation accounts (pre-computed index lookup — fastest)
2. Indexed control allocation accounts (pre-computed totals)
3. Rollup index ("Total Allocations" from rollupValueIndex)
4. Direct row scan of leaf allocation accounts for the selected branches
5. Direct row scan of control allocation accounts
6. Fallback to selected branch's organization maps

**What treasury problem does it solve?** Allocation data is the most fragile data in banking — it depends on the cost allocation system running correctly, which depends on the GL closing on time, which depends on every department submitting their numbers. Multiple fallback methods ensure that even if one data source is incomplete, a reasonable allocation value can still be reported. This is a recognition of operational reality: allocation data is often the last to arrive.

**What would happen if removed?** If the allocation system didn't run this month, branch P&L reports would show zero allocations, making branches appear more profitable than they really are. Branch managers would get an artificially rosy picture.

**Who depends on it?** Branch P&L reporting. The Total Allocations line. Branch performance evaluation.

---

### Rule 14.3 — Allocation Row Audit

**Rule:** At every render, the platform audits allocation rows — counting how many allocation rows exist for the current date/view/branch combination, their total dollar amount, and how many unique branches they cover. This audit is displayed in the load test panel and as part of the current data load audit.

**What treasury problem does it solve?** If the cost allocation system failed to run this month, branch P&L reports would be silently wrong. The audit makes this failure VISIBLE — a zero count triggers a warning. Finance users can verify allocation completeness before trusting branch-level reports.

**What would happen if removed?** Allocation failures would go undetected. Branch managers would make decisions based on incorrect profitability data. The audit trail for cost allocation would disappear.

**Who depends on it?** Finance controllers who validate branch P&L. The load test diagnostics panel. Data quality assurance.

---

## 15. Funds Transfer Pricing Rules

### Rule 15.1 — FTP Visibility Constraint

**Rule:** Funds Transfer Pricing lines (`Funds Transfer Pricing` and `NII after FTP`) only appear in branch-filtered views. At the consolidated level, the bank's internal transfer pricing nets to zero — the treasury desk's credit to branches equals its charge to the funding desk.

**What treasury problem does it solve?** FTP is an internal measurement tool. It assigns a transfer price to deposits (credit to branch for gathering low-cost funding) and loans (charge to branch for using bank funding). These are internal credits and debits that exist only for branch performance measurement. At the consolidated bank level, every credit has an equal and offsetting debit — they cancel completely.

**What would happen if removed?** The consolidated yield statement would show FTP income and expense that don't exist in the bank's actual financial statements. This would disagree with the Call Report and general ledger. Regulators would question the discrepancy.

**Who depends on it?** Branch P&L reports (where FTP is critical). Consolidated reporting (where FTP must be excluded).

---

## 16. Display & Visibility Rules

### Rule 16.1 — Frozen Line Always-Visible Guarantee

**Rule:** 29 core statement lines are always visible on every yield statement view. They cannot be hidden by the display settings system. Users CANNOT make them disappear from the report.

**What treasury problem does it solve?** The yield statement has a standard structure that regulators, examiners, and board members expect. If a user accidentally hides "Net Interest Income" or "Total Assets," the report becomes structurally invalid. Freezing the core lines guarantees report completeness regardless of user display preferences.

**What would happen if removed?** A user experimenting with display settings could accidentally hide critical report lines. A board presentation could be missing "Net Income" because someone unchecked it last week. Report reliability would be compromised.

**Who depends on it?** Board report consumers. Regulatory reviewers. Anyone who needs to trust that a yield statement contains all required lines.

---

### Rule 16.2 — Inline Child Display

**Rule:** Certain statement lines with the `hideWhenChild: true` flag are hidden from the main yield statement table and instead appear only as inline indented rows when their parent line is expanded. This applies to fee income detail lines (specific service charge types, ATM/debit card income components, loan fee components, etc.) and deposit subcategory lines (NOW Accounts, Savings Accounts, Money Market Accounts, etc.).

**What treasury problem does it solve?** The full yield statement with all detail would be overwhelming — 145 lines on a single report. The inline child pattern keeps the main view clean (showing only major categories) while still making detail available on demand. This is the "overview first, drill down for detail" pattern used in all banking reports.

**What would happen if removed?** The MoM yield statement would show 145+ lines. The board report would be unreadable. Users would scroll through fee detail to find the major categories. The visual hierarchy would be lost.

**Who depends on it?** Board report readability. Finance user experience. Report layout structure.

---

### Rule 16.3 — Branch-Only Line Suppression

**Rule:** Statement lines marked `branchOnly: true` are hidden when the org picker is set to "All Branches" (consolidated view). These lines are meaningful only for individual branch analysis.

**What treasury problem does it solve?** FTP and NII-after-FTP are branch-level metrics. Showing them at the consolidated level would either display zeros (confusing) or display numbers that don't exist in the consolidated financials (incorrect).

**What would happen if removed?** FTP lines would appear on consolidated reports with zero values, confusing readers. Or worse, they'd show non-zero values that disagree with the general ledger.

**Who depends on it?** Consolidated report accuracy. Branch-level report completeness.

---

### Rule 16.4 — Non-Significant Row Suppression

**Rule:** When viewing a single branch, any statement line that has zero balance AND zero income is hidden from the report. This applies only when branch-filtered (not consolidated), because individual branches may legitimately have no activity in certain categories.

**What treasury problem does it solve?** A small rural branch might have zero CRE loans, zero wholesale funding, zero mortgage activity. Showing 30 lines of zeros for that branch would drown the meaningful data in noise. Suppressing empty lines keeps branch reports focused.

**What would happen if removed?** Branch reports for small branches would be 50% blank rows. Users would complain about report length and readability. Quick branch comparisons would be harder.

**Who depends on it?** Branch managers reading their branch P&L. Regional directors comparing multiple branches.

---

## 17. Balance & Income Reconciliation Rules

### Rule 17.1 — Balance Check (Assets = Liabilities + Capital)

**Rule:** Every yield statement includes a "Balance Check" row at the bottom: Total Assets − Total Liabilities and Capital. The absolute value of this difference must be ≤ $1 for the report to show "Balanced." Any larger difference is flagged as "Out of balance" in red.

**What treasury problem does it solve?** The fundamental accounting equation (A = L + E) must hold. If it doesn't, the data is corrupt — either GL accounts are missing, an account is double-counted, or a mapping is wrong. This check is the single most important data integrity validation in the platform. It catches: missing GL codes in the line definitions, newly added accounts that haven't been mapped, subtotals that weren't properly excluded, and data loading failures.

**What would happen if removed?** Data errors would propagate silently into every report. A missing liability account would inflate the balance sheet surplus, making the bank appear better-capitalized than it actually is. The board would approve decisions based on incorrect balance sheet data.

**Who depends on it?** Every report consumer. Finance controllers. Auditors. Regulators who reconcile internal reports to the Call Report.

---

### Rule 17.2 — Income Check (Yield Statement Net Income = GL Net Income)

**Rule:** A second reconciliation row compares the Net Income calculated by the yield statement against the Net Income reported by the GL control account (699999). The difference must be minimal. This validates that the yield statement's income rollup logic matches the core system's own income consolidation.

**What treasury problem does it solve?** The yield statement computes Net Income by aggregating individual income and expense line items through the statement hierarchy. The GL control account 699999 is the core system's own Net Income calculation. These should match. If they don't, either: (1) an income/expense GL code is missing from the statement line definitions, (2) the custom formula for Net Income has an error, or (3) data has been loaded incorrectly.

**What would happen if removed?** Net Income on the yield statement could disagree with the bank's trial balance. Auditors would flag the discrepancy. The CFO would lose confidence in the platform's numbers.

**Who depends on it?** Yield statement Net Income verification. Audit reconciliation. Finance controller sign-off.

---

## 18. Liquidity Projection Rules

### Rule 18.1 — Actual Month Lock

**Rule:** In the liquidity projection engine, the most recent actual month (May 2026 in the current data) is LOCKED — all values for that month come from the reference output, not from the projection model. Subsequent months are forecast using growth assumptions and contractual cashflow schedules.

**What treasury problem does it solve?** Liquidity projection starts from a known, validated actual position. Projecting from a model-calculated starting point would introduce forecasting error into the base. The May actual contains the real ending overnight position, real loan balances, and real deposit levels — using these as the starting point ensures the projection is anchored to reality.

**What would happen if removed?** The projection would start from a model-derived May position that may differ from actual May results. Every subsequent month's projection would compound this initial error. The liquidity gap analysis would be unreliable.

**Who depends on it?** The liquidity waterfall. All projected balances. Liquidity ratio forecasts. ALCO stress testing scenarios.

---

### Rule 18.2 — Runoff-View Default (Zero Growth)

**Rule:** Growth assumptions for all major categories default to 0.00% — the "runoff view." Under this view, the bank is projected assuming no new business, only contractual cashflows (maturing securities, amortizing loans, maturing deposits). Users can change growth rates, but the default is conservative.

**What treasury problem does it solve?** The runoff view answers: "If the bank stopped all new lending and deposit-gathering tomorrow, what would our liquidity look like?" This is the most conservative stress scenario — it reveals whether the bank can survive on existing cashflows alone. Regulators specifically ask for this analysis.

**What would happen if removed?** The default view would require users to enter growth assumptions before seeing any projection. Many users wouldn't know what assumptions to enter. The platform would not produce a projection out of the box.

**Who depends on it?** First-time users of the liquidity dashboard. ALCO stress testing. Regulatory liquidity analysis.

---

### Rule 18.3 — Available Liquidity Composition

**Rule:** Total Available Liquidity = Primary + Secondary + Tertiary sources:

**Primary:** FRB Balance + Brokered CD Capacity + FHLB Availability + FRB Line  
**Secondary:** IB in Other Banks + CDARS Capacity + Unpledged Securities + Knight-Doss Family Support  
**Tertiary:** Fed Funds Lines + Mortgage Service Assets + Mortgage Sales Capacity

Each source has a specific business meaning and reliability tier. Primary sources are immediately available. Secondary sources require some activation time. Tertiary sources are contingent or require asset sales.

**What treasury problem does it solve?** Not all liquidity sources are equal. The FRB balance is cash — instantly available. Unpledged securities require a repo transaction or sale (1-3 day settlement). Mortgage servicing assets require a sale of servicing rights (60-90 day process). Tiering gives management a realistic picture: "How much cash can we raise in 24 hours? In 1 week? In 90 days?"

**What would happen removed?** All sources would be summed into one number, implying equal availability. During a real liquidity crisis, management would discover too late that some "available" sources are not actually accessible in the needed timeframe.

**Who depends on it?** ALCO liquidity monitoring. Contingency funding plan. Regulatory liquidity stress testing. Board liquidity oversight.

---

### Rule 18.4 — FHLB Availability as Net of Outstanding

**Rule:** FHLB availability is calculated as max(0, FHLB Line − FHLB Outstanding Balance). The bank cannot borrow more than its FHLB line minus what it already has drawn.

**What treasury problem does it solve?** The FHLB extends a maximum credit line to member banks, collateralized by the bank's loan portfolio. The available amount is the unused portion. Treating the full line as available while already having borrowings outstanding would overstate liquidity.

**What would happen if removed?** If the bank has a $50M FHLB line and has drawn $30M, the dashboard would show $50M available instead of the correct $20M. During a liquidity event, the bank would attempt to draw $50M and discover only $20M is available.

**Who depends on it?** Liquidity availability calculations. Contingency funding plan accuracy. ALCO decision-making on funding sources.

---

## 19. Liquidity Ratio Rules

### Rule 19.1 — Four-Tier Ratio Classification

**Rule:** Each liquidity ratio has four thresholds that determine its status:

| Level | Meaning | Color |
|---|---|---|
| **Target** | Optimal operating range | (no special coloring) |
| **EWI 1** (Early Warning Indicator 1) | Caution — approaching limit | Yellow |
| **EWI 2** (Early Warning Indicator 2) | Warning — near limit | Red |
| **Limit** | Regulatory or policy hard limit | Red |

The status is determined by the ratio's direction: for ratios where "higher is better" (like liquid asset coverage), exceeding a threshold is bad. For ratios where "lower is better" (like wholesale funding dependence), falling below a threshold is bad.

**What treasury problem does it solve?** Banks operate under multiple constraints: regulatory limits (e.g., brokered deposit caps for well-capitalized banks), policy limits (board-approved risk tolerances), and early warning thresholds (trigger management attention before a limit is breached). The tiered system mirrors how bank risk management actually works — you don't wait for a limit breach to act.

**What would happen if removed?** Ratios would show only numeric values with no interpretation. Management would need to memorize every threshold. Early warning signals (a ratio creeping toward its limit) would go unnoticed until too late.

**Who depends on it?** ALCO risk monitoring. Board risk dashboards. Regulatory compliance tracking. Internal audit.

---

### Rule 19.2 — Wholesale Funding Ratio

**Rule:** Wholesale Funding Dependence = (Brokered Deposits + CDARS + FHLB Borrowings) / Total Liabilities

**What treasury problem does it solve?** Wholesale funding (brokered CDs, listing service deposits, FHLB advances) is considered "hot money" — it's rate-sensitive and can leave the bank quickly if market rates change. High wholesale funding dependence is a regulatory red flag (it contributed to bank failures in 2008 and 2023). Regulators track this ratio closely.

**What would happen if removed?** The bank's funding risk profile would be opaque. A bank with 40% wholesale funding dependence looks very different from one with 5% — but without this ratio, they'd appear identical on a balance sheet.

**Who depends on it?** Regulatory examiners (Liquidity coverage ratio analysis). ALCO funding strategy. Board risk appetite discussions. Deposit pricing strategy.

---

### Rule 19.3 — Loan-to-Deposit Ratio

**Rule:** Loan-to-Deposit Ratio = Total Loans / Total Deposits. A ratio above 100% means the bank is funding loans with non-deposit sources (borrowings).

**What treasury problem does it solve?** The loan-to-deposit ratio is the most basic measure of bank liquidity. Core deposits are the cheapest, most stable funding source. A bank with LDR > 100% is relying on wholesale borrowing to fund loan growth — this is riskier and more expensive. Board policy typically sets an LDR ceiling.

**What would happen if removed?** Loan growth funded entirely by FHLB borrowings would look the same as loan growth funded by deposit growth. The funding risk would be invisible.

**Who depends on it?** Board ALCO policy monitoring. Loan growth strategy. Funding strategy. Regulatory off-site monitoring.

---

## 20. Data Validation & Audit Rules

### Rule 20.1 — Mapping Completeness Tracking

**Rule:** At every render, the platform counts: (1) how many active GL accounts have no rollup mapping, (2) how many branch numbers in the data have no organization hierarchy entry, and (3) how many quick GL mappings exist. These counts are displayed prominently in the Mapping Review panel and the Settings tab.

**What treasury problem does it solve?** An unmapped GL account means that account's balance is NOT appearing in any statement line. Balances are being silently excluded from reports. If a newly created GL account carries a $5M loan balance and isn't mapped, the loan portfolio appears $5M smaller than it actually is. Visibility into unmapped accounts ensures this cannot happen silently.

**What would happen if removed?** New GL accounts would accumulate invisibly outside the reporting structure. The balance sheet would slowly diverge from the general ledger. The Balance Check would eventually flag the problem, but only when the cumulative error exceeded $1 — by which point many months of misreporting could have occurred.

**Who depends on it?** Finance controllers validating report completeness. Month-end close process. Audit reconciliation.

---

### Rule 20.2 — Allocation Source Warning

**Rule:** If the most recent month's data has zero allocation rows but a previous month had allocation activity, the platform displays a warning: the data source may be stale or from a different folder. This is specifically designed to catch the common mistake of connecting to the wrong input files folder.

**What treasury problem does it solve?** The most common data loading error is pointing the dashboard at an old or wrong folder. If a user accidentally connects to the January folder in May, the allocation rows (which are generated by a month-end process) would be missing. The warning catches this before branch P&L reports are distributed with incorrect allocation data.

**What would happen if removed?** A user monitoring the wrong folder would produce 4 months of branch P&L reports with no cost allocations. Branch managers would see artificially low expenses. Performance bonuses might be calculated on incorrect data.

**Who depends on it?** Month-end closing process. Branch P&L distribution. Finance controller data validation.

---

### Rule 20.3 — Load Test Diagnostics

**Rule:** The Settings > Data Loading Test panel provides a comprehensive audit of every data load: source type, file count, raw row count, normalized row count, skipped row count, unique date count, unique account count, unique branch count, missing columns, unmapped active accounts, and allocation audit results. This is displayed as a card grid and a detailed text summary.

**What treasury problem does it solve?** When a report number looks wrong, the first question is "Is the data right?" The load test diagnostics answer this immediately — showing exactly what data was loaded, what was discarded, and what's missing. This turns a black-box data loading process into a transparent, auditable one.

**What would happen if removed?** Troubleshooting incorrect report numbers would require JavaScript console inspection. Finance users couldn't self-diagnose data issues. Every "the numbers look off" question would require a developer to investigate.

**Who depends on it?** Finance controllers. Month-end validation. Developer troubleshooting. User self-service data verification.

---

### Rule 20.4 — Global Error Capture

**Rule:** Before any other code runs, the platform registers global error handlers that catch any unhandled JavaScript error or unhandled promise rejection. These errors are displayed in a red banner at the top of the page, ensuring that even if the application crashes, the user sees what went wrong.

**What treasury problem does it solve?** A silent failure (application crashes, user sees blank page or incorrect numbers with no error message) is the worst outcome in financial software. Users might make decisions based on partially-loaded or corrupted data. The error banner makes all failures VISIBLE and provides diagnostic information.

**What would happen if removed?** Data loading failures would produce a blank dashboard with no explanation. Calculation errors would produce partially-rendered reports. Users would not know whether the numbers they see are trustworthy.

**Who depends on it?** Every user of the platform. Finance controllers who need to trust the output. Developers debugging production issues.

---

## Dependency Index: Who Depends on Each Rule

| Business Function | Rules That Govern It |
|---|---|
| **Board reporting** | 1.1, 1.2, 2.2, 5.1, 6.1, 6.2, 8.1, 9.1, 10.1, 10.2, 16.1, 16.2, 17.1 |
| **ALCO (Asset-Liability Committee)** | 6.1, 6.2, 8.1, 9.1, 9.2, 17.1, 18.1, 18.2, 18.4, 19.1, 19.2, 19.3 |
| **Regulatory reporting (Call Report, UBPR)** | 1.2, 2.1, 3.1, 6.1, 6.2, 7.3, 8.1, 9.2, 10.1, 14.1, 17.1 |
| **Branch P&L** | 3.2, 3.3, 3.5, 4.2, 9.3, 13.1, 13.2, 14.1, 14.2, 15.1, 16.3, 16.4 |
| **Cost allocation** | 4.2, 14.1, 14.2, 14.3, 20.2 |
| **Budget planning & analysis** | 12.1, 12.2, 12.3, 12.4 |
| **Liquidity management** | 18.1, 18.2, 18.3, 18.4, 19.1, 19.2, 19.3 |
| **Data quality / Audit** | 1.1, 1.2, 1.3, 20.1, 20.2, 20.3, 20.4 |
| **Finance user configuration** | 4.2, 11.1, 11.2, 11.3, 11.4, 5.2, 5.3, 16.1, 16.2 |
| **CEO / CFO dashboard** | 8.1, 8.2, 9.1, 10.1, 10.2, 17.1, 17.2 |

---

---

## 21. Core Platform Entities

This section documents the six foundational entities that underpin the platform's domain model. Each entity is described in terms of its business purpose, relationships to other entities, dependencies on subsystems, lifecycle from creation to retirement, and trajectory as the platform evolves toward its planned module suite.

---

### 21.1 Liquidity Category

#### Purpose

A Liquidity Category represents a segment of the bank's balance sheet that behaves as a coherent unit for liquidity modeling purposes. Rather than projecting 500 individual GL accounts forward month-by-month, the liquidity projection engine groups accounts into 16 categories (Cash, Securities, Loans, NIB Deposits, Interest-Bearing Deposits, Brokered Deposits, CDARS, FHLB, Correspondent Demand, MSR, Other Assets, Other Liabilities, Capital, Retained Earnings, Overnight, and contractual cashflow schedules) and applies category-level growth assumptions to project the entire category as one line.

This entity exists because a balance-sheet-level liquidity projection of 500 individual accounts with independent assumptions would be unmanageable for finance users. The category is the right granularity: detailed enough to capture different behavioral patterns (brokered deposits run off faster than core deposits, securities pay down on contractual schedules, loans amortize gradually), but coarse enough that a finance user can set assumptions in under 5 minutes.

#### Relationships

| Related Entity | Nature of Relationship |
|---|---|
| **GL Account** (embedded in `raw.gl.detail`) | Each GL account is assigned exactly one Liquidity Category via its `liquidityCategory` field. This assignment happens at build time when the liquidity dashboard is generated. A category aggregates all GL accounts assigned to it. |
| **Balance Sheet Balance** (`raw.gl.byCategory`) | Each category has a starting balance (Ending Balance) extracted from the GL data at build time. This is the anchor point for the 13-month projection. |
| **Contractual Cashflow** (`raw.contractualCashflows`) | Certain categories (Securities Paydowns, Loan Runoff, Interest Bearing Deposits Runoff, Brokered Deposits Maturity, CDARS Maturity, FHLB Runoff) have contractual cashflow schedules that are applied BEFORE growth assumptions. Contractual cashflows represent known maturity/paydown events; growth assumptions represent new business volume. |
| **Growth Assumption** (`state.growthRates`) | Each category has a user-configurable growth rate per forecast month. The growth rate can be negative (runoff beyond contractual) or positive (new business). Default is 0.00% for the runoff view. |
| **Liquidity Ratio** (`state.ratios`) | Categories feed into ratio calculations — for example, "Brokered Deposits / Total Deposits" uses the Brokered Deposits category balance as the numerator. |
| **Available Liquidity Source** | Several categories map directly to liquidity sources: Cash → "IB in Other Banks", Overnight → "FRB Balance", MSR → "Mortgage Service Assets". |

#### Dependencies

- **Build-time data assembly** (external tool) — Liquidity Categories are assigned at build time, not at runtime. The build tool reads GL data, classifies each account, and embeds the result. Runtime code cannot change category assignments.
- **`raw.gl.byCategory`** — The embedded JSON structure that carries the starting balances per category. Without this, the projection engine has no anchor.
- **`raw.gl.detail`** — The per-account detail used by `projectedHierarchyAmounts()` to proportionally scale detailed balance sheet line items to match the aggregate category projection.
- **`raw.contractualCashflows`** — Required for categories with scheduled paydowns/maturities. Without this, the projection would treat all balance changes as growth-driven rather than schedule-driven.
- **`state.growthRates`** — Persisted in localStorage. Users modify growth rates; the projection engine reads them.

#### Lifecycle

```
BUILD TIME (external tool):
  GL source files read
    → Each account assigned to a Liquidity Category
    → Category starting balances computed
    → Contractual cashflow schedules extracted
    → All embedded into liquidity-dashboard.html as JSON

RUNTIME:
  Dashboard loads → raw decoded
    → state initialized (merged with localStorage growth rates)
    → User optionally modifies growth assumptions
    → project() called:
        For each month:
          Starting balance from previous month
          − Contractual cashflows (maturities, paydowns)
          +/− Growth assumption effect (new business or runoff beyond contractual)
          = Ending balance for this month
    → Ratios calculated from projected balances
    → Tables and charts rendered

PERSISTENCE:
  Growth rates saved to localStorage → survive browser restart
  Collapse state saved → survive tab switches
  Category assignments are FROZEN at build time → cannot change without rebuild
```

#### Future Evolution

Currently, Liquidity Categories exist only inside the Liquidity Dashboard as an embedded, build-time concept. As the platform matures:

1. **Shared Category Taxonomy:** The Yield Statement already has a category concept (through `categoryFor()`, `referenceAccounts`, `quickMappingLookup()`). These two category systems should be unified. A "Commercial Loans" category in the liquidity module should correspond to the same set of GL accounts as "Commercial Loans" in the yield statement module.

2. **Runtime Category Assignment:** Currently, category assignment is static at build time. When the shared hierarchy engine is implemented, category assignment should be derivable from the mapping engine at runtime — if a GL account is mapped to "Commercial Loans" in the quick GL mappings, the liquidity engine should automatically know it belongs to the Loans category.

3. **Scenario-Dependent Categories:** When the Scenario Engine is built, each scenario will have its own set of growth assumptions per category. Categories become scenario-scoped rather than globally defined.

4. **New Categories from Future Modules:** The Allocation Engine will need categories for overhead cost pools. The FTP Engine will need categories for transfer pricing pools. The Budget Planning module will need budget-line-level categories that map to statement lines. The category taxonomy will need to accommodate all of these.

---

### 21.2 Budget Line

#### Purpose

A Budget Line represents a single row in a budget workbook — a projected financial amount for a specific line item, in a specific month, under a specific budget version, within a specific view (Balance or IncExp). Budget Lines are the atomic unit of budget-to-actual comparison: each line in the budget workbook must be mapped to a statement rollup, classified as either a "leaf" (independently calculated, included in totals) or a "rollup" (subtotal, audit-only), and assigned a view that determines whether it contributes to balance or income calculations.

This entity exists because the bank's budgeting process produces detailed financial projections that must be compared against actual results. Without Budget Lines as a formal entity, budget data would be unstructured — the platform would not know which budget rows correspond to which statement lines, or whether a given budget number should be included in calculations or is merely a subtotal for audit purposes.

#### Relationships

| Related Entity | Nature of Relationship |
|---|---|
| **Budget Line Mapping** (`budgetLineMappings[]`) | Each Budget Line can have a mapping that assigns it to a statement rollup, a view type, a classification (leaf/rollup), and an ignore flag. If unmapped, the line is flagged in the Budget Mapping Review panel. |
| **Statement Line** (via `rollup` field on mapping) | A mapped Budget Line contributes its amount to a specific statement line. "Budget: Commercial Loans" → "Commercial Loans" statement line. |
| **Budget Version** (`budgetVersion` field) | Budget Lines belong to a version: "2026 Original Budget", "2026 Reforecast Q1", etc. The user selects which version to compare against. |
| **Budget Index** (`budgetIndexCache`) | At runtime, Budget Lines are indexed into a parallel lookup structure (separate from the actual-GL-data index). The Calculation Engine switches to this index when the Budget tab is active. |
| **Budget Mapping Candidate** (`budgetMappingCandidates[]`) | Before mapping, each Budget Line is a "candidate" — it appears in the Budget Mapping Review panel awaiting classification. After mapping, it becomes an active contributor to budget calculations. |
| **Approved Budget Version** | One version can be designated as the "approved" version. This is a label applied to all Budget Lines in that version — it governs which version is the default for board reporting. |

#### Dependencies

- **Budget workbook files** (XLSX, loaded via File System Access API) — The source of all Budget Lines. Without these files, the Budget tab is empty.
- **`budgetLineMappings[]`** (localStorage) — The user-saved mappings that assign Budget Lines to statement rollups. Without these, every Budget Line is unmapped and excluded from calculations.
- **`normalizeKnownHierarchyMappings()`** — The audit-forced corrections that auto-create mappings for known budget line keys. Ensures critical budget lines are never unmapped.
- **`budgetRowMappingDecision()`** — The function that determines, for any given budget row, whether it is a leaf or rollup, what its suggested rollup is, and whether it should be ignored. This is the bridge between raw budget data and the mapping system.
- **`statementNodes[]`** — The statement hierarchy determines which rollups are available for Budget Lines to map to.
- **`budgetIndexCache`** — The runtime index that makes Budget Line data queryable. Built from `budgetRows[]` on data load. Must be rebuilt after mapping changes.

#### Lifecycle

```
DATA LOADING:
  Budget XLSX workbook opened
    → Each row parsed: name, view, monthly amounts, version
    → Budget Lines extracted into budgetRows[]
    → budgetMappingCandidates[] populated (deduplicated by key+view)
    → budgetIndexCache built

MAPPING:
  Budget Mapping Review panel shows candidates
    → User selects lines, chooses rollup + type (leaf/rollup)
    → Mapping saved to budgetLineMappings[] in localStorage
    → budgetIndexCache rebuilt with new mappings applied
    → Budget tab re-rendered with mapped data

ACTIVE USE:
  User selects budget version in filter
  User navigates to Budget tab
    → budgetIndexesForVersion(version) creates virtual index
    → Calculation Engine operates on budget data via withStatementIndexes()
    → Actual vs. Budget comparison rendered

APPROVAL:
  Finance leadership designates an approved version
    → approvedBudgetVersion persisted
    → All Budget Lines in that version are marked as "approved"
    → Default budget comparison uses approved version

PERSISTENCE:
  Budget Lines persist in IndexedDB (budgetCache key)
  Mappings persist in localStorage
  Approved version persists in localStorage
  Survives browser restart
```

#### Future Evolution

1. **Multi-View Budget Lines:** Currently, a Budget Line carries either a Balance view or an IncExp view. The Budget Planning module will need Budget Lines that carry BOTH views simultaneously, with the platform automatically selecting the appropriate view based on the statement line's context (balance column uses Balance view, income column uses IncExp view).

2. **Budget Line Hierarchy:** Currently, budget lines have no parent-child relationships — each line is independently mapped to a statement rollup. The Budget Planning module will introduce a budget line hierarchy that mirrors the statement hierarchy, allowing budget subtotals to automatically roll up to their parents.

3. **Budget Line → Journal Entry Path:** When the Journal Generator module is built, Budget Lines will become the source of journal entries. A budget line "Salaries & Employee Benefits - January 2027 - $450,000" will generate a journal entry debiting salary expense and crediting accrued payroll.

4. **Scenario-Aware Budget Lines:** When the Scenario Engine is built, Budget Lines will be taggable with scenario identifiers. The same budget line "Net Interest Income" could have different values under Base Case, Optimistic, and Stress scenarios.

5. **Variance Explanation:** Budget Lines will carry a `varianceExplanation` field where finance users can document the reason for significant budget-to-actual variances. This turns the Budget tab from a variance-reporting tool into a management discussion tool.

---

### 21.3 Scenario

#### Purpose

A Scenario represents a coherent set of assumptions applied across the platform to produce a forward-looking projection. It bundles growth rates, rate environment assumptions, prepayment speeds, deposit beta assumptions, and other forward-looking parameters into a named, saveable, comparable configuration. The Scenario is the bridge between "what actually happened" (the Yield Statement's historical analysis) and "what could happen" (the Liquidity Dashboard's projections, and future modules' forward-looking analytics).

**Current implementation status: PARTIALLY EXISTS.** The Liquidity Dashboard has the concept of a scenario (via `state.scenarioName` and `state.scenarioDescription`), but there is no Scenario entity in the Yield Statement. The Scenario Engine is a planned module. What exists today is a scaffold — a name and description field, plus growth rate state that conceptually belongs to a scenario but is not formally grouped under one.

#### Relationships

| Related Entity | Nature of Relationship | Status |
|---|---|---|
| **Growth Assumptions** (`state.growthRates`) | A Scenario OWNS a set of growth assumptions — one rate per Liquidity Category per forecast month. Currently these live directly on the state object, not under a scenario wrapper. | Exists but not formalized |
| **Liquidity Ratio Thresholds** (`state.ratios`) | A Scenario may define custom ratio thresholds — different stress scenarios might have different EWI levels. Currently thresholds are global, not scenario-scoped. | Planned |
| **Liquidity Capacity Assumptions** (`state.liquidity`) | A Scenario defines available liquidity capacities — FHLB line size, brokered CD capacity, unpledged securities. Currently these are global state. | Exists but not formalized |
| **Budget Version** | A Scenario could reference a specific budget version as the "base case" projection. A stress scenario would modify the base case assumptions. | Planned |
| **Yield Statement** (future) | A Scenario will be able to project the yield statement forward — "if rates rise 200bps and deposits reprice at 40% beta, what does NIM look like in 12 months?" | Planned |
| **Peer Scenario** | Scenarios can be compared — "Base Case vs. Stress Case" side-by-side on the same report. | Planned |

#### Dependencies

- **Liquidity Projection Engine** — The only subsystem that currently consumes scenario-like data. Growth rates and liquidity assumptions flow into `project()`.
- **localStorage** — The current persistence mechanism for scenario data (via `state` object serialization). This will need to evolve to support multiple named scenarios.
- **Future: Scenario Engine** — The planned module that will formalize Scenario as a first-class entity with persistence, versioning, comparison, and cross-module application.
- **Future: Shared Hierarchy Engine** — When categories are unified across modules, scenarios will be able to apply assumptions consistently across Yield Statement projections and Liquidity projections.

#### Lifecycle

```
CURRENT (Scaffold Phase):
  Dashboard loads → embedded defaults loaded
  User enters scenario name + description (text fields)
  User sets growth rates per category per month
  User sets liquidity capacity assumptions
  state saved to localStorage
  → All changes are to a single, anonymous scenario

FUTURE (Scenario Engine Phase):
  Named Scenario created: "Base Case", "Rate Shock +200bps", "Recession"
  Each scenario stores:
    → Growth assumptions (per category, per month)
    → Rate environment (yield curve shifts, deposit betas)
    → Prepayment assumptions
    → Credit loss assumptions
    → Liquidity capacity assumptions
    → Budget version reference
    → Custom ratio thresholds
  Scenarios persisted to IndexedDB or shared workbook
  Scenarios can be cloned ("Base Case" → "Base Case - Modified")
  Scenarios can be compared side-by-side
  Scenarios can be applied to any module (Liquidity, Yield Statement projection, ALM)
```

#### Future Evolution

The Scenario Engine is the single most important future module — it transforms the platform from a historical reporting tool into a forward-looking decision support system. Its evolution path:

1. **Phase 1 — Formalize Current State:** Extract existing growth rates, liquidity assumptions, and scenario metadata from the flat `state` object into a formal Scenario entity. Support multiple named scenarios with create/rename/delete/clone operations.

2. **Phase 2 — Rate Environment:** Add yield curve scenarios (parallel shift, steepener, flattener) and deposit beta curves (how deposit rates respond to market rate changes). These feed into a future Yield Statement projection mode.

3. **Phase 3 — Cross-Module Application:** A single scenario can be applied to Liquidity (runoff/ growth), Yield Statement (rate/volume projection), Budget Planning (scenario-conditioned budgets), and ALM (interest rate risk).

4. **Phase 4 — Scenario Audit Trail:** Every scenario modification is logged with user, timestamp, and change description. Scenarios become auditable artifacts suitable for regulatory examination.

5. **Phase 5 — Scenario Library:** Pre-built scenario templates for common regulatory stress tests (CCAR-style severely adverse, DFAST-style adverse, idiosyncratic bank-specific scenarios).

---

### 21.4 Journal Entry

#### Purpose

A Journal Entry represents a double-entry accounting transaction — a debit to one GL account and an equal and offsetting credit to another GL account, with a date, description, and supporting metadata. Journal Entries are the mechanism by which the platform's analytical outputs (FTP charges/credits, cost allocations, budget-to-actual adjustments, plug entries) are exported back to the bank's core accounting system.

**Current implementation status: DOES NOT EXIST.** The Journal Generator is a planned module. No journal entry creation, validation, or export logic exists in the current codebase. The allocation accounts (605010-605100) and FTP accounts (302010) exist in the GL and are read by the platform, but the platform does not generate journal entries to post TO these accounts. It only reads FROM them.

#### Relationships (Planned)

| Related Entity | Nature of Relationship |
|---|---|
| **GL Account** | A Journal Entry debits or credits specific GL accounts. The platform must validate that the target accounts exist and are of the correct type for the transaction. |
| **Allocation Engine** (future) | The Allocation Engine PRODUCES journal entries — each allocation (IT cost distributed to branches) generates a debit to the branch's cost center and a credit to the centralized IT cost pool. |
| **FTP Engine** (future) | The FTP Engine PRODUCES journal entries — each funds transfer pricing charge/credit generates offsetting entries between the branch and the treasury desk. |
| **Plug Generator** (future) | The Plug Generator PRODUCES journal entries — balance sheet plugs (ensuring Assets = Liabilities + Capital) generate adjusting entries. |
| **Budget Line** | Journal Entries can reference a Budget Line as their source — a budgeted salary expense becomes a journal entry posting to the salary expense GL account. |
| **Validation Result** | Every Journal Entry must pass validation before export: debits = credits, amounts are non-zero, dates are valid, accounts exist, accounts are not frozen, and the entry does not violate any accounting control. |

#### Dependencies (Planned)

- **Shared Hierarchy Engine** — To validate that target GL accounts exist and are classified correctly.
- **Mapping Engine** — To resolve which GL accounts correspond to which statement lines when generating entries from budget lines or allocations.
- **Persistence Layer** — Journal Entries must be stored (IndexedDB or shared workbook) before export, with an audit trail of creation and modification.
- **Core Banking System API** (future) — The ultimate destination for exported journal entries. This requires integration with the bank's specific core system (Fiserv, Jack Henry, FIS, etc.).

#### Lifecycle (Planned)

```
GENERATION:
  Engine runs (Allocation, FTP, Plug, Budget-to-Actual)
    → Calculates amounts per branch/GL account
    → Produces draft Journal Entries
    → Each entry: date, description, debit account, credit account, amount, source engine, source reference

VALIDATION:
  Debits = Credits (within tolerance)
  All target GL accounts exist in hierarchy
  No entries to frozen/closed accounts
  No entries to summary/control accounts (they must be leaf)
  Entry date is within an open accounting period
  Amount is within reasonableness bounds
  Duplicate detection (same source + date + accounts + amount)

REVIEW:
  Finance user reviews proposed entries in a review panel
  Can approve, reject, or modify each entry
  Batch approval supported
  Rejected entries returned to source engine with reason

EXPORT:
  Approved entries exported to CSV/XLSX/API
  Format matches core banking system's journal import spec
  Export log recorded with timestamp and user
  Exported entries marked as "posted" — cannot be modified

POST-EXPORT:
  Dashboard re-imports GL data (now including posted entries)
  Reports reflect updated balances
  Reconciliation confirms entries posted correctly
```

#### Future Evolution

1. **Phase 1 — Journal Entry Schema:** Define the data model for Journal Entries (fields, validation rules, status workflow). This is a prerequisite for all modules that will generate entries.

2. **Phase 2 — Allocation Journal Generator:** The first producer of journal entries. Allocations calculated by the Allocation Engine are formatted as Journal Entries, validated, and exported.

3. **Phase 3 — FTP Journal Generator:** FTP charges and credits become Journal Entries.

4. **Phase 4 — Budget-to-Actual Journal Generator:** Budget-to-actual adjustments (accruals, prepayments, true-ups) become Journal Entries.

5. **Phase 5 — Recurring Journal Entries:** Support for templates — entries that recur monthly with updated amounts (e.g., monthly depreciation).

6. **Phase 6 — Core System Integration:** Build connectors for common core banking systems' journal import formats.

---

### 21.5 Metadata Mapping

#### Purpose

A Metadata Mapping is the formal link between a source data element (a GL account code, a budget line key, a control label) and a target reporting structure element (a statement rollup, a liquidity category, a cost center). Metadata Mappings are THE mechanism by which the platform's canonical metadata (the hierarchy trees) governs how raw financial data is classified, aggregated, and reported. Without mappings, the platform has data but no structure — it cannot produce a yield statement, a liquidity report, or any other structured financial output.

Mappings answer the question: "Where does this number go?"

**Current implementation status: EXISTS.** Two mapping types are fully implemented: Quick GL Mappings (GL account → statement rollup) and Budget Line Mappings (budget line → statement rollup). A third implicit mapping exists in the Liquidity Dashboard's build-time category assignment (GL account → liquidity category). A fourth implicit mapping exists in the account hierarchy tree (account node → statement rollup via StatementRollup field).

#### Relationships

| Related Entity | Nature of Relationship |
|---|---|
| **GL Account** (`referenceAccounts[]`, GL rows) | The source of a Quick GL Mapping. Each mapping says "GL account X belongs to statement line Y." A GL account can have at most ONE mapping (enforced by `enforceSingleStatementRollupAssignments`). |
| **Statement Line** (`statementNodes[]`, `momLines[]`) | The target of both Quick GL Mappings and Budget Line Mappings. A statement line aggregates all GL accounts and budget lines mapped to it. |
| **Budget Line** | The source of a Budget Line Mapping. Each mapping says "budget row X belongs to statement line Y with classification Z (leaf/rollup)." |
| **Account Hierarchy Node** (`accountNodes[]`) | An alternate carrier of mapping information. An account node with a Map value (6-digit GL code) and a StatementRollup field effectively IS a mapping — it says "this GL code belongs to this rollup." These are synced with Quick GL Mappings via `syncMappedAccountsToAccountHierarchy()`. |
| **Mapping Engine** (subsystem E) | The subsystem that manages all mappings — CRUD operations, persistence, lookup, normalization, and synchronization with the account hierarchy. |
| **Calculation Engine** (subsystem D) | The primary consumer of mappings. Every call to `lineMeasure()` resolves which GL codes belong to a statement line by consulting mappings AND the account hierarchy. |
| **Mapping Review Panel** | The UI that exposes unmapped accounts and budget lines to finance users. The panel's content is derived entirely from mapping state. |
| **Organization Hierarchy** (`organizationNodes[]`) | An implicit mapping: each organization leaf node's Map value maps a branch number to an organizational unit. This is a mapping in all but name. |

#### Dependencies

- **localStorage** — Both Quick GL Mappings and Budget Line Mappings are persisted to localStorage. If localStorage is cleared, all user mappings are lost and the platform falls back to automatic classification.
- **`quickMappingLookup()` / `budgetMappingLookup()`** — The runtime lookup caches that make mappings queryable in O(1) time.
- **`normalizeKnownHierarchyMappings()`** — The audit-forced corrections that override user mappings for specific accounts. This is the "mapping of last resort" — it ensures critical classifications cannot be broken.
- **`enforceSingleStatementRollupAssignments()`** — Ensures a GL account has exactly one rollup assignment, reconciling Quick GL Mappings with account hierarchy nodes.
- **`syncMappedAccountsToAccountHierarchy()`** — Keeps the account hierarchy tree in sync with Quick GL Mappings. When a new mapping is saved, a corresponding account tree node is created.
- **statement hierarchy (`statementNodes[]`)** — Defines which target rollups are available. A mapping cannot target a rollup that doesn't exist.
- **`ignoredSubtotalAccounts`** — The set of 138 GL accounts that are NEVER mapped (they are subtotals, not leaf accounts). Mappings to or from these accounts are excluded or ignored.

#### Lifecycle

```
CREATION:
  Via Quick Mapping Review panel:
    Finance user selects unmapped GL accounts
    Chooses statement rollup from dropdown (populated from statementNodes[])
    Chooses mapping type (auto, balance, incexp, ftp, allocation, ignore)
    → Mapping saved to quickGlMappings[] in localStorage
    → account hierarchy synced (new node created if not existing)
    → data indexes rebuilt
    → all reports re-rendered

  Via Budget Mapping Review panel:
    Finance user selects unmapped budget lines
    Chooses statement rollup
    Chooses classification (leaf or rollup)
    → Mapping saved to budgetLineMappings[] in localStorage
    → budget indexes rebuilt
    → budget tab re-rendered

  Via Hierarchy Editor (Account tab):
    Finance user edits an account node's Statement Rollup and Mapping Type
    → Same effect as Quick GL Mapping save
    → Changes flow through saveHierarchyNodeStatementMapping()

  Via Import:
    Finance user imports CSV/XLSX of mappings
    → importQuickMappings() processes file
    → Mappings merged with existing (deduplicated by account code)

MODIFICATION:
  Same UI paths as creation — mappings are overwritten, not versioned
  Type change (e.g., auto → ignore) immediately affects all calculations

DELETION:
  Via Quick Mapping Review "Remove" button
  Via Hierarchy Editor "Delete" on account nodes
  → Mapping removed from localStorage
  → Account hierarchy node may be deleted or updated
  → Data indexes rebuilt

AUDIT-FORCED OVERRIDE:
  normalizeKnownHierarchyMappings() runs at EVERY startup
  If a user mapping conflicts with an audit-forced rule, the audit rule WINS
  → User mapping is overwritten in localStorage
  → This is transparent to the user — they see the corrected mapping
```

#### Future Evolution

1. **Unified Mapping Registry:** Currently, mappings are split between Quick GL Mappings (localStorage), Budget Line Mappings (localStorage), account node StatementRollup fields, organization node Map fields, and liquidity category assignments (embedded JSON). These should be unified into a single Mapping Registry with a consistent schema, API, and persistence mechanism.

2. **Mapping Provenance:** Currently, there is no record of WHO created a mapping or WHEN. Adding user, timestamp, and source (manual, imported, audit-forced, auto-created) to each mapping would create an audit trail suitable for SOX compliance.

3. **Mapping Validation Rules:** Currently, a mapping can target any existing rollup. Future validation rules could prevent mappings that would break accounting constraints (e.g., mapping an asset account to a liability rollup).

4. **Cross-Module Mappings:** When the Allocation Engine, FTP Engine, and Scenario Engine are built, new mapping types will be needed: allocation pool → cost center, FTP instrument → transfer price curve, scenario parameter → assumption set. The Mapping Registry must accommodate these.

5. **Mapping Templates:** For new bank deployments, a pre-built mapping template (mapping the standard FFIEC chart of accounts to standard statement lines) would dramatically reduce setup time.

6. **Mapping Version History:** Currently, overwriting a mapping loses the previous mapping. Versioning would allow rollback and change tracking.

---

### 21.6 Validation Result

#### Purpose

A Validation Result represents the output of any check that assesses whether data, a calculation, a mapping, or a configuration meets its required quality threshold. Validation Results are NOT errors — they are structured diagnostics that tell the finance user: "Here is what was checked, here is the result, here is whether it passed, and here is what to do if it didn't."

The platform philosophy is "Validation precedes analytics. If data is not trusted, reports are worthless." Validation Results are the mechanism by which this philosophy is operationalized. Every validation result is a piece of evidence in the trustworthiness of the platform's output.

**Current implementation status: EXISTS, but not formalized as a distinct entity.** Validation Results appear throughout the platform in multiple forms — load test diagnostics, mapping completeness counts, allocation row audits, balance check rows, income check rows, error banners, and warning messages — but they are not collected into a unified Validation Result entity. Each validation produces its output independently and renders it in its own UI location.

#### Relationships

| Related Entity | Nature of Relationship |
|---|---|
| **Data Load** (`loadTestSummary`) | Every data load produces Validation Results: raw row count, normalized count, skipped count, missing columns, date coverage, account coverage, branch coverage. These collectively answer "Is the data complete?" |
| **GL Account** / **Mapping** | Mapping completeness checks produce Validation Results: "X unmapped accounts with current activity." This tells finance users whether all GL accounts are accounted for in the reporting structure. |
| **Organization Node** | Organization mapping checks produce Validation Results: "Y branch numbers in the data have no organization hierarchy entry." This tells finance users whether all branches are represented in the org structure. |
| **Allocation Row** | Allocation audits produce Validation Results: count, total amount, and branch coverage of allocation entries. This answers "Did the cost allocation system run this month?" |
| **Balance Check** (`renderBalanceCheckRow`) | The fundamental accounting equation validation produces a Validation Result: Total Assets − Total Liabilities and Capital. If the absolute value exceeds $1, the result is "Out of balance." |
| **Income Check** (`renderIncomeCheckRow`) | Yield Statement Net Income vs. GL Net Income produces a Validation Result. A discrepancy indicates a missing income/expense GL code in the line definitions. |
| **Budget Mapping** | Budget mapping completeness checks produce Validation Results: "Z unmapped budget lines." This tells finance users whether all budget rows are linked to statement rollups. |
| **Statement Line** (`statementMeasureHasValue`) | During rendering, each statement line's measure is validated for significance. Lines with zero balance and zero income in branch-filtered views are suppressed — this is a soft validation. |
| **Liquidity Ratio** (`ratioStatus`) | Each liquidity ratio produces a Validation Result on every projected month: OK (green), EWI 1 (yellow), EWI 2 (red), or Limit (red). These are forward-looking validations — "will this ratio breach its limit in a future month?" |
| **Allocation Source** (`allocationSourceWarningText`) | When the most recent month has zero allocation rows but prior months had activity, a Validation Result is produced: warning that the data source may be stale. |

#### Dependencies

- **Data Pipeline** (subsystem B) — Produces the raw counts that feed load test validation results.
- **Mapping Engine** (subsystem E) — Produces mapping completeness counts.
- **Calculation Engine** (subsystem D) — Produces balance check and income check values.
- **Liquidity Projection Engine** (subsystem M) — Produces ratio status validations.
- **Error Handling** (subsystem N) — The error banner is a special type of Validation Result (a fatal one).
- **Rendering Engine** (subsystem G) — Displays validation results in their respective UI locations.

#### Lifecycle

```
GENERATION:
  Data load validation results → produced at startup and on every data refresh
  Mapping validation results → produced on every render of the Mapping Review panel
  Allocation validation results → produced on every render when branch-filtered
  Balance/Income check results → produced on every render of the MoM/QoQ/YTD statement
  Ratio validation results → produced on every render of liquidity output
  Source warning results → produced when allocation audit detects anomalies
  Error banner results → produced asynchronously when errors occur

DISPLAY:
  Load test → Settings > Data Loading Test panel (card grid + text summary)
  Mapping completeness → Mapping Review panel status banner + receipt
  Allocation audit → Load test panel + current data load audit text
  Balance/Income check → Bottom of yield statement tables (Balanced/Out of balance)
  Ratio status → Liquidity ratio table (color-coded cells)
  Source warning → Load test panel warning text
  Error banner → Fixed-position red banner at top of page

RESOLUTION:
  Data load issues → reload data from correct folder
  Mapping gaps → map unmapped accounts/branches in Mapping Review
  Allocation gaps → verify allocation system ran; check folder connection
  Balance check failure → investigate missing/misclassified GL accounts
  Income check failure → investigate missing income/expense GL codes in line definitions
  Ratio breach → adjust growth assumptions or escalate to ALCO
  Source warning → reconnect to correct input files folder

PERSISTENCE:
  NO formal persistence. Validation Results are ephemeral — they are recomputed on every render.
  The load test summary (`loadTestSummary`) persists in memory for the session.
  Allocation audit results persist in memory.
  Error messages accumulate in `window.__yieldStartupErrors` for the session.
```

#### Future Evolution

1. **Unified Validation Registry:** Currently, validation results are scattered across multiple UI locations and memory variables. A unified Validation Registry would collect ALL validation results into a single data structure, enabling a "Dashboard Health" summary page that shows the overall trustworthiness of the platform's output at a glance.

2. **Validation Severity Levels:** Every Validation Result should carry a severity: Info (advisory), Warning (should be reviewed), Error (must be fixed before report can be trusted), Critical (platform cannot operate). Currently, severity is implicit in the UI treatment (red banner = critical, yellow ratio cell = warning).

3. **Validation History:** Validation Results should be logged over time. "Last month the balance check passed; this month it fails" is more informative than "this month it fails." Historical validation data enables trend analysis — is data quality improving or degrading?

4. **Validation Dashboard:** A dedicated "Validation" tab showing all validation results in one place, with drill-down to affected accounts/branches/mappings and one-click navigation to fix.

5. **Pre-Export Validation Gate:** Before any report is printed, exported to Excel, or presented to the board, run all validations and block the export if any Error-level validation fails. This prevents distributing reports with known data quality issues.

6. **Automated Validation Scheduling:** When the platform connects to live data folders, validations should run automatically on a schedule (e.g., every morning after the GL close) and alert finance users to issues before they start their analysis.

---

## Entity Interaction Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                        ENTITY INTERACTIONS                            │
│                                                                       │
│  ┌──────────┐         ┌──────────────┐         ┌──────────────────┐  │
│  │ SCENARIO │────────▶│ GROWTH       │────────▶│ LIQUIDITY        │  │
│  │          │  owns   │ ASSUMPTIONS  │  feeds  │ PROJECTION       │  │
│  │          │         │              │         │                  │  │
│  │          │────────▶│ LIQUIDITY    │────────▶│ (project())      │  │
│  │          │  owns   │ CAPACITIES   │  feeds  │                  │  │
│  │          │         │              │         └────────┬─────────┘  │
│  │          │         └──────────────┘                  │            │
│  └──────────┘                                           │            │
│       │                                                 ▼            │
│       │ references                              ┌──────────────────┐ │
│       ▼                                         │ LIQUIDITY        │ │
│  ┌──────────────┐                               │ CATEGORY         │ │
│  │ BUDGET       │                               │                  │ │
│  │ VERSION      │                               │ • Starting       │ │
│  │              │                               │   Balance        │ │
│  │ • contains ──┼────────┐                      │ • Growth Rate    │ │
│  │   Budget     │        │                      │ • Contractual CF │ │
│  │   Lines      │        │                      └────────┬─────────┘ │
│  └──────────────┘        │                                │           │
│                          │                                │           │
│  ┌──────────────┐        │         ┌──────────────────┐   │           │
│  │ METADATA     │        │         │ VALIDATION       │◀──┼───────────┤
│  │ MAPPING      │◀───────┼────────▶│ RESULT           │   │           │
│  │              │  maps  │  passes │                  │   │           │
│  │ • Quick GL ──┼── GL account →   │ • Balance Check  │◀──┤ checks    │
│  │   Mapping    │  to statement    │ • Income Check   │   │           │
│  │ • Budget Line│── budget line    │ • Mapping Audit  │◀──┤           │
│  │   Mapping    │  to statement    │ • Allocation Aud.│   │           │
│  │ • Org Map    │── branch to org  │ • Ratio Status   │◀──┤           │
│  │ • Acct Node  │  unit            │ • Load Test      │   │           │
│  │   Rollup     │                  └──────────────────┘   │           │
│  └──────────────┘         │                                │           │
│                          │                                │           │
│  ┌──────────────┐        │         ┌──────────────────┐   │           │
│  │ JOURNAL      │◀───────┘         │ LIQUIDITY        │◀──┘           │
│  │ ENTRY        │   generated by   │ RATIO            │               │
│  │ (planned)    │   future engines │                  │               │
│  │              │                  │ • Target/EWI     │               │
│  │ • Allocation │                  │ • Direction      │               │
│  │ • FTP        │                  │ • Status per mo. │               │
│  │ • Plug       │                  └──────────────────┘               │
│  │ • Budget JEs │                                                     │
│  └──────────────┘                                                     │
│                                                                       │
│  KEY:                                                                 │
│  ────▶ = feeds data into                                              │
│  ◀──── = produces data for / validates                                │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

**End of Business Rules Catalog**
