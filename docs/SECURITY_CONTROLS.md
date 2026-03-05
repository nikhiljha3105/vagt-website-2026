# VAGT Security Services — Platform Security Controls

**Document ID:** VAGT-PLAT-SEC-001
**Version:** 1.0
**Effective Date:** 2026-03-05
**Owner:** Platform / Technical Lead
**Review Cycle:** Quarterly
**Storage:** Git-tracked — every change is timestamped, attributed, and immutable

---

## Purpose

This document records all security controls applied to the VAGT Security Services web platform. It exists so that:

- Any internal or external auditor can verify what guardrails are in place
- Any team member can understand what they must not bypass or remove
- Incident responses are formally logged alongside the controls they inform
- Controls are tested, not just stated

---

## Scope

This document covers:

- The public-facing website (`vagtsecurityservices.com`)
- All portal and admin pages (currently in maintenance mode)
- The Firebase/Firestore backend configuration
- The source code repository (`nikhiljha3105/vagt-website-2026`)
- The deployment pipeline (Cloudflare Pages)

---

## Control Register

Each control has an ID, a description of what it does, where it is implemented, and whether it is verified by the automated test suite.

---

### CTL-001 — HTTP Security Headers (Network Layer)

**Risk addressed:** Clickjacking, MIME sniffing, cross-origin data leakage, malicious embedding
**Implementation:** `_headers` file (Cloudflare Pages — applied at the CDN edge, before the browser sees any HTML)
**Headers enforced:**

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `DENY` | Prevents the site being embedded in iframes (clickjacking) |
| `X-Content-Type-Options` | `nosniff` | Stops browser guessing MIME types |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits URL leakage to third parties |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | Disables browser features not used on this site |
| `Content-Security-Policy` | See below | Controls what resources the page may load |
| `X-XSS-Protection` | `0` | Disabled intentionally — modern browsers ignore it; legacy IE mode creates vulnerabilities |

**CSP Policy:**
```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self';
connect-src 'self' https://api.vagtsecurityservices.com;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
object-src 'none';
```

**Test coverage:** `test_security.py` — verifies `_headers` contains all five required headers
**Automated check:** Yes

---

### CTL-002 — CSP Meta Fallback (HTML Layer)

**Risk addressed:** In case the CDN header is not applied (direct file access, local dev, alternative hosting)
**Implementation:** Every HTML page contains `<meta http-equiv="Content-Security-Policy">` with the same policy as CTL-001
**Test coverage:** `test_security.py` — checks every page for CSP meta tag
**Automated check:** Yes

---

### CTL-003 — Portal and Admin Pages Blocked from Search Indexing

**Risk addressed:** Sensitive internal pages appearing in Google/Bing search results
**Implementation (two layers):**
1. Every portal/admin page has `<meta name="robots" content="noindex, nofollow"/>`
2. `robots.txt` has `Disallow:` directives for all portal/admin paths
3. `sitemap.xml` does not include any portal/admin URLs

**Test coverage:**
- `test_structure.py` — verifies noindex on all portal pages
- `test_security.py` — verifies noindex + nofollow on portal pages; sitemap `<loc>` elements don't include portal/admin URLs
- `test_sitemap.py` — validates robots.txt has Disallow directives; sitemap clean

**Automated check:** Yes

---

### CTL-004 — Portal Pages in Maintenance Mode (No Live Auth)

**Risk addressed:** Unauthenticated access to Firebase auth UI while Firebase security configuration is incomplete
**Implementation:** All 15 portal/admin pages display a maintenance message and contain no live Firebase `signInWithEmailAndPassword()` calls
**Test coverage:** `test_content.py` — verifies maintenance message present and no live auth call in portal pages
**Automated check:** Yes

---

### CTL-005 — No-Cache Headers on Portal Pages

**Risk addressed:** Browser or CDN caching stale portal state; cached pages being served after access is revoked
**Implementation:** `_headers` file applies `Cache-Control: no-store, no-cache, must-revalidate` to all portal and admin page paths
**Test coverage:** `test_assets.py` — verifies `_headers` file exists
**Automated check:** Partial (existence verified; header values not parsed — see known gap KG-001)

---

### CTL-006 — Credential Exclusion from Source Control

**Risk addressed:** API keys, service account credentials, or `.env` files being accidentally committed to the repository
**Implementation:** `.gitignore` excludes the following categories:
- `firebase-config.js` and variants
- `.env` and `.env.*`
- `service-account*.json`
- `google-credentials*.json`
- `.runtimeconfig.json` (Firebase local secrets)
- `node_modules/`

**Test coverage:** `test_security.py` — verifies `.gitignore` exists and covers `firebase-config` and `.env`
**Automated check:** Yes

**Incident context:** This control was added on 2026-03-05 following Incident INC-001 (see Incident Log).

---

### CTL-007 — Automated Secret Scanning on Every Test Run

**Risk addressed:** Credentials or API keys present in any tracked file
**Implementation:** `test_security.py` walks all tracked file extensions (`.html`, `.js`, `.json`, `.ts`, `.py`, `.sh`, `.md`, `.txt`, `.css`) and checks for:
- Google/Firebase API key pattern (`AIza[0-9A-Za-z_-]{35}`)
- PEM private key blocks
- Hardcoded password assignments
- AWS access key format (`AKIA...`)

**Test coverage:** Self-contained — this IS the control
**Automated check:** Yes — runs as part of `bash tests/run_tests.sh`

---

### CTL-008 — Firestore Role-Based Access Control

**Risk addressed:** Unauthorised read/write of employee records, client data, payroll, or admin collections
**Implementation:** `firebase/firestore.rules` enforces:
- All collections require authentication (`isSignedIn()`)
- Admin-only collections (employees, payroll, schedules, sites): require `role == 'admin'` JWT claim
- Employee collections: require `role == 'employee'` AND matching UID (own record only)
- Client collections: require `role == 'client'` AND matching UID (own record only)
- No collection is readable or writable by unauthenticated requests

**Test coverage:** `test_assets.py` — verifies `firebase/firestore.rules` exists
**Automated check:** Partial (file existence; rule logic not unit-tested — see known gap KG-002)

---

### CTL-009 — Internal Link and Asset Integrity

**Risk addressed:** Broken links degrading user trust; missing assets causing page errors
**Implementation:** `test_links.py` resolves every relative `href`, `src`, and `img` reference across all pages to an absolute path and confirms the file exists on disk
**Test coverage:** `test_links.py` — 196 checks across all pages
**Automated check:** Yes

---

### CTL-010 — Sitemap Integrity

**Risk addressed:** Restricted pages being indexed by search engines via sitemap
**Implementation:** `test_sitemap.py` validates:
- Sitemap is valid XML
- All `<loc>` URLs use `https://`
- All `<loc>` entries have `<lastmod>`
- No portal/admin paths appear in `<loc>` elements
- `robots.txt` has `Sitemap:` pointing to an https URL

**Test coverage:** `test_sitemap.py`
**Automated check:** Yes

---

## Automated Test Suite Summary

Run: `bash tests/run_tests.sh` from the repository root.

| Module | What it covers | Checks |
|--------|---------------|--------|
| `test_assets.py` | Required files exist; forbidden credential files absent | 37 |
| `test_structure.py` | DOCTYPE, meta tags, noindex on portals, title/charset | 235 |
| `test_links.py` | Every internal link and asset resolves to a real file | 196 |
| `test_security.py` | No secrets in codebase, CSP, robots, sitemap clean | 170 |
| `test_content.py` | Navigation, content completeness, maintenance mode | 70 |
| `test_sitemap.py` | sitemap.xml validity, robots.txt directives | 34 |
| **Total** | | **742** |

All checks pass as of 2026-03-05. Test results are confirmed by agent execution — see Incident Log for context.

> For a visual architecture diagram, controls status tree, and go-live gate checklist, see **`PLATFORM_SECURITY_OVERVIEW.md`** in this directory.

---

## Known Gaps (Accepted or Pending)

| ID | Gap | Risk | Status |
|----|-----|------|--------|
| KG-001 | `Cache-Control` header values in `_headers` are not parsed by tests — only file existence is checked | Low (values visible in file; manual review covers this) | Accepted |
| KG-002 | Firestore rules logic is not unit-tested — only file existence is verified | Medium (rules must be validated via Firebase emulator) | Pending — to be addressed when portal goes live |
| KG-003 | Git history at commit `dd5fd03` contains exposed API key (see INC-001) | High | **Open — requires key rotation and history rewrite by account owner** |
| KG-004 | Contact form submissions are not yet rate-limited or spam-protected | Medium | Pending — to be addressed before public launch |

---

## Incident Log

### INC-001 — Google Firebase API Key Publicly Exposed

**Date detected:** 2026-03-05
**Detected by:** Google Cloud automated abuse detection (email notification to account owner)
**Severity:** High
**Key exposed:** `REDACTED_OLD_KEY`
**Project:** VAGT - Services (`vagt---services`)

**Root cause:** Firebase client-side configuration file (`assets/js/firebase-config.js`) was committed to the public GitHub repository at commit `dd5fd03ce98f5498c85befa8c7678d14bbe33e7f`. The file was subsequently removed from the working tree but remained accessible in git history.

**Immediate actions taken (2026-03-05):**

1. Confirmed no API keys present in current working tree (all files scanned)
2. Created `.gitignore` to prevent future accidental commits of `firebase-config.js`, `.env`, and service account files (CTL-006)
3. Added automated secret scanning to test suite (CTL-007)
4. Added meta descriptions and CSP fallback to all portal pages (previously absent)
5. Committed and pushed all controls to branch `claude/review-website-git-dPWyR`

**Pending actions — REQUIRED from account owner:**

| Action | Owner | Status |
|--------|-------|--------|
| Rotate/delete the exposed API key in Google Cloud Console → APIs & Services → Credentials | Platform owner (Nikhil) | **OPEN** |
| Restrict any replacement key to specific APIs and the production domain only | Platform owner | Pending |
| Rewrite git history to remove commit `dd5fd03` using `git filter-repo --path assets/js/firebase-config.js --invert-paths` | Platform owner + agent | Pending (requires force push — owner approval needed) |
| Review Google Cloud Logging for any abuse of the exposed key | Platform owner | **OPEN** |

**Controls added as a result of this incident:** CTL-006, CTL-007

---

## Change History

| Date | Version | Change | Author |
|------|---------|--------|--------|
| 2026-03-05 | 1.0 | Initial document created. Controls CTL-001 through CTL-010 documented. INC-001 logged. | Claude Code agent |

---

## How to Update This Document

1. Every time a new control is added, assign the next CTL-ID and add it to the register above
2. Every time a security incident occurs, log it in the Incident Log with root cause and actions
3. Known gaps must be reviewed quarterly — either closed or explicitly re-accepted with a date
4. This file is git-tracked. The commit message must reference the control or incident ID

**This document has no value if it is not kept current.**
