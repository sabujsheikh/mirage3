# AUDIT REPORT — Mirage Perfume ERP

**Audit Date:** 2026-09-04
**Auditor:** OpenCode (automated full codebase audit)
**Scope:** Full system — AGENTS.md spec vs. actual implementation vs. PROGRESS.md claims
**Files Inspected:** `server.ts` (1695 lines), `server/db.ts` (5448 lines), `server/parser.ts`, `server/courierService.ts`, `src/types.ts`, `src/context/AuthContext.tsx`, `src/App.tsx`, `src/lib/nav-config.ts`, `src/index.css`, `src/components/layout/Sidebar.tsx`, `src/components/dashboard/DashboardView.tsx`, `src/components/accounting/*`, `src/components/orders/*`, `src/components/packing/PackingView.tsx`, `src/components/pricing/*`, plus directory-level scans of all 15 component subdirectories.

---

## A. Foundation Status

| Module | Status | Summary |
|--------|--------|---------|
| **Authentication** | **BROKEN** | No login screen, no passwords, no sessions, no auth middleware. Zero security on any endpoint. |
| **Roles & Permissions** | **PARTIALLY WORKING** | Tier+toggle model exists in data model and frontend `can()`. Server-side: zero enforcement. Tier names don't match spec. |
| **Products / SKU / Barcode** | **WORKING** | 130+ real SKUs seeded. All fields present (gender, concentration, wholesale, bundle_components). Code128 barcodes. Bulk CSV import. Soft-delete. |
| **Inventory / Stock Ledger** | **WORKING** | On-hand/reserved/available model correct. Stock movements append-only. Weighted-average costing correct. Two warehouses. No negative inventory. |
| **Stock Receiving / Opening Balance** | **WORKING** | WAC recalculation correct. Opening balance posts correctly. Import receiving with batch + damage routing works. |
| **Orders & Stock Reservation** | **WORKING** | Online: reserve at creation, deduct at pack. Walk-in: immediate deduct. Edit with delta reservation. Cancellation branches by status. Atomic order creation. |
| **Packing / Verification / Dispatch** | **WORKING** | 5-step flow (pack → book → label → verify tracking → dispatch). Barcode verification with audio. Manual fallback. Real Steadfast API calls. |
| **Courier / Steadfast Integration** | **WORKING** | Real API client. Webhook with signature verification (timingSafeEqual). Variance tracking. Batch sync. Payout reconciliation. |
| **Pricing** | **WORKING** | Cost-plus margin floors. Competitor tracking. Seasonal campaigns. Reprice suggestions. |
| **Customers** | **WORKING** | Phone normalization, multi-address, risk flags, RTO scoring, purchase history. |
| **Accounting / Finance** | **PARTIALLY WORKING** | Double-entry journal engine works. Revenue/COGS timing correct. P&L from journal balances. BUT: 4 of 8 accounting sub-views are mis-routed/aliases. P&L date filter ignored. No dedicated Income/Payments/Payable-Receivable/Reconciliation views. |
| **Audit Log** | **PARTIALLY WORKING** | Append-only writes from every operation. Hash integrity. BUT: no server-side authentication on viewer. Viewer is read-only UI — no way to verify cryptographic chain client-side. |
| **Settings** | **PARTIALLY WORKING** | Company, delivery charges, categories exist. Security settings UI exists. BUT: no session management, 2FA is dead code (no auth to gate). |
| **Reports** | **PARTIALLY WORKING** | Print-ready A4 reports exist (daily sales, inventory, courier, P&L). BUT: data is mostly static/synthetic, not computed from live journal data for chart feeds. |
| **Theme / UI System** | **PARTIALLY WORKING** | Navy & Gold palette correct. Dark mode correct. CSS vars used properly. BUT: 2 of 4 themes missing (Office Blue, Modern Blue). Sidebar flyout not implemented. Duplicate Packing entry in nav. |

---

## B. Critical Problems

### B1. Zero Authentication (Severity: CRITICAL)

**Requirement:** AGENTS.md §37 Login screen, §39.1 hashed passwords, sessions, 30-min idle timeout, login throttling.

**What the code does:** `AuthContext.tsx` starts with `currentUserId = 'usr_owner'` hardcoded. `logout()` just resets to `users[0]`. No login screen rendered — the app starts directly into the dashboard. `server.ts` has **zero** auth middleware — every API endpoint is fully open to anyone who can reach port 3000. No `express-session`, no JWT, no cookies. The `User` type has no `password_hash` field. No bcrypt/argon2 in `package.json` dependencies.

**Files:** `src/context/AuthContext.tsx` (entire file), `server.ts` (entire file — no middleware at all).

**Why it matters:** This is an ERP holding real financial data, real customer PII, and real inventory values. "Internal-only" does not mean "no auth" — the system is web-accessible and needs real login security per §39.1. Without auth, any network-reachable device can create/delete orders, modify financial records, or export customer data.

**Severity: CRITICAL** — This must be fixed before any production deployment. The entire security model is a fiction.

---

### B2. Zero Server-Side Permission Enforcement (Severity: CRITICAL)

**Requirement:** AGENTS.md §19, §20.0a, §34 (permission tests). Packing Staff must not see Accounting/Salary/Expense. Non-owners must not be able to create users.

**What the code does:** `server.ts` has no middleware checking user tier, capabilities, or toggles on any route. `POST /api/users` creates users without auth check. `GET /api/accounting/reports/pnl` returns full financial data without verifying the caller has `view_full_accounting_pnl`. The `DELETE /api/products/:id` has a `confirm_step===3` check but that's a client-supplied value, not a server-side auth gate.

**Files:** `server.ts` (all routes — no middleware), `src/context/AuthContext.tsx` (frontend `can()` is the only enforcement).

**Why it matters:** A Packing Staff user (or any browser with DevTools) can call `GET /api/accounting/reports/pnl` directly and see all financial data. A user can call `POST /api/users` to create admin accounts. Permission enforcement exists only in the UI layer (hiding nav items) — the API is fully open.

**Severity: CRITICAL** — This is a complete bypass of the permission model. The packing staff restriction (§5) is purely cosmetic.

---

### B3. All Data Is In-Memory (Severity: HIGH)

**Requirement:** AGENTS.md §30 recommends PostgreSQL. §39.2 requires daily backups.

**What the code does:** `server/db.ts` uses JavaScript `Map` and `Array` objects as the sole data store. The `db` singleton is the only source of truth. On server restart, all data is lost unless manually backed up/restored via the JSON snapshot system. No actual database (PostgreSQL, SQLite, or otherwise) exists.

**Files:** `server/db.ts` (lines 133-187 — all Map/Array declarations).

**Why it matters:** This is a development prototype, not production-ready. There's no crash recovery (Node.js OOM or unhandled exception = total data loss). No concurrent access safety beyond Node's single-thread guarantee. No query capability (filtering/sorting is done in JS loops). The backup/restore is JSON-in-POST-body — not automated, not encrypted at rest, not off-site.

**Severity: HIGH** — Acceptable for dev/demo, but blocking for production deployment. AGENTS.md Section 30's recommended PostgreSQL + this in-memory architecture are completely out of sync.

---

### B4. No Tests Exist (Severity: HIGH)

**Requirement:** AGENTS.md §34 — unit tests for WAC, payment splitting, refund calculations, profit calculations, invoice numbering, permission checks. Integration tests for order→reservation, packing→stock deduction. Concurrency tests. Permission tests.

**What the code does:** Zero test files in the project. No test framework in `package.json` (no jest, vitest, mocha). No test scripts. `npm run lint` is just `tsc --noEmit` — a type check, not a test suite.

**Files:** Entire project — no `*.test.*`, `*.spec.*`, or `__tests__/` directories.

**Why it matters:** Financial/inventory systems without tests are ticking time bombs. A regression in WAC calculation, reservation logic, or journal posting would silently corrupt data with no automated safety net.

**Severity: HIGH** — Must be addressed before production.

---

### B5. SSE Instead of WebSocket (Severity: MEDIUM)

**Requirement:** AGENTS.md §39.3 — PostgreSQL `LISTEN`/`NOTIFY` combined with WebSockets (e.g. Socket.io) for new-order broadcast.

**What the code does:** `server.ts` implements SSE (Server-Sent Events) via `GET /api/events`. No WebSocket library in `package.json`. SSE is one-directional (server→client), so there's no client→server real-time channel.

**Files:** `server.ts` lines 32-41 (broadcastEvent), lines 1011-1026 (SSE endpoint).

**Why it matters:** SSE works for the broadcast notification use case but doesn't match the spec. It's also less reliable than WebSocket for reconnection handling. Low priority since the functionality works, but it's spec-non-compliant.

**Severity: MEDIUM** — Functional but doesn't match the architecture decision in §39.3.

---

### B6. COGS Cost Snapshot at Wrong Time for Online Orders (Severity: HIGH)

**Requirement:** AGENTS.md §35.1b — online orders' COGS should use `avg_cost` captured at **packing time** (when physical stock leaves), not at order creation. "using avg_cost AT THE TIME of packing (stored on the stock_movement row from 35.1b, not re-fetched now)".

**What the code does:** `createOrder()` at line 508 sets `unit_cost_at_sale: prod.avg_cost` — this captures cost at **order creation**, which for online orders can be days before packing. The `syncCourierStatus` Delivered handler at line 1406 uses `i.unit_cost_at_sale` from these order items. If the product's `avg_cost` changes between order creation and packing (e.g. a new shipment arrives at a different price), the COGS posted to P&L will be stale/incorrect.

**Files:** `server/db.ts` line 508 (cost capture), line 1406 (COGS posting).

**Why it matters:** For a business importing perfumes where costs fluctuate between shipments, this systematic error means every online order's COGS is potentially wrong by the time it's delivered. Over 200+ SKUs and months of operation, this will cause P&L to drift from reality. The spec explicitly resolved this: "using avg_cost AT THE TIME of packing."

**Severity: HIGH** — Systematic financial inaccuracy for all online orders.

---

## C. Missing Foundations

### C1. Login / Authentication Flow
AGENTS.md §37 requires: Login screen (email/phone + password), Forgot password flow, TOTP 2FA challenge step, Session-expired redirect. None of this exists.

### C2. Idempotency Key Infrastructure
AGENTS.md §32.3, §35.6 require client-generated idempotency keys for order creation, payments, refunds, stock receiving, and webhook processing. The `idempotency_keys` table is listed in §41 but doesn't exist in the types or DB. No route-level idempotency checking (except a manual guard on courier booking re-book).

### C3. `pending_scan_back` Entity
AGENTS.md §35.2a requires a `pending_scan_back` table tracking which items from packed/dispatched orders need to be physically scanned back in. This entity doesn't exist in types or DB. Returns currently restock directly without this intermediate tracking step.

### C4. Separate `refunds` Entity
AGENTS.md §41 lists `refunds(id, payment_id, amount, reason, approved_by, created_at)`. The code inlines refunds as `status: 'refunded'` on `PaymentTransaction` records rather than a separate linked entity. This makes partial refund tracking and refund audit harder.

### C5. Income View
AGENTS.md §37 specifies a dedicated "Income" sub-view under Accounting. The route `/accounting/income` currently renders `FinancialReportsView` (P&L) instead. There's no income-entry or income-ledger screen.

### C6. Payments View (Section 15.5 Transaction List)
AGENTS.md §37 specifies "Payments (transaction list — Section 15.5)". The route `/accounting/payments` renders `DailyCashTillView` (cash reconciliation). There's no payment-transaction list view.

### C7. Bank/MFS Reconciliation Tabs
AGENTS.md §37 specifies "Reconciliation — three sub-tabs: Courier, Bank, MFS/bKash-Nagad". Only courier reconciliation exists. No bank or MFS reconciliation sub-tabs.

### C8. Payable & Receivable View
AGENTS.md §37 specifies a combined "Payable & Receivable" view. The route renders `SuppliersView` (supplier payables only). No customer receivable display.

### C9. File Upload Infrastructure
AGENTS.md §25, §15.4 require file/attachment storage for receipts, batch-code photos, supplier documents. No multipart upload endpoint exists. No multer or similar middleware. Product `photo_url` and expense `receipt_url` are URL strings with no upload mechanism.

### C10. Low-Stock Threshold Per Product
AGENTS.md §25 requires a per-product `low_stock_threshold` field. The `Product` type doesn't include this field. Low-stock detection uses a hardcoded comparison rather than configurable thresholds.

---

## D. Documentation / Code Mismatches

### D1. PROGRESS.md Claims vs. Reality

| PROGRESS.md Claim | Reality | Impact |
|---|---|---|
| "All 10 Phases are complete" (line 5) | Phase 10 (hardening/2FA) exists as UI but 2FA is dead code (no auth to gate). Core auth (login/passwords/sessions) is entirely missing. | Inflated completion status. |
| "npm run lint passes 0 errors" | True — but `lint` is just `tsc --noEmit`, not a real test suite. No actual tests exist. | Misleading quality signal. |
| "Session 22: Walk-in POS split payments verified end-to-end via live API" | The API verification is real, but the server has zero auth — "live API" means unauthenticated calls. | Verification was real but security context is missing. |

### D2. AGENTS.md §41 Data Model vs. Implementation

| §41 Entity | Implementation | Status |
|---|---|---|
| `refunds` | Inlined in `PaymentTransaction.status` | Missing as separate entity |
| `pending_scan_back` | Not implemented | Missing |
| `idempotency_keys` | Not implemented | Missing |
| `categories` (as entity) | Categories are string values, not a separate table | Partially implemented |
| `approval_rules` (configurable) | Only `ApprovalRequest` exists, no configurable `ApprovalRule` | Missing |
| `counters` (for numbering) | In-memory private fields on `MirageDB` class | Partially implemented |

### D3. AGENTS.md §36.1a Theme Count

| Spec | Reality |
|---|---|
| 4 themes: Navy & Gold, Office Blue, Modern Blue, Dark | Only 2 themes: Light (Navy & Gold) and Dark |

### D4. AGENTS.md §36.4 Nav Groups

| Spec | Reality |
|---|---|
| 13 top-level groups | 12 entries + extra `operations` group not in spec |
| `Packing` as standalone top-level group | `Packing` duplicated under both `orders` and `operations` children |
| No "Operations" or "Packaging Materials" | `operations` group added (Session 18) — not in AGENTS.md spec |

### D5. AGENTS.md §20.0 Tier Names

| Spec | Implementation |
|---|---|
| Owner, General Manager, Manager, Packing Staff | Owner (tier 1), Accountant (tier 2), Showroom & Sales (tier 3), Packing Team (tier 4) |

Tier 2 and 3 have different names than specified. Also, §20.0 says GM should have "no create/edit/delete/approve capability by default" but the code gives tier 2 `manage_accounts` and `view_salary_data` by default.

### D6. AGENTS.md §36.5 "Filled Plum Button" vs. Implementation

Section 36.5 says "primary action = filled plum button" but the actual primary color is deep navy `#16324F`, not plum. This appears to be a leftover from an earlier palette that was changed.

### D7. SSE vs. WebSocket (Section 39.3)

| Spec | Reality |
|---|---|
| PostgreSQL LISTEN/NOTIFY + WebSockets (Socket.io) | SSE (Server-Sent Events) only |

---

## E. Accounting Audit Findings

### E1. Double-Entry Journal Engine: WORKING

`postJournal()` (db.ts:293-344) validates balanced debits/credits within ৳0.01 tolerance. Account balances are updated incrementally. 24 chart-of-accounts accounts seeded with correct types (Asset, Liability, Equity, Income, Expense). Entry numbering is sequential (`JE-2026-NNNNN`). This is a real, working double-entry system.

### E2. Revenue Recognition Timing: CORRECT

- **Walk-in sales** (db.ts:617-651): Journal posted immediately at sale time. Dr Cash/Bank/MFS, Cr Sales Revenue, Cr Delivery Income (if >0), Dr COGS, Cr Inventory. ✅
- **Online/courier orders** (db.ts:1386-1433): Journal posted only when `syncCourierStatus` processes a `delivered` event. Dr Courier Receivable, Cr Sales Revenue, Cr Delivery Income, Dr COGS, Cr Inventory. Idempotency guard (`alreadyDelivered` check) prevents double-posting. ✅
- **Courier payout** (db.ts:1473-1488): Dr Bank (net payout), Dr Courier Expense (Steadfast fee), Cr Courier Receivable (full COD). ✅

### E3. Walk-in COGS Journal: CORRECT

COGS is computed from each component's `prod.avg_cost` at sale time (db.ts:633-637). Dr COGS, Cr Inventory. ✅

### E4. Online Order COGS: SUBTLY WRONG (see B6 above)

COGS uses `unit_cost_at_sale` captured at **order creation**, not at packing. For online orders that may be created days before packing, this is stale if avg_cost changes in between. The spec explicitly says to capture at packing time (§35.1b).

### E5. Delivery Charge Accounting: CORRECT

Delivery income is posted as a separate `acc_deliv_inc` credit line, distinct from product sales revenue. This matches §15.0a's requirement to keep delivery income separate for reporting clarity. ✅

### E6. P&L Report: PARTIALLY BROKEN

`generateProfitLossReport()` (db.ts:3422-3485) accepts `start_date` and `end_date` parameters but **ignores them entirely** — always reports cumulative YTD figures from account balances. A user selecting "January 2026" will see all revenue from all time, not just January. This makes the P&L date filter useless.

**File:** `server/db.ts` lines 3459 (date parameters accepted but not applied to filter journal lines).

### E7. Seed Data: Direct Balance Mutations

Seed initialization (db.ts:5189-5193, 5236-5240) directly modifies `account.balance` for seeded expenses and payroll without creating corresponding journal entries. This means seed demo data has no journal trail — live transactions are fine but seed data is inconsistent. Low severity since seed data is demo-only.

### E8. Accounting Sub-Views: Mostly Aliases

| Sub-View | Route Target | What It Actually Shows |
|---|---|---|
| Transaction Ledger | `/accounting/ledger` → `JournalView` | ✅ Real journal ledger |
| Income | `/accounting/income` → `FinancialReportsView` | ⚠️ Shows P&L, not income entries |
| Expenses | `/accounting/expenses` → `ExpensesView` | ✅ Real expense entries |
| Payments | `/accounting/payments` → `DailyCashTillView` | ⚠️ Shows cash reconciliation, not payment transactions |
| Salary & Payslips | `/accounting/salary` → `PayrollView` | ✅ Real payroll |
| Reconciliation | `/accounting/reconciliation` → `CourierBookingsView` | ⚠️ Courier only, no Bank/MFS tabs |
| Payable & Receivable | `/accounting/payable-receivable` → `SuppliersView` | ⚠️ Supplier payable only, no customer receivable |
| Profit & Loss | `/accounting/pnl` → `FinancialReportsView` | ✅ Real P&L (but date filter broken per E6) |

### E9. Testers/Damaged Stock Accounting: CORRECT

Tester conversion (db.ts:2856-2869): Dr Tester Expense, Cr COGS. Damaged writeoff (db.ts:2891-2904): Dr Damaged Loss Expense, Cr COGS. Both properly expense from inventory without touching sales revenue. ✅

### E10. Customer Return Journal Entries: CORRECT

Return restock (db.ts:2824-2834): Dr Inventory, Cr COGS (restores asset). Tester allocation: Dr Tester Expense, Cr COGS. Damaged: Dr Damaged Loss, Cr COGS. Refund: Dr Sales Returns, Cr Refund Account. RTO courier fee: Dr Courier Expense, Cr Courier Receivable. All properly double-entry balanced. ✅

---

## F. Recommended Fix Order

### Phase 0 — CRITICAL SECURITY (must complete before anything else)

| # | Fix | Severity | Effort |
|---|-----|----------|--------|
| 1 | **Add real authentication**: login screen, bcrypt password hashing, session management (JWT or express-session), 30-min idle timeout | CRITICAL | High |
| 2 | **Add server-side auth middleware** to every API route | CRITICAL | Medium |
| 3 | **Add server-side permission checks** per route (check user tier + toggles before allowing action) | CRITICAL | Medium |
| 4 | **Add login throttling** (failed-attempt tracking per account/IP) | CRITICAL | Low |

### Phase 0b — DATA PERSISTENCE

| # | Fix | Severity | Effort |
|---|-----|----------|--------|
| 5 | **Migrate from in-memory to PostgreSQL** (or at minimum SQLite for single-server) | HIGH | High |
| 6 | **Implement idempotency key infrastructure** (§35.6) | HIGH | Medium |

### Phase 1 — FINANCIAL CORRECTNESS

| # | Fix | Severity | Effort |
|---|-----|----------|--------|
| 7 | **Fix COGS snapshot for online orders** — capture `avg_cost` at pack time, not order creation (§35.1b) | HIGH | Medium |
| 8 | **Fix P&L date filtering** — filter journal lines by date range, don't just use cumulative balances | HIGH | Medium |
| 9 | **Build missing accounting sub-views**: Income, Payments (transaction list), Bank/MFS Reconciliation, Payable & Receivable | HIGH | High |

### Phase 2 — TESTING

| # | Fix | Severity | Effort |
|---|-----|----------|--------|
| 10 | **Set up test framework** (vitest recommended for Vite projects) | HIGH | Low |
| 11 | **Write unit tests** for: WAC calculation, payment splitting, refund calculations, profit calculations, invoice numbering, permission checks | HIGH | High |
| 12 | **Write integration tests** for: order→reservation, packing→stock deduction, courier webhook→journal posting | HIGH | High |
| 13 | **Write concurrency test** (§34): simulate two staff buying last unit simultaneously | MEDIUM | Medium |

### Phase 3 — UI COMPLETENESS

| # | Fix | Severity | Effort |
|---|-----|----------|--------|
| 14 | **Add Office Blue and Modern Blue themes** to CSS (§36.1a) | MEDIUM | Low |
| 15 | **Implement sidebar flyout** for collapsed state (§36.4) | MEDIUM | Medium |
| 16 | **Fix NAV_CONFIG**: remove duplicate Packing, remove `operations` group, make Packing standalone top-level | MEDIUM | Low |
| 17 | **Fix tier names** to match §20.0 (General Manager, Manager instead of Accountant, Showroom & Sales) | LOW | Low |
| 18 | **Make dashboard charts data-driven** (§38) — currently most chart data is hardcoded/synthetic | MEDIUM | Medium |
| 19 | **Add low_stock_threshold per product** (§25) | LOW | Low |

### Phase 4 — MISSING ENTITIES

| # | Fix | Severity | Effort |
|---|-----|----------|--------|
| 20 | **Create `pending_scan_back` entity** (§35.2a) | MEDIUM | Medium |
| 21 | **Create separate `refunds` entity** (§41) | MEDIUM | Medium |
| 22 | **Create configurable `approval_rules` entity** (§26) | LOW | Medium |
| 23 | **Add file upload infrastructure** (§25) | MEDIUM | Medium |

---

## G. What Should NOT Be Changed / New Items Not in AGENTS.md

### G1. Features Built But Not in AGENTS.md

| Feature | Session | Notes |
|---|---|---|
| **Packaging Materials module** (Operations section) | Session 18 | Full CRUD, stock tracking, 16 seeded materials. Not mentioned in AGENTS.md. |
| **Wholesale pricing / retail-wholesale toggle** | Sessions 15, 21 | `wholesale_price` field, Retail/Wholesale toggle in POS, wholesale invoice layout. Not in AGENTS.md spec. |
| **Wholesale price masking** (eye-icon reveal) | Session 21 | Permission-gated visibility with auto-remask. Not in AGENTS.md. |
| **Price change alerts / highlight window** | Session 21 | `price_updated_at` tracking, "New" pill, configurable highlight window. Not in AGENTS.md. |
| **Personal vs. business bank account** selector in POS | Session 22 | `acc_bank_personal` account type. Not in AGENTS.md §15.1's money buckets. |
| **Seasonal promotional campaigns & flash sales** | Session 11 | Pricing campaigns with category/brand/SKU targeting. Not explicitly in AGENTS.md §16-17. |
| **Cryptographic audit hash chain** | Session 10 | `logAudit` computes hash per entry. AGENTS.md §32.8 says "append-only" but doesn't specify cryptographic hashing. This is an enhancement, not a problem. |
| **5-star customer rating** | Session 15 | Interactive rating editor. Not in AGENTS.md §18. |
| **Customer notes / observation field** | Session 15 | Customer profile notes. Listed in §28 as "safe to bolt on later" — already done. |
| **Demo courier API server** | Session 19 | `http://127.0.0.1:4000` mock Steadfast server for development. Not in AGENTS.md but appropriate for dev workflow. |

### G2. Things That Should NOT Be Changed

1. **In-memory DB architecture** — should NOT be replaced with PostgreSQL until authentication and the full data model are stable. Migrating data persistence while also adding auth, fixing accounting, and restructuring views simultaneously is too much change at once.

2. **SSE notification system** — while §39.3 says WebSocket, SSE is functionally adequate for the broadcast notification use case. Don't rip out SSE to add WebSocket unless there's a demonstrated need for bidirectional real-time communication.

3. **Packaging Materials module** — it's outside AGENTS.md scope but it works and doesn't conflict. Leave it. Adding scope documentation to AGENTS.md is better than removing working features.

4. **Wholesale pricing system** — similarly, it's a real business need that works. Don't remove it; document it in AGENTS.md.

5. **Demo courier API server** — essential for development. Keep it.

6. **The existing 4-step dispatch workflow** — it's actually more thorough than the spec requires (pack → book → label → verify → dispatch is 5 steps vs. spec's implied 3-4). This is strictly better than spec minimum. Don't simplify it.

7. **The walk-in POS split payment implementation** — it works correctly, posts correct journal entries, handles personal/business bank. Don't change the accounting logic.

8. **The hash chain on audit logs** — this is an enhancement over the spec's "append-only" requirement. Keep it.

### G3. Features in AGENTS.md But Not Implemented (Beyond Auth)

| Feature | § Reference | Priority |
|---|---|---|
| Forgot password flow | §37, §39.1 | Medium (blocked by auth) |
| Session timeout / idle detection | §39.1 | Medium (blocked by auth) |
| TOTP 2FA enforcement gate | §39.1 | Low (UI exists, no auth to gate) |
| Encrypted API key storage | §39.1 | Medium (keys stored in-memory, no encryption) |
| HTTPS enforcement | §39.1 | Deployment concern, not code |
| Automated backup schedule | §39.2 | Low (manual backup exists) |
| Off-site backup storage | §39.2 | Deployment concern |
| File/attachment cloud storage | §25 | Medium |
| Global search bar | §28 | Low (safe to add later) |
| Bangla UI toggle | §28 | Low (safe to add later) |

---

*End of Audit Report*
