import type { CallRole } from "../../../../utils/callStore";
import { getCallSession, getSignalsForRole } from "../../../../utils/callStore";

function isRole(value: unknown): value is CallRole {
	return value === "blind" || value === "volunteer";
}

export default defineEventHandler((event) => {
	const sessionId = String(getRouterParam(event, "id") || "").trim();
	if (!sessionId) {
		throw createError({
			statusCode: 400,
			statusMessage: "Session id is required."
		});
	}

	const query = getQuery(event);
	const forRoleRaw = String(query.for || "").trim();
	if (!isRole(forRoleRaw)) {
		throw createError({
			statusCode: 400,
			statusMessage: "Query `for` must be `blind` or `volunteer`."
		});
	}

	const afterSeqRaw = Number(query.after || 0);
	const afterSeq = Number.isFinite(afterSeqRaw) ? Math.max(0, Math.floor(afterSeqRaw)) : 0;

	const signals = getSignalsForRole(sessionId, forRoleRaw, afterSeq);
	if (!signals) {
		throw createError({
			statusCode: 404,
			statusMessage: "Session not found."
		});
	}

	const session = getCallSession(sessionId);

	return {
		sessionId,
		status: session?.status || "ended",
		items: signals.map(signal => ({
			seq: signal.seq,
			from: signal.from,
			type: signal.type,
			payload: signal.payload,
			createdAt: signal.createdAt
		}))
	};
});
