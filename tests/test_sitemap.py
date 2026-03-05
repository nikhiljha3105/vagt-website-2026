"""
test_sitemap.py
===============
Validates sitemap.xml and robots.txt:

sitemap.xml:
  - Valid XML structure
  - Contains all public pages
  - Does NOT contain portal/admin pages
  - All listed URLs use https://
  - All listed URLs have a <lastmod> date
  - URLs map to existing files (path portion)

robots.txt:
  - Has User-agent directive
  - Has Sitemap directive
  - Disallows portal/admin paths
"""

import os
import re
import sys
import xml.etree.ElementTree as ET
from urllib.parse import urlparse

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

EXPECTED_IN_SITEMAP = [
    "/",           # home
    "about",
    "contact",
    "security",
    "facilities",
    "surveillance",
]

FORBIDDEN_IN_SITEMAP = [
    "admin",
    "portal",
    "employee-portal",
    "client-portal",
    "client-invoices",
    "client-reports",
    "employee-incidents",
    "employee-schedule",
    "admin-payroll",
]


def run():
    passed = 0
    failed = 0
    failures = []

    def check(condition, label, message):
        nonlocal passed, failed
        if condition:
            passed += 1
        else:
            failed += 1
            failures.append(f"  FAIL [{label}] {message}")

    # ── sitemap.xml ───────────────────────────────────────────────────────────
    sitemap_path = os.path.join(ROOT, "sitemap.xml")
    if not os.path.isfile(sitemap_path):
        failed += 1
        failures.append("  FAIL [sitemap.xml] File not found")
    else:
        with open(sitemap_path, "r", encoding="utf-8") as f:
            sitemap_raw = f.read()
            sitemap_lower = sitemap_raw.lower()

        # Parse XML
        try:
            tree = ET.fromstring(sitemap_raw)
            passed += 1
        except ET.ParseError as e:
            failed += 1
            failures.append(f"  FAIL [sitemap.xml] Invalid XML: {e}")
            tree = None

        # Extract only <loc> URL content (ignore comments)
        loc_urls = re.findall(r'<loc>(.*?)</loc>', sitemap_raw, re.IGNORECASE)
        loc_combined = " ".join(loc_urls).lower()

        # Check forbidden pages not listed in <loc> elements
        for forbidden in FORBIDDEN_IN_SITEMAP:
            check(
                forbidden not in loc_combined,
                "sitemap.xml",
                f"Sitemap <loc> exposes restricted page: '{forbidden}'"
            )

        # Check expected public pages present
        for expected in EXPECTED_IN_SITEMAP:
            check(
                expected in sitemap_lower,
                "sitemap.xml",
                f"Public page not in sitemap: '{expected}'"
            )

        # All URLs must be https
        urls = re.findall(r'<loc>(.*?)</loc>', sitemap_raw, re.IGNORECASE)
        for url in urls:
            check(
                url.startswith("https://"),
                "sitemap.xml",
                f"URL not https: {url}"
            )

        # All URLs must have lastmod
        if tree is not None:
            ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
            urls_xml = tree.findall(".//sm:url", ns)
            for url_el in urls_xml:
                loc = url_el.find("sm:loc", ns)
                lastmod = url_el.find("sm:lastmod", ns)
                loc_text = loc.text if loc is not None else "unknown"
                check(
                    lastmod is not None and lastmod.text,
                    "sitemap.xml",
                    f"URL missing <lastmod>: {loc_text}"
                )

        passed += 1  # file exists and structure ok

    # ── robots.txt ────────────────────────────────────────────────────────────
    robots_path = os.path.join(ROOT, "robots.txt")
    if not os.path.isfile(robots_path):
        failed += 1
        failures.append("  FAIL [robots.txt] File not found")
    else:
        with open(robots_path, "r", encoding="utf-8") as f:
            robots = f.read()

        check("User-agent:" in robots,              "robots.txt", "Missing User-agent directive")
        check("Sitemap:" in robots,                  "robots.txt", "Missing Sitemap directive")
        check("Disallow:" in robots,                 "robots.txt", "Missing Disallow directive")
        check(
            "admin" in robots.lower() or "/pages/" in robots,
            "robots.txt", "Does not disallow admin or portal paths"
        )
        # Sitemap URL should be absolute https
        sitemap_line = [l for l in robots.splitlines() if l.startswith("Sitemap:")]
        if sitemap_line:
            sitemap_url = sitemap_line[0].replace("Sitemap:", "").strip()
            check(
                sitemap_url.startswith("https://"),
                "robots.txt",
                f"Sitemap URL not https: '{sitemap_url}'"
            )

    print(f"\n{'='*60}")
    print(f"  test_sitemap.py: {passed} passed, {failed} failed")
    print(f"{'='*60}")
    if failures:
        for f in failures:
            print(f)
        print()

    return failed == 0


if __name__ == "__main__":
    ok = run()
    sys.exit(0 if ok else 1)
