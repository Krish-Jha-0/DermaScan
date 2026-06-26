# DermaScan: Development Roadmap

This document outlines the milestones and timeline of feature developments for the DermaScan platform, detailing completed baselines, ongoing improvements, and future iterations.

---

## Roadmap Milestones

```mermaid
graph TD
    P1[Phase 1: Foundation & Baseline] --> P2[Phase 2: UI/UX & Interactions]
    P2 --> P3[Phase 3: Resiliency & Diagnostics]
    P3 --> P4[Phase 4: Scale & Advanced AI]
    
    style P1 fill:#10b981,stroke:#047857,stroke-width:2px,color:#fff
    style P2 fill:#0d9488,stroke:#0f766e,stroke-width:2px,color:#fff
    style P3 fill:#1e293b,stroke:#0f172a,stroke-width:1px,color:#94a3b8
    style P4 fill:#1e293b,stroke:#0f172a,stroke-width:1px,color:#94a3b8
```

---

## Phase Breakdown

### Phase 1: Core Foundation & Multi-Portal Baselines (Current)
* [x] **Deep Learning Backend**: Integrate multi-task ResNet-18 model pipeline for skin classification.
* [x] **Authentication & Role Guards**: Establish Firebase Auth and database-level role verification (`admin`, `patient`, `dermat`).
* [x] **Patient Control Center**: Implement scan uploading and automatic ingredient lookup engine.
* [x] **Clinical Workspace**: Build case queues with real-time Firestore sync and detailed patient history timelines.
* [x] **Administrative Console**: Design pending application reviews for doctor registration management.

### Phase 2: UI/UX & Interaction Enhancements (Target)
* [ ] **Loading & Transition Feedback**: Standardize dynamic loaders and skeleton containers across all panels.
* [ ] **Biometric Targeting Interface**: Refine the visual targeting frame in the webcam/image upload component.
* [ ] **Historical Telemetry Visualization**: Render charts mapping patient skin condition progression over time.
* [ ] **Mobile Interface Optimizations**: Adapt admin tables and grid layouts to align cleanly on all mobile form factors.

### Phase 3: Resiliency & System Diagnostics (Planned)
* [ ] **Offline Mode Fallbacks**: Handle disconnected states with informative UI placeholders when Firestore is unavailable.
* [ ] **Secure Storage Integrations**: Ensure images are uploaded to verified Firebase Storage buckets, backed by Google Cloud CORS rules.
* [ ] **Robust Backend Validation**: Implement size checks and format validation on incoming image streams in Flask.

### Phase 4: Production Scale & Advanced AI (Future)
* [ ] **Cloud Deployment**: Host the Flask backend via containerized microservices (e.g., Google Cloud Run) and host the React app on Firebase Hosting.
* [ ] **Model Upgrades**: Train on larger datasets and expand predictions to handle additional skin conditions.
* [ ] **Telemetry Export**: Allow patients to export summaries of their scan logs and medical prescriptions.
