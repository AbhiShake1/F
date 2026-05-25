# F

Universal fetch/find/search for AI agents and humans. No flags. Token-efficient by design.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What it does

`F [file|url|string ...]` — F routes each argument by shape and returns what you need.

- URL → fetched as markdown
- File path → read (any format)
- Anything else → search file contents

No flags. Ever.

## Install

**macOS / Linux**
```sh
curl -fsSL https://raw.githubusercontent.com/AbhiShake1/F/main/install.sh | sh
```

**Windows** (PowerShell)
```powershell
irm https://raw.githubusercontent.com/AbhiShake1/F/main/install.ps1 | iex
```

Then install F's dependencies:

```sh
F -s
```

**Uninstall**

macOS/Linux: `curl -fsSL https://raw.githubusercontent.com/AbhiShake1/F/main/uninstall.sh | sh`

Windows: `irm https://raw.githubusercontent.com/AbhiShake1/F/main/uninstall.ps1 | iex`

## Delegates to

| Tool | Purpose | Link |
|---|---|---|
| curl.md | URL → markdown | https://github.com/wevm/curl.md |
| RTK | Output compression | https://github.com/rtk-ai/rtk |
| ripgrep | File content + filename search | https://github.com/BurntSushi/ripgrep |
| pdf-to-markdown | PDF → markdown | https://www.npmjs.com/package/@pspdfkit/pdf-to-markdown |
| pandoc | DOCX, PPTX, EPUB, ODT, RTF → markdown | https://github.com/jgm/pandoc |
| SheetJS | XLSX, XLS, ODS → markdown tables | https://sheetjs.com |
| CloakBrowser | Bypass blocked sites (opt-in) | https://github.com/CloakHQ/CloakBrowser |

Frecency algorithm adapted from [zoxide](https://github.com/ajeetdsouza/zoxide).

## Design decisions

### No flags

Flags consume tokens. `--flag` = 1 token. Every flag on every call compounds across thousands of agent invocations. Argument shape encodes intent: a URL looks like a URL, a file path looks like a path, everything else is a search. No ambiguity, no flags required.

### `-s` is the one exception

`F -s` runs the dependency installer. This is the only flag F accepts, and it exists for one reason: `setup` is a real word that users legitimately search for in codebases. `F setup` would collide with content search. `-s` is unambiguous — no file is named `-s`, no search query starts with it.

### `F -s` not shown in help text

Setup runs once per machine. Displaying it in help output on every invocation wastes tokens for every agent and human that runs `F`. It lives here. Documented decision.

### `F -s` suppresses all output

When an AI agent runs `F -s`, install logs pollute the context window with dozens of lines the agent does not need. All install output is suppressed. Success = silence. Failure = non-zero exit; re-run manually.

### Missing dependency: tell user, don't auto-install

If a dependency is missing mid-run, F prints:

```
missing: <tool>. run: F -s
```

Then exits. Auto-running setup silently hides failures and wastes time. Explicit is better.

### Heavy opt-ins: CloakBrowser

**pandoc is a core dependency** — installed by `F -s` alongside ripgrep and curl.md. It handles DOCX, PPTX, EPUB, ODT, RTF → markdown with no extra steps. SheetJS (also installed by `F -s`) handles XLSX, XLS, ODS → markdown tables. Jupyter notebooks (`.ipynb`), ZIP/tar archives, SQLite databases, plist files, and man pages are handled natively with no external tools — all rely on macOS/Linux built-ins (`unzip`, `tar`, `sqlite3`, `plutil`, `mandoc`/`groff`).

Some capabilities require large downloads and are not installed by `F -s`.

**Bypass blocked sites** (stealth browser):
```sh
F -s cloak-browser
```
When a site blocks the request, F prints:
```
blocked. `F -s cloak-browser` to bypass
```

CloakBrowser is excluded from `F -s` because it is large, slow to install, and most users never need it. The install hint is surfaced exactly when needed.

### Frecency algorithm (from zoxide)

F tracks file access history using zoxide's exact frecency algorithm: score × recency multiplier (4× if <1hr, 2× if <1day, 0.5× if <1wk, 0.25× older). Index stored at `~/.F/index.json`. Normalized when total score exceeds 1000.

This lets `F kini` find `project/src/lib/integration/kini.ts` immediately after first access, without scanning the filesystem again.

## How F decides what you meant

Detection runs in this order:

1. URL pattern → fetch via curl.md
2. Contains `/` → exact path → read
3. Frecency index hit → read (fastest path)
4. `git ls-files` scan → read + index for next time
5. Filesystem scan → read + index
6. Fallback → content search across all files via ripgrep

## Usage

```
F [file|url|string ...]
```

```bash
F youtube.com          # fetch as markdown
F index.ts             # read file
F getUserById          # search file contents
F report.pdf           # parse and read document
F data.xlsx            # spreadsheet → markdown table
F notebook.ipynb       # Jupyter notebook → markdown
F archive.zip          # list archive contents
F archive.tar.gz       # list archive contents
F app.db               # SQLite schema + sample rows
F Info.plist           # plist → readable key-value
F /usr/share/man/man1/ls.1  # man page → plain text
F "auth middleware"    # search across all files
F index.ts fetch.js    # read multiple files
F README.md github.com/user/repo  # mix files and URLs
```

## Blocked sites

Some sites block automated fetching. F handles this:

```
blocked. `F -s cloak-browser` to bypass
```

Install CloakBrowser once with `F -s cloak-browser` and F will use it automatically on blocked sites.

## Development

```sh
git clone https://github.com/AbhiShake1/F
cd F
node index.js                       # run directly
node --test test/*.test.js          # run tests
```

## License

MIT
