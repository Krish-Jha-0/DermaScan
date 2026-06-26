# DermaScan: System Requirements

This document outlines the functional, non-functional, and data validation requirements for the DermaScan application.

---

## 1. Functional Requirements

### 1.1 User Authentication & Portal Access
* **Sign Up Pipelines**:
  * **Patients**: Require email, password, and full name. Account status defaults to `active`.
  * **Dermatologists**: Require email, password, full name, Medical License ID, and Experience (Years). Account status defaults to `pending`.
* **Verification & Role Mapping**:
  * On login, the system must inspect the authenticated email against a hardcoded admin list (`krish.jha.1909@gmail.com`). If matched, grant the `'admin'` role and route to `/admin/console`.
  * For regular users, resolve roles (`patient` vs `dermat`) and status flags (`pending`, `active`, `rejected`) via Firestore records under the `users` collection.
  * Prevent pending or rejected dermatologist accounts from logging in, returning appropriate system alert notices.

### 1.2 Biometric Skin Scanner & AI Engine
* **Upload Pipeline**:
  * Patients must align face images inside a clean targeting viewfinder layout.
  * Image payloads must be submitted via multipart form data to the Flask endpoint `/api/scan`.
* **Model Inference**:
  * The Flask server must transform the raw upload into a standardized format (`224x224` tensor, normalized via ImageNet mean/std values).
  * The inference model must execute dual-task heads to output classification classes:
    * **Skin Type**: Combination, Dry, Normal, Oily
    * **Skin Condition**: Normal Baseline, Acne, Blackheads, Whiteheads, Open Pores, Dark Spots, Wrinkles
  * If successful, save scan metadata under the `scans` collection in Firestore, including the patient ID, image URL, classifications, and recommended active ingredients.

### 1.3 Clinical Referral Queue
* **Consultation Requests**:
  * Patients can flag their scans for clinical review (`consultation_requested = true`).
* **Practitioner Workspace**:
  * Active practitioners must view a live consultation queue populated by Firestore database query streams.
  * Selection of a case must slide out a patient file chart showing the scan image, current AI evaluation parameters, and a 30-day telemetry timeline of patient scans.
  * Doctors must compile evaluation reviews containing Clinical Observations (text area) and a Medical Compounding Prescription Formula (text input).
  * Submitting the review must write to the `doctor_reviews` collection and clear the wait queue flag (`consultation_requested = false`, `status = 'reviewed'`).

### 1.4 Admin Console Controls
* **Application Categories**:
  * Admins must view incoming doctor applications grouped by status tabs: `Pending`, `Active`, `Refused`.
* **Status Controls**:
  * Provide actions to transition dermatologist accounts: `Verify` (active) and `Refuse` (rejected).
  * Rejected accounts can be reset to `Pending`.

---

## 2. Non-Functional Requirements

### 2.1 Interface & Styling (UI/UX)
* **Visual Theme**: Implement high-tier, premium dark-mode styling utilizing glassmorphism overlays (`backdrop-blur-md`), smooth gradient accents (`emerald-500/to-teal-500`), and interactive components (`framer-motion`).
* **Components**: Ensure clean responsive layout scaling for various screen widths (mobile vs desktop dashboard grids).
* **Typography**: Consistent modern sans-serif typography paired with monospace fonts for identifiers and metrics.

### 2.2 System Security & Access Controls
* **Route Guards**: Secure key portals (/dashboard, /admin/console, /doctor/workspace) using high-order wrapper components (`ProtectedRoute`) checking authentication status and role arrays. Route invalid sessions back to onboarding.

### 2.3 Performance & Data Syncing
* **Database Subscription**: Employ Firebase real-time listeners (`onSnapshot`) to reflect portal edits, queue updates, and authorization changes instantly without manual polling.
