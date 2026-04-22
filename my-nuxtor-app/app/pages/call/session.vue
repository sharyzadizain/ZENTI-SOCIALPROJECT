<template>
	<main class="min-h-dvh bg-[#f4f4f5]">
		<section class="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-6 pb-8 pt-8 md:max-w-[1320px] md:px-10 lg:px-14">
			<p
				aria-live="polite"
				class="sr-only"
			>
				{{ statusMessage }}
			</p>

			<div class="mt-4 flex-1 rounded-[26px] bg-[#ececef] p-[8px] md:mx-auto md:w-full md:max-w-[1240px] md:p-3">
				<div class="relative h-full min-h-[680px] overflow-hidden rounded-[22px] bg-black md:min-h-0 md:h-[72vh] md:max-h-[860px]">
					<video
						ref="remoteVideo"
						autoplay
						muted
						playsinline
						class="h-full w-full object-cover"
					/>

					<div
						v-if="!hasRemoteVideo"
						class="absolute inset-0 flex items-center justify-center bg-black/45 text-center text-[28px] font-medium text-white/90"
					>
						Ожидаем видео...
					</div>

					<div class="absolute left-1/2 top-5 -translate-x-1/2 rounded-[24px] bg-gradient-to-r from-[#55b5ff] to-[#49a7f0] px-9 py-3 text-center text-[#f4f4f5]">
						<p class="text-[12px] leading-none font-medium opacity-80">
							Имя
						</p>
						<p class="mt-1 text-[28px] leading-none font-medium tracking-[-0.02em]">
							{{ blindDisplayName }}
						</p>
					</div>

					<CallSessionAssistantMenu
						assistant-id="2"
						assistant-name="Олеся AI"
						:blind-name="blindDisplayName"
						:blind-interests="blindInterestsForAssistant"
						:disabled="isEnding"
					/>
				</div>
			</div>

			<p
				v-if="errorMessage"
				class="sr-only"
			>
				{{ errorMessage }}
			</p>

			<button
				type="button"
				class="mx-auto mt-5 inline-flex h-[58px] min-w-[174px] flex-col items-center justify-center rounded-full bg-black px-8 text-center text-[#f4f4f5] ring-[5px] ring-[#4db3ff] transition disabled:opacity-70"
				:disabled="isEnding"
				@pointerdown="startEndCallHold"
				@pointerup="cancelEndCallHold"
				@pointerleave="cancelEndCallHold"
				@pointercancel="cancelEndCallHold"
			>
				<span class="text-[33px] leading-none font-medium tracking-[-0.02em]">
					Помощь оказана
				</span>
				<span class="mt-1 text-[16px] leading-none font-medium tracking-[-0.01em] text-[#f4f4f5]/85">
					(Зажми 5 секунд)
				</span>
			</button>

			<audio
				ref="remoteAudio"
				autoplay
				playsinline
			/>
		</section>
	</main>
</template>

<script setup lang="ts">
import type { CallSignalItem } from "~/composables/useCallMatching";

const SIGNAL_POLL_MS = 650;
const END_HOLD_MS = 5000;

const route = useRoute();
const call = useCallMatching();
const auth = useStrapiAuth();

const activeSessionId = computed(() => String(route.query.session || call.currentSessionId.value || "").trim());
const blindNameFromSession = ref("");
const blindInterestsFromSession = ref("");
const blindDisplayName = computed(() => {
	const raw = String(blindNameFromSession.value || route.query.name || "").trim();
	return raw || "Имя незрячего";
});
const blindInterestsForAssistant = computed(() => {
	const fromSession = String(blindInterestsFromSession.value || "").replace(/\s+/g, " ").trim();
	if (fromSession) {
		return fromSession;
	}

	return String(route.query.interests || "").replace(/\s+/g, " ").trim();
});

const statusMessage = ref("Подключаемся к звонку...");
const errorMessage = ref("");
const hasRemoteVideo = ref(false);
const isEnding = ref(false);
const wasCallConnected = ref(false);

const remoteVideo = useTemplateRef<HTMLVideoElement>("remoteVideo");
const remoteAudio = useTemplateRef<HTMLAudioElement>("remoteAudio");

let peerConnection: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let remoteStream: MediaStream | null = null;
let signalCursor = 0;
let signalPollTimer: ReturnType<typeof setTimeout> | null = null;
let signalPollInFlight = false;
let isPageActive = true;
const pendingRemoteCandidates: RTCIceCandidateInit[] = [];
let endCallHoldTimer: ReturnType<typeof setTimeout> | null = null;
let achievementsCreditInFlight = false;
let achievementsCreditApplied = false;
let callConnectedAtMs: number | null = null;

interface CompletedCallSummary {
	earnedAchievement: boolean
	achievementTitle: string
	achievementIconUrl: string
	callDurationMinutes: number
}

function emptyCallSummary(): CompletedCallSummary {
	return {
		earnedAchievement: false,
		achievementTitle: "",
		achievementIconUrl: "",
		callDurationMinutes: 0
	};
}

function markCallConnected(): void {
	wasCallConnected.value = true;
	if (callConnectedAtMs === null) {
		callConnectedAtMs = Date.now();
	}
}

function normalizeLegacyTotalMinutes(totalHoursValue: number, deedsCountValue: number): number {
	const safeTotal = Number.isFinite(totalHoursValue) ? Math.max(0, Math.round(totalHoursValue)) : 0;
	const safeDeeds = Number.isFinite(deedsCountValue) ? Math.max(0, Math.round(deedsCountValue)) : 0;

	// Legacy data stored "hours"; new logic stores minutes.
	if (safeTotal > 0 && safeTotal <= safeDeeds) {
		return safeTotal * 60;
	}

	return safeTotal;
}

function calculateCompletedCallMinutes(): number {
	if (callConnectedAtMs === null) {
		return 0;
	}

	const elapsedMs = Math.max(0, Date.now() - callConnectedAtMs);
	const elapsedMinutes = Math.ceil(elapsedMs / 60000);
	return Math.max(1, elapsedMinutes);
}

async function maybeCreditCompletedCall(): Promise<CompletedCallSummary> {
	const completedCallMinutes = calculateCompletedCallMinutes();

	if (achievementsCreditApplied || achievementsCreditInFlight || !wasCallConnected.value) {
		return emptyCallSummary();
	}

	achievementsCreditInFlight = true;
	try {
		if (!auth.profile.value) {
			try {
				await auth.restoreSession();
			} catch {
				// noop
			}
		}

		const currentProfile = auth.profile.value;
		if (!currentProfile) {
			return {
				...emptyCallSummary(),
				callDurationMinutes: completedCallMinutes
			};
		}

		const receivedAchievementIdsBefore = new Set(
			auth.achievements.value
				.filter(item => item.isReceived)
				.map(item => item.id)
		);

		const currentTotalMinutes = normalizeLegacyTotalMinutes(
			Number(currentProfile.totalHours || 0),
			Number(currentProfile.deedsCount || 0)
		);

		await auth.updateProfile({
			deedsCount: (currentProfile.deedsCount || 0) + 1,
			totalHours: currentTotalMinutes + completedCallMinutes
		});
		await auth.syncCallAchievementProgress();
		await auth.refreshDashboard();
		achievementsCreditApplied = true;

		const newlyReceivedAchievements = auth.achievements.value
			.filter(item => item.isReceived && !receivedAchievementIdsBefore.has(item.id));
		const firstNewAchievement = newlyReceivedAchievements[0] || null;

		return {
			earnedAchievement: Boolean(firstNewAchievement),
			achievementTitle: String(firstNewAchievement?.title || "").trim(),
			achievementIconUrl: String(firstNewAchievement?.iconUrl || "").trim(),
			callDurationMinutes: completedCallMinutes
		};
	} catch {
		return {
			...emptyCallSummary(),
			callDurationMinutes: completedCallMinutes
		};
	} finally {
		achievementsCreditInFlight = false;
	}
}

function resolveVolunteerNameForEndScreen(): string {
	const profileFirstName = String(auth.profile.value?.firstName || "").trim();
	if (profileFirstName) {
		return profileFirstName;
	}

	return String(auth.onboardingName.value || "").trim();
}

async function navigateToEndScreen(summary: CompletedCallSummary): Promise<void> {
	const query: Record<string, string> = {};
	const volunteerName = resolveVolunteerNameForEndScreen();

	if (volunteerName) {
		query.name = volunteerName;
	}

	if (summary.callDurationMinutes > 0) {
		query.minutes = String(summary.callDurationMinutes);
	}

	if (summary.earnedAchievement) {
		query.achievement = "1";
		if (summary.achievementTitle) {
			query.title = summary.achievementTitle;
		}
		if (summary.achievementIconUrl) {
			query.icon = summary.achievementIconUrl;
		}
	}

	await navigateTo({
		path: "/call/end",
		query
	});
}

function clearEndCallHoldTimer(): void {
	if (!endCallHoldTimer) {
		return;
	}

	clearTimeout(endCallHoldTimer);
	endCallHoldTimer = null;
}

function startEndCallHold(): void {
	if (isEnding.value) {
		return;
	}

	statusMessage.value = "Удерживай кнопку 5 секунд для завершения звонка.";
	clearEndCallHoldTimer();
	endCallHoldTimer = setTimeout(() => {
		endCallHoldTimer = null;
		void endCallAndGoHome();
	}, END_HOLD_MS);
}

function cancelEndCallHold(): void {
	clearEndCallHoldTimer();
}

function clearSignalPollTimer(): void {
	if (!signalPollTimer) {
		return;
	}

	clearTimeout(signalPollTimer);
	signalPollTimer = null;
}

function tryPlay(element: HTMLMediaElement | null): void {
	if (!element) {
		return;
	}

	void element.play().catch(() => {
		// autoplay can be blocked until user interaction
	});
}

function tryStartRemotePlayback(): void {
	tryPlay(remoteVideo.value);
	tryPlay(remoteAudio.value);
}

async function sendSignal(type: "offer" | "answer" | "candidate" | "end", payload: any): Promise<void> {
	if (!activeSessionId.value) {
		return;
	}

	await call.sendSignal(activeSessionId.value, "volunteer", type, payload);
}

async function syncBlindMetaFromSession(): Promise<void> {
	if (!activeSessionId.value) {
		return;
	}

	try {
		const status = await call.getSessionStatus(activeSessionId.value);
		const blindName = String(status.blindName || "").trim();
		if (blindName) {
			blindNameFromSession.value = blindName;
		}

		const blindInterests = String(status.blindInterests || "").replace(/\s+/g, " ").trim();
		if (blindInterests) {
			blindInterestsFromSession.value = blindInterests;
		}
	} catch {
		// noop
	}
}

function attachRemoteMediaStream(stream: MediaStream): void {
	hasRemoteVideo.value = stream.getVideoTracks().length > 0;

	if (remoteVideo.value) {
		remoteVideo.value.srcObject = stream;
	}

	if (remoteAudio.value) {
		remoteAudio.value.srcObject = stream;
	}

	tryStartRemotePlayback();
}

async function safelyAddRemoteCandidate(candidate: RTCIceCandidateInit): Promise<void> {
	if (!peerConnection) {
		return;
	}

	try {
		await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
	} catch {
		// candidate might be stale after reconnect, safe to ignore
	}
}

async function flushPendingRemoteCandidates(): Promise<void> {
	if (!peerConnection?.remoteDescription) {
		return;
	}

	while (pendingRemoteCandidates.length > 0) {
		const candidate = pendingRemoteCandidates.shift();
		if (!candidate) {
			continue;
		}

		await safelyAddRemoteCandidate(candidate);
	}
}

function ensurePeerConnection(): RTCPeerConnection {
	if (peerConnection) {
		return peerConnection;
	}

	const connection = new RTCPeerConnection({
		iceServers: [
			{ urls: "stun:stun.l.google.com:19302" }
		]
	});

	connection.onicecandidate = (event) => {
		if (!event.candidate || !activeSessionId.value || isEnding.value) {
			return;
		}

		void sendSignal("candidate", event.candidate.toJSON());
	};

	connection.ontrack = (event) => {
		if (!remoteStream) {
			remoteStream = new MediaStream();
		}

		for (const track of event.streams[0]?.getTracks() || [event.track]) {
			if (!remoteStream.getTracks().some(existing => existing.id === track.id)) {
				remoteStream.addTrack(track);
			}
		}

		attachRemoteMediaStream(remoteStream);
		markCallConnected();
		statusMessage.value = "Звонок активен.";
	};

	connection.onconnectionstatechange = () => {
		if (connection.connectionState === "connected") {
			markCallConnected();
			statusMessage.value = "Звонок активен.";
			errorMessage.value = "";
			return;
		}

		if (connection.connectionState === "disconnected") {
			statusMessage.value = "Связь временно прервалась...";
			return;
		}

		if (connection.connectionState === "failed") {
			errorMessage.value = "Не удалось удержать соединение.";
		}
	};

	peerConnection = connection;
	return connection;
}

async function prepareLocalMedia(): Promise<void> {
	const canUseMediaDevices = import.meta.client
		&& typeof navigator !== "undefined"
		&& Boolean(navigator.mediaDevices?.getUserMedia);
	if (!canUseMediaDevices) {
		errorMessage.value = "Микрофон недоступен в этом браузере.";
		return;
	}

	try {
		localStream = await navigator.mediaDevices.getUserMedia({
			audio: true,
			video: false
		});

		const connection = ensurePeerConnection();
		for (const track of localStream.getTracks()) {
			connection.addTrack(track, localStream);
		}
	} catch {
		errorMessage.value = "Не удалось получить доступ к микрофону.";
	}
}

async function handleSignal(signal: CallSignalItem): Promise<void> {
	const connection = ensurePeerConnection();

	if (signal.type === "answer") {
		if (!connection.currentRemoteDescription) {
			await connection.setRemoteDescription(new RTCSessionDescription(signal.payload));
		}

		markCallConnected();
		await flushPendingRemoteCandidates();
		statusMessage.value = "Соединение установлено.";
		return;
	}

	if (signal.type === "candidate") {
		if (!signal.payload) {
			return;
		}

		if (connection.remoteDescription) {
			await safelyAddRemoteCandidate(signal.payload);
		} else {
			pendingRemoteCandidates.push(signal.payload);
		}
		return;
	}

	if (signal.type === "end") {
		if (isEnding.value) {
			return;
		}
		statusMessage.value = "Собеседник завершил звонок.";
		isEnding.value = true;
		const summary = await maybeCreditCompletedCall();
		await cleanupConnection();
		call.setCurrentSessionId(null);
		await navigateToEndScreen(summary);
	}
}

async function pollSignals(): Promise<void> {
	if (!isPageActive || !activeSessionId.value || signalPollInFlight) {
		return;
	}

	signalPollInFlight = true;
	try {
		const response = await call.fetchSignals(activeSessionId.value, "volunteer", signalCursor);
		for (const signal of response.items) {
			signalCursor = Math.max(signalCursor, signal.seq);
			await handleSignal(signal);
		}

		if (response.status === "ended" && !isEnding.value) {
			statusMessage.value = "Звонок завершен.";
			isEnding.value = true;
			const summary = await maybeCreditCompletedCall();
			await cleanupConnection();
			call.setCurrentSessionId(null);
			await navigateToEndScreen(summary);
			return;
		}
	} catch {
		if (!isEnding.value) {
			errorMessage.value = "Проблема связи. Пытаемся переподключиться...";
		}
	} finally {
		signalPollInFlight = false;
	}

	if (!isPageActive || !activeSessionId.value || isEnding.value) {
		return;
	}

	clearSignalPollTimer();
	signalPollTimer = setTimeout(() => {
		void pollSignals();
	}, SIGNAL_POLL_MS);
}

async function startVolunteerCallSession(): Promise<void> {
	if (!activeSessionId.value) {
		errorMessage.value = "Сессия звонка не найдена.";
		statusMessage.value = "Не удалось начать звонок.";
		return;
	}

	call.setCurrentSessionId(activeSessionId.value);
	await syncBlindMetaFromSession();
	ensurePeerConnection();
	await prepareLocalMedia();

	const connection = ensurePeerConnection();
	const offer = await connection.createOffer({
		offerToReceiveAudio: true,
		offerToReceiveVideo: true
	});

	await connection.setLocalDescription(offer);
	await sendSignal("offer", offer);
	statusMessage.value = "Соединяем с незрячим...";
	void pollSignals();
}

async function cleanupConnection(): Promise<void> {
	clearSignalPollTimer();
	pendingRemoteCandidates.length = 0;

	if (peerConnection) {
		peerConnection.onicecandidate = null;
		peerConnection.ontrack = null;
		peerConnection.onconnectionstatechange = null;
		peerConnection.close();
		peerConnection = null;
	}

	if (localStream) {
		for (const track of localStream.getTracks()) {
			track.stop();
		}
		localStream = null;
	}

	if (remoteStream) {
		for (const track of remoteStream.getTracks()) {
			track.stop();
		}
		remoteStream = null;
	}

	hasRemoteVideo.value = false;
	if (remoteVideo.value) {
		remoteVideo.value.srcObject = null;
	}

	if (remoteAudio.value) {
		remoteAudio.value.srcObject = null;
	}
}

async function endCallAndGoHome(): Promise<void> {
	if (isEnding.value) {
		return;
	}

	isEnding.value = true;
	statusMessage.value = "Завершаю звонок...";

	if (activeSessionId.value) {
		try {
			await call.endSession(activeSessionId.value, "volunteer");
		} catch {
			// noop
		}
	}

	const summary = await maybeCreditCompletedCall();
	await cleanupConnection();
	call.setCurrentSessionId(null);
	await navigateToEndScreen(summary);
}

onMounted(() => {
	void startVolunteerCallSession();
});

onBeforeUnmount(() => {
	isPageActive = false;
	clearEndCallHoldTimer();
	void cleanupConnection();
});
</script>
