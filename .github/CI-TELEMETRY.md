# CI Telemetry

**Inactive on this fork.** Upstream ships CI metrics through
GitHub Actions → webhook → n8n → BigQuery, keyed on the
`QA_METRICS_WEBHOOK_URL` / `_USER` / `_PASSWORD` secrets. Those secrets do not
exist here, so the CI steps that sent build and Docker stats were removed
(see `DEFORK_CHANGELOG.md`). Two test-side emitters remain and are no-ops
unless `QA_METRICS_WEBHOOK_URL` is set:

| Telemetry                 | Source                                                     | Metrics                              |
|---------------------------|------------------------------------------------------------|--------------------------------------|
| Playwright perf/benchmark | `packages/testing/playwright/reporters/metrics-reporter.ts`| Any metric attached via `attachMetric()` |
| Container stack           | `packages/testing/containers/telemetry.ts`                 | E2E stack startup times per service  |

`CONTAINER_TELEMETRY_VERBOSE=1` prints the container-stack breakdown locally
without any webhook.

## Payload Shape

If a webhook is configured, both emitters send:

```json
{
  "timestamp": "2026-03-16T12:00:00.000Z",
  "benchmark_name": "kafka-throughput-10n-10kb",
  "git":    { "sha": "abc12345", "branch": "master", "pr": null },
  "ci":     { "runId": "123", "runUrl": "...", "job": "test", "workflow": "CI", "attempt": 1 },
  "runner": { "provider": "github", "cpuCores": 4, "memoryGb": 15.6 },
  "metrics": [
    { "metric_name": "exec-per-sec", "value": 12.4, "unit": "exec/s", "dimensions": { "trigger": "kafka", "nodes": 10 } }
  ]
}
```

`runner.provider` is `local` outside CI, `github` when
`RUNNER_ENVIRONMENT=github-hosted`, otherwise `self-hosted`.

## Attaching a Metric in a Playwright Test

```typescript
import { attachMetric } from '../utils/performance-helper';

await attachMetric(testInfo, 'my-metric', 42.0, 'ms', { context: 'value' });
```
