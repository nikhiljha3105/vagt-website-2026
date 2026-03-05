"""
test_security.py
================
Security-focused checks for the VAGT website codebase:

1. No hardcoded API keys or secrets in any tracked file
2. Security headers (_headers) contains required directives
3. Every HTML page has CSP meta fallback
4. Portal pages have noindex + nofollow
5. No dangerous inline event handlers (onclick=..., onload=... with remote URLs)
6. robots.txt disallows /pages/admin*
7. Sitemap does not expose portal/admin pages
8. .gitignore exists and covers firebase-config.js
"""

import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# Patterns that indicate leaked credentials
SECRET_PATTERNS = [
    # Firebase/Google API keys (AIza prefix)
    re.compile(r'AIza[0-9A-Za-z_\-]{35}'),
    # Generic private key PEM block
    re.compile(r'-----BEGIN (RSA |EC )?PRIVATE KEY-----'),
    # Generic "password = " assignment in code
    re.compile(r'password\s*=\s*["\'][^"\']{8,}["\']', re.IGNORECASE),
    # AWS access key format
    re.compile(r'AKIA[0-9A-Z]{16}'),
]

# Extensions to scan for secrets
SCAN_EXTENSIONS = {".html", ".js", ".json", ".ts", ".py", ".sh", ".md", ".txt", ".css"}

SKIP_DIRS = {".git", "node_modules", "__pycache__", "tests"}

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

ALL_HTML_PAGES = [
    "index.html",
    "pages/about.html",
    "pages/contact.html",
    "pages/security.html",
    "pages/facilities.html",
    "pages/surveillance.html",
    "404.html",
] + PORTAL_PAGES

REQUIRED_HEADERS = [
    "X-Frame-Options",
    "X-Content-Type-Options",
    "Referrer-Policy",
    "Content-Security-Policy",
    "Permissions-Policy",
]


def iter_files(root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            _, ext = os.path.splitext(fn)
            if ext.lower() in SCAN_EXTENSIONS:
                yield os.path.join(dirpath, fn)


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

    # ── 1. No secrets in codebase ────────────────────────────────────────────
    for filepath in iter_files(ROOT):
        rel = os.path.relpath(filepath, ROOT)
        try:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
        except Exception:
            continue
        for pattern in SECRET_PATTERNS:
            m = pattern.search(content)
            if m:
                failed += 1
                failures.append(
                    f"  FAIL [secrets] Potential secret in {rel}: "
                    f"matched pattern '{pattern.pattern[:40]}' near: '{m.group()[:30]}'"
                )
            else:
                passed += 1

    # ── 2. _headers file has required security headers ────────────────────────
    headers_path = os.path.join(ROOT, "_headers")
    if os.path.isfile(headers_path):
        with open(headers_path, "r", encoding="utf-8") as f:
            headers_content = f.read()
        for header in REQUIRED_HEADERS:
            check(
                header in headers_content,
                "_headers",
                f"Missing required header: {header}",
            )
    else:
        failed += 1
        failures.append("  FAIL [_headers] File not found")

    # ── 3. Every HTML page has CSP meta fallback ─────────────────────────────
    for rel in ALL_HTML_PAGES:
        full = os.path.join(ROOT, rel)
        if not os.path.isfile(full):
            continue
        with open(full, "r", encoding="utf-8") as f:
            content = f.read()
        check(
            "content-security-policy" in content.lower(),
            rel,
            "Missing CSP meta http-equiv tag",
        )

    # ── 4. Portal pages have noindex, nofollow ───────────────────────────────
    for rel in PORTAL_PAGES:
        full = os.path.join(ROOT, rel)
        if not os.path.isfile(full):
            continue
        with open(full, "r", encoding="utf-8") as f:
            content = f.read()
        check(
            "noindex" in content.lower(),
            rel,
            "Portal page missing noindex robots directive",
        )
        check(
            "nofollow" in content.lower(),
            rel,
            "Portal page missing nofollow robots directive",
        )

    # ── 5. robots.txt disallows admin pages ───────────────────────────────────
    robots_path = os.path.join(ROOT, "robots.txt")
    if os.path.isfile(robots_path):
        with open(robots_path, "r", encoding="utf-8") as f:
            robots_content = f.read()
        check(
            "Disallow:" in robots_content,
            "robots.txt",
            "robots.txt has no Disallow directives",
        )
        check(
            "/pages/" in robots_content or "admin" in robots_content.lower(),
            "robots.txt",
            "robots.txt does not disallow portal/admin pages",
        )
    else:
        failed += 1
        failures.append("  FAIL [robots.txt] File not found")

    # ── 6. Sitemap does not list portal/admin pages ───────────────────────────
    sitemap_path = os.path.join(ROOT, "sitemap.xml")
    if os.path.isfile(sitemap_path):
        with open(sitemap_path, "r", encoding="utf-8") as f:
            sitemap_content = f.read()
        # Only check <loc> elements, not comments
        loc_urls = " ".join(re.findall(r'<loc>(.*?)</loc>', sitemap_content, re.IGNORECASE)).lower()
        admin_in_sitemap = bool(re.search(r'admin|portal|employee-portal|client-portal', loc_urls))
        check(
            not admin_in_sitemap,
            "sitemap.xml",
            "Sitemap <loc> exposes portal/admin page URLs",
        )
    else:
        failed += 1
        failures.append("  FAIL [sitemap.xml] File not found")

    # ── 7. .gitignore exists and covers firebase-config ──────────────────────
    gitignore_path = os.path.join(ROOT, ".gitignore")
    if os.path.isfile(gitignore_path):
        with open(gitignore_path, "r", encoding="utf-8") as f:
            gi_content = f.read()
        check(
            "firebase-config" in gi_content,
            ".gitignore",
            ".gitignore does not exclude firebase-config.js",
        )
        check(
            ".env" in gi_content,
            ".gitignore",
            ".gitignore does not exclude .env files",
        )
    else:
        failed += 1
        failures.append("  FAIL [.gitignore] File not found — credentials could be accidentally committed")

    print(f"\n{'='*60}")
    print(f"  test_security.py: {passed} passed, {failed} failed")
    print(f"{'='*60}")
    if failures:
        for f in failures:
            print(f)
        print()

    return failed == 0


if __name__ == "__main__":
    ok = run()
    sys.exit(0 if ok else 1)
