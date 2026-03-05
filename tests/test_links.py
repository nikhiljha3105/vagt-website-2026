"""
test_links.py
=============
Validates all internal relative links and asset references across every page.
- Every relative href/src must resolve to an existing file on disk.
- External links (http/https), mailto:, tel:, #anchors are skipped.
- Reports broken links grouped by page.
"""

import os
import re
import sys
from html.parser import HTMLParser

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

ALL_PAGES = [
    "index.html",
    "pages/about.html",
    "pages/contact.html",
    "pages/security.html",
    "pages/facilities.html",
    "pages/surveillance.html",
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
    "404.html",
]

SKIP_PREFIXES = ("http://", "https://", "mailto:", "tel:", "#", "javascript:", "data:")


class LinkCollector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == "a":
            href = attrs_dict.get("href", "")
            if href:
                self.links.append(("href", href))
        elif tag in ("link", "script"):
            src = attrs_dict.get("href") or attrs_dict.get("src", "")
            if src:
                self.links.append(("resource", src))
        elif tag == "img":
            src = attrs_dict.get("src", "")
            if src:
                self.links.append(("img", src))


def resolve(page_rel, link):
    """Resolve a relative link from a page's location to an absolute path."""
    page_dir = os.path.dirname(os.path.join(ROOT, page_rel))
    return os.path.normpath(os.path.join(page_dir, link))


def run():
    passed = 0
    failed = 0
    failures = []

    for rel in ALL_PAGES:
        full = os.path.join(ROOT, rel)
        if not os.path.exists(full):
            failed += 1
            failures.append(f"  FAIL [{rel}] FILE NOT FOUND — cannot check links")
            continue

        with open(full, "r", encoding="utf-8") as f:
            content = f.read()

        collector = LinkCollector()
        collector.feed(content)

        for kind, link in collector.links:
            if any(link.startswith(p) for p in SKIP_PREFIXES):
                passed += 1
                continue
            if not link.strip():
                continue

            target = resolve(rel, link)
            if os.path.exists(target):
                passed += 1
            else:
                failed += 1
                failures.append(f"  FAIL [{rel}] Broken {kind}: '{link}' -> {target}")

    print(f"\n{'='*60}")
    print(f"  test_links.py: {passed} passed, {failed} failed")
    print(f"{'='*60}")
    if failures:
        for f in failures:
            print(f)
        print()

    return failed == 0


if __name__ == "__main__":
    ok = run()
    sys.exit(0 if ok else 1)
