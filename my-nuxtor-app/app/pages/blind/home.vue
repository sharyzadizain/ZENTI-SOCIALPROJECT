<template>
	<main class="min-h-dvh bg-[#f4f4f5]">
		<section class="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-4 px-6 pb-10 pt-8">
			<button
				type="button"
				class="flex h-[400px] w-full flex-col items-center justify-between rounded-[34px] bg-[#3f75df] px-6 py-12 text-center text-[#f4f4f5] transition active:scale-[0.995]"
				:disabled="isNavigating"
				@pointerdown="startHold('help')"
				@pointerup="cancelHold('help')"
				@pointerleave="cancelHold('help')"
				@pointercancel="cancelHold('help')"
			>
				<span class="text-[56px] leading-[0.96] font-semibold tracking-[-0.03em] sm:text-[62px]">
					НАЙТИ
					<br>
					ПОМОЩЬ
				</span>
				<span class="text-[52px] leading-[0.92] font-semibold tracking-[-0.03em] sm:text-[58px]">
					ЗАЖМИ
					<br>
					<span class="text-[42px] sm:text-[46px]">НА 5 СЕКУНД</span>
				</span>
			</button>

			<button
				type="button"
				class="flex h-[320px] w-full flex-col items-center justify-between rounded-[34px] bg-[#3f75df] px-6 py-10 text-center text-[#f4f4f5] transition active:scale-[0.995]"
				:disabled="isNavigating"
				@pointerdown="startHold('conversation')"
				@pointerup="cancelHold('conversation')"
				@pointerleave="cancelHold('conversation')"
				@pointercancel="cancelHold('conversation')"
			>
				<span class="text-[54px] leading-[0.94] font-semibold tracking-[-0.03em] sm:text-[60px]">
					РЕЖИМ
					<br>
					РАЗГОВОРА
				</span>
				<span class="text-[52px] leading-[0.92] font-semibold tracking-[-0.03em] sm:text-[58px]">
					ЗАЖМИ
					<br>
					<span class="text-[42px] sm:text-[46px]">НА 5 СЕКУНД</span>
				</span>
			</button>

			<p
				v-if="activeHold && holdProgress > 0 && holdProgress < 100"
				aria-live="polite"
				class="text-center text-[22px] font-semibold text-[#3f75df]"
			>
				Удержание: {{ holdProgress }}%
			</p>

			<p
				v-if="statusMessage"
				aria-live="polite"
				class="text-center text-[18px] font-medium text-black/65"
			>
				{{ statusMessage }}
			</p>

			<button
				type="button"
				class="mt-auto w-full rounded-[18px] border border-[#d8d8da] bg-white py-4 text-[24px] font-semibold text-black transition hover:bg-[#efeff1] disabled:opacity-70"
				:disabled="isNavigating"
				@click="handleLogout"
			>
				Выйти
			</button>
		</section>
	</main>
</template>

<script setup lang="ts">
type BlindAction = "help" | "conversation";
type SpeechRecognitionLike = {
	lang: string
	continuous: boolean
	interimResults: boolean
	maxAlternatives: number
	onstart: (() => void) | null
	onresult: ((event: any) => void) | null
	onerror: ((event: { error?: string }) => void) | null
	onend: (() => void) | null
	start: () => void
	stop: () => void
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

const HOLD_MS = 5000;
const BLIND_HOME_ANNOUNCEMENT_TEXT = "Давай познакомим тебя с приложением, что бы получить помощь просто скажи «Найти Помощь» или зажми кнопку «Найти Помощь» на 5 секунд. Если хочешь просто поговорить - скажи «Давай поговорим» или зажми кнопку «Режим Разговора» на 5 секунд.";
const VOICE_HELP_KEYWORDS = ["найти помощь", "найти помошь"];
const VOICE_CONVERSATION_KEYWORDS = ["давай поговорим", "режим разговора"];
const ONBOARDING_INTERESTS_KEY = "volunteer_onboarding_interests";
const auth = useStrapiAuth();
const call = useCallMatching();

const activeHold = ref<BlindAction | null>(null);
const holdProgress = ref(0);
const statusMessage = ref("");
const isNavigating = ref(false);

let holdTimer: ReturnType<typeof setTimeout> | null = null;
let holdProgressTimer: ReturnType<typeof setInterval> | null = null;
let holdStartedAt = 0;
let speechUtterance: SpeechSynthesisUtterance | null = null;
let announcementFallbackTimer: ReturnType<typeof setTimeout> | null = null;
let audioContext: AudioContext | null = null;
let recognition: SpeechRecognitionLike | null = null;
let keepListeningForCommands = false;
let restartListeningTimer: ReturnType<typeof setTimeout> | null = null;

function clearHoldTimers(): void {
	if (holdTimer) {
		clearTimeout(holdTimer);
		holdTimer = null;
	}

	if (holdProgressTimer) {
		clearInterval(holdProgressTimer);
		holdProgressTimer = null;
	}
}

function clearAnnouncementFallbackTimer(): void {
	if (!announcementFallbackTimer) {
		return;
	}

	clearTimeout(announcementFallbackTimer);
	announcementFallbackTimer = null;
}

function clearVoiceRestartTimer(): void {
	if (!restartListeningTimer) {
		return;
	}

	clearTimeout(restartListeningTimer);
	restartListeningTimer = null;
}

function stopAnnouncement(): void {
	clearAnnouncementFallbackTimer();

	if (!import.meta.client || typeof window === "undefined" || !("speechSynthesis" in window)) {
		speechUtterance = null;
		return;
	}

	window.speechSynthesis.cancel();
	speechUtterance = null;
}

function stopVoiceControl(): void {
	keepListeningForCommands = false;
	clearVoiceRestartTimer();

	if (!recognition) {
		return;
	}

	try {
		recognition.stop();
	} catch {
		// noop
	}
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
	if (!import.meta.client || typeof window === "undefined") {
		return null;
	}

	const speechWindow = window as Window & {
		SpeechRecognition?: SpeechRecognitionCtor
		webkitSpeechRecognition?: SpeechRecognitionCtor
	};

	return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
}

function normalizeVoiceInput(value: string): string {
	return value
		.toLowerCase()
		.split("ё").join("е")
		.replace(/[^a-zа-я0-9\s]/gi, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function detectVoiceAction(rawTranscript: string): BlindAction | null {
	const transcript = normalizeVoiceInput(rawTranscript);
	if (!transcript) {
		return null;
	}

	if (VOICE_HELP_KEYWORDS.some(keyword => transcript.includes(keyword))) {
		return "help";
	}

	if (VOICE_CONVERSATION_KEYWORDS.some(keyword => transcript.includes(keyword))) {
		return "conversation";
	}

	return null;
}

function queueVoiceRestart(): void {
	if (!keepListeningForCommands || isNavigating.value) {
		return;
	}

	clearVoiceRestartTimer();
	restartListeningTimer = setTimeout(() => {
		if (!keepListeningForCommands || isNavigating.value) {
			return;
		}

		const speechRecognition = ensureRecognition();
		if (!speechRecognition) {
			return;
		}

		try {
			speechRecognition.start();
		} catch {
			queueVoiceRestart();
		}
	}, 350);
}

function ensureRecognition(): SpeechRecognitionLike | null {
	if (recognition) {
		return recognition;
	}

	const Ctor = getSpeechRecognitionCtor();
	if (!Ctor) {
		return null;
	}

	const instance = new Ctor();
	instance.lang = "ru-RU";
	instance.continuous = false;
	instance.interimResults = false;
	instance.maxAlternatives = 1;

	instance.onstart = () => {
		if (isNavigating.value) {
			return;
		}

		statusMessage.value = "Слушаю команды: «Найти помощь» или «Давай поговорим».";
	};

	instance.onresult = (event) => {
		const results = event?.results;
		if (!results) {
			return;
		}

		let action: BlindAction | null = null;
		for (let i = 0; i < results.length; i += 1) {
			const transcript = String(results[i]?.[0]?.transcript || "");
			action = detectVoiceAction(transcript);
			if (action) {
				break;
			}
		}

		if (!action) {
			return;
		}

		keepListeningForCommands = false;
		clearVoiceRestartTimer();
		statusMessage.value = action === "help"
			? "Распознано: «Найти помощь». Открываю поиск помощи."
			: "Распознано: «Давай поговорим». Открываю режим разговора.";
		void triggerAction(action);
	};

	instance.onerror = (event) => {
		if (isNavigating.value) {
			return;
		}

		const errorCode = String(event?.error || "");
		if (errorCode === "not-allowed" || errorCode === "service-not-allowed") {
			keepListeningForCommands = false;
			statusMessage.value = "Нет доступа к микрофону. Разреши микрофон для голосового управления.";
			return;
		}

		if (!keepListeningForCommands) {
			return;
		}

		queueVoiceRestart();
	};

	instance.onend = () => {
		if (!keepListeningForCommands || isNavigating.value) {
			return;
		}

		queueVoiceRestart();
	};

	recognition = instance;
	return recognition;
}

function startVoiceControl(): void {
	if (isNavigating.value) {
		return;
	}

	const speechRecognition = ensureRecognition();
	if (!speechRecognition) {
		statusMessage.value = "Голосовое управление недоступно в этом браузере.";
		return;
	}

	keepListeningForCommands = true;
	clearVoiceRestartTimer();

	try {
		speechRecognition.start();
	} catch {
		queueVoiceRestart();
	}
}

function getAudioContext(): AudioContext | null {
	if (!import.meta.client || typeof window === "undefined") {
		return null;
	}

	if (audioContext) {
		return audioContext;
	}

	const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	if (!AudioContextCtor) {
		return null;
	}

	audioContext = new AudioContextCtor();
	return audioContext;
}

async function playJoyfulSound(): Promise<void> {
	const context = getAudioContext();
	if (!context) {
		return;
	}

	if (context.state === "suspended") {
		try {
			await context.resume();
		} catch {
			return;
		}
	}

	const startTime = context.currentTime + 0.01;
	const notes = [
		{ frequency: 740, duration: 0.12, gain: 0.045 },
		{ frequency: 988, duration: 0.16, gain: 0.05 }
	];

	let offset = 0;
	for (const note of notes) {
		const oscillator = context.createOscillator();
		const gain = context.createGain();
		oscillator.type = "sine";
		oscillator.frequency.setValueAtTime(note.frequency, startTime + offset);

		gain.gain.setValueAtTime(0.0001, startTime + offset);
		gain.gain.exponentialRampToValueAtTime(note.gain, startTime + offset + 0.015);
		gain.gain.exponentialRampToValueAtTime(0.0001, startTime + offset + note.duration);

		oscillator.connect(gain);
		gain.connect(context.destination);
		oscillator.start(startTime + offset);
		oscillator.stop(startTime + offset + note.duration);
		offset += note.duration + 0.02;
	}
}

async function runBlindHomeAnnouncement(): Promise<void> {
	stopAnnouncement();
	stopVoiceControl();
	void playJoyfulSound();

	if (!import.meta.client || typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
		startVoiceControl();
		return;
	}

	const utterance = new SpeechSynthesisUtterance(BLIND_HOME_ANNOUNCEMENT_TEXT);
	utterance.lang = "ru-RU";
	utterance.rate = 1;
	utterance.pitch = 1;

	utterance.onend = () => {
		if (speechUtterance !== utterance) {
			return;
		}

		speechUtterance = null;
		clearAnnouncementFallbackTimer();
		startVoiceControl();
	};

	utterance.onerror = () => {
		if (speechUtterance !== utterance) {
			return;
		}

		speechUtterance = null;
		clearAnnouncementFallbackTimer();
		startVoiceControl();
	};

	speechUtterance = utterance;
	announcementFallbackTimer = setTimeout(() => {
		if (speechUtterance !== utterance) {
			return;
		}

		stopAnnouncement();
		startVoiceControl();
	}, 8000);

	window.speechSynthesis.speak(utterance);
}

function startHold(action: BlindAction): void {
	if (isNavigating.value) {
		return;
	}

	activeHold.value = action;
	holdProgress.value = 0;
	statusMessage.value = "";
	holdStartedAt = Date.now();
	clearHoldTimers();

	holdTimer = setTimeout(() => {
		holdProgress.value = 100;
		void triggerAction(action);
	}, HOLD_MS);

	holdProgressTimer = setInterval(() => {
		const elapsed = Date.now() - holdStartedAt;
		holdProgress.value = Math.max(0, Math.min(99, Math.round((elapsed / HOLD_MS) * 100)));
	}, 100);
}

function cancelHold(action: BlindAction): void {
	if (activeHold.value !== action || isNavigating.value) {
		return;
	}

	clearHoldTimers();
	activeHold.value = null;
	if (holdProgress.value < 100) {
		holdProgress.value = 0;
	}
}

function readBlindInterestsFromStorage(): string {
	const fromProfile = String(auth.profile.value?.interest || "")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 360);
	if (fromProfile) {
		return fromProfile;
	}

	if (!import.meta.client || typeof window === "undefined") {
		return "";
	}

	try {
		return String(window.localStorage.getItem(ONBOARDING_INTERESTS_KEY) || "")
			.replace(/\s+/g, " ")
			.trim()
			.slice(0, 360);
	} catch {
		return "";
	}
}

function buildBlindRequestMeta(): { blindProfileId: number | null, blindName: string, blindInterests: string } {
	const profileId = Number(auth.profile.value?.id || 0);
	const blindProfileId = Number.isFinite(profileId) && profileId > 0 ? Math.floor(profileId) : null;
	const blindName = String(
		auth.profile.value?.firstName
		|| auth.onboardingName.value
		|| ""
	).trim();
	const blindInterests = readBlindInterestsFromStorage();

	return {
		blindProfileId,
		blindName,
		blindInterests
	};
}

async function syncBlindInterestToProfileIfNeeded(blindInterests: string): Promise<void> {
	const normalizedInterests = String(blindInterests || "").replace(/\s+/g, " ").trim().slice(0, 360);
	if (!normalizedInterests || !auth.profile.value) {
		return;
	}

	const currentProfileInterests = String(auth.profile.value.interest || "").replace(/\s+/g, " ").trim().slice(0, 360);
	if (currentProfileInterests === normalizedInterests) {
		return;
	}

	if (auth.profileCollection.value === "profiles") {
		try {
			await auth.updateProfile({ interest: normalizedInterests });
		} catch {
			// noop
		}
	}

	try {
		await $fetch("/api/blind/interest/persist", {
			method: "POST",
			body: {
				interest: normalizedInterests,
				profileId: auth.profile.value.id,
				email: auth.profile.value.emailDisplay || auth.user.value?.email || ""
			}
		});
		auth.profile.value.interest = normalizedInterests;
	} catch {
		// noop
	}
}

async function triggerAction(action: BlindAction): Promise<void> {
	if (isNavigating.value) {
		return;
	}

	isNavigating.value = true;
	stopVoiceControl();
	stopAnnouncement();
	clearHoldTimers();
	activeHold.value = null;
	statusMessage.value = action === "help" ? "Открываю поиск помощи." : "Открываю режим разговора.";

	if (action === "help") {
		try {
			const requestMeta = buildBlindRequestMeta();
			await syncBlindInterestToProfileIfNeeded(requestMeta.blindInterests);
			const sessionId = await call.createHelpRequest(requestMeta);
			await navigateTo({
				path: "/blind/help",
				query: {
					session: sessionId
				}
			});
		} catch {
			statusMessage.value = "Не удалось создать запрос. Попробуй снова.";
			isNavigating.value = false;
		}
		return;
	}

	await navigateTo("/blind/conversation");
}

async function handleLogout(): Promise<void> {
	if (isNavigating.value) {
		return;
	}

	isNavigating.value = true;
	stopVoiceControl();
	stopAnnouncement();
	clearHoldTimers();
	activeHold.value = null;
	holdProgress.value = 0;
	statusMessage.value = "Выход из аккаунта...";

	try {
		await auth.logout();
		await navigateTo("/");
	} finally {
		isNavigating.value = false;
	}
}

onMounted(() => {
	void runBlindHomeAnnouncement();
});

onBeforeUnmount(() => {
	clearHoldTimers();
	stopVoiceControl();
	stopAnnouncement();
	if (audioContext && audioContext.state !== "closed") {
		void audioContext.close();
		audioContext = null;
	}
});
</script>
