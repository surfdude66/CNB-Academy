"""Check candidate Git files and history for common credential leaks.

This is a pre-publication check, not a substitute for credential rotation or a
dedicated security review. Findings report locations only, never secret values.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PATTERNS = {
    "private key material": re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
    "AWS access key": re.compile(rb"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"),
    "GitHub token": re.compile(rb"\b(?:gh[pousr]_[A-Za-z0-9_]{30,}|github_pat_[A-Za-z0-9_]{20,})\b"),
    "OpenAI API key": re.compile(rb"\bsk-[A-Za-z0-9_-]{20,}\b"),
    "Google API key": re.compile(rb"\bAIza[0-9A-Za-z_-]{35}\b"),
    "Slack token": re.compile(rb"\bxox[baprs]-[A-Za-z0-9-]{20,}\b"),
    "credential assignment": re.compile(
        rb"(?i)\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password|passwd|private[_-]?key)\b\s*[:=]\s*[\"']?([^\s\"'`]{12,})"
    ),
}
SENSITIVE_NAMES = re.compile(
    r"(?i)(?:^|/)(?:\.env(?:\..+)?|id_rsa|id_ed25519|credentials\.json|secrets?\.json|[^/]+\.(?:pem|p12|pfx|key))$"
)


def git(*args: str) -> bytes:
    return subprocess.check_output(["git", *args], cwd=ROOT, stderr=subprocess.DEVNULL)


def inspect(label: str, data: bytes, findings: set[str]) -> None:
    if b"\0" in data[:4096]:
        return
    for number, line in enumerate(data.splitlines(), 1):
        for name, pattern in PATTERNS.items():
            if pattern.search(line):
                findings.add(f"{label}:{number}: {name}")


def main() -> int:
    findings: set[str] = set()
    try:
        candidate_paths = git("ls-files", "--cached", "--others", "--exclude-standard", "-z").split(b"\0")
        for raw in candidate_paths:
            if not raw:
                continue
            relative = raw.decode("utf-8", "surrogateescape").replace("\\", "/")
            if SENSITIVE_NAMES.search(relative):
                findings.add(f"working tree/{relative}: sensitive file name")
            path = (ROOT / relative).resolve()
            if path.is_relative_to(ROOT) and path.is_file():
                inspect(f"working tree/{relative}", path.read_bytes(), findings)

        seen: set[str] = set()
        for raw in git("rev-list", "--objects", "--all").splitlines():
            sha, _, raw_path = raw.partition(b" ")
            object_id = sha.decode("ascii")
            if object_id in seen:
                continue
            seen.add(object_id)
            if git("cat-file", "-t", object_id).strip() != b"blob":
                continue
            relative = raw_path.decode("utf-8", "surrogateescape").replace("\\", "/")
            label = f"history/{relative or object_id}"
            if SENSITIVE_NAMES.search(relative):
                findings.add(f"{label}: sensitive file name")
            inspect(label, git("cat-file", "blob", object_id), findings)
    except (OSError, subprocess.CalledProcessError) as exc:
        print(f"Secret scan could not complete: {type(exc).__name__}", file=sys.stderr)
        return 2

    if findings:
        print("Potential sensitive material found; publication must stop:", file=sys.stderr)
        for finding in sorted(findings):
            print(f"  {finding}", file=sys.stderr)
        return 1

    print("Secret scan passed: no common credentials or sensitive files detected in candidate files or Git history.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
