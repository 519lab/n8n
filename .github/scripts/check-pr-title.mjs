/**
 * Validates a PR title against .github/pull_request_title_conventions.md:
 * `<type>(<scope>)!: <Summary>`, scope optional, `!` marks a breaking change.
 *
 * Usage (CI): PR_TITLE="feat(editor): Add X" node .github/scripts/check-pr-title.mjs
 */

const TYPES = ['build', 'ci', 'chore', 'docs', 'feat', 'fix', 'perf', 'refactor', 'revert', 'test'];

const SCOPES = ['API', 'benchmark', 'core', 'editor', 'ai-builder'];

// A node scope is the node name followed by " Node", e.g. "Microsoft To Do Node".
const NODE_SCOPE = /^\S.* Node$/;

const HEADER = /^(?<type>[a-z]+)(?:\((?<scopes>[^)]*)\))?(?<breaking>!)?: (?<summary>\S.*)$/;

/**
 * @param {string} title
 * @returns {string[]} the problems found; empty when the title is valid
 */
export function validatePrTitle(title) {
	const match = HEADER.exec(title.trim());
	if (!match?.groups) {
		return ['Title must look like `<type>(<scope>): <Summary>` (the scope is optional).'];
	}

	const { type, scopes, summary } = match.groups;
	const errors = [];

	if (!TYPES.includes(type)) {
		errors.push(`Unknown type \`${type}\`. Use one of: ${TYPES.join(', ')}.`);
	}

	if (scopes !== undefined) {
		for (const scope of scopes.split(',').map((s) => s.trim())) {
			if (!SCOPES.includes(scope) && !NODE_SCOPE.test(scope)) {
				errors.push(
					`Unknown scope \`${scope}\`. Use one of: ${SCOPES.join(', ')}, or \`<Name> Node\`; otherwise omit the scope.`,
				);
			}
		}
	}

	// A revert's summary is the header of the reverted change, so validate it as one.
	if (type === 'revert') {
		return [...errors, ...validatePrTitle(summary)];
	}

	if (/^[a-z]/.test(summary)) {
		errors.push('Summary must start with a capital letter.');
	}
	if (summary.endsWith('.')) {
		errors.push('Summary must not end with a period.');
	}

	return errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const title = process.env.PR_TITLE ?? '';
	const errors = validatePrTitle(title);
	if (errors.length > 0) {
		console.error(`Invalid PR title: ${title}`);
		for (const error of errors) console.error(`::error::${error}`);
		console.error('See .github/pull_request_title_conventions.md');
		process.exit(1);
	}
	console.log(`PR title OK: ${title}`);
}
