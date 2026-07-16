/**
 * Metadata Engine v1 — Platform-Level Semantic Mapping Layer
 *
 * Owns the canonical representation of what every GL account means,
 * in every module context. One account, one mapping record, multiple
 * module destinations.
 *
 * This file is intentionally additive. No existing module behavior
 * is redirected or replaced. Current modules (Yield Statement,
 * Liquidity) continue using their existing logic unchanged.
 *
 * The registry is populated with TexasBank defaults at init time.
 * Future phases will wire modules to consume the registry instead
 * of their embedded/isolated classification systems.
 */

const MetadataEngine = (function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════
  //  VERSION
  // ═══════════════════════════════════════════════════════════
  const REGISTRY_VERSION = 1;

  // ═══════════════════════════════════════════════════════════
  //  REGISTRY — Canonical in-memory state
  // ═══════════════════════════════════════════════════════════

  /**
   * GLAccountMapping — One record per unique 6-digit GL account code.
   *
   * Schema:
   *   account    : string   — canonical 6-digit GL code (e.g. "105040")
   *   name       : string   — display name (e.g. "COMMERCIAL LOANS")
   *   isExcluded : boolean  — true if this account is a subtotal/control
   *                           account excluded from all calculations
   *
   *   yield : {
   *     statementRollup : string  — canonical statement line label
   *                                  (e.g. "Commercial Loans")
   *     mappingType     : string  — "auto" | "balance" | "incexp" |
   *                                  "ftp" | "allocation" | "ignore"
   *     isQuickMapped   : boolean — user-mapped vs auto-classified
   *   } | null
   *
   *   liquidity : {
   *     category            : string  — canonical liquidity category name
   *                                      (e.g. "Loans")
   *     contractualCashflow : string  — associated cashflow schedule key
   *                                      (e.g. "loanRunoff") or null
   *     isMapped            : boolean — explicitly mapped
   *   } | null
   *
   *   budget : {
   *     key  : string — budget line key (lowercase, no spaces)
   *     name : string — original budget row name
   *   } | null
   *
   *   ftp        : null — reserved for FTP module destination
   *   allocation : null — reserved for Allocation module destination
   */
  const accountMappings = new Map();   // Map<string (6-digit GL code), GLAccountMapping>

  /**
   * BudgetLineMapping — Maps a budget workbook line to a statement rollup.
   *
   * Schema:
   *   key    : string  — canonical budget line key (lowercase, stripped)
   *   name   : string  — original budget row name
   *   view   : string  — "Balance" | "IncExp" | ""
   *   rollup : string  — statement line label
   *   type   : string  — "leaf" (included in calculations) |
   *                       "rollup" (audit subtotal, excluded)
   *   ignore : boolean — exclude from all calculations
   */
  const budgetLineMappings = new Map(); // Map<string (budget key), BudgetLineMapping>

  // ═══════════════════════════════════════════════════════════
  //  CANONICAL HIERARCHY TREES
  // ═══════════════════════════════════════════════════════════

  /**
   * OrganizationNode — A node in the bank's organizational structure.
   *
   * Schema:
   *   OrganizationKey      : number  — unique node ID
   *   OrganizationParentKey : number — parent node ID (0 = root)
   *   OrganizationName      : string — display name
   *   UnaryOper             : string — "+" or "-" (consolidation sign)
   *   SortOrder             : number — display ordering
   *   Map                   : string — branch number (leaf nodes only;
   *                                     empty for parent/rollup nodes)
   */
  const organizationNodes = [];

  /**
   * AccountNode — A node in the GL chart of accounts tree.
   *
   * Schema:
   *   AccountKey       : number — unique node ID
   *   AccountParentKey  : number — parent node ID
   *   AccountName       : string — display name (e.g. "101015 - VAULT CASH")
   *   UnaryOper         : string — "+" or "-"
   *   SortOrder         : number — display ordering
   *   Map               : string — 6-digit GL code (leaf nodes only)
   *   AccountType       : string — rollup label (e.g. "Cash")
   *   StatementRollup   : string — same as AccountType
   *   MappingType       : string — "balance" | "incexp" | "ftp" |
   *                                 "allocation" | "ignore" | "auto" | "rollup"
   */
  const accountNodes = [];

  /**
   * StatementNode — A reporting line in the yield statement hierarchy.
   *
   * Schema:
   *   StatementKey       : number  — unique node ID
   *   StatementParentKey  : number  — parent statement line ID
   *   StatementName       : string  — display name (e.g. "Commercial Loans")
   *   SortOrder           : number  — display ordering
   *   Frozen              : boolean — always visible, cannot be collapsed
   *   Annualization       : string  — day count convention override
   *                                    ("30/360" | "90/360" | "ACT/360" |
   *                                     "Actual/365" | "Weighted" | "None")
   */
  const statementNodes = [];

  // ═══════════════════════════════════════════════════════════
  //  MODULE METADATA ENTITIES — Liquidity Domain
  // ═══════════════════════════════════════════════════════════

  /**
   * LiquidityCategory — A balance sheet category used in liquidity
   * projection and analysis.
   *
   * Schema:
   *   categoryKey          : string  — canonical key (camelCase)
   *   displayName          : string  — label used in GL lookups and UI
   *   balanceSheetSide     : string  — "asset" | "liability" | "capital"
   *   sortOrder            : number  — display ordering
   *   contributesToRatios  : boolean — appears in ratio denominators
   *   defaultGrowthRate    : number  — default monthly growth (decimal)
   *   projectedInWaterfall : boolean — appears in the liquidity waterfall
   *   contractualCashflows : string[] — associated cashflow schedule keys
   */
  const liquidityCategories = [];

  /**
   * LiquiditySource — An available liquidity source used in the
   * available liquidity calculation.
   *
   * Schema:
   *   sourceKey     : string — canonical key
   *   displayName   : string — UI label
   *   tier          : string — "primary" | "secondary" | "tertiary"
   *   sourceType    : string — "balance" | "capacity" | "computed"
   *   balanceSource : string — key in projected balances (if sourceType is
   *                              "balance" or part of "computed")
   *   capacityKey   : string — key in state.liquidity capacity map
   *                              (if sourceType is "capacity")
   *   computation   : string — formula description (if "computed")
   *   sortOrder     : number — display ordering within tier
   */
  const liquiditySources = [];

  /**
   * LiquidityRatio — A liquidity ratio definition with thresholds.
   *
   * Schema:
   *   ratioKey    : string  — canonical key
   *   displayName : string  — UI label
   *   direction   : string  — "min" (lower is better) |
   *                            "max" (higher is better)
   *   description : string  — narrative description of what it measures
   *   thresholds  : {
   *     target : number — green zone boundary
   *     ewi1   : number — early warning indicator 1 (yellow)
   *     ewi2   : number — early warning indicator 2 (red)
   *     limit  : number — hard limit (red)
   *   }
   */
  const liquidityRatios = [];

  /**
   * ContractualCashflowCategory — A contractual cashflow schedule
   * applied in liquidity projection.
   *
   * Schema:
   *   cashflowKey         : string — canonical key
   *   displayName         : string — UI label
   *   direction           : string — "inflow" | "outflow"
   *   associatedCategory   : string — liquidity category key this belongs to
   *   scheduleType        : string — "known" (pre-scheduled maturity/paydown) |
   *                                   "behavioral" (modeled runoff)
   */
  const contractualCashflowCategories = [];

  // ═══════════════════════════════════════════════════════════
  //  VALIDATION METADATA
  // ═══════════════════════════════════════════════════════════

  /**
   * FrozenStatementLabels — 29 core statement lines that are always
   * visible in every yield statement view, cannot be collapsed,
   * and cannot be deleted from the hierarchy.
   */
  const frozenStatementLabels = new Set();

  /**
   * AnnualizationDefaults — Statement label → default day count
   * convention. Used as the third tier of convention resolution
   * (after explicit line.dayCount and statementNode.Annualization).
   */
  const annualizationDefaults = new Map();

  /**
   * SubtotalExclusionAccounts — GL account codes that are subtotal
   * or control accounts and should be excluded from all calculations.
   */
  const subtotalExclusionAccounts = new Set();

  // ═══════════════════════════════════════════════════════════
  //  EMBEDDED DEFAULTS — TexasBank (mirrors current hardcoded values)
  // ═══════════════════════════════════════════════════════════

  function initDefaults() {

    // ── Frozen statement lines (29 core lines) ──────────────
    [
      "Short Term Investments", "Total Investments",
      "Total Commercial Bank", "Total Mortgage Bank Loans",
      "Earning Assets", "Gross Loans", "Net Loans",
      "Non Earning Assets", "Total Assets",
      "Demand Deposits", "Total Interest Bearing Deposits",
      "Total Deposits", "Total Funding Liabilities",
      "Total Liabilities", "Total Capital",
      "Total Liabilities and Capital",
      "Net Interest Income/ Spread", "Funds Transfer Pricing",
      "NII after FTP", "Monthly NIM*",
      "Non Interest Income", "Non Interest Expense",
      "Pre Provision Net Revenue", "Provision for Loan Losses",
      "Net Income Before Allocations", "Total Allocations",
      "Net Income", "Return on Avg Assets", "Return on Avg Equity"
    ].forEach(function (label) {
      frozenStatementLabels.add(normalizeKey(label));
    });

    // ── Annualization defaults ─────────────────────────────
    [
      ["securities", "30/360"],
      ["portfolio mortgage loans", "30/360"],
      ["purchased mortgage loans", "30/360"],
      ["net loans purchased", "30/360"],
      ["held for sale", "30/360"],
      ["participations", "30/360"],
      ["total mortgage bank loans", "30/360"],
      ["borrowings", "30/360"],
      ["fhlb stock", "90/360"],
      ["earning assets", "Weighted"],
      ["total investments", "Weighted"],
      ["gross loans", "Weighted"],
      ["net loans", "Weighted"],
      ["total assets", "Weighted"],
      ["total funding liabilities", "Weighted"]
    ].forEach(function (entry) {
      annualizationDefaults.set(entry[0], entry[1]);
    });

    // ── Liquidity Categories (15 balance sheet categories) ─
    [
      {
        categoryKey: "cashAndDue", displayName: "Cash and Due",
        balanceSheetSide: "asset", sortOrder: 1,
        contributesToRatios: false, defaultGrowthRate: 0.0,
        projectedInWaterfall: false, contractualCashflows: []
      },
      {
        categoryKey: "overnight", displayName: "Overnight",
        balanceSheetSide: "asset", sortOrder: 2,
        contributesToRatios: true, defaultGrowthRate: 0.0,
        projectedInWaterfall: true, contractualCashflows: []
      },
      {
        categoryKey: "securities", displayName: "Securities",
        balanceSheetSide: "asset", sortOrder: 3,
        contributesToRatios: true, defaultGrowthRate: 0.0,
        projectedInWaterfall: true,
        contractualCashflows: ["securitiesPaydowns"]
      },
      {
        categoryKey: "loans", displayName: "Loans",
        balanceSheetSide: "asset", sortOrder: 4,
        contributesToRatios: true, defaultGrowthRate: 0.0,
        projectedInWaterfall: true,
        contractualCashflows: ["loanRunoff"]
      },
      {
        categoryKey: "msr", displayName: "MSR",
        balanceSheetSide: "asset", sortOrder: 5,
        contributesToRatios: false, defaultGrowthRate: 0.0,
        projectedInWaterfall: false, contractualCashflows: []
      },
      {
        categoryKey: "otherAssets", displayName: "Other Assets",
        balanceSheetSide: "asset", sortOrder: 6,
        contributesToRatios: false, defaultGrowthRate: 0.0,
        projectedInWaterfall: false, contractualCashflows: []
      },
      {
        categoryKey: "nibDeposits", displayName: "NIB Deposits",
        balanceSheetSide: "liability", sortOrder: 7,
        contributesToRatios: true, defaultGrowthRate: 0.0,
        projectedInWaterfall: true, contractualCashflows: []
      },
      {
        categoryKey: "interestBearingDeposits",
        displayName: "Interest Bearing Deposits",
        balanceSheetSide: "liability", sortOrder: 8,
        contributesToRatios: true, defaultGrowthRate: 0.0,
        projectedInWaterfall: true,
        contractualCashflows: ["interestBearingDepositsRunoff"]
      },
      {
        categoryKey: "correspondentDemand",
        displayName: "Correspondent Demand",
        balanceSheetSide: "liability", sortOrder: 9,
        contributesToRatios: true, defaultGrowthRate: 0.0,
        projectedInWaterfall: true, contractualCashflows: []
      },
      {
        categoryKey: "cdars", displayName: "CDARS",
        balanceSheetSide: "liability", sortOrder: 10,
        contributesToRatios: true, defaultGrowthRate: 0.0,
        projectedInWaterfall: true,
        contractualCashflows: ["cdarsMaturity"]
      },
      {
        categoryKey: "brokeredDeposits", displayName: "Brokered Deposits",
        balanceSheetSide: "liability", sortOrder: 11,
        contributesToRatios: true, defaultGrowthRate: 0.0,
        projectedInWaterfall: true,
        contractualCashflows: ["brokeredDepositsMaturity"]
      },
      {
        categoryKey: "fhlb", displayName: "FHLB",
        balanceSheetSide: "liability", sortOrder: 12,
        contributesToRatios: true, defaultGrowthRate: 0.0,
        projectedInWaterfall: true,
        contractualCashflows: ["fhlbRunoff"]
      },
      {
        categoryKey: "otherLiabilities", displayName: "Other Liabilities",
        balanceSheetSide: "liability", sortOrder: 13,
        contributesToRatios: false, defaultGrowthRate: 0.0,
        projectedInWaterfall: false, contractualCashflows: []
      },
      {
        categoryKey: "capital", displayName: "Capital",
        balanceSheetSide: "capital", sortOrder: 14,
        contributesToRatios: false, defaultGrowthRate: 0.0,
        projectedInWaterfall: false, contractualCashflows: []
      },
      {
        categoryKey: "retainedEarnings", displayName: "Retained Earnings",
        balanceSheetSide: "capital", sortOrder: 15,
        contributesToRatios: false, defaultGrowthRate: 0.0,
        projectedInWaterfall: false, contractualCashflows: []
      }
    ].forEach(function (cat) { liquidityCategories.push(cat); });

    // ── Liquidity Sources (11 sources in 3 tiers) ──────────
    [
      // Primary
      {
        sourceKey: "frbBalance", displayName: "FRB Balance",
        tier: "primary", sourceType: "balance",
        balanceSource: "overnight", capacityKey: null,
        computation: null, sortOrder: 1
      },
      {
        sourceKey: "brokeredCdCapacity",
        displayName: "Brokered CD Capacity",
        tier: "primary", sourceType: "capacity",
        balanceSource: null, capacityKey: "brokeredCdCapacity",
        computation: null, sortOrder: 2
      },
      {
        sourceKey: "fhlbAvailability", displayName: "FHLB Availability",
        tier: "primary", sourceType: "computed",
        balanceSource: "fhlb", capacityKey: "fhlbLine",
        computation: "max(0, fhlbLine - fhlbOutstanding)",
        sortOrder: 3
      },
      {
        sourceKey: "frbLine", displayName: "FRB Line",
        tier: "primary", sourceType: "capacity",
        balanceSource: null, capacityKey: "frbLine",
        computation: null, sortOrder: 4
      },
      // Secondary
      {
        sourceKey: "ibOtherBanks", displayName: "IB in Other Banks",
        tier: "secondary", sourceType: "balance",
        balanceSource: "cash", capacityKey: null,
        computation: null, sortOrder: 5
      },
      {
        sourceKey: "cdarsCapacity", displayName: "CDARS Capacity",
        tier: "secondary", sourceType: "capacity",
        balanceSource: null, capacityKey: "cdarsCapacity",
        computation: null, sortOrder: 6
      },
      {
        sourceKey: "unpledgedSecurities",
        displayName: "Unpledged Securities",
        tier: "secondary", sourceType: "capacity",
        balanceSource: null, capacityKey: "unpledgedSecurities",
        computation: null, sortOrder: 7
      },
      {
        sourceKey: "knightDossSupport",
        displayName: "Knight-Doss Family Support",
        tier: "secondary", sourceType: "capacity",
        balanceSource: null, capacityKey: "knightDossSupport",
        computation: null, sortOrder: 8
      },
      // Tertiary
      {
        sourceKey: "fedFundsLines", displayName: "Fed Funds Lines",
        tier: "tertiary", sourceType: "capacity",
        balanceSource: null, capacityKey: "fedFundsLines",
        computation: null, sortOrder: 9
      },
      {
        sourceKey: "mortgageServiceAssets",
        displayName: "Mortgage Service Assets",
        tier: "tertiary", sourceType: "balance",
        balanceSource: "msr", capacityKey: null,
        computation: null, sortOrder: 10
      },
      {
        sourceKey: "mortgageSalesCapacity",
        displayName: "Mortgage Sales Capacity",
        tier: "tertiary", sourceType: "capacity",
        balanceSource: null, capacityKey: "mortgageSales",
        computation: null, sortOrder: 11
      }
    ].forEach(function (src) { liquiditySources.push(src); });

    // ── Liquidity Ratios (8 ratios from embedded raw.ratios[]) ─
    [
      {
        ratioKey: "loanToDeposits",
        displayName: "Loan to Deposits Ratio",
        direction: "max",
        description: "Loans / Total Deposits",
        thresholds: { target: 0.95, ewi1: 0.9833, ewi2: 1.0, limit: 1.05 }
      },
      {
        ratioKey: "fhlbUtilization",
        displayName: "FHLB Utilization",
        direction: "max",
        description: "FHLB Outstanding / FHLB Line",
        thresholds: { target: 0.75, ewi1: 0.8333, ewi2: 0.9, limit: 1.0 }
      },
      {
        ratioKey: "brokeredToDeposits",
        displayName: "Brokered Deposits Ratio",
        direction: "max",
        description: "Brokered Deposits / Total Deposits",
        thresholds: { target: 0.1, ewi1: 0.15, ewi2: 0.18, limit: 0.2 }
      },
      {
        ratioKey: "cdarsToLiabilities",
        displayName: "CDARS to Total Liabilities",
        direction: "max",
        description: "CDARS / Total Liabilities",
        thresholds: { target: 0.1, ewi1: 0.15, ewi2: 0.18, limit: 0.2 }
      },
      {
        ratioKey: "wholesaleToLiabilities",
        displayName: "Wholesale Funding to Total Liabilities",
        direction: "max",
        description: "Wholesale Funding / Total Liabilities",
        thresholds: { target: 0.3, ewi1: 0.4, ewi2: 0.45, limit: 0.5 }
      },
      {
        ratioKey: "nibToDeposits",
        displayName: "Non Interest Bearing Deposits to Total Deposits",
        direction: "min",
        description: "NIB Deposits / Total Deposits",
        thresholds: { target: 0.15, ewi1: 0.1, ewi2: 0.08, limit: 0.05 }
      },
      {
        ratioKey: "onBalLiquidityRatio",
        displayName: "On Bal Liquidity Ratio (FRB + C&D)/Liabilities",
        direction: "min",
        description:
          "(FRB + Cash & Due) / Total Liabilities — simpler cash-only coverage",
        thresholds: { target: 0.1, ewi1: 0.08, ewi2: 0.05, limit: 0.04 }
      },
      {
        ratioKey: "balLiquidityRatio",
        displayName: "Bal Liquidity Ratio (FRB + C&D+ UP Sec)/Liabilities",
        direction: "min",
        description:
          "(FRB + Cash & Due + Unpledged Securities) / Total Liabilities",
        thresholds: { target: 0.2, ewi1: 0.15, ewi2: 0.12, limit: 0.1 }
      }
    ].forEach(function (ratio) { liquidityRatios.push(ratio); });

    // ── Contractual Cashflow Categories (6 schedules) ──────
    [
      {
        cashflowKey: "securitiesPaydowns",
        displayName: "Securities Paydowns",
        direction: "inflow",
        associatedCategory: "securities",
        scheduleType: "known"
      },
      {
        cashflowKey: "loanRunoff",
        displayName: "Loan Runoff",
        direction: "inflow",
        associatedCategory: "loans",
        scheduleType: "known"
      },
      {
        cashflowKey: "interestBearingDepositsRunoff",
        displayName: "Interest Bearing Deposits Runoff",
        direction: "outflow",
        associatedCategory: "interestBearingDeposits",
        scheduleType: "known"
      },
      {
        cashflowKey: "brokeredDepositsMaturity",
        displayName: "Brokered Deposits Maturity",
        direction: "outflow",
        associatedCategory: "brokeredDeposits",
        scheduleType: "known"
      },
      {
        cashflowKey: "cdarsMaturity",
        displayName: "CDARS Maturity",
        direction: "outflow",
        associatedCategory: "cdars",
        scheduleType: "known"
      },
      {
        cashflowKey: "fhlbRunoff",
        displayName: "FHLB Runoff",
        direction: "outflow",
        associatedCategory: "fhlb",
        scheduleType: "known"
      }
    ].forEach(function (cf) { contractualCashflowCategories.push(cf); });
  }

  // ═══════════════════════════════════════════════════════════
  //  CANONICAL KEY NORMALIZATION
  // ═══════════════════════════════════════════════════════════

  /**
   * Normalize a human-readable label into a canonical lookup key.
   * Trims whitespace and lowercases. This MUST produce the same
   * keys as yield-dashboard.js statementLabelKey() / categoryKey()
   * when those functions are later extracted or consumed.
   *
   * If statementLabelKey() in the Yield Statement applies additional
   * normalization (stripping special characters, collapsing
   * whitespace, etc.), this function must be updated to match
   * before any cross-module lookup is attempted.
   *
   * @param {string} label
   * @returns {string}
   */
  function normalizeKey(label) {
    return String(label || '').toLowerCase().trim();
  }

  // ═══════════════════════════════════════════════════════════
  //  PUBLIC API — Registry inspection (read-only at this stage)
  // ═══════════════════════════════════════════════════════════

  return {

    /** Registry version for snapshot compatibility checks. */
    VERSION: REGISTRY_VERSION,

    /** @type {boolean} — set true by init(), guards against double-init. */
    _initialized: false,

    /** Map<string (6-digit GL code), GLAccountMapping> */
    accountMappings: accountMappings,

    /** Map<string (budget key), BudgetLineMapping>
     *  NOTE: Budget mappings require a compound key of "budgetKey|view"
     *  because the same budget line name can appear in both the
     *  Balance and IncExp views with different amounts. The simple
     *  key field captures the budget line name; the view field
     *  discriminates between views. When migrating from the current
     *  budgetLineMappings[] localStorage array, both dimensions must
     *  be preserved. */
    budgetLineMappings: budgetLineMappings,

    /**
     * OrganizationNode[] — canonical org tree.
     * INTENTIONALLY EMPTY during the scaffold phase. The canonical
     * organizationNodes data currently lives in yield-dashboard.js
     * as a hardcoded const. It will be moved here when the hierarchy
     * extraction phase begins. Do not read this array expecting data
     * until that migration is complete.
     */
    organizationNodes: organizationNodes,

    /**
     * AccountNode[] — canonical account tree.
     * INTENTIONALLY EMPTY during the scaffold phase. Same migration
     * status as organizationNodes above.
     */
    accountNodes: accountNodes,

    /**
     * StatementNode[] — canonical statement hierarchy.
     * INTENTIONALLY EMPTY during the scaffold phase. Same migration
     * status as organizationNodes above.
     */
    statementNodes: statementNodes,

    /** LiquidityCategory[] */
    liquidityCategories: liquidityCategories,

    /** LiquiditySource[] */
    liquiditySources: liquiditySources,

    /** LiquidityRatio[] */
    liquidityRatios: liquidityRatios,

    /** ContractualCashflowCategory[] */
    contractualCashflowCategories: contractualCashflowCategories,

    /** Set<string> — frozen statement label keys (lowercase, normalized) */
    frozenStatementLabels: frozenStatementLabels,

    /** Map<string, string> — label key → day count convention */
    annualizationDefaults: annualizationDefaults,

    /**
     * Set<string> — GL codes excluded from all calculations.
     * INTENTIONALLY EMPTY during the scaffold phase — schema-only.
     * Must later be populated from:
     *   1. Yield Statement's ignoredSubtotalAccounts (138 codes)
     *   2. Liquidity Dashboard's raw.hierarchy.ignoredSubtotalAccounts
     * These two sources must be reconciled into one canonical set.
     */
    subtotalExclusionAccounts: subtotalExclusionAccounts,

    // ── Lifecycle ─────────────────────────────────────────

    /**
     * Initialize the registry with embedded defaults.
     * Call once at startup, before any module queries.
     * Idempotent — safe to call multiple times.
     */
    init: function () {
      if (this._initialized) { return; }
      initDefaults();
      this._initialized = true;
    },

    /**
     * Returns true if the registry has been initialized.
     */
    isInitialized: function () {
      return this._initialized === true;
    },

    // ── Key normalization ─────────────────────────────────

    /**
     * Normalize a human-readable label into a canonical lookup key.
     * Trims and lowercases. Must match yield-dashboard.js
     * statementLabelKey() / categoryKey() behavior for cross-module
     * frozen label and statement name lookups to work correctly.
     *
     * @param {string} label
     * @returns {string}
     */
    normalizeKey: normalizeKey,

    // ── Lookup helpers ────────────────────────────────────

    /**
     * Get a liquidity category by its canonical key.
     * @param {string} key
     * @returns {object|undefined}
     */
    getLiquidityCategory: function (key) {
      return liquidityCategories.find(function (c) {
        return c.categoryKey === key;
      });
    },

    /**
     * Get a liquidity source by its canonical key.
     * @param {string} key
     * @returns {object|undefined}
     */
    getLiquiditySource: function (key) {
      return liquiditySources.find(function (s) {
        return s.sourceKey === key;
      });
    },

    /**
     * Get a liquidity ratio by its canonical key.
     * @param {string} key
     * @returns {object|undefined}
     */
    getLiquidityRatio: function (key) {
      return liquidityRatios.find(function (r) {
        return r.ratioKey === key;
      });
    },

    /**
     * Get a contractual cashflow category by its canonical key.
     * @param {string} key
     * @returns {object|undefined}
     */
    getContractualCashflowCategory: function (key) {
      return contractualCashflowCategories.find(function (cf) {
        return cf.cashflowKey === key;
      });
    }
  };

})();

// Auto-initialize with embedded defaults.
// Modules that need different defaults can call init() again
// before this runs, or re-init after replacing the embedded
// arrays with tenant-specific data.
MetadataEngine.init();
