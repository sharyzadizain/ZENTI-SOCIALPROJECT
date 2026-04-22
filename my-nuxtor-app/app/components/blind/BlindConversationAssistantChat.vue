<template>
	<div class="mt-2 flex min-h-[760px] flex-col rounded-[34px] bg-[#3f75df] px-4 pb-[320px] pt-6 text-[#f4f4f5]">
		<p
			aria-live="polite"
			class="sr-only"
		>
			{{ liveStatus }}
		</p>

		<h1 class="text-[52px] leading-[0.95] font-semibold tracking-[-0.03em]">
			РЕЖИМ
			<br>
			РАЗГОВОРА
		</h1>

		<p class="mt-4 text-[24px] leading-[1.05] font-medium text-white/90">
			Говори голосом или пиши вручную.
		</p>
		<p class="mt-2 text-[20px] leading-[1.1] font-medium text-white/85">
			Чтобы выйти, зажми экран на 5 секунд.
		</p>

		<div
			ref="chatViewport"
			class="mt-5 space-y-3 rounded-[24px] bg-white/12 px-3 py-4"
		>
			<div
				v-for="message in messages"
				:key="message.id"
			>
				<div
					v-if="message.role === 'assistant'"
					class="rounded-[18px] bg-white/92 px-4 py-3 text-left text-black"
				>
					<p class="text-[15px] leading-none font-semibold text-[#315ec0]">
						{{ assistantDisplayName }}
					</p>
					<p class="mt-2 whitespace-pre-line text-[20px] leading-[1.2] font-medium">
						{{ message.text }}
					</p>
				</div>

				<div
					v-else
					class="ml-auto max-w-[92%] rounded-[18px] bg-[#d7ebff] px-4 py-3 text-left text-black"
				>
					<p class="whitespace-pre-line text-[20px] leading-[1.2] font-medium">
						{{ message.text }}
					</p>
				</div>
			</div>
		</div>

		<p
			v-if="isResponding"
			class="mt-3 text-left text-[18px] leading-[1.15] font-medium text-white/90"
		>
			{{ `${assistantDisplayName} отвечает...` }}
		</p>

		<p
			v-if="voiceStatus"
			class="mt-2 text-left text-[16px] leading-[1.15] font-medium text-white/90"
		>
			{{ voiceStatus }}
		</p>

		<p
			v-if="chatError"
			class="mt-2 text-left text-[16px] leading-[1.15] font-medium text-[#ffd8d8]"
		>
			{{ chatError }}
		</p>

		<div class="mt-3 grid grid-cols-[1fr_auto] gap-2">
			<input
				v-model="draftMessage"
				type="text"
				placeholder="Напиши сообщение..."
				class="h-[54px] w-full rounded-[16px] border-none bg-white px-4 text-[20px] leading-none font-medium text-black placeholder:text-black/45 focus:outline-none"
				:maxlength="MAX_MESSAGE_LENGTH"
				:disabled="isResponding || isExiting"
				@keydown.enter.prevent="sendDraftMessage"
			>
			<button
				type="button"
				class="h-[54px] min-w-[122px] rounded-[16px] bg-[#111111] px-4 text-[20px] leading-none font-semibold text-[#f4f4f5] transition disabled:opacity-60"
				:disabled="!canSendDraft"
				@click="sendDraftMessage"
			>
				Отправить
			</button>
		</div>

		<button
			type="button"
			class="mt-2 h-[62px] rounded-[18px] bg-white/18 px-4 text-[24px] leading-[1.05] font-semibold text-[#f4f4f5] transition disabled:opacity-60"
			:disabled="isResponding || isExiting"
			@click="toggleVoiceInput"
		>
			{{ isListening ? "Остановить голосовой ввод" : "Говорить голосом" }}
		</button>

		<div class="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-6">
			<div class="pointer-events-auto w-full max-w-[430px]">
				<button
					type="button"
					class="h-[220px] w-full rounded-[26px] border-2 border-white/70 bg-[#3f75df] px-5 text-[58px] leading-[0.9] font-semibold text-[#f4f4f5] shadow-[0_0_0_4px_rgba(255,255,255,0.16)] transition active:scale-[0.995]"
					:disabled="isExiting"
					@pointerdown="startExitHold"
					@pointerup="cancelExitHold"
					@pointerleave="cancelExitHold"
					@pointercancel="cancelExitHold"
				>
					ВЫЙТИ
					<br>
					<span class="text-[38px]">ЗАЖМИ НА 5 СЕКУНД</span>
				</button>

				<p
					v-if="holdProgress > 0 && holdProgress < 100"
					class="mt-2 text-center text-[20px] leading-none font-semibold text-white/90"
				>
					Удержание: {{ holdProgress }}%
				</p>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
type ChatRole = "assistant" | "user";

type ChatMessage = {
	id: string
	role: ChatRole
	text: string
}

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

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface AssistantReplyResponse {
	ok: boolean
	agentId: string
	agentName?: string
	reply: string
	sessionId?: string
}

const ASSISTANT_ID = "3";
const MAX_MESSAGE_LENGTH = 4000;
const EXIT_HOLD_MS = 5000;
const FIXED_EXIT_BUTTON_SPACE_PX = 280;
const INTRO_MESSAGE = "Я рядом и помогу поговорить. Можешь задать вопрос голосом или написать сообщение.";
const INTRO_SPEECH = "Режим разговора запущен. Можешь говорить голосом или писать вручную. Кнопка выхода находится внизу экрана. Чтобы выйти, зажми эту кнопку на 5 секунд.";

const emit = defineEmits<{
	exit: []
}>();

const runtimeConfig = useRuntimeConfig();

const chatViewport = ref<HTMLElement | null>(null);
const draftMessage = ref("");
const isResponding = ref(false);
const chatError = ref("");
const voiceStatus = ref("");
const liveStatus = ref("");
const isListening = ref(false);
const isExiting = ref(false);
const holdProgress = ref(0);
const assistantSessionId = ref("");
const runtimeAssistantName = ref("");
const messages = ref<ChatMessage[]>([]);

let holdTimer: ReturnType<typeof setTimeout> | null = null;
let holdProgressTimer: ReturnType<typeof setInterval> | null = null;
let holdStartedAt = 0;
let speechUtterance: SpeechSynthesisUtterance | null = null;
let recognition: SpeechRecognitionLike | null = null;
let messageCounter = 0;

const assistantDisplayName = computed(() => {
	const runtimeName = String(runtimeAssistantName.value || "").trim();
	if (runtimeName) {
		return runtimeName;
	}

	return String(runtimeConfig.public.callAssistant3Name || "Assistant 3").trim();
});

const canSendDraft = computed(() => {
	return Boolean(draftMessage.value.trim()) && !isResponding.value && !isExiting.value;
});

function makeMessage(role: ChatRole, text: string): ChatMessage {
	messageCounter += 1;
	return {
		id: `${Date.now()}_${messageCounter}`,
		role,
		text
	};
}

async function scrollToBottom(): Promise<void> {
	await nextTick();
	const viewport = chatViewport.value;
	if (!viewport) {
		return;
	}

	const canScrollViewport = viewport.scrollHeight - viewport.clientHeight > 1;
	if (canScrollViewport) {
		viewport.scrollTop = viewport.scrollHeight;
		return;
	}

	if (!import.meta.client || typeof window === "undefined") {
		return;
	}

	const viewportBottom = window.scrollY + viewport.getBoundingClientRect().bottom;
	const targetScrollTop = Math.max(0, viewportBottom - window.innerHeight + FIXED_EXIT_BUTTON_SPACE_PX);
	window.scrollTo({
		top: targetScrollTop,
		behavior: "smooth"
	});
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

function stopSpeechSynthesis(): void {
	if (!import.meta.client || typeof window === "undefined" || !("speechSynthesis" in window)) {
		speechUtterance = null;
		return;
	}

	window.speechSynthesis.cancel();
	speechUtterance = null;
}

function speakText(text: string, onDone?: (() => void) | null): void {
	if (!import.meta.client || typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
		if (onDone) {
			onDone();
		}
		return;
	}

	const normalizedText = String(text || "").replace(/\s+/g, " ").trim();
	if (!normalizedText) {
		if (onDone) {
			onDone();
		}
		return;
	}

	stopSpeechSynthesis();
	const utterance = new SpeechSynthesisUtterance(normalizedText);
	utterance.lang = "ru-RU";
	utterance.rate = 1;
	utterance.pitch = 1;
	utterance.onend = () => {
		if (speechUtterance !== utterance) {
			return;
		}
		speechUtterance = null;
		if (onDone) {
			onDone();
		}
	};
	utterance.onerror = () => {
		if (speechUtterance !== utterance) {
			return;
		}
		speechUtterance = null;
		if (onDone) {
			onDone();
		}
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
	if (errorCode === "not-allowed" || errorCode === "service-not-allowed") {
		return "Нет доступа к микрофону. Разреши микрофон в браузере.";
	}

	if (errorCode === "audio-capture") {
		return "Микрофон не найден. Проверь, что он подключен.";
	}

	if (errorCode === "no-speech") {
		return "Не удалось распознать речь. Попробуй сказать еще раз.";
	}

	if (errorCode === "network") {
		return "Проблема соединения во время распознавания речи.";
	}

	return "Не удалось распознать речь. Попробуй еще раз.";
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
		voiceStatus.value = "Слушаю...";
		liveStatus.value = "Слушаю ваше сообщение.";
	};

	instance.onresult = (event) => {
		const transcript = String(event?.results?.[0]?.[0]?.transcript || "").trim();
		if (!transcript) {
			voiceStatus.value = "Не удалось распознать речь.";
			return;
		}

		voiceStatus.value = `Распознано: ${transcript}`;
		draftMessage.value = transcript;
		void sendUserMessage(transcript);
	};

	instance.onerror = (event) => {
		const errorCode = String(event?.error || "");
		voiceStatus.value = mapSpeechError(errorCode);
		liveStatus.value = voiceStatus.value;
	};

	instance.onend = () => {
		isListening.value = false;
	};

	recognition = instance;
	return recognition;
}

function startVoiceInput(): void {
	if (isResponding.value || isExiting.value) {
		return;
	}

	const speechRecognition = ensureRecognition();
	if (!speechRecognition) {
		voiceStatus.value = "Голосовой ввод недоступен в этом браузере.";
		liveStatus.value = voiceStatus.value;
		return;
	}

	try {
		speechRecognition.start();
	} catch {
		voiceStatus.value = "Не удалось запустить голосовой ввод.";
		liveStatus.value = voiceStatus.value;
	}
}

function stopVoiceInput(): void {
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

function toggleVoiceInput(): void {
	if (isListening.value) {
		stopVoiceInput();
		voiceStatus.value = "Голосовой ввод остановлен.";
		liveStatus.value = voiceStatus.value;
		return;
	}

	startVoiceInput();
}

async function sendUserMessage(rawText: string): Promise<void> {
	const text = String(rawText || "").trim();
	if (!text || isResponding.value || isExiting.value) {
		return;
	}

	stopVoiceInput();
	draftMessage.value = "";
	chatError.value = "";
	messages.value.push(makeMessage("user", text));
	liveStatus.value = "Отправляю сообщение ассистенту.";
	await scrollToBottom();

	isResponding.value = true;
	let responseSpeechText = "";
	try {
		const payload = await $fetch<AssistantReplyResponse>("/api/call/assistant/respond", {
			method: "POST",
			body: {
				agentId: ASSISTANT_ID,
				message: text,
				sessionId: assistantSessionId.value || undefined
			}
		});

		const reply = String(payload.reply || "").trim() || "Я рядом и готов продолжить разговор.";
		if (payload.sessionId) {
			assistantSessionId.value = String(payload.sessionId).trim();
		}
		if (payload.agentName) {
			runtimeAssistantName.value = String(payload.agentName).trim();
		}

		messages.value.push(makeMessage("assistant", reply));
		responseSpeechText = reply;
		liveStatus.value = "Ответ получен.";
	} catch {
		chatError.value = "Не удалось получить ответ. Попробуй еще раз.";
		const fallbackReply = "Сейчас не получилось ответить. Попробуй снова через пару секунд.";
		messages.value.push(makeMessage("assistant", fallbackReply));
		responseSpeechText = fallbackReply;
		liveStatus.value = chatError.value;
	} finally {
		isResponding.value = false;
		await scrollToBottom();

		if (isExiting.value) {
			return;
		}

		if (responseSpeechText) {
			speakText(responseSpeechText, () => {
				startVoiceInput();
			});
			return;
		}

		startVoiceInput();
	}
}

async function sendDraftMessage(): Promise<void> {
	if (!canSendDraft.value) {
		return;
	}

	await sendUserMessage(draftMessage.value);
}

async function finishExitHold(): Promise<void> {
	if (isExiting.value) {
		return;
	}

	isExiting.value = true;
	liveStatus.value = "Выход из режима разговора.";
	stopVoiceInput();
	stopSpeechSynthesis();
	clearHoldTimers();
	holdProgress.value = 100;
	emit("exit");
}

function startExitHold(): void {
	if (isExiting.value) {
		return;
	}

	clearHoldTimers();
	holdStartedAt = Date.now();
	holdProgress.value = 0;
	voiceStatus.value = "";
	liveStatus.value = "Удерживай экран 5 секунд, чтобы выйти.";

	holdTimer = setTimeout(() => {
		void finishExitHold();
	}, EXIT_HOLD_MS);

	holdProgressTimer = setInterval(() => {
		const elapsed = Date.now() - holdStartedAt;
		holdProgress.value = Math.max(0, Math.min(99, Math.round((elapsed / EXIT_HOLD_MS) * 100)));
	}, 100);
}

function cancelExitHold(): void {
	if (isExiting.value) {
		return;
	}

	clearHoldTimers();
	if (holdProgress.value < 100) {
		holdProgress.value = 0;
	}
}

function initializeConversation(): void {
	messages.value = [makeMessage("assistant", INTRO_MESSAGE)];
	liveStatus.value = "Режим разговора открыт.";
	void scrollToBottom();
	speakText(INTRO_SPEECH, () => {
		startVoiceInput();
	});
}

onMounted(() => {
	initializeConversation();
});

onBeforeUnmount(() => {
	clearHoldTimers();
	stopVoiceInput();
	stopSpeechSynthesis();
});
</script>
