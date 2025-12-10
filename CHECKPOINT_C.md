# Checkpoint C — Fix CI Bundle-Size Workflow Permissions

## Files Touched
- `.github/workflows/bundle-size-tracking.yml` - Added permissions, guards, and error handling

## What Changed and Why
- Added explicit permissions: `issues: write`, `pull-requests: write`, `contents: write`
- Added guard: Only run comment/issue steps on same-repo PRs (not forks)
- Added `continue-on-error: true` to comment/issue steps so they don't fail the job
- Added graceful error handling: Skip on 403/404 errors instead of failing
- Report artifact generation remains unchanged (always runs)
- Job now passes even when comments/issues can't be posted
