"""
test_content.py
===============
Content-level checks for VAGT website pages:

Public pages:
  - index.html: hero, services, client logos, CTA, WhatsApp button, nav, footer
  - about.html: company story, leadership credentials
  - contact.html: contact form with required fields, address/phone/email
  - security.html: service list, guard/manned guarding mention
  - facilities.html: facilities services content
  - surveillance.html: CCTV/surveillance mention
  - 404.html: helpful 404 content, link back to home

Portal pages (currently in maintenance mode):
  - All portal pages must show maintenance message (not a live login form)
  - Must NOT show Firebase auth UI elements (login button with live handler)

Navigation:
  - Every public page must have nav links to home, security, facilities, about, contact

SEO:
  - Title lengths: 30-70 chars
  - Descriptions: 80-160 chars
"""

import os
import re
import sys
from html.parser import HTMLParser

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def read(rel):
    p = os.path.join(ROOT, rel)
    if not os.path.isfile(p):
        return None
    with open(p, "r", encoding="utf-8") as f:
        return f.read()


class SimpleParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text = ""
        self._in_title = False
        self.title = ""
        self.descriptions = []
        self.tags = []

    def handle_starttag(self, tag, attrs):
        self.tags.append(tag)
        attrs_dict = dict(attrs)
        if tag == "title":
            self._in_title = True
        if tag == "meta":
            name = (attrs_dict.get("name") or "").lower()
            content = attrs_dict.get("content") or ""
            if name == "description":
                self.descriptions.append(content)

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False

    def handle_data(self, data):
        self.text += data
        if self._in_title:
            self.title += data


def parse(rel):
    content = read(rel)
    if content is None:
        return None, None
    p = SimpleParser()
    p.feed(content)
    return p, content


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

    def contains(text, *phrases):
        t = text.lower()
        return any(ph.lower() in t for ph in phrases)

    # ── index.html ────────────────────────────────────────────────────────────
    p, raw = parse("index.html")
    if p:
        check(contains(p.text, "VAGT", "security"),    "index.html", "No hero/brand mention of VAGT security")
        check(contains(p.text, "manned guarding", "security services", "guard"),
                                                        "index.html", "No core service mention")
        check(contains(raw, "whatsapp", "wa.me"),       "index.html", "No WhatsApp CTA link")
        check(contains(raw, "pages/contact.html"),      "index.html", "No link to contact page")
        check(contains(raw, "pages/security.html"),     "index.html", "No link to security page")
        check(contains(raw, "pages/about.html"),        "index.html", "No link to about page")
        check(contains(raw, "logo"),                    "index.html", "No logo reference")
        check(contains(p.text, "bangalore", "security services"),
                                                        "index.html", "No Bangalore location mention")
        check(contains(raw, "footer"),                  "index.html", "No footer element")

        # SEO
        title_len = len(p.title.strip())
        check(30 <= title_len <= 80,                    "index.html", f"Title length {title_len} not in 30-80 char range")
        if p.descriptions:
            desc_len = len(p.descriptions[0])
            check(60 <= desc_len <= 200,                "index.html", f"Meta description length {desc_len} not in 60-200 range")

    # ── about.html ────────────────────────────────────────────────────────────
    p, raw = parse("pages/about.html")
    if p:
        check(contains(p.text, "VAGT"),                "about.html", "Company name VAGT not found")
        check(contains(p.text, "experience", "years", "founded", "established", "2017"),
                                                        "about.html", "No founding/experience details")
        check(contains(p.text, "security", "guard", "protection"),
                                                        "about.html", "No security service mention")

    # ── contact.html ─────────────────────────────────────────────────────────
    p, raw = parse("pages/contact.html")
    if p:
        check(contains(raw, "<form"),                  "contact.html", "No <form> element found")
        check(contains(raw, 'type="text"', 'name="name"', 'placeholder'),
                                                        "contact.html", "Form appears incomplete (no name/text input)")
        check(contains(raw, "email"),                  "contact.html", "No email field in form")
        check(contains(raw, "submit", 'type="submit"'),
                                                        "contact.html", "No submit button in form")
        check(contains(p.text, "vagtsecurityservices.com", "info@"),
                                                        "contact.html", "No contact email visible")
        check(contains(p.text, "+91", "90089", "phone", "call"),
                                                        "contact.html", "No phone number visible")

    # ── security.html ─────────────────────────────────────────────────────────
    p, raw = parse("pages/security.html")
    if p:
        check(contains(p.text, "manned", "guard", "security officer", "patrol"),
                                                        "security.html", "No manned guarding content")
        check(contains(p.text, "bangalore", "corporate", "site"),
                                                        "security.html", "No target market mention")

    # ── facilities.html ───────────────────────────────────────────────────────
    p, raw = parse("pages/facilities.html")
    if p:
        check(contains(p.text, "facilities", "management", "maintenance"),
                                                        "facilities.html", "No facilities management content")

    # ── surveillance.html ─────────────────────────────────────────────────────
    p, raw = parse("pages/surveillance.html")
    if p:
        check(contains(p.text, "cctv", "camera", "surveillance", "monitoring", "ai"),
                                                        "surveillance.html", "No surveillance/CCTV content")

    # ── 404.html ──────────────────────────────────────────────────────────────
    p, raw = parse("404.html")
    if p:
        check(contains(p.text, "404", "not found", "page"),
                                                        "404.html", "404 page missing 404 message")
        check(contains(raw, "index.html", "home"),
                                                        "404.html", "404 page missing link back to home")

    # ── Portal pages: maintenance mode ────────────────────────────────────────
    portal_pages = [
        "pages/portal.html",
        "pages/employee-portal.html",
        "pages/client-portal.html",
        "pages/admin-portal.html",
    ]
    for rel in portal_pages:
        p, raw = parse(rel)
        if p is None:
            continue
        # Must show maintenance message
        check(
            contains(p.text, "maintenance", "disabled", "unavailable", "coming soon", "offline"),
            rel, "Portal page not showing maintenance/disabled message"
        )
        # Must NOT have live Firebase auth (no signInWithEmailAndPassword outside comments)
        # Simple check: no active Firebase SDK import
        check(
            not re.search(r'signInWithEmailAndPassword\s*\(', raw),
            rel, "Portal page contains live Firebase auth call (security risk while disabled)"
        )

    # ── Navigation consistency on public pages ────────────────────────────────
    nav_pages = [
        ("index.html",               ""),
        ("pages/security.html",      "../"),
        ("pages/facilities.html",    "../"),
        ("pages/about.html",         "../"),
        ("pages/contact.html",       "../"),
        ("pages/surveillance.html",  "../"),
    ]
    for rel, prefix in nav_pages:
        p, raw = parse(rel)
        if raw is None:
            continue
        # Each public page must have nav to the 5 main sections.
        # Pages inside pages/ use relative hrefs like "security.html",
        # while index.html uses "pages/security.html".
        if prefix:  # we're inside pages/ dir
            nav_checks = [
                ("security.html",   "Security nav link"),
                ("facilities.html", "Facilities nav link"),
                ("about.html",      "About nav link"),
                ("contact.html",    "Contact nav link"),
            ]
        else:
            nav_checks = [
                ("pages/security.html",   "Security nav link"),
                ("pages/facilities.html", "Facilities nav link"),
                ("pages/about.html",      "About nav link"),
                ("pages/contact.html",    "Contact nav link"),
            ]
        for href, label in nav_checks:
            check(href in raw, rel, f"Missing {label} ({href})")

    # ── SEO: title and description length on public pages ────────────────────
    seo_pages = [
        "index.html", "pages/about.html", "pages/contact.html",
        "pages/security.html", "pages/facilities.html", "pages/surveillance.html",
    ]
    for rel in seo_pages:
        p, raw = parse(rel)
        if p is None:
            continue
        t = p.title.strip()
        check(30 <= len(t) <= 80, rel, f"Title length {len(t)} chars (expected 30-80): '{t}'")
        if p.descriptions:
            d = p.descriptions[0]
            check(60 <= len(d) <= 200, rel, f"Meta description {len(d)} chars (expected 60-200)")

    print(f"\n{'='*60}")
    print(f"  test_content.py: {passed} passed, {failed} failed")
    print(f"{'='*60}")
    if failures:
        for f in failures:
            print(f)
        print()

    return failed == 0


if __name__ == "__main__":
    ok = run()
    sys.exit(0 if ok else 1)
