@../AGENTS.md

## .github Quick Reference

This folder contains this fork's GitHub Actions infrastructure. Upstream-only
workflows (release, backport, 3.x sync, evals, benchmarks, Slack/Codecov/QA-metrics
notifiers) were removed; see `WORKFLOWS.md` before adding any back.

### Key Files

| File/Folder | Purpose |
|-------------|---------|
| `WORKFLOWS.md` | Complete CI/CD documentation |
| `DEVELOPING_V3.md` | Upstream's v3 model (master + 3.x) — reference only; this fork has no `3.x` |
| `workflows/` | GitHub Actions workflows |
| `actions/` | Reusable composite actions |
| `scripts/` | Release & Docker automation |
| `CODEOWNERS` | Team review ownership |

### Workflow Naming

| Prefix | Purpose |
|--------|---------|
| `test-` | Testing (unit, E2E, visual) |
| `ci-` | Continuous integration |
| `util-` | Maintenance utilities |
| `build-` | Build processes |
| `sec-` | Security scanning |

Reusable workflows: add `-reusable` or `-callable` suffix.

### Common Tasks

**Add workflow:** Create in `workflows/`, document in `WORKFLOWS.md`.
Always declare a least-privilege top-level `permissions:` block (usually
`contents: read`) — without one the workflow runs with the repo's broad
default token and review flags it. Jobs needing more override at job level;
a job calling a reusable workflow must grant at least what that workflow
declares.

**Add script:** Create `.mjs` in `scripts/`, document in `WORKFLOWS.md`

### Reference

See `WORKFLOWS.md` for:
- Architecture diagrams
- Workflow call graph
- Scheduled jobs & triggers
- Runners & secrets
