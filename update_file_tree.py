#!/usr/bin/env python3
"""
P-Stream Frontend File Tree Generator
--------------------------------------
Run this from the root of your pstream-frontend project:
    python update_file_tree.py

Or point it at a specific folder:
    python update_file_tree.py /path/to/pstream-frontend

Updates file_tree_frondend.txt automatically every time.
"""

import os
import sys
from pathlib import Path
from datetime import datetime

# ──────────────────────────────────────────────
# CONFIGURATION — edit these as your project grows
# ──────────────────────────────────────────────

OUTPUT_FILE = "file_tree_frondend.txt"

# Directories to skip entirely
EXCLUDED_DIRS = {
    "node_modules",
    "dist",
    "build",
    "out",
    ".git",
    ".svn",
    "__pycache__",
    ".vite",
    ".cache",
    ".turbo",
    ".next",
    ".nuxt",
    ".svelte-kit",
    "coverage",
    ".nyc_output",
    "storybook-static",
}

# Specific filenames to skip
EXCLUDED_FILES = {
    ".DS_Store",
    "Thumbs.db",
    "desktop.ini",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "bun.lockb",
}

# File extensions to skip (generated / noisy output)
EXCLUDED_EXTENSIONS = {
    ".map",      # source maps
    ".log",      # log files
    ".tsbuildinfo",
}

# ──────────────────────────────────────────────


def should_exclude(entry: Path) -> bool:
    if entry.is_dir():
        return entry.name in EXCLUDED_DIRS
    if entry.is_file():
        if entry.name in EXCLUDED_FILES:
            return True
        if entry.suffix in EXCLUDED_EXTENSIONS:
            return True
    return False


def build_tree(root_path: Path, prefix: str = "") -> list:
    lines = []

    try:
        raw_entries = list(root_path.iterdir())
    except PermissionError:
        return lines

    # Dirs first, then files — both sorted alphabetically
    entries = sorted(
        [e for e in raw_entries if not should_exclude(e)],
        key=lambda e: (e.is_file(), e.name.lower()),
    )

    for i, entry in enumerate(entries):
        is_last = i == len(entries) - 1
        connector = "└── " if is_last else "├── "
        lines.append(f"{prefix}{connector}{entry.name}")

        if entry.is_dir():
            extension = "    " if is_last else "│   "
            lines.extend(build_tree(entry, prefix + extension))

    return lines


def count_entries(lines: list) -> tuple:
    files = sum(1 for l in lines if "." in l.split("── ")[-1] and not l.endswith("/"))
    dirs  = len(lines) - files
    return dirs, files


def main():
    # Accept optional path argument; default to the folder this script lives
    # in (not the shell's CWD) — running it from the parent `pstream/` repo
    # was scanning that parent instead of pstream-frontend.
    root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent

    if not root.exists():
        print(f"Error: path not found — {root}")
        sys.exit(1)

    print(f"Scanning: {root}")

    header = [
        f"# P-Stream Frontend — File Tree",
        f"# Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"# Root: {root}",
        "",
        root.name + "/",
    ]

    tree_lines = build_tree(root)
    dirs, files = count_entries(tree_lines)

    footer = [
        "",
        f"# {dirs} directories, {files} files",
    ]

    output = "\n".join(header + tree_lines + footer)

    output_path = root / OUTPUT_FILE
    output_path.write_text(output, encoding="utf-8")

    print(f"✓  Written to {output_path}")
    print(f"   {dirs} directories, {files} files")


if __name__ == "__main__":
    main()
