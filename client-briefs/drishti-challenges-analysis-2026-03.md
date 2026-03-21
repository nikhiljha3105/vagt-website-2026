# DRISHTI Challenges — Feasibility Analysis
**DPSU-driven Research & Innovation for Strategic and High-impact Technology Integration**
**Analysed:** 2026-03-21
**Against ecosystem:** Vanilla HTML/CSS/JS · Firebase Hosting · Cloud Functions (Node 20 + Express) · Firestore · Firebase Auth · external AI APIs (OpenAI/Gemini callable from Cloud Functions)

---

## What the ecosystem CAN do

| Capability | How |
|---|---|
| Web apps with real-time data | Firestore + vanilla JS |
| REST APIs and backend logic | Cloud Functions (Node/Express) |
| AI image analysis, document parsing, text extraction | Cloud Functions → OpenAI/Gemini vision APIs |
| AI-powered optimization and prediction | Cloud Functions → LLM APIs |
| PDF generation, report output | Cloud Functions (pdfkit/puppeteer) |
| Dashboards, forms, CRUD, scheduling tools | Vanilla HTML/CSS/JS + Firestore |
| File upload and storage | Firebase Storage |
| Authentication and role-based access | Firebase Auth + custom claims |
| IoT data ingestion (if sensor feeds HTTP) | Cloud Functions endpoint |
| WebRTC-based video/audio collaboration | Browser API + Firebase signalling |

## What the ecosystem CANNOT do

- Hardware design or manufacturing (sensors, motors, RF components, actuators)
- Embedded firmware / FPGA / DSP
- Mechanical, materials, or metallurgical engineering
- RF/microwave design (waveguides, radomes, power amplifiers)
- Physical prototype fabrication
- MIL-standard environmental testing

---

## FEASIBLE — Build directly on this stack

These challenges are pure software, web-app, dashboard, or AI-powered tools. All buildable with Firebase + Cloud Functions + AI APIs.

### HIGH CONFIDENCE (well within stack)

| # | DPSU | Challenge | Why feasible |
|---|---|---|---|
| 1 | HAL | Assistance for flight test plan — real-time data processing and analysis | Web dashboard ingesting telemetry via API, Firestore for storage, charts in browser |
| 5 | HAL | High-Fidelity Digital Twin Software Model for Gas Turbine Starter Engine | Software-only: modular web app with analytics, prognostics, visualisation layers |
| 17 | HAL | Automation of I-level Test bench of INS (G3INS) | Web control interface for automated test scheduling; operator commands via API |
| 20 | HAL | Tracking of location of tools & gauges in Aircraft Industry | Web dashboard + REST API; sensor tags (RFID/BLE) POST to Cloud Function endpoint |
| 21 | HAL | Remote assistance using AR/VR in intranet (LAN/WAN) | WebRTC peer-to-peer video + overlay via browser APIs; Firebase for signalling |
| 39 | BEL | Digital Identity Verification and Cyber Surveillance | Web app: document upload → AI analysis → identity verification dashboard |
| 42 | BEL | Sonar Performance Modelling Software | Compute-heavy Node.js backend + browser visualisation; oceanographic model as Cloud Function |
| 44 | GRSE | Development of indigenous ship design software | Large software project but purely a web application — feasible with sufficient scope |
| 45 | GRSE | AI-powered Hull-form optimization | ML via OpenAI/Gemini API or Python Cloud Function; results rendered in browser |
| 46 | GRSE | AI-Based Detection and Classification of Protective Coating Defects | Image upload → Cloud Function → Vision AI (GPT-4o vision or Gemini) → defect report |
| 47 | GRSE | Minimising Deformation in thin plate steel — welding sequence optimizer | Software tool: input geometry → optimisation algorithm → output welding sequence |
| 48 | GRSE | Monitoring workforce inside ship under construction | IoT wearable POSTs location to Cloud Function; dashboard shows headcount + SOS alerts |
| 49 | GRSE | Advanced Dock Finder Tool for dock scheduling | Web scheduling app: vessel dimensions + tide data → dock assignment + scenario simulation |
| 50 | GRSE | AI-Driven Propulsion Shaft Alignment and Real-Time Load Diagnostics | Software component: FEA results ingested, AI predicts alignment corrections |
| 70 | MDL | AI-Based System for Design Change Impact Analysis and Cost Estimation | Document/BOM upload → AI impact analysis → cost estimate report |
| 71 | MDL | AI tool for design optimization w.r.t. Class rules + BOM sync | Rulebook as vector store + AI query; 3D model metadata sync via API |
| 72 | MDL | Digital Twin Sync — scanned work vs design, AI flags deviations | Image upload from tablet → Vision AI comparison vs CAD reference → deviation report |
| 73 | MDL | AI drawing verification — revision compliance in production drawings | PDF/CAD ingestion → AI diff → compliance report; tracks revision history in Firestore |
| 76 | HSL | AI-based tool for verification of ship design | LLM + design rulebook: engineer uploads drawing → AI checks against regulations → report |
| 82 | GSL | AI-enabled Assessment platform for Technical Scrutiny of documents | OEM response upload → AI maps responses to SOTR requirements → TNC/PNC report |
| 83 | GSL | AI Based Electrical Design Documentation | GA drawing upload → AI extracts cable routes, gland specs, BOM → documentation output |
| 84 | GSL | AI Based Optimization of Compartment Layout | Equipment list + constraints input → AI/genetic algorithm → optimised layout output |

### MEDIUM CONFIDENCE (feasible with caveats — needs sensor hardware or domain partner)

| # | DPSU | Challenge | Feasible part | Caveat |
|---|---|---|---|---|
| 9 | HAL | AR for remote visual assistance + defect detection for Do-228 | AI defect detection backend + results dashboard | AR overlay needs a native/WebXR client; backend fully feasible |
| 18 | HAL | AI & AR visual inspection of TPE331-12B engine | AI image analysis of uploaded photos → defect flagging | AR requires device-side client; Cloud Function AI backend is straightforward |
| 36 | BEL | Recognition and cyber takeover of hostile drones | Signal analysis dashboard + decision support interface | Hardware SDR for RF capture is external; software classification layer feasible |
| 86 | MIDHANI | Induction furnace lining health monitoring | Dashboard ingesting sensor readings + AI anomaly detection | Sensor hardware is external; if sensor streams HTTP, Cloud Function ingests it |

---

## NOT FEASIBLE — Hardware, firmware, RF, materials, manufacturing

These require physical fabrication, embedded systems, RF engineering, or materials science. Outside any web/Firebase stack entirely.

### HAL (hardware challenges — not feasible)
2, 3, 4, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 19, 22, 23, 24, 25

### BEL (RF, hardware, embedded — not feasible)
26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 37, 38, 40, 41, 43

### HSL (marine hardware — not feasible)
74, 75, 77

### BEML (mechanical/hydraulic — not feasible)
51, 52, 53, 54, 55, 56, 57

### YIL (ammunition, materials — not feasible)
58, 59, 60, 61, 62, 63, 64

### AVNL (armoured vehicle electronics/gyros — not feasible)
65, 66, 67, 68, 69

### BDL (mil-grade electronics, fasteners — not feasible)
78, 79, 80, 81

### GIL (wrist instruments, sensors — not feasible)
88, 89, 90

### TCL (textiles, valves — not feasible)
91, 92, 93

### MIL (detonators — not feasible)
94, 95, 96

### IOL (gyros, motors — not feasible)
97, 98, 99

### AWEIL (optical instruments — not feasible)
100, 101

---

## Summary count

| Category | Count |
|---|---|
| High confidence feasible (pure software/AI web app) | 22 |
| Medium confidence feasible (software component of hybrid system) | 4 |
| Not feasible (hardware/embedded/materials) | 75 |
| **Total** | **101** |

---

## Recommended priority shortlist (best fit for stack + budget size)

These 6 are the strongest fits: well-scoped software problems, meaningful budgets, and directly buildable:

| Priority | # | DPSU | Challenge | Budget |
|---|---|---|---|---|
| 1 | 49 | GRSE | Advanced Dock Finder Tool | INR 0.1 Cr |
| 2 | 46 | GRSE | AI Coating Defect Detection | INR 0.25 Cr |
| 3 | 82 | GSL | AI Assessment platform (doc scrutiny) | TBD |
| 4 | 70 | MDL | AI Design Change Impact Analysis | INR 1.5 Cr |
| 5 | 73 | MDL | AI Drawing Verification System | INR 1.5 Cr |
| 6 | 45 | GRSE | AI Hull-form Optimization | INR 0.2 Cr |

**Highest budget software challenge:** BEL #42 Sonar Performance Modelling Software (INR 4.75 Cr) — large but pure software.

---

*Source document: DRISHTI Challenges Summary (101 problem statements, 16 DPSUs)*
*Contact for GRSE/MDL/GSL challenges: all route through same PoC at respective DPSU*
