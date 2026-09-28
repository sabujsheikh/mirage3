# Mirage Perfume ERP Progress

## Active phase
Phase 1 foundation stabilization.

## This session
- Built and integrated dedicated Accounting and Reconciliation views per AGENTS.md §37 audit baseline:
  - **Reconciliation View (`/accounting/reconciliation`)**: Unified 3-sub-tab reconciliation hub covering Steadfast Courier COD payouts, Bank Statements (BRAC/City/Personal Bank, statement ending balance comparison, double-entry clearing, fee adjustment posting), and MFS Mobile Wallets (bKash & Nagad merchant statements, cashout fee tracking, customer payment ledger matching).
  - **Income View (`/accounting/income`)**: Product sales revenue, delivery income, net realized revenue breakdown, revenue by sales channel (Online vs Showroom Walk-in POS), top earning SKUs, and income journal entries with date and channel filters.
  - **Payments View (`/accounting/payments`)**: Section 15.5 transaction list covering all payment methods (Cash, bKash, Nagad, Bank, Courier COD), status filtering (Completed, Pending, Refunded), transaction search, and split-payment visibility.
  - **Payable & Receivable View (`/accounting/payable-receivable`)**: Combined dashboard displaying Accounts Receivable (Steadfast Courier COD in transit, in-house staff collections, customer receivables) alongside Accounts Payable (Dubai international perfume suppliers, freight, local operating payables) with aging brackets (Current, 1-15d, 16-30d, 31-60d, 60d+).
- Enhanced Server APIs:
  - Added `POST /api/accounting/reconcile-bank` and `POST /api/accounting/reconcile-mfs` with automated journal postings for bank maintenance and MFS cashout gateway fees.
  - Enriched `GET /api/accounting/reconciliation` to serve bank accounts, bank journal transactions, and MFS journal transactions.
- Fixed `reference_type` and `PageHeader` property alignments; both `lint_applet` and `compile_applet` pass cleanly with 0 errors.

## Prior session
- Corrected order cancellation to allow every non-cancelled lifecycle state.
- Preserved reservation release for confirmed orders and physical recovery requirements after stock leaves the shelf.
- Enforced the documented cancellation reason categories at the API boundary.
- Made cancellation available in the order workspace regardless of staff tier, matching the universal cancellation rule.
- Changed order confirmation feedback to a compact bottom-right toast that auto-dismisses after 3 seconds while keeping print and navigation actions available.
- Moved Packing to one standalone top-level sidebar item and removed its duplicate entries from Orders and Operations; Operations now contains only Packaging Materials.
- Strengthened sidebar current-page highlighting with a visible gold inset marker, higher contrast, and `aria-current` for active navigation items.
- Restricted courier booking controls to Today's Orders; All Orders now shows the selected fulfillment service as read-only, including the service selected or later edited on the order.
- Fixed mojibake in the Orders Glance column by replacing the broken pending hourglass text with an encoding-safe Pending label.
- Added a Placed By column to the shared Today’s Orders and All Orders table, using the saved order creator name; order details already show the same creator.
- Repositioned Placed By immediately before Glance and softened its text to the secondary color with normal weight.
- Ran the Automated mojibake transform across all `src/` and `server/` TS/TSX sources (51 files changed). Each of the 13 broken/misencoded symbols (৳ — → ✓ ✕ ✅ ✨ ❌ − ≈ • · 🔥) was replaced contextually with JSX entities (`&#2547;`) where it sits in JSX text/attributes or unicode escapes (`\u09F3` / `\u{1F525}`) everywhere else (strings, templates, comments). Files were rewritten as clean UTF-8 with BOM preserved.

## Incomplete
- Physical barcode scan-back remains a separate inventory workflow and is not part of cancellation itself.
- Authentication and durable persistence remain outstanding production blockers from the audit baseline.
- Remaining broadband check items: confirm post-transform runtime rendering has no broken glyphs (esbuild JSX entity validation passed; real-browser spot check still worthwhile), and review `.md` files (kept as clean UTF-8, no conversion).

## Open questions
- None added this session.