import type { TestInfo } from '@playwright/test';
import { promises as fs } from 'fs';

/**
 * Failure diagnostics for replayed Instance AI runs.
 *
 * A replay diverges when the agent makes a request the recording has no
 * response for. The UI only shows the resulting error, so on failure we attach
 * the LLM exchanges the proxy saw. Each request ends with the result of the tool
 * the previous response asked for, so the list doubles as the live tool trace
 * (the tool-trace endpoint returns the loaded recording during replay).
 */

const TEXT_PREVIEW_LENGTH = 600;
const SENSITIVE_HEADERS = new Set(['x-api-key', 'authorization', 'cookie', 'set-cookie']);

type ProxyExchange = {
	httpRequest?: unknown;
	httpResponse?: unknown;
	timestamp?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function preview(value: unknown): string {
	const text = typeof value === 'string' ? value : (JSON.stringify(value) ?? '');
	return text.length > TEXT_PREVIEW_LENGTH
		? `${text.slice(0, TEXT_PREVIEW_LENGTH)}… (${text.length} chars)`
		: text;
}

/** MockServer reports a body as a raw string or as `{ type, string | json }`. */
function getBodyText(body: unknown): string | undefined {
	if (typeof body === 'string') return body;
	if (!isRecord(body)) return undefined;
	if (typeof body['string'] === 'string') return body['string'];
	return body.json === undefined ? undefined : JSON.stringify(body.json);
}

function parseJson(text: string | undefined): unknown {
	if (text === undefined) return undefined;
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}

function summarizeBlock(block: unknown): unknown {
	if (!isRecord(block)) return preview(block);

	switch (block.type) {
		case 'text':
			return { type: 'text', text: preview(block.text) };
		case 'tool_use':
			return { type: 'tool_use', name: block.name, input: preview(block.input) };
		case 'tool_result':
			return {
				type: 'tool_result',
				...(block.is_error === true ? { isError: true } : {}),
				content: preview(block.content),
			};
		default:
			return { type: block.type };
	}
}

function summarizeLastMessage(messages: unknown): unknown {
	if (!Array.isArray(messages) || messages.length === 0) return undefined;

	const last: unknown = messages[messages.length - 1];
	if (!isRecord(last)) return undefined;

	const content = last.content;
	return {
		role: last.role,
		content: Array.isArray(content) ? content.map(summarizeBlock) : preview(content),
	};
}

function getSystemPromptStart(system: unknown): string | undefined {
	const text = typeof system === 'string' ? system : JSON.stringify(system);
	return text?.slice(0, 120);
}

/** Tool calls the model asked for in a streamed (SSE) or plain JSON response. */
function getRequestedToolNames(responseText: string | undefined): string[] {
	if (!responseText) return [];
	return [...responseText.matchAll(/"type":\s*"tool_use"[^{}]*?"name":\s*"([^"]+)"/g)].map(
		(match) => match[1],
	);
}

function redactHeaders(headers: unknown): unknown {
	if (!isRecord(headers)) return headers;
	return Object.fromEntries(
		Object.entries(headers).map(([name, value]) => [
			name,
			SENSITIVE_HEADERS.has(name.toLowerCase()) ? ['<redacted>'] : value,
		]),
	);
}

function isLlmExchange(exchange: ProxyExchange): boolean {
	return isRecord(exchange.httpRequest) && exchange.httpRequest.path === '/v1/messages';
}

export function summarizeLlmExchanges(exchanges: ProxyExchange[]): unknown[] {
	return exchanges.filter(isLlmExchange).map((exchange, index) => {
		const request = isRecord(exchange.httpRequest) ? exchange.httpRequest : {};
		const response = isRecord(exchange.httpResponse) ? exchange.httpResponse : {};
		const requestBody = parseJson(getBodyText(request.body));
		const responseText = getBodyText(response.body);
		const toolNames = getRequestedToolNames(responseText);

		return {
			index,
			timestamp: exchange.timestamp,
			system: isRecord(requestBody) ? getSystemPromptStart(requestBody.system) : undefined,
			messageCount:
				isRecord(requestBody) && Array.isArray(requestBody.messages)
					? requestBody.messages.length
					: undefined,
			lastMessage: isRecord(requestBody) ? summarizeLastMessage(requestBody.messages) : undefined,
			responseStatus: response.statusCode,
			responseHeaders: redactHeaders(response.headers),
			...(toolNames.length > 0
				? { responseToolCalls: toolNames }
				: { responseBody: preview(responseText) }),
		};
	});
}

async function attachJson(
	testInfo: TestInfo,
	name: string,
	load: () => Promise<unknown>,
): Promise<void> {
	let body: string;
	try {
		body = JSON.stringify(await load(), null, 2);
	} catch (error) {
		body = JSON.stringify({
			error: `Could not collect ${name}: ${error instanceof Error ? error.message : String(error)}`,
		});
	}

	// Written to the output dir so it sits next to the video and trace.
	const path = testInfo.outputPath(name);
	await fs.writeFile(path, body);
	await testInfo.attach(name, { path, contentType: 'application/json' });
}

export async function attachReplayDiagnostics(
	testInfo: TestInfo,
	getProxyExchanges: () => Promise<ProxyExchange[]>,
): Promise<void> {
	await attachJson(testInfo, 'instance-ai-llm-exchanges.json', async () =>
		summarizeLlmExchanges(await getProxyExchanges()),
	);
}
