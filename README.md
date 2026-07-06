<table border="0">
  <tr>
    <td>
      <!-- VERSION -->v6.05.03<br>
      <!-- DATE -->May-2026<br>
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

# git-tool

A cross-platform CLI that scans one or more directory trees for git repositories and
reports their status, branch, tag, release, and disk size — with optional bulk actions
to clean, pull, push, or rename `master` to `main`.

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

---

## Project structure

```
git-tool/
├── git-tool.py         # Main script (single-file CLI)
├── README.md
├── LICENSE
└── screens/            # Images used in this README
```

---

## License

Apache 2.0 © [LanDen Labs](https://github.com/landenlabs) 2026
