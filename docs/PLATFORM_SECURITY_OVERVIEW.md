# VAGT Platform — Security Architecture Overview

**Document ID:** VAGT-PLAT-SEC-002
**Version:** 1.0
**Effective Date:** 2026-03-05
**Companion document:** `SECURITY_CONTROLS.md` (detailed control register + incident log)

---

## 1. Defense-in-Depth Architecture

The platform is protected by five concentric layers. Each layer is independent — if one fails, the layers inside it still hold.

```
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 1: CRAWLER / SEO                                             │
│  robots.txt  +  noindex meta  +  sitemap clean                      │
│  Stops search engines from indexing restricted pages                 │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  LAYER 2: CDN / NETWORK  (Cloudflare edge)                    │  │
│  │  HTTP security headers  +  no-cache on portals                │  │
│  │  Stops clickjacking, MIME attacks, cross-origin leaks          │  │
│  │                                                               │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │  LAYER 3: BROWSER / HTML                                │  │  │
│  │  │  CSP meta fallback  +  maintenance mode on portals      │  │  │
│  │  │  Stops XSS, resource injection, premature auth exposure  │  │  │
│  │  │                                                         │  │  │
│  │  │  ┌───────────────────────────────────────────────────┐  │  │  │
│  │  │  │  LAYER 4: DATA / BACKEND  (Firebase + Firestore)  │  │  │  │
│  │  │  │  Role-based access rules  +  auth required        │  │  │  │
│  │  │  │  Stops unauthorised reads/writes even if UI       │  │  │  │
│  │  │  │  is bypassed                                      │  │  │  │
│  │  │  │                                                   │  │  │  │
│  │  │  │  ┌─────────────────────────────────────────────┐  │  │  │  │
│  │  │  │  │  LAYER 5: REPOSITORY / CODE                 │  │  │  │  │
│  │  │  │  │  .gitignore  +  secret scanning             │  │  │  │  │
│  │  │  │  │  +  automated test suite (742 checks)       │  │  │  │  │
│  │  │  │  │  Stops credentials leaking into source      │  │  │  │  │
│  │  │  │  └─────────────────────────────────────────────┘  │  │  │  │
│  │  │  └───────────────────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Controls Status Tree

```
VAGT Platform Security Controls
│
├── ✅ ACHIEVED — In place and tested
│   │
│   ├── [CTL-001] HTTP Security Headers (X-Frame, CSP, nosniff…)
│   ├── [CTL-002] CSP Meta Fallback on every HTML page
│   ├── [CTL-003] Portal pages blocked: noindex + robots.txt + clean sitemap
│   ├── [CTL-004] Portals in maintenance mode — no live auth calls
│   ├── [CTL-005] No-Cache headers on all portal/admin pages
│   ├── [CTL-006] .gitignore covering credentials and secrets
│   ├── [CTL-007] Automated secret scanning (runs on every test cycle)
│   ├── [CTL-008] Firestore RBAC rules written and committed
│   ├── [CTL-009] Internal link + asset integrity (196 checks per run)
│   └── [CTL-010] Sitemap + robots.txt integrity validation
│
├── ⏳ PENDING — Work required before portal goes live
│   │
│   ├── [KG-002] Firestore rules unit tests (Firebase emulator)
│   ├── [KG-004] Contact form rate limiting / spam protection
│   ├── [---]    Firebase Auth configuration (email/password + role claims)
│   ├── [---]    Portal pages enabled (maintenance mode lifted)
│   └── [---]    API key injected via environment variable at deploy time
│
└── 🔴 OPEN INCIDENTS — Requires owner action
    │
    ├── [INC-001 / KG-003] Rotate exposed API key in Google Cloud Console
    ├── [INC-001]          Review Cloud Logging for abuse of exposed key
    └── [INC-001]          Rewrite git history to remove commit dd5fd03
```

---

## 3. How the Controls Piece Together (Flow View)

```
User visits vagtsecurityservices.com
         │
         ▼
┌─────────────────────────┐
│  Cloudflare CDN edge    │ ◄── CTL-001: Security headers applied here
│  (before HTML loads)    │ ◄── CTL-005: No-cache on portals applied here
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Browser loads HTML     │ ◄── CTL-002: CSP meta fallback active
│                         │ ◄── CTL-003: robots/noindex present in <head>
│  Public page?           │
│  YES ──► render page    │
│  NO (portal/admin)?     │
│     └──► CTL-004: show  │
│          maintenance    │
└────────────┬────────────┘
             │ (future: portal enabled)
             ▼
┌─────────────────────────┐
│  Firebase Auth          │ ◄── Role claim (admin/employee/client) set on login
│  (not yet live)         │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Firestore              │ ◄── CTL-008: RBAC rules — even if auth is bypassed,
│  (not yet live)         │     data layer enforces role + UID matching
└─────────────────────────┘

Separately, on every code push:
┌─────────────────────────┐
│  Test suite runs        │ ◄── CTL-007: Scans all files for secrets
│  (742 checks)           │ ◄── CTL-006: .gitignore prevents accidental adds
│                         │ ◄── CTL-009/010: Link + sitemap integrity
└─────────────────────────┘
```

---

## 4. Risk Assessment — What Happens if Each Control Fails

| CTL | Control | Failure scenario | Impact | Who is affected | Compensating control |
|-----|---------|-----------------|--------|-----------------|----------------------|
| CTL-001 | HTTP security headers | CDN misconfigured or bypassed | Browser has no clickjacking protection; MIME sniffing possible; no CSP at network layer | Any site visitor | CTL-002 (CSP meta fallback in HTML) |
| CTL-002 | CSP meta fallback | Meta tag removed from a page | XSS attack could load external scripts if CDN also fails | Visitors to that page | CTL-001 (CDN header still applies) |
| CTL-003 | Portal noindex + robots.txt | Robots directive removed | Portal/admin pages could be indexed by Google; URLs become discoverable | Employees, clients (privacy) | CTL-004 (pages show no live data — maintenance mode) |
| CTL-004 | Portals in maintenance mode | Live Firebase auth accidentally enabled before security is ready | Unauthenticated access attempt possible against unsecured Firebase project | All users; company reputation | CTL-008 (Firestore rules still require auth + role — data not exposed even if UI is live) |
| CTL-005 | No-cache on portals | Cache-Control header removed | Browser or CDN caches stale portal state; users see outdated access state | Employees, clients | Short TTL on Cloudflare cache; cleared on each deploy |
| CTL-006 | .gitignore credential exclusion | `.gitignore` entry removed or a new secret file added under a different name | Credentials committed to public repo (this is what INC-001 was) | Company (financial, reputational); Google Cloud account | CTL-007 (secret scanner catches it before/after commit) |
| CTL-007 | Automated secret scanning | Test suite not run before pushing | A committed secret goes undetected until Google or a researcher finds it | Company; clients whose data the key accesses | CTL-006 (.gitignore reduces the chance of it being staged in the first place) |
| CTL-008 | Firestore RBAC rules | Rules misconfigured (e.g., `allow read: if true`) | Any authenticated or unauthenticated user can read all Firestore data | All employees, clients (data breach) | **No current compensating control** — this is why KG-002 (rule unit tests) is critical before go-live |
| CTL-009 | Internal link integrity | Test removed or not run | Broken links reach production; service pages return 404 | Prospective clients (lost business); reputation | Manual QA review before deploy |
| CTL-010 | Sitemap + robots integrity | Sitemap updated without checking | Restricted page URL leaked to search engines | Employees, clients | CTL-003 (noindex on pages themselves — two-layer protection) |

---

## 5. What Must Happen Before Portal Goes Live

This is the gate. **Nothing below should go to production until every item is closed.**

```
GATE: Portal Go-Live Checklist
│
├── 🔴 Rotate/delete exposed API key (INC-001)
├── 🔴 Confirm no abuse in Google Cloud Logging (INC-001)
├── 🔴 Rewrite git history to remove dd5fd03 (INC-001)
├── ⏳ Set up Firebase Auth with email/password
├── ⏳ Configure custom role claims (admin / employee / client)
├── ⏳ Write Firestore emulator rule unit tests (KG-002)
├── ⏳ Run Firestore rules against emulator — all tests pass
├── ⏳ Inject new API key via environment variable (never hardcode)
├── ⏳ Add contact form rate limiting (KG-004)
├── ⏳ Lift maintenance mode on portal pages
└── ⏳ Full test suite passes with portals live: bash tests/run_tests.sh
```

---

## 6. Incident Impact Chain (INC-001 Visualised)

This shows how one missing control (CTL-006 — no `.gitignore`) created a chain of exposure:

```
No .gitignore
      │
      ▼
firebase-config.js committed to public repo
      │
      ▼
API key (AIzaSy...) visible in GitHub history
      │
      ├──► Google detects it → sends abuse notification ← we are here
      │
      ├──► Any actor who scraped GitHub in that window may have the key
      │
      └──► If key not rotated → ongoing risk of:
                ├── Quota abuse (unexpected GCP billing)
                ├── Firebase project manipulation
                └── Data access (if Firestore rules were open)

Mitigated by:
  - CTL-004: Portals in maintenance mode (no live data accessible)
  - CTL-008: Firestore rules require auth + role (data not open)
  - Pending: Key rotation by account owner (closes the exposure)
```

---

## Document Maintenance

This document must be updated when:
- A new control is added (add to status tree and risk table)
- A known gap is closed (move from Pending to Achieved)
- An incident occurs (add to incident chain or companion SECURITY_CONTROLS.md)
- The portal go-live gate checklist changes

**Revision history is in git — `git log docs/PLATFORM_SECURITY_OVERVIEW.md`**
