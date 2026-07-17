<table border="0">
  <tr>
    <td>
      <!-- VERSION -->v6.07.06<br>
      <!-- DATE -->11-Jul-2026<br>
      macOS &nbsp;|&nbsp; Windows &nbsp;|&nbsp; Linux<br>
      <a href="https://landenlabs.com">Home</a>
    </td>
    <td>
      <a href="https://landenlabs.com">
        <img src="screens/landenlabs_400.webp" width="300" alt="LanDen Labs">
      </a>
    </td>
  </tr>
</table>

<img src="icon.png" width="72" align="left" alt="git-tool icon">

# git-tool

A cross-platform CLI that scans one or more directory trees for git repositories and
reports their status, branch, tag, release, and disk size — with optional bulk actions
to clean, pull, push, or rename `master` to `main`. Also supports downloading a single
file or directory tree directly from a `github.com` URL, without cloning the repo.

**By [LanDen Labs](https://github.com/landenlabs) (2026)**

---

## Screenshots

_(coming soon)_

---

## Features

- **Recursive repo discovery.** Pass directory paths and the tool walks them for `.git`
  directories; or pass a regex pattern to search from the current working directory.
  Repos nested inside another repo are not double-counted.
- **Reporting flags** (any combination):
  - `--branch` — current branch, local branch count, remote branch count.
  - `--status` — staged, unstaged, untracked, conflict, ahead/behind, and unpushed-branch counts.
  - `--tag` — most recently created tag name.
  - `--release` — most recently created tag name with its creation date.
  - `--size` — `.git` directory disk usage, packed size, and loose object size.
  - `--summary` — shorthand for all five flags above, plus an end-of-run summary report.
  - `--dirty` — suppress clean repos; show only repos with pending changes or errors.
- **ANSI color output.** Red = error, yellow = behind remote, green = local changes.
  Respects `NO_COLOR` and `--no-color`. Windows virtual terminal processing is enabled
  automatically.
- **Bulk actions:**
  - `--clean` — `git fetch --prune`, `git worktree prune`, `git gc --auto` on every repo.
  - `--pull` — `git pull` on every repo that has a remote.
  - `--push` — `git add --all`, `git commit -m MSG`, `git push` on every repo with changes.
  - `--main` — rename `master` → `main` (local + remote) wherever safe.
- **Dry-run mode.** `--dry-run` previews what `--main`, `--clean`, `--pull`, or `--push`
  would do without making any changes.
- **End-of-run summary.** When `--summary` is used, prints a report with total `.git`
  size, largest repo, status counts (clean / error / pending / behind), branch counts,
  tag/release counts, and contributor list.
- **GitHub download.** `--download URL` fetches a single file (`blob` URL) or a
  directory (`tree` URL) straight from GitHub's API — no local clone required.
  - `--recursive` descends into subdirectories (omit it to grab only the top-level files).
  - `--include`/`--exclude` filter files by glob pattern.
  - `--output` sets the local destination; `--token` (or `GITHUB_TOKEN`) authenticates
    for private repos or a higher API rate limit.
  - Transient network errors are retried automatically with backoff.
- **Standard CLI.** `--version`, `--help` with examples, clean Ctrl-C handling.

---

## Requirements

- Python 3.9 or later
- No third-party packages — uses only the standard library
- `git` must be on `PATH`

---

## Installation

### Run from source

```bash
git clone https://github.com/landenlabs/git-tool.git
cd git-tool
python git-tool.py --help
```

### Build a standalone binary

**macOS / Linux**

```bash
pyinstaller --onefile --name git-tool git-tool.py
```

**Windows**

```powershell
pyinstaller --onefile --name git-tool git-tool.py
```

Both commands use [PyInstaller](https://pyinstaller.org) to produce a self-contained executable.

Pushing a `v*` tag (e.g. `v1.0.0`) triggers `.github/workflows/build.yml`, which builds
macOS and Windows binaries and publishes them to a GitHub Release automatically.

---

## Usage

### Report status for all repos under a directory

```bash
git-tool.py --status ~/projects
git-tool.py --status --verbose ~/projects
```

Sample output:

```
/home/you/projects/myapp
  status:  2 modified, 1 untracked  |  1 commit to push

/home/you/projects/lib
  status:  (clean)
```

### Full summary (branch + status + tag + release + size)

```bash
git-tool.py --summary ~/projects
```

### Only show repos with pending changes

```bash
git-tool.py --status --dirty ~/projects
```

### Pull all repos

```bash
git-tool.py --pull ~/projects
git-tool.py --pull --dry-run ~/projects
```

### Stage, commit, and push all repos

```bash
git-tool.py --push --message "global update" ~/projects
git-tool.py --push -m "wip" --dry-run ~/projects
```

### Rename master → main

```bash
git-tool.py --main --dry-run ~/projects
git-tool.py --main ~/projects
```

### Search by regex pattern

```bash
# Match any repo whose full path contains "myproject" (case-insensitive)
git-tool.py --status myproject
git-tool.py --branch --status ".*2024.*"
```

### Download a file or directory from GitHub

```bash
# Single file (blob URL)
git-tool.py --download https://github.com/OWNER/REPO/blob/main/path/file.py

# Directory, top-level files only (tree URL, no --recursive)
git-tool.py --download https://github.com/OWNER/REPO/tree/main/path/dir

# Directory, including all subdirectories
git-tool.py --download https://github.com/OWNER/REPO/tree/main/path/dir --recursive

# Filter which files are downloaded, and choose a destination
git-tool.py --download URL --recursive --include "*.ts" --exclude "*.test.ts" -o ./out

# Private repo, or to raise the API rate limit (prefer the env var over --token
# so the credential doesn't end up in shell history)
GITHUB_TOKEN=ghp_xxx git-tool.py --download URL
git-tool.py --download URL --token ghp_xxx
```

Notes:
- `blob` URLs are for files, `tree` URLs are for directories — using the wrong one errors out.
- Without `--recursive`, subdirectories inside a `tree` URL are listed as skipped, not descended into.
- Classic tokens for organizations with SAML SSO enforced (e.g. many GitHub Enterprise
  orgs) must be authorized for that org: on https://github.com/settings/tokens, click
  **Configure SSO** next to the token and authorize it, even if scopes are already correct.

### All reporting flags

| Flag | Purpose |
| ---- | ------- |
| `--branch` | Current branch and local/remote branch counts |
| `--status` | Working tree and sync status |
| `--tag` | Most recent tag |
| `--release` | Most recent tag with date |
| `--size` | `.git` directory disk size |
| `--summary` | All of the above + end-of-run summary report |
| `--dirty` | Only show repos with non-clean status |
| `--verbose` / `-v` | Full status output and scanning details |
| `--no-color` | Disable ANSI color output |
| `--version` | Print version and exit |
| `--help` | Show full usage and examples |

### Download flags

| Flag | Purpose |
| ---- | ------- |
| `--download URL` | Fetch a file (`blob` URL) or directory (`tree` URL) from github.com |
| `--recursive` | With a directory URL, descend into subdirectories |
| `--include PATTERN` | Only fetch files matching a glob pattern (repeatable) |
| `--exclude PATTERN` | Skip files matching a glob pattern (repeatable) |
| `--output` / `-o` | Local destination file or directory |
| `--token` | GitHub token for private repos / higher rate limit (or set `GITHUB_TOKEN`) |

---

## Project structure

```
git-tool/
├── git-tool.py                  # Main script (single-file CLI; hardcodes VERSION = "vX.Y.Z")
├── VERSION                      # Bare X.Y.Z, mirrors git-tool.py's VERSION literal
├── set-version.bash             # Bump version, commit, tag, push (macOS/Linux)
├── set-version.ps1              # Bump version, commit, tag, push (Windows)
├── icon.png                     # App icon: baked into the release binaries, shown in README
├── icon.icns                    # App icon baked into the macOS release build
├── icon.ico                     # App icon baked into the Windows release build
├── make-icons.py                # Regenerate icon.icns/icon.ico from icon.png
├── requirements.txt
├── README.md
├── LICENSE
├── screens/                     # Images used in this README
└── .github/workflows/build.yml  # Tag-triggered build + GitHub Release
```

---

## Releasing

Versions are bumped with `set-version.bash` (or `set-version.ps1` on Windows), run from
the repo root:

```bash
./set-version.bash -version 1.0.1 -message "Fix rename-to-main edge case"
```

This updates `VERSION`, the `VERSION` literal hardcoded in `git-tool.py`, and the
version/date markers at the top of this README that feed the release build above.

---

## License

Apache 2.0 © [LanDen Labs](https://github.com/landenlabs) 2026
