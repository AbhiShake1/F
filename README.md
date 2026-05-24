# F

Universal fetch/find/search for AI agents and humans. No flags. Token-efficient by design.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What it does

`F <anything>` — URL, file, or string. F routes by argument shape and returns what you need.

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
| docling | Document parsing (PDF, DOCX, etc.) | https://github.com/docling-project/docling |
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

### CloakBrowser is opt-in via `F -s cloak-browser`

The binary is large. Most users never need it. `F -s` installs the four core tools only. `F -s cloak-browser` adds bypass capability. When a site blocks a request, F prints:

```
blocked. `F -s cloak-browser` to bypass
```

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
F <file|url|string>
```

```bash
F youtube.com          # fetch as markdown
F index.ts             # read file
F getUserById          # search file contents
F report.pdf           # parse and read document
F "auth middleware"    # search across all files
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
