<template>
	<main class="min-h-dvh bg-[#f4f4f5]">
		<section class="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-[430px] flex-col px-6 pt-[168px]">
			<button
				type="button"
				class="h-[280px] w-full rounded-[24px] bg-[#3f75df] text-[66px] leading-[0.92] font-semibold tracking-[-0.03em] text-[#f4f4f5] transition active:scale-[0.99] disabled:opacity-80"
				@click="handleSquareClick"
				@pointerdown="handlePointerDown"
				@pointerup="handlePointerUpOrLeave"
				@pointerleave="handlePointerUpOrLeave"
				@pointercancel="handlePointerUpOrLeave"
			>
				ВВЕСТИ
				<br>
				ИНТЕРЕСЫ
			</button>

			<p class="mt-5 text-center text-[16px] leading-tight font-medium text-black/70">
				Нажми для ввода голосом. Удерживай 5 секунд для ввода с клавиатуры.
			</p>

			<p
				v-if="holdProgress > 0 && holdProgress < 100"
				aria-live="polite"
				class="mt-2 text-center text-[15px] leading-none font-semibold text-[#3f75df]"
			>
				Удержание: {{ holdProgress }}%
			</p>

			<p
				v-if="statusMessage"
				aria-live="polite"
				class="mt-2 text-center text-[15px] leading-tight font-medium text-black/70"
			>
				{{ statusMessage }}
			</p>

			<div
				v-if="showInput"
				class="mt-6"
			>
				<input
					ref="interestInput"
					v-model="interests"
					type="text"
					maxlength="80"
					placeholder="Введи интерес"
					class="w-full rounded-[20px] border border-[#d4e0ea] bg-white px-5 py-4 text-[22px] leading-none text-black outline-none focus:border-[#83addf]"
				>

				<button
					type="button"
					class="mt-4 w-full rounded-[20px] py-4 text-[20px] leading-none font-medium text-white transition"
					:class="canContinue ? 'bg-[#3f75df] hover:brightness-105' : 'cursor-not-allowed bg-[#b5c8df]'"
					:disabled="!canContinue"
					@click="goNext"
				>
					Продолжить
				</button>
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

const LONG_PRESS_MS = 5000;
const ONBOARDING_INTERESTS_KEY = "volunteer_onboarding_interests";
const INTRO_ANNOUNCEMENT_TEXT = "Какой у тебя интерес? Просто скажи интерес, или зажми кнопку «Ввести интересы» на 5 секунд и напиши интерес, я - запомню.";

const interests = ref(readStoredInterests());
const showInput = ref(false);
const isListening = ref(false);
const holdProgress = ref(0);
const statusMessage = ref("");
const interestInput = useTemplateRef<HTMLInputElement>("interestInput");

let recognition: SpeechRecognitionLike | null = null;
let holdTimer: ReturnType<typeof setTimeout> | null = null;
let holdProgressTimer: ReturnType<typeof setInterval> | null = null;
let holdStartedAt = 0;
let ignoreClickAfterLongPress = false;
let speechUtterance: SpeechSynthesisUtterance | null = null;

const canContinue = computed(() => interests.value.trim().length >= 2);

watch(interests, (value) => {
	persistInterests(value);
});

onMounted(() => {
	playIntroductionSpeech();
});

onBeforeUnmount(() => {
	clearHoldTimers();
	stopListening();
	stopIntroductionSpeech();
});

function readStoredInterests(): string {
	if (!import.meta.client) {
		return "";
	}

	return normalizeInterestsValue(localStorage.getItem(ONBOARDING_INTERESTS_KEY) || "");
}

function persistInterests(value: string): void {
	if (!import.meta.client) {
		return;
	}

	const normalizedValue = normalizeInterestsValue(value);
	if (normalizedValue) {
		localStorage.setItem(ONBOARDING_INTERESTS_KEY, normalizedValue);
	} else {
		localStorage.removeItem(ONBOARDING_INTERESTS_KEY);
	}
}

function normalizeInterestsValue(value: unknown): string {
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

function handlePointerDown(): void {
	stopIntroductionSpeech();
	stopListening();
	ignoreClickAfterLongPress = false;
	holdStartedAt = Date.now();
	holdProgress.value = 0;
	clearHoldTimers();

	holdTimer = setTimeout(() => {
		ignoreClickAfterLongPress = true;
		showInput.value = true;
		holdProgress.value = 100;
		statusMessage.value = "Поле ввода открыто. Напиши интерес.";
		nextTick(() => {
			interestInput.value?.focus();
		});
	}, LONG_PRESS_MS);

	holdProgressTimer = setInterval(() => {
		const elapsed = Date.now() - holdStartedAt;
		holdProgress.value = Math.max(0, Math.min(99, Math.round((elapsed / LONG_PRESS_MS) * 100)));
	}, 100);
}

function handlePointerUpOrLeave(): void {
	clearHoldTimers();
	if (holdProgress.value < 100) {
		holdProgress.value = 0;
	}
}

function stopIntroductionSpeech(): void {
	if (!import.meta.client || typeof window === "undefined" || !("speechSynthesis" in window)) {
		speechUtterance = null;
		return;
	}

	window.speechSynthesis.cancel();
	speechUtterance = null;
}

function playIntroductionSpeech(): void {
	if (!import.meta.client || typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
		startVoiceInput();
		return;
	}

	stopIntroductionSpeech();
	const utterance = new SpeechSynthesisUtterance(INTRO_ANNOUNCEMENT_TEXT);
	utterance.lang = "ru-RU";
	utterance.rate = 1;
	utterance.pitch = 1;

	utterance.onend = () => {
		if (speechUtterance !== utterance) {
			return;
		}

		speechUtterance = null;
		startVoiceInput();
	};

	utterance.onerror = () => {
		if (speechUtterance !== utterance) {
			return;
		}

		speechUtterance = null;
		startVoiceInput();
	};

	speechUtterance = utterance;
	window.speechSynthesis.speak(utterance);
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
		return "Не расслышал речь. Нажми еще раз.";
	}

	if (errorCode === "audio-capture") {
		return "Микрофон недоступен. Зажми кнопку 5 секунд для ввода вручную.";
	}

	if (errorCode === "not-allowed") {
		return "Нет доступа к микрофону. Разреши доступ и попробуй снова.";
	}

	if (errorCode === "network") {
		return "Ошибка сети при распознавании. Попробуй снова.";
	}

	return "Не удалось распознать речь. Попробуй еще раз.";
}

function stopListening(): void {
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
		statusMessage.value = "Слушаю...";
	};

	instance.onresult = (event) => {
		const transcript = String(event?.results?.[0]?.[0]?.transcript || "").trim();
		if (!transcript) {
			statusMessage.value = "Не расслышал интерес. Нажми квадрат еще раз.";
			return;
		}

		const normalizedTranscript = normalizeInterestsValue(transcript);
		interests.value = normalizedTranscript;
		persistInterests(normalizedTranscript);
		statusMessage.value = `Интерес: ${normalizedTranscript}`;
		void navigateTo("/onboarding/interests-repeat");
	};

	instance.onerror = (event) => {
		const errorCode = String(event?.error || "");
		statusMessage.value = mapSpeechError(errorCode);
	};

	instance.onend = () => {
		isListening.value = false;
	};

	recognition = instance;
	return recognition;
}

function startVoiceInput(): void {
	if (isListening.value) {
		return;
	}

	stopIntroductionSpeech();
	const speechRecognition = ensureRecognition();
	if (!speechRecognition) {
		statusMessage.value = "В этом браузере нет распознавания речи. Зажми кнопку 5 секунд для ввода вручную.";
		return;
	}

	try {
		speechRecognition.start();
	} catch {
		statusMessage.value = "Распознавание уже запущено. Попробуй снова.";
	}
}

function handleSquareClick(): void {
	if (ignoreClickAfterLongPress) {
		ignoreClickAfterLongPress = false;
		return;
	}

	startVoiceInput();
}

function goNext(): void {
	if (!canContinue.value) {
		return;
	}

	persistInterests(interests.value);
	void navigateTo("/onboarding/interests-repeat");
}
</script>
