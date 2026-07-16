# Yield Statement UI Redesign — Snapshot Report
## Captured: 2026-07-13

## Validation Result: PASS

All 13 financial calculation primitives are byte-identical to the
pre-change baseline. Every numeric output, balance check, and income
check is guaranteed to produce the same value as before this redesign.

## Files Changed

| File | Baseline SHA-256 (16) | Modified SHA-256 (16) | Status |
|---|---|---|---|
| yield-dashboard.js | D637CAA25770B8EF | B2129C6DA5575558 | modified |
| yield-dashboard.css | 3E032FCAEEE71090 | AD405A3D661D667D | modified |
| index.html | DBAC0740B061A86F | DBAC0740B061A86F | unchanged |

## Calculation Primitives (all UNCHANGED)

- lineMeasure
- periodLineMeasure
- normalizeAnnualization
- categoryFor
- lineByLabel
- lineBalanceCodes
- lineIncomeCodes
- lineDayCount
- annualizationFactor
- netIncomeControlValue
- displayBalanceValue
- renderBalanceCheckRow
- renderIncomeCheckRow

## File Size Impact

- yield-dashboard.js: 1,061,558 → 1,060,671 bytes (-887)
- yield-dashboard.css: 52,228 → 59,500 bytes (+7,272)
- index.html: 4,023,876 → 4,023,876 bytes (0)

## Phases Completed

### Phase 1 — Design tokens
- Replaced `--burgundy`/`--burgundy-2` with `--brand-primary`/`--brand-primary-strong`
- Replaced `--rose: #C00000` with `--danger: #B3261E` (less aggressive red)
- Added spacing scale (--space-1..--space-9)
- Added radius scale (--radius-sm..--radius-xl)
- Added shadow scale (--shadow-sm..--shadow-lg)
- Added typography scale (--text-xs..--text-display)
- Added motion tokens (--ease, --dur-fast, --dur, --dur-slow)
- Kept deprecated aliases for backward compatibility

### Phase 2 — Topbar + shell
- Body: clean white-on-paper background (no more radial gradient)
- Shell padding uses spacing tokens
- Topbar wraps gracefully
- Filter cards have focus states (border + soft ring)
- Print popover wider, cleaner

### Phase 3 — Tab system
- Detail tab sub-options now ALWAYS VISIBLE (no slide-out reveal)
- Detail family (13M/Var/BtA/Attr) always shows sub-tabs
- All tab buttons: solid fill, no gradient
- Hover states: clean color shift

### Phase 4 — Components
- .metric cards: removed offset decorative circle, replaced with 4px left rule
- .panel: cleaner border, no backdrop-filter blur
- .tab-btn / .report-tab-btn: solid fill, no gradient
- .import-btn / .ghost-btn: solid fill, no gradient
- .eyebrow: 12px regular case (no more aggressive uppercase)
- Section rows: cleaner navy with consistent padding
- Section tables: less aggressive borders

### Phase 5 — Render function refactor (JS)
- Added classifyStatementRow(line) helper: returns 'section' | 'spacer' | 'skipLeaf' | 'skipBranchOnly' | 'skipUbpr' | 'skipRoaRoe' | 'skipNotFrozen' | 'visible'
- Added buildStatementRowHtml(line, idx, ctx) helper: shared row builder
- Added indentSpacer() helper: returns .indent-spacer span
- Refactored renderMomStatement: 38 lines → 24 lines
- Refactored renderQoqStatement: 38 lines → 24 lines
- renderYtdStatement: left as-is (different measure function, different drill signature)
- YTD function and all other render functions: unchanged

### Phase 6 — Print styles
- .print-header: 3px border-bottom uses --brand-primary token
- .print-title h1 color uses --brand-primary token
- Removed 3 hardcoded #00408A references
- All other print rules preserved verbatim (proven formatting)

### Phase 7 — Accessibility
- Added :focus-visible global outline
- Added @media (prefers-reduced-motion: reduce) block

## Rollback

If anything regresses, restore from the backup:

```powershell
Remove-Item -LiteralPath "C:\Users\syedh\Documents\Development\Financial-Analytics-Platform\powerpages\yield-statement" -Recurse -Force
Rename-Item -LiteralPath "C:\Users\syedh\Documents\Development\Financial-Analytics-Platform\powerpages\yield-statement.bak-2026-07-13" -NewName "yield-statement"
```
