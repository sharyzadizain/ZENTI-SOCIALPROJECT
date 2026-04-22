<template>
	<main class="min-h-dvh bg-[#f4f4f5]">
		<section class="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-6 pb-10 pt-10">
			<p
				aria-live="polite"
				class="sr-only"
			>
				{{ statusMessage }}
			</p>

			<article class="mt-6 rounded-[28px] bg-[#ececef] px-6 pb-8 pt-9">
				<h1 class="text-center text-[48px] leading-[0.95] font-semibold tracking-[-0.03em] text-[#3f75df]">
					ОТЗЫВ
				</h1>

				<p
					v-if="volunteerDisplayName"
					class="mt-4 text-center text-[16px] leading-none font-medium text-black/70"
				>
					Волонтер: {{ volunteerDisplayName }}
				</p>

				<p class="mt-4 text-center text-[18px] leading-[1.2] font-medium text-black/80">
					Расскажи, как прошел разговор. Что понравилось или нет.
				</p>
				<p class="mt-2 text-center text-[15px] leading-[1.2] font-medium text-black/60">
					Когда закончишь голосовой отзыв, скажи «Точка».
				</p>

				<textarea
					v-model="feedbackText"
					rows="6"
					placeholder="Напиши отзыв здесь..."
					class="mt-6 w-full resize-none rounded-[18px] border border-black/10 bg-white px-4 py-3 text-[16px] leading-[1.35] text-black outline-none focus:border-[#3f75df]"
				/>

				<p
					v-if="statusMessage"
					class="mt-3 text-center text-[14px] leading-[1.2] font-medium text-black/65"
				>
					{{ statusMessage }}
				</p>

				<div class="mt-6 space-y-3">
					<button
						type="button"
						class="h-[56px] w-full rounded-[18px] bg-[#50a9ed] text-[20px] leading-none font-medium text-[#f4f4f5] transition hover:brightness-105 disabled:opacity-65"
						:disabled="isSubmitting"
						@click="toggleVoiceInput"
					>
						{{ isListening ? "Остановить запись" : "Сказать отзыв" }}
					</button>

					<button
						type="button"
						class="h-[56px] w-full rounded-[18px] bg-black text-[20px] leading-none font-medium text-[#f4f4f5] transition hover:brightness-110 disabled:opacity-65"
						:disabled="isSubmitting || !feedbackText.trim()"
						@click="submitReview"
					>
						{{ isSubmitting ? "Сохраняем..." : "Отправить отзыв" }}
					</button>

					<button
						type="button"
						class="h-[52px] w-full rounded-[18px] bg-[#d9d9de] text-[18px] leading-none font-medium text-black transition hover:brightness-105 disabled:opacity-65"
						:disabled="isSubmitting"
						@click="skipReview"
					>
						Пропустить
					</button>
				</div>
			</article>
		</section>
	</main>
</template>

<script setup lang="ts">
const REVIEW_ANNOUNCEMENT_TEXT = "Расскажи, как прошел разговор. Что понравилось или нет. Когда закончишь диктовать, скажи Точка. Чтобы отправить отзыв, скажи Отправить отзыв. Чтобы пропустить, скажи Пропустить.";
const STOP_WORD = "точка";
const SUBMIT_COMMANDS = ["отправить отзыв", "отправь отзыв"];
const SKIP_COMMANDS = ["пропустить отзыв", "пропустить"];

type RecognitionLike = {
	continuous: boolean
	interimResults: boolean
	lang: string
	maxAlternatives: number
	onresult: ((event: any) => void) | null
	onerror: ((event: any) => void) | null
	onend: (() => void) | null
	start: () => void
	stop: () => void
};

type RecognitionCtor = new () => RecognitionLike;

const route = useRoute();
const call = useCallMatching();
const auth = useStrapiAuth();

const feedbackText = ref("");
const statusMessage = ref("");
const isSubmitting = ref(false);
const isListening = ref(false);
const volunteerProfileId = ref<number | null>(null);
const volunteerProfileDocumentId = ref("");
const volunteerName = ref("");

let recognition: RecognitionLike | null = null;
let speechUtterance: SpeechSynthesisUtterance | null = null;
let audioContext: AudioContext | null = null;

const sessionId = computed(() => queryToString(route.query.session as string | string[] | undefined));
const volunteerDisplayName = computed(() => volunteerName.value.trim());

function queryToString(value: string | string[] | undefined): string {
	if (Array.isArray(value)) {
		return String(value[0] || "").trim();
	}

	return String(value || "").trim();
}

function toPositiveProfileId(value: unknown): number | null {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return null;
	}

	return Math.floor(parsed);
}

function syncMetaFromRoute(): void {
	const profileIdFromRoute = toPositiveProfileId(queryToString(route.query.volunteerProfileId as string | string[] | undefined));
	if (profileIdFromRoute) {
		volunteerProfileId.value = profileIdFromRoute;
	}

	const profileDocumentIdFromRoute = queryToString(route.query.volunteerProfileDocumentId as string | string[] | undefined);
	if (profileDocumentIdFromRoute) {
		volunteerProfileDocumentId.value = profileDocumentIdFromRoute;
	}

	const nameFromRoute = queryToString(route.query.volunteerName as string | string[] | undefined);
	if (nameFromRoute) {
		volunteerName.value = nameFromRoute;
	}
}

async function syncMetaFromSession(): Promise<void> {
	if (!sessionId.value) {
		return;
	}

	try {
		const status = await call.getSessionStatus(sessionId.value);
		const profileIdFromStatus = toPositiveProfileId(status.volunteerProfileId);
		if (profileIdFromStatus) {
			volunteerProfileId.value = profileIdFromStatus;
		}

		const profileDocumentIdFromStatus = String(status.volunteerProfileDocumentId || "").trim();
		if (profileDocumentIdFromStatus) {
			volunteerProfileDocumentId.value = profileDocumentIdFromStatus;
		}

		const nameFromStatus = String(status.volunteerName || "").trim();
		if (nameFromStatus) {
			volunteerName.value = nameFromStatus;
		}
	} catch {
		// noop
	}
}

function stopAnnouncement(): void {
	if (!import.meta.client || typeof window === "undefined" || !("speechSynthesis" in window)) {
		speechUtterance = null;
		return;
	}

	window.speechSynthesis.cancel();
	speechUtterance = null;
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

async function runReviewAnnouncement(autoStartVoice = false): Promise<void> {
	stopAnnouncement();
	void playJoyfulSound();

	const startVoiceAfterAnnouncement = () => {
		if (!autoStartVoice || isSubmitting.value || isListening.value) {
			return;
		}

		setTimeout(() => {
			if (isSubmitting.value || isListening.value) {
				return;
			}
			startVoiceInput();
		}, 120);
	};

	if (!import.meta.client || typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
		startVoiceAfterAnnouncement();
		return;
	}

	const utterance = new SpeechSynthesisUtterance(REVIEW_ANNOUNCEMENT_TEXT);
	utterance.lang = "ru-RU";
	utterance.rate = 1;
	utterance.pitch = 1;

	utterance.onend = () => {
		if (speechUtterance !== utterance) {
			return;
		}

		speechUtterance = null;
		startVoiceAfterAnnouncement();
	};

	utterance.onerror = () => {
		if (speechUtterance !== utterance) {
			return;
		}

		speechUtterance = null;
		startVoiceAfterAnnouncement();
	};

	speechUtterance = utterance;
	window.speechSynthesis.speak(utterance);
}

function ensureRecognitionCtor(): RecognitionCtor | null {
	if (!import.meta.client || typeof window === "undefined") {
		return null;
	}

	const speechWindow = window as Window & {
		SpeechRecognition?: RecognitionCtor
		webkitSpeechRecognition?: RecognitionCtor
	};

	return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
}

function stopVoiceInput(): void {
	const activeRecognition = recognition;
	recognition = null;
	isListening.value = false;

	if (!activeRecognition) {
		return;
	}

	activeRecognition.onresult = null;
	activeRecognition.onerror = null;
	activeRecognition.onend = null;
	try {
		activeRecognition.stop();
	} catch {
		// noop
	}
}

function normalizeSpeechText(value: string): string {
	return String(value || "")
		.toLowerCase()
		.replace(/[.,!?;:()"«»]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function stripVoiceCommands(value: string): string {
	let output = String(value || "");
	for (const command of [...SUBMIT_COMMANDS, ...SKIP_COMMANDS]) {
		const escaped = command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		output = output.replace(new RegExp(escaped, "ig"), " ");
	}

	return output.replace(/\s+/g, " ").trim();
}

function appendVoiceChunk(chunk: string): void {
	const normalizedChunk = String(chunk || "").replace(/\s+/g, " ").trim();
	if (!normalizedChunk) {
		return;
	}

	const lowerChunk = normalizeSpeechText(normalizedChunk);
	const shouldSkip = SKIP_COMMANDS.some(command => lowerChunk.includes(command));
	if (shouldSkip) {
		statusMessage.value = "Пропускаю отзыв.";
		stopVoiceInput();
		void skipReview();
		return;
	}

	const shouldSubmit = SUBMIT_COMMANDS.some(command => lowerChunk.includes(command));
	const chunkWithoutCommands = stripVoiceCommands(normalizedChunk);
	const lowerChunkWithoutCommands = normalizeSpeechText(chunkWithoutCommands);
	const stopWordIndex = lowerChunkWithoutCommands.indexOf(STOP_WORD);
	const chunkBeforeStopWord = stopWordIndex >= 0
		? chunkWithoutCommands.slice(0, stopWordIndex).trim()
		: chunkWithoutCommands;

	if (chunkBeforeStopWord) {
		feedbackText.value = [feedbackText.value.trim(), chunkBeforeStopWord].filter(Boolean).join(" ").trim();
	}

	if (shouldSubmit) {
		statusMessage.value = "Отправляю отзыв.";
		stopVoiceInput();
		void submitReview();
		return;
	}

	if (stopWordIndex >= 0) {
		statusMessage.value = "Отзыв записан. Нажми «Отправить отзыв» или отредактируй текст.";
		stopVoiceInput();
	}
}

function startVoiceInput(): void {
	if (isListening.value) {
		return;
	}

	const Ctor = ensureRecognitionCtor();
	if (!Ctor) {
		statusMessage.value = "Голосовой ввод недоступен в этом браузере.";
		return;
	}

	try {
		const nextRecognition = new Ctor();
		nextRecognition.lang = "ru-RU";
		nextRecognition.continuous = true;
		nextRecognition.interimResults = false;
		nextRecognition.maxAlternatives = 1;

		nextRecognition.onresult = (event: any) => {
			let chunk = "";
			const resultIndex = Number(event?.resultIndex || 0);
			const results = event?.results || [];

			for (let index = resultIndex; index < results.length; index += 1) {
				const item = results[index];
				if (!item?.isFinal) {
					continue;
				}

				chunk += ` ${String(item[0]?.transcript || "")}`;
			}

			appendVoiceChunk(chunk);
		};

		nextRecognition.onerror = () => {
			if (!isListening.value) {
				return;
			}

			statusMessage.value = "Не удалось распознать речь. Можно ввести отзыв вручную.";
			stopVoiceInput();
		};

		nextRecognition.onend = () => {
			if (recognition !== nextRecognition) {
				return;
			}

			recognition = null;
			isListening.value = false;
		};

		recognition = nextRecognition;
		isListening.value = true;
		statusMessage.value = "Слушаю отзыв. Скажи «Точка», «Отправить отзыв» или «Пропустить».";
		nextRecognition.start();
	} catch {
		statusMessage.value = "Не удалось запустить голосовой ввод.";
		stopVoiceInput();
	}
}

function toggleVoiceInput(): void {
	if (isListening.value) {
		stopVoiceInput();
		statusMessage.value = "Голосовой ввод остановлен.";
		return;
	}

	startVoiceInput();
}

async function submitReview(): Promise<void> {
	if (isSubmitting.value) {
		return;
	}

	const normalizedFeedback = feedbackText.value.replace(/\s+/g, " ").trim();
	if (!normalizedFeedback) {
		statusMessage.value = "Напиши или продиктуй отзыв перед отправкой.";
		return;
	}

	const normalizedVolunteerProfileDocumentId = String(volunteerProfileDocumentId.value || "").trim();
	if (!volunteerProfileId.value && !normalizedVolunteerProfileDocumentId) {
		statusMessage.value = "Не удалось определить волонтера. Можно нажать «Пропустить».";
		return;
	}

	isSubmitting.value = true;
	statusMessage.value = "Сохраняю отзыв...";
	stopVoiceInput();

	try {
		await auth.restoreSession();
		await auth.submitVolunteerReview(volunteerProfileId.value, normalizedFeedback, normalizedVolunteerProfileDocumentId);
		call.setCurrentSessionId(null);
		await navigateTo("/blind/home");
	} catch (error) {
		statusMessage.value = auth.normalizeError(error);
	} finally {
		isSubmitting.value = false;
	}
}

async function skipReview(): Promise<void> {
	if (isSubmitting.value) {
		return;
	}

	stopVoiceInput();
	stopAnnouncement();
	call.setCurrentSessionId(null);
	await navigateTo("/blind/home");
}

onMounted(() => {
	syncMetaFromRoute();
	void syncMetaFromSession();
	void runReviewAnnouncement(true);
});

onBeforeUnmount(() => {
	stopVoiceInput();
	stopAnnouncement();
	if (audioContext && audioContext.state !== "closed") {
		void audioContext.close();
		audioContext = null;
	}
});
</script>
