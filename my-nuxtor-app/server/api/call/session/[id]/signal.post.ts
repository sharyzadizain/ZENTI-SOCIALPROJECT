import type { CallRole, CallSignalType } from "../../../../utils/callStore";
import { appendSignal, getCallSession } from "../../../../utils/callStore";

interface SignalBody {
	from?: CallRole
	type?: CallSignalType
	payload?: any
}

function isRole(value: unknown): value is CallRole {
	return value === "blind" || value === "volunteer";
}

function isSignalType(value: unknown): value is CallSignalType {
	return value === "offer" || value === "answer" || value === "candidate" || value === "end";
}

export default defineEventHandler(async (event) => {
	const sessionId = String(getRouterParam(event, "id") || "").trim();
	if (!sessionId) {
		throw createError({
			statusCode: 400,
			statusMessage: "Session id is required."
		});
	}

	const body = await readBody<SignalBody>(event);
	if (!isRole(body?.from)) {
		throw createError({
			statusCode: 400,
			statusMessage: "Invalid `from` role."
		});
	}

	if (!isSignalType(body?.type)) {
		throw createError({
			statusCode: 400,
			statusMessage: "Invalid signal type."
		});
	}

	const signal = appendSignal(sessionId, body.from, body.type, body.payload ?? null);
	if (!signal) {
		throw createError({
			statusCode: 404,
			statusMessage: "Session not found."
		});
	}

	const session = getCallSession(sessionId);
	return {
		ok: true,
		seq: signal.seq,
		status: session?.status || "ended"
	};
});
