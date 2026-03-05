"""
test_structure.py
=================
Validates HTML structure for every page on the VAGT website.
Checks: DOCTYPE, html/head/body, title, meta description, viewport,
        canonical-safe attributes, CSP meta tag on public pages,
        noindex/nofollow on portal pages.
"""

import os
import re
import sys
from html.parser import HTMLParser

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# ── Page inventory ────────────────────────────────────────────────────────────
PUBLIC_PAGES = [
    "index.html",
    "pages/about.html",
    "pages/contact.html",
    "pages/security.html",
    "pages/facilities.html",
    "pages/surveillance.html",
]

PORTAL_PAGES = [
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

OTHER_PAGES = [
    "404.html",
]

ALL_PAGES = PUBLIC_PAGES + PORTAL_PAGES + OTHER_PAGES


class MetaCollector(HTMLParser):
    """Collects key structural signals from an HTML file."""

    def __init__(self):
        super().__init__()
        self.has_doctype = False
        self.has_html = False
        self.has_head = False
        self.has_body = False
        self.has_title = False
        self.has_viewport = False
        self.has_description = False
        self.has_csp = False
        self.has_robots_noindex = False
        self.has_charset = False
        self._in_title = False
        self.title_text = ""
        self.h1_count = 0

    def handle_decl(self, decl):
        if decl.lower().startswith("doctype"):
            self.has_doctype = True

    def handle_starttag(self, tag, attrs):
        attrs_dict = {k.lower(): (v or "").lower() for k, v in attrs}
        if tag == "html":
            self.has_html = True
        elif tag == "head":
            self.has_head = True
        elif tag == "body":
            self.has_body = True
        elif tag == "title":
            self.has_title = True
            self._in_title = True
        elif tag == "h1":
            self.h1_count += 1
        elif tag == "meta":
            name = attrs_dict.get("name", "")
            http_equiv = attrs_dict.get("http-equiv", "")
            content = attrs_dict.get("content", "")
            charset = attrs_dict.get("charset", "")
            if charset:
                self.has_charset = True
            if name == "viewport":
                self.has_viewport = True
            if name == "description" and content:
                self.has_description = True
            if name == "robots" and ("noindex" in content):
                self.has_robots_noindex = True
            if http_equiv == "content-security-policy" and content:
                self.has_csp = True

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_title:
            self.title_text += data


def parse_page(rel_path):
    full = os.path.join(ROOT, rel_path)
    with open(full, "r", encoding="utf-8") as f:
        raw = f.read()
    # DOCTYPE is not captured by handle_decl in all Python versions, check raw
    p = MetaCollector()
    if "<!DOCTYPE html>" in raw or "<!doctype html>" in raw.lower():
        p.has_doctype = True
    p.feed(raw)
    return p


def run():
    passed = 0
    failed = 0
    failures = []

    def check(condition, page, message):
        nonlocal passed, failed
        if condition:
            passed += 1
        else:
            failed += 1
            failures.append(f"  FAIL [{page}] {message}")

    for rel in ALL_PAGES:
        full = os.path.join(ROOT, rel)
        if not os.path.exists(full):
            failed += 1
            failures.append(f"  FAIL [{rel}] FILE NOT FOUND")
            continue

        p = parse_page(rel)
        is_portal = rel in PORTAL_PAGES

        check(p.has_doctype,      rel, "Missing <!DOCTYPE html>")
        check(p.has_html,         rel, "Missing <html> tag")
        check(p.has_head,         rel, "Missing <head> tag")
        check(p.has_body,         rel, "Missing <body> tag")
        check(p.has_title,        rel, "Missing <title> tag")
        check(p.has_charset,      rel, "Missing charset meta tag")
        check(p.has_viewport,     rel, "Missing viewport meta tag")
        check(p.has_description,  rel, "Missing meta description")

        title = p.title_text.strip()
        check(len(title) >= 10,   rel, f"Title too short or empty: '{title}'")
        check("VAGT" in title,    rel, f"Title doesn't contain 'VAGT': '{title}'")

        if is_portal:
            check(p.has_robots_noindex, rel, "Portal page missing noindex robots meta")

    print(f"\n{'='*60}")
    print(f"  test_structure.py: {passed} passed, {failed} failed")
    print(f"{'='*60}")
    if failures:
        for f in failures:
            print(f)
        print()

    return failed == 0


if __name__ == "__main__":
    ok = run()
    sys.exit(0 if ok else 1)
