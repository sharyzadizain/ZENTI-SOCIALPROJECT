import { getCallSession } from "../../../../utils/callStore";

export default defineEventHandler((event) => {
	const sessionId = String(getRouterParam(event, "id") || "").trim();
	if (!sessionId) {
		throw createError({
			statusCode: 400,
			statusMessage: "Session id is required."
		});
	}

	const session = getCallSession(sessionId);
	if (!session) {
		throw createError({
			statusCode: 404,
			statusMessage: "Session not found."
		});
	}

	return {
		sessionId: session.id,
		status: session.status,
		createdAt: session.createdAt,
		matchedAt: session.matchedAt,
		endedAt: session.endedAt,
		blindProfileId: session.blindProfileId,
		blindName: session.blindName,
		blindInterests: session.blindInterests,
		volunteerProfileId: session.volunteerProfileId,
		volunteerProfileDocumentId: session.volunteerProfileDocumentId,
		volunteerName: session.volunteerName
	};
});
