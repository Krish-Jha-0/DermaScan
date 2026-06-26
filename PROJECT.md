# DermaScan: Clinical Skin Diagnostics Platform

DermaScan is an intelligent, multi-portal application designed to predict skin attributes (type and condition) from face scans using PyTorch, map custom active ingredient blueprints, and handle clinical doctor-patient consultation referrals.

## Project Overview

The application is split into a **Vite + React Frontend** (featuring dynamic onboarding, patient/dermatologist dashboards, and administrative console controls) and a **Flask Backend** (housing a multi-task ResNet-18 model trained to extract and classify skin features). Firebase acts as the centralized system core for user accounts, real-time consultation tracking, and telemetry database logs.

---

## Technology Stack

### Frontend Core
- **Framework**: React 18 (Client-side single-page routing using `react-router-dom`)
- **Build Tool**: Vite
- **Styling**: Tailwind CSS & Vanilla CSS configurations
- **Animations**: Framer Motion (smooth transition sequences)
- **Icons**: Lucide React
- **Cloud Infrastructure Services**: Firebase SDK (Authentication, Firestore Database, Cloud Storage)

### Backend Core
- **Microframework**: Flask (serving REST endpoints)
- **Neural Framework**: PyTorch (loads customized ResNet-18 architectures)
- **Image Processing**: Pillow (PIL), Torchvision transforms
- **CORS Handling**: Flask-CORS

---

## Directory Structure

```
DermaScan/
├── backend/                  # Deep learning microservice
│   ├── app.py                # Main Flask application API gateway
│   ├── model.py              # Multi-task ResNet-18 architecture layout
│   ├── dataset_loader.py     # Custom PyTorch Dataset mapping pipelines
│   ├── train.py              # PyTorch model training routine
│   └── dermascan_brain.pth   # Pre-trained model weights (classification layers)
│
├── frontend/                 # Client UI application portal
│   ├── public/               # Static assets & public assets
│   ├── src/
│   │   ├── app/              # Portal Pages
│   │   │   ├── admin/        # Administrative consoles
│   │   │   ├── dashboard/    # Patient portal dashboard
│   │   │   ├── doctor/       # Dermatologist workspace
│   │   │   └── page.jsx      # Portal onboarding and authentication page
│   │   ├── components/ui/    # UI elements & custom components
│   │   ├── context/          # React Context providers (AuthContext.jsx)
│   │   ├── lib/              # Firebase configuration instances
│   │   ├── App.jsx           # Main routing entry-point
│   │   └── main.jsx          # Vite React mounting script
│   └── package.json          # Dependency packages
│
├── cors.json                 # Google Cloud Storage CORS configuration rule schema
└── set-cors.js               # Node utility script to update Firebase Storage CORS
```

---

## Core System Flows

### 1. Authentication & Role Gatekeeping
* The [AuthContext](file:///c:/Users/Krish/Desktop/DermaScan/frontend/src/context/AuthContext.jsx) handles registration pipelines and runs a real-time state subscription (`onAuthStateChanged`).
* **Role Verification**:
  * **Admin Role**: Automatically assigned via a hardcoded email override filter list (e.g., `krish.jha.1909@gmail.com`).
  * **Patient Role**: Created in Firestore with `status: 'active'` by default.
  * **Doctor Role**: Registered as a pending dermatologist applicant (`status: 'pending'`). Locked from workspace portals until an administrative account changes their configuration flag to `active`.

### 2. Deep Learning Classification
* When a patient runs a biometric scan:
  * The image is sent to the Flask server `/api/scan` endpoint.
  * The backend transforms the raw bytes into a `224x224` tensor, normalizes it using standard ImageNet parameters, and forwards it to `DermaNetMultiTask`.
  * The model outputs multi-task predictions:
    * **Skin Type**: Combination, Dry, Normal, Oily
    * **Skin Condition**: Normal Baseline, Acne, Blackheads, Whitehead, Open Pores, Dark Spots, Wrinkles
  * An automated look-up maps the intersection of type and condition to a target active ingredient recommendation (e.g., Salicylic Acid spot treatment for Oily/Acne).

### 3. Consultation Queue Pipeline
* If a patient requests a professional consultation:
  * The frontend writes a status flag (`consultation_requested = true`) to the target Firestore scan document.
  * Dermatologists on the doctor portal receive immediate case queues via live Firestore queries, open individual patient records, view telemetry history logs, and document prescription compounding observations before resolving and closing out the ticket.
