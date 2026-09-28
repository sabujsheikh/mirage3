# AGENTS.md — Mirage Perfume ERP (Complete Developer Brief)

This document is the canonical developer brief for the Mirage Perfume ERP.
It contains the intended business rules, engineering invariants, UI conventions,
and the current implementation/audit baseline. Read it before writing code.
When a feature is added or a confirmed decision changes, update the relevant
section. Never assume an implementation is complete merely because a screen
exists; Section 42 records known implementation gaps that must be closed before
production.

---

## 1. Who this is for and what this is

**Business:** Mirage Perfume — a perfume reselling business in Bangladesh.
Products are branded perfumes sourced internationally (e.g. imported from Dubai).

**Sales channels (hybrid, both active today):**
1. **Online/Messenger** — customer chats on Facebook Messenger, negotiates,
   confirms an order.
2. **Physical location** — walk-in customers who smell/test perfumes in person
   before buying.

**Fulfillment methods for an online/Messenger order (confirmed from real
order data — this is a third method, not just two):**
1. **Steadfast courier** — for customers outside the delivery team's local
   reach.
2. **In-house/local delivery** — a staff member personally delivers nearby
   (Dhaka-area) orders by hand, without going through Steadfast at all.
   This has its own accounting treatment: **no Courier Receivable/payout
   reconciliation applies** (Section 15.2's Courier Receivable model is
   specific to Steadfast COD) — payment is collected directly by the
   delivering staff member and recorded like a normal payment transaction
   (Section 15.5) at the point of hand-delivery, closer in nature to a
   walk-in sale's immediate settlement than to a Steadfast COD sale. The
   order should record **which staff member delivered it** for
   accountability.
3. **Self-pickup** — the customer collects the order from the shop in
   person; the order was placed online but fulfilled like a walk-in
   handoff (no delivery charge, no courier involved).

Whichever of the three applies is chosen per order (a field on the order,
not inferred) — Steadfast booking (Section 12) only applies to the first.

**Scale:** 200+ SKUs today, growing. Small team today (owner, manager, packing
staff, accounts person), but the business is **growing fast**. The system's
architecture must be genuinely professional-grade in design quality even
though current scale is small — because this is being built once, by a
non-developer using AI coding tools (previously attempted with Google AI
Studio, now using **OpenCode**), and rebuilding later is costly. Do not treat
"small business" as license to under-build the architecture. Do treat it as
a reason to build in small, working phases rather than everything at once.

**Deployment:** Web-based, **internal-only** (staff/management, not the
public). No signup flow, no SEO, no landing page — but real login security
(hashed passwords, sessions) is still required since real financial data
lives here.

---

## 2. The three core pillars (in priority order)

The user has explicitly named these as the most important parts of the whole
system. Everything else supports these three:

1. **Accounts / Finance** — where every taka in the business is tracked.
2. **Inventory** — accurate, real-time stock across both sales channels.
3. **Correct item packing and dispatch** — the right product reaches the
   right customer, verified by barcode.

---

## 3. The signature automation: Messenger paste → Order

1. Staff pastes the raw copied Messenger confirmation text into a textarea.
2. **Parsing strategy:** try a rule-based parser first (regex for labeled
   lines like "Name:", "Phone:", "Address:", plus phone-number and amount
   pattern matching). Only fall back to an AI call for harder unlabeled text.
3. **AI to use: Gemini API free tier only.** No paid AI API is used anywhere
   in this system — this is the one and only place AI is used at all. If the
   free-tier call fails or is rate-limited, fall back to showing the raw
   pasted text for manual entry — order creation must never be fully blocked.
   **Documented privacy decision (made explicit, not accidental):** this
   means customer name, phone, and address text is sent to Google's Gemini
   API when the fallback parser runs (the rule-based parser needs no
   external call and involves no data leaving the system). This is an
   accepted, deliberate tradeoff for this business, made when free-tier
   Gemini was chosen for this feature — recorded here so it's a conscious
   choice on the record, not a silent side-effect discovered later.

### 3.0a Real example, and product-name matching (grounded in actual data)
A real confirmation message looks like this:
```
Confirm:9
Arif Islam
01999033027
House 47, Road 27, Opposite of Banani Graveyard main gate.
Building Name: Millennium Castle. lift-4.
karus gold-2750 taka
Dunescape-3400 taka
Dealivary charge - 70 taka
Total-6250 taka
```
Note what this reveals about real usage, confirmed against the actual
product data (`Trial_Mirage_Perfumes_Inventory_Sales_Collection_Report.xlsx`,
`Ref`/`Price List`/`Stock` sheets):
- Staff/customers use **short marketing names**, not full product names:
  "karus gold" → the product actually named `Khadlaj Karus Gold Absolu EDP
  100ML` (internal code `KDL006`); "Dunescape" → `Armaf Dunescape EDP
  100ML` (code `AMF002`).
- **Each line gives a price, not an explicit quantity.** The system must
  determine quantity by matching the stated amount against the product's
  known selling price — e.g. "karus gold-2750 taka" with a known unit
  price of ৳2,750 means quantity 1; if the stated amount were ৳5,500 it
  would mean quantity 2. If the amount isn't a clean multiple of the
  known unit price, don't guess — flag it in the preview for manual
  quantity entry rather than silently rounding.
- No explicit "Qty" label is typically present — this is normal for this
  business, not malformed input.

**Product matching algorithm:**
1. Normalize the line's product-name text (lowercase, trim, strip
   punctuation).
2. Match against each product's `perfume_name` (and `brand`, for cases
   where staff types the brand instead) using **fuzzy/partial matching**
   (e.g. substring match plus a fuzzy-distance fallback such as
   trigram/Levenshtein similarity) — not exact-string-only matching, since
   real usage drops words ("Karus Gold" omits "Absolu").
3. If exactly one product matches confidently, use it and its current
   `selling_price` to derive quantity from the stated line amount (above).
4. If **multiple products match ambiguously** (e.g. the same perfume name
   exists in two sizes/concentrations, and the stated amount doesn't
   disambiguate via price), show all candidates in the preview for the
   staff member to pick — don't guess.
5. **If no product matches at all: show a clear alert in the preview**
   ("Product not found: 'xyz' — add it or correct the order manually") —
   the parser must never silently accept/skip an unmatched product line or
   silently omit it from the order.

**Total validation:** sum the matched line totals + delivery charge and
compare against the message's stated total. If they don't match (e.g. the
example above: 2,750 + 3,400 + 70 = 6,220, but the message says
"Total-6250"), show a short, clear flag in the preview: *"Total amount
does not match the calculated amount — expected ৳6,220, message states
৳6,250."* This is a warning shown alongside the editable preview, not a
hard block — staff can still proceed (maybe the customer got a small extra
discount not itemized), but they must see the discrepancy before
confirming, never have it silently absorbed.

### 3.2 Merchant Fulfillment / Dropship orders (confirmed business model)
Some Messenger orders are **merchant-fulfilled / dropship-style** orders. An
external merchant/reseller takes the order from their own end customer, then
Mirage Perfume fulfils it from Mirage inventory and ships it directly to that
end customer on the merchant's behalf.

This is still one normal Mirage order record and uses the existing order →
packing → courier/dispatch workflow. It is not a second inventory or order
system.

**Order model distinction:**
- **Direct / Mirage Perfume order** — Mirage is the selling party shown to the
  customer; normal customer invoice is generated.
- **Merchant Fulfillment order** — Mirage fulfils for an external merchant;
  no normal customer invoice is printed from Mirage for this order; the
  merchant-facing parcel sticker is the required external print.

**Merchant Fulfillment fields (all optional except Merchant Parcel ID):**
- Merchant / Company Name?
- Merchant ID?
- **Merchant Parcel ID — mandatory**
- Customer Name, when supplied

A merchant order must never be submitted without a Merchant Parcel ID.
Merchant ID and merchant/company name may be absent. Never invent missing
merchant information. Merchant Parcel ID is an external merchant identifier
and must never be confused with Mirage's internal Order Number, Invoice
Number, or a Steadfast Consignment/Tracking Number.

**Direct / Mirage order minimum fields:** Customer Name, Address, and Mobile
Number are mandatory. An order cannot be submitted/created while any of
these three required fields is missing. Validation must be explicit in the
review UI and enforced again on the server.

**Parser review behavior:** the raw pasted message is kept as the original
source for audit, but after parsing the main review area should show the
structured extracted fields. Those fields remain editable before confirmation.
Merchant fields are shown only when present or relevant to the selected order
model. Customer-history/matching information appears only after customer data
has been parsed and matched; it should not be a permanent banner before parsing.

**Invoice note presets for Direct / Mirage orders:**
The review screen includes an **Invoice Note** selector with exactly three
choices:
1. COD Note
2. Prepaid Note
3. No Note

The system may auto-select a note from the payment state, but staff can change
it before confirmation. The two default templates are editable in Settings so
staff do not repeatedly paste them. The selected note is printed only on the
customer invoice. Merchant Fulfillment orders use no Mirage customer invoice
and therefore receive no invoice note.

Default COD note:
> প্রিয় কাস্টমার, অনুগ্রহ করে পেমেন্ট ক্লিয়ার হওয়ার পর পণ্যটি আনবক্স করুন।
> কোনো সমস্যা হলে, আনবক্সিংয়ের আগে অনুগ্রহ করে মার্চেন্টের সাথে যোগাযোগ
> করে নেবেন। আপনাদের সহযোগিতার জন্য ধন্যবাদ।

Default prepaid note:
> প্রিয় কাস্টমার, অগ্রিম পেমেন্টের জন্য ধন্যবাদ। পার্সেলে কোনো সমস্যা
> পরিলক্ষিত হলে অনুগ্রহ করে আনবক্সিংয়ের আগে মার্চেন্টের সাথে যোগাযোগ করুন।
> ধন্যবাদ।

**Merchant Fulfillment sticker:** a separate parcel-identification print may
contain only the available Merchant / Company Name, Merchant ID, Merchant
Parcel ID, and Customer Name. It must not contain product name, SKU, quantity,
price, cost, invoice number, or accounting information. Missing optional fields
are simply omitted.

**Parser UI direction:** this is a desktop-first, 16:9 workflow. Use available
horizontal space intelligently with a clean parser/review split on desktop, but
do not cram every field into columns merely to fill space. The goal is fast
review with minimal unnecessary vertical scrolling. Remove demo/sample buttons
from the production parser UI.

**Currency/number rendering:** BDT must display as `৳`; broken encoded
characters are never acceptable. Use normal zero glyphs (`0`), not slashed/crossed
zero typography, while keeping tabular alignment for operational numbers.


4. Show an **editable preview** of the parsed fields before "Create Order" —
   never auto-submit unreviewed data.
5. On confirm: create Order → generate Invoice (full, professional, branded —
   see Section 9) → generate Order Barcode. **Do not** generate the courier
   shipping label yet (see Section 9 for why).
6. Order goes to the Packing Team queue.

### 3.1 Delivery charge logic (confirmed)
Delivery charge is **not a rigid calculated field** — it's variable in
practice (sometimes free above an order amount, sometimes manually waived
or discounted for a specific customer even without a threshold), and
whatever amount was agreed with the customer is **already written in the
Messenger confirmation message itself**, so it's part of what gets
extracted by the parser in the flow above (this was already true in the
original spec — delivery charge is one of the fields parsed from the pasted
text) and remains editable in the confirmation preview like every other
field.
- **Default base rates** exist as a **company setting** (Section 37's
  Settings module) staff can reference/pre-fill from, not a hard rule the
  system enforces: **Inside Dhaka: ৳70, Outside Dhaka: ৳120** (these
  specific numbers, adjustable in Settings).
- These defaults must be **easily editable by the Owner/Manager without a
  developer** — delivery charges in this market shift with courier/fuel
  pricing, so Settings needs a simple "edit these two numbers" control, not
  something buried in code.
- Ultimately, the **per-order delivery charge is whatever staff
  confirm/enter for that order** (pre-filled from the default, but always
  overridable) — this is consistent with discounts (Section 15.16) being a
  visible, trackable field rather than an invisible override: if a
  delivery charge is waived or discounted for a specific order, that should
  be as traceable as a product discount is.

---

## 4. Real-time stock, reservation, and multi-staff safety

This is a critical, non-obvious requirement discovered mid-design: **multiple
staff members take orders simultaneously** (some via Messenger, some via
walk-in POS), all drawing from the **same shared stock pool**. Without care,
two staff can both sell the last unit of the same product.

**Required design:**
- Stock is not a single mutable number. Track three states per product per
  warehouse: **On Hand** (physically present), **Reserved** (already
  allocated to a confirmed order), **Available** (On Hand − Reserved).
- When an order is **created/confirmed** (not when paid, not when packed),
  the ordered quantity is reserved **immediately**. This must happen at the
  moment of order creation, before the staff member finishes the transaction.
- Every screen where a product/quantity is being entered into a new order
  must show the **live Available quantity** for that product, not a stale
  cached number.
- **Sync mechanism (revised after two independent reviews converged on
  this simplification — flagging clearly since it softens an earlier
  explicit requirement):** correctness never actually depended on the
  client display being instantly live — Section 32.2 already guarantees
  the server re-validates atomically at submit time regardless of what's
  on screen, so a stale "Available: 3" can never cause overselling, only a
  failed submission with a clear message. Given that, building genuine
  push infrastructure (WebSocket connection lifecycle, reconnect handling,
  missed-event recovery) for a team of a handful of concurrent staff is a
  lot of fragile engineering for pure UX polish. **Resolution: the stock
  display refetches on a short interval (e.g. every 10–15 seconds) and on
  window focus / before order submission** — not a manual page reload, but
  not full push infrastructure either. **Push (WebSocket) is reserved for
  the new-order broadcast notification below**, where a genuine "someone
  just created an order" ping is the actual point, not stock staleness.
  This can be upgraded to full push-based stock sync later if polling
  proves genuinely annoying in practice — it's a UI-layer change, not a
  data-model change, so nothing else in this document depends on which one
  is used.
- **New Order broadcast notification:** when any staff member creates a new
  order, an **in-app notification** should reach other active staff (not
  SMS/push to phone — in-app only for now), pushed via WebSocket (Section
  39.3). Each user must be able to **toggle this notification on/off** for
  themselves. This lives in a **Settings module** (see Section 20) that
  holds both per-user preferences and company-wide settings.

---

## 5. Packing Team — restricted interface

Not every staff member sees the full ERP. The Packing Team gets a
**restricted, role-routed view** of the same application (a distinct
route/entry point enforced by permissions — not literally a second
separate frontend codebase to build and maintain; the security boundary
that actually matters is the server-side permission check, Section 19,
which applies regardless of whether it's one codebase or two) showing
only:
- Which orders need to be packed
- Customer info needed to pack
- Which product, how many, per order
- Invoice print
- Courier sticker/label print (only available after courier booking is
  confirmed — see Section 9)
- Barcode scan (product verification against the order)
- Mark packed / dispatch

They **cannot** see Sales, Profit, Product Cost, Salary, Office Expense, or
Accounting — not just hidden in the UI, but blocked at the API/permission
level too (see Section 19).

**Explicit carve-out:** printing the **Invoice** (Section 9) necessarily
shows the customer-facing selling price and delivery charge on that
printed document — that is not a contradiction of "Packing cannot see
financial data." The restriction is about **Accounting/Profit/Cost/
Salary/Expense screens and figures** (margin, product cost, business-level
financials), not about the price a customer is already being charged on
their own invoice. Packing can print an invoice's prices; Packing cannot
open the Accounting or Pricing modules or see `avg_cost`/margin figures
anywhere.

---

## 6. Product & barcode system

Manufacturer barcodes (already printed on the product) are the primary
product identifier. 200+ products exist; the system must never require
re-typing full product info for a product that's already in the system.

**Real field structure (grounded in the business's actual product data,
not invented):**
- **Internal SKU code**: 3-letter brand-abbreviation + 3-digit sequence
  (e.g. `KDL006` for a Khadlaj product, `AMF002` for an Armaf product) —
  this is a **separate field from the manufacturer barcode**; the code is
  the business's own catalog reference (already in use today), the
  barcode is the physical scannable identifier. Both are stored.
- **Brand** (e.g. "Khadlaj," "Armaf," "Rasasi")
- **Perfume Name** — the marketing/short name (e.g. "Karus Gold Absolu,"
  "Dunescape") — this is the field Section 3.0a's matching logic searches
  against, since this is what staff/customers actually type
- **Concentration** — a real, distinct attribute (EDP / EDT / Extrait /
  Parfum, etc.), not folded into "category"
- **Size** (e.g. "100ML")
- **Category** (a separate, broader grouping — e.g. for reporting; not the
  same field as Concentration)
- **Gender/Target** — Men / Women / Unisex (confirmed missing field, found
  during audit of the actual built catalog). This is a real, commonly-used
  filter for a perfume business — distinct from both Category (scent
  family, e.g. "Amber Gourmand") and Concentration (EDP/EDT) — and must be
  filterable/sortable in the Products list (Section 37) alongside Category.
- **Selling Price** (called "Retail" in the business's existing sheets)
  and **Purchase/landed cost**
- **Display name** — auto-generated by concatenating Brand + Perfume Name
  + Concentration + Size (e.g. "Khadlaj Karus Gold Absolu EDP 100ML") —
  this is what appears on invoices and in search results; staff don't type
  it manually, it's derived from the fields above, matching the "For
  Invoice" convention already used in the business's own spreadsheets.

- **First time a product is seen:** scan barcode → "Product Not Found" →
  manually add once: internal SKU code, Brand, Perfume Name, Concentration,
  Size, Category, Barcode, Purchase Price, Selling Price, **and a product
  photo** (perfume bottles look visually similar to each other; a photo
  helps staff visually confirm they've matched the right item during the
  "Product Not Found" first-entry flow and at scan-confirm time generally).
- **Every time after:** Barcode Scan → product recognized automatically →
  enter quantity → Submit. No retyping name/size/category.

**Variant/unit rule (derived from the barcode-first design above — no
separate decision needed):** in real life, a manufacturer prints a
*different* barcode on each size of the same perfume (e.g. Dior Sauvage
100ml and Dior Sauvage 200ml are physically different barcodes on
different boxes). Since barcode is already the primary identifier here,
this means each size/variant is naturally its own SKU/product record —
there's no separate "parent product with variants" model to design. "Dior
Sauvage" as a name is just a shared label across a few otherwise-independent
SKU records (100ml, 200ml, etc.), useful for grouping in reports/search, but
each one has its own stock, cost, and price. A sellable unit is always one
whole bottle — fractional/partial-bottle quantities are not a normal case
(decanting into smaller sizes, if that's ever done, would be modeled as its
own product-to-product stock conversion event, not a fractional quantity).

**No-manufacturer-barcode fallback (default):** testers, decants, or any
locally-repackaged item that never had a factory barcode still need to fit
the barcode-first workflow — the system **generates and prints its own
internal barcode/QR code** for these cases at the point they're created, so
"no barcode" is never handled as an ad-hoc workaround (e.g. typing a SKU
into a search box instead of scanning). This keeps every product, factory-
barcoded or not, going through the same scan-based flow everywhere else in
the system (receiving, packing, verification).

### 6.1 Bundle/combo products (confirmed as needed now)
Gift sets and combos (e.g. "3×30ml combo," "his & hers set") are a real,
current sales pattern — not future scope. Model this as:
- A **bundle/kit is its own product record** (its own barcode — generated
  internally per the fallback above, since a combo box the shop assembles
  itself won't have a factory barcode — its own name, its own selling
  price) that is **composed of a defined set of underlying SKUs and
  quantities** (e.g. Bundle "His & Hers Combo" = 1× Dior Sauvage 100ml + 1×
  YSL Black Opium 90ml).
- **Selling a bundle deducts stock from each underlying SKU**, not from
  some separate "bundle stock" — the bundle itself is not separately
  inventoried as physical stock; it's a sales/packaging concept layered on
  top of the real underlying inventory. This means the stock ledger
  (Section 8) records a movement against each component SKU (reason: SALE,
  linked to the bundle order line) when a bundle is sold, exactly as if
  those individual bottles were sold separately.
- **Landed cost of a bundle** = sum of the current weighted-average cost of
  each underlying SKU at the quantities the bundle specifies — this is
  computed at sale time, not stored as a separate fixed bundle cost, so it
  stays accurate as underlying component costs change over time.
- A bundle can be discounted (Section 15.16) same as any other line item —
  e.g. selling three bottles together for less than buying them separately.
- Packing verification (Section 10) for a bundle order means scanning
  **each component bottle**, not a single bundle barcode standing in for
  unverified contents — the bundle barcode identifies the bundle as sold,
  but physical packing still verifies the real bottles going into the box.

---

## 7. Stock receiving

New shipment arrives (e.g. from Dubai): Barcode Scan → product recognized →
enter quantity received → Submit. System increases stock and records:
product, quantity, date received, supplier, cost, warehouse, and who
received it.

### 7.1 Warehouse model (confirmed)
There is one physical business location, but it has **two distinct stock
areas that must be modeled as two separate warehouses**:
- **Main / Back-store** — on the 2nd floor, the primary bulk storage.
- **Shop Floor** — the stock kept inside the shop itself (what's available
  for walk-in customers to see/buy immediately, and for packing to pull
  from for quick dispatch).
Stock Transfer (Section 8) between these two is a real, regularly-used
operation — not a hypothetical future feature. Build the warehouse model
as genuinely multi-location from the start (not hardcoded single-location),
since it's needed today, not just for a hypothetical future branch.

---

## 8. Inventory ledger (movement-based, not a single number)

Stock is the *result* of a ledger of movements, not a directly-edited number.
Every change to stock must be a logged movement with a reason:

- Purchased (+)
- Sold (−)
- Returned (+)
- Damaged (−)
- Lost (−)
- Transfer out (−) / Transfer in (+) — between warehouses
- **Marketing Sample (−)** — perfume given to studios/advertising partners,
  non-returnable. This is **not a sale**.
- **Gift (−)** — given away by Owner/Manager as a gift. Also **not a sale**.
- Manual adjustment (±) — requires a reason and, above a threshold, approval
- **Opening balance (+)** — used exactly once per product/warehouse at
  go-live (Phase 1) to enter existing stock as of a real date, distinct
  from a Purchase movement (Section 40's Phase 1 scope)

**Marketing Sample and Gift** do not add to Sales Revenue. Instead, their
value (at cost) is booked in Accounting as a **Marketing Expense / Gift
Expense**, so the Profit & Loss statement stays accurate (otherwise it would
look like inventory shrinkage/loss instead of a deliberate business cost).

**Tester/Sample bottles:** kept in the shop for walk-in customers to
smell-test. These are tracked as a **separate stock state**, not mixed into
sellable stock (they slowly deplete but are never sold). Moving a bottle from
sellable stock to tester status is itself a logged movement (who, when, why,
quantity, location).

---

## 9. Invoice, courier label, and print sequence (important correction)

**Original assumption (wrong):** Order created → Invoice + Barcode + Label
all generated together immediately.

**Corrected sequence (confirmed with user):**
1. Order created → **Invoice** (full, professional, branded — see below) +
   **Order Barcode** generated immediately.
2. Order goes to Packing.
3. Packing team packs, then books the order with **Steadfast** via API.
4. Only **after** Steadfast confirms the booking and returns a **Parcel/
   Consignment ID**, the **courier sticker/shipping label** is generated —
   with that Parcel ID printed on it — and can be printed.

**Invoice vs. label — never confuse these:**
- **Invoice**: a full, professional, branded customer document for **Direct /
  Mirage Perfume orders**. This is **not** a small POS receipt. For these
  orders, the selected Invoice Note (COD / Prepaid / No Note) is printed here.
- **Merchant Fulfillment / Dropship**: do **not** print the normal Mirage
  customer invoice. Print the separate Merchant Fulfillment Sticker described
  in Section 3.2.
- **Courier sticker/label**: the Steadfast shipping label is a separate
  document and still exists only after confirmed courier booking with a real
  Parcel/Consignment ID.

Two separate barcode types exist and must not be conflated:
- **Product Barcode** — identifies a product (manufacturer's own barcode).
- **Order Barcode** — identifies one specific customer order (system-
  generated).

**Print format defaults (derived from the invoice-vs-label distinction
already established above):**
- **Invoice**: standard A4, generated as a proper PDF (not a raw browser
  print of an HTML page) so it looks consistent and professional every
  time. **Explicitly black & white** (confirmed) — not full-color — for
  print economy and a clean professional look, consistent across both
  online and walk-in orders.
- **Invoice layout (grounded in the business's actual existing invoice
  template, not invented):** header with business name/logo; a two-column
  "FROM" (business info) / "BILL TO" (customer info, including the
  delivery address — Section 41's `delivery_address_id`) block; a date
  field; an itemized table with columns **Code, Item Name (the auto-
  generated display name, Section 6), Qty, Price, Total**; below the
  table: Subtotal, Delivery charge, **Total Due**; a payment-method line
  (e.g. "Cash on Delivery," "Paid via bKash," matching Section 15.5's
  transaction model); and a footer with a "system generated invoice, no
  signature required" note and a thank-you line. Match this existing
  structure rather than inventing a different layout — it's already the
  business's brand-recognized format.
- **Courier sticker/label** and **Order/Product barcodes**: sized for a
  standard thermal label printer (the norm for BD courier operations,
  commonly 4"×6"/100mm×150mm) — not A4.
- **Salary Payslip**: A4, same PDF-generation approach as the invoice.
- All of these follow the same "preview before print" philosophy already
  required for Reports (Section 22) — show what will be printed before
  sending it to a printer.

**Bulk printing (confirmed requirement):** from the Orders/Packing queue,
staff can select multiple orders (or use a "today's orders" quick-filter)
and:
- **Bulk-print A4 invoices** for all selected orders as one batch PDF
  (or a sequence of print jobs) — for orders already packed together, ready
  to go out.
- **Bulk-print courier stickers/labels** for all selected *booked* orders
  (Section 12 — only orders with a confirmed Steadfast booking and Parcel
  ID have a label to print, per the sequencing rule above; bulk booking
  and bulk label printing are naturally paired actions).
Both bulk actions live in the Packing queue (Section 37) alongside the
per-order print actions, not as a separate hidden feature — packing at
volume is a real daily need, not an edge case.

---

## 10. Packing-time barcode verification

When packing, staff scans the product barcode; the system checks it against
what that order actually requires. Correct match → allow packing. Wrong
product scanned → show a warning. This prevents wrong items being shipped.

**Barcode hardware behavior (default):** standard USB/Bluetooth barcode
scanners act like a keyboard — they "type" the barcode digits followed by
an Enter keystroke. Every barcode-input field in the app (receiving,
packing verification, product lookup) should work simply by having focus in
a text input and catching that Enter keystroke as "submit this scan" —
no special scanner SDK or camera integration is needed for desktop use. If
a tablet/phone is ever used for packing without a physical scanner, a
camera-based barcode scan (using the device camera) is a reasonable fallback
to design for, but the keyboard-emulation path is the primary one to build
first since that's what physical scanners at a packing desk actually do.

**Manual entry fallback (confirmed requirement):** every barcode-scan point
in Packing/Receiving must also accept **manually typed** barcode/SKU entry
as a fallback — the same text input the scanner "types" into also works
for a staff member typing the digits by hand if the scanner is broken/
unavailable, with the same Enter-to-submit and validation behavior. This
is not a separate hidden mode; it's simply that the input field never
*requires* the input to have come from a scanner. Packing must never get
stuck because a scanner has an issue.

---

## 11. Order status — kept intentionally simple

**Do not build a multi-dimension status system** (order/payment/fulfillment/
courier as separate *independent, orthogonal* fields, e.g. tracking payment
status and fulfillment status as two things that can independently be in
any combination) — this was considered and explicitly rejected as
unnecessary complexity for this business.

**The customer-visible/operationally-meaningful spine is:**
`Packed → Dispatched → Delivered`

This does **not** mean there are only three status values in the database
— see Section 35.5 for the complete internal lifecycle, which also
includes Draft (client-side only, never persisted — see 35.5), Confirmed,
Cancelled, Returned, and RTO. The point of this section is narrower than
it might sound: don't build *separate tracking dimensions* for payment vs.
fulfillment vs. courier that can drift independently of each other —
Section 35.5's lifecycle is a single linear/branching state machine, which
is the simpler thing this section is actually arguing for.

Once **Dispatched** (i.e. the Steadfast booking is confirmed), all further
tracking detail (Picked Up, In Transit, Delivered, Returned, Failed) comes
**from the Steadfast API** — do not duplicate that state machine locally.
Sync/display Steadfast's status directly.

### 11.1 Cancellation (confirmed rules)

- An order can be **cancelled at any stage** — before packing, during
  packing, even after dispatch. There is no lifecycle point where
  cancellation becomes unavailable.
- **Any staff member** can cancel an order — this is not restricted to
  Manager/Owner. **This is a real business decision, not an oversight —
  it means the "Cancel" action in the granular permission matrix (Section
  20) is granted to every role by default for the Orders module** (unlike
  most other Cancel/Delete-type actions, which are typically Manager/Owner-
  only). The permission matrix editor still technically supports
  restricting it later if the business's needs change, but the shipped
  default must not silently contradict this rule.
- Cancelling requires selecting a **reason category** and must **not be a
  single click** — require an explicit confirmation step (e.g. a confirm
  dialog) so it can't happen by accident. **Default reason list** (editable/
  extendable later, and always includes a free-text **"Other (please
  specify)"** option so a reason that doesn't fit the list can still be
  captured):
  - Customer changed their mind
  - Product out of stock (couldn't fulfill)
  - Duplicate order
  - Wrong item/details entered
  - Customer unreachable / no response
  - Price/payment disagreement
  - Suspected fake/fraudulent order
  - Other (free text required)
- **Stock is not auto-restored on cancellation.** Because the physical item
  may already be packed or even in the courier's hands, the reservation
  release only becomes a real stock-back-in-inventory event once the
  physical item is **barcode-scanned back in**. In other words:
  cancelling the order changes its status and releases the *logical*
  reservation, but the *physical* stock count only increases when someone
  scans the returned item back into inventory. This gives a genuine
  verification step rather than trusting that "cancelled" always means
  "the item is safely back on the shelf."
- If **advance/partial payment** had already been taken on a cancelled
  order, it is **refunded back to the customer** (not converted to store
  credit by default) — this follows the refund/payment-transaction model
  in Section 15.5 and must be logged like any other refund.
- Every cancellation is audit-logged: who cancelled, when, reason, and
  whether a refund was involved (Section 32.8/32.9 apply — this is a
  logged event, not a silent status flip).

---

## 12. Courier: Steadfast (not eCourier)

- ERP-initiated booking: select order(s) → Steadfast Booking → Confirm →
  API creates the booking.
- **Bulk booking** supported: select multiple orders → "Book All".
- On success, store: Booking ID, Consignment/Tracking Number, Courier Status.
- **No pre-booking confirmation-call step.** This was explicitly considered
  (common in Bangladesh F-commerce tools to reduce fake COD orders) and
  explicitly rejected by the user — do not build it.

### 12.1 Actual courier charge vs. what the customer was charged (confirmed
requirement)
The delivery charge shown to the customer (Section 3.1 — the ৳70/৳120
default, or whatever was actually agreed) is **not the same number** as
what Steadfast actually charges the business to deliver that specific
parcel (their real fee varies by weight/distance/service level). Both
must be captured and compared, not just one:
- **Customer-charged delivery** — already stored on `orders.delivery_charge`
  (Section 41).
- **Actual courier charge** — fetched from Steadfast's API response (at
  booking confirmation, or from the delivery-status/payout data if that's
  where Steadfast actually exposes the real fee — confirm which during
  Phase 4 build-out) and stored on `courier_bookings.actual_charge`
  (Section 41 — extend that entity with this field).
- **Variance** = `delivery_charge − actual_charge`, computed and shown
  wherever courier performance/cost is reviewed (Courier module, Section
  37; Accounting reconciliation, Section 15.2/15.6) — not just a silent
  number, since consistently negative variance (charging customers less
  than the real courier cost) is a real, correctable margin leak. This
  variance reporting is what makes the delivery-charge/courier-charges
  distinction already established in the accounting model (Section 15.0a)
  actually actionable, not just recorded.

---

## 13. Returns

Delivered → Return → Product Received → Checked → Restock (if good) /
Damaged Stock (if damaged). Refund is linked into Accounting (see Section 15).
RTO (return-to-origin, i.e. failed delivery) should be tracked as its own
event type since it has its own cost (courier charges lost both ways).

### 13.1 RTO accounting (confirmed)
- **Courier charge responsibility is variable, not fixed** — sometimes the
  business absorbs the RTO courier charge, sometimes it's charged back to
  the customer (e.g. for repeat-offender fake-order customers). This must
  be a **per-case field** recorded on the RTO event (who bears the charge),
  not a hardcoded global rule.
- **Stock is not auto-restored.** Same principle as order cancellation
  (Section 11.1): the returned item must be **physically checked first**,
  and only after that check confirms the item is sellable does it get
  scanned/added back into available stock. If checked and found damaged, it
  goes to Damaged Stock instead (Section 8).
- Since revenue/COGS for online orders is only booked at Delivered (Section
  15.15), an RTO (which by definition never reached Delivered) has **no
  revenue to reverse** — the order simply never crossed into "sold." What
  *does* need to be recorded is the courier cost incurred (per the
  responsibility rule above) and the eventual stock outcome once checked.

---

## 14. Purchase & Supplier management

- Supplier list, purchase history (what was bought, at what price, what
  quantity), Purchase Return.
- Supplier payable balance tracked.
- If the same product is bought at a different price later, the old
  purchase cost is still retained in history (needed for costing — see
  Section 15).

---

## 15. Accounting / Finance — the deepest, most important module

This is one of the three core pillars. Treat money with the same rigor as
inventory. This section supersedes and expands earlier, simpler accounting
notes.

### 15.0 Accounting architecture (confirmed): double-entry
The accounting engine is built as a **real double-entry journal internally**
(every financial event produces balanced Debit/Credit journal entries),
even though the UI can present simplified views (ledgers, P&L, dashboards)
on top of it. This was a deliberate choice over a simpler flat income/expense
ledger, because double-entry is what makes reconciliation (Courier
Receivable vs. Steadfast payout, bank/MFS reconciliation, refunds against
split payments) actually trustworthy instead of just "looking like"
accounting. Example of how this plays out for a COD delivery — note the
Inventory credit uses the cost **captured at packing time** (Section
35.1b), since physical stock left the warehouse then, not at Delivered:
```
On Delivered:      Dr Courier Receivable   Cr Sales Revenue
                                            Cr Delivery Income   (Section 15.16a)
                    Dr COGS                 Cr Inventory   (using avg_cost
                                              stored on the Pack-time
                                              stock_movement, Section 35.1b)
On Steadfast payout: Dr Bank                Cr Courier Receivable
                     Dr Courier Charges      (part of the same entry)
```
Every module that touches money (sales, purchases, expenses, payments,
refunds, salary, RTO) must post through this journal — not maintain its own
separate, disconnected record of "money in/out."

### 15.0a Delivery charge accounting treatment (resolved)
The delivery charge a customer pays is booked as its own **"Delivery
Income"** line, separate from **"Product Sales"** revenue (both under the
Income category system, Section 15.4) — not folded into product revenue.
This keeps sales reports (Section 22/38) able to show true product revenue
without delivery-charge noise, and makes it possible to see whether
delivery charges collected roughly cover what's actually paid to Steadfast
(Courier Charges, in the payout entry above) — a recurring monthly
reconciliation question for a COD business. On Delivered, the customer's
total payment (product total + delivery charge) still flows through
Courier Receivable together; the split into Sales Revenue vs. Delivery
Income happens in the same journal entry, not as a separate step.

### 15.1 Separate money "buckets" (accounts)
Do not treat all incoming money as one undifferentiated "cash" pile. Track
at least:
- **Cash** (shop till)
- **Bank account(s)**
- **bKash / Nagad** (mobile wallets)
- **Courier Receivable (Steadfast Clearing)** — see below, this is critical

### 15.2 Courier money is not cash the moment of delivery
When an order is marked Delivered by Steadfast, the sale is real, but the
**money is not yet in hand** — Steadfast holds COD collections and pays out
later, after deducting delivery charges. Modeling this correctly:
- On Delivered: revenue is booked, and the expected amount goes into
  **Courier Receivable**, not directly into Cash/Bank.
- When Steadfast actually pays out: match the payout against expected
  Courier Receivable (minus delivery fee) for the relevant orders.
- If the numbers don't match, **flag it** — this is one of the most common
  places money silently leaks in COD businesses.

### 15.3 Walk-in / cash sales
- Always issue a full invoice (Section 9), payment recorded directly
  (cash/bKash/card, possibly split across methods — see 15.5).
- **Day-end cash reconciliation:** opening float + today's cash sales −
  today's cash expenses should equal the counted closing cash. Variance is
  flagged.
- **Petty cash / imprest system** for small shop expenses (tea, local
  transport, minor repairs): a fixed float is given to the shop manager;
  each expense requires a category tag and (ideally) a photo of the receipt
  before the float can be replenished. This closes the most common leak
  point for small day-to-day cash.

### 15.4 Category system for Income/Expense
- Income: Product Sales, other income.
- Expense: Product Purchase, Transport, Delivery/Courier, Packaging,
  Advertising, Marketing Sample/Gift Expense (Section 8), Employee Salary,
  Office Rent, vehicle rent, snacks/water, Electricity, Internet,
  Maintenance, Miscellaneous, plus **user-defined custom categories**.
- Every expense entry: category, amount, date, description, payment method,
  receipt/document attachment.
- Filterable ledger view (not just summary totals) by date range, category,
  employee.

### 15.5 Payments are transactions, not a "method" field
Do not store `payment_method = "bKash"` as a single field on an order. Model
payment as its own transaction record: amount, method, transaction ID,
payment account, date, received-by, linked order, status, refund
relationship. This allows one order to be paid, e.g., ৳500 bKash + ৳1,000
cash + ৳200 COD, tracked individually. Also enables partial payment,
refunds, and reconciliation.

**Refund architecture (derived from the above — no separate decision
needed):** since payments are already individual transaction records, a
refund is simply a new transaction that **links back to one or more
original payment transactions** rather than a flat `refund_amount` field on
the order. This naturally supports: partial refunds, refunding a specific
payment method (e.g. only the bKash portion of a split payment), full vs.
partial status, a refund date and who processed it, and — for refunds tied
to a cancellation or return that requires approval (Section 26) — an
approver field. A refund transaction reduces the customer's effective
amount paid without editing/deleting the original payment record (this
follows the immutability principle in Section 32.9).

### 15.6 Bank/MFS reconciliation
Bank and mobile wallet (bKash/Nagad) balances must be reconcilable against
what the system expects — flag unmatched transactions rather than silently
trusting either side.

### 15.7 Landed cost (critical for imported perfume)
The real per-unit cost of an imported perfume is **not** just the supplier
price. It includes: purchase price + international freight + customs/duty +
local transport + any clearing costs. These should be pooled per shipment
and allocated across the units received (by value or another sensible
method) to get an accurate **landed cost per unit**. Revalue when the final
clearing invoice arrives rather than relying on provisional estimates —
otherwise profit reports will be systematically wrong.

**Original purchase currency (default, not full multi-currency):** since
purchases come from Dubai, record the **original currency and exchange rate
used** at the purchase-entry step (e.g. "USD 45 @ 118.50 BDT") purely for
supplier-invoice traceability and audit purposes. This does **not** make the
system multi-currency — Section 31 still holds: all reporting, accounting,
and stock valuation stay in BDT everywhere else. This is just preserving the
original transaction detail at the point of entry so it isn't silently lost.

### 15.8 Costing method
Use **weighted-average cost** for financial reporting/COGS — simplest and
most operationally realistic for a reseller. Keep **batch identity
separately** (Section 21) for authenticity/traceability purposes — do not
conflate "which physical batch this bottle came from" with "what financial
value is assigned for costing." They are two different concerns.

### 15.9 Payable / Receivable
- Supplier payable (what we owe suppliers).
- Customer receivable (rare, e.g. partial/advance payment situations).

### 15.10 Salary
- Monthly **Salary Sheet** — all employees in one table.
- Individual **Payslip / Salary Invoice** per employee, printable.

### 15.11 Editing and audit (corrected — see Section 32.9)
**This is superseded by Section 32.9 and must be read that way, not
literally.** A *posted* accounting/journal entry (one already reflecting a
completed payment, a posted stock movement, or a finalized sale) is **not**
directly editable — it's corrected through a **reversal/adjustment
transaction** (a new, linked entry that cancels or corrects the old one),
exactly like every other posted financial/inventory event in this system.
What genuinely stays freely editable-with-audit-log (Section 19's "click
the row" pattern) is *pre-posting* data: a draft expense entry not yet
saved, an expense's description/category/receipt attachment, a supplier's
contact info, etc. — not the immutable ledger effect of a transaction once
it's posted. "Mistakes happen" is still fully handled — just via reversal,
which is actually *more* auditable than in-place editing, not less.

### 15.12 Export
All accounting data should be exportable to Excel/PDF (for external
bookkeepers, tax purposes, etc.)

### 15.13 VAT-readiness (not needed now, but design for it)
Bangladesh VAT registration is currently not mandatory below roughly
৳30–50 lakh annual turnover. It isn't needed now, but the invoice format
should be designed so BIN/VAT number and VAT amount fields can be added
later without redesigning the whole invoice system.

### 15.14 Profit & Loss
- Gross Profit = Sales Revenue − Product Cost (using landed cost).
- Net Profit = Gross Profit − (Salary + Rent + Transport + Advertising +
  all other expenses).
- **Product-wise profit**: not just which product sells the most, but which
  is actually most profitable (Sales, Cost, Profit per product).

### 15.15 Revenue/COGS recognition timing (confirmed)
- **Walk-in/POS sales**: Revenue and COGS are booked **immediately** at the
  point of sale — money changes hands on the spot, so there's nothing to
  wait for.
- **Online/Messenger (courier-fulfilled) orders**: Revenue and COGS are
  booked **only when Steadfast confirms Delivered.** Not at order
  confirmation, not at dispatch. Reasoning: COD money isn't real until
  delivery actually happens — if booked earlier, every cancellation or RTO
  would require reversing a "sale" that was never really completed, and
  reports would overstate revenue during the delivery window.
- This means "orders placed" and "revenue earned" are two different numbers
  and should be reported separately — a dashboard showing "today's orders"
  is not the same as "today's revenue," and both should be visible where
  relevant (Owner/Manager dashboards, Section 23) so nobody confuses order
  volume with actual booked sales.

### 15.16 Discounts (confirmed)
Discounts are a **separate, explicit field** — not a direct price
overwrite. Every order/order-item that has a discount stores the
**original price** and the **discount amount** (or percentage) separately,
so the invoice can show both (e.g. "Price: ৳5,000, Discount: ৳500, Total:
৳4,500") rather than just a lower price with no trace of what happened.
This also means P&L and sales reports can show **gross sales before
discount vs. after discount** as two distinct figures — necessary for
accurate revenue reporting, and this is what makes Section 26's "discount
above a threshold requires approval" rule actually enforceable (there's a
real field to check against a threshold).

---

## 16. Pricing Engine (new module — internal tool)

A dedicated internal tool/screen to help decide product selling prices. It
should take into account at minimum: landed cost (Section 15.7), current
selling price, and market/competitor pricing data (Section 17). Exact
calculation logic/rules are still to be defined with the user — build the
data model to support this (link products to cost and to competitor price
observations) before finalizing the UI.

---

## 17. Market/Competitor analysis input (new module)

The market-analysis team needs a way to **input** competitor pricing data —
e.g., "Competitor Page X is selling Product Y at price Z" — and the system
should show a **comparison/chart** of our price vs. competitor prices, per
product. This feeds into the Pricing Engine (Section 16).

**Open question (not yet decided):** is this data entry manual (team
researches and types it in) or will there be automated tracking/scraping in
the future? Build the data model manual-entry-first; do not build scraping
infrastructure unless/until explicitly requested.

---

## 18. Customer management

Customer profile: name, phone, address, order count, total spent,
delivered/cancelled/returned counts, order history. A loyalty/rewards
program is a **future consideration only** — not being built now, but
keeping "total spent" tracked on the customer profile makes it easy to add
later.

**Duplicate handling (default rule):** phone number is the natural unique
identifier here, since every Messenger order and walk-in sale realistically
captures a phone number. Normalize phone numbers on entry (strip spaces/
dashes, treat `01XXXXXXXXX` and `+8801XXXXXXXXX`/`8801XXXXXXXXX` as the same
number) and match/deduplicate customers by normalized phone. A customer can
have **multiple saved addresses** (people order for delivery to different
places) but one identity. If a new order's phone matches an existing
customer, auto-link to that existing profile rather than creating a new one
— surface the match to the staff member creating the order rather than
silently merging, in case two different people share a number (e.g. a
household phone).

**Risk flag (default, derived from data already being collected):** the
system already tracks RTO count, cancellation reasons (including "suspected
fraudulent order" — Section 11.1), and full order history per customer.
Turn this into a visible **risk badge on the customer profile and at
order-creation time** — e.g. auto-flag after a configurable number of RTOs
or fraud-reason cancellations (default threshold: 2, adjustable in
Settings). When staff pull up a phone number that matches a flagged
customer while creating a new order, show something like "⚠ 3 previous
RTOs" before they confirm — this is purely an informational flag, not a
blocking gate (no confirmation-call step was already explicitly rejected —
Section 12 — and this doesn't reintroduce that; it's just visibility, the
staff member still decides).

---

## 19. Universal record interaction, editability, and audit

This system-wide convention applies across Products, Orders, Customers, Suppliers,
Expenses, Accounting records, and other business records.

- Legitimately mutable business records remain editable, and material edits are audit-logged.
- Posted financial/inventory events are not destructively edited; use reversal/adjustment
  transactions as defined in Section 32.9.
- **Row click is read-first:** clicking a table row opens the record's Details/Record
  Workspace, not direct editing.
- The Details workspace is for review; a deliberate **Edit** action opens the editable form.
- Details/record modals have a visible close control and support Escape.
- Lightweight popovers close on a normal click outside and Escape; interactions inside
  must not dismiss them accidentally.
- Bulk selection is contextual: enter Selection Mode rather than permanently showing
  checkboxes in every row.
- Material changes must remain traceable: who, when, what changed, old value → new value,
  and the linked entity/reference where relevant.
## 20. Users, roles, permissions, and Settings

### 20.0 Role model (redesigned — 4 tiers + granular per-user toggles, Facebook-moderator style)
This replaces any earlier flat "one fixed role per department" model
(Sales/Inventory/Accounts as separate named roles). The business only
needs **four hierarchy tiers**, and within each tier (except Owner),
**individual capabilities are toggled on per specific person** — exactly
like assigning a Facebook Page moderator: a base tier sets sensible
starting visibility, and specific additional powers (edit this, approve
that, export this) are switched on one at a time as a person earns more
trust/responsibility, rather than jumping to a whole new role. This is a
deliberate, confirmed design choice — do not simplify it back into six
fixed named roles.

**The four tiers (names chosen deliberately — Bangladeshi business-
standard professional titles, not literal translations of how the
concept was described):**

1. **Owner** — full, unrestricted access to everything, including granting/
   revoking every toggle below for every other user. Cannot be limited.
2. **General Manager** — near-Owner *visibility* by default (can **view**
   Sales, Inventory, full Accounting/Financials/P&L, Reports, Dashboards —
   essentially everything an Owner sees). **No create/edit/delete/approve
   capability on anything by default** — this tier starts fully read-only
   despite its broad visibility. Specific edit/approve toggles (see 20.0a)
   are switched on individually by the Owner as trust is established. This
   is the "sees almost everything, changes nothing until explicitly
   allowed" tier.
3. **Manager** — day-to-day operational access by default: create/edit
   orders, view stock levels, view limited/operational reports. **No
   default access to full financials, margins, or salary data.** Like
   General Manager, additional specific capabilities are toggled on
   per-person as needed.
4. **Packing Staff** — the most restricted tier, scoped tightly to the
   Packing interface (Section 5) — pack, verify, print, dispatch. Few
   toggles are relevant here by design, since the role is intentionally
   narrow.

### 20.0a Granular permission toggles (the "Facebook-moderator" list)
These are individually switchable **per user**, independent of their base
tier default. An Owner (and a General Manager, only if the Owner has
toggled on "Manage Users" for them) grants/revokes these one at a time
from that user's profile in Users & Roles (Section 37). This list is the
concrete "many small enable switches" the tier defaults sit on top of:

- View Sales & Orders
- View Inventory & Stock
- View Cost/Margin figures
- View Full Accounting/P&L
- View Salary data
- Edit Orders
- Cancel Orders
- Edit Product Prices
- Approve Discounts (above threshold, Section 26)
- Approve Refunds
- Approve Stock Adjustments
- Approve Large Expenses (Section 26)
- Export Data (Excel/PDF, any module)
- Print Invoices/Labels (individually or bulk)
- Access Pricing Engine (Section 16)
- Manage Suppliers/Purchases
- Manage Users (create/edit/disable staff accounts, assign toggles to
  others — Owner-only by default, since this is effectively delegated
  admin power)
- View Audit Log
- Access Settings → Company/Delivery/Integrations sections (Section 20.2)
Each toggle is boolean, per user, and changes take effect immediately
(no re-login required). A user's *effective* permissions = their tier's
defaults + any individually-toggled-on extras (toggles only ever add,
never silently remove a tier default — removing a tier default means
moving them to a lower tier, not fighting the toggle system against it).

- Owner/General Manager (if toggled on) can create new staff accounts
  (this was **missing** from a first build attempt — must not be skipped).
- **User profile settings (confirmed requirement):** every user can update
  their own **profile picture, display name, and other personal profile
  info** (e.g. phone/contact) from a dedicated profile screen — distinct
  from the admin-only "Users & Roles" management screen (Section 37), which
  is where an Owner (or a delegated General Manager) manages *other*
  people's accounts/tiers/toggles. A user editing their own profile
  picture/name is a self-service action, not a permission-gated admin
  action.

### 20.1 Dashboards follow the same tier/toggle logic (ties to Section 23)
"The person who needs to see the most sees the most" is implemented
directly through 20.0/20.0a — there's no separate dashboard-specific
permission system. A user's dashboard widgets are simply whatever their
effective View-level toggles allow: Owner sees everything, a General
Manager sees financial/stock widgets by default (their View toggles are on
by default per the tier), a Manager sees operational widgets only, Packing
Staff sees their queue only. One dashboard component, role/toggle-driven
widget visibility (Section 23/37) — never three-to-four separately coded
dashboard pages.

### 20.2 Settings module — organized into real sections, not one generic page
(explicitly confirmed requirement, do not build a flat single-page settings screen):

1. **My Profile** — profile picture, name, personal info, password change, 2FA enrollment.
2. **My Preferences** — notification toggles, **Light / Dark / System theme**, global font
   selector, and configurable recently-updated-price highlight duration.
3. **Company Info** — business name, address, logo/branding.
4. **Delivery & Courier** — default delivery rates and Steadfast credentials.
5. **Categories** — product categories and expense/income categories.
6. **Users & Roles** — staff accounts, tiers, granular toggles.
7. **Approval Rules** — generic approval-rule configuration, empty/inactive by default.
8. **Integrations** — Gemini key and future integration hooks.
9. **System** — backup status, audit-log shortcut, and operational system controls.

Each section is a separate settings screen/tab. Do not turn Settings into one long
miscellaneous form.
## 21. Perfume-specific: batch/lot tracking for authenticity

Optional per SKU (not mandatory for every product). When relevant, store:
batch code, manufacturer, supplier, purchase date, receiving date,
manufacturing date (if known), quantity received/remaining, purchase cost,
source invoice, warehouse, and authenticity evidence (photos of batch code/
box/bottle, supplier documents). This exists to build a defensible internal
trail for authenticity disputes — not to make an unsupported claim that
"batch code alone proves authenticity."

---

## 22. Reports — preview before print

**Important correction:** reports must not go straight to print. The correct
flow is: report opens as an **on-screen, sortable/filterable preview**
(like an Excel/web table) → if it looks right, a **Print button** at the
top sends it to print/PDF. Report types needed: Daily/Monthly Sales, Product
Sales, Purchase, Inventory, Stock Movement, Return, Damage/Loss, Expense,
Profit & Loss, Customer, Supplier, Courier, Product Profitability. All
exportable to Excel/PDF.

**Calculation source-of-truth (derived from Section 15.15 — no separate
decision needed):** "Sales"/"Revenue" anywhere in reports or dashboards
means *booked* revenue per the recognition rule already established
(walk-in: immediate; online: at Delivered) — never a mix of "orders placed"
and "revenue earned." If a report needs to show order *volume* instead
(e.g. "Orders received today" regardless of delivery outcome), it must be
clearly labeled as such and kept visually distinct from revenue figures, so
nobody reads "50 orders today" as "50 orders' worth of revenue today."
Inventory reports should always specify which stock state they're showing
(On Hand vs. Available vs. Reserved vs. Damaged vs. Tester — Section 4/8) —
never an unlabeled single "stock" number.

---

## 23. Dashboards — different depth per tier, always visual (not just numbers)

**Every dashboard widget that shows a trend, breakdown, or comparison must
be a chart, not a bare number or text table** (confirmed emphasis) — the
same Excel/PowerPoint-style visual reporting the business already expects
(Section 38 defines exactly which chart type per data type). A clean,
consistent visual look across every dashboard is as important as the data
being correct — no cluttered/mismatched layouts, following the Design
System (Section 36).

One dashboard component, tier/toggle-driven widget visibility (Section
20.1) — not separate dashboard builds per tier:

- **Owner**: Net Profit (today/week/month, as a trend line), where money
  is going (expense breakdown, as a donut), which products are actually
  profitable (bar chart), cash position (cash in hand/bank, supplier
  payable, customer receivable), trend vs. previous period.
- **General Manager**: the same breadth as Owner by default (Section
  20.0's "sees almost everything") — Net Profit, expense breakdown, stock
  position, product performance — since their tier default is full View
  access; the difference from Owner is entirely about *editing* ability
  (Section 20.0a's toggles), not what's visible on the dashboard.
- **Manager**: daily order/delivery/pending/return counts (as charts where
  a trend makes sense, e.g. orders-per-day as a line), staff/packing
  performance, stock status (low/out of stock, reorder needed), a
  reasonable financial summary *unless* they've been individually toggled
  into full Accounting view (Section 20.0a) — without salary-level detail
  by default, approval actions if toggled on.
- **Packing Staff**: their queue only (Section 5/37) — no dashboard beyond
  the packing queue itself, since this tier's whole interface *is* its
  "dashboard."

---

## 24. Analytics/visualization

Bar, line, and pie/donut charts for sales, profit, expenses, product
performance, and stock — with adjustable date ranges (7 days / 30 days / 1
year etc.), not just static numbers.

---

## 25. Alerts

Low stock / out of stock, order pending, courier booking failed, payment
due, supplier payment due, approval pending. Shown on the dashboard and as
**in-app notifications only** for now — SMS is explicitly deferred (see
Section 27).

**Low-stock threshold (default):** this is a **per-product field**, not one
global number — a slow-moving 200ml bottle and a fast-moving 50ml bottle
need different reorder points, so "low stock" must be configurable per SKU
(with a sensible default value at product-creation time that can be
overridden).

**Notification model (default, formalizing Section 4's behavior):** these
alerts and the new-order broadcast (Section 4) are the same underlying
system — a real notification table, not ad-hoc frontend toasts. Each
notification record needs: type, target user (or "all active users" for
broadcasts), message/context, a link to the relevant record (e.g. the order
or the low-stock product), read/unread state, and timestamp. Per-user
preferences (Section 20's Settings module) control which notification
types a given user receives, not just the new-order one.

**File/attachment storage (default):** receipts, batch-code photos, and
supplier documents (Sections 15.4, 21) are stored in cloud object storage
(not the database directly), referenced by URL/key in the relevant record.
Reasonable defaults: max 10MB per file, accepted formats
images (jpg/png/webp) and PDF, access via authenticated URLs only (never
public), and each attachment is linked to the record it belongs to (an
expense, a batch, a supplier invoice) rather than floating independently.

---

## 26. Approval workflow — build as a generic engine

Do not hard-code approval logic into individual screens. Build a general
mechanism: `action → condition → approver → decision → audit`. Example
triggers: large expense, stock adjustment, large purchase, refund, price
change, financial adjustment, discount above a threshold.

**Whether/when to actually turn any of these on (resolved default):** the
user wasn't sure whether this is needed yet — that's expected, since
approval rules matter most once a team has grown enough that the Owner
isn't personally aware of every transaction. For a small, closely-involved
team, mandatory approval gates mostly add friction without much benefit
yet. Default: **build the engine, but ship with zero active approval rules**
— nothing requires approval out of the box. This means the infrastructure
exists and is genuinely ready (an Owner can turn on "expenses above ৳X need
my approval" from Settings the moment it becomes useful, e.g. once more
staff join or the Owner is less hands-on day-to-day), but nobody's workflow
is slowed down by an approval step that isn't needed yet. This avoids
forcing a taka-amount decision the user isn't ready to make, while not
losing the capability for later.

---

## 27. Explicitly deferred / explicitly rejected

Do not build these now, but keep the architecture from actively blocking
them later:

- **SMS notifications** — not needed now. Build a future-ready hook/module
  (e.g. a clearly separated notification-sending interface) so that when
  needed later, it can be turned on via settings/API key without a
  developer rewriting core logic.
- **Confirmation-call step before courier booking** — explicitly rejected,
  do not build this at all, not even as an optional toggle.
- **Multi-dimension order status system** — explicitly rejected in favor of
  the simple Packed → Dispatched → Delivered model (Section 11).
- **Loyalty/rewards program** — future only.
- **Marketing/ad-spend ROI tracking** — future only, not yet designed.

---

## 28. Still open — under active discussion (do not assume answers)

Most items raised by the two external engineering reviews turned out to be
directly inferable from decisions already made elsewhere in this document,
or have since been explicitly confirmed with the user, and are folded into
the relevant sections above (marked "derived"/"default"/"confirmed" so
they're easy to spot and correct if wrong). What's left is genuinely
future-scope, not blocking current implementation:

- Purchase/reorder suggestion logic (manual owner judgment vs. system-
  suggested reorder based on sales velocity) — future.
- After-sales/complaint handling workflow — future.
- Staff accountability/performance tracking — future.
- Marketing/ad spend and ROI tracking — future.
- Multi-branch specifics beyond the two-warehouse model already defined
  (Section 7.1) — future, only relevant if a second physical location opens.
- Whether competitor price data entry (Section 17) becomes automated later.
- Specific hosting provider/domain — deliberately deferred by the user
  until other decisions are finalized (Section 30).

**Low-risk, safe to bolt on later without rework (noted so the agent
doesn't need to build them now, but shouldn't design against them either):**
- Global search bar (search orders/products/customers by phone, name,
  barcode, invoice number from anywhere in the app).
- Customer-facing SMS (e.g. "your order is out for delivery") — distinct
  from the internal staff notifications already deferred in Section 27;
  this is a separate future decision.
- Backorder/waitlist ("notify me when back in stock") for sold-out SKUs.
- Bulk invoice/label printing from the packing queue — one-at-a-time is
  fine at current volume; revisit if packing volume grows.
- Staff salary advance/loan tracking — fits into the Salary module
  (Section 15.10) later.
- Customer notes field (lightweight CRM note, e.g. "prefers COD," "always
  orders for his sister too") on the customer profile.
- Bangla UI toggle — not being built now, but strings/labels should be
  structured in a way that doesn't hardcode English text inline everywhere,
  so translation is a later addition rather than a rewrite.

---

## 29. UI/UX direction

- **Sidebar navigation pattern** (reference: a collapsible sidebar design —
  expanded state shows icon + label with expandable nested groups (e.g. an
  "Income" group expands to show Earnings/Refunds/Declines/Payouts);
  collapsed state shows icons only, and hovering a collapsed icon shows a
  flyout submenu popup. Badge/counter chips on nav items are used for counts
  like pending orders or low-stock alerts. Active/selected item gets a
  highlighted background.
- General visual direction: professional internal business-software look —
  not a generic AI-app template, not decorative. Sidebar navigation grouped
  by module, KPI stat cards at the top of the dashboard, card-based data
  tables, status shown as colored pills/badges, charts inside their own
  cards. **Exact color palette: see Section 36.1** — optimized for eye
  comfort and fast at-a-glance scanning during all-day internal use, not
  for public brand presentation; do not use a generic blue/purple SaaS
  default, but also don't over-decorate — flat, calm colors, used sparingly.
- For open-source/free UI references to study patterns from (not to copy
  code from), TailAdmin, Shadcn UI, Preline, and Tabler are reasonable
  references for Tailwind/React admin dashboards.
- Universal interaction pattern: clickable rows for editing, not action
  buttons (Section 19).

---

## 30. Tech decisions confirmed so far

- **AI:** Gemini API free tier only, for Messenger-paste order parsing. No other automatic
  AI use is part of the current product.
- **Courier:** Steadfast only.
- **Build tool:** OpenCode.
- **Hosting:** self-hosted and portable; provider/domain remain intentionally deferred.
- **Current development persistence:** Node/Express-style backend with React/TypeScript/Tailwind
  frontend and an in-memory DB implementation.
- **Production persistence target:** PostgreSQL because financial/inventory integrity,
  concurrency and durable recovery require transactional relational storage.
- Do not migrate persistence in the same task as authentication or accounting redesign;
  migrations must be explicit and tested.
- **Currency/timezone:** BDT, Asia/Dhaka.
- **Current notification transport:** SSE is accepted for the current one-way in-app broadcast
  use case. Do not replace it solely for architectural purity.
## 31. Non-negotiable engineering rules

1. Never regenerate the database schema from scratch — extend it.
2. Never remove role/permission checks to make something "work faster."
3. Every write that touches stock or money must write an audit log row.
4. One Order → one Invoice → one Order Barcode. No duplicates. **Invoice
   numbers are strictly sequential at allocation time, never reused, and
   never renumbered — a cancelled order's invoice number stays retired,
   which does mean cancellations leave visible gaps in the sequence.**
   (This resolves an earlier ambiguity: "gap-free" here means "no
   double-allocation from a race condition," not "no gaps ever" — the two
   can't both be true once cancellations exist, and never-reuse/never-
   renumber is the correct, safer choice. See 32.6/35.4 for the exact
   mechanism.)
5. Product identity = barcode-first lookup everywhere (receiving, selling,
   packing, returns, transfer).
6. Currency is BDT, timezone is Asia/Dhaka — hardcode this, don't build
   multi-currency/multi-timezone abstractions that aren't needed.
7. Build and ship in small phases (see Section 32) — do not attempt the
   entire system in one session/prompt. A prior attempt that tried to do
   too much at once resulted in missing Edit options, missing bulk print,
   an incomplete Accounting module, no Salary Sheet/Payslip, and no way to
   add new users — all because scope was too broad at once.
8. Stock is a ledger of movements, not a directly-editable number
   (Section 8).
9. Every entity is editable after creation, with full audit logging
   (Section 19).

---

## 32. Data integrity & transaction rules (added after external engineering review)

The sections above define *what* the system does. This section defines the
rules that keep it *correct* when multiple people, money, and courier events
happen concurrently. These are non-negotiable, pure engineering rules — no
business decision is required to adopt them, and they apply everywhere the
relevant pattern occurs, not just in the module where it's first mentioned.

**32.1 Atomicity for stock/order operations**
Creating an order (or any operation that reserves/releases/deducts stock)
must happen as a single database transaction: lock the relevant inventory
row → read current available quantity → verify requested quantity fits →
create the order/order-items/reservation → write the stock movement → write
the audit log → commit. If any step fails, the whole transaction rolls back.
Client-side stock checks are never sufficient by themselves — the database
must enforce this with row-level locking or an equivalent concurrency-safe
mechanism.

**32.2 Client display is informative, server is authoritative**
A staff screen showing "Available: 3" can be stale by the time they submit.
Every order submission must re-validate availability atomically against the
database at submit time, not trust what was rendered earlier. If the
server-side check fails, show a clear message (e.g. "Stock changed — only 1
unit is now available") rather than a generic error.

**32.3 Idempotency everywhere an action could be retried**
Courier booking, payments, refunds, stock receiving, order creation, invoice
generation, and webhook processing must all be idempotent — a duplicate
click, browser retry, network timeout, or duplicate webhook delivery must
never create a duplicate booking, duplicate payment, duplicate stock
movement, or duplicate invoice.

**32.4 Explicit stock event model**
Keep three concepts explicitly separate in the data model — do not merge
them:
- **Physical/available state**: ON_HAND, RESERVED, AVAILABLE (a computed or
  maintained snapshot per product per warehouse).
- **Stock movements** (the ledger from Section 8): PURCHASE, SALE, RETURN,
  DAMAGE, LOSS, TRANSFER, MARKETING_SAMPLE, GIFT, ADJUSTMENT,
  TESTER_CONVERSION.
- **Reservation events**: RESERVE, RELEASE — separate from the movement
  ledger, since a reservation is not yet a physical movement of stock.

**32.5 Negative inventory is prohibited at the database level**
Sellable inventory (on-hand or available) may never go negative through
normal operations. The database must reject any transaction that would
cause this — not just the UI. Manual admin adjustments that intentionally
correct a discrepancy are a distinct, logged, approved path (Section 26),
not a bypass of this rule.

**32.6 Invoice numbering**
Invoice numbers are generated transactionally and are **never reused**.
Cancelled invoices remain in the sequence and are marked cancelled rather
than deleted or renumbered — this is safer and more auditable than
pretending a cancelled document never existed. ("Gap-free" in Section 31
means "never skipped/double-allocated by a race condition," not "no
cancelled numbers ever appear.")

**32.7 Weighted-average costing calculation rules**
When the average cost is recalculated (on receiving new stock), define this
precisely: `new_avg = (old_qty × old_avg + received_qty × received_cost) /
(old_qty + received_qty)`. Critically: **historical COGS already recorded
on past sales must never silently change** just because a later purchase
shifts the current average. Past transactions keep the cost that was
correct at the time they happened.

**32.8 Audit logs are append-only**
Audit log records can never be edited or deleted through the application,
by anyone, including Owner. They are a permanent record. Distinguish (even
if stored in related tables) between: normal field-change audit ("selling
price changed from X to Y"), inventory/financial event log (a stock
movement or a payment), and security audit (login, failed login, password
change, permission change, account disabled).

**32.9 "Everything is editable" has a boundary**
Section 19's "click the row to edit, but log every change" principle
applies to business records like product info, customer info, draft orders,
etc. It does **not** mean financial/inventory *events already posted* (a
completed payment, a posted stock movement, a delivered order, a courier
booking, an invoice) can be destructively rewritten. Those are corrected
through a **reversal or adjustment transaction** (a new, linked event that
cancels or corrects the effect of the old one), never by editing the
original record in place. This preserves both the "editable but logged"
spirit and financial integrity.

**32.10 AI parsing boundaries (Messenger → Order feature, Section 3)**
The Gemini free-tier fallback may only ever *extract candidate field
values* for human review. It must never directly write to inventory or
accounting, and every extracted product must be matched against existing
product records and confirmed by a human before an order is created from it.

**32.11 Database migrations**
Migrations are version-controlled and forward-only in production. Any
destructive migration (dropping/renaming a column or table, data-lossy
changes) requires explicit confirmation from the user before running — this
follows directly from the existing rule "never regenerate the schema from
scratch, extend it" (Section 31).

---

## 33. AI coding agent safety protocol

Because this system is being built with an AI coding agent (OpenCode) rather
than a human dev team, the agent must follow these rules at all times, in
addition to everything else in this document:

1. Never invent a business rule that isn't written in this document — if a
   needed decision isn't covered here, add it to Section 28 (open questions)
   and ask, rather than guessing.
2. Never change a decision already confirmed in this document without the
   user explicitly approving the change.
3. Never delete existing data or schema to work around a problem.
4. Never disable or bypass an authorization/permission check to make a
   feature "work" faster.
5. Never modify financial or inventory logic without accompanying tests
   (Section 34).
6. Never run a destructive database change without explicit confirmation.
7. Never fabricate API credentials or pretend an integration works when it
   hasn't actually been connected/tested.
8. Never silently substitute a different external service, library, or
   approach than what's specified here without flagging the change.
9. Run the relevant tests after making a change, and report if any fail.
10. Before running a migration, explain what it will do and its impact.
11. Preserve existing working functionality when adding something new —
    don't regress earlier phases while building a later one.
12. Work only within the current phase (Section 40) unless explicitly told
    to jump ahead.
13. **A feature is not done when it looks complete — it's done when it
    actually works, end to end, including edge cases** (confirmed
    emphasis): every button, calculation, validation, print action, stock
    update, status change, barcode verification, and bulk operation must
    be functionally wired to real logic, not a UI shell around a
    to-be-implemented action. Before reporting a phase/feature as
    finished, actually exercise it (not just visually inspect it) — e.g.
    create a real test order and confirm stock actually moves, run the
    total-mismatch scenario from Section 3.0a and confirm the flag
    actually appears, print an invoice and confirm the PDF actually
    generates. "The screen exists" and "the screen works" are different
    claims — only report the second.

---

## 34. Testing requirements

Not exhaustive, but the minimum bar for a system handling real inventory and
money:

- **Unit tests** for: weighted-average costing (Section 32.7), landed cost
  allocation, payment splitting, refund calculations, profit calculations,
  invoice numbering, permission checks.
- **Integration tests** for: order → reservation, packing → stock deduction,
  Steadfast booking, courier status sync, return → refund, purchase →
  inventory, courier payout → Courier Receivable reconciliation.
- **Concurrency tests** — this is the most important one given Section 4 and
  32.1: simulate two staff attempting to buy the last unit of the same
  product at the same time. Exactly one must succeed, one must fail
  cleanly, and stock must never go negative.
- **Permission tests**: a Packing-role user attempting to hit
  Accounting/Salary/Expense endpoints directly (not through the UI) must be
  rejected server-side every time.

---

## 35. Critical algorithms (implement exactly as specified — not open to interpretation)

These are the highest-risk points where a small implementation assumption
could silently corrupt stock or money. Pseudocode, not literal final code —
adapt to the actual language/framework/ORM chosen, but the *logic and
sequence* must match exactly.

### 35.1 Order creation with stock reservation (Section 3, 4, 32.1)
```
FUNCTION create_order(customer, items, channel, payment_info):
  -- "items" may include bundle lines (Section 6.1) — expand each bundle
  -- into its component SKUs BEFORE locking, so every lock/check/reserve
  -- below operates on real underlying inventory rows, never a bundle's
  -- own (non-inventoried) row.
  expanded_items = expand_bundles(items)   -- bundle line -> N component lines

  BEGIN TRANSACTION
    FOR EACH item IN expanded_items (locked in a stable, consistent order
                                       — e.g. sorted by product_id — to
                                       avoid deadlocks between concurrent
                                       orders touching overlapping SKUs):
      LOCK inventory_row WHERE product_id = item.product_id
                          AND warehouse_id = item.warehouse_id
      available = on_hand - reserved  (read AFTER lock is acquired)
      IF item.quantity > available:
        ROLLBACK
        RETURN error("Only {available} units available for {product.name}")
    order = INSERT order (status = 'confirmed', channel, customer, ...)
    FOR EACH item IN items (the ORIGINAL lines, bundle or not — order_item
                             rows reflect what the customer actually
                             ordered):
      INSERT order_item (order_id, product_id_or_bundle_id, quantity, price)
    FOR EACH item IN expanded_items (the REAL component lines):
      INSERT reservation_event (order_id, product_id, quantity, type='RESERVE')
      UPDATE inventory_row SET reserved = reserved + item.quantity
    invoice = generate_invoice(order)   -- sequential number, Section 32.6
    order_barcode = generate_order_barcode(order)
    INSERT audit_log (actor, action='order_created', entity=order.id, ...)
    broadcast_notification('new_order', order)   -- Section 25
    IF channel == 'walk-in':
      -- see 35.1a: walk-in deducts on_hand and books revenue immediately,
      -- inline in this same transaction, not as a separate later step.
      perform_walkin_immediate_fulfillment(order, expanded_items, payment_info)
  COMMIT
  RETURN order, invoice
```

### 35.1a Walk-in sale (immediate fulfillment, Section 15.3, 37)
Walk-in is a **distinct order-creation path**, not the Messenger-paste flow
with the paste box skipped. The screen is a scan-to-cart POS flow: staff
scans each product barcode (or bundle barcode), quantity defaults to 1 per
scan (adjustable), running total shown live, payment captured (cash/bKash/
card/split — Section 15.5) before the sale completes. Unlike an online
order, a walk-in sale has no "packing" or "dispatch" step — the moment it's
rung up, the item has physically left the shop in the customer's hand.
Called from inside `create_order`'s transaction when `channel == 'walk-in'`:
```
FUNCTION perform_walkin_immediate_fulfillment(order, expanded_items, payment_info):
  -- runs INSIDE create_order's transaction — same atomic unit, not a
  -- separate follow-up call
  FOR EACH item IN expanded_items:
    UPDATE inventory_row SET on_hand = on_hand - item.quantity,
                              reserved = reserved - item.quantity
    INSERT stock_movement (product_id, warehouse_id, qty=-item.quantity,
                            reason='SALE', ref=order.id)
  post_journal_entries(order)   -- Dr Cash/Bank/bKash, Cr Sales Revenue;
                                 -- Dr COGS, Cr Inventory — Section 15.0,
                                 -- using current avg_cost per component
  record_payment_transactions(order, payment_info)   -- Section 15.5
  UPDATE order SET status = 'delivered'   -- walk-in orders skip
                                           -- Packed/Dispatched entirely;
                                           -- "delivered" here just means
                                           -- "fulfilled, revenue booked"
```

### 35.1b Packing-time stock deduction for online orders (Section 5, 10, 11)
This is the missing piece both external reviews correctly flagged: for an
**online/Messenger order**, physical stock leaves the warehouse at
packing/dispatch, days before Steadfast confirms Delivered — but revenue/
COGS booking stays deferred to Delivered (Section 15.15). These are two
different clocks and must be handled by two different steps:
```
FUNCTION mark_order_packed(order_id, actor, verified_items):
  -- called after Section 10's barcode verification confirms every scanned
  -- item matches the order
  BEGIN TRANSACTION
    order = SELECT order WHERE id = order_id FOR UPDATE
    FOR EACH item IN order's expanded (component-level) items:
      UPDATE inventory_row SET on_hand = on_hand - item.quantity,
                                reserved = reserved - item.quantity
      INSERT stock_movement (product_id, warehouse_id, qty=-item.quantity,
                              reason='SALE', ref=order.id)
      -- NOTE: no journal/revenue entry yet — that still waits for
      -- Delivered, per 15.15. This movement only affects physical
      -- on_hand, which is exactly why it must happen now, at packing,
      -- not later — otherwise a manual stock count during the delivery
      -- window won't match on_hand.
    UPDATE order SET status = 'packed'
    INSERT audit_log (actor, action='order_packed', entity=order.id, ...)
  COMMIT

FUNCTION on_steadfast_delivered_webhook(order_id, webhook_payload):
  -- see 35.6 for webhook authentication — this only runs once verified
  BEGIN TRANSACTION
    order = SELECT order WHERE id = order_id FOR UPDATE
    UPDATE order SET status = 'delivered'
    post_journal_entries(order)   -- Dr Courier Receivable, Cr Sales Revenue;
                                   -- Dr COGS, Cr Inventory — Section 15.0/15.2
                                   -- using avg_cost AT THE TIME of packing
                                   -- (stored on the stock_movement row from
                                   -- 35.1b, not re-fetched now)
    record_delivery_status_event(order, 'delivered', webhook_payload)
  COMMIT
```
This resolves the contradiction the reviews found: **`on_hand` decrements
at Pack** (physical event); **the P&L journal entry posts at Delivered**
(financial recognition event, Section 15.15). Between those two points,
the item is correctly "gone from on_hand" but "not yet revenue" — which
matches reality (it's in the courier's hands, not yet paid for by a real
customer, but also no longer sitting on the shelf).

### 35.1c Editing an already-confirmed order (confirmed requirement — this
was a real gap, now resolved)
Customers change their mind after an order is confirmed — add/remove
products, change quantity, correct name/phone/address. This must be a
real, working feature, not just a UI form that doesn't touch the
underlying reservation correctly.

**When editing is allowed:** only while the order is still `CONFIRMED`
(i.e. before Packing has started — Section 35.5's lifecycle). Once
`PACKED`, the physical item has already been pulled and `on_hand` already
deducted (35.1b) — at that point, changes go through Cancel (11.1) +
Return/scan-back (35.2a) or a fresh order, not a live edit, since the
physical stock consequence is already real. This mirrors the same
before/after-packing split cancellation already uses.

**Customer info fields (name/phone/address/delivery method):** simple
field update with an audit log entry (old value → new value) — no stock
consequence, no special algorithm needed beyond the standard "editable
with audit log" pattern (Section 19).

**Line items (products/quantities) — needs the same atomicity/locking
discipline as order creation:**
```
FUNCTION edit_order_items(order_id, new_items, actor):
  BEGIN TRANSACTION
    order = SELECT order WHERE id = order_id FOR UPDATE
    IF order.status != 'confirmed':
      ROLLBACK; RETURN error("order can no longer be edited — already packed")

    old_items = expand_bundles(current order_items for order_id)
    new_expanded = expand_bundles(new_items)

    -- compute the delta per product (locked in a stable, consistent
    -- order, same deadlock-avoidance reasoning as 35.1)
    FOR EACH product IN (old_items ∪ new_expanded), sorted by product_id:
      LOCK inventory_row WHERE product_id, warehouse_id
      old_qty = old_items[product].quantity OR 0
      new_qty = new_expanded[product].quantity OR 0
      delta = new_qty - old_qty
      IF delta > 0:
        available = on_hand - reserved
        IF delta > available:
          ROLLBACK
          RETURN error("Only {available} more units available for {product.name}")
      -- (delta < 0 always succeeds — releasing reservation never fails)

    -- all checks passed — apply the changes
    FOR EACH product IN (old_items ∪ new_expanded):
      delta = new_expanded[product].quantity - old_items[product].quantity
      IF delta != 0:
        INSERT reservation_event (order_id, product_id, quantity=ABS(delta),
                                   type = delta > 0 ? 'RESERVE' : 'RELEASE')
        UPDATE inventory_row SET reserved = reserved + delta

    -- replace order_items to match new_items (the original, non-expanded
    -- lines the customer actually asked for), recompute totals
    DELETE old order_items for this order; INSERT new_items as order_items
    recalculate order.subtotal / discount_amount / total
    regenerate_invoice(order)  -- same invoice number (32.6) — an edited
                                -- order does NOT get a new invoice number,
                                -- the existing invoice PDF is regenerated
                                -- with updated line items
    INSERT audit_log (actor, action='order_items_edited', entity=order.id,
                       before=old_items, after=new_items, ...)
  COMMIT
```
This follows the exact same locking/atomicity discipline as 35.1 — an edit
that increases quantity re-validates availability exactly like a new
order would, and can fail cleanly with the same "only N available"
message if someone else has taken the stock in the meantime.

**UI:** an "Edit Order" action is available on any `CONFIRMED` order's
detail view (Section 37) — reuses the same product-search/add-line
interface as New Order creation, pre-filled with the current line items,
so staff aren't learning a second interface for edits.

### 35.2 Cancellation (Section 11.1) — corrected
The earlier version of this algorithm was wrong: it applied an
unconditional "scan back required" rule regardless of whether the item had
physically left the warehouse yet, which either asks staff to scan bottles
that never left the shelf (pre-pack cancel) or drives `reserved` negative
(post-pack cancel, since packing already zeroed it out per 35.1b). The
correct behavior branches on order status at the moment of cancellation:
```
FUNCTION cancel_order(order_id, reason, actor):
  BEGIN TRANSACTION
    order = SELECT order WHERE id = order_id FOR UPDATE
    IF order.status IN ('cancelled', 'delivered'):
      ROLLBACK; RETURN error("cannot cancel from this state")

    IF order.status == 'confirmed':
      -- stock was only ever RESERVED, never physically removed.
      -- Releasing the reservation alone is correct and sufficient —
      -- Available jumps back up immediately. NO scan-back needed; the
      -- bottle never left the shelf.
      FOR EACH item IN order's expanded items:
        INSERT reservation_event (order_id, product_id, quantity, type='RELEASE')
        UPDATE inventory_row SET reserved = reserved - item.quantity

    ELSE IF order.status IN ('packed', 'dispatched'):
      -- stock was already physically deducted from on_hand at packing
      -- (35.1b). Cancelling now does NOT touch inventory at all — the
      -- item is physically out of the building. Getting it back into
      -- on_hand requires the physical item to actually be scanned back
      -- in (35.2a) once/if it's recovered — that is a SEPARATE, later
      -- action, not part of this transaction.
      -- (No reserved/on_hand change here at all.)

    UPDATE order SET status = 'cancelled', cancel_reason = reason
    IF order had payment(s):
      FOR EACH payment IN order.payments:
        INSERT refund_transaction (linked_payment=payment.id, amount, ...)
    INSERT audit_log (actor, action='order_cancelled', entity=order.id,
                       reason=reason, prior_status=order.status,
                       refunded=<bool>, ...)
  COMMIT
```

### 35.2a Physical scan-back — only relevant once goods have physically left (Section 11.1, 13.1)
This only ever applies to a **packed/dispatched/RTO** order (i.e. an order
where 35.1b already deducted `on_hand`) — never to a pre-pack cancellation,
which needs no scan-back at all (see 35.2). It must reference the order/
event it's restoring stock for, to prevent duplicate or mismatched scans:
```
FUNCTION scan_back_to_stock(barcode, warehouse_id, condition, order_id):
  product = lookup_by_barcode(barcode)
  BEGIN TRANSACTION
    -- verify this order actually has an outstanding physical item to
    -- restore (was packed/dispatched/RTO and not already scanned back)
    pending = SELECT pending_scan_back WHERE order_id = order_id
                                        AND product_id = product.id
                                        FOR UPDATE
    IF pending is NULL or already fulfilled:
      ROLLBACK; RETURN error("no outstanding item to restore for this order")

    IF condition == 'good':
      INSERT stock_movement (product_id, warehouse_id, qty=+1, reason='RETURN',
                              ref=order_id, unit_cost=current_avg_cost(product))
      UPDATE inventory_row SET on_hand = on_hand + 1
      -- restocked at the CURRENT weighted-average cost at the time of
      -- restock, not the original sale's COGS — this keeps the ledger's
      -- avg_cost calculation (35.3) internally consistent, since it's
      -- the same formula used for any other stock-in event.
    ELSE:
      INSERT stock_movement (product_id, warehouse_id, qty=+1, reason='DAMAGE',
                              ref=order_id)
      UPDATE damaged_stock_row SET quantity = quantity + 1
                               WHERE product_id, warehouse_id
      -- damaged_stock is its own tracked row per product/warehouse,
      -- same pattern as tester stock (35.2b) — not folded into on_hand.
    UPDATE pending_scan_back SET fulfilled = true
    INSERT audit_log (actor, action='stock_scanned_back', order_id=order_id, ...)
  COMMIT
```

### 35.2b Tester conversion (Section 8)
```
FUNCTION convert_to_tester(product_id, warehouse_id, quantity, actor, reason):
  BEGIN TRANSACTION
    LOCK inventory_row WHERE product_id, warehouse_id
    IF quantity > (on_hand - reserved): ROLLBACK; RETURN error("insufficient stock")
    UPDATE inventory_row SET on_hand = on_hand - quantity
    UPDATE tester_stock_row SET quantity = quantity + quantity
                             WHERE product_id, warehouse_id
    INSERT stock_movement (product_id, warehouse_id, qty=-quantity,
                            reason='TESTER_CONVERSION')
    INSERT audit_log (actor, action='tester_conversion', reason=reason, ...)
  COMMIT
```
Tester stock and damaged stock are each their **own tracked row** per
product/warehouse (`tester_stock`, `damaged_stock` tables) — separate from
`on_hand`, matching how Section 22's report labeling ("On Hand vs Available
vs Reserved vs Damaged vs Tester") already implies five distinct numbers,
not three.

### 35.3 Weighted-average cost update on receiving (Section 15.8, 32.7)
```
FUNCTION receive_stock(product_id, warehouse_id, qty_received, landed_cost_per_unit):
  BEGIN TRANSACTION
    inv = SELECT inventory_row WHERE product_id, warehouse_id FOR UPDATE
    new_avg = (inv.on_hand * inv.avg_cost + qty_received * landed_cost_per_unit)
              / (inv.on_hand + qty_received)
    UPDATE inv SET on_hand = on_hand + qty_received, avg_cost = new_avg
    INSERT stock_movement (reason='PURCHASE', qty=+qty_received, unit_cost=landed_cost_per_unit)
    -- Past sales already recorded keep whatever avg_cost was correct AT
    -- THE TIME they were sold (their COGS is a stored value on that sale

    -- record, never recalculated retroactively from the new avg_cost).
  COMMIT
```

### 35.4 Invoice number allocation (Section 32.6)
```
FUNCTION allocate_invoice_number():
  BEGIN TRANSACTION
    next = SELECT next_invoice_number FROM counters FOR UPDATE
    UPDATE counters SET next_invoice_number = next + 1
  COMMIT
  RETURN next
  -- Called ONLY inside the same transaction as order creation (35.1), so
  -- a rolled-back order never leaves a "used" number behind. A cancelled
  -- (but already-created) invoice keeps its number and is marked
  -- cancelled — never deleted, never reissued to another order.
```

### 35.5 Order lifecycle (internal states, not all customer-facing)
```
DRAFT (parsing/preview — see note below on persistence)
  → CONFIRMED (stock reserved, invoice+order barcode exist)
      → CANCELLED (reservation released — no scan-back needed, 35.2)
      → PACKED (Packing team verified items via barcode — Section 10;
                 on_hand deducted here for online orders — 35.1b)
          → CANCELLED (stock stays deducted; recovery is a separate later
                        scan-back if the item is physically recovered —
                        35.2/35.2a)
          → DISPATCHED (Steadfast booking confirmed, label printed — Section 9)
              → [Steadfast-driven states synced, not stored as our own
                 enum: Picked Up / In Transit — Section 11]
              → DELIVERED (revenue/COGS journal posted now for online
                            orders — 15.15/35.1b)
                  → RETURNED (Section 13 return flow — scan-back applies)
              → RTO (Section 13.1 — never reached Delivered, so no revenue
                      to reverse; courier cost + scan-back-after-check apply)

WALK-IN orders (35.1a) skip Packed/Dispatched entirely: CONFIRMED →
DELIVERED happens inside the same transaction as order creation, since
there's no separate packing/courier step for an over-the-counter sale.
```

**DRAFT persistence (resolved):** the parsed Messenger-paste preview is
held **client-side only** (in the browser, not written to the database)
until the staff member clicks "Create Order." Nothing is persisted for a
draft that's abandoned or corrected before confirming — this avoids
littering the database with half-entered, never-confirmed drafts, and
matches the existing rule that AI-parsed output is never trusted directly
(Section 32.10). Only `CONFIRMED` and later states are real, stored order
rows.

**Which warehouse does an online order reserve from? (resolved):** always
the **Shop Floor** warehouse (Section 7.1) — that's what Packing physically
pulls from to fulfill an order, so reservation must happen against the same
warehouse fulfillment actually draws down. If Shop Floor doesn't have
enough stock for an online order but Main/Back-store does, that's a signal
a Stock Transfer (Section 7.1) is needed *before* the order can be
fulfilled — the system should surface this as "insufficient stock at Shop
Floor" rather than silently reserving from Main.

### 35.6 Idempotency keys and webhook authentication
**Order creation / payments / refunds / stock receiving (Section 32.3):**
every create-type request from the frontend includes a client-generated
**idempotency key** (a UUID generated once per user action, e.g. once per
"Create Order" button press, resent unchanged on automatic retry). The
backend stores recently-seen idempotency keys per operation type; if the
same key arrives again (double-click, network retry, browser resubmit), it
returns the original result instead of performing the action twice — this
is the concrete mechanism behind the "must be idempotent" rule.

**Steadfast webhooks:** the inbound webhook endpoint (used for `35.1b`'s
`on_steadfast_delivered_webhook` and other status updates) must **verify
the request actually came from Steadfast** before acting on it — e.g. a
shared-secret signature/token Steadfast includes in the request, checked
before any status change or revenue posting happens. An unauthenticated
webhook is a financial-integrity hole, since a forged "Delivered" event
would trigger real revenue recognition (Section 15.15) for an order that
was never actually delivered. Confirm during Phase 4 build-out whether
Steadfast actually offers webhooks (push) or only a polling API — if it's
polling-only, replace the webhook handler with a scheduled poll job that
checks booked orders' status periodically; the authentication concern
becomes moot (it's your own outbound API call) but idempotent status
updates still apply.

---



## 36. Design System (non-negotiable — do not substitute a different theme)

This section exists so the coding agent never has to invent a visual
identity. Treat every value below as fixed unless the user explicitly
changes it.

### 36.1 Color palette

**Design priority (confirmed):** this is an **internal-only tool staff
will stare at all day**, not a public-facing brand showcase — eye comfort
over long sessions and speed of visual scanning (color-coded recognition
at a glance, not careful reading) take priority. Within that, the user
also confirmed a real convention worth respecting: **software/dashboard
products read as "premium/professional" specifically through a blue-family
primary color** (this is why banking and financial dashboards lean navy/
blue — it reads as trustworthy and serious in a software context, unlike
a consumer/lifestyle brand). So the palette below is now blue-based, but a
**deep navy**, not a bright generic-SaaS blue, paired with a warm gold
accent — navy+gold is a well-established "premium professional software"
pairing distinct from the light-blue startup look this document was
originally trying to avoid.

- **Base background**: soft off-white `#F9F8F7` (not pure white `#FFFFFF`
  — a slight warmth reduces glare/eye strain across a full workday).
  **Cards**: pure white `#FFFFFF` so they read as distinct surfaces against
  the slightly-off base.
- **Primary text**: dark gray `#222222` (not pure black — pure black
  against white has harsher contrast than needed and is more fatiguing
  over long reading sessions). **Secondary/meta text**: mid gray `#6B6B6B`.
- **Primary/accent — deep navy** `#16324F` (buttons, active nav item,
  links, focus states, headers). Used deliberately as **small/medium
  elements, not large full-page fills** — this keeps the eye-comfort goal
  intact even with a darker, more saturated primary than before. **Secondary
  accent — warm gold** `#B8860B` (used sparingly: highlights, premium-feel
  touches, a small number of key numbers/icons) — this is what keeps navy
  from reading as "generic corporate blue" and gives it the "premium
  software" feel specifically.
- **Borders/dividers**: light neutral gray `#E5E5E5` (not tinted to the
  accent color — a neutral border scans faster than a colored one when
  the goal is speed, not decoration).
- **Status colors** (used consistently everywhere a status pill/badge
  appears) — chosen for **fast, unambiguous recognition at a glance**, and
  deliberately **distinct from the navy primary** so a status pill is
  never confused with a clickable primary-action element: green `#16A34A`
  (success/delivered/paid/verified), amber `#D97706` (pending/warning/
  awaiting), red `#DC2626` (cancelled/failed/overdue/damaged), **teal**
  `#0891B2` (informational/in-transit/processing — shifted away from blue
  specifically so it doesn't visually clash with the now-blue primary
  accent), gray `#9CA3AF` (draft/inactive/neutral).
- **Colorblind-safety note**: since fast scanning relies on color, every
  status pill also carries a short text label and/or icon (Section 36.5) —
  never color alone as the only signal, since color-only recognition fails
  for colorblind users and is also just slower to parse than color+label
  together for everyone.
- Never introduce a purple/blue SaaS gradient or any decorative gradient
  anywhere in the app — flat, calm colors only, consistent with the
  eye-comfort priority above.

### 36.1a Theme system (current confirmed direction)

The active theme modes are **Light / Dark / System**.

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#F9F8F7` | dark gray/navy surface |
| `--card` | `#FFFFFF` | slightly lighter dark surface |
| `--text` | `#222222` | soft light neutral |
| `--text-secondary` | `#6B6B6B` | muted light neutral |
| `--accent` | `#16324F` | dark-safe navy accent |
| `--accent-secondary` | `#B8860B` | warm gold |
| `--border` | `#E5E5E5` | dark neutral border |

Light visual language: warm off-white canvas, white surfaces, deep navy primary,
restrained muted gold, soft neutral borders, dark charcoal text.

Dark visual language: comfortable obsidian/dark-gray surfaces, navy-tinted accents,
restrained gold, soft borders, and non-harsh text.

System follows OS/browser `prefers-color-scheme`.

Theme is a per-user preference and must apply consistently to the entire ERP:
sidebar, top bar, Products, Orders, POS, tables, forms, modals, popovers, charts,
notifications and shared components.

Do not add another theme architecture unless explicitly requested.

### 36.1b Global theming implementation rule

The centralized theme token system is the source of truth for visual colors. Components
must not use hardcoded light-only colors that prevent Light/Dark/System from applying globally.
Fix the underlying component styling rather than stacking ad-hoc CSS overrides.

### 36.1c Global typography

Use one professional UI font system consistently. The Settings font selector must actually
change the global application font. Keep operational numbers, SKUs and tables highly legible
with restrained font weights.
### 36.2 Typography
- Sans-serif throughout (system font stack or Inter/similar — pick one and
  use it everywhere, don't mix families).
- Scale: page titles 24px/bold, section headers 18px/semibold, card/table
  headers 14px/semibold uppercase-tracked, body text 14px/regular, small/
  meta text 12px/regular in the mid-gray secondary color.
- Numbers in tables/cards that represent money or quantities should be
  right-aligned and use a tabular/monospaced-figure style so columns of
  numbers line up.

### 36.3 Spacing & layout
- Consistent spacing scale: 4px base unit (4/8/12/16/24/32px steps) — no
  arbitrary one-off spacing values.
- Cards: white background, 1px soft border (`#E5E5E5`), rounded corners
  (8px radius), consistent internal padding (16–24px).
- Page layout: fixed left sidebar (Section 36.4) + top bar + main content
  area with consistent max content padding. No full-bleed content except
  the sidebar itself.

### 36.4 Sidebar navigation (fixed pattern — see also Section 29)
- Collapsible: a toggle control at the top collapses the sidebar to
  icon-only width; a hover on a collapsed icon opens a flyout panel showing
  that section's sub-items (matching the reference pattern already agreed
  on).
- Expanded state: icon + label per item; groups with sub-items are
  expandable/collapsible in place (chevron indicator), not separate pages.
- Active item: highlighted background using the primary accent (a tinted
  background, not a jarring pure color fill), with bold or accent-colored
  text/icon.
- Badge/counter chips: small pill on the right side of a nav item, used for
  counts that need attention (e.g. "Pending Orders: 5", "Low Stock: 3") in
  the amber/red status colors above depending on urgency.
- Sidebar groups and order (top to bottom) — this is the full navigation
  tree, not illustrative. **Renamed from an earlier version to remove
  confusing near-duplicate names** (e.g. two different things both called
  "Ledger," two different things both about "RTO") — this is now the
  authoritative naming, replacing any earlier list:
  1. **Dashboard**
  2. **Orders** — New Order (Messenger Paste), Walk-in Sale (POS),
     **Today's Orders** (a quick default-filtered view — today's date,
     all statuses — this was missing before and is a real daily need,
     distinct from "All Orders" which has no date filter applied), All
     Orders, Cancelled Orders, Returns & RTO
  3. **Packing** *(only visible to Packing role — see Section 5; for other
     roles this item doesn't appear at all)*
  4. **Inventory** — Products, **Stock Movements** (renamed from "Stock
     Ledger" specifically to not collide with Accounting's "Transaction
     Ledger" below — same data/meaning as before, name-only change),
     Stock Transfer, Batches (Section 21), Testers
  5. **Purchasing** — Suppliers, Purchase Orders, Purchase Returns
  6. **Courier** — **Booking History** (renamed from "Bookings" — this is
     read-only history/search, the actual booking *action* lives in
     Packing per Section 37's resolved ownership; the old name implied you
     could start a booking here, which isn't true), **Live Tracking**
     (renamed from "Tracking" for clarity), **RTO Tracking** (renamed from
     "RTO Log" — this is the courier-side shipment tracking for RTO
     parcels specifically, distinct from Orders → "Returns & RTO" above,
     which is the order-record view of the same events; two different
     purposes, now two clearly different names)
  7. **Customers**
  8. **Accounting** — **Transaction Ledger** (renamed from "Ledger" — see
     Inventory's rename above, same reasoning), Income, Expenses,
     Payments, Salary & Payslips, Reconciliation (Courier/Bank/MFS),
     Payable & Receivable, Profit & Loss
  9. **Pricing** — Pricing Engine, Market/Competitor Data
  10. **Reports**
  11. **Users & Roles**
  12. **Audit Log**
  13. **Settings**
- Below the main nav, a compact user menu (avatar/name, role, logout) is
  pinned at the sidebar bottom.

### 36.4a Sidebar — literal implementation skeleton (MANDATORY, not a
suggestion — build exactly this data-driven structure, do not invent a
different one)
This is not optional guidance to interpret — it's the actual structure to
implement. Define the navigation as **data**, then render it, so every
item from 36.4's tree is guaranteed to exist (nothing gets silently
dropped because it renders from a list, not hand-typed JSX per item):
```jsx
// nav-config.js — the SINGLE source of truth for sidebar content.
// Every item in Section 36.4's numbered list MUST have an entry here.
// If you are building the sidebar and this file has fewer than 13
// top-level groups, STOP — you have missed something from Section 36.4.
export const NAV_CONFIG = [
  { id: "dashboard", label: "Dashboard", icon: "LayoutDashboard", path: "/dashboard" },
  { id: "orders", label: "Orders", icon: "ShoppingCart", children: [
      { label: "New Order", path: "/orders/new" },
      { label: "Walk-in Sale", path: "/orders/walk-in" },
      { label: "Today's Orders", path: "/orders/today" },
      { label: "All Orders", path: "/orders" },
      { label: "Cancelled Orders", path: "/orders/cancelled" },
      { label: "Returns & RTO", path: "/orders/returns" },
  ]},
  { id: "packing", label: "Packing", icon: "PackageCheck", path: "/packing",
    requiresTier: ["packing_staff", "owner", "general_manager", "manager"] },
  { id: "inventory", label: "Inventory", icon: "Boxes", children: [
      { label: "Products", path: "/inventory/products" },
      { label: "Stock Movements", path: "/inventory/movements" },
      { label: "Stock Transfer", path: "/inventory/transfer" },
      { label: "Batches", path: "/inventory/batches" },
      { label: "Testers", path: "/inventory/testers" },
  ]},
  { id: "purchasing", label: "Purchasing", icon: "Truck", children: [
      { label: "Suppliers", path: "/purchasing/suppliers" },
      { label: "Purchase Orders", path: "/purchasing/orders" },
      { label: "Purchase Returns", path: "/purchasing/returns" },
  ]},
  { id: "courier", label: "Courier", icon: "Send", children: [
      { label: "Booking History", path: "/courier/bookings" },
      { label: "Live Tracking", path: "/courier/tracking" },
      { label: "RTO Tracking", path: "/courier/rto" },
  ]},
  { id: "customers", label: "Customers", icon: "Users", path: "/customers" },
  { id: "accounting", label: "Accounting", icon: "Landmark", children: [
      { label: "Transaction Ledger", path: "/accounting/ledger" },
      { label: "Income", path: "/accounting/income" },
      { label: "Expenses", path: "/accounting/expenses" },
      { label: "Payments", path: "/accounting/payments" },
      { label: "Salary & Payslips", path: "/accounting/salary" },
      { label: "Reconciliation", path: "/accounting/reconciliation" },
      { label: "Payable & Receivable", path: "/accounting/payable-receivable" },
      { label: "Profit & Loss", path: "/accounting/pnl" },
  ]},
  { id: "pricing", label: "Pricing", icon: "Tag", children: [
      { label: "Pricing Engine", path: "/pricing/engine" },
      { label: "Market/Competitor Data", path: "/pricing/market" },
  ]},
  { id: "reports", label: "Reports", icon: "FileBarChart", path: "/reports" },
  { id: "users", label: "Users & Roles", icon: "ShieldCheck", path: "/settings/users" },
  { id: "audit", label: "Audit Log", icon: "History", path: "/audit-log" },
  { id: "settings", label: "Settings", icon: "Settings", path: "/settings" },
];
```
Rendering rules (also mandatory): each `children` array renders as an
expandable group in the expanded sidebar state and as a hover-flyout in
the collapsed state (36.4). Badge counts (e.g. Pending Orders, Low Stock)
are computed data merged onto the relevant `id` at render time, not
hardcoded into `NAV_CONFIG`. Items with `requiresTier` are filtered out of
the rendered list entirely for users whose tier/toggles don't grant access
— not shown-then-disabled.

### 36.5 Component conventions

- **Buttons:** primary = filled deep navy in the active theme; secondary = outlined/ghost;
  destructive actions are clearly red.
- **Status pills/badges:** reserved for statuses/alerts; use soft semantic tints plus text/icon.
- **Data tables:** readable dense rows, sortable headers, filters above. Row click opens a
  read-first Details workspace; editing is a deliberate follow-up action.
- **Selection Mode:** bulk selection controls appear only after the user enters Selection Mode.
  Shift-click/range selection and multi-selection are preferred over a permanent checkbox column.
- **Forms/modals:** consistent structure, clear Save/Cancel/Close, Escape support, inline validation.
- **Popovers:** normal click-outside + Escape; no aggressive touch/mousedown behavior.
- Avoid unnecessary explanatory copy and duplicate primary actions.
## 37. Complete screen/tab specification per module

This is the current implementation target. If a view is not listed or clearly implied here,
treat it as out of scope until explicitly confirmed.

**Login / Authentication:** Login, Forgot Password, TOTP 2FA when enabled, session expiry,
no public signup.

**Dashboard:** one role/toggle-aware dashboard component with charts where trends,
breakdowns and comparisons are relevant.

**Orders:** New Order (Messenger/AI parser with Direct vs Merchant Fulfillment
model, mandatory-field validation, structured review, editable Invoice Note selector),
Walk-in Sale, Today's Orders, All Sales & Orders, Cancelled Orders, Returns & RTO,
Order Details workspace → explicit Edit. Merchant Fulfillment orders follow the
same packing/dispatch workflow and have a separate Merchant Sticker print action.

**Packing:** Packing queue, barcode verification, invoice/label printing, courier booking,
dispatch workflow.

**Inventory:** Products, Stock Movements, Stock Transfer, Batches, Testers, Fragrance Notes.

**Products current requirements:** read-first Details workspace, large image, identity and
fragrance information, warehouse stock/location summary, real date/history fields when
available, explicit Edit, search/filtering, wholesale-price protection, contextual Selection
Mode, bulk print/PDF/wholesale-price-list actions, gross packaged weight, product-level
wholesale rule, and recent-price-update ordering/highlighting controlled by Settings.

**Purchasing:** Suppliers, Purchase Orders, Purchase Returns.

**Courier:** Booking History, Live Tracking, RTO Tracking. Booking action belongs in Packing.

**Customers:** list, profile, order history, spend, addresses, risk indicators, notes.

**Accounting:** Transaction Ledger, Income, Expenses, Payments, Salary & Payslips,
Reconciliation (Courier/Bank/MFS), Payable & Receivable, Profit & Loss.

**Pricing:** Pricing Engine, Market/Competitor Data.

**Reports:** individual report types with preview-then-print/export.

**Users & Roles:** user list and permission matrix.

**Audit Log:** searchable/filterable, read-only, append-only history.

**Settings:** Profile, Preferences (theme/font/notifications), Company, Delivery & Courier,
Categories, Users & Roles, Approval Rules, Integrations, System. Preferences/Company
configuration also includes editable default Direct-order invoice-note templates and
the parser-related note behavior; staff should not need to paste the same note manually.

**Operations:** the already-implemented Packaging Materials module remains supported and
documented rather than removed simply because it was added after the original brief.
## 38. Analytics & chart specification

**This section is mandatory, not a style suggestion.** If a dashboard or
report shows a number that has a trend, a breakdown, or a comparison, and
it's rendered as plain text/a table instead of the chart type below, that
screen is **not done** — it fails Section 33 rule #13's "actually works,
not just looks complete" bar. Every place this document calls for "a
chart" or "visualization," use this mapping — don't leave chart-type
choice to the agent:

- **Sales over time** (daily/weekly/monthly trend, any dashboard/report):
  **line chart**, with a date-range selector (7/30/90 days, custom).
- **Revenue vs. Orders comparison** (to visually reinforce the Section
  15.15/22 distinction between order volume and booked revenue): **dual-line
  or line+bar combo chart**, two distinct series clearly labeled/colored.
- **Expense breakdown by category**: **donut chart**, with the category
  legend showing amount + percentage.
- **Product performance** (best/slow-moving, product-wise profit):
  **horizontal bar chart**, sorted descending, top N with a "see more"
  expansion.
- **Stock levels** (per product or per category): **bar chart**; a
  dedicated low-stock view uses a simple sorted list with a colored
  severity indicator rather than a chart.
- **Profit trend (Gross vs. Net over time)**: **line chart**, two series
  (gross/net) in the primary and secondary accent colors.
- **Our price vs. competitor price** (Pricing/Market module, Section 17):
  **grouped bar chart** per product (our price bar next to competitor
  price bar(s)), with a simple over/under color cue (e.g. red if we're
  priced above the competitor, green if below/at parity).
- **Order status distribution** (Packed/Dispatched/Delivered/Cancelled/RTO
  mix): **donut chart**.
- **Courier performance** (delivery success rate, RTO rate): **donut or
  simple percentage stat cards**, not a complex chart — this needs to be
  read at a glance.
- Every chart sits inside its own card with a title and (where relevant) a
  "View more"/"View full report" link — never full-bleed on the page
  (Section 36.3). Use a single consistent charting library across the
  whole app (pick one during Phase 1 setup and don't mix libraries later).

### 38.1 Literal implementation example (MANDATORY pattern — every chart
in the app follows this shape, not a hand-rolled table with numbers)
```jsx
// ChartCard.jsx — the wrapper every chart uses (Section 36.3's "chart
// sits inside its own card" rule, enforced in code, not left to memory)
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

function ChartCard({ title, children, viewMoreHref }) {
  return (
    <div className="bg-white border border-[#E5E5E5] rounded-lg p-5">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-[#222222]">{title}</h3>
        {viewMoreHref && <a href={viewMoreHref} className="text-xs text-[#16324F]">View more</a>}
      </div>
      <ResponsiveContainer width="100%" height={260}>{children}</ResponsiveContainer>
    </div>
  );
}

// Example usage for "Sales over time" (Section 38's first rule) —
// this is the pattern, not a suggestion to build something different:
<ChartCard title="Sales — Last 30 Days" viewMoreHref="/reports/sales">
  <LineChart data={salesData}>
    <XAxis dataKey="date" />
    <YAxis />
    <Tooltip />
    <Line type="monotone" dataKey="revenue" stroke="#16324F" strokeWidth={2} />
  </LineChart>
</ChartCard>
```
A dashboard/report screen that renders a `<table>` of monthly numbers
where this section calls for a chart has not implemented this section —
regardless of how complete the surrounding page looks.

### 38.2 UI Definition-of-Done checklist (run this before reporting any
UI-related phase as complete)
Before saying a phase's UI work is finished, verify each of these
concretely — don't estimate, actually check:
- [ ] Does `NAV_CONFIG` (Section 36.4a) have all 13 top-level groups, and
      does every sub-item from Section 36.4's numbered list exist in it?
- [ ] Does every dashboard/report screen that Section 38 maps to a chart
      type actually render that chart component (not a table, not plain
      numbers)?
- [ ] Does every data table follow Section 19/36.5's "click the row to
      edit" pattern — no separate Edit button column?
- [ ] Does every status anywhere in the UI render as a colored pill/badge
      (Section 36.5), not plain text?
- [ ] Does the color palette match Section 36.1's exact hex values — no
      default framework blue/purple left anywhere?
- [ ] Is every screen listed in Section 37 actually built, or explicitly
      still pending in the progress notes — nothing silently skipped?
If any box can't be checked yes, the phase is not done — say so plainly
and say what's missing, rather than reporting completion.

---

## 39. Infrastructure & Security Hardening

Added after a second external review. This section fills operational gaps
the business-logic sections didn't cover — security, backup, real-time
technology, and concurrent-edit safety. Most are resolved as defaults below
(no business judgment needed); one item is flagged for the user.

### 39.0 Money precision (non-negotiable — belongs alongside Section 31)
All monetary values are stored as **integers in the smallest unit (poisha)
or fixed-point decimal — never as floating point.** Weighted-average
costing (35.3) recalculates on every stock receipt; floating-point rounding
error compounds silently over thousands of operations and COGS will drift
from reality over time. This is as non-negotiable as anything in Section 31.

### 39.1 Authentication & session security (production requirements)

The 2026-09-04 audit found that the current code does not yet implement these end-to-end.
These are production blockers.

- Login with email/phone + password.
- Passwords stored only as strong password hashes, never plaintext.
- Every protected API request validates the authenticated session/token on the server.
- Session tokens are securely random, rotated on authentication/re-authentication, and
  invalidated on logout.
- Idle sessions expire after 30 minutes and require re-login.
- Forgot-password flow, including a documented Owner recovery path.
- TOTP 2FA optional for Owner/General Manager and Managers granted sensitive financial access.
- Failed logins throttled per account and IP.
- Sensitive account/security changes may require re-authentication.
- Steadfast/Gemini API keys encrypted at rest and never shown in plaintext after saving.
- HTTPS is required for deployment; no plain-HTTP production fallback.
- **Server-side authorization is mandatory:** frontend visibility is never a security boundary.
  Every protected route checks the authenticated user's effective permissions.
- Sensitive operations (users, permissions, financial adjustments, refunds, stock adjustments,
  etc.) must be audited and approval-gated where configured.
### 39.2 Backup & disaster recovery (default policy)
- **Frequency**: automated daily database backups at minimum (more
  frequent, e.g. hourly, is better given this holds live financial data).
- **Encryption**: off-site backups are **encrypted at rest** — a backup
  bucket is a second place the business's full financial history lives,
  and needs the same protection as the primary database.
- **Applies from go-live, not just "hardening":** real orders, real money,
  and real customer data start flowing the moment Phase 1 ships (Section
  40). A basic backup (even manual/scripted, before the fuller policy
  below is automated) must exist from Phase 1 — don't treat this as a
  final-phase nice-to-have while live financial data accumulates with zero
  copies elsewhere in the meantime.
- **Retention**: keep daily backups for at least 30 days, plus monthly
  snapshots retained longer (e.g. 12 months) for year-end/tax reference.
- **Location**: backups must be stored **off the same server/VPS** as the
  live database (e.g. a separate storage bucket) — a backup that dies with
  the same machine isn't a real backup.
- **Restore testing**: a restore must actually be tested periodically (e.g.
  quarterly) — restoring to a scratch/staging environment and verifying
  data integrity — not just assumed to work because backup files exist.

### 39.3 Real-time sync technology (decided now, not left open)
Given the recommended stack (PostgreSQL + Node/Express — Section 30, not
yet finalized but the working assumption), use **PostgreSQL `LISTEN`/
`NOTIFY` combined with WebSockets (e.g. Socket.io)** for the new-order
broadcast notification (Section 4). This is decided now specifically so
the coding agent doesn't have to choose (and potentially choose
differently) mid-project. Note per Section 4's revision: this push
mechanism is used for the **notification broadcast only** — the stock
Available-quantity display itself uses short-interval polling, not push
(see Section 4 for the reasoning).

### 39.4 Concurrent edits on non-stock records (optimistic locking)
Section 32.1's atomicity/locking rules cover stock and money. For other
editable records (a customer profile, a product's description, a
supplier's info — anything under Section 19's "click the row to edit"
pattern), use **optimistic locking**: every editable record carries a
version number or `updated_at` timestamp; on save, the backend checks the
record hasn't changed since it was loaded. If it has (someone else saved
first), show "This record was changed by someone else — reload to see the
latest version" rather than silently overwriting their edit.

### 39.5 Thermal printing — flagged as an early technical risk
The 4"×6" thermal label format (Section 9's print specs) is the right
target, but **browser-to-thermal-printer output is a common practical
pain point** (driver quirks, paper-size mismatches) that's easy to
underestimate. Treat this as an early spike/prototype within **Phase 2**
(when Packing/label printing is first built) rather than something to
discover is broken late — confirm actual label printing works end-to-end
on the real hardware early, not just in a browser print-preview.

### 39.6 Staging vs. production (simplified — right-sized for a
self-hosted single-VPS setup)
A full mirrored staging environment with a formal quarterly restore drill
(as originally specified) is heavier than a self-hosting, non-developer
owner realistically needs. The actually-important safety goal, kept at
lower cost: **before any migration or change to the critical algorithms in
Section 35 touches the production database, test it against a scratch
database restored from the most recent backup** — this both validates the
backup is real (restore-tested, per 39.2) and catches migration problems
before they hit live data, without requiring a permanently-running second
environment. This extends the existing migration-safety rule (32.11) into
something concrete and achievable.

---

## 40. Suggested build order (phases)

**Two structural corrections from a second external review, before the
phase list itself:** (1) audit log **writes** are mandatory from Phase 1
day one per Section 31's own non-negotiable rules — they cannot wait for
Phase 8, which is really just the audit log **viewer/UI**; (2) the
business will necessarily run partly "manually" during the build — e.g.
bookkeeping via a parallel method until Phase 6's Accounting core ships,
manual Steadfast-website booking until Phase 4's courier integration ships
— this is expected and fine, but is stated here explicitly rather than
left implicit.

### 40.0 PROGRESS.md — the companion tracking file
A `PROGRESS.md` file must exist in the project root alongside this
`AGENTS.md`, and must be **updated by the agent at the end of every work
session** (not just when a phase fully completes) with: which phase is
active, what was built this session, what's still incomplete within the
current phase, any open questions for the user, and any decisions made
that aren't already captured in this document. At the **start** of every
session, the agent reads both `AGENTS.md` and `PROGRESS.md` before writing
any code — this is how continuity survives across many separate sessions
without depending on chat memory, which is unreliable for a project this
size. If `PROGRESS.md` doesn't exist yet, create it before starting Phase 1.

1. **Foundation** — auth, roles/permissions, product+barcode CRUD
   (including the bundle/kit model, Section 6.1, and no-barcode fallback),
   customer CRUD, Messenger-paste order creation **and** walk-in scan-to-
   cart order creation (Section 35.1a) with preview, invoice generation,
   order barcode. **Critically, also include in this phase (pulled forward
   from what was originally listed as Phase 2, because Phase 1 order
   creation cannot honestly satisfy Section 4/32.1's non-negotiable
   reservation rule without it):**
   - The full on-hand/reserved/available stock model and stock ledger
     (Section 8) — not the packing UI or push notification yet, just the
     real data model and the reservation logic in 35.1.
   - Basic stock receiving (Section 7's scan → quantity → submit flow) —
     shipments from Dubai don't wait for Phase 3, and there's no other way
     to get real stock into the system day one.
   - A **minimal chart-of-accounts/journal-posting mechanism** (just
     enough of Section 15.0/15.1 to record entries against named buckets)
     — not the full Accounting module (reports, reconciliation, salary),
     just enough plumbing so opening-balance entries and Section 39.0's
     money-precision rule have somewhere real to post to.
   - Bulk product import (CSV/Excel) for the existing 200+ SKUs, an
     opening-stock entry screen (posts an `OPENING_BALANCE` stock movement
     reason, dated accurately rather than pretending it was purchased
     today), and opening-balance entries for each accounting bucket (Cash,
     Bank, bKash/Nagad, Supplier Payable, opening inventory value) using
     the minimal journal mechanism above.
   - Audit log **writes** (not the viewer — see the note above the phase
     list) — every write in this phase already needs to produce an audit
     row per Section 31/32.8, so this was never really optional for Phase
     1 regardless of where the audit log *viewer* UI ships.
2. **Packing & real-time inventory (UI layer)** — packing interface,
   barcode verification, on-hand deduction at Pack (Section 35.1b —
   the *data model* for this shipped in Phase 1; this phase is the actual
   packing screen that calls it), new-order broadcast notification
   (WebSocket, Section 39.3), Settings module, polling-based stock display
   refresh (Section 4).
3. **Purchase & supplier** — supplier CRUD, purchase entry with landed cost
   capture (basic receiving already exists from Phase 1 — this phase adds
   the full supplier/PO/payable workflow around it), purchase history,
   payable tracking, purchase returns.
4. **Courier (Steadfast)** — booking (single + bulk) after packing, label
   printing with parcel ID, status sync, webhook authentication (Section
   35.6) or polling fallback, Delivered-triggered revenue/COGS posting
   (Section 35.1b's `on_steadfast_delivered_webhook`) using the minimal
   journal mechanism from Phase 1.
5. **Returns** — restock/damage flow (Section 13, scan-back per 35.2a) and
   RTO handling (13.1) **using the minimal journal mechanism already
   available from Phase 1** for the refund/payment-transaction linkage —
   this phase does not actually need to wait for Phase 6's full Accounting
   UI, since the underlying posting mechanism exists earlier now.
6. **Accounting core (full)** — the complete Section 15: category system,
   full ledger UI, payment-transaction model UI, courier receivable/
   reconciliation, day-end cash reconciliation, petty cash, salary sheet +
   payslips, P&L, product-wise profit. Given this is the single heaviest
   piece of engineering in the whole spec (the double-entry journal design,
   15.0), treat "a working minimum viable ledger" as an internal checkpoint
   inside this phase rather than trying to land all of Section 15's UI in
   one pass — the underlying journal mechanism already exists from Phase
   1, so this phase is mainly UI/reporting/reconciliation built on top of
   it, which is more parallelizable than it sounds.
7. **Dashboards, analytics, reports** — role-specific dashboards, charts,
   preview-then-print reports, exports.
8. **Governance (viewer/UI layer)** — audit log **viewer** (writes already
   exist from Phase 1), generic approval engine, alerts.
9. **Pricing Engine & Market analysis input** — competitor price entry,
   comparison charts, pricing tool. Note: Sections 16/17 are explicit that
   the actual pricing *logic* is still undefined — treat this phase as
   blocked until that's resolved with the user, rather than building UI
   around an undecided calculation.
10. **Hardening & future hooks** — remaining security items not already
    covered in Phase 1 (Section 39), error logging, notification hook
    (SMS-ready), keep API structure open for future integrations (website,
    WhatsApp, payment gateway).

Do not skip ahead to a later phase's features while an earlier phase is
still incomplete. Confirm current phase status with the user (or a
companion progress-tracking note, if one exists in the project) before
starting new work each session.

---

## 41. Canonical target data model

This is the target model assumed by the business rules; it is not a claim that every listed
entity/field already exists in the implementation. Section 42 records implementation reality.
Extend, don't contradict the target model.

- **users**(id, name, email, phone, profile_photo_url, password_hash,
  tier [owner/general_manager/manager/packing_staff], totp_secret?,
  active, created_at) — Section 20.0
- **user_permission_toggles**(user_id, toggle_name, enabled) — the
  per-user granular grants from Section 20.0a; a user's effective
  permission for any given toggle = their tier's default OR an explicit
  `enabled=true` row here (toggles only ever add on top of the tier
  default, never remove it — see 20.0a)
- **products**(id, barcode, sku, name, brand, size_variant, category_id,
  concentration, **gender** [men/women/unisex], **perfume_type**, photo_url,
  **gross_weight_grams?**, avg_cost, selling_price,
  **wholesale_type [same_as_retail/separate]?**, **wholesale_price?**,
  low_stock_threshold, batch_tracked, is_bundle, active, created_at,
  price_updated_at?, first_stock_received_at?, latest_stock_received_at?)
- **bundle_components**(bundle_product_id, component_product_id, quantity)
  — only populated when `products.is_bundle = true` (Section 6.1)
- **product_locations**(product_id, warehouse_id, location_label) — physical shelf/row
  metadata; editing this must not change stock quantities.
- **product_fragrance_notes**(product_id, note_type [top/heart/base/accord], note_value)
  — structured fragrance information used by Product Details, Notes Preview and the
  Fragrance Notes lookup.

- **categories**(id, name)
- **warehouses**(id, name) — seeded with exactly two rows at launch:
  "Main/Back-store" and "Shop Floor" (Section 7.1)
- **inventory**(product_id, warehouse_id, on_hand, reserved, avg_cost) —
  composite key (product_id, warehouse_id); `available` is computed
  (on_hand − reserved), not stored
- **tester_stock**(product_id, warehouse_id, quantity)
- **damaged_stock**(product_id, warehouse_id, quantity)
- **stock_movements**(id, product_id, warehouse_id, qty, reason, unit_cost,
  ref_type, ref_id, created_by, created_at) — reason enum per Section 8
  (+OPENING_BALANCE)
- **reservation_events**(id, order_id, product_id, quantity, type
  [RESERVE/RELEASE], created_at)
- **batches**(id, product_id, batch_code, manufacturer, supplier_id,
  purchase_date, qty_received, qty_remaining, purchase_cost,
  authenticity_status, evidence_urls[]) — Section 21, optional per SKU
- **customers**(id, name, phone_normalized, order_count, total_spent,
  risk_flag, created_at)
- **customer_addresses**(id, customer_id, address_text, is_default)
- **orders**(id, customer_id, channel [messenger/walk-in],
  **sales_model [direct/merchant_fulfillment]**, **fulfillment_method
  [steadfast/in_house/self_pickup/n_a_walk_in]** (Section 1), **delivery_address_id**
  (FK to `customer_addresses`), **delivered_by_user_id?** (which staff member
  hand-delivered, for in-house fulfillment), **merchant_name?**, **merchant_id?**,
  **merchant_parcel_id?** (mandatory when `sales_model=merchant_fulfillment`),
  **invoice_note_type [cod/prepaid/none]?**, status, source text [raw pasted
  Messenger text, kept for audit], delivery_charge, subtotal, discount_amount,
  total, cancel_reason?, created_by, created_at)
  - For `sales_model=direct`, `customer_id` and the direct-order required
    customer fields (name, address, mobile) must be complete before creation.
  - For `sales_model=merchant_fulfillment`, `merchant_parcel_id` must be
    present before creation; merchant_name, merchant_id, and customer details
    may be missing when the merchant did not supply them.
- **order_items**(id, order_id, product_id_or_bundle_id, quantity,
  unit_price, discount_amount, **unit_cost_at_sale** — captured from
  `inventory.avg_cost` at the moment of Pack/walk-in-sale (Section 35.1b/
  35.1a) and **never recalculated afterward**, this is what makes Section
  32.7's "historical COGS must never silently change" rule concretely
  enforceable — without a stored field for it, there's nothing to protect)
- **invoices**(id, order_id, invoice_number, pdf_url, cancelled)
- **order_barcodes**(order_id, barcode_value)
- **payments**(id, order_id, amount, method, transaction_ref,
  payment_account, received_by, status, created_at)
- **refunds**(id, payment_id, amount, reason, approved_by?, created_at)
- **suppliers**(id, name, phone, address, payable_balance)
- **purchases**(id, supplier_id, warehouse_id, date, total_landed_cost,
  original_currency?, exchange_rate?, received_by)
- **purchase_items**(purchase_id, product_id, qty, unit_cost)
- **accounts** (chart-of-accounts buckets, Section 15.1)(id, name, type
  [asset/liability/income/expense/equity])
- **journal_entries**(id, ref_type, ref_id, date, created_by)
- **journal_lines**(journal_entry_id, account_id, debit, credit) — every
  journal_entry's lines must balance (sum debit = sum credit)
- **expenses**(id, category_id, amount, date, description, payment_method,
  receipt_url, created_by)
- **expense_categories**(id, name, is_custom)
- **salary_records**(id, employee_user_id, month, amount, paid_date)
- **courier_bookings**(id, order_id, booking_id, consignment_no, status,
  **actual_charge** — Steadfast's real delivery fee for this parcel,
  Section 12.1, distinct from `orders.delivery_charge` which is what the
  customer was charged)
- **delivery_status_log**(id, order_id, status, timestamp, raw_payload)
- **returns**(id, order_id, product_id, qty, condition, status)
- **pending_scan_back**(order_id, product_id, qty_expected, fulfilled) —
  supports 35.2a's reference-checked scan-back
- **rto_events**(id, order_id, courier_charge_amount, charge_borne_by
  [business/customer], created_at)
- **audit_log**(id, user_id, action, entity_type, entity_id, before_value,
  after_value, timestamp) — append-only (Section 32.8)
- **approval_rules**(id, action_type, condition, approver_role, active) —
  Section 26, ships with zero active rows
- **notifications**(id, type, target_user_id?[null=broadcast], message,
  ref_type, ref_id, read, created_at) — Section 25/39
- **settings**(key, value, scope [user/company], user_id?) — Section 20.
  Invoice-note template settings include the default COD note and default
  prepaid note for Direct / Mirage Perfume invoices.
- **competitor_prices**(id, product_id, source_label, observed_price,
  observed_date, entered_by) — Section 17
- **idempotency_keys**(key, operation_type, result_snapshot, created_at) —
  Section 35.6
- **counters**(name, next_value) — used for invoice numbering (32.6/35.4)

### 41.1 Default tier permission matrix (starting point — confirm with Owner before Phase 1 ships, then adjust freely per-user via the toggle grid, Section 20.0a)

This reflects the redesigned 4-tier + per-user-toggle model (Section 20.0)
— replaces any earlier 6-named-role matrix.

| Capability | Owner | General Manager (default) | Manager (default) | Packing Staff |
|---|---|---|---|---|
| View orders | ✓ | ✓ | ✓ | ✓ (own queue only) |
| Create/edit orders | ✓ | — *(toggle-able)* | ✓ | — |
| Cancel orders | ✓ | ✓ *(Section 11.1 — everyone can)* | ✓ | ✓ |
| View/print invoice | ✓ | ✓ | ✓ | ✓ |
| View stock/inventory | ✓ | ✓ | ✓ | ✓ (own queue only) |
| Stock adjust | ✓ | — *(toggle-able)* | — *(toggle-able)* | — |
| Approve stock adjust | ✓ | — *(toggle-able)* | — | — |
| View cost/margin | ✓ | ✓ | — *(toggle-able)* | — |
| View full Accounting/P&L | ✓ | ✓ | — *(toggle-able)* | — |
| View salary | ✓ | ✓ | — | — |
| Edit product prices | ✓ | — *(toggle-able)* | — *(toggle-able)* | — |
| Approve refunds/discounts | ✓ | — *(toggle-able)* | — *(toggle-able)* | — |
| Manage users/toggles | ✓ | — *(toggle-able, rare)* | — | — |
| Export data | ✓ | ✓ | — *(toggle-able)* | — |
| Access Pricing Engine | ✓ | ✓ | — *(toggle-able)* | — |
| View audit log | ✓ | ✓ | — *(toggle-able)* | — |

"— *(toggle-able)*" means: off by default for that tier, but can be
switched on for a specific individual via Section 20.0a's toggle grid
without changing their tier. General Manager's visibility-heavy, edit-
light default is deliberate (Section 20.0's "sees almost everything,
changes nothing until explicitly allowed" design).

### 41.2 Internal barcode symbology (resolved)
For internally-generated barcodes (order barcodes, no-manufacturer-barcode
fallback products, bundle barcodes — Section 6/6.1), use **Code128**, not
QR. Reasoning: existing USB/keyboard-emulation scanners (Section 10) read
linear barcodes reliably and that's the primary hardware path already
specified; QR would only matter for camera-based mobile scanning, which
this document already treats as a secondary fallback, not the primary
path. Using one symbology consistently avoids needing two barcode-
generation code paths.

### 41.3 Bulk CSV import column schema (Phase 1)
Columns, in order: `name, brand, size_variant, category, barcode, sku,
purchase_price, selling_price, low_stock_threshold`. Photos are **not**
part of the CSV (impractical to bundle image files into a spreadsheet
import) — bulk-imported products get photos added individually afterward
through the normal product-edit screen (Section 6), which is an acceptable
one-time cost for the initial 200+ SKU load.



## 42. Current implementation & audit baseline — 2026-09-04

This section records the actual state found by the full codebase audit. It is separate from
the target architecture so future agents can distinguish intended behavior from current code.

### 42.1 Executive status

| Area | Current implementation | Status |
|---|---|---|
| Authentication | No real login/session/auth middleware; frontend starts with a hardcoded user | **CRITICAL** |
| Server authorization | Permission checks exist mainly in the frontend | **CRITICAL** |
| Persistence | Core DB uses in-memory Maps/Arrays | **HIGH / production blocker** |
| Automated tests | No real unit/integration/concurrency/permission test suite | **HIGH** |
| Inventory | On-hand/reserved/available, movement ledger, WAC, two warehouses | Working core |
| Receiving/opening balance | Implemented | Working core |
| Orders/reservation | Atomic reservation model and walk-in fulfillment implemented | Working core |
| Packing/dispatch | Pack → book → label → tracking verification → dispatch implemented | Working core |
| Steadfast | Real client/webhook/reconciliation paths present | Working; security still required |
| Accounting journal | Real double-entry engine exists and balances | Working core |
| Accounting UI | Income, Payments, Bank/MFS Reconciliation, Payable & Receivable are incomplete/aliased | **HIGH** |
| P&L date filtering | Audit found requested date range is ignored | **HIGH** |
| Online-order COGS | Audit found cost captured at order creation, not Pack time | **HIGH** |
| Audit Log | Append-only/hash-chain writes exist; viewer/API lacks real auth boundary | Partial |
| Settings | Broad settings UI exists; 2FA/security controls depend on missing auth | Partial |
| Theme | Light/Dark/System infrastructure exists but legacy hardcoded styling remains in places | Partial |
| Products | Details-first workflow, notes, classification, locations, bulk actions and pricing UX were added after the original brief | Working/verify continuously |

### 42.2 Features added after the original brief and now part of the product

Preserve these unless explicitly changed by the user:

- Product Details → explicit Edit workflow; row click is read-first.
- Large product image in Details.
- Created / First Received / Latest Received / Stock Age when derivable.
- Fragrance Notes: Top / Heart / Base / Main Accords, search and quick preview.
- Product Type classification: **Middle Eastern, Niche, Designer, Western**.
- Concentration and Size as first-class product attributes and filters.
- Gross packaged product weight in grams.
- Warehouse-specific physical shelf/location metadata.
- Product-level wholesale pricing: separate wholesale price or same as retail.
- Wholesale-price privacy control.
- Walk-in split payments: Cash, bKash, Nagad, Business Bank, Personal Bank, Card, Split/Multi.
- Explicit per-item/overall discount model without overwriting the fixed selling price.
- Recently updated-price ordering + whole-row highlighting controlled by Settings.
- Products Selection Mode with fast multi-selection and bulk actions.
- Normal inventory print/PDF without wholesale prices plus explicit Wholesale Price List.
- Packaging Materials / Operations module already present.
- Cryptographic hash-chain enhancement for audit logs.
- Merchant Fulfillment / Dropship order model with merchant parcel identifier,
  Merchant Sticker printing, parser extraction and invoice-note presets.

### 42.3 Critical audit findings to fix

1. Implement real authentication and server-side session validation.
2. Enforce permissions on every protected API route.
3. Replace in-memory production persistence with durable transactional storage.
4. Implement idempotency keys for retryable order, payment, refund, stock receiving,
   invoice, courier and webhook operations.
5. Capture online-order COGS using the immutable Pack-time cost snapshot.
6. Apply P&L date filters to journal lines rather than cumulative balances.
7. Build actual Accounting sub-views instead of aliases.
8. Implement/normalize missing target entities such as `pending_scan_back`, `refunds`,
   and configurable `approval_rules`.
9. Add unit, integration, concurrency and server-side permission tests.
10. Complete backup/restore and production persistence safety before go-live.
11. Finish global theme adoption so all components respond to Light/Dark/System.

### 42.3a New business requirements added after the 2026-09-04 audit

These are now **target requirements**, not claims of implementation. The next
implementation session must verify the real code rather than assuming they are
complete:

- Merchant Fulfillment / Dropship order model as defined in Section 3.2.
- Direct-order mandatory customer name/address/mobile validation.
- Merchant-order mandatory Merchant Parcel ID validation.
- Structured parser review replacing raw-message-first review after extraction.
- Invoice Note selector (COD / Prepaid / No Note), editable templates in Settings,
  automatic default selection from payment state.
- No Mirage customer invoice for Merchant Fulfillment; Merchant Sticker only.

### 42.4 Stabilization rule

Future work should be incremental. A new task may be small, but a feature is not considered
production-ready until its real data flow and critical edge cases have been tested.

Do not remove a working post-brief feature merely because it was added later; document it here
and preserve it unless the user explicitly changes the decision.

### 42.5 External engineering baseline

Security hardening follows the structure of OWASP ASVS 5.0: authentication, session management,
authorization, secure configuration, data protection and security logging. See the official
OWASP ASVS reference.

For eventual PostgreSQL production deployment, backups and restore procedures should be regular
and tested; PostgreSQL documents SQL dumps, physical backups, continuous archiving and
point-in-time recovery.
