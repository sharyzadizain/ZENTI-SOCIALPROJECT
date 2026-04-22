export type CallRole = "blind" | "volunteer";
export type CallSignalType = "offer" | "answer" | "candidate" | "end";
export type CallStatus = "waiting" | "matched" | "ended" | "expired";

interface CreateSessionResponse {
	sessionId: string
	status: CallStatus
	createdAt: number
	blindProfileId?: number | null
	blindName?: string
	blindInterests?: string
	volunteerProfileId?: number | null
	volunteerProfileDocumentId?: string
	volunteerName?: string
}

interface ClaimSessionResponse {
	found: boolean
	sessionId?: string
	status?: CallStatus
	matchedAt?: number | null
	blindProfileId?: number | null
	blindName?: string
	blindInterests?: string
	volunteerProfileId?: number | null
	volunteerProfileDocumentId?: string
	volunteerName?: string
}

interface SessionStatusResponse {
	sessionId: string
	status: CallStatus
	createdAt: number
	matchedAt: number | null
	endedAt: number | null
	blindProfileId?: number | null
	blindName?: string
	blindInterests?: string
	volunteerProfileId?: number | null
	volunteerProfileDocumentId?: string
	volunteerName?: string
}

interface CreateHelpRequestInput {
	blindProfileId?: number | null
	blindName?: string
	blindInterests?: string
}

interface ClaimHelpRequestInput {
	volunteerProfileId?: number | null
	volunteerProfileDocumentId?: string
	volunteerName?: string
}

interface SignalResponse {
	ok: boolean
	seq: number
	status: CallStatus
}

export interface CallSignalItem {
	seq: number
	from: CallRole
	type: CallSignalType
	payload: any
	createdAt: number
}

interface SignalsResponse {
	sessionId: string
	status: CallStatus
	items: CallSignalItem[]
}

interface EndSessionResponse {
	ok: boolean
	status: CallStatus
	endedAt: number
}

interface WaitingStatsResponse {
	waitingBlindCount: number
	measuredAt: number
}

export function useCallMatching() {
	const currentSessionId = useState<string | null>("call_current_session_id", () => null);

	function setCurrentSessionId(sessionId: string | null): void {
		currentSessionId.value = sessionId ? sessionId.trim() : null;
	}

	async function createHelpRequest(input: CreateHelpRequestInput = {}): Promise<string> {
		const payload = await $fetch<CreateSessionResponse>("/api/call/session/create", {
			method: "POST",
			body: {
				blindProfileId: input.blindProfileId ?? null,
				blindName: String(input.blindName || "").trim(),
				blindInterests: String(input.blindInterests || "").trim()
			}
		});

		setCurrentSessionId(payload.sessionId);
		return payload.sessionId;
	}

	async function claimHelpRequest(input: ClaimHelpRequestInput = {}): Promise<ClaimSessionResponse> {
		const payload = await $fetch<ClaimSessionResponse>("/api/call/match/claim", {
			method: "POST",
			body: {
				volunteerProfileId: input.volunteerProfileId ?? null,
				volunteerProfileDocumentId: String(input.volunteerProfileDocumentId || "").trim(),
				volunteerName: String(input.volunteerName || "").trim()
			}
		});

		if (payload.found && payload.sessionId) {
			setCurrentSessionId(payload.sessionId);
		}

		return payload;
	}

	async function getSessionStatus(sessionId: string): Promise<SessionStatusResponse> {
		return await $fetch<SessionStatusResponse>(`/api/call/session/${encodeURIComponent(sessionId)}/status`);
	}

	async function sendSignal(
		sessionId: string,
		from: CallRole,
		type: CallSignalType,
		payload: any
	): Promise<SignalResponse> {
		return await $fetch<SignalResponse>(`/api/call/session/${encodeURIComponent(sessionId)}/signal`, {
			method: "POST",
			body: {
				from,
				type,
				payload
			}
		});
	}

	async function fetchSignals(
		sessionId: string,
		forRole: CallRole,
		afterSeq: number
	): Promise<SignalsResponse> {
		return await $fetch<SignalsResponse>(`/api/call/session/${encodeURIComponent(sessionId)}/signals`, {
			query: {
				for: forRole,
				after: Math.max(0, Math.floor(afterSeq))
			}
		});
	}

	async function endSession(sessionId: string, by: CallRole): Promise<EndSessionResponse> {
		return await $fetch<EndSessionResponse>(`/api/call/session/${encodeURIComponent(sessionId)}/end`, {
			method: "POST",
			body: {
				by
			}
		});
	}

	async function getWaitingBlindCount(): Promise<number> {
		const payload = await $fetch<WaitingStatsResponse>("/api/call/stats/waiting");
		const count = Number(payload?.waitingBlindCount);
		return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
	}

	return {
		currentSessionId,
		setCurrentSessionId,
		createHelpRequest,
		claimHelpRequest,
		getSessionStatus,
		sendSignal,
		fetchSignals,
		endSession,
		getWaitingBlindCount
	};
}
