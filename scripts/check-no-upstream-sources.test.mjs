/**
 * Run: node --test scripts/check-no-upstream-sources.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { findUpstreamSources } from './check-no-upstream-sources.mjs';

const flagged = (content) => findUpstreamSources(content).map((f) => f.line);

describe('findUpstreamSources', () => {
	it('flags upstream actions, repos and registries', () => {
		assert.deepEqual(
			flagged(
				[
					'      - uses: n8n-io/validate-n8n-pull-request-title@abc # v2',
					"const DEFAULT_CHART_REPO = 'https://github.com/n8n-io/n8n-hosting.git';",
					'    image: ghcr.io/n8n-io/runners:${N8N_VERSION}',
					'    image: docker.io/n8nio/n8n:${N8N_VERSION}',
					'  repository: docker.n8n.io/n8nio/n8n',
					"	sandboxApi: 'n8nio/n8n-sandbox-service-api:latest',",
				].join('\n'),
			),
			[1, 2, 3, 4, 5, 6],
		);
	});

	it('allows 519lab sources and locally built :local images', () => {
		assert.deepEqual(
			flagged(
				[
					'    image: ghcr.io/519lab/n8n:${N8N_VERSION}',
					"	n8n: 'n8nio/n8n:local',",
					"  TEST_IMAGE_N8N: 'n8nio/n8n:local'",
					'        docker save n8nio/n8n:local n8nio/runners:local | zstd -T0 -3 -o /tmp/x',
					"description: 'Builds n8nio/n8n + n8nio/runners test images'",
				].join('\n'),
			),
			[],
		);
	});

	it('ignores comment lines', () => {
		assert.deepEqual(
			flagged(
				[
					'# fork of n8n-io/n8n',
					'// the chart otherwise pulls n8nio/runners:nightly',
					' *   TEST_IMAGE_N8N=ghcr.io/n8n-io/n8n:pr-123',
				].join('\n'),
			),
			[],
		);
	});

	it('reports the line number', () => {
		assert.equal(findUpstreamSources('ok\nuses: n8n-io/x@y')[0].line, 2);
	});
});
