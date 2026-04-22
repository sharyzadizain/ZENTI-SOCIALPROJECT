import { randomUUID } from "node:crypto";

export type CallRole = "blind" | "volunteer";
export type CallStatus = "waiting" | "matched" | "ended" | "expired";
export type CallSignalType = "offer" | "answer" | "candidate" | "end";

export interface CallSignal {
	seq: number
	from: CallRole
	type: CallSignalType
	payload: any
	createdAt: number
}

export interface CallSession {
	id: string
	status: CallStatus
	createdAt: number
	updatedAt: number
	matchedAt: number | null
	endedAt: number | null
	blindProfileId: number | null
	blindName: string
	blindInterests: string
	volunteerProfileId: number | null
	volunteerProfileDocumentId: string
	volunteerName: string
	signals: CallSignal[]
	nextSeq: number
}

interface CallStore {
	sessions: Map<string, CallSession>
}

const WAITING_TTL_MS = 45_000;
const MATCHED_TTL_MS = 20 * 60_000;
const FINALIZED_TTL_MS = 5 * 60_000;
const MAX_SIGNAL_BUFFER = 500;

function now(): number {
	return Date.now();
}

function normalizeProfileId(value: unknown): number | null {
	const id = Number(value);
	if (!Number.isFinite(id) || id <= 0) {
		return null;
	}

	return Math.floor(id);
}

function normalizePersonName(value: unknown): string {
	const raw = String(value || "").trim();
	if (!raw) {
		return "";
	}

	return raw.slice(0, 80);
}

function normalizeDocumentId(value: unknown): string {
	const raw = String(value || "").trim();
	return raw ? raw.slice(0, 120) : "";
}

function normalizeBlindInterests(value: unknown): string {
	const raw = String(value || "").replace(/\s+/g, " ").trim();
	if (!raw) {
		return "";
	}

	return raw.slice(0, 360);
}

function getGlobalStore(): CallStore {
	const globalState = globalThis as typeof globalThis & { __CALL_STORE__?: CallStore };
	if (!globalState.__CALL_STORE__) {
		globalState.__CALL_STORE__ = {
			sessions: new Map<string, CallSession>()
		};
	}

	return globalState.__CALL_STORE__;
}

function ensureSessionStateByTime(session: CallSession, timestamp: number): void {
	if (session.status === "waiting" && timestamp - session.createdAt > WAITING_TTL_MS) {
		session.status = "expired";
		session.updatedAt = timestamp;
	}

	if (session.status === "matched" && timestamp - session.updatedAt > MATCHED_TTL_MS) {
		session.status = "ended";
		session.endedAt = timestamp;
		session.updatedAt = timestamp;
	}
}

function cleanupStore(): void {
	const store = getGlobalStore();
	const timestamp = now();

	for (const [sessionId, session] of store.sessions.entries()) {
		ensureSessionStateByTime(session, timestamp);

		const finalizedAt = session.endedAt || session.updatedAt;
		const isFinalized = session.status === "ended" || session.status === "expired";
		if (isFinalized && timestamp - finalizedAt > FINALIZED_TTL_MS) {
			store.sessions.delete(sessionId);
		}
	}
}

function findSession(sessionId: string): CallSession | null {
	cleanupStore();
	const store = getGlobalStore();
	const session = store.sessions.get(sessionId);
	if (!session) {
		return null;
	}

	ensureSessionStateByTime(session, now());
	return session;
}

interface CreateCallSessionInput {
	blindProfileId?: number | null
	blindName?: string
	blindInterests?: string
}

export function createCallSession(input: CreateCallSessionInput = {}): CallSession {
	cleanupStore();
	const store = getGlobalStore();
	const timestamp = now();
	const session: CallSession = {
		id: randomUUID(),
		status: "waiting",
		createdAt: timestamp,
		updatedAt: timestamp,
		matchedAt: null,
		endedAt: null,
		blindProfileId: normalizeProfileId(input.blindProfileId),
		blindName: normalizePersonName(input.blindName),
		blindInterests: normalizeBlindInterests(input.blindInterests),
		volunteerProfileId: null,
		volunteerProfileDocumentId: "",
		volunteerName: "",
		signals: [],
		nextSeq: 1
	};

	store.sessions.set(session.id, session);
	return session;
}

interface ClaimWaitingSessionInput {
	volunteerProfileId?: number | null
	volunteerProfileDocumentId?: string
	volunteerName?: string
}

export function claimWaitingSession(input: ClaimWaitingSessionInput = {}): CallSession | null {
	cleanupStore();
	const store = getGlobalStore();
	const timestamp = now();

	const waitingSession = [...store.sessions.values()]
		.filter(session => session.status === "waiting")
		.sort((a, b) => a.createdAt - b.createdAt)[0];

	if (!waitingSession) {
		return null;
	}

	waitingSession.status = "matched";
	waitingSession.matchedAt = timestamp;
	waitingSession.updatedAt = timestamp;
	waitingSession.volunteerProfileId = normalizeProfileId(input.volunteerProfileId);
	waitingSession.volunteerProfileDocumentId = normalizeDocumentId(input.volunteerProfileDocumentId);
	waitingSession.volunteerName = normalizePersonName(input.volunteerName);
	return waitingSession;
}

export function getCallSession(sessionId: string): CallSession | null {
	return findSession(sessionId);
}

export function appendSignal(
	sessionId: string,
	from: CallRole,
	type: CallSignalType,
	payload: any
): CallSignal | null {
	const session = findSession(sessionId);
	if (!session) {
		return null;
	}

	const timestamp = now();
	const signal: CallSignal = {
		seq: session.nextSeq,
		from,
		type,
		payload,
		createdAt: timestamp
	};
	session.nextSeq += 1;
	session.signals.push(signal);
	session.updatedAt = timestamp;

	if (type === "end") {
		session.status = "ended";
		session.endedAt = timestamp;
	}

	if (session.signals.length > MAX_SIGNAL_BUFFER) {
		session.signals.splice(0, session.signals.length - MAX_SIGNAL_BUFFER);
	}

	return signal;
}

export function getSignalsForRole(
	sessionId: string,
	forRole: CallRole,
	afterSeq: number
): CallSignal[] | null {
	const session = findSession(sessionId);
	if (!session) {
		return null;
	}

	return session.signals.filter(signal => signal.seq > afterSeq && signal.from !== forRole);
}

export function getWaitingBlindCount(): number {
	cleanupStore();
	const store = getGlobalStore();

	const waitingSessions = [...store.sessions.values()]
		.filter(session => session.status === "waiting");
	if (!waitingSessions.length) {
		return 0;
	}

	const uniqueBlindProfiles = new Set<number>();
	let anonymousCount = 0;

	for (const session of waitingSessions) {
		if (session.blindProfileId && session.blindProfileId > 0) {
			uniqueBlindProfiles.add(session.blindProfileId);
			continue;
		}

		anonymousCount += 1;
	}

	return uniqueBlindProfiles.size + anonymousCount;
}
