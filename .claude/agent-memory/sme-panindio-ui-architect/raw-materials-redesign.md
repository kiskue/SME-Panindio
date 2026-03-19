---
name: Raw Materials 2025 Redesign Patterns
description: Detailed UI patterns for the Raw Materials 2025 redesign (cards, forms, modals, picker)
type: project
---

## Raw Materials 2025 Redesign Patterns (2026-03-18)
- `RawMaterialCard`: NO left accent bar; 44×44 solid-color icon (catConf.color bg, white emoji); 10px stock bar; inline dot-separated meta row (qty · min · cost/unit); `borderRadius:20`; shadow-only depth (no borderWidth); action btns `borderRadius:full`, `minHeight:48`
- `CATEGORY_CONFIG` in RawMaterialCard now has only `{ label, emoji, color }` — no `lightBg/darkBg` (2025 redesign uses solid bg)
- List screen page bg: `#0F1117` dark / `#F8FAFC` light; card bg: `#1A2235` dark / `#FFFFFF` light
- Stats cards: icon stacked ABOVE number (not beside) — `alignItems:'flex-start'`; 40×40 iconWrap; `borderRadius:20`
- Search bar: `borderRadius:full` (pill), has shadow tokens, `minHeight:48`
- `SectionBadge` sub-component (add/edit screens): 24×24 circle badge with number + section title — replaces old `SectionHeader` with icon+underline
- Danger zone (`[id].tsx`): `flexDirection:'row'` card with 4px red `dangerLeftBar` + inner padding — distinct from form sections
- `dirtyBanner`: amber bordered banner at TOP of scroll content (inside ScrollView, above Section 1) — NOT in the header. Amber bg/border tokens same as low-stock alert.
- `inputBg` in form screens: `#242D42` dark (slightly darker than card `#1A2235`) — distinguishes input from page
- `StockAdjustModal`: preview box shows current→after with delta chip (color-coded) + ArrowRight; confirm btn shows exact action label "Remove 10 pcs" / "Add 10 pcs"; Add active=green `#16A34A`, Remove active stays primary
- `RawMaterialPicker`: trigger btn shows chips for selected materials (uses `sm.rawMaterialName`, NOT `sm.name`); picker modal has category chips + catPill emoji per row; indent spacer now includes catPill width (30 + CHECKBOX_GAP added)
- `SelectedRawMaterial` type fields: `rawMaterialId`, `rawMaterialName`, `quantityRequired`, `unit`, `costPerUnit`, `lineCost` — NO `name` field
- Skeleton cards (3 items) shown on first load when `isLoading && rawMaterials.length === 0`; after first load, pull-to-refresh used instead
- `formatValue` shortens to `₱X.Xk` for values >= 1000 in stats row
- Empty state has 88×88 iconWrap with shadow glow + actionable "Add First Material" button
