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
to clean, pull, push, rename `master` to `main`, and delete merged branches. Also lists and
clones a GitHub user's or org's repos, prunes old GitHub Actions runs, and downloads a
single file or directory tree directly from a `github.com` URL, without cloning the repo.

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
  - `--branch-details` — every local and remote branch in columns: owner (author of the
    branch's first unique commit), last-change date, and one state column —
    `default`, `checked out`, `PR #N open -> BASE`, `merged - safe to delete`,
    `PR #N merged -> BASE - safe to delete` (squash merges), `PR #N closed (-> BASE), unmerged (+N)`, or
    `unmerged (+N)`. PR info is github.com only and uses `--token`/`GITHUB_TOKEN`,
    else the `gh` CLI, else the public API. Repos and per-branch lookups run in
    parallel; `--jobs N` (default 8) sets the worker count.
  - `--tag-list` — every tag, newest first, with its date and the first line containing
    `--tag-text` (default `ext.PLUGIN_VERSION`) in `--tag-file` (default `app/build.gradle`)
    at that tag — handy for mapping release tags to app versions.
- **Merged-branch cleanup.** `--delete-merged` deletes every local and `origin` branch whose
  tip is already reachable from the default branch (`origin/HEAD`, e.g. `origin/main`).
  - Never touches the default branch, the checked-out branch, branches checked out in any
    worktree, or protected names (`main`, `master`, `develop`, `development`, `release`,
    `release/*`).
  - One table and one `[y/N]` prompt per repo (`--yes` skips it); honors `--dry-run`.
    Runs `git fetch --all --prune` first, and remote deletes are batched into one push.
  - Filters: `--match GLOB` (branch name), `--owner TEXT_OR_GLOB` (tip-commit author
    name or email; substring, or glob if it has `* ? [`), `--local-only` (never touch origin).
  - `--include-pr-merged` also catches squash/rebase-merged GitHub PRs, but only when the
    branch has no commits beyond what the PR merged.
  - **Merged elsewhere (report only).** After the delete table, a second table lists
    branches that are *not* delete candidates but whose tip is already contained in another
    local or origin branch — e.g. a feature branch merged into `dev_1.4` but not yet into
    `main`. Nothing in this table is deleted. The MERGED INTO column lists long-lived
    branches (the protected names plus `dev_*`) first and shows at most 3 names plus
    `+N more`. Fast-forward copies of the same work are skipped: equal tips, the same name
    on local vs origin, or the same name with a `_main`/`_dev` suffix. It honors `--match`,
    `--owner` and `--local-only` like the delete list; `--no-merged-elsewhere` hides it.
- **Single-branch delete.** `--delete-branch BRANCH` deletes one branch locally and on
  `origin` in every scanned repo, after showing whether it is merged and asking for
  confirmation. Skips repos where it is checked out; honors `--dry-run`.
- **GitHub Actions cleanup.** `--actions-delete-runs-keep [N]` deletes all but the newest
  `N` (default 3) Actions runs of every workflow in each github.com repo. In-progress runs
  are never deleted. Prompts per repo, honors `--dry-run`, deletes in parallel (`--jobs N`).
  Uses `--token`/`GITHUB_TOKEN`, else the `gh` CLI.
- **ANSI color output.** Red = error, yellow = behind remote, green = local changes.
  Respects `NO_COLOR` and `--no-color`. Windows virtual terminal processing is enabled
  automatically.
- **Bulk actions:**
  - `--clean` — `git fetch --prune`, `git worktree prune`, `git gc --auto` on every repo.
  - `--pull` — `git pull` on every repo that has a remote.
  - `--push` — `git add --all`, `git commit -m MSG`, `git push` on every repo with changes.
  - `--main` — rename `master` → `main` (local + remote) wherever safe.
- **Dry-run mode.** `--dry-run` previews what `--main`, `--delete-branch`, `--delete-merged`,
  `--actions-delete-runs-keep`, `--clean`, `--pull`, or `--push` would do without making
  any changes.
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
- **GitHub repo listing and cloning.** `--host OWNER` (or `github.com/OWNER`) with
  `--repo-list [REGEX]` lists a user's or org's repos, flagged `private`/`fork`/`archived`;
  `--repo-clone REGEX` (repeatable) clones every matching repo into the current directory,
  skipping names that already exist. Both use `--token`/`GITHUB_TOKEN` for private repos.
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

### Delete merged branches

```bash
git-tool.py --delete-merged --dry-run ~/projects
git-tool.py --delete-merged ~/projects
git-tool.py --delete-merged --match "feature/*" --yes ~/projects
git-tool.py --delete-merged --local-only --owner alice --dry-run ~/projects
git-tool.py --delete-merged --owner "*@example.com" --dry-run ~/projects
git-tool.py --delete-merged --include-pr-merged --dry-run .
git-tool.py --delete-merged --dry-run --no-merged-elsewhere ~/projects
```

Sample output (`--dry-run`):

```
/home/you/projects/app  (default: origin/main)
  BRANCH          WHERE         OWNER  STATE
  DB-2036_alerts  remote        Alice  merged into origin/main
  dev_1.3         local+remote  Bob    merged into origin/main

  Merged elsewhere (not deleted)
  BRANCH                  WHERE   OWNER  MERGED INTO
  DB-2052_profile_x_axis  remote  Bob    dev_1.4, DB-2055_pws_units, DB-2056_airport_loc +5 more
  DB-2179_tile_cache_oom  remote  Alice  dev_1.4
  [dry-run] would delete 1 local + 2 remote branch(es)

Would delete 3 branch ref(s).
```

The "Merged elsewhere" scan runs one `git for-each-ref --merged=<tip>` per distinct branch
tip (in parallel, `--jobs N`), not a `merge-base` call per branch pair. Tips already merged
into the default branch are skipped, since anything they contain is already a delete
candidate or protected.

### Delete one branch everywhere

```bash
git-tool.py --delete-branch old-feature --dry-run ~/projects
git-tool.py --delete-branch old-feature ~/projects
```

### List tags with the app version at each tag

```bash
git-tool.py --tag-list .
git-tool.py --tag-list --tag-file app/build.gradle --tag-text ext.PLUGIN_VERSION .
```

### Branch details (owner, last change, merged / PR / safe to delete)

```bash
git-tool.py --branch-details .
git-tool.py --branch-details --token ghp_xxx ~/projects
git-tool.py --branch-details --jobs 16 ~/projects
```

### Delete old GitHub Actions runs (keep newest N per workflow)

```bash
git-tool.py --actions-delete-runs-keep 3 --dry-run .
git-tool.py --actions-delete-runs-keep 3 ~/projects
```

### List or clone a GitHub user's / org's repos

```bash
git-tool.py --host github.com/landenlabs --repo-list
git-tool.py --host landenlabs --repo-list "py.*"
git-tool.py --host github.com/landenlabs --repo-clone "py.*"
git-tool.py --host landenlabs --repo-clone py-tool1 --repo-clone py-tool2
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
| `--tag-list` | All tags with date and the `--tag-text` line from `--tag-file` |
| `--tag-file FILE` | File searched by `--tag-list` (default `app/build.gradle`) |
| `--tag-text TEXT` | Text searched by `--tag-list` (default `ext.PLUGIN_VERSION`) |
| `--branch-details` | Every branch with owner, last change, merged/PR state |
| `--jobs` / `-j N` | Parallel workers (default 8) |
| `--version` | Print version and exit |
| `--help` | Show full usage and examples |

### Branch cleanup flags

| Flag | Purpose |
| ---- | ------- |
| `--delete-merged` | Delete local + origin branches merged into the default branch |
| `--match GLOB` | Only branches whose name matches GLOB |
| `--owner TEXT_OR_GLOB` | Only branches whose tip author name/email contains TEXT or matches GLOB |
| `--local-only` | Delete only local branches; never touch origin |
| `--include-pr-merged` | Also delete squash/rebase-merged PR branches with no later commits |
| `--no-merged-elsewhere` | Hide the report-only "Merged elsewhere (not deleted)" table |
| `--yes` / `-y` | Delete without prompting |
| `--delete-branch BRANCH` | Delete one branch locally and on origin, with confirmation |
| `--dry-run` | Show what would be deleted without deleting |

### Action flags

| Flag | Purpose |
| ---- | ------- |
| `--clean` | `fetch --prune`, `worktree prune`, `gc --auto` |
| `--pull` | `git pull` each repo with a remote |
| `--push` | Stage all, commit with `--message`/`-m`, push |
| `--main` | Rename `master` → `main` (local + remote) |
| `--actions-delete-runs-keep [N]` | Keep only the newest N GitHub Actions runs per workflow |
| `--dry-run` | Preview any of the above without changes |

### GitHub repo flags

| Flag | Purpose |
| ---- | ------- |
| `--host OWNER_OR_URL` | GitHub user/org, e.g. `landenlabs` or `github.com/landenlabs` |
| `--repo-list [REGEX]` | List the owner's repos, optionally filtered |
| `--repo-clone REGEX` | Clone matching repos, skipping existing directories (repeatable) |

### Download flags

| Flag | Purpose |
| ---- | ------- |
| `--download URL` | Fetch a file (`blob` URL) or directory (`tree` URL) from github.com |
| `--recursive` | With a directory URL, descend into subdirectories |
| `--include PATTERN` | Only fetch files matching a glob pattern (repeatable) |
| `--exclude PATTERN` | Skip files matching a glob pattern (repeatable) |
| `--output` / `-o` | Local destination file or directory |
| `--token` | GitHub token for private repos / higher rate limit (or set `GITHUB_TOKEN`); also used by `--repo-list`, `--repo-clone`, `--branch-details`, `--include-pr-merged`, `--actions-delete-runs-keep` |

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
