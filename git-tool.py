#!/usr/bin/env python3
# ----------------------------------------------------------------------
# Copyright (c) 2026 LanDen Labs - Dennis Lang
# https://landenlabs.com
# ----------------------------------------------------------------------
"""git-tool - Scan directories and report status about their git projects"""

import argparse
import base64
import fnmatch
import json
import os
import re
import subprocess
import sys
import time
import traceback
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

VERSION = "v6.07.06"


# ---------------------------------------------------------------------------
# Color support
# ---------------------------------------------------------------------------

_RED    = '\033[31m'
_YELLOW = '\033[33m'
_GREEN  = '\033[32m'
_RESET  = '\033[0m'

_USE_COLOR = False


def _init_colors():
    """Enable ANSI color output if the terminal supports it."""
    global _USE_COLOR
    if os.environ.get('NO_COLOR'):
        return
    if not sys.stdout.isatty():
        return
    if sys.platform == 'win32':
        try:
            import ctypes
            kernel32 = ctypes.windll.kernel32
            handle = kernel32.GetStdHandle(-11)  # STD_OUTPUT_HANDLE
            mode = ctypes.c_ulong(0)
            if kernel32.GetConsoleMode(handle, ctypes.byref(mode)):
                kernel32.SetConsoleMode(handle, mode.value | 0x0004)  # ENABLE_VIRTUAL_TERMINAL_PROCESSING
        except Exception:
            return
    _USE_COLOR = True


def _c(text, color):
    """Wrap text in an ANSI color if colors are enabled."""
    return f"{color}{text}{_RESET}" if _USE_COLOR else text


def _is_dirty(s, unpushed):
    """Return True if the repo has any non-clean status."""
    if s is None:
        return False
    if s['error'] or s['behind'] or s['ahead']:
        return True
    total_staged   = (s['staged_added'] + s['staged_modified'] +
                      s['staged_deleted'] + s['staged_renamed'])
    total_unstaged = s['unstaged_modified'] + s['unstaged_deleted']
    return bool(total_staged or total_unstaged or s['untracked'] or s['unmerged'] or unpushed)


def _status_color(s, unpushed):
    """Return the ANSI color code for a repo's status, or empty string."""
    if s is None or not _USE_COLOR:
        return ''
    if s['error']:
        return _RED
    if s['behind']:
        return _YELLOW
    total_staged   = (s['staged_added'] + s['staged_modified'] +
                      s['staged_deleted'] + s['staged_renamed'])
    total_unstaged = s['unstaged_modified'] + s['unstaged_deleted']
    if total_staged or total_unstaged or s['untracked'] or s['unmerged'] or s['ahead'] or unpushed:
        return _GREEN
    return ''


# ---------------------------------------------------------------------------
# Directory scanning
# ---------------------------------------------------------------------------

def _scan_subtree(root):
    """Walk root recursively; yield dirs that contain .git (don't recurse into them)."""
    try:
        with os.scandir(root) as it:
            entries = sorted(it, key=lambda e: e.name.lower())
    except (PermissionError, OSError):
        return
    for entry in entries:
        if not entry.is_dir(follow_symlinks=False):
            continue
        if os.path.exists(os.path.join(entry.path, '.git')):
            yield entry.path
        else:
            yield from _scan_subtree(entry.path)


def _find_repo_toplevel(start_dir):
    """Return the top-level directory of the git repo containing start_dir, or None."""
    stdout, _, rc = run_git(start_dir, 'rev-parse', '--show-toplevel')
    if rc != 0:
        return None
    return stdout.strip() or None


def find_git_dirs(dir_args, verbose=False):
    """
    Return a deduplicated list of git repository directories.

    Each item in dir_args is handled as follows:
      - Existing directory path → check it directly; if it isn't a repo itself,
                                  walk up (via git rev-parse --show-toplevel) to
                                  the enclosing repo base; only if that also
                                  fails does it scan children for nested repos.
      - Non-existent path       → treat as a case-insensitive regex; walk cwd and
                                  collect paths whose full name matches.
    """
    git_dirs = []
    seen = set()

    def _add(path):
        real = os.path.realpath(path)
        if real not in seen:
            seen.add(real)
            git_dirs.append(path)

    for arg in dir_args:
        expanded = os.path.expanduser(arg)

        if os.path.isdir(expanded):
            if verbose:
                print(f"Scanning directory: {expanded}", file=sys.stderr)
            # Is the directory itself a repo?
            if os.path.exists(os.path.join(expanded, '.git')):
                _add(expanded)
            else:
                # Not a repo itself — prefer the enclosing repo base (if any)
                # over scanning for unrelated nested repos underneath us, so
                # running from a subdirectory of a repo (e.g. one containing
                # submodule checkouts) resolves to that repo, not its nested
                # checkouts.
                toplevel = _find_repo_toplevel(expanded)
                if toplevel:
                    if verbose:
                        print(f"  inside a repo; using enclosing repo base: {toplevel}",
                              file=sys.stderr)
                    _add(toplevel)
                else:
                    for p in _scan_subtree(expanded):
                        _add(p)
        else:
            # Treat as regex pattern and walk from cwd
            try:
                pattern = re.compile(expanded, re.IGNORECASE)
            except re.error as e:
                print(f"Warning: invalid pattern '{arg}': {e}", file=sys.stderr)
                continue

            if verbose:
                print(f"Scanning cwd with pattern: {expanded}", file=sys.stderr)

            for root, dirs, _ in os.walk(os.getcwd()):
                dirs[:] = sorted(d for d in dirs if d != '.git')
                matched = []
                for d in dirs:
                    full = os.path.join(root, d)
                    norm = full.replace('\\', '/')
                    if pattern.search(norm):
                        if os.path.exists(os.path.join(full, '.git')):
                            _add(full)
                            matched.append(d)
                # Don't recurse into repos we already claimed
                for d in matched:
                    dirs.remove(d)

    return git_dirs


# ---------------------------------------------------------------------------
# Git helpers
# ---------------------------------------------------------------------------

def run_git(git_dir, *git_args):
    """Run a git command in git_dir. Returns (stdout, stderr, returncode)."""
    cmd = ['git', '-C', git_dir] + list(git_args)
    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        return result.stdout, result.stderr, result.returncode
    except FileNotFoundError:
        print("Error: 'git' command not found. Please install git and ensure it is on PATH.",
              file=sys.stderr)
        sys.exit(1)


def get_branch(git_dir):
    """Return the current branch name, or a descriptive fallback."""
    stdout, _, _ = run_git(git_dir, 'branch', '--show-current')
    branch = stdout.strip()
    if branch:
        return branch
    stdout2, _, _ = run_git(git_dir, 'rev-parse', '--short', 'HEAD')
    sha = stdout2.strip()
    return f'(detached {sha})' if sha else '(unknown)'


def get_branch_info(git_dir):
    """Return (current, local_count, remote_count) for the repo."""
    current = get_branch(git_dir)

    local_out, _, _  = run_git(git_dir, 'branch')
    local_count = sum(1 for l in local_out.splitlines() if l.strip())

    remote_out, _, _ = run_git(git_dir, 'branch', '-r')
    # Exclude "origin/HEAD -> origin/main" pointer lines
    remote_count = sum(1 for l in remote_out.splitlines()
                       if l.strip() and '->' not in l)

    return current, local_count, remote_count


def get_repo_status(git_dir):
    """
    Parse 'git status --porcelain=v2 --branch' into a structured dict.
    Keys: branch, upstream, ahead, behind,
          staged_added, staged_modified, staged_deleted, staged_renamed,
          unstaged_modified, unstaged_deleted,
          untracked, unmerged, error
    """
    stdout, stderr, rc = run_git(git_dir, 'status', '--porcelain=v2', '--branch')
    s = dict(branch=None, upstream=None, ahead=0, behind=0,
             staged_added=0, staged_modified=0, staged_deleted=0, staged_renamed=0,
             unstaged_modified=0, unstaged_deleted=0,
             untracked=0, unmerged=0,
             error=stderr.strip() if rc != 0 else None)
    if rc != 0:
        return s
    for line in stdout.splitlines():
        if line.startswith('# branch.head '):
            s['branch'] = line[14:].strip()
        elif line.startswith('# branch.upstream '):
            s['upstream'] = line[18:].strip()
        elif line.startswith('# branch.ab '):
            ab = line[12:].strip().split()
            if len(ab) == 2:
                s['ahead']  = int(ab[0].lstrip('+'))
                s['behind'] = int(ab[1].lstrip('-'))
        elif line.startswith('1 ') or line.startswith('2 '):
            x, y = line[2], line[3]
            if   x == 'A':        s['staged_added']    += 1
            elif x == 'M':        s['staged_modified']  += 1
            elif x == 'D':        s['staged_deleted']   += 1
            elif x in ('R', 'C'): s['staged_renamed']   += 1
            if   y == 'M':        s['unstaged_modified'] += 1
            elif y == 'D':        s['unstaged_deleted']  += 1
        elif line.startswith('u '):
            s['unmerged'] += 1
        elif line.startswith('? '):
            s['untracked'] += 1
    return s


def get_unpushed_branches(git_dir):
    """Return local branch names that have no remote tracking branch."""
    stdout, _, _ = run_git(git_dir, 'branch', '-vv')
    result = []
    for line in stdout.splitlines():
        line = line.lstrip('* ').strip()
        if not line or line.startswith('(HEAD detached'):
            continue
        name = line.split()[0]
        if '[' not in line:
            result.append(name)
    return result


def _n(count, singular, plural=None):
    word = singular if count == 1 else (plural or singular + 's')
    return f"{count} {word}"


def format_status(s, unpushed, verbose):
    """Return a list of display lines for repo status."""
    total_staged   = s['staged_added'] + s['staged_modified'] + s['staged_deleted'] + s['staged_renamed']
    total_unstaged = s['unstaged_modified'] + s['unstaged_deleted']
    files_clean    = total_staged == 0 and total_unstaged == 0 and s['untracked'] == 0 and s['unmerged'] == 0
    sync_clean     = s['behind'] == 0 and s['ahead'] == 0

    if s['error']:
        return [f"  status:  (error: {s['error']})"]

    if files_clean and sync_clean and not unpushed:
        return ["  status:  (clean)"]

    if not verbose:
        parts = []
        if s['staged_added']:    parts.append(f"{s['staged_added']} new")
        if s['staged_modified']: parts.append(f"{s['staged_modified']} modified")
        if s['staged_deleted']:  parts.append(f"{s['staged_deleted']} deleted")
        if s['staged_renamed']:  parts.append(f"{s['staged_renamed']} renamed")
        if total_unstaged:       parts.append(f"{total_unstaged} unstaged")
        if s['untracked']:       parts.append(f"{s['untracked']} untracked")
        if s['unmerged']:        parts.append(f"{s['unmerged']} conflicts")
        flags = []
        if s['behind']:  flags.append(f"pull needed ({s['behind']} behind)")
        if s['ahead']:   flags.append(f"{_n(s['ahead'], 'commit')} to push")
        if unpushed:     flags.append(f"{_n(len(unpushed), 'branch', 'branches')} unpushed")
        file_str = ', '.join(parts) if parts else '(clean working tree)'
        flag_str = '  |  ' + ',  '.join(flags) if flags else ''
        return [f"  status:  {file_str}{flag_str}"]

    else:
        lines = ["  status:"]
        if total_staged:
            parts = []
            if s['staged_added']:    parts.append(f"{s['staged_added']} new")
            if s['staged_modified']: parts.append(f"{s['staged_modified']} modified")
            if s['staged_deleted']:  parts.append(f"{s['staged_deleted']} deleted")
            if s['staged_renamed']:  parts.append(f"{s['staged_renamed']} renamed")
            lines.append(f"    staged:    {', '.join(parts)}")
        if total_unstaged:
            parts = []
            if s['unstaged_modified']: parts.append(f"{s['unstaged_modified']} modified")
            if s['unstaged_deleted']:  parts.append(f"{s['unstaged_deleted']} deleted")
            lines.append(f"    unstaged:  {', '.join(parts)}")
        if s['untracked']:
            lines.append(f"    untracked: {_n(s['untracked'], 'file')}")
        if s['unmerged']:
            lines.append(f"    conflicts: {_n(s['unmerged'], 'file')}")
        if s['behind'] or s['ahead']:
            up = s['upstream'] or 'upstream'
            sync_parts = []
            if s['behind']: sync_parts.append(f"behind {s['behind']} (pull needed)")
            if s['ahead']:  sync_parts.append(f"ahead {s['ahead']} (push needed)")
            lines.append(f"    sync:      {up}  --  {', '.join(sync_parts)}")
        if unpushed:
            lines.append(f"    branches:  {', '.join(unpushed)} (no upstream)")
        return lines


def _fmt_bytes(n):
    """Format a byte count as a human-readable string (1024-based)."""
    for unit in ('B', 'KiB', 'MiB', 'GiB'):
        if n < 1024:
            return f"{n:.1f} {unit}" if unit != 'B' else f"{n} B"
        n /= 1024
    return f"{n:.1f} TiB"


def get_git_dir_size(git_dir):
    """Return total byte size of the .git directory by walking the filesystem."""
    git_path = os.path.join(git_dir, '.git')
    if not os.path.isdir(git_path):
        return None
    total = 0
    for dirpath, _, filenames in os.walk(git_path):
        for fname in filenames:
            try:
                total += os.path.getsize(os.path.join(dirpath, fname))
            except OSError:
                pass
    return total


def get_count_objects(git_dir):
    """Parse 'git count-objects -vH' into a dict. Returns None on error."""
    stdout, _, rc = run_git(git_dir, 'count-objects', '-vH')
    if rc != 0:
        return None
    stats = {}
    for line in stdout.splitlines():
        if ':' in line:
            key, _, val = line.partition(':')
            stats[key.strip()] = val.strip()
    return stats


def format_size(git_dir, verbose, total_bytes=None):
    """Return indented lines describing .git storage size."""
    if total_bytes is None:
        total_bytes = get_git_dir_size(git_dir)
    stats       = get_count_objects(git_dir)

    if total_bytes is None and stats is None:
        return ["  size:    (unavailable)"]

    total_str = _fmt_bytes(total_bytes) if total_bytes is not None else '?'
    pack_str  = stats.get('size-pack', '?') if stats else '?'
    loose_str = stats.get('size',      '?') if stats else '?'

    if not verbose:
        return [f"  size:    {total_str}  (pack: {pack_str},  loose: {loose_str})"]

    lines = [f"  size:    {total_str}  (.git directory)"]
    if stats:
        in_pack = stats.get('in-pack', '?')
        packs   = stats.get('packs',   '?')
        count   = stats.get('count',   '?')
        garbage = stats.get('size-garbage', '0 bytes')
        lines.append(f"    packed:  {pack_str}  ({in_pack} objects in {packs} pack(s))")
        lines.append(f"    loose:   {loose_str}  ({count} objects)")
        if garbage not in ('0 bytes', '0'):
            lines.append(f"    garbage: {garbage}")
    return lines


def get_last_tag(git_dir):
    """Return the name of the most recently created tag, or None."""
    stdout, _, _ = run_git(git_dir, 'for-each-ref',
                           '--sort=-creatordate',
                           '--format=%(refname:short)',
                           '--count=1',
                           'refs/tags')
    return stdout.strip() or None


def get_last_release(git_dir):
    """Return 'tagname  YYYY-MM-DD' for the most recently created tag, or None."""
    stdout, _, _ = run_git(git_dir, 'for-each-ref',
                           '--sort=-creatordate',
                           '--format=%(refname:short)  %(creatordate:short)',
                           '--count=1',
                           'refs/tags')
    return stdout.strip() or None


def get_contributors(git_dir):
    """Return a set of unique commit author names from the full git log."""
    stdout, _, rc = run_git(git_dir, 'log', '--format=%aN')
    if rc != 0:
        return set()
    return {name.strip() for name in stdout.splitlines() if name.strip()}


def get_current_git_user():
    """Return the configured git user.name, or None."""
    try:
        result = subprocess.run(['git', 'config', 'user.name'],
                                capture_output=True, text=True)
        return result.stdout.strip() or None
    except FileNotFoundError:
        return None


def get_remote_url(git_dir):
    """Return the origin remote URL, or None."""
    stdout, _, rc = run_git(git_dir, 'remote', 'get-url', 'origin')
    if rc != 0:
        return None
    return stdout.strip() or None


def get_remote_owner(git_dir):
    """Parse the origin remote URL and return the owner/org segment, or None."""
    stdout, _, rc = run_git(git_dir, 'remote', 'get-url', 'origin')
    if rc != 0:
        return None
    url = stdout.strip()
    if '://' in url:
        # https://host/owner/repo[.git]
        parts = url.split('/')
        return parts[3] if len(parts) > 3 else None
    elif ':' in url:
        # git@host:owner/repo[.git]
        path = url.split(':', 1)[1]
        parts = path.split('/')
        return parts[0] if parts else None
    return None


# ---------------------------------------------------------------------------
# --download command
# ---------------------------------------------------------------------------

def parse_github_url(url):
    """
    Parse a github.com URL into (owner, repo, ref, path, is_blob).

    Supports:
      https://github.com/OWNER/REPO
      https://github.com/OWNER/REPO/tree/REF[/PATH]
      https://github.com/OWNER/REPO/blob/REF/PATH

    Branch names containing '/' aren't disambiguated from path segments;
    the first segment after tree/blob is taken as the ref.
    Returns None if the URL isn't recognized.
    """
    m = re.match(
        r'^https?://github\.com/([^/]+)/([^/]+?)(?:\.git)?'
        r'(?:/(tree|blob)/([^/]+)(?:/(.*))?)?/?$',
        url.strip(),
    )
    if not m:
        return None
    owner, repo, kind, ref, path = m.groups()
    path = (path or '').rstrip('/')
    is_blob = (kind == 'blob')
    return owner, repo, ref or 'HEAD', path, is_blob


def _github_headers(token):
    headers = {'Accept': 'application/vnd.github+json', 'User-Agent': 'git-tool'}
    if token:
        headers['Authorization'] = f'token {token}'
    return headers


def _urlopen_with_retry(req, retries=3, backoff=1.5, timeout=20):
    """
    Open req, retrying transient failures (connection reset, timeout, 5xx).
    Real API errors (4xx) are raised immediately, not retried.
    """
    last_err = None
    for attempt in range(retries):
        try:
            return urllib.request.urlopen(req, timeout=timeout)
        except urllib.error.HTTPError as e:
            if e.code < 500 or attempt == retries - 1:
                raise
            last_err = e
        except urllib.error.URLError as e:
            if attempt == retries - 1:
                raise
            last_err = e
        time.sleep(backoff * (attempt + 1))
    raise last_err


def github_api_get(url, token):
    """GET a GitHub API URL and return parsed JSON, or raise RuntimeError."""
    req = urllib.request.Request(url, headers=_github_headers(token))
    try:
        with _urlopen_with_retry(req) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        try:
            message = json.loads(body).get('message', '').strip()
        except ValueError:
            message = ''
        hint = ''
        if e.code == 403 and 'rate limit' in body.lower():
            hint = ' (try --token to raise the rate limit)'
        elif e.code == 404:
            hint = ' (check the URL/ref/path, or use --token for a private repo)'
        detail = f": {message}" if message else ''
        raise RuntimeError(f"GitHub API error {e.code} for {url}{hint}{detail}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"Network error fetching {url}: {e.reason}") from e


def github_fetch_bytes(url, token):
    """GET a URL and return raw bytes (used for contents-API download_url links)."""
    req = urllib.request.Request(url, headers=_github_headers(token))
    with _urlopen_with_retry(req) as resp:
        return resp.read()


def _write_file_entry(entry, dest_path, token):
    """Write a single contents-API file entry (base64 content or download_url) to disk."""
    if entry.get('content'):
        data = base64.b64decode(entry['content'])
    elif entry.get('download_url'):
        data = github_fetch_bytes(entry['download_url'], token)
    else:
        raise RuntimeError(f"no content available for {entry.get('path')}")
    os.makedirs(os.path.dirname(dest_path) or '.', exist_ok=True)
    with open(dest_path, 'wb') as f:
        f.write(data)


def _matches_filters(rel_path, include, exclude):
    """Return True if rel_path passes the --include/--exclude glob filters."""
    name = os.path.basename(rel_path)
    if include and not any(fnmatch.fnmatch(name, p) or fnmatch.fnmatch(rel_path, p) for p in include):
        return False
    if exclude and any(fnmatch.fnmatch(name, p) or fnmatch.fnmatch(rel_path, p) for p in exclude):
        return False
    return True


def _download_contents(owner, repo, ref, path, dest_dir, token, recursive, include, exclude, base_path, stats):
    """List `path` via the contents API and download matching files into dest_dir."""
    api_url = f'https://api.github.com/repos/{owner}/{repo}/contents/{path}?ref={ref}'
    listing = github_api_get(api_url, token)
    if isinstance(listing, dict):
        listing = [listing]

    for entry in sorted(listing, key=lambda e: e['name'].lower()):
        rel = entry['path'][len(base_path):].lstrip('/') if base_path else entry['path']

        if entry['type'] == 'dir':
            if not recursive:
                print(f"  skip  {entry['path']}/  (directory; use --recursive to descend)")
                stats['skipped'] += 1
                continue
            _download_contents(owner, repo, ref, entry['path'], dest_dir,
                               token, recursive, include, exclude, base_path, stats)
        elif entry['type'] == 'file':
            if not _matches_filters(rel, include, exclude):
                stats['skipped'] += 1
                continue
            file_entry = github_api_get(entry['url'], token)
            dest_path = os.path.join(dest_dir, rel)
            _write_file_entry(file_entry, dest_path, token)
            print(f"  {dest_path}")
            stats['downloaded'] += 1
        else:
            stats['skipped'] += 1


def download_github_file(owner, repo, ref, path, output, token):
    """Download a single file. Returns (downloaded, skipped) counts."""
    api_url = f'https://api.github.com/repos/{owner}/{repo}/contents/{path}?ref={ref}'
    entry = github_api_get(api_url, token)
    if isinstance(entry, list):
        raise RuntimeError(f"{path} is a directory; use a tree URL (and --recursive) instead")

    dest = output
    if not dest:
        dest = os.path.basename(path)
    elif os.path.isdir(dest):
        dest = os.path.join(dest, os.path.basename(path))

    _write_file_entry(entry, dest, token)
    print(dest)
    return 1, 0


def download_github_dir(owner, repo, ref, path, output, token, recursive, include, exclude):
    """Download a directory (optionally recursive). Returns (downloaded, skipped) counts."""
    dest_dir = output or (os.path.basename(path) if path else repo)
    stats = {'downloaded': 0, 'skipped': 0}
    _download_contents(owner, repo, ref, path, dest_dir, token, recursive, include, exclude, path, stats)
    return stats['downloaded'], stats['skipped']


def parse_github_owner(s):
    """
    Parse a github.com owner out of a base URL or bare name.

    Accepts 'github.com/OWNER', 'https://github.com/OWNER', or a bare 'OWNER'.
    Returns None if the string doesn't look like a valid owner.
    """
    s = s.strip().rstrip('/')
    m = re.match(r'^(?:https?://)?github\.com/([^/]+)$', s)
    if m:
        return m.group(1)
    if re.match(r'^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$', s):
        return s
    return None


def _github_list_all(url_base, token):
    """GET a paginated GitHub list endpoint, returning the combined JSON array."""
    results = []
    page = 1
    while True:
        sep = '&' if '?' in url_base else '?'
        batch = github_api_get(f'{url_base}{sep}per_page=100&page={page}', token)
        results.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return results


def list_github_repos(owner, token):
    """Return repo dicts for a GitHub user or org, sorted by name. Tries /users then /orgs."""
    try:
        repos = _github_list_all(f'https://api.github.com/users/{owner}/repos', token)
    except RuntimeError as e:
        if '404' not in str(e):
            raise
        repos = _github_list_all(f'https://api.github.com/orgs/{owner}/repos', token)
    return sorted(repos, key=lambda r: r['name'].lower())


def cmd_list_repos(args):
    """List repos for --host, optionally filtered by a --repo-list regex. Returns a process exit code."""
    owner = parse_github_owner(args.host)
    if owner is None:
        print(f"Error: could not parse an owner from '{args.host}' "
              f"(expected e.g. 'github.com/OWNER' or 'OWNER')", file=sys.stderr)
        return 1
    token = args.token or os.environ.get('GITHUB_TOKEN')

    pattern = None
    if args.repo_list:
        try:
            pattern = re.compile(args.repo_list, re.IGNORECASE)
        except re.error as e:
            print(f"Error: invalid pattern '{args.repo_list}': {e}", file=sys.stderr)
            return 1

    try:
        repos = list_github_repos(owner, token)
    except RuntimeError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

    if pattern:
        repos = [r for r in repos if pattern.search(r['name'])]

    if not repos:
        print(f"No repositories found for '{owner}'.")
        return 0

    for r in repos:
        flags = []
        if r.get('private'):  flags.append('private')
        if r.get('fork'):     flags.append('fork')
        if r.get('archived'): flags.append('archived')
        flag_str = f"  [{', '.join(flags)}]" if flags else ''
        print(f"{r['full_name']}{flag_str}")

    n = len(repos)
    print(f"\n{n} repositor{'ies' if n != 1 else 'y'} for {owner}.")
    return 0


def _clone_url_with_token(clone_url, token):
    """Embed an auth token into an https clone URL, if given."""
    if token and clone_url.startswith('https://'):
        return clone_url.replace('https://', f'https://{token}@', 1)
    return clone_url


def cmd_repo_clone(args):
    """Clone repos from --host whose name matches any --repo-clone pattern; skip existing dirs."""
    owner = parse_github_owner(args.host)
    if owner is None:
        print(f"Error: could not parse an owner from '{args.host}' "
              f"(expected e.g. 'github.com/OWNER' or 'OWNER')", file=sys.stderr)
        return 1
    token = args.token or os.environ.get('GITHUB_TOKEN')

    patterns = []
    for p in args.repo_clone:
        try:
            patterns.append(re.compile(p, re.IGNORECASE))
        except re.error as e:
            print(f"Warning: invalid pattern '{p}': {e}", file=sys.stderr)

    if not patterns:
        print("Error: no valid --repo-clone patterns given", file=sys.stderr)
        return 1

    try:
        repos = list_github_repos(owner, token)
    except RuntimeError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

    matched = [r for r in repos if any(pat.search(r['name']) for pat in patterns)]

    if not matched:
        print(f"No repositories for '{owner}' matched the given pattern(s).")
        return 0

    cloned = skipped = errors = 0
    for r in matched:
        name = r['name']
        if os.path.exists(name):
            print(f"  skip  {name}  (directory already exists)")
            skipped += 1
            continue

        clone_url = _clone_url_with_token(r['clone_url'], token)
        print(f"clone  {name}")
        result = subprocess.run(['git', 'clone', clone_url, name], capture_output=True, text=True)
        if result.returncode != 0:
            print(f"  ERROR: {result.stderr.strip()}", file=sys.stderr)
            errors += 1
        else:
            cloned += 1
        print()

    print(f"Cloned {cloned} repo(s); skipped {skipped}; errors {errors}.")
    return 1 if errors else 0


def cmd_download(args):
    """Download a file or directory tree from a github.com URL. Returns a process exit code."""
    parsed = parse_github_url(args.download)
    if parsed is None:
        print(f"Error: not a recognized github.com URL: {args.download}", file=sys.stderr)
        return 1
    owner, repo, ref, path, is_blob = parsed
    token = args.token or os.environ.get('GITHUB_TOKEN')

    try:
        if is_blob:
            downloaded, skipped = download_github_file(owner, repo, ref, path, args.output, token)
        else:
            downloaded, skipped = download_github_dir(
                owner, repo, ref, path, args.output, token,
                args.recursive, args.include, args.exclude,
            )
    except RuntimeError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

    print(f"\nDownloaded {downloaded} file(s); skipped {skipped}.")
    return 0


# ---------------------------------------------------------------------------
# Summary collector
# ---------------------------------------------------------------------------

class SummaryCollector:
    """Accumulate per-repo statistics for the end-of-run summary report."""

    def __init__(self, repos_found, current_user=None):
        self.repos_found     = repos_found
        self.current_user    = current_user
        self.repos_processed = 0
        self.total_size_bytes  = 0
        self.largest_path    = None
        self.largest_bytes   = 0
        self.cnt_clean       = 0
        self.cnt_error       = 0
        self.cnt_pending     = 0
        self.cnt_behind      = 0
        self.cnt_main        = 0
        self.cnt_master      = 0
        self.cnt_with_tag    = 0
        self.cnt_without_tag = 0
        self.cnt_with_release    = 0
        self.cnt_without_release = 0
        self.contributors    = set()
        self.other_owned     = []   # [(repo_basename, owner)] where current user is contributor

    def record(self, path, branch, status, unpushed, tag, release, size_bytes, contributors=None, repo_owner=None):
        self.repos_processed += 1

        if size_bytes is not None:
            self.total_size_bytes += size_bytes
            if size_bytes > self.largest_bytes:
                self.largest_bytes = size_bytes
                self.largest_path  = path

        if status is not None:
            if status['error']:
                self.cnt_error += 1
            else:
                total_staged   = (status['staged_added'] + status['staged_modified'] +
                                  status['staged_deleted'] + status['staged_renamed'])
                total_unstaged = status['unstaged_modified'] + status['unstaged_deleted']
                has_local      = (total_staged > 0 or total_unstaged > 0 or
                                  status['untracked'] > 0 or status['unmerged'] > 0 or
                                  status['ahead'] > 0 or bool(unpushed))
                is_behind      = status['behind'] > 0
                if not has_local and not is_behind:
                    self.cnt_clean += 1
                if has_local:
                    self.cnt_pending += 1
                if is_behind:
                    self.cnt_behind += 1

        if branch is not None:
            if branch == 'main':
                self.cnt_main += 1
            elif branch == 'master':
                self.cnt_master += 1

        if tag is not None:
            self.cnt_with_tag += 1
        else:
            self.cnt_without_tag += 1

        if release is not None:
            self.cnt_with_release += 1
        else:
            self.cnt_without_release += 1

        if contributors:
            self.contributors.update(contributors)
            if self.current_user and repo_owner:
                user_lc  = self.current_user.lower()
                owner_lc = repo_owner.lower()
                is_contributor = any(c.lower() == user_lc for c in contributors)
                if is_contributor and owner_lc != user_lc:
                    self.other_owned.append((os.path.basename(path), repo_owner))


def print_summary_report(c):
    """Print the end-of-run summary collected by a SummaryCollector."""
    sep = '=' * 60
    partial = c.repos_processed < c.repos_found
    repo_label = 'repo' if c.repos_found == 1 else 'repos'
    if partial:
        header = f"Summary  ({c.repos_processed} of {c.repos_found} {repo_label} scanned)"
    else:
        header = f"Summary  ({c.repos_found} {repo_label})"

    print(f"\n{sep}")
    print(header)
    print(sep)

    # Size
    print(f"  Total .git size:       {_fmt_bytes(c.total_size_bytes)}")
    if c.largest_path:
        name = os.path.basename(c.largest_path)
        print(f"  Largest repo:          {name}  ({_fmt_bytes(c.largest_bytes)})")
    print()

    # Status counts
    print(f"  Status:")
    print(f"    Clean:               {c.cnt_clean}")
    print(f"    Error:               {c.cnt_error}")
    print(f"    Pending changes:     {c.cnt_pending}")
    print(f"    Behind (need pull):  {c.cnt_behind}")
    print()

    # Branch counts
    other_branch = c.repos_processed - c.cnt_main - c.cnt_master
    print(f"  Branch:")
    print(f"    main:                {c.cnt_main}")
    print(f"    master:              {c.cnt_master}")
    if other_branch > 0:
        print(f"    other:               {other_branch}")
    print()

    # Tag counts
    print(f"  Tags:")
    print(f"    With tag:            {c.cnt_with_tag}")
    print(f"    Without tag:         {c.cnt_without_tag}")
    print()

    # Release counts
    print(f"  Releases:")
    print(f"    With release:        {c.cnt_with_release}")
    print(f"    Without release:     {c.cnt_without_release}")
    print()

    # Contributors
    if c.contributors:
        csv = ', '.join(sorted(c.contributors, key=str.lower))
        print(f"  Contributors:          {csv}")
    else:
        print(f"  Contributors:          (none found)")

    # Repos where current user is a contributor but doesn't own the repo
    if c.other_owned:
        csv = ', '.join(f"{name} ({owner})" for name, owner in sorted(c.other_owned))
        print(f"  Contrib. to others:    {csv}")
    print(sep)


# ---------------------------------------------------------------------------
# --main command
# ---------------------------------------------------------------------------

def cmd_rename_to_main(git_dirs, args):
    """Rename master -> main where master exists and main does not."""
    dry = args.dry_run
    tag = "[dry-run] " if dry else ""
    changed = skipped = errors = 0
    remote_updated = False

    for d in git_dirs:
        master_out, _, _ = run_git(d, 'branch', '--list', 'master')
        main_out,   _, _ = run_git(d, 'branch', '--list', 'main')

        has_master = bool(master_out.strip())
        has_main   = bool(main_out.strip())

        if not has_master:
            print(f"  skip  {d}  (no master branch)")
            skipped += 1
            continue
        if has_main:
            print(f"  skip  {d}  (main already exists)")
            skipped += 1
            continue

        # Inspect remote state before touching anything
        remote_out, _, _ = run_git(d, 'remote')
        has_origin = 'origin' in remote_out.split()
        has_remote_master = False
        if has_origin:
            ls_out, _, _ = run_git(d, 'ls-remote', '--heads', 'origin', 'master')
            has_remote_master = bool(ls_out.strip())

        # Print what will (or would) happen
        print(f"{tag}rename  {d}")
        print(f"{tag}  local:  master -> main")
        if has_origin and has_remote_master:
            print(f"{tag}  remote: push origin/main, delete origin/master")
        elif has_origin:
            print(f"{tag}  remote: origin/master not present, skipping remote update")
        else:
            print(f"{tag}  remote: no origin configured")

        if dry:
            changed += 1
            print()
            continue

        # Local rename
        _, stderr, rc = run_git(d, 'branch', '-m', 'master', 'main')
        if rc != 0:
            print(f"  ERROR local rename: {stderr.strip()}", file=sys.stderr)
            errors += 1
            print()
            continue

        # Remote update
        if has_origin and has_remote_master:
            _, stderr, rc = run_git(d, 'push', '--set-upstream', 'origin', 'main')
            if rc != 0:
                print(f"  ERROR push origin/main: {stderr.strip()}", file=sys.stderr)
                errors += 1
                print()
                continue
            _, stderr, rc = run_git(d, 'push', 'origin', '--delete', 'master')
            if rc != 0:
                print(f"  ERROR delete origin/master: {stderr.strip()}", file=sys.stderr)
                errors += 1
                print()
                continue
            remote_updated = True

        changed += 1
        print()

    action = "Would rename" if dry else "Renamed"
    print(f"{action} {changed} repo(s); skipped {skipped}; errors {errors}.")
    if remote_updated and not dry:
        print("Note: if the remote's default branch was master, update it in your")
        print("      hosting service (GitHub/GitLab Settings → Default Branch).")


# ---------------------------------------------------------------------------
# --delete-branch command
# ---------------------------------------------------------------------------

def branch_exists_local(git_dir, branch):
    """Return True if branch exists as a local branch."""
    out, _, _ = run_git(git_dir, 'branch', '--list', branch)
    return bool(out.strip())


def branch_exists_remote(git_dir, branch, remote='origin'):
    """Return True if branch exists on remote."""
    out, _, _ = run_git(git_dir, 'ls-remote', '--heads', remote, branch)
    return bool(out.strip())


def branch_is_merged(git_dir, branch):
    """Return True if branch has been merged into the current HEAD."""
    _, _, rc = run_git(git_dir, 'merge-base', '--is-ancestor', branch, 'HEAD')
    return rc == 0


def cmd_delete_branch(git_dirs, args):
    """Delete a branch both locally and on the remote, after confirmation."""
    branch = args.delete_branch
    dry = args.dry_run
    deleted = skipped = errors = 0

    for d in git_dirs:
        remote_out, _, _ = run_git(d, 'remote')
        has_origin = 'origin' in remote_out.split()

        if has_origin:
            _, stderr, rc = run_git(d, 'fetch', '--all', '--prune')
            if rc != 0:
                print(f"  WARNING  {d}  (fetch --all --prune failed: {stderr.strip()})",
                      file=sys.stderr)

        has_local  = branch_exists_local(d, branch)
        has_remote = has_origin and branch_exists_remote(d, branch)

        if not has_local and not has_remote:
            skipped += 1
            continue

        if get_branch(d) == branch:
            print(f"  skip  {d}  (branch '{branch}' is currently checked out)")
            skipped += 1
            continue

        merged = branch_is_merged(d, branch) if has_local else None
        merged_str = ('merged' if merged else 'NOT merged') if merged is not None else 'unknown'
        merged_disp = _c(merged_str, _GREEN) if merged else merged_str

        where = []
        if has_local:  where.append('local')
        if has_remote: where.append('remote')

        print(d)
        print(f"  branch:  {branch}  ({', '.join(where)})  [{merged_disp}]")

        if dry:
            print(f"  [dry-run] would delete {', '.join(where)}")
            print()
            deleted += 1
            continue

        reply = input(f"  Delete branch '{branch}' ({', '.join(where)}, {merged_disp})? [y/N] ").strip().lower()
        if reply != 'y':
            print("  skipped")
            print()
            skipped += 1
            continue

        ok = True
        if has_local:
            _, stderr, rc = run_git(d, 'branch', '-D', branch)
            if rc != 0:
                print(f"  ERROR (local delete): {stderr.strip()}", file=sys.stderr)
                errors += 1
                ok = False
            else:
                print(f"  deleted local branch '{branch}'")

        if ok and has_remote:
            _, stderr, rc = run_git(d, 'push', 'origin', '--delete', branch)
            if rc != 0:
                print(f"  ERROR (remote delete): {stderr.strip()}", file=sys.stderr)
                errors += 1
                ok = False
            else:
                print(f"  deleted remote branch 'origin/{branch}'")

        if ok:
            deleted += 1
        print()

    if dry:
        print(f"Would delete branch '{branch}' in {deleted} repo(s); {skipped} skipped.")
    else:
        print(f"Deleted branch '{branch}' in {deleted} repo(s); {skipped} skipped; {errors} errors.")


# ---------------------------------------------------------------------------
# --clean command
# ---------------------------------------------------------------------------

def cmd_clean(git_dirs, args):
    """Run fetch --prune, worktree prune, and gc --auto on each repo."""
    dry = args.dry_run
    ran = updated = skipped = errors = 0

    for d in git_dirs:
        remote_out, _, _ = run_git(d, 'remote')
        has_remote = bool(remote_out.strip())

        if dry:
            lines = []

            # fetch: preview stale remote refs (no dry-run for new commits)
            if has_remote:
                prune_out, _, _ = run_git(d, 'remote', 'prune', '--dry-run', 'origin')
                stale = [l.strip() for l in prune_out.splitlines() if 'would prune' in l]
                if stale:
                    lines.append(f"  fetch:    " + stale[0])
                    for l in stale[1:]:
                        lines.append(f"            {l}")
                else:
                    lines.append(f"  fetch:    (no stale refs; new commits require an actual fetch)")
            else:
                lines.append(f"  fetch:    skipped (no remote)")

            # worktree prune: has a real --dry-run
            wt_out, _, _ = run_git(d, 'worktree', 'prune', '--dry-run')
            wt_lines = [l.strip() for l in wt_out.splitlines() if l.strip()]
            if wt_lines:
                lines.append(f"  worktree: " + wt_lines[0])
                for l in wt_lines[1:]:
                    lines.append(f"            {l}")
            else:
                lines.append(f"  worktree: (nothing to prune)")

            # gc --auto: no dry-run available
            lines.append(f"  gc:       would run if internal thresholds are met")

            print(f"[dry-run] clean  {d}")
            for l in lines:
                print(l)
            print()
            ran += 1
            continue

        # --- actual run ---
        repo_lines = []
        ok = True

        if has_remote:
            stdout, stderr, rc = run_git(d, 'fetch', '--prune')
            if rc != 0:
                print(f"ERROR clean (fetch)  {d}\n  {stderr.strip()}", file=sys.stderr)
                errors += 1
                ok = False
            else:
                out = (stdout + stderr).strip()
                if out:
                    repo_lines.append("  [fetch]")
                    repo_lines.extend(f"    {l}" for l in out.splitlines())

        if ok:
            wt_out, _, _ = run_git(d, 'worktree', 'prune')
            out = wt_out.strip()
            if out:
                repo_lines.append("  [worktree prune]")
                repo_lines.extend(f"    {l}" for l in out.splitlines())

            gc_out, gc_err, _ = run_git(d, 'gc', '--auto', '--quiet')
            out = (gc_out + gc_err).strip()
            if out:
                repo_lines.append("  [gc]")
                repo_lines.extend(f"    {l}" for l in out.splitlines())

            ran += 1
            if repo_lines:
                print(f"clean  {d}")
                for l in repo_lines:
                    print(l)
                print()
                updated += 1
            # else: all quiet — suppress

    if dry:
        print(f"Would clean {ran} repo(s); {skipped} suppressed (no remote).")
    else:
        print(f"Cleaned {ran} repo(s) ({updated} had output); "
              f"{errors} errors.")


# ---------------------------------------------------------------------------
# --tag-list command
# ---------------------------------------------------------------------------

def cmd_tag_list(git_dirs, args):
    """List every tag (newest first) with its date and a matching line from a file at that tag."""
    tag_file = args.tag_file
    tag_text = args.tag_text

    for d in git_dirs:
        tags_out, _, _ = run_git(d, 'tag', '-l', '--sort=-creatordate')
        tags = tags_out.split()
        print(f"tags  {d}")
        print(f"{'TAG NAME':<20} | {'DATE':<12} | {tag_text} ({tag_file})")
        print('-' * 65)
        if not tags:
            print("(no tags)\n")
            continue
        for tag in tags:
            date_out, _, _ = run_git(d, 'log', '-1', '--format=%cd', '--date=short', tag)
            grep_out, _, _ = run_git(d, 'grep', '-h', '-F', tag_text, tag, '--', tag_file)
            lines = grep_out.strip().splitlines()
            version_line = ' '.join(lines[0].split()) if lines else "[Not found / File missing]"
            print(f"{tag:<20} | {date_out.strip():<12} | {version_line}")
        print()


# ---------------------------------------------------------------------------
# --branch-details command
# ---------------------------------------------------------------------------

def parse_github_remote(url):
    """Return (owner, repo) for a github.com https/ssh remote URL, else None."""
    if not url:
        return None
    m = re.match(r'^(?:https?://(?:[^@/]+@)?|ssh://git@|git@)github\.com[:/]([^/]+)/([^/]+?)(?:\.git)?/?$',
                 url.strip())
    return (m.group(1), m.group(2)) if m else None


def get_default_branch(git_dir):
    """Return (ref, short_name) of the default branch, e.g. ('origin/main', 'main')."""
    out, _, rc = run_git(git_dir, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD')
    if rc == 0 and out.strip():
        ref = out.strip()
        return ref, ref.split('/', 1)[1]
    for name in ('main', 'master'):
        for ref in (f'origin/{name}', name):
            _, _, rc = run_git(git_dir, 'rev-parse', '--verify', '--quiet', ref)
            if rc == 0:
                return ref, name
    cur = get_branch(git_dir)
    return cur, cur


def get_pull_requests(git_dir, token, warnings=None):
    """
    Return {head_branch_name: (number, state, base_branch, head_sha)} for PRs on the github.com
    origin. state is 'open', 'merged', or 'closed'. Uses the GitHub API when a token is
    available, else the gh CLI, else the unauthenticated API (public repos).
    Returns None if the remote isn't on GitHub or PRs couldn't be fetched.
    """
    gh = parse_github_remote(get_remote_url(git_dir))
    if not gh:
        return None
    owner, repo = gh
    prs = []   # (branch, head_owner, number, state, base_branch, head_sha)

    def _from_api():
        items = _github_list_all(f'https://api.github.com/repos/{owner}/{repo}/pulls?state=all', token)
        for p in items:
            head = p.get('head') or {}
            head_owner = ((head.get('repo') or {}).get('owner') or {}).get('login')
            state = 'merged' if p.get('merged_at') else p.get('state', '')
            prs.append((head.get('ref'), head_owner, p['number'], state,
                        (p.get('base') or {}).get('ref', '?'), head.get('sha')))

    def _from_gh():
        result = subprocess.run(
            ['gh', 'pr', 'list', '--repo', f'{owner}/{repo}', '--state', 'all', '--limit', '1000',
             '--json', 'number,state,headRefName,headRepositoryOwner,baseRefName,headRefOid'],
            capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(result.stderr.strip())
        for p in json.loads(result.stdout or '[]'):
            head_owner = (p.get('headRepositoryOwner') or {}).get('login')
            prs.append((p['headRefName'], head_owner, p['number'], p['state'].lower(),
                        p.get('baseRefName') or '?', p.get('headRefOid')))

    try:
        if token:
            _from_api()
        else:
            try:
                _from_gh()
            except (FileNotFoundError, RuntimeError, ValueError):
                prs.clear()
                _from_api()
    except (RuntimeError, ValueError) as e:
        msg = f"  WARNING  {git_dir}  (could not fetch pull requests: {e})"
        if warnings is not None:
            warnings.append(msg)
        else:
            print(msg, file=sys.stderr)
        return None

    # Prefer open > merged > closed, then the newest PR number.
    rank = {'open': 2, 'merged': 1, 'closed': 0}
    result = {}
    for branch, head_owner, number, state, base, head_sha in prs:
        if not branch or (head_owner and head_owner.lower() != owner.lower()):
            continue   # skip PRs from forks
        best = result.get(branch)
        if best is None or (rank.get(state, -1), number) > (rank.get(best[1], -1), best[0]):
            result[branch] = (number, state, base, head_sha)
    return result


def _branch_state(name, is_current, is_merged, ahead, default_name, prs):
    """Return (state_text, color) - one mutually exclusive merge/PR/delete state."""
    if name == default_name:
        return 'default', None
    if is_current:
        return 'checked out', _YELLOW
    pr = prs.get(name) if prs else None
    if pr and pr[1] == 'open':
        return f'PR #{pr[0]} open -> {pr[2]}', _YELLOW
    if is_merged:
        return 'merged - safe to delete', _GREEN
    if pr and pr[1] == 'merged':
        return f'PR #{pr[0]} merged -> {pr[2]} - safe to delete', _GREEN
    if pr and pr[1] == 'closed':
        return f'PR #{pr[0]} closed (-> {pr[2]}), unmerged (+{ahead})', _RED
    return f'unmerged (+{ahead})', _RED


def _list_branch_refs(git_dir, default_ref):
    """
    Return [(full, short, date, tip_author, ahead_or_None)] for all local + remote
    branches, newest first. ahead comes from one batched %(ahead-behind:...) call
    (git 2.41+); on older git it is None and must be computed per branch.
    """
    base_fmt = '%(refname)\t%(refname:short)\t%(committerdate:short)\t%(authorname)'
    out, _, rc = run_git(git_dir, 'for-each-ref', '--sort=-committerdate',
                         f'--format={base_fmt}\t%(ahead-behind:{default_ref})',
                         'refs/heads', 'refs/remotes')
    has_ahead = rc == 0
    if not has_ahead:
        out, _, _ = run_git(git_dir, 'for-each-ref', '--sort=-committerdate',
                            f'--format={base_fmt}', 'refs/heads', 'refs/remotes')
    refs = []
    for line in out.splitlines():
        parts = line.split('\t')
        if len(parts) < 4 or parts[0].endswith('/HEAD'):
            continue
        ahead = None
        if has_ahead and len(parts) > 4 and parts[4].split():
            ahead = parts[4].split()[0]
        refs.append((parts[0], parts[1], parts[2], parts[3], ahead))
    return refs


def _branch_owner(git_dir, default_ref, full, tip_author):
    """Author of the oldest commit unique to this branch, else the tip author."""
    log_out, _, _ = run_git(git_dir, 'log', '--reverse', '--format=%an', f'{default_ref}..{full}')
    first = log_out.split('\n', 1)[0].strip()
    return first or tip_author


def _branch_details_repo(d, token, pool):
    """Build the --branch-details report for one repo. Returns (report_text, warnings)."""
    warnings = []
    remote_out, _, _ = run_git(d, 'remote')
    has_remote = bool(remote_out.strip())

    # The PR lookup is network-bound and independent of the fetch; run it alongside.
    pr_future = pool.submit(get_pull_requests, d, token, warnings) if has_remote else None
    if has_remote:
        _, stderr, rc = run_git(d, 'fetch', '--all', '--prune', '--quiet')
        if rc != 0:
            warnings.append(f"  WARNING  {d}  (fetch --all --prune failed: {stderr.strip()})")

    default_ref, default_name = get_default_branch(d)
    current = get_branch(d)
    refs = _list_branch_refs(d, default_ref)
    merged_out, _, _ = run_git(d, 'for-each-ref', '--format=%(refname)',
                               f'--merged={default_ref}', 'refs/heads', 'refs/remotes')
    merged = set(merged_out.split())

    # Per-branch git work (owner, and ahead count on old git) only for unmerged branches.
    jobs = {}
    for full, short, date, tip_author, ahead in refs:
        is_remote = full.startswith('refs/remotes/')
        name = short.split('/', 1)[1] if is_remote and '/' in short else short
        if name == default_name or full in merged:
            continue
        jobs[full] = (pool.submit(_branch_owner, d, default_ref, full, tip_author),
                      None if ahead is not None else
                      pool.submit(run_git, d, 'rev-list', '--count', f'{default_ref}..{full}'))

    prs = pr_future.result() if pr_future else None

    rows = []
    for full, short, date, tip_author, ahead in refs:
        is_remote = full.startswith('refs/remotes/')
        name = short.split('/', 1)[1] if is_remote and '/' in short else short
        owner = tip_author
        if full in jobs:
            owner_f, ahead_f = jobs[full]
            owner = owner_f.result()
            if ahead_f is not None:
                ahead = ahead_f.result()[0].strip() or '?'
        state, color = _branch_state(name, (not is_remote and short == current),
                                     full in merged, ahead or '?', default_name, prs)
        rows.append(('remote' if is_remote else 'local', short, owner, date, state, color))

    rows.sort(key=lambda r: (r[0] != 'local',))   # local first; date order kept within

    lines = [f"branches  {d}  (default: {default_ref}"
             + ('' if prs is not None or not has_remote else ', PR info unavailable') + ')']
    if not rows:
        lines.append("(no branches)")
    else:
        headers = ('WHERE', 'BRANCH', 'OWNER', 'LAST CHANGE', 'STATE')
        widths = [max(len(headers[i]), *(len(r[i]) for r in rows)) for i in range(4)]
        fmt = '  '.join(f'{{:<{w}}}' for w in widths)
        lines.append(fmt.format(*headers[:4]) + '  ' + headers[4])
        lines.append('-' * (sum(widths) + 2 * 4 + max(len(headers[4]), *(len(r[4]) for r in rows))))
        for where, short, owner, date, state, color in rows:
            lines.append(fmt.format(where, short, owner, date) + '  '
                         + (_c(state, color) if color else state))
    return '\n'.join(lines) + '\n', warnings


def cmd_branch_details(git_dirs, args):
    """Report owner, last-change date, and merged/PR/safe-to-delete state of every branch."""
    token = args.token or os.environ.get('GITHUB_TOKEN')
    jobs = max(1, args.jobs)
    # Two pools: repo-level tasks block waiting on per-branch tasks, so they must
    # not share a pool (that could deadlock once every worker is a waiting repo).
    repo_pool = ThreadPoolExecutor(max_workers=jobs)
    work_pool = ThreadPoolExecutor(max_workers=jobs)
    try:
        futures = [repo_pool.submit(_branch_details_repo, d, token, work_pool) for d in git_dirs]
        # Print in input order; each repo prints as soon as it and all earlier repos finish.
        for f in futures:
            report, warnings = f.result()
            for w in warnings:
                print(w, file=sys.stderr)
            print(report)
    finally:
        repo_pool.shutdown(wait=False, cancel_futures=True)
        work_pool.shutdown(wait=False, cancel_futures=True)


# ---------------------------------------------------------------------------
# --delete-merged command
# ---------------------------------------------------------------------------

# Branch names never deleted by --delete-merged, whatever their merge state.
PROTECTED_BRANCHES = ('main', 'master', 'develop', 'development', 'release', 'release/*')

# Listed first in the "Merged elsewhere" MERGED INTO column.
LONG_LIVED_BRANCHES = PROTECTED_BRANCHES + ('dev_*',)

# A containing branch named <branch> + one of these is treated as a fast-forward copy
# of the same work, not as a real "merged into" target.
FF_COPY_SUFFIXES = ('_main', '_dev')

MERGED_INTO_MAX_NAMES = 3


def _worktree_branches(git_dir):
    """Return the set of local branch names checked out in any worktree."""
    out, _, _ = run_git(git_dir, 'worktree', 'list', '--porcelain')
    prefix = 'branch refs/heads/'
    return {line[len(prefix):] for line in out.splitlines() if line.startswith(prefix)}


def _owner_matches(owner_filter, name, email):
    """
    Case-insensitive match of --owner against the author name or email.
    A filter containing glob characters (* ? [) is a glob; otherwise a substring.
    """
    f = owner_filter.lower()
    fields = (name.lower(), email.lower())
    if any(ch in f for ch in '*?['):
        return any(fnmatch.fnmatchcase(v, f) for v in fields)
    return any(f in v for v in fields)


def _merged_candidates(d, pattern, include_pr, token, warnings, local_only=False, owner_filter=None):
    """
    Find merged branches in one repo.
    Returns (default_ref, {name: {'local': (reason, owner)|None, 'remote': ...}}, protected_hits, keep)
    or (None, None, reason_skipped, None). owner is the author of the branch tip commit;
    keep is the set of default/current/worktree branch names that are never deleted.
    """
    default_ref, default_name = get_default_branch(d)
    current = get_branch(d)
    _, _, rc = run_git(d, 'rev-parse', '--verify', '--quiet', 'refs/remotes/origin/HEAD')
    if rc != 0 and default_name not in ('main', 'master'):
        return None, None, 'cannot determine the default branch', None

    keep = {default_name, current} | _worktree_branches(d)

    scopes = ['refs/heads'] if local_only else ['refs/heads', 'refs/remotes/origin']
    out, _, _ = run_git(d, 'for-each-ref',
                        '--format=%(refname)\t%(objectname)\t%(authorname)\t%(authoremail)', *scopes)
    merged_out, _, _ = run_git(d, 'for-each-ref', '--format=%(refname)',
                               f'--merged={default_ref}', *scopes)
    merged = set(merged_out.split())

    prs = None
    if include_pr:
        prs = get_pull_requests(d, token, warnings)
        if prs is None:
            warnings.append(f"  WARNING  {d}  (PR info unavailable; only git-merged branches considered)")

    candidates = {}
    protected_hits = set()
    for line in out.splitlines():
        parts = line.split('\t')
        if len(parts) < 4:
            continue
        full, sha, author, email = parts[0], parts[1], parts[2], parts[3].strip('<>')
        if full.startswith('refs/heads/'):
            where, name = 'local', full[len('refs/heads/'):]
        else:
            where, name = 'remote', full[len('refs/remotes/origin/'):]
        if name == 'HEAD' or not fnmatch.fnmatchcase(name, pattern):
            continue
        if owner_filter and not _owner_matches(owner_filter, author, email):
            continue

        reason = None
        if full in merged:
            reason = f'merged into {default_ref}'
        elif prs and name in prs and prs[name][1] == 'merged' and prs[name][3]:
            number, _, base, pr_sha = prs[name]
            # Only if this ref has no commits beyond what the PR merged.
            if sha == pr_sha or run_git(d, 'merge-base', '--is-ancestor', sha, pr_sha)[2] == 0:
                reason = f'PR #{number} merged -> {base}'
        if reason is None:
            continue

        if name in keep or any(fnmatch.fnmatchcase(name, p) for p in PROTECTED_BRANCHES):
            protected_hits.add(name)
            continue
        candidates.setdefault(name, {'local': None, 'remote': None})[where] = (reason, author)

    return default_ref, candidates, protected_hits, keep


def _is_long_lived(name):
    return any(fnmatch.fnmatchcase(name, p) for p in LONG_LIVED_BRANCHES)


def _merged_elsewhere(d, default_ref, candidates, keep, pattern, local_only, owner_filter, jobs):
    """
    Report-only companion to _merged_candidates: branches that are NOT delete candidates
    but whose tip is an ancestor of at least one other local or origin branch (e.g. dev_1.4).
    Honors --match, --owner and --local-only like the delete list; never includes
    default/current/worktree/protected branches.

    Cost: one `git for-each-ref --merged=<tip>` per distinct base tip that is not itself
    merged into default_ref (anything reachable from such a base is already merged into the
    default branch, so it is a delete candidate or protected). No per-pair merge-base calls.

    Returns sorted [(name, where, owners, merged_into_names)].
    """
    scopes = ['refs/heads'] if local_only else ['refs/heads', 'refs/remotes/origin']

    def _split(full):
        if full.startswith('refs/heads/'):
            return 'local', full[len('refs/heads/'):]
        return 'remote', full[len('refs/remotes/origin/'):]

    # Subjects: filtered branches not merged into the default branch and not delete candidates
    # (a --include-pr-merged candidate can still be "no-merged" in git terms).
    out, _, _ = run_git(d, 'for-each-ref',
                        '--format=%(refname)\t%(objectname)\t%(authorname)\t%(authoremail)',
                        f'--no-merged={default_ref}', *scopes)
    subjects = {}   # full ref -> (where, name, sha, author)
    for line in out.splitlines():
        parts = line.split('\t')
        if len(parts) < 4:
            continue
        full, sha, author, email = parts[0], parts[1], parts[2], parts[3].strip('<>')
        where, name = _split(full)
        if name == 'HEAD' or not fnmatch.fnmatchcase(name, pattern):
            continue
        if owner_filter and not _owner_matches(owner_filter, author, email):
            continue
        if name in keep or any(fnmatch.fnmatchcase(name, p) for p in PROTECTED_BRANCHES):
            continue
        if name in candidates and candidates[name][where]:
            continue
        subjects[full] = (where, name, sha, author)
    if not subjects:
        return []

    # Bases: every local + origin branch (whatever --local-only says) not merged into default.
    out, _, _ = run_git(d, 'for-each-ref', '--format=%(refname)\t%(objectname)',
                        f'--no-merged={default_ref}', 'refs/heads', 'refs/remotes/origin')
    bases_by_sha = {}   # tip sha -> [base branch names]
    for line in out.splitlines():
        parts = line.split('\t')
        if len(parts) < 2:
            continue
        _, name = _split(parts[0])
        if name != 'HEAD':
            bases_by_sha.setdefault(parts[1], []).append(name)

    def _contained(sha):
        o, _, rc = run_git(d, 'for-each-ref', '--format=%(refname)', f'--merged={sha}', *scopes)
        return set(o.split()) if rc == 0 else set()

    with ThreadPoolExecutor(max_workers=max(1, jobs)) as pool:
        contained = dict(zip(bases_by_sha, pool.map(_contained, bases_by_sha)))

    hits = {}   # name -> {'local': (author, [bases])|None, 'remote': ...}
    for full, (where, name, sha, author) in subjects.items():
        ff_copies = {name} | {name + s for s in FF_COPY_SUFFIXES}
        into = []
        for base_sha, base_names in bases_by_sha.items():
            if base_sha == sha or full not in contained[base_sha]:
                continue   # equal tips are the same work, not a merge
            into.extend(b for b in base_names if b not in ff_copies)
        if into:
            hits.setdefault(name, {'local': None, 'remote': None})[where] = (author, into)

    rows = []
    for name in sorted(hits):
        h = hits[name]
        found = [h[w] for w in ('local', 'remote') if h[w]]
        where = '+'.join(w for w in ('local', 'remote') if h[w])
        owners = ', '.join(dict.fromkeys(a for a, _ in found))
        into = sorted(dict.fromkeys(b for _, bs in found for b in bs),
                      key=lambda b: (not _is_long_lived(b), b))
        rows.append((name, where, owners, into))
    return rows


def _format_merged_into(names):
    shown = ', '.join(names[:MERGED_INTO_MAX_NAMES])
    extra = len(names) - MERGED_INTO_MAX_NAMES
    return shown + (f' +{extra} more' if extra > 0 else '')


def _print_table(headers, rows, colors=None):
    """Print rows (tuples of str) under headers, indented two spaces; last column unpadded."""
    widths = [max(len(headers[i]), *(len(r[i]) for r in rows)) for i in range(len(headers) - 1)]
    fmt = '  '.join(f'{{:<{w}}}' for w in widths)
    print('  ' + fmt.format(*headers[:-1]) + '  ' + headers[-1])
    for r in rows:
        last = _c(r[-1], colors) if colors else r[-1]
        print('  ' + fmt.format(*r[:-1]) + '  ' + last)


def cmd_delete_merged(git_dirs, args):
    """
    Delete every local and origin branch already merged into the default branch.

    A branch is a delete candidate only if its tip is reachable from the default branch
    (origin/HEAD, e.g. origin/main), or with --include-pr-merged its GitHub PR was merged
    and it has no later commits. After the delete table, a report-only
    "Merged elsewhere (not deleted)" section lists the remaining branches whose tip is
    contained in some other local/origin branch (e.g. dev_1.4); nothing in it is deleted.
    --no-merged-elsewhere turns that section off.
    """
    pattern = args.match
    dry = args.dry_run
    token = args.token or os.environ.get('GITHUB_TOKEN')
    total_deleted = total_errors = 0

    for d in git_dirs:
        remote_out, _, _ = run_git(d, 'remote')
        has_origin = 'origin' in remote_out.split()
        if has_origin:
            # Still fetched with --local-only: merged state is judged against origin's default branch.
            _, stderr, rc = run_git(d, 'fetch', '--all', '--prune', '--quiet')
            if rc != 0:
                print(f"  WARNING  {d}  (fetch --all --prune failed: {stderr.strip()})", file=sys.stderr)

        warnings = []
        default_ref, candidates, info, keep = _merged_candidates(
            d, pattern, args.include_pr_merged and has_origin, token, warnings,
            local_only=args.local_only, owner_filter=args.owner)
        for w in warnings:
            print(w, file=sys.stderr)
        if candidates is None:
            print(f"  skip  {d}  ({info})")
            continue

        elsewhere = [] if args.no_merged_elsewhere else _merged_elsewhere(
            d, default_ref, candidates, keep, pattern, args.local_only, args.owner, args.jobs)

        if not candidates and not elsewhere:
            if args.verbose:
                print(f"{d}\n  no merged branches to delete\n")
            continue

        locals_  = sorted(n for n, c in candidates.items() if c['local'])
        remotes_ = sorted(n for n, c in candidates.items() if c['remote'])

        print(f"{d}  (default: {default_ref})")
        if candidates:
            rows = []
            for name in sorted(candidates):
                c = candidates[name]
                hits = [c[w] for w in ('local', 'remote') if c[w]]
                where = '+'.join(w for w in ('local', 'remote') if c[w])
                owners = ', '.join(dict.fromkeys(owner for _, owner in hits))   # dedupe, keep order
                rows.append((name, where, owners, hits[0][0]))
            _print_table(('BRANCH', 'WHERE', 'OWNER', 'STATE'), rows, _GREEN)
        else:
            print("  no merged branches to delete")
        if info and args.verbose:
            print(f"  protected (not deleted): {', '.join(sorted(info))}")

        if elsewhere:
            print("\n  Merged elsewhere (not deleted)")
            _print_table(('BRANCH', 'WHERE', 'OWNER', 'MERGED INTO'),
                         [(n, w, o, _format_merged_into(into)) for n, w, o, into in elsewhere],
                         _YELLOW)

        if not candidates:
            print()
            continue

        summary = f"{len(locals_)} local + {len(remotes_)} remote branch(es)"
        if dry:
            print(f"  [dry-run] would delete {summary}\n")
            total_deleted += len(locals_) + len(remotes_)
            continue

        if not args.yes:
            reply = input(f"  Delete {summary}? [y/N] ").strip().lower()
            if reply != 'y':
                print("  skipped\n")
                continue

        deleted = errors = 0
        for name in locals_:
            _, stderr, rc = run_git(d, 'branch', '-D', name)
            if rc != 0:
                print(f"  ERROR (local delete {name}): {stderr.strip()}", file=sys.stderr)
                errors += 1
            else:
                deleted += 1

        if remotes_:
            # One push for all; on failure retry one at a time to pinpoint which failed.
            _, _, rc = run_git(d, 'push', 'origin', '--delete', *remotes_)
            if rc == 0:
                deleted += len(remotes_)
            else:
                for name in remotes_:
                    _, stderr, rc = run_git(d, 'push', 'origin', '--delete', name)
                    if rc != 0:
                        print(f"  ERROR (remote delete {name}): {stderr.strip()}", file=sys.stderr)
                        errors += 1
                    else:
                        deleted += 1

        print(f"  deleted {deleted} branch ref(s)" + (f", {errors} error(s)" if errors else '') + "\n")
        total_deleted += deleted
        total_errors += errors

    if dry:
        print(f"Would delete {total_deleted} branch ref(s).")
    else:
        print(f"Deleted {total_deleted} branch ref(s); {total_errors} error(s).")


# ---------------------------------------------------------------------------
# --actions-delete-runs-keep command
# ---------------------------------------------------------------------------

def _list_workflow_runs(owner, repo, token):
    """
    Return every GitHub Actions run for owner/repo as dicts with keys
    id, workflow_id, name, status, created_at. Uses the REST API when a token
    is given, else the gh CLI (which carries its own auth).
    """
    path = f'repos/{owner}/{repo}/actions/runs'
    keys = ('id', 'workflow_id', 'name', 'status', 'created_at')
    if token:
        runs = []
        page = 1
        while True:
            data = github_api_get(f'https://api.github.com/{path}?per_page=100&page={page}', token)
            batch = data.get('workflow_runs') or []
            runs.extend({k: r.get(k) for k in keys} for r in batch)
            if len(batch) < 100:
                break
            page += 1
        return runs

    result = subprocess.run(
        ['gh', 'api', '--paginate', f'{path}?per_page=100',
         '--jq', '.workflow_runs[] | {id, workflow_id, name, status, created_at}'],
        capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or 'gh api failed')
    return [json.loads(line) for line in result.stdout.splitlines() if line.strip()]


def _delete_workflow_run(owner, repo, run_id, token):
    """Delete one Actions run. Returns None on success, else an error string."""
    path = f'repos/{owner}/{repo}/actions/runs/{run_id}'
    if token:
        req = urllib.request.Request(f'https://api.github.com/{path}',
                                     headers=_github_headers(token), method='DELETE')
        try:
            with _urlopen_with_retry(req):
                return None
        except urllib.error.HTTPError as e:
            return f"HTTP {e.code}: {e.read().decode('utf-8', errors='replace').strip()}"
        except urllib.error.URLError as e:
            return f"network error: {e.reason}"
    result = subprocess.run(['gh', 'api', '-X', 'DELETE', path], capture_output=True, text=True)
    return None if result.returncode == 0 else (result.stderr.strip() or 'gh api failed')


def cmd_actions_delete_runs(git_dirs, args):
    """Per github.com repo, delete all but the newest N Actions runs of each workflow."""
    keep = args.actions_delete_runs_keep
    token = args.token or os.environ.get('GITHUB_TOKEN')
    dry = args.dry_run
    total_deleted = total_errors = 0

    for d in git_dirs:
        gh = parse_github_remote(get_remote_url(d))
        if not gh:
            if args.verbose:
                print(f"  skip  {d}  (origin is not a github.com remote)")
            continue
        owner, repo = gh
        try:
            runs = _list_workflow_runs(owner, repo, token)
        except FileNotFoundError:
            print("ERROR: gh CLI not found; install it or pass --token/GITHUB_TOKEN", file=sys.stderr)
            return
        except (RuntimeError, ValueError) as e:
            print(f"  WARNING  {d}  (could not list workflow runs: {e})", file=sys.stderr)
            continue

        # Group per workflow, newest first; keep the first N of each.
        groups = {}
        for r in runs:
            groups.setdefault(r.get('workflow_id') or r.get('name'), []).append(r)
        doomed = []
        lines = []
        for wf_runs in sorted(groups.values(), key=lambda g: (g[0].get('name') or '').lower()):
            wf_runs.sort(key=lambda r: r.get('created_at') or '', reverse=True)
            old = [r for r in wf_runs[keep:] if r.get('status') == 'completed']
            active = len(wf_runs[keep:]) - len(old)
            note = f", {active} still running (kept)" if active else ''
            lines.append(f"  {wf_runs[0].get('name') or '?':<40} {len(wf_runs):>5} runs, "
                         f"delete {len(old)}{note}")
            doomed.extend(old)

        if not doomed:
            if args.verbose:
                print(f"{d}  ({owner}/{repo})\n  nothing to delete (keeping {keep} per workflow)\n")
            continue

        print(f"{d}  ({owner}/{repo})")
        for line in lines:
            print(line)

        if dry:
            print(f"  [dry-run] would delete {len(doomed)} run(s), keeping newest {keep} per workflow")
            print()
            total_deleted += len(doomed)
            continue

        reply = input(f"  Delete {len(doomed)} run(s), keeping newest {keep} per workflow? [y/N] ")
        if reply.strip().lower() != 'y':
            print("  skipped\n")
            continue

        deleted = errors = 0
        with ThreadPoolExecutor(max_workers=max(1, args.jobs)) as pool:
            futures = [(r, pool.submit(_delete_workflow_run, owner, repo, r['id'], token))
                       for r in doomed]
            for r, f in futures:
                err = f.result()
                if err:
                    errors += 1
                    print(f"  ERROR deleting run {r['id']} ({r.get('name')}): {err}", file=sys.stderr)
                else:
                    deleted += 1
        print(f"  deleted {deleted} run(s){f', {errors} error(s)' if errors else ''}\n")
        total_deleted += deleted
        total_errors += errors

    if dry:
        print(f"Would delete {total_deleted} workflow run(s).")
    else:
        print(f"Deleted {total_deleted} workflow run(s); {total_errors} errors.")


# ---------------------------------------------------------------------------
# --pull command
# ---------------------------------------------------------------------------

def cmd_pull(git_dirs, args):
    """Run git pull on each repo that has a remote."""
    dry = args.dry_run
    ran = updated = skipped = errors = 0

    for d in git_dirs:
        remote_out, _, _ = run_git(d, 'remote')
        has_remote = bool(remote_out.strip())

        if not has_remote:
            print(f"  skip  {d}  (no remote)")
            skipped += 1
            continue

        if dry:
            s = get_repo_status(d)
            print(f"[dry-run] pull  {d}")
            if s and s['error']:
                print(f"  status: (error: {s['error']})")
            elif s and s['behind']:
                upstream = s['upstream'] or 'upstream'
                print(f"  would pull {s['behind']} commit(s) from {upstream}")
            else:
                print(f"  (already up to date)")
            print()
            ran += 1
            continue

        print(f"pull  {d}")
        stdout, stderr, rc = run_git(d, 'pull')
        if rc != 0:
            print(f"  ERROR: {stderr.strip()}", file=sys.stderr)
            errors += 1
        else:
            out = (stdout + stderr).strip()
            if out and 'already up to date' not in out.lower():
                for line in out.splitlines():
                    print(f"  {line}")
                updated += 1
            else:
                print(f"  (already up to date)")
        print()
        ran += 1

    if dry:
        print(f"Would pull {ran} repo(s); {skipped} skipped (no remote).")
    else:
        print(f"Pulled {ran} repo(s) ({updated} updated); {skipped} skipped; {errors} errors.")


# ---------------------------------------------------------------------------
# --push command
# ---------------------------------------------------------------------------

def cmd_push(git_dirs, args):
    """Stage all changes, commit with --message, and push each repo."""
    dry = args.dry_run
    message = args.message
    ran = pushed = skipped = errors = 0

    for d in git_dirs:
        s = get_repo_status(d)

        if s and s['error']:
            print(f"  skip  {d}  (status error: {s['error']})")
            skipped += 1
            continue

        total_staged   = (s['staged_added'] + s['staged_modified'] +
                          s['staged_deleted'] + s['staged_renamed'])
        total_unstaged = s['unstaged_modified'] + s['unstaged_deleted']
        has_changes    = bool(total_staged or total_unstaged or s['untracked'])
        has_ahead      = s['ahead'] > 0

        if not has_changes and not has_ahead:
            skipped += 1
            continue

        remote_out, _, _ = run_git(d, 'remote')
        has_remote = bool(remote_out.strip())

        if dry:
            print(f"[dry-run] push  {d}")
            if has_changes:
                parts = []
                if s['staged_added']:    parts.append(f"{s['staged_added']} new")
                if s['staged_modified']: parts.append(f"{s['staged_modified']} staged-modified")
                if s['staged_deleted']:  parts.append(f"{s['staged_deleted']} staged-deleted")
                if s['staged_renamed']:  parts.append(f"{s['staged_renamed']} renamed")
                if total_unstaged:       parts.append(f"{total_unstaged} unstaged")
                if s['untracked']:       parts.append(f"{s['untracked']} untracked")
                print(f"  would add:    {', '.join(parts)}")
                msg_display = f'"{message}"' if message else "(--message required)"
                print(f"  would commit: {msg_display}")
            if has_ahead and not has_changes:
                print(f"  already {s['ahead']} commit(s) ahead (no new commit)")
            if has_remote:
                upstream = s['upstream'] or 'origin'
                print(f"  would push:   to {upstream}")
            else:
                print(f"  no remote:    push will be skipped")
            print()
            ran += 1
            continue

        print(f"push  {d}")
        ok = True

        if has_changes:
            _, stderr, rc = run_git(d, 'add', '--all')
            if rc != 0:
                print(f"  ERROR (add): {stderr.strip()}", file=sys.stderr)
                errors += 1
                ok = False

            if ok:
                stdout, stderr, rc = run_git(d, 'commit', '-m', message)
                if rc != 0:
                    print(f"  ERROR (commit): {stderr.strip()}", file=sys.stderr)
                    errors += 1
                    ok = False
                else:
                    for line in (stdout + stderr).strip().splitlines():
                        print(f"  {line}")

        if ok and has_remote:
            stdout, stderr, rc = run_git(d, 'push')
            if rc != 0 and ('no upstream' in stderr or 'no tracking' in stderr):
                branch = get_branch(d)
                stdout, stderr, rc = run_git(d, 'push', '--set-upstream', 'origin', branch)
            if rc != 0:
                print(f"  ERROR (push): {stderr.strip()}", file=sys.stderr)
                errors += 1
                ok = False
            else:
                for line in (stdout + stderr).strip().splitlines():
                    print(f"  {line}")
                pushed += 1
        elif ok and not has_remote:
            print(f"  committed; no remote configured — push skipped")

        if ok:
            ran += 1
        print()

    if dry:
        print(f"Would push {ran} repo(s); {skipped} skipped (nothing to do).")
    else:
        print(f"Pushed {ran} repo(s) ({pushed} sent to remote); {skipped} skipped; {errors} errors.")


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

def report_repos(git_dirs, args, collector=None):
    """Print a labeled per-repo block for each active reporting flag."""
    for d in git_dirs:
        lines = []

        current = None
        if args.branch:
            current, local_count, remote_count = get_branch_info(d)
            lines.append(f"  branch:  {current}  ({local_count} local, {remote_count} remote)")

        contributors = repo_owner = None
        if args.summary:
            repo_url = get_remote_url(d)
            url_line = f"  url:     {repo_url or '(none)'}"
            if repo_url and re.search(r'://[^/]*@', repo_url):
                url_line = _c(url_line, _YELLOW)
            lines.append(url_line)

            contributors = get_contributors(d)
            repo_owner   = get_remote_owner(d)
            contrib_str  = ', '.join(sorted(contributors, key=str.lower)) if contributors else '(none)'
            lines.append(f"  contributors: {contrib_str}")

        tag = None
        if args.tag:
            tag = get_last_tag(d)
            lines.append(f"  tag:     {tag or '(none)'}")

        release = None
        if args.release:
            release = get_last_release(d)
            lines.append(f"  release: {release or '(none)'}")

        s = None
        unpushed = None
        if args.status or args.dirty:
            s        = get_repo_status(d)
            unpushed = get_unpushed_branches(d)
            if args.status:
                color = _status_color(s, unpushed)
                for line in format_status(s, unpushed, args.verbose):
                    lines.append(_c(line, color) if color else line)

        size_bytes = None
        if args.size:
            size_bytes = get_git_dir_size(d)
            for line in format_size(d, args.verbose, size_bytes):
                lines.append(line)

        if collector is not None:
            collector.record(d, current, s, unpushed, tag, release, size_bytes, contributors, repo_owner)

        if args.dirty and not _is_dirty(s, unpushed):
            continue

        print(d)
        for line in lines:
            print(line)
        print()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description=f"git-tool {VERSION}\nScan directories and report status about their git projects.",
        epilog="""Examples:
  # Dirs can be supplied with --dir or as trailing arguments (both forms are equivalent):
  git-tool.py --status --dir ~/projects
  git-tool.py --status ~/projects

  git-tool.py --branch --dir ~/proj1 ~/proj2
  git-tool.py --branch ~/proj1 ~/proj2

  # Any reporting flags can be combined freely:
  git-tool.py --branch --tag ~/projects
  git-tool.py --branch --status --tag --release ~/projects

  # --size shows .git disk usage (verbose adds pack/loose object counts):
  git-tool.py --size ~/projects
  git-tool.py --size --verbose ~/projects

  # --summary is shorthand for --branch --status --tag --release --size:
  git-tool.py --summary ~/projects

  # Reporting + action together (report runs first):
  git-tool.py --summary --clean ~/projects

  # Full git status output (not short format):
  git-tool.py --status --verbose ~/projects

  # Rename master -> main (local + remote) wherever safe:
  git-tool.py --main ~/projects
  git-tool.py --main --dry-run ~/projects

  # Delete a branch locally and on the remote (prompts for confirmation,
  # shows merge status; runs "git fetch --all --prune" first):
  git-tool.py --delete-branch old-feature ~/projects
  git-tool.py --delete-branch old-feature --dry-run ~/projects

  # Delete every branch already merged into the default branch (local + origin;
  # one prompt per repo; default/current/protected branches are never touched):
  git-tool.py --delete-merged --dry-run ~/projects
  git-tool.py --delete-merged ~/projects
  git-tool.py --delete-merged --match "feature/*" --yes ~/projects
  # Only local branches, only those whose tip author contains "alice" (or a glob):
  git-tool.py --delete-merged --local-only --owner alice --dry-run ~/projects
  git-tool.py --delete-merged --owner "*@example.com" --dry-run ~/projects
  # Also catch squash/rebase-merged GitHub PRs (only if no commits since the PR):
  git-tool.py --delete-merged --include-pr-merged --dry-run .
  # Each repo also gets a report-only "Merged elsewhere (not deleted)" table: branches
  # not merged into the default branch but contained in another branch (e.g. dev_1.4).
  # Turn it off with --no-merged-elsewhere:
  git-tool.py --delete-merged --dry-run --no-merged-elsewhere ~/projects

  # List every tag with its date and a version line from a file at that tag:
  git-tool.py --tag-list .
  git-tool.py --tag-list --tag-file app/build.gradle --tag-text ext.PLUGIN_VERSION .

  # Every local + remote branch: owner, last change, merged/PR/safe-to-delete state:
  git-tool.py --branch-details .
  git-tool.py --branch-details --token ghp_xxx .
  git-tool.py --branch-details --jobs 16 ~/projects

  # Delete all but the newest N GitHub Actions runs per workflow (default 3):
  git-tool.py --actions-delete-runs-keep 3 --dry-run .
  git-tool.py --actions-delete-runs-keep 3 ~/projects

  # Fetch, prune, and gc all repos:
  git-tool.py --clean ~/projects
  git-tool.py --clean --dry-run ~/projects

  # Pull latest changes for all repos:
  git-tool.py --pull ~/projects
  git-tool.py --pull .
  git-tool.py --pull --dry-run ~/projects

  # Stage, commit, and push all repos:
  git-tool.py --push --message "global push" ~/projects
  git-tool.py --push -m "global push" .
  git-tool.py --push --message "wip" --dry-run ~/projects

  # Regex pattern to find repos (searches from cwd):
  git-tool.py --summary "myproject"
  git-tool.py --branch --status ".*2024.*"

  # Download a single file from GitHub:
  git-tool.py --download https://github.com/OWNER/REPO/blob/main/path/file.py

  # Download a directory (top-level files only, then recursively):
  git-tool.py --download https://github.com/OWNER/REPO/tree/main/path/dir
  git-tool.py --download https://github.com/OWNER/REPO/tree/main/path/dir --recursive

  # Filter which files are downloaded, and pick a destination:
  git-tool.py --download URL --recursive --include "*.ts" --exclude "*.test.ts" -o ./out

  # Private repo (or to raise the API rate limit):
  git-tool.py --download URL --token ghp_xxx
  GITHUB_TOKEN=ghp_xxx git-tool.py --download URL

  # List all repos for a GitHub user or org:
  git-tool.py --host github.com/landenlabs --repo-list
  git-tool.py --host landenlabs --repo-list --token ghp_xxx

  # List repos whose name matches a pattern (regex):
  git-tool.py --host landenlabs --repo-list "py.*"

  # Clone repos whose name matches a pattern, skipping dirs that already exist:
  git-tool.py --host github.com/landenlabs --repo-clone "py.*"
  git-tool.py --host landenlabs --repo-clone py-tool1 --repo-clone py-tool2

Notes:
  When a directory path is given, it and all subdirectories are scanned.
  When a pattern is given, it is matched case-insensitively against the full
  path of each directory found while walking the current directory.
  --dir and trailing arguments can be mixed: --dir ~/a ~/b ~/c
  If neither is given, the current directory (.) is used.
  Repos nested inside another repo are not scanned recursively.
""",
        formatter_class=argparse.RawTextHelpFormatter,
    )

    parser.add_argument(
        '--dir', nargs='*', default=[], metavar='PATH_OR_PATTERN',
        help='Directory paths or regex patterns to locate git repositories '
             '(default: current directory)',
    )
    parser.add_argument(
        'dirs', nargs='*', default=[], metavar='PATH_OR_PATTERN',
        help='Directories or patterns (alternative to --dir, can be mixed with it)',
    )
    parser.add_argument(
        '--branch', action='store_true',
        help='Show current branch for each repository',
    )
    parser.add_argument(
        '--status', action='store_true',
        help='Show git status for each repository',
    )
    parser.add_argument(
        '--tag', action='store_true',
        help='Show most recent tag for each repository',
    )
    parser.add_argument(
        '--release', action='store_true',
        help='Show most recent tag name and date for each repository',
    )
    parser.add_argument(
        '--size', action='store_true',
        help='Show .git directory size and pack/loose breakdown',
    )
    parser.add_argument(
        '--summary', action='store_true',
        help='Shorthand for --branch --status --tag --release --size',
    )
    parser.add_argument(
        '--main', action='store_true',
        help='Rename master -> main where master exists and main does not (local + remote)',
    )
    parser.add_argument(
        '--delete-branch', metavar='BRANCH',
        help='Delete BRANCH both locally and on the remote (with confirmation, '
             'showing merge status); runs "git fetch --all --prune" first',
    )
    parser.add_argument(
        '--delete-merged', action='store_true',
        help='Delete every local and origin branch already merged into the default branch.\n'
             'Never deletes the default, checked-out, worktree, or protected branches\n'
             '(main, master, develop, development, release, release/*). Prompts once per\n'
             'repo; honors --dry-run. Runs "git fetch --all --prune" first.\n'
             'Also reports (never deletes) branches merged into some other branch only',
    )
    parser.add_argument(
        '--no-merged-elsewhere', action='store_true',
        help='With --delete-merged, hide the "Merged elsewhere (not deleted)" section',
    )
    parser.add_argument(
        '--match', metavar='GLOB', default='*',
        help='With --delete-merged, only consider branches whose name matches GLOB\n'
             '(e.g. "feature/*"; quote it so the shell does not expand it)',
    )
    parser.add_argument(
        '--include-pr-merged', action='store_true',
        help='With --delete-merged, also delete branches whose GitHub PR was merged\n'
             '(squash/rebase merges), but only if the branch has no commits beyond the PR.\n'
             'Uses --token/GITHUB_TOKEN, else the gh CLI, else the public API',
    )
    parser.add_argument(
        '--local-only', action='store_true',
        help='With --delete-merged, delete only local branches; never touch origin',
    )
    parser.add_argument(
        '--owner', metavar='TEXT_OR_GLOB',
        help='With --delete-merged, only branches whose tip-commit author name or email\n'
             'contains TEXT (case-insensitive), or matches GLOB if it has * ? or [',
    )
    parser.add_argument(
        '--yes', '-y', action='store_true',
        help='With --delete-merged, delete without prompting',
    )
    parser.add_argument(
        '--tag-list', action='store_true',
        help='List all tags (newest first) with date and the --tag-text line found '
             'in --tag-file at that tag',
    )
    parser.add_argument(
        '--branch-details', action='store_true',
        help='List every local and remote branch with owner, last-change date, and\n'
             'one state column: default / checked out / PR open -> BASE / merged - safe to delete /\n'
             'PR merged -> BASE - safe to delete / PR closed (-> BASE), unmerged / unmerged (+N ahead).\n'
             'Runs "git fetch --all --prune" first. PR info (github.com only) uses\n'
             '--token/GITHUB_TOKEN, else the gh CLI, else the public API',
    )
    parser.add_argument(
        '--actions-delete-runs-keep', nargs='?', type=int, const=3, default=None, metavar='N',
        help='For each github.com repo, delete all but the newest N GitHub Actions runs\n'
             'of every workflow (default N: 3; in-progress runs are never deleted).\n'
             'Prompts per repo; honors --dry-run. Uses --token/GITHUB_TOKEN, else the gh CLI',
    )
    parser.add_argument(
        '--jobs', '-j', type=int, default=8, metavar='N',
        help='Parallel workers for --branch-details, --actions-delete-runs-keep, and the\n'
             '--delete-merged "Merged elsewhere" scan (default: %(default)s)',
    )
    parser.add_argument(
        '--tag-file', metavar='FILE', default='app/build.gradle',
        help='File searched at each tag by --tag-list (default: %(default)s)',
    )
    parser.add_argument(
        '--tag-text', metavar='TEXT', default='ext.PLUGIN_VERSION',
        help='Text searched for in --tag-file by --tag-list (default: %(default)s)',
    )
    parser.add_argument(
        '--clean', action='store_true',
        help='Run fetch --prune, worktree prune, and gc --auto on each repo',
    )
    parser.add_argument(
        '--pull', action='store_true',
        help='Pull latest changes for each repository',
    )
    parser.add_argument(
        '--push', action='store_true',
        help='Stage all changes, commit with --message, and push each repository',
    )
    parser.add_argument(
        '--message', '-m', metavar='MSG',
        help='Commit message used by --push',
    )
    parser.add_argument(
        '--dry-run', action='store_true',
        help='Preview what --main, --delete-branch, --delete-merged, --clean, --pull, or --push '
             'would do without making changes',
    )
    parser.add_argument(
        '--verbose', '-v', action='store_true',
        help='Show full git status (not short) and scanning details',
    )
    parser.add_argument(
        '--dirty', action='store_true',
        help='Only show repos with non-clean status (errors, behind, or pending changes)',
    )
    parser.add_argument(
        '--no-color', action='store_true',
        help='Disable colored status output',
    )
    parser.add_argument(
        '--download', metavar='URL',
        help='Download a file or directory tree from a github.com URL',
    )
    parser.add_argument(
        '--repo-list', nargs='?', const='', default=None, metavar='PATTERN',
        help='List repos for --host, optionally filtered by PATTERN (regex); '
             'omit PATTERN to list all',
    )
    parser.add_argument(
        '--host', metavar='OWNER_OR_URL',
        help='Git base for --repo-list/--repo-clone, e.g. github.com/OWNER or OWNER',
    )
    parser.add_argument(
        '--repo-clone', action='append', default=[], metavar='PATTERN',
        help='Clone repos from --host whose name matches PATTERN (regex); '
             'skips directories that already exist. Repeatable.',
    )
    parser.add_argument(
        '--recursive', action='store_true',
        help='With --download on a directory URL, descend into subdirectories',
    )
    parser.add_argument(
        '--include', nargs='*', default=[], metavar='PATTERN',
        help='With --download, only fetch files matching PATTERN (glob, repeatable)',
    )
    parser.add_argument(
        '--exclude', nargs='*', default=[], metavar='PATTERN',
        help='With --download, skip files matching PATTERN (glob, repeatable)',
    )
    parser.add_argument(
        '--output', '-o', metavar='PATH',
        help='Local destination file or directory for --download',
    )
    parser.add_argument(
        '--token', metavar='TOKEN',
        help='GitHub API token for --download, --repo-list, --repo-clone, --branch-details,\n'
             '--delete-merged --include-pr-merged, and --actions-delete-runs-keep\n'
             '(private repos / higher rate limit); falls back to the GITHUB_TOKEN env var',
    )
    parser.add_argument('--version', action='version', version=f'%(prog)s {VERSION}')

    args = parser.parse_args()

    if not args.no_color:
        _init_colors()

    if args.download:
        sys.exit(cmd_download(args))

    if args.repo_list is not None and not args.host:
        parser.error("--repo-list requires --host")

    if args.repo_clone and not args.host:
        parser.error("--repo-clone requires --host")

    if args.host and args.repo_list is None and not args.repo_clone:
        parser.error("--host requires --repo-list or --repo-clone")

    if args.repo_list is not None:
        sys.exit(cmd_list_repos(args))

    if args.repo_clone:
        sys.exit(cmd_repo_clone(args))

    if args.recursive or args.include or args.exclude or args.output:
        parser.error("--recursive, --include, --exclude, and --output require --download")

    deleting_runs = args.actions_delete_runs_keep is not None
    if deleting_runs and args.actions_delete_runs_keep < 0:
        parser.error("--actions-delete-runs-keep N must be >= 0")

    if args.token and not (args.branch_details or deleting_runs or args.delete_merged):
        parser.error("--token requires --download, --repo-list, --repo-clone, --branch-details, "
                     "--delete-merged, or --actions-delete-runs-keep")

    if not args.delete_merged and (args.match != '*' or args.include_pr_merged or args.yes
                                   or args.local_only or args.owner or args.no_merged_elsewhere):
        parser.error("--match, --include-pr-merged, --local-only, --owner, --no-merged-elsewhere, "
                     "and --yes require --delete-merged")

    # Merge --dir and trailing positional dirs into one list; default to cwd
    all_dirs = args.dir + args.dirs or ['.']

    # Expand --summary into its constituent flags
    if args.summary:
        args.branch = args.status = args.tag = args.release = args.size = True

    reporting = args.branch or args.status or args.tag or args.release or args.size or args.dirty
    if not reporting and not args.main and not args.delete_branch and not args.delete_merged \
            and not args.clean and not args.pull and not args.push and not args.tag_list \
            and not args.branch_details and not deleting_runs:
        parser.error("specify at least one of --branch, --status, --tag, --release, "
                     "--size, --summary, --dirty, --tag-list, --branch-details, --main, --delete-branch, "
                     "--delete-merged, --actions-delete-runs-keep, --clean, --pull, or --push")

    if args.dry_run and not (args.main or args.delete_branch or args.delete_merged or args.clean
                             or args.pull or args.push or deleting_runs):
        parser.error("--dry-run only applies to --main, --delete-branch, --delete-merged, "
                     "--actions-delete-runs-keep, --clean, --pull, or --push")

    if args.push and not args.message and not args.dry_run:
        parser.error("--push requires --message")

    git_dirs = find_git_dirs(all_dirs, verbose=args.verbose)

    if not git_dirs:
        print("No git repositories found.", file=sys.stderr)
        sys.exit(1)

    if args.verbose:
        n = len(git_dirs)
        print(f"Found {n} git repositor{'ies' if n != 1 else 'y'}.\n", file=sys.stderr)

    current_user = get_current_git_user() if args.summary else None
    collector = SummaryCollector(len(git_dirs), current_user) if args.summary else None
    exit_code = 0
    try:
        if reporting:
            report_repos(git_dirs, args, collector)
        if args.tag_list:
            cmd_tag_list(git_dirs, args)
        if args.branch_details:
            cmd_branch_details(git_dirs, args)
        if deleting_runs:
            cmd_actions_delete_runs(git_dirs, args)
        if args.main:
            cmd_rename_to_main(git_dirs, args)
        if args.delete_branch:
            cmd_delete_branch(git_dirs, args)
        if args.delete_merged:
            cmd_delete_merged(git_dirs, args)
        if args.clean:
            cmd_clean(git_dirs, args)
        if args.pull:
            cmd_pull(git_dirs, args)
        if args.push:
            cmd_push(git_dirs, args)
    except KeyboardInterrupt:
        print("\nInterrupted.", file=sys.stderr)
        exit_code = 130
    except Exception as e:
        print(f"Unexpected error: {e}", file=sys.stderr)
        traceback.print_exc()
        exit_code = 1
    finally:
        if collector is not None and collector.repos_processed > 0:
            print_summary_report(collector)

    if exit_code:
        sys.exit(exit_code)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrupted.", file=sys.stderr)
        sys.exit(130)
    except Exception as e:
        print(f"Unexpected error: {e}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)
