#!/usr/bin/env node
/**
 * Guards against CI fetching anything from upstream n8n: `n8n-io/*` actions,
 * repos, charts or release APIs, and `n8nio/*` / `ghcr.io/n8n-io/*` images.
 * Everything CI and the get-n8n installer pull must come from 519lab's forks
 * and registries (ghcr.io/519lab). Locally built `n8nio/*:local` images are
 * fine: they never leave the machine.
 *
 * Only the files that decide what CI and the installer fetch are scanned, and
 * comment lines are skipped, so prose that mentions upstream doesn't trip it.
 *
 * Usage: node scripts/check-no-upstream-sources.mjs
 * Exit: 0 clean · 1 upstream source found.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const UPSTREAM_PATTERNS = [
	{ pattern: /\bn8n-io\//, reason: 'n8n-io repository, action or registry' },
	{ pattern: /\bdocker\.io\/n8nio\//, reason: 'Docker Hub n8nio image' },
	{ pattern: /\bdocker\.n8n\.io\//, reason: "n8n's Docker registry" },
	{ pattern: /(?<![\w./-])n8nio\/[\w.-]+:(?!local\b)[\w.${}-]+/, reason: 'n8nio image (only :local is built here)' },
];

// Whole-line comments in YAML/shell (#) and TS (//, /*, *).
const COMMENT_LINE = /^\s*(#|\/\/|\/\*|\*)/;

/**
 * @param {string} content
 * @returns {Array<{ line: number, text: string, reason: string }>}
 */
export function findUpstreamSources(content) {
	const findings = [];
	content.split('\n').forEach((text, i) => {
		if (COMMENT_LINE.test(text)) return;
		for (const { pattern, reason } of UPSTREAM_PATTERNS) {
			if (pattern.test(text)) {
				findings.push({ line: i + 1, text: text.trim(), reason });
				break;
			}
		}
	});
	return findings;
}

function filesToScan() {
	const files = [];
	const walk = (dir, match) => {
		if (!existsSync(dir)) return;
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) walk(full, match);
			else if (match.test(entry.name)) files.push(full);
		}
	};
	walk(join(root, '.github/workflows'), /\.ya?ml$/);
	walk(join(root, '.github/actions'), /^action\.ya?ml$/);
	for (const rel of [
		'docker/get-n8n.sh',
		'docker/get-n8n-compose.yml',
		'packages/testing/containers/test-containers.ts',
		'packages/testing/containers/helm-stack.ts',
	]) {
		const full = join(root, rel);
		if (existsSync(full)) files.push(full);
	}
	return files;
}

function main() {
	let failed = false;
	for (const file of filesToScan()) {
		for (const { line, text, reason } of findUpstreamSources(readFileSync(file, 'utf8'))) {
			failed = true;
			console.error(`${relative(root, file)}:${line}: ${reason}\n    ${text}`);
		}
	}
	if (failed) {
		console.error(
			'\nCI and the installer must not pull from upstream n8n. Use a 519lab fork or a ghcr.io/519lab image.',
		);
		process.exit(1);
	}
	console.log('No upstream n8n sources in CI.');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
