# Multi-Tenant SaaS Migration Analysis

**Document:** Assessment of every TexasBank-specific assumption in the current architecture and a plan to evolve the Financial Analytics Platform into a configurable multi-tenant SaaS product without changing any existing business behavior.

---

## Part 1: Current Architecture Analysis

### 1.0 Platform Architecture Summary

The platform is a client-side single-page application with all logic, data, and metadata either embedded at build time or loaded from local network file shares. There is no server, no authentication, no multi-tenancy layer, no API, and no configuration-as-code separation. Every assumption about the operating bank is hardcoded into the source code.

The platform was built for ONE bank. It uses that bank's name, logo, GL chart of accounts, organizational structure, branch hierarchy, file paths, calculation preferences, and sample data as if they were universal truths.

### 1.1 Architecture Patterns That Prevent Multi-Tenancy

| Pattern | Description | Impact |
|---|---|---|
| **Embedded identity** | Bank name, logo, and subtitle are hardcoded in HTML and JS | Cannot display a different bank's brand without code changes |
| **Hardcoded hierarchy data** | Organization tree, account tree, and statement tree are JavaScript constants | Cannot load a different bank's hierarchy without code changes |
| **Hardcoded GL mappings** | ~500 specific GL account codes appear in `momLines[]` line definitions | A bank with a different chart of accounts cannot use the yield statement |
| **Hardcoded reference data** | `referenceAccounts[]`, `referenceHierarchy[]`, `categoryOverrides{}` are TexasBank-specific | A different bank's GL accounts would either be misclassified or unmapped |
| **Hardcoded subtotal exclusions** | 138 GL codes in `ignoredSubtotalAccounts` are TexasBank's specific consolidation codes | A different bank's subtotals would be wrong — either excluded incorrectly or included causing double-counting |
| **Hardcoded business rules** | Audit-forced mapping corrections, frozen statement lines, display defaults encode TexasBank's specific reporting preferences | A different bank with different reporting requirements cannot configure these |
| **Hardcoded file paths** | `F:\Accounting\Treasury\Codex\Yield Statement\` paths are embedded in code AND HTML | A different bank's folder structure cannot be used |
| **Hardcoded sample data** | 250KB+ of TexasBank GL data embedded as gzip-base64 CSV | Serves as fallback data but contains another bank's confidential financials |
| **Single-tenant state model** | All localStorage keys, IndexedDB stores, and in-memory caches assume a single active bank | Switching banks would corrupt or mix data from both banks |
| **Hardcoded calculation constants** | 21% tax rate, specific day count convention assignments, formula overrides | Different regulatory environment or reporting preferences cannot be accommodated |
| **Hardcoded liquidity configuration** | Knight-Doss Family Support, specific ratio thresholds, specific starting month and period range | Different bank's liquidity sources, policies, and reporting periods cannot be used |

---

## Part 2: Complete Inventory of TexasBank-Specific Assumptions

### 2.1 Organization Identity Assumptions (8 categories, 55+ instances)

#### 2.1.1 Bank Name

| Location | Current Value | Type |
|---|---|---|
| `index.html:6` | `<title>TexasBank Yield Statement Dashboard</title>` | HTML |
| `index.html:16` | `TexasBank consolidated treasury view` | HTML |
| `yield-dashboard.js:23` | `"OrganizationName":"TexasBank"` | Hierarchy data |
| `yield-dashboard.js:780` | `name: 'TexasBank'` (default brand) | JS constant |
| `yield-dashboard.js:9598` | Hardcoded `'texasbank'` string comparison | JS logic |
| `liquidity-dashboard.html:6` | `<title>TexasBank Liquidity Dashboard</title>` | HTML |
| `liquidity-dashboard.html:696` | `'Consolidated TexasBank'` | JS/HTML |

#### 2.1.2 Bank Logo

| Location | Current Value |
|---|---|
| `index.html:13` | Embedded base64 PNG of TexasBank logo (the blue/gold shield icon) |

#### 2.1.3 Organization Hierarchy Structure

The entire `organizationNodes[]` array on `yield-dashboard.js:23` is TexasBank's org chart:
- Holding Company (key 900, parent 0)
- TexasBank (key 999, parent 900)
- Commercial Banking Division (key 92, parent 999)
- Central Texas (key 91, parent 92)
- Brown County (key 68, parent 91)
- 01 - Brownwood (key 1, map "1")
- 02 - Market Place (key 2, map "2")
- 03 - Bangs (key 13, map "3")
- 04 - Camp Bowie (key 3, map "4")
- Comanche County (key 69, parent 91)
- 10 - Comanche (key 8, map "10")
- Erath County (key 70, parent 91)
- 05 - Stephenville (key 4, map "5")
- 06 - Graham (key 5, map "6")
- 07 - Dublin (key 6, map "7")
- 09 - Eastland (key 7, map "9")
- Big Country (key 1001, parent optionally 91 or 999)
- Project Eagle (key 1002, map "12", under Big Country)

Plus all the enforcement logic in `ensureRequiredOrganizationNodes()` that GUARANTEES these nodes exist.

#### 2.1.4 Required Organization Node Enforcement

| Location | What It Enforces |
|---|---|
| `yield-dashboard.js:544-618` | `ensureRequiredOrganizationNodes()` — Creates Holding Company (900), Big Country (1001), Project Eagle (1002) if missing |
| `yield-dashboard.js:556` | Recognizes "Holding Company" as a special root node |
| `yield-dashboard.js:589` | Recognizes "Big Country" as a required node |
| `yield-dashboard.js:602-616` | Ensures branch 12 ("Project Eagle") exists under Big Country |

### 2.2 GL Chart of Accounts Assumptions (500+ instances)

#### 2.2.1 Hardcoded GL Account Codes in Statement Line Definitions

The `momLines[]` array at `yield-dashboard.js:2529-2673` contains approximately 500 individual 6-digit GL account codes distributed across 145 statement line definitions. Every single one is TexasBank-specific. Examples:

```javascript
{label:'Commercial Loans', bal:[105040,105050,105070], inc:[300010,300011,300020,300090]},
{label:'Securities', bal:[104299,104399,104403,104413,104499], inc:[303999]},
{label:'Demand Deposits', bal:[201020,201050,201070,201075,201076,201080,201090,201100,201101,201120]},
```

#### 2.2.2 Hardcoded Parent-Child Rollup Relationships

`rollupChildren{}` at `yield-dashboard.js:3573-3607` defines the statement hierarchy parent-child relationships:

```javascript
'Total Commercial Bank': ['Commercial Loans','Consumer Loans','CRE Loans','1-4 Family Investment Loans','Tax Exempt Loans'],
'Gross Loans': ['Total Commercial Bank','Total Mortgage Bank Loans','Other Loan Items'],
```

#### 2.2.3 Hardcoded Reference Accounts

`referenceAccounts[]` at `yield-dashboard.js:22` contains ~500 entries mapping GL account codes to display titles and categories:

```javascript
{type:"Assets", account:"101015", title:"VAULT CASH", category:"Cash"},
{type:"Assets", account:"101065", title:"TELLERS CASH", category:"Cash"},
```

#### 2.2.4 Hardcoded Subtotal Exclusions

`ignoredSubtotalAccounts` at `yield-dashboard.js:2676-2684` contains 138 GL codes that are excluded from ALL calculations. These are TexasBank's specific consolidation/subtotal control accounts.

#### 2.2.5 Hardcoded Category Overrides

`categoryOverrides{}` at `yield-dashboard.js:26-35`:

```javascript
'105300': '1-4 Family Investment Loans',
'501220': 'Gain on Sale of MTG Assets',
'501240': 'MSR Income',
```

#### 2.2.6 Hardcoded June Supplement Data

`juneSupplementParentNodes[]` and `juneAccountSupplements[]` at `yield-dashboard.js:39-75` add TexasBank-specific June 2026 account entries.

#### 2.2.7 Hardcoded Special GL Code Sets

| Location | Purpose | Example Codes |
|---|---|---|
| `yield-dashboard.js:1989-1993` | Wholesale deposit codes | 201095, 201110, 202030-202038, 202040, 202042, 202110, 202125, 203150, 203160, 203170 |
| `yield-dashboard.js:1993` | Borrowing codes | 204020, 204040 |
| `yield-dashboard.js:2737` | Allocation account codes | 605010-605100 (21 codes) |
| `yield-dashboard.js:2738` | Allocation control codes | 605199 |
| `yield-dashboard.js:3307` | `computedMomLines` Set | ~60 statement labels that must always compute from GL data |
| `yield-dashboard.js:3555-3558` | `selectableHiddenChildren` Set | 13 deposit subcategory labels |
| `yield-dashboard.js:3559-3562` | `staticAlwaysDisplayLabels` Set | 2 labels (Pre Provision, PLL) |

### 2.3 Calculation & Reporting Assumptions

#### 2.3.1 Frozen Statement Lines

`embeddedFrozenStatementDefaults` at `yield-dashboard.js:3608-3637`: 29 core statement lines that are always visible and cannot be deleted. This is TexasBank's chosen report structure.

#### 2.3.2 Custom Statement Formulas

`embeddedCustomStatementCalculations` at `yield-dashboard.js:251-260`: 8 built-in formulas defining Earning Assets, NII, Pre-Provision Net Revenue, etc. While these formulas are standard banking calculations, their existence as hardcoded entries that cannot be created or deleted without code changes is TexasBank-specific.

#### 2.3.3 Day Count Convention Assignments

`normalizeAnnualization()` at `yield-dashboard.js:2977-3009` has a hardcoded `fixed` Map that assigns conventions to specific statement labels. This is driven by TexasBank's instrument portfolio composition.

#### 2.3.4 Display Defaults

`embeddedDisplayDefaults` at `yield-dashboard.js:147-195`: 195 specific statement labels that appear as "always displayed" by default. These represent TexasBank's preferred report layout.

#### 2.3.5 Frozen Statement Exceptions

`embeddedSubtotalStyleDefaults` (line 3753-3756) and `embeddedEditableFrozenDefaults` (line 3757-3764) define which statement lines get special styling treatment.

#### 2.3.6 UBPR NIM Tax Rate

At `yield-dashboard.js:3397-3398`: Tax-exempt income gross-up uses `0.79` (1 − 0.21). This assumes a 21% federal corporate tax rate — correct for U.S. C-corporation banks but wrong for S-corporation banks, credit unions, or non-U.S. institutions.

### 2.4 File System Assumptions

#### 2.4.1 Default Folder Paths

| Location | Path |
|---|---|
| `yield-dashboard.js:721` | `F:\Accounting\Treasury\Codex\Yield Statement\Input Files` |
| `yield-dashboard.js:726` | `F:\Accounting\Treasury\Codex\Yield Statement\Settings` |
| `yield-dashboard.js:731` | `F:\Accounting\Treasury\Codex\Yield Statement\Budget` |
| `index.html:452,463,483` | Same paths embedded as default display values in HTML |
| `liquidity-dashboard.html:7` | `F:\Accounting\Treasury\Codex\Liquidity Dashboard\Input Files` |

#### 2.4.2 Shared Workbook Name

`yield-dashboard.js:718`: `const sharedHierarchyWorkbookName = 'Dashboard Hierarchies.xlsx';`

### 2.5 Sample/Embedded Data Assumptions

#### 2.5.1 Embedded GL Data

`index.html:598`: `<script id="embeddedCsv" type="text/plain" data-encoding="gzip-base64">` — 250KB+ of TexasBank's actual general ledger trial balance data spanning approximately 18 months.

#### 2.5.2 Embedded Budget Data

`index.html:599`: `<script id="embeddedApprovedBudget">` — TexasBank's approved budget data.

#### 2.5.3 Default Load Source Name

`yield-dashboard.js:146`: `let sourceName = '20260531 Month End GL File A3.csv'` — TexasBank's specific GL file naming convention.

### 2.6 Liquidity Dashboard Assumptions

#### 2.6.1 Bank-Specific Liquidity Sources

`liquidity-dashboard.html:350-362`: `availableLiquiditySources()` — includes "Knight-Doss Family Support" which is a liquidity backstop specific to TexasBank's ownership structure.

#### 2.6.2 Hardcoded Period Range

`liquidity-dashboard.html:287`: `if (p === '2026-05')` — locks May 2026 as the actual month. `liquidity-dashboard.html:395`: `return ['2026-05','2026-06','2026-Q3','2026-Q4','2027-Q1','2027-Q2']` — hardcoded quarterly view periods.

#### 2.6.3 Hardcoded Ratio Definitions

The `raw.ratios` array embedded in the JSON data defines which liquidity ratios are tracked, their thresholds, and directions. These are TexasBank's board-approved ratio framework.

### 2.7 State & Persistence Assumptions

#### 2.7.1 localStorage Keys

All localStorage keys assume a single bank context:

| Key | Purpose |
|---|---|
| `yieldDashboardHierarchyEditsV2` | Hierarchy edits |
| `yieldDashboardRepositoryFolder` | Repository folder settings |
| `yieldDashboardBudgetFolder` | Budget folder settings |
| `momAlwaysDisplay` | Display preferences |
| `momDisplayDefault` | Default display |
| `quickGlMappings` | GL mappings |
| `budgetLineMappings` | Budget mappings |
| `customStatementCalculations` | Custom formulas |
| `dashboardBrandSettings` | Brand settings |
| `liquidityDashboardRunoffAssumptions` | Liquidity assumptions |

#### 2.7.2 IndexedDB Store Names

| Store | Purpose |
|---|---|
| `YieldStatementDashboardTestImports` | Monthly import cache |
| `monthlyImports` | Import data |
| `processedCache` | Active rows |
| `budgetCache` | Budget rows |
| `detailReportCache` | Detail report cache |

---

## Part 3: Multi-Tenant Evolution Plan

### 3.0 Design Principles

1. **Zero behavior change for existing users.** The platform must produce identical numbers before and after any migration step.
2. **Configuration over code.** Every TexasBank-specific assumption becomes a configurable value with TexasBank defaults.
3. **Tenant isolation.** No data leakage between tenants under any circumstances.
4. **Progressive extraction.** The migration is phased — each phase delivers value independently and can be validated before proceeding.
5. **Backward compatibility.** Any existing localStorage data, IndexedDB cache, or embedded data must continue to work during transition.

### 3.1 Proposed Architecture: The Tenant Configuration Layer

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     TENANT CONFIGURATION LAYER                            │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    Tenant Manifest (JSON)                          │   │
│  │                                                                    │   │
│  │  {                                                                 │   │
│  │    "tenantId": "texasbank",                                        │   │
│  │    "displayName": "TexasBank",                                     │   │
│  │    "legalName": "TexasBank",                                       │   │
│  │    "logoUrl": "data:image/png;base64,...",                         │   │
│  │    "colorPalette": "classic-blue",                                 │   │
│  │    "taxRate": 0.21,                                                │   │
│  │    "entityType": "c-corp",                                         │   │
│  │    "glCodeLength": 6,                                              │   │
│  │    "glAssetRange": [100000, 199999],                               │   │
│  │    "glLiabilityRange": [200000, 299999],                           │   │
│  │    "glIncomeRange": [300000, 399999],                              │   │
│  │    "glExpenseRange": [400000, 699999],                             │   │
│  │    "defaultDataFolder": "F:\\Accounting\\Treasury\\...",           │   │
│  │    "sharedWorkbookName": "Dashboard Hierarchies.xlsx",             │   │
│  │    "subtotalExclusionPatterns": ["*9999", "*999", "*99"],          │   │
│  │    "frozenStatementLines": ["Total Assets", "Net Income", ...],    │   │
│  │    "dayCountAssignments": {                                         │   │
│  │      "Securities": "30/360",                                       │   │
│  │      "FHLB Stock": "90/360"                                        │   │
│  │    },                                                               │   │
│  │    ...                                                              │   │
│  │  }                                                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                Tenant Data Store (per-tenant)                      │   │
│  │                                                                    │   │
│  │  IndexedDB: `tenant_{tenantId}_processedCache`                     │   │
│  │  IndexedDB: `tenant_{tenantId}_budgetCache`                        │   │
│  │  localStorage: `tenant_{tenantId}_hierarchyEdits`                   │   │
│  │  localStorage: `tenant_{tenantId}_quickGlMappings`                  │   │
│  │  localStorage: `tenant_{tenantId}_displayDefaults`                  │   │
│  │  ...                                                               │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │         Hierarchy Data (per-tenant, loaded at runtime)             │   │
│  │                                                                    │   │
│  │  organizationNodes[] ← loaded from shared workbook or API           │   │
│  │  accountNodes[]      ← loaded from shared workbook or API           │   │
│  │  statementNodes[]    ← loaded from shared workbook or API           │   │
│  │  momLines[]          ← loaded from statement-template JSON          │   │
│  │  referenceAccounts[] ← loaded from GL reference data                │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Phase 0: Foundation — Tenant Context (Week 1-2)

**Goal:** Introduce the concept of a "tenant" without changing any existing behavior.

**What to build:**

1. **`TenantConfig` object** — A JavaScript object loaded at startup that holds all TexasBank-specific values currently hardcoded. Initially, this object is populated with the EXACT same values currently in the code. All existing logic continues to use the hardcoded values directly; the `TenantConfig` object is a SHADOW that mirrors them identically.

```javascript
const TenantConfig = {
    // Identity
    tenantId: 'texasbank',
    displayName: 'TexasBank',
    legalName: 'TexasBank',
    documentTitle: 'TexasBank Yield Statement Dashboard',
    
    // Organization
    requiredOrgNodes: [
        {key: 900, parent: 0, name: 'Holding Company', unary: '+', sortOrder: 0, map: ''},
        {key: 999, parent: 900, name: 'TexasBank', unary: '+', sortOrder: 0, map: ''},
        {key: 1001, parent: 91, name: 'Big Country', unary: '+', sortOrder: 1, map: ''},
        {key: 1002, parent: 1001, name: 'Project Eagle', unary: '+', sortOrder: 1, map: '12'},
    ],
    holdingCompanyNames: ['top level holding company', 'holding company'],
    vestigialOrgNames: ['no branch'],
    holdingCompanyKey: 900,
    
    // GL Structure
    glCodeLength: 6,
    glRanges: {
        asset: [100000, 199999],
        liability: [200000, 209999],
        capital: [209000, 299999],
        interestIncome: [300000, 399999],
        interestExpense: [400000, 499999],
        nonInterestIncome: [500000, 599999],
        operatingExpense: [600000, 699999],
    },
    incomeAccountExclusionView: 'Ending Balance',
    incomeAccountExclusionThreshold: 300000,
    
    // Tax
    taxRate: 0.21,
    taxExemptGrossUpFactor: 1 / (1 - 0.21), // 1 / 0.79
    
    // File System
    defaultDataFolder: 'F:\\Accounting\\Treasury\\Codex\\Yield Statement\\Input Files',
    defaultSettingsFolder: 'F:\\Accounting\\Treasury\\Codex\\Yield Statement\\Settings',
    defaultBudgetFolder: 'F:\\Accounting\\Treasury\\Codex\\Yield Statement\\Budget',
    sharedWorkbookName: 'Dashboard Hierarchies.xlsx',
    
    // Brand
    defaultBrand: {
        name: 'TexasBank',
        palette: 'classic-blue',
        subtitle: 'TexasBank consolidated treasury view',
    },
    
    // In Phase 0, ALL other assumptions remain in their current hardcoded locations.
    // TenantConfig is an inventory — it doesn't control behavior yet.
};
```

**Validation gate:** After Phase 0, the platform produces identical output to before. TenantConfig is purely documentary at this stage.

**Files touched:** None (add one new file `shared/tenant-config.js`).

---

### 3.3 Phase 1: Extract Identity & Branding (Week 3-4)

**Goal:** Move all identity-related hardcoded values from code into `TenantConfig`. Replace every `'TexasBank'` string literal with `TenantConfig.displayName`.

**Changes by file:**

| File | Current | After |
|---|---|---|
| `index.html:6` | `<title>TexasBank Yield Statement Dashboard</title>` | `<title id="documentTitle"></title>` — set by JS |
| `index.html:13` | Hardcoded base64 logo | `src` set by JS from `TenantConfig.defaultLogo` |
| `index.html:16` | `TexasBank consolidated treasury view` | Set by JS from `TenantConfig.defaultBrand.subtitle` |
| `yield-dashboard.js:23` | `"OrganizationName":"TexasBank"` | Derived from `organizationNodes[]` loaded data; no longer hardcoded |
| `yield-dashboard.js:780` | `name: 'TexasBank'` | `name: TenantConfig.defaultBrand.name` |
| `yield-dashboard.js:9598` | `normalized === 'texasbank'` | `normalized === TenantConfig.tenantId` |
| `liquidity-dashboard.html:6` | `<title>TexasBank...</title>` | Set by JS |
| `liquidity-dashboard.html:696` | `'Consolidated TexasBank'` | `'Consolidated ' + TenantConfig.displayName` |

**Also extract:**
- `ensureRequiredOrganizationNodes()` → uses `TenantConfig.requiredOrgNodes` instead of hardcoded node creation
- All `'Holding Company'` string comparisons → use `TenantConfig.holdingCompanyNames`
- All `'no branch'` checks → use `TenantConfig.vestigialOrgNames`

**Validation gate:** The TexasBank dashboard renders identically. A test tenant config with `displayName: 'TestBank'` renders with the test name but produces identical numbers.

**Risk:** Very low. Pure string substitution; no calculation logic changes.

---

### 3.4 Phase 2: Tenant-Scoped Persistence (Week 5-6)

**Goal:** Prefix all localStorage and IndexedDB keys with the tenant ID, so two tenants' data never collide in the same browser.

**Implementation:**

1. **Create `tenantKey(baseKey)` function** — Prepends tenant ID to all storage keys:
```javascript
// Before:
localStorage.getItem('quickGlMappings')
// After:
localStorage.getItem(tenantKey('quickGlMappings'))
// Which resolves to:
localStorage.getItem('texasbank_quickGlMappings')
```

2. **Migration on first load:** Detect if old (unprefixed) keys exist. If they do and no prefixed keys exist, read old data and write it under the new prefixed key. This ensures existing TexasBank users don't lose their saved mappings, display preferences, hierarchy edits, or budget configurations.

3. **IndexedDB migration:** Same pattern — `YieldStatementDashboardTestImports` → `texasbank_YieldStatementDashboardTestImports`.

**All affected storage keys:**

| Current Key | New Key Pattern |
|---|---|
| `yieldDashboardHierarchyEditsV2` | `{tenantId}_yieldDashboardHierarchyEditsV2` |
| `yieldDashboardRepositoryFolder` | `{tenantId}_yieldDashboardRepositoryFolder` |
| `yieldDashboardBudgetFolder` | `{tenantId}_yieldDashboardBudgetFolder` |
| `momAlwaysDisplay` | `{tenantId}_momAlwaysDisplay` |
| `momDisplayDefault` | `{tenantId}_momDisplayDefault` |
| `quickGlMappings` | `{tenantId}_quickGlMappings` |
| `budgetLineMappings` | `{tenantId}_budgetLineMappings` |
| `customStatementCalculations` | `{tenantId}_customStatementCalculations` |
| `dashboardBrandSettings` | `{tenantId}_dashboardBrandSettings` |
| `liquidityDashboardRunoffAssumptions` | `{tenantId}_liquidityDashboardRunoffAssumptions` |
| `YieldStatementDashboardTestImports` (IDB) | `{tenantId}_YieldStatementDashboardTestImports` |
| `monthlyImports` (IDB) | `{tenantId}_monthlyImports` |
| `processedCache` (IDB) | `{tenantId}_processedCache` |
| `budgetCache` (IDB) | `{tenantId}_budgetCache` |
| `detailReportCache` (IDB) | `{tenantId}_detailReportCache` |
| All version keys | Same: `{tenantId}_{versionKey}` |

**Validation gate:** Open TexasBank dashboard. Save a mapping. Close browser. Reopen. Mapping persists. Open with `tenantId: 'testbank'` — no TexasBank data appears. Switch back — TexasBank data reappears.

**Risk:** Low (persistence layer only; no calculation logic changes). Migration logic must be carefully tested.

---

### 3.5 Phase 3: Pluggable Hierarchy Data (Week 7-10)

**Goal:** Remove hardcoded hierarchy data from JavaScript source code. Load it at runtime from the shared workbook (existing mechanism), a tenant-specific JSON file, or an API endpoint.

**This is the largest phase.** It touches the most assumptions:

#### 3.5.1 What Gets Extracted

| Current Location | Data | Becomes |
|---|---|---|
| `yield-dashboard.js:23` | `organizationNodes[]` | Loaded at runtime from tenant hierarchy source |
| `yield-dashboard.js:24` | `accountNodes[]` | Loaded at runtime |
| `yield-dashboard.js:25` | `referenceHierarchy[]` | Derived from account tree + reference accounts |
| `yield-dashboard.js:22` | `referenceAccounts[]` | Loaded from tenant GL reference data |
| `yield-dashboard.js:26-35` | `categoryOverrides{}` | Moved to TenantConfig or loaded as mapping data |
| `yield-dashboard.js:39-75` | `juneSupplementParentNodes[]`, `juneAccountSupplements[]` | Loaded as tenant-specific supplemental data |

#### 3.5.2 What Gets Made Tenant-Configurable (Not Removed)

These stay in code but become parameterized by TenantConfig:

| Current Location | Data | TenantConfig Parameter |
|---|---|---|
| `yield-dashboard.js:2529-2673` | `momLines[]` with ~500 GL codes | `statementLineDefinitions` — a JSON structure with the SAME format but loadable per tenant |
| `yield-dashboard.js:3573-3607` | `rollupChildren{}` | Derived from statement hierarchy parent-child relationships OR loaded separately |
| `yield-dashboard.js:3608-3637` | `embeddedFrozenStatementDefaults` | `frozenStatementLines` — list of statement labels that are always frozen |
| `yield-dashboard.js:251-260` | `embeddedCustomStatementCalculations` | `customStatementCalculations` — loadable per tenant |
| `yield-dashboard.js:147-195` | `embeddedDisplayDefaults` | `displayDefaults` — loadable per tenant |
| `yield-dashboard.js:2676-2684` | `ignoredSubtotalAccounts` | `subtotalExclusions` — list of GL codes OR pattern-based rules (e.g., all codes matching `*9999`) |
| `yield-dashboard.js:2977-3009` | Fixed day count assignments | `dayCountAssignments` — map of statement label → convention |
| `yield-dashboard.js:1989-2005` | Wholesale deposit/borrowing codes | `wholesaleDepositCodes`, `borrowingCodes` |
| `yield-dashboard.js:2737-2738` | Allocation account codes | `allocationAccountCodes`, `allocationControlAccountCodes` |
| `yield-dashboard.js:3555-3562` | `selectableHiddenChildren`, `staticAlwaysDisplayLabels` | Consolidated into display configuration |

#### 3.5.3 Loading Mechanism

Three tiers (existing patterns, extended):

1. **Embedded default** (build-time): For self-contained deployment, hierarchy data and line definitions are embedded in the HTML at build time, the same way the Liquidity Dashboard embeds its data today.

2. **Shared workbook** (runtime): The existing File System Access API mechanism for loading `Dashboard Hierarchies.xlsx`. Extended to also load line definitions, reference accounts, and subtotal exclusions from additional sheets in the same workbook.

3. **API endpoint** (future SaaS): For cloud-hosted SaaS, hierarchy data is served from a tenant-specific API endpoint with authentication.

**Validation gate:** Load the TexasBank hierarchy data from external JSON (identical to current hardcoded values). Run the yield statement. Compare every number to the hardcoded version. Must match to the cent.

**Risk:** Medium-High. Many calculation paths depend on the shape of this data. Must move all three trees (organization, account, statement) simultaneously. The `momLines[]` definitions are the highest-risk extraction because they contain GL codes that feed directly into `lineMeasure()`.

---

### 3.6 Phase 4: GL Structure Abstraction (Week 11-13)

**Goal:** Make GL account code format, range classification, and subtotal detection configurable per tenant.

#### 3.6.1 Configurable GL Range Classification

Currently, `categoryFor()` at `yield-dashboard.js:1057-1068` uses hardcoded ranges. Replace with:

```javascript
function categoryFor(row) {
    const account = Number(row.account);
    const ranges = TenantConfig.glRanges;
    
    if (account >= ranges.asset[0] && account < ranges.asset[1]) return 'Assets';
    if (account >= ranges.liability[0] && account < ranges.liability[1]) {
        if (row.name.toUpperCase().includes('DEPOSIT')) return 'Deposits';
        return 'Liabilities';
    }
    if (account >= ranges.capital[0] && account < ranges.capital[1]) return 'Capital';
    if (account >= ranges.interestIncome[0] && account < ranges.interestIncome[1]) return 'Interest Income';
    if (account >= ranges.interestExpense[0] && account < ranges.interestExpense[1]) return 'Interest Expense';
    if (account >= ranges.nonInterestIncome[0] && account < ranges.nonInterestIncome[1]) return 'Noninterest Income';
    if (account >= ranges.operatingExpense[0] && account < ranges.operatingExpense[1]) {
        if (row.name.toUpperCase().includes('NET INCOME')) return 'Net Income';
        return 'Operating Expense';
    }
    return 'Other';
}
```

#### 3.6.2 Configurable Subtotal Detection

Currently, `ignoredSubtotalAccounts` is a hardcoded Set of 138 specific codes. Replace with pattern-based detection PLUS an explicit exclusion list:

```javascript
TenantConfig.subtotalDetection = {
    patterns: [
        /^\d{4}99$/,    // Matches codes like 101999, 102999, 105999, etc.
        /^\d{3}999$/,   // Matches codes like 199999, 299999, 399999, etc.
        /^\d{4}00$/,    // Matches codes like 105100 (some bank core systems)
    ],
    explicitExclusions: [
        '101015', '101065'  // Specific codes that match patterns but are NOT subtotals
    ],
    explicitInclusions: [
        // Specific codes that don't match patterns but ARE subtotals
    ]
};
```

#### 3.6.3 Configurable Income Exclusion Rule

Currently, `normalize()` excludes rows where account ≥ 300000 and view is "Ending Balance." The threshold and view name become TenantConfig parameters.

**Validation gate:** Feed TexasBank GL data through the new configurable pipeline. Compare skipped row counts, valueIndex entries, and calculated rates. Must match exactly.

**Risk:** Medium. Changes the data ingestion path. Edge case: a bank with 7-digit GL codes or non-standard ranges needs to work correctly.

---

### 3.7 Phase 5: Liquidity Configuration Extraction (Week 14-15)

**Goal:** Make all TexasBank-specific liquidity assumptions configurable.

#### 3.7.1 Extractable Liquidity Assumptions

| Current Hardcoded | TenantConfig Parameter |
|---|---|
| "Knight-Doss Family Support" as a liquidity source | `liquiditySources` — configurable array with name + capacity |
| May 2026 as locked actual month | `actualMonth` — date string |
| 2026-05 through 2027-06 as projection period | `projectionStartMonth`, `projectionMonths` |
| Specific ratio definitions | `liquidityRatios` — loaded from config |
| Ratio thresholds (Target, EWI 1, EWI 2, Limit) | Per-ratio configurable thresholds |
| Quarterly view period definitions | Derived from projection period automatically |

#### 3.7.2 Configurable Liquidity Sources

```javascript
TenantConfig.liquiditySources = {
    primary: [
        {name: 'FRB Balance', type: 'balance', category: 'Overnight'},
        {name: 'Brokered CD Capacity', type: 'capacity', key: 'brokeredCdCapacity'},
        {name: 'FHLB Availability', type: 'computed', formula: 'fhlbLine - fhlbOutstanding'},
        {name: 'FRB Line', type: 'capacity', key: 'frbLine'},
    ],
    secondary: [
        {name: 'IB in Other Banks', type: 'balance', category: 'Cash'},
        {name: 'CDARS Capacity', type: 'capacity', key: 'cdarsCapacity'},
        {name: 'Unpledged Securities', type: 'capacity', key: 'unpledgedSecurities'},
        // Knight-Doss becomes just another configurable source — no special treatment
        {name: 'Knight-Doss Family Support', type: 'capacity', key: 'knightDossSupport'},
    ],
    tertiary: [
        {name: 'Fed Funds Lines', type: 'capacity', key: 'fedFundsLines'},
        {name: 'Mortgage Service Assets', type: 'balance', category: 'MSR'},
        {name: 'Mortgage Sales Capacity', type: 'capacity', key: 'mortgageSales'},
    ],
};
```

**Validation gate:** TexasBank liquidity dashboard produces identical available liquidity totals with config-driven sources.

**Risk:** Low-Medium. Liquidity sources are additive; removing or reordering them won't break the projection engine. The ratio engine is more tightly coupled to specific ratio definitions.

---

### 3.8 Phase 6: Remove Embedded Sample Data (Week 16)

**Goal:** Strip TexasBank's actual GL data from the production codebase.

**Changes:**
1. Remove `<script id="embeddedCsv">` from `index.html`
2. Remove `<script id="embeddedApprovedBudget">` from `index.html`
3. Remove the embedded liquidity data from `liquidity-dashboard.html`
4. Replace with a small synthetic sample dataset for demo/testing purposes
5. Production tenants load data from their own folders/files

**The synthetic dataset should:**
- Contain fictional bank data (NOT TexasBank's actual financials)
- Cover enough GL accounts to exercise all calculation paths
- Be labeled clearly as "Demo Data — Not Real Financials"
- Be small enough to not bloat the repository

**Validation gate:** The platform loads the demo dataset on first use. TexasBank production users connect to their actual data folders and never see demo data.

**Risk:** Very Low (removal only; no logic changes). MUST ensure the fallback chain still works — if no tenant data source is configured, the platform gracefully shows the demo dataset rather than crashing.

---

### 3.9 Phase 7: Tenant-Aware API Layer (Future SaaS — Week 17-20)

**Goal:** Introduce a lightweight server component for tenant management in a cloud-hosted SaaS deployment.

**Note:** This phase is only relevant if the platform moves to a hosted SaaS model. It is NOT required for on-premises multi-tenant deployments (where each tenant has their own deployed instance).

**What the server provides:**
1. **Tenant registry** — Which tenants exist, their configuration, their data sources
2. **Authentication** — User login scoped to a tenant
3. **Configuration API** — Serve tenant-specific config, hierarchy data, line definitions
4. **Data proxy** — Proxy file access for cloud-hosted tenants (since File System Access API requires local filesystem access)

**What remains client-side:**
1. All calculation logic (unchanged — the platform's core value)
2. All rendering (unchanged)
3. All user interaction (unchanged)
4. Data caching (IndexedDB, still tenant-scoped)

---

## Part 4: Risk Matrix

| Phase | Risk to Existing Behavior | Effort | Value | Prerequisite |
|---|---|---|---|---|
| 0: Tenant Context | None | 1 week | Documentary | None |
| 1: Identity & Branding | Very Low | 2 weeks | Immediate (white-label) | Phase 0 |
| 2: Tenant-Scoped Persistence | Low | 2 weeks | Required for multi-tenant | Phase 1 |
| 3: Pluggable Hierarchy | Medium-High | 4 weeks | Core multi-tenant capability | Phase 2 |
| 4: GL Structure Abstraction | Medium | 3 weeks | Enables different core systems | Phase 3 |
| 5: Liquidity Configuration | Low-Medium | 2 weeks | Completes configurability | Phase 3 |
| 6: Remove Sample Data | Very Low | 1 week | Compliance / security | Phase 3 |
| 7: Tenant API Layer | None (new code) | 4 weeks | SaaS readiness | Phase 3 |

---

## Part 5: Verification Strategy

For every phase, the verification protocol is:

### 5.1 Golden Output Comparison

1. Run the CURRENT (unmodified) platform against TexasBank's May 2026 data
2. Capture every number from every report, every table, every chart
3. This is the **golden output** — 100% trusted numbers
4. Run the MODIFIED platform against THE SAME data
5. Compare every number against the golden output
6. ANY difference of $0.01 or more is a regression — the phase is not complete

### 5.2 Specific Golden Outputs to Capture

| Report | What to Compare |
|---|---|
| Overview | All 17 KPI card values |
| MoM Yield Statement | All balance, income, and rate columns for all visible lines |
| QoQ Yield Statement | Same |
| YTD Yield Statement | Same |
| Budget Comparison | Actual, Budget, and Variance columns |
| 13-Month Balance Sheet | All 13 months for all balance sheet lines |
| 13-Month Income Statement | All 13 months for all income statement lines |
| Variance Reports | All branch columns |
| Attribution Reports | All rate/volume/mix decomposition |
| Balance Check | Must show "Balanced" |
| Income Check | Must show "Balanced" |
| Liquidity Waterfall | All line items, all months |
| Liquidity Ratios | All ratios, all months, all status classifications |
| Available Liquidity | All sources, all months |

### 5.3 Automated Regression Suite

The golden outputs should be captured as JSON and compared programmatically. A regression runner should:
1. Load the platform
2. Apply a known dataset
3. Iterate through all tabs, all filter combinations, both balance views
4. Capture all rendered values
5. Diff against golden output
6. Report any variance > $0.005

---

## Part 6: Summary of Configurable Parameters

The complete set of parameters that must move from hardcoded to configurable:

### Identity (11 parameters)
1. `tenantId` — Unique identifier
2. `displayName` — Bank name for UI
3. `legalName` — Legal entity name for reports
4. `logoUrl` — Logo image
5. `colorPalette` — Theme selection
6. `documentTitle` — Browser tab title
7. `subtitleTemplate` — Subtitle format string
8. `entityType` — C-corp, S-corp, credit union, etc. (affects tax rate)
9. `taxRate` — Federal corporate tax rate
10. `taxExemptGrossUpFactor` — 1 / (1 − taxRate)
11. `defaultBrand` — Default brand settings

### Organization (6 parameters)
12. `requiredOrgNodes` — Minimum required org tree nodes
13. `holdingCompanyNames` — Recognized root node names
14. `holdingCompanyKey` — Default root key
15. `vestigialOrgNames` — Names to auto-delete
16. `orgMapFieldName` — Field name for branch mapping ("Map")
17. `orgParentFieldName` — Field name for parent reference

### GL Structure (12 parameters)
18. `glCodeLength` — Number of digits (6 for TexasBank)
19. `glRanges` — Range→classification mapping
20. `incomeAccountExclusionView` — View to exclude for income accounts
21. `incomeAccountExclusionThreshold` — Minimum code for income exclusion
22. `subtotalDetection` — Pattern rules + explicit exclusions
23. `glBalanceViewNames` — Canonical balance view names
24. `glIncomeViewNames` — Canonical income view names
25. `branchFieldNames` — Column names that contain branch data
26. `dateFieldNames` — Column names that contain dates
27. `accountFieldNames` — Column names that contain GL codes
28. `amountFieldNames` — Column names that contain amounts
29. `mappingTypeOptions` — Available mapping types

### Statement Lines (5 parameters)
30. `frozenStatementLines` — Core always-visible lines
31. `customStatementCalculations` — Built-in formulas
32. `displayDefaults` — Default always-displayed lines
33. `dayCountAssignments` — Label→convention mapping
34. `subtotalStyleDefaults` — Styling rules

### Special GL Code Sets (8 parameters)
35. `wholesaleDepositCodes` — Wholesale funding GL codes
36. `borrowingCodes` — Borrowing GL codes
37. `allocationAccountCodes` — Allocation GL codes
38. `allocationControlAccountCodes` — Allocation control codes
39. `ftpAccountCodes` — FTP GL codes
40. `computedLineLabels` — Lines that always compute from GL (not reference data)
41. `selectableHiddenChildren` — Deposit subcategories
42. `staticAlwaysDisplayLabels` — Non-removable display lines

### File System (5 parameters)
43. `defaultDataFolder` — Default GL data location
44. `defaultSettingsFolder` — Default settings location
45. `defaultBudgetFolder` — Default budget location
46. `sharedWorkbookName` — Hierarchy workbook filename
47. `defaultSourceNameTemplate` — Default data load source label

### Liquidity (10 parameters)
48. `liquiditySources` — Available liquidity source definitions
49. `actualMonth` — Locked actual starting month
50. `projectionMonths` — Number of months to project
51. `liquidityRatios` — Ratio definitions with thresholds
52. `liquidityCategories` — Balance sheet category definitions
53. `growthRateDefaults` — Default growth assumptions
54. `contractualCashflowCategories` — Categories with contractual CF schedules
55. `ratioStatusLevels` — Threshold level definitions
56. `quarterlyViewMonths` — Month→quarter mapping (can be derived)
57. `liquidityCapacityDefaults` — Default capacity assumptions

### Total Configurable Parameters: 57

---

**End of Multi-Tenant SaaS Migration Analysis**
