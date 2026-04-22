<template>
	<main class="min-h-dvh bg-[#f4f4f5]">
		<section class="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-[430px] flex-col px-7 pb-10 pt-12">
			<article class="rounded-[22px] bg-[#e8e8ea] px-7 py-7">
				<h1 class="text-[50px] leading-[0.95] font-medium tracking-[-0.03em] text-black">
					Повторение интереса
				</h1>
			</article>

			<p class="mt-6 text-[32px] leading-none font-medium tracking-[-0.02em] text-black/80">
				озвучка
			</p>

			<p class="mt-3 text-[38px] leading-[1.04] font-medium tracking-[-0.03em] text-black">
				{{ confirmationPromptText }}
			</p>

			<p
				aria-live="polite"
				class="mt-4 text-[18px] leading-none font-semibold text-[#3f75df]"
			>
				Автопереход через {{ secondsLeft }} сек.
			</p>

			<div class="mt-auto">
				<button
					type="button"
					class="w-full rounded-[20px] bg-[#3f75df] py-4 text-[22px] leading-none font-medium text-white transition hover:brightness-105 disabled:opacity-70"
					:disabled="isNavigating"
					@click="confirmInterest"
				>
					Интерес верный
				</button>

				<button
					type="button"
					class="mt-4 w-full rounded-[20px] bg-[#e8e8ea] py-4 text-[20px] leading-none font-medium text-black transition hover:brightness-95 disabled:opacity-70"
					:disabled="isNavigating"
					@pointerdown="startEditHold"
					@pointerup="cancelEditHold"
					@pointerleave="cancelEditHold"
					@pointercancel="cancelEditHold"
				>
					Интерес не верный (зажми 5 секунд)
				</button>

				<p
					v-if="holdProgress > 0 && holdProgress < 100"
					aria-live="polite"
					class="mt-3 text-center text-[15px] leading-none font-semibold text-[#3f75df]"
				>
					Удержание: {{ holdProgress }}%
				</p>

				<p
					v-if="statusMessage"
					aria-live="polite"
					class="mt-3 text-center text-[15px] leading-tight font-medium text-black/70"
				>
					{{ statusMessage }}
				</p>
			</div>
		</section>
	</main>
</template>

<script setup lang="ts">
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

const ONBOARDING_INTERESTS_KEY = "volunteer_onboarding_interests";
const AUTO_CONFIRM_SECONDS = 15;
const HOLD_TO_EDIT_MS = 5000;
const CONFIRMATION_KEYWORD = "да";
const auth = useStrapiAuth();

const interest = ref("");
const displayInterest = computed(() => interest.value.trim() || "интерес");
const confirmationPromptText = computed(() => `Твой интерес «${displayInterest.value}», верно? Если да - скажи «Да», или нажми на кнопку и удерживай 5 секунд если нет подожди 15 секунд!`);

const secondsLeft = ref(AUTO_CONFIRM_SECONDS);
const holdProgress = ref(0);
const statusMessage = ref("");
const isNavigating = ref(false);
const isListening = ref(false);

let countdownTimer: ReturnType<typeof setInterval> | null = null;
let holdTimer: ReturnType<typeof setTimeout> | null = null;
let holdProgressTimer: ReturnType<typeof setInterval> | null = null;
let holdStartedAt = 0;
let speechUtterance: SpeechSynthesisUtterance | null = null;
let announcementFallbackTimer: ReturnType<typeof setTimeout> | null = null;
let recognition: SpeechRecognitionLike | null = null;
let keepListeningForConfirmation = false;

function loadStoredInterest(): string {
	if (!import.meta.client) {
		return "";
	}

	return normalizeInterest(localStorage.getItem(ONBOARDING_INTERESTS_KEY) || "");
}

function persistInterest(value: string): void {
	if (!import.meta.client) {
		return;
	}

	const normalized = normalizeInterest(value);
	if (normalized) {
		localStorage.setItem(ONBOARDING_INTERESTS_KEY, normalized);
	} else {
		localStorage.removeItem(ONBOARDING_INTERESTS_KEY);
	}
}

function normalizeInterest(value: unknown): string {
	return String(value || "")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 360);
}

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

function startEditHold(): void {
	if (isNavigating.value) {
		return;
	}

	holdProgress.value = 0;
	statusMessage.value = "";
	holdStartedAt = Date.now();
	clearHoldTimers();

	holdTimer = setTimeout(() => {
		holdProgress.value = 100;
		statusMessage.value = "Открываю экран изменения интереса.";
		void editInterest();
	}, HOLD_TO_EDIT_MS);

	holdProgressTimer = setInterval(() => {
		const elapsed = Date.now() - holdStartedAt;
		holdProgress.value = Math.max(0, Math.min(99, Math.round((elapsed / HOLD_TO_EDIT_MS) * 100)));
	}, 100);
}

function cancelEditHold(): void {
	clearHoldTimers();
	if (holdProgress.value < 100) {
		holdProgress.value = 0;
	}
}

function stopCountdown(): void {
	if (!countdownTimer) {
		return;
	}

	clearInterval(countdownTimer);
	countdownTimer = null;
}

function startCountdown(): void {
	stopCountdown();
	secondsLeft.value = AUTO_CONFIRM_SECONDS;

	countdownTimer = setInterval(() => {
		if (secondsLeft.value <= 1) {
			stopCountdown();
			void confirmInterest();
			return;
		}

		secondsLeft.value -= 1;
	}, 1000);
}

function clearAnnouncementFallbackTimer(): void {
	if (!announcementFallbackTimer) {
		return;
	}

	clearTimeout(announcementFallbackTimer);
	announcementFallbackTimer = null;
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

function mapSpeechError(errorCode: string): string {
	if (errorCode === "no-speech") {
		return "Не расслышал подтверждение. Скажи «Да».";
	}

	if (errorCode === "audio-capture") {
		return "Микрофон недоступен. Нажми кнопку «Интерес верный» для подтверждения.";
	}

	if (errorCode === "not-allowed") {
		return "Нет доступа к микрофону. Разреши доступ или нажми кнопку «Интерес верный».";
	}

	if (errorCode === "network") {
		return "Ошибка сети при распознавании. Скажи «Да» еще раз или нажми кнопку «Интерес верный».";
	}

	return "Не удалось распознать ответ. Скажи «Да» еще раз.";
}

function normalizeTranscript(raw: string): string {
	return raw
		.toLowerCase()
		.replaceAll("ё", "е")
		.replace(/[^a-zа-я0-9\s]/gi, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function isVoiceConfirmation(transcript: string): boolean {
	const words = normalizeTranscript(transcript).split(" ").filter(Boolean);
	return words.includes(CONFIRMATION_KEYWORD);
}

function stopVoiceConfirmation(): void {
	keepListeningForConfirmation = false;

	if (!recognition) {
		isListening.value = false;
		return;
	}

	try {
		recognition.stop();
	} catch {
		// noop
	}

	isListening.value = false;
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
		isListening.value = true;
		statusMessage.value = "Слушаю подтверждение. Скажи «Да».";
	};

	instance.onresult = (event) => {
		const transcript = String(event?.results?.[0]?.[0]?.transcript || "").trim();
		if (!transcript) {
			statusMessage.value = "Не расслышал подтверждение. Скажи «Да».";
			return;
		}

		if (isVoiceConfirmation(transcript)) {
			statusMessage.value = "Подтверждение получено.";
			void confirmInterest();
			return;
		}

		statusMessage.value = `Услышал «${transcript}». Для подтверждения скажи «Да».`;
	};

	instance.onerror = (event) => {
		const errorCode = String(event?.error || "");
		if (errorCode === "aborted" || isNavigating.value) {
			return;
		}

		statusMessage.value = mapSpeechError(errorCode);
		if (errorCode === "not-allowed" || errorCode === "audio-capture") {
			keepListeningForConfirmation = false;
		}
	};

	instance.onend = () => {
		isListening.value = false;
		if (!keepListeningForConfirmation || isNavigating.value) {
			return;
		}

		startVoiceConfirmation();
	};

	recognition = instance;
	return recognition;
}

function startVoiceConfirmation(): void {
	if (isNavigating.value || isListening.value || !keepListeningForConfirmation) {
		return;
	}

	const speechRecognition = ensureRecognition();
	if (!speechRecognition) {
		keepListeningForConfirmation = false;
		statusMessage.value = "В этом браузере нет распознавания речи. Нажми кнопку «Интерес верный» для подтверждения.";
		return;
	}

	try {
		speechRecognition.start();
	} catch {
		statusMessage.value = "Распознавание уже запущено. Скажи «Да» для подтверждения.";
	}
}

function startConfirmationWindow(): void {
	startCountdown();
	keepListeningForConfirmation = true;
	startVoiceConfirmation();
}

function runAnnouncementThenCountdown(): void {
	if (!import.meta.client || typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
		startConfirmationWindow();
		return;
	}

	stopAnnouncement();
	const utterance = new SpeechSynthesisUtterance(confirmationPromptText.value);
	utterance.lang = "ru-RU";
	utterance.rate = 1;
	utterance.pitch = 1;

	utterance.onend = () => {
		if (speechUtterance !== utterance) {
			return;
		}

		speechUtterance = null;
		clearAnnouncementFallbackTimer();
		startConfirmationWindow();
	};

	utterance.onerror = () => {
		if (speechUtterance !== utterance) {
			return;
		}

		speechUtterance = null;
		clearAnnouncementFallbackTimer();
		startConfirmationWindow();
	};

	speechUtterance = utterance;
	announcementFallbackTimer = setTimeout(() => {
		if (speechUtterance !== utterance) {
			return;
		}

		stopAnnouncement();
		startConfirmationWindow();
	}, 15000);

	window.speechSynthesis.speak(utterance);
}

async function confirmInterest(): Promise<void> {
	if (isNavigating.value) {
		return;
	}

	const normalizedInterest = normalizeInterest(interest.value);
	persistInterest(normalizedInterest);

	const profileIdForPersist = auth.profile.value?.id || null;
	const emailForPersist = auth.profile.value?.emailDisplay || auth.user.value?.email || null;

	if (normalizedInterest && (profileIdForPersist || emailForPersist)) {
		try {
			await $fetch("/api/blind/interest/persist", {
				method: "POST",
				body: {
					interest: normalizedInterest,
					profileId: profileIdForPersist,
					email: emailForPersist
				}
			});
		} catch {
			// noop
		}
	}

	if (normalizedInterest && auth.profile.value && auth.profileCollection.value === "profiles") {
		try {
			await auth.updateProfile({ interest: normalizedInterest });
		} catch {
			// noop
		}
	}

	isNavigating.value = true;
	stopCountdown();
	stopAnnouncement();
	stopVoiceConfirmation();
	clearHoldTimers();
	await navigateTo("/onboarding/blind-yandex");
}

async function editInterest(): Promise<void> {
	if (isNavigating.value) {
		return;
	}

	isNavigating.value = true;
	stopCountdown();
	stopAnnouncement();
	stopVoiceConfirmation();
	clearHoldTimers();
	await navigateTo("/onboarding/interests");
}

onMounted(() => {
	interest.value = loadStoredInterest();
	persistInterest(interest.value);
	runAnnouncementThenCountdown();
});

onBeforeUnmount(() => {
	stopCountdown();
	stopAnnouncement();
	stopVoiceConfirmation();
	clearHoldTimers();
});
</script>
