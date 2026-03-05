"""
test_assets.py
==============
Verifies that all required static assets exist on disk:
- CSS files
- Image files (logos, branding)
- Security headers file (_headers)
- Sitemap
- robots.txt
- 404 page
- Firebase config files (structure-only, no secrets check here)
"""

import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


REQUIRED_FILES = [
    # Core pages
    "index.html",
    "404.html",
    "sitemap.xml",
    "robots.txt",

    # CSS
    "assets/css/main.css",

    # Logo images
    "assets/images/logos/vagt-logo-white.png",
    "assets/images/logos/hatsoff.jpg",
    "assets/images/logos/dsmax.jpeg",
    "assets/images/logos/quinbay.jpeg",

    # Security headers (Cloudflare Pages / Netlify)
    "_headers",

    # Firebase rules (structure, no secrets)
    "firebase/firebase.json",
    "firebase/firestore.rules",

    # Public pages
    "pages/about.html",
    "pages/contact.html",
    "pages/security.html",
    "pages/facilities.html",
    "pages/surveillance.html",

    # Portal/maintenance pages
    "pages/portal.html",
    "pages/employee-portal.html",
    "pages/client-portal.html",
    "pages/admin-portal.html",
    "pages/admin-clients.html",
    "pages/admin-complaints.html",
    "pages/admin-employees.html",
    "pages/admin-payroll.html",
    "pages/admin-reports.html",
    "pages/admin-schedule.html",
    "pages/admin-sites.html",
    "pages/client-invoices.html",
    "pages/client-reports.html",
    "pages/employee-incidents.html",
    "pages/employee-schedule.html",
]

# Files that must NOT exist in the repo (security)
FORBIDDEN_FILES = [
    "assets/js/firebase-config.js",
    "firebase-config.js",
    ".env",
    "service-account.json",
]


def run():
    passed = 0
    failed = 0
    failures = []

    # Required files must exist
    for rel in REQUIRED_FILES:
        full = os.path.join(ROOT, rel)
        if os.path.isfile(full):
            passed += 1
        else:
            failed += 1
            failures.append(f"  FAIL [assets] MISSING: {rel}")

    # Forbidden files must NOT exist
    for rel in FORBIDDEN_FILES:
        full = os.path.join(ROOT, rel)
        if not os.path.isfile(full):
            passed += 1
        else:
            failed += 1
            failures.append(f"  FAIL [security] FORBIDDEN FILE EXISTS: {rel}")

    # CSS must not be empty
    css_path = os.path.join(ROOT, "assets/css/main.css")
    if os.path.isfile(css_path):
        size = os.path.getsize(css_path)
        if size > 1000:
            passed += 1
        else:
            failed += 1
            failures.append(f"  FAIL [assets] main.css is suspiciously small ({size} bytes)")

    print(f"\n{'='*60}")
    print(f"  test_assets.py: {passed} passed, {failed} failed")
    print(f"{'='*60}")
    if failures:
        for f in failures:
            print(f)
        print()

    return failed == 0


if __name__ == "__main__":
    ok = run()
    sys.exit(0 if ok else 1)
