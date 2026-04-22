interface AssistantRequestBody {
	agentId?: string | number
	message?: string
	sessionId?: string
	tweaks?: Record<string, Record<string, unknown>>
}

interface LangflowMessagePayload {
	text?: string
	data?: {
		text?: string
	}
}

interface LangflowResultPayload {
	message?: LangflowMessagePayload
	text?: {
		text?: string
	} | string
}

interface LangflowOutputItem {
	results?: LangflowResultPayload
}

interface LangflowRunOutput {
	outputs?: LangflowOutputItem[]
}

interface LangflowRunResponse {
	session_id?: string
	outputs?: LangflowRunOutput[] | Record<string, { content?: string }>
}

interface AssistantAgentConfig {
	id: string
	name: string
	flowId: string
}

interface RuntimeConfigShape {
	langflowBaseUrl?: string
	langflowApiKey?: string
	langflowTimeoutMs?: number | string
	langflowCallAssistant1FlowId?: string
	langflowCallAssistant2FlowId?: string
	langflowCallAssistant3FlowId?: string
	langflowCallAssistant4FlowId?: string
	langflowCallAssistant1Name?: string
	langflowCallAssistant2Name?: string
	langflowCallAssistant3Name?: string
	langflowCallAssistant4Name?: string
}

const MAX_MESSAGE_LENGTH = 4000;

function normalizeAgentId(raw: unknown): string {
	const value = String(raw ?? "1").trim();
	return ["1", "2", "3", "4"].includes(value) ? value : "1";
}

function getSafeTimeoutMs(raw: unknown): number {
	const parsed = Number(raw);
	if (!Number.isFinite(parsed)) {
		return 30000;
	}

	const safe = Math.floor(parsed);
	return Math.max(1000, Math.min(120000, safe));
}

function normalizeBaseUrl(raw: unknown): string {
	return String(raw || "").trim().replace(/\/+$/, "");
}

function resolveAssistantConfig(runtimeConfig: RuntimeConfigShape, agentId: string): AssistantAgentConfig {
	const flowIdMap: Record<string, string> = {
		"1": String(runtimeConfig.langflowCallAssistant1FlowId || "").trim(),
		"2": String(runtimeConfig.langflowCallAssistant2FlowId || "").trim(),
		"3": String(runtimeConfig.langflowCallAssistant3FlowId || "").trim(),
		"4": String(runtimeConfig.langflowCallAssistant4FlowId || "").trim()
	};

	const nameMap: Record<string, string> = {
		"1": String(runtimeConfig.langflowCallAssistant1Name || "Олеся AI").trim(),
		"2": String(runtimeConfig.langflowCallAssistant2Name || "Олеся AI").trim(),
		"3": String(runtimeConfig.langflowCallAssistant3Name || "Assistant 3").trim(),
		"4": String(runtimeConfig.langflowCallAssistant4Name || "Assistant 4").trim()
	};

	return {
		id: agentId,
		flowId: flowIdMap[agentId] || "",
		name: nameMap[agentId] || `Assistant ${agentId}`
	};
}

function extractTextFromOutputs(response: LangflowRunResponse): string {
	if (Array.isArray(response.outputs)) {
		for (const root of response.outputs) {
			for (const output of root.outputs || []) {
				const messageText = String(output.results?.message?.text || output.results?.message?.data?.text || "").trim();
				if (messageText) {
					return messageText;
				}

				const textResult = output.results?.text;
				if (typeof textResult === "string" && textResult.trim()) {
					return textResult.trim();
				}

				if (textResult && typeof textResult === "object") {
					const nestedText = String(textResult.text || "").trim();
					if (nestedText) {
						return nestedText;
					}
				}
			}
		}
	}

	if (response.outputs && !Array.isArray(response.outputs)) {
		for (const value of Object.values(response.outputs)) {
			const text = String(value?.content || "").trim();
			if (text) {
				return text;
			}
		}
	}

	return "";
}

export default defineEventHandler(async (event) => {
	const runtimeConfig = useRuntimeConfig(event) as RuntimeConfigShape;
	const body = await readBody<AssistantRequestBody>(event);
	const message = String(body?.message || "").trim();
	const agentId = normalizeAgentId(body?.agentId);
	const sessionId = String(body?.sessionId || "").trim();
	const baseUrl = normalizeBaseUrl(runtimeConfig.langflowBaseUrl);
	const apiKey = String(runtimeConfig.langflowApiKey || "").trim();
	const timeoutMs = getSafeTimeoutMs(runtimeConfig.langflowTimeoutMs);

	if (!message) {
		throw createError({
			statusCode: 400,
			statusMessage: "Message is required"
		});
	}

	if (message.length > MAX_MESSAGE_LENGTH) {
		throw createError({
			statusCode: 400,
			statusMessage: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters)`
		});
	}

	if (!baseUrl) {
		throw createError({
			statusCode: 503,
			statusMessage: "Langflow is not configured (NUXT_LANGFLOW_BASE_URL is empty)"
		});
	}

	const assistantConfig = resolveAssistantConfig(runtimeConfig, agentId);
	if (!assistantConfig.flowId) {
		throw createError({
			statusCode: 503,
			statusMessage: `Langflow flow for assistant ${agentId} is not configured`
		});
	}

	const headers: Record<string, string> = {
		"Content-Type": "application/json"
	};
	if (apiKey) {
		headers["x-api-key"] = apiKey;
	}

	const requestPayload: Record<string, unknown> = {
		input_value: message,
		input_type: "chat",
		output_type: "chat"
	};

	if (sessionId) {
		requestPayload.session_id = sessionId;
	}

	if (body?.tweaks && typeof body.tweaks === "object") {
		requestPayload.tweaks = body.tweaks;
	}

	let response: LangflowRunResponse;
	try {
		response = await $fetch<LangflowRunResponse>(
			`${baseUrl}/api/v1/run/${encodeURIComponent(assistantConfig.flowId)}?stream=false`,
			{
				method: "POST",
				headers,
				body: requestPayload,
				timeout: timeoutMs
			}
		);
	} catch (error) {
		throw createError({
			statusCode: 502,
			statusMessage: "Failed to call Langflow",
			data: {
				reason: error instanceof Error ? error.message : "Unknown error"
			}
		});
	}

	const reply = extractTextFromOutputs(response);
	if (!reply) {
		throw createError({
			statusCode: 502,
			statusMessage: "Langflow returned an empty response"
		});
	}

	return {
		ok: true,
		agentId: assistantConfig.id,
		agentName: assistantConfig.name,
		sessionId: String(response.session_id || sessionId || ""),
		reply
	};
});
