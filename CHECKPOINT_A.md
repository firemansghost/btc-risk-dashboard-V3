# Checkpoint A — Remove Internal Files & Rogue Lockfile

## Files Touched
- Removed `node_modules/.package-lock.json` from git tracking
- Updated `.gitignore` to exclude:
  - All checkpoint/status documentation files
  - `node_modules/` and subdirectories
  - `docs/_internal/` folder

## What Changed and Why
- Removed accidentally committed internal documentation files via .gitignore
- Removed rogue lockfile from node_modules
- Only root `package-lock.json` remains tracked
- PR is now cleaner and mergeable
