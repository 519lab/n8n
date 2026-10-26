# GitHub Actions & CI/CD Documentation

Reference for this fork's `.github/` folder (as of 2026-10-26).

This is a de-enterprised fork of `n8n-io/n8n`. Upstream's release, backport,
3.x-sync, benchmark, eval, Chromatic/Storybook, Slack/Codecov/QA-metrics and
bot workflows were removed because they depend on n8n-io secrets, GitHub Apps
or `github.repository == 'n8n-io/n8n'` gates that do not exist here (see
`DEFORK_CHANGELOG.md`). Do not port them back without a backing secret and a
fork-specific purpose.

---

## Folder Structure

```
.github/
├── WORKFLOWS.md                          # This document
├── CI-TELEMETRY.md                       # Container-stack telemetry (playwright)
├── DEVELOPING_V3.md                      # Upstream v3 model (reference only here)
├── CODEOWNERS                            # Team ownership for PR reviews
├── pull_request_template.md              # PR description template
├── pull_request_title_conventions.md     # Title format rules (Angular)
├── docker-compose.yml                    # DB services for local testing
├── test-metrics/                         # E2E impact map + playwright baselines
├── ISSUE_TEMPLATE/
├── scripts/                              # Automation scripts (own package.json)
│   ├── attest-image-sbom.mjs             # SBOM attestation for images
│   ├── cleanup-ghcr-images.mjs           # Prune stale CI images from GHCR
│   ├── github-helpers.mjs                # Shared Octokit helpers
│   ├── owners.mjs                        # OWNERS last-match allocation
│   ├── retry.mjs                         # Retry wrapper for flaky CLI steps
│   ├── trim-fe-packageJson.js            # Strip frontend devDeps (build-n8n.mjs)
│   ├── verify-safechain.mjs              # Package-manager safe-chain check
│   ├── quality/                          # PR size check + override
│   ├── stale/                            # Stale-branch cleanup
│   └── docker/                           # Image tags, build context, smoke checks
├── actions/                              # Custom composite actions
└── workflows/                            # GitHub Actions workflows
```

---

## Branch Model

`develop` is the default branch and the CI target; `master` only receives
promotion PRs from `develop`. PR CI (`ci-pull-requests.yml`, `ci-master.yml`,
`ci-pr-quality.yml`) runs on PRs into either branch.

The `develop-ci-gate` ruleset requires these checks:

- `Lint / Lint`
- `Unit tests (22.23.2) / Unit tests`, `Unit tests (24.18.1) / Unit tests`
- `Required PR Quality Checks`

---

## Quick Reference

| Prefix     | Purpose                              |
|------------|--------------------------------------|
| `test-`    | Testing (unit, E2E, DB, installer)   |
| `ci-`      | Continuous integration               |
| `util-`    | Maintenance utilities                |
| `build-`   | Build processes                      |
| `sec-`     | Security scanning                    |
| Other      | Docker, SBOM, dependabot             |

Reusable workflows carry a `-reusable` or `-callable` suffix.

---

## PR Title Conventions

```
Format: <type>(<scope>): <summary>

Types:   feat | fix | perf | test | docs | refactor | build | ci | chore
Scopes:  API | benchmark | core | editor | * Node (optional)
```

Enforced on PRs into `master` and `develop` by `ci-check-pr-title.yml`. See `pull_request_title_conventions.md`.

---

## What Runs When You Open a PR

| Workflow                        | Runs when                                                     |
|---------------------------------|---------------------------------------------------------------|
| `ci-pull-requests.yml`          | Any PR; jobs are path-filtered by `install-and-build`         |
| `ci-master.yml`                 | PR into `master`/`develop` (skips Python-only changes)        |
| `ci-master-python-only.yml`     | Python-only PRs — reports the required ci-master checks as stubs |
| `ci-pr-quality.yml`             | Any PR — size check (`/size-limit-override` comment to bypass)      |
| `ci-check-pr-title.yml`         | PRs into `master`/`develop` — title format                    |
| `ci-codeowners-validation.yml`  | Any PR — CODEOWNERS syntax                                    |
| `ci-python.yml`                 | `packages/@n8n/task-runner-python/**` changes                 |
| `build-base-image.yml`          | `docker/images/n8n-base/**` changes (pushes on `develop`)     |
| `docker-build-smoke.yml`        | Docker build inputs change                                    |
| `test-e2e-helm.yml`             | Helm / container-stack changes                                |
| `test-get-n8n.yml`              | `docker/get-n8n*` / `docker/test-get-n8n.sh` changes          |
| `dependabot-auto-merge.yml`     | Dependabot PRs                                                |

### Inside `ci-pull-requests.yml`

```
install-and-build (paths filter + build cache)
├─ unit-test        → test-unit-reusable.yml
├─ typecheck
├─ lint             → test-linting-reusable.yml
├─ check-packaging
├─ dev-server-smoke → test-dev-server-smoke-reusable.yml
├─ db-tests         → test-db-reusable.yml          (db paths)
├─ security-checks  → sec-ci-reusable.yml           (.github/** changes)
├─ workflow-scripts → test-workflow-scripts-reusable.yml
├─ prepare-docker / sqlite-sanity / e2e             (runtime/e2e paths or `force-e2e` label)
└─ required-checks  (aggregates the above via ci-filter validate)
```

**E2E runs the sqlite suite with no license.** `e2e` runs when the paths
filter marks runtime or E2E changes, or when the PR has the `force-e2e` label. It
is advisory (not in `required-checks`). On a PR it runs only the specs affected
by the change, unless `force-e2e` is set, spread over 16 shards (one worker each).
The full suite runs every night on develop (`test-e2e-nightly.yml`), and can be
started by hand from the Actions tab.

### Manual Triggers (PR Comments)

| Command            | Workflow                     | Permissions          |
|--------------------|------------------------------|----------------------|
| `/test-workflows`  | `test-workflows-callable.yml`| admin/write/maintain |
| `/size-limit-override` | `ci-pr-quality.yml`      | maintainers          |

### Other Manual Workflows

| Workflow                       | Purpose                                             |
|--------------------------------|-----------------------------------------------------|
| `docker-build-push.yml`        | Build and push n8n + runners images to GHCR         |
| `sbom-generation-callable.yml` | Attach SBOM/VEX/licenses to a GitHub release        |
| `test-workflows-nightly.yml`   | Workflow snapshot tests (schedule disabled, DEVP-544) |
| `util-data-tooling.yml`        | SQLite/PostgreSQL export/import validation          |
| `security-trivy-scan-callable.yml` | Trivy scan of an image ref                      |

---

## Workflow Call Graph

```
ci-pull-requests.yml
    ├─▶ test-unit-reusable.yml
    ├─▶ test-linting-reusable.yml
    ├─▶ test-dev-server-smoke-reusable.yml
    ├─▶ test-db-reusable.yml
    ├─▶ test-workflow-scripts-reusable.yml
    ├─▶ prepare-docker-reusable.yml
    ├─▶ test-e2e-reusable.yml
    └─▶ sec-ci-reusable.yml
            ├─▶ sec-poutine-reusable.yml
            └─▶ sec-zizmor-reusable.yml

ci-master.yml
    ├─▶ test-unit-reusable.yml
    └─▶ test-linting-reusable.yml

docker-build-push.yml
    └─▶ security-trivy-scan-callable.yml

test-workflows-nightly.yml / test-workflows-pr-comment.yml
    └─▶ test-workflows-callable.yml

test-e2e-nightly.yml
    ├─▶ prepare-docker-reusable.yml
    └─▶ test-e2e-reusable.yml
```

---

## ci-master.yml

Runs on **push to `master` or `develop`**, and on **pull requests targeting
`master` or `develop`**. `paths-ignore` skips
`packages/@n8n/task-runner-python/**` on both events. PR runs cancel their own
superseded runs; push runs are never cancelled.

Because of that `paths-ignore`, a Python-only PR never reports the ci-master
checks the develop ruleset requires. `ci-master-python-only.yml` reports them as
passing stubs, but only when every changed file is under
`packages/@n8n/task-runner-python/`; on mixed PRs the stub jobs take a
non-required name so the real checks stay authoritative.

```
Push to master/develop  ·  PR → master/develop
├─ build-github (populate cache)
├─ unit-test (matrix: Node 22.23.2, 24.18.1; coverage collected on 24.18.1)
└─ lint
```

A failing push run opens a `ci-failure` issue (see [Failure Alerts](#failure-alerts)).

---

## Scheduled Jobs

| Schedule (UTC)  | Workflow                    | Purpose                              |
|-----------------|-----------------------------|--------------------------------------|
| Daily 00:00     | `docker-build-push.yml`     | Nightly n8n + runners images to GHCR |
| Daily 02:00     | `test-get-n8n.yml`          | get-n8n installer health             |
| Daily 03:00     | `docker-build-smoke.yml`    | No-cache Docker build                |
| Daily 03:00     | `util-cleanup-pr-images.yml`| Prune CI images older than 3 days    |
| Daily 05:00     | `test-e2e-nightly.yml`      | Full E2E suite on develop (16 shards) |
| Mon 10:00       | `clean-stale-branches.yml`  | List stale branches (deleting needs a manual run with dry-run off) |
| Mon–Fri 09:00   | `community-pr-close-stale.yml` | Close stale community PRs         |

### Failure Alerts

Scheduled workflows, and `ci-master` on branch pushes, end with a
`report-status` job that calls `util-ci-failure-issue-reusable.yml`. It runs
`.github/scripts/ci-failure-issue.mjs`, which keeps one open issue labelled
`ci-failure` per workflow + branch (`CI failing: <workflow> on <branch>`):

- first failure → opens the issue (and creates the label if missing)
- repeat failure → comments the new run URL
- next success → comments and closes it

PR and manual runs don't report — their failures are visible where they ran.
Watch the repo's issues (or filter `label:ci-failure`) to get notified.

---

## Custom Actions

Composite actions in `.github/actions/`:

| Action                  | Purpose                                         |
|-------------------------|-------------------------------------------------|
| `setup-nodejs`          | pnpm + Node.js + Turbo cache + Docker (opt)     |
| `docker-registry-login` | GHCR authentication                             |
| `build-n8n-docker`      | Build the n8n image for E2E                     |
| `load-n8n-docker`       | Load a cached n8n image                         |
| `ci-filter`             | Path filtering and required-job validation      |

---

## Reusable Workflows

| Workflow                             | Purpose               |
|--------------------------------------|-----------------------|
| `test-unit-reusable.yml`             | Unit tests            |
| `test-linting-reusable.yml`          | ESLint                |
| `test-db-reusable.yml`               | DB integration        |
| `test-dev-server-smoke-reusable.yml` | Vite dev-server boot  |
| `test-e2e-reusable.yml`              | Core E2E executor     |
| `test-workflows-callable.yml`        | Workflow tests        |
| `test-workflow-scripts-reusable.yml` | `.github/scripts` tests |
| `util-ci-failure-issue-reusable.yml` | Open/close `ci-failure` issues |
| `prepare-docker-reusable.yml`        | Build/cache the E2E image |
| `docker-build-push.yml`              | Docker build          |
| `sec-ci-reusable.yml`                | Security orchestrator |
| `sec-poutine-reusable.yml`           | Poutine scanner       |
| `sec-zizmor-reusable.yml`            | Zizmor scanner        |
| `security-trivy-scan-callable.yml`   | Trivy scan            |
| `sbom-generation-callable.yml`       | SBOM generation       |

---

## Scripts

`.github/scripts` has its own `package.json` and lockfile and is **not** a
workspace member. Install with
`pnpm install --dir ./.github/scripts --ignore-workspace`; test with
`npm test --prefix=.github/scripts` (what `test-workflow-scripts-reusable.yml`
runs).

| Script                               | Called By                              |
|--------------------------------------|----------------------------------------|
| `docker/docker-config.mjs`           | `docker-build-push.yml`                |
| `docker/docker-tags.mjs`             | `docker-build-push.yml`                |
| `docker/get-manifest-digests.mjs`    | `docker-build-push.yml`                |
| `docker/kafka-native-smoke-check.mjs`| `docker-build-push.yml`                |
| `attest-image-sbom.mjs`              | `docker-build-push.yml`                |
| `cleanup-ghcr-images.mjs`            | `util-cleanup-pr-images.yml`           |
| `quality/check-pr-size.mjs`          | `ci-pr-quality.yml`                    |
| `stale/clean-stale-branches.mjs`     | `clean-stale-branches.yml`             |
| `ci-failure-issue.mjs`               | `util-ci-failure-issue-reusable.yml`   |
| `owners.mjs`                         | `community-pr-readiness-check` skill   |
| `trim-fe-packageJson.js`             | `scripts/build-n8n.mjs` (image build)  |

---

## Runner Selection

Every job runs on GitHub-hosted `ubuntu-latest`, including the Docker build
matrix in `scripts/docker/docker-config.mjs`. The SLSA provenance generator is a
third-party reusable workflow that picks its own GitHub-hosted runner.

- **Cost:** the repo is public, so standard GitHub-hosted runners are free and
  unlimited. Don't add paid runner labels (larger runners, third-party runner
  services). If the repo ever goes private, minutes become metered against the
  org's allowance, and the org's Actions budget stops CI when it runs out.
- **Size:** 4 CPUs and 16 GB per job (GitHub's size for public repos). Heap caps
  (`NODE_OPTIONS`, 6–7 GB) and lint's `TURBO_CONCURRENCY: 10` are tuned for it.
- **Images between jobs:** each job is a fresh VM, so `prepare-docker` saves
  `n8nio/n8n:local` + `n8nio/runners:local` as a zstd tarball in the Actions
  cache under a variant+SHA key, and `load-n8n-docker` restores it in each shard
  (rebuilding on a cache miss).
- **Host ports:** the dev-server smoke and `test-get-n8n.sh --e2e` start servers
  on free high ports picked from the kernel (`N8N_BASE_URL`, `N8N_EDITOR_URL`,
  `N8N_RUNNERS_BROKER_PORT`, `N8N_HOST_PORT`) rather than n8n's defaults.
  Container-based E2E stacks already map random host ports.
- **No Windows or ARM:** there's no Windows build, and Docker images are built
  for `linux/amd64` only.

---

## Security

| Scanner / artifact | Runs on                          | Output                         |
|--------------------|----------------------------------|--------------------------------|
| Poutine            | PRs touching `.github/**`        | Fails on error-level findings; SARIF → Security tab |
| Zizmor             | PRs touching `.github/**`        | Workflow-hardening findings    |
| Trivy              | `docker-build-push.yml` builds   | Step summary + logs            |
| SBOM (CycloneDX)   | `sbom-generation-callable.yml`   | Attached to the GitHub release |
| SLSA L3 provenance | `docker-build-push.yml` pushes   | Image attestation              |
| VEX (OpenVEX)      | `docker-build-push.yml` pushes   | `cosign` attestation from `security/vex.openvex.json` |

Poutine uploads its SARIF to the Security tab (code scanning) on every scan,
including scans that fail on error-level findings.

**Verify image provenance / VEX:**

```bash
slsa-verifier verify-image ghcr.io/519lab/n8n:VERSION \
  --source-uri github.com/519lab/n8n

cosign verify-attestation --type openvex \
  --certificate-identity-regexp '.*github.com/519lab/n8n.*' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  ghcr.io/519lab/n8n:VERSION
```

The SLSA generator must be referenced by semantic version tag (`@vX.Y.Z`), not
a commit SHA — `slsa-verifier` requires tagged versions.

---

## Secrets

This repository defines **no repository secrets** (organization secrets were
not inspected); workflows authenticate with the built-in `GITHUB_TOKEN`. Kept
workflows still reference some secrets that are unset here:

| Secret                                           | Referenced by                        | Effect when unset                  |
|--------------------------------------------------|--------------------------------------|------------------------------------|
| `CURRENTS_RECORD_KEY`, `CURRENTS_API_KEY`        | `test-e2e-reusable`, `test-workflows-callable` | No Currents recording       |
| `N8N_ENCRYPTION_KEY`                             | `test-e2e-reusable`                  | Containers fall back to a fixed test key |
| `ENCRYPTION_KEY`                                 | `test-workflows-callable`            | Passed through as an empty `N8N_ENCRYPTION_KEY` |

Before adding a workflow step that needs a secret, add the secret first — a
step reading an unset secret silently no-ops or fails.
