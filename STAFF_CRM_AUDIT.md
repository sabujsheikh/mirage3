# Audit Report: Staff (HRM) & CRM Extensions

**Audit Date:** 2026-09-15  
**Auditor:** AI Coding Assistant / Engineering Audit Team  
**Scope:** Verification of locked specifications, functional testing across all tiers (including Tier 4 server-side security), salary calculation formulas, and categorization of features (Bloat vs. Keep-but-Collapse vs. Working-as-Intended).

---

## Part 1: Staff (HRM) Section Audit

### 1. Navigation & Architecture
* **Finding:** Working-as-Intended
* **Details:** Located as a sub-section under the **Operations** group in the sidebar named **"Staff"** (`/operations/staff`). No separate top-level "HRM & Staff" or duplicate navigation item exists.
* **Test Steps:**
  1. Logged in as Owner (Tier 1).
  2. Inspected sidebar navigation. Verified "Staff Directory & HR" appears strictly as a sub-item under Operations alongside "Packaging Materials".
  3. Verified no standalone CRM tab exists; customer management remains unified under `/customers`.

### 2. User Account vs. Employee Profile Separation
* **Finding:** Working-as-Intended
* **Details:** Users & Roles (`/settings/users`) remains the absolute single source of truth for login credentials, passwords, tiers (1-4), and permission toggles. The Staff section (`/operations/staff`) manages HR-specific metadata (NID, emergency contact, join date, basic salary, commission rate, attendance, leave, advances, document storage, performance notes) linked 1-1 by `user_id`.
* **Test Steps:**
  1. Opened Users & Roles (`/settings/users`), verified user credentials and tier assignment.
  2. Opened Staff (`/operations/staff`), selected an employee, edited their NID and emergency contact. Verified that tier changes are locked out here and restricted to Users & Roles.

### 3. Salary & Payslip Integration & Exact Formula Verification
* **Finding:** Working-as-Intended
* **Details:** The accounting module (`/accounting/salary`) acts as the sole financial execution engine. The Staff section records inputs (attendance, advances, commission-eligible sales), which feed into payslips using the exact locked formula.
* **Exact Formula Tested:**
  * **Working Days:** 26 days/month.
  * **Daily Rate:** $\text{Daily Rate} = \frac{\text{Basic Salary}}{26}$.
  * **Attendance Value:** Present = 1.0, Half-day = 0.5, Paid Leave (CL/SL/EL) = 1.0, Absent / Unpaid Leave (LWP) = 0.0.
  * **Earned Basic:** $\text{Basic Salary} \times \frac{\text{Days Present} + (0.5 \times \text{Half Days}) + \text{Paid Leave Days}}{26}$.
  * **Commission:** Calculated strictly on **Delivered / Completed** orders where `created_by` matches the employee, multiplied by their commission rate (e.g. 1.5%). Cancelled/returned orders are excluded.
  * **Advance Deduction & ৳0 Floor:** Active advance deducted from monthly gross earnings. If deductions exceed earnings, net pay is capped at **৳0**, and the remaining balance automatically rolls over to the next month.
* **Test Steps:**
  1. Created test employee "Tanvir Ahmed" with Basic Salary = ৳26,000 (Daily rate = ৳1,000) and Commission Rate = 2%.
  2. Logged attendance: 20 Present days (20 × 1.0 = 20), 2 Half-days (2 × 0.5 = 1), 2 Paid Leave days (2 × 1.0 = 2), 2 Absents (0). Total effective working days = 23 days.
  3. Calculated Earned Basic: ৳26,000 × (23 / 26) = ৳23,000.
  4. Logged 2 Delivered orders created by Tanvir totaling ৳50,000. Commission = ৳50,000 × 2% = ৳1,000. Gross Earnings = ৳24,000.
  5. Logged an active advance of ৳30,000. Payslip computation capped net pay at **৳0** and rolled over the remaining ৳6,000 advance balance to the next month. Verified via Accounting > Salary & Payslips.

### 4. Tier 4 (Packing Staff) Granular Security & 403 Enforcement
* **Finding:** Working-as-Intended
* **Details:** Packing staff (Tier 4) have restricted access. They can check in their own attendance and submit/view their own leave requests. Any attempt to access other employees' data, salaries, advances, or commissions returns an immediate **403 Forbidden** server response.
* **Test Steps:**
  1. Logged in as a Tier 4 Packing Staff test account (`packing1`).
  2. Navigated to `/operations/staff` or attempted self-check-in: succeeded for own attendance (`POST /api/staff/attendance/self`).
  3. Sent a direct `GET /api/staff/employees/emp_other` API call via browser fetch/Postman. Received an immediate **403 Forbidden** response with error message: *"Access denied: Insufficient privileges for employee record."*
  4. Verified that salary amounts, advances, and performance notes are completely hidden from the Tier 4 interface and blocked at the API level.

---

## Part 2: CRM Extensions Audit

### 1. Embedded Navigation & Profile Integration
* **Finding:** Working-as-Intended
* **Details:** All CRM enhancements—customer tags/labels, sticky notes, communication log (shared moderator notes), and reorder reminder flags—are embedded directly inside the existing Customers page (`/customers`) and customer detail workspace modal. No separate CRM sidebar tab was created.
* **Test Steps:**
  1. Opened `/customers`, clicked a customer row to open the 360° profile modal.
  2. Verified the presence of Tag Manager, Sticky Notes box, and Communication Timeline tab.

### 2. CRM Features & Reorder Reminder Logic
* **Finding:** Working-as-Intended
* **Details:**
  * **Tags:** Free-form custom tags ("VIP", "Price-Sensitive", "Prefers COD", "Gifts Often") assignable with color coding.
  * **Sticky Notes:** Quick unstructured notes saved instantly to the customer profile.
  * **Communication Log:** Shared timeline logging interactions (Messenger chat, phone call, walk-in) with staff actor names for multi-moderator coordination.
  * **Reorder Reminder Flag:** Dynamically computed based on customer's average order frequency (e.g., historical inter-order interval ~30 days). When days elapsed since last delivered order exceed the average cycle, a visual "Follow-up due" badge triggers automatically.
* **Test Steps:**
  1. Assigned tag "VIP" and added a sticky note *"Always call before dispatch"* to customer Rahim Uddin.
  2. Logged a Messenger interaction: *"Confirmed delivery for Friday"* by moderator `Shifat`.
  3. Checked reorder reminder calculation on a customer with past orders 30 days apart; verified that when current date exceeds 30 days since last order, the "Follow-up due" badge lights up in red.

---

## Part 3: Complexity & Growth Classification

| Feature / Component | Classification | Rationale / Recommendation |
| :--- | :--- | :--- |
| **Employee Directory & Basic HR Profile** | **Working-as-Intended** | Essential for tracking staff contact, NID, and role details as headcount grows from 5 to 15+. |
| **Daily Attendance & Pro-Rata Salary Feed** | **Working-as-Intended** | Core requirement; directly eliminates manual attendance errors in payroll. |
| **Salary Advances & ৳0 Floor Rollover** | **Working-as-Intended** | Vital cash-advance handling for retail staff in Bangladesh; fully robust. |
| **Document Storage (NID, Contracts)** | **Keep-but-Collapse** | Extremely useful for HR compliance as the business scales, but takes up vertical space. **Recommendation:** Collapse inside an accordion/tab on the employee profile so it doesn't clutter the main card view. |
| **Leave Balance Tracking & Approvals** | **Keep-but-Collapse** | Necessary for tracking Casual/Sick/Earned leave quotas. **Recommendation:** Keep compact with collapsible monthly balance summaries. |
| **CRM Tags & Sticky Notes** | **Working-as-Intended** | Lightweight, high-utility tools for order moderators. |
| **Communication Timeline Log** | **Working-as-Intended** | Solves the exact multi-moderator handoff problem on Messenger orders. |
| **Reorder Reminder Flag** | **Working-as-Intended** | Automated retention prompt without heavy marketing automation bloat. |

---
*Report generated and committed to `STAFF_CRM_AUDIT.md`.*
