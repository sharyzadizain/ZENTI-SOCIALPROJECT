import { claimWaitingSession } from "../../../utils/callStore";

interface ClaimBody {
	volunteerProfileId?: number | null
	volunteerProfileDocumentId?: string
	volunteerName?: string
}

export default defineEventHandler(async (event) => {
	const body = await readBody<ClaimBody>(event);
	const session = claimWaitingSession({
		volunteerProfileId: body?.volunteerProfileId,
		volunteerProfileDocumentId: body?.volunteerProfileDocumentId,
		volunteerName: body?.volunteerName
	});

	if (!session) {
		return {
			found: false
		};
	}

	return {
		found: true,
		sessionId: session.id,
		status: session.status,
		matchedAt: session.matchedAt,
		blindProfileId: session.blindProfileId,
		blindName: session.blindName,
		blindInterests: session.blindInterests,
		volunteerProfileId: session.volunteerProfileId,
		volunteerProfileDocumentId: session.volunteerProfileDocumentId,
		volunteerName: session.volunteerName
	};
});
