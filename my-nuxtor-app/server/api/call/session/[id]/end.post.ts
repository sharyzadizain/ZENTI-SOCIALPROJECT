import type { CallRole } from "../../../../utils/callStore";
import { appendSignal, getCallSession } from "../../../../utils/callStore";

interface EndBody {
	by?: CallRole
}

function isRole(value: unknown): value is CallRole {
	return value === "blind" || value === "volunteer";
}

export default defineEventHandler(async (event) => {
	const sessionId = String(getRouterParam(event, "id") || "").trim();
	if (!sessionId) {
		throw createError({
			statusCode: 400,
			statusMessage: "Session id is required."
		});
	}

	const body = await readBody<EndBody>(event);
	if (!isRole(body?.by)) {
		throw createError({
			statusCode: 400,
			statusMessage: "Body `by` must be `blind` or `volunteer`."
		});
	}

	const signal = appendSignal(sessionId, body.by, "end", {
		reason: "manual"
	});

	if (!signal) {
		throw createError({
			statusCode: 404,
			statusMessage: "Session not found."
		});
	}

	const session = getCallSession(sessionId);

	return {
		ok: true,
		status: session?.status || "ended",
		endedAt: session?.endedAt || Date.now()
	};
});
