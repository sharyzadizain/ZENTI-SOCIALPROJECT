<template>
	<div class="mt-[26px] pr-2">
		<div
			ref="chatScrollViewport"
			class="max-h-[250px] space-y-3 overflow-y-auto pr-1"
		>
			<div
				v-for="message in chatMessages"
				:key="message.id"
			>
				<div
					v-if="message.role === 'assistant'"
					class="flex items-start gap-3"
				>
					<div class="mt-1 h-[34px] w-[34px] shrink-0 rounded-full bg-gradient-to-br from-[#68b9ee] to-[#2f8ddf]" />

					<div class="min-w-0 max-w-[88%]">
						<p class="text-[12px] leading-none font-medium text-black/65">
							{{ resolvedAssistantName }}
						</p>
						<div class="mt-1 rounded-[14px] bg-white/70 px-3 py-2">
							<p class="whitespace-pre-line text-[14px] leading-[1.28] font-medium tracking-[-0.01em] text-black">
								{{ message.text }}
							</p>
						</div>
					</div>
				</div>

				<div
					v-else
					class="ml-auto max-w-[88%] rounded-[14px] bg-[#d8ebff] px-3 py-2"
				>
					<p class="whitespace-pre-line text-[14px] leading-[1.28] font-medium tracking-[-0.01em] text-black">
						{{ message.text }}
					</p>
				</div>
			</div>
		</div>

		<p
			v-if="isResponding"
			class="mt-2 text-[12px] font-medium text-black/50"
		>
			{{ `${resolvedAssistantName} печатает...` }}
		</p>

		<p
			v-if="chatError"
			class="mt-2 text-[12px] font-medium text-[#d13f3f]"
		>
			{{ chatError }}
		</p>
	</div>

	<div
		v-if="showHintOverlay"
		class="absolute inset-0 z-20"
	>
		<button
			type="button"
			aria-label="Скрыть подсказку"
			class="absolute inset-0 bg-transparent"
			@click="hideHintOverlay"
		/>

		<img
			src="/Group 169 (1).png"
			alt=""
			aria-hidden="true"
			class="pointer-events-none absolute left-[-16px] top-[70px] w-[230px] select-none"
		>

		<img
			src="/Vector 216.png"
			alt=""
			aria-hidden="true"
			class="pointer-events-none absolute bottom-[44px] left-[72px] w-[210px] select-none opacity-95"
		>
	</div>

	<div class="absolute bottom-7 left-[22px] right-[22px]">
		<form
			class="relative flex h-[56px] items-center rounded-full bg-[#f4f4f5] pl-[20px] pr-[72px]"
			@submit.prevent="sendMessage"
		>
			<input
				v-model="draftMessage"
				type="text"
				placeholder="Напишите сообщение..."
				class="h-full w-full bg-transparent text-[14px] leading-none font-medium text-black placeholder:text-black/30 focus:outline-none"
				:maxlength="MAX_MESSAGE_LENGTH"
				@focus="hideHintOverlay"
			>

			<button
				type="submit"
				aria-label="Отправить"
				:disabled="!canSendMessage"
				class="absolute right-[7px] top-1/2 flex h-[42px] w-[42px] -translate-y-1/2 items-center justify-center rounded-full bg-[#1591f0] text-[36px] leading-none font-light text-white shadow-[0_2px_6px_rgba(0,0,0,0.22)] transition"
				:class="canSendMessage ? 'opacity-100' : 'opacity-50'"
			>
				&gt;
			</button>
		</form>
	</div>
</template>

<script setup lang="ts">
interface CallAssistantMessage {
	id: string
	role: "assistant" | "user"
	text: string
}

interface AssistantReplyResponse {
	ok: boolean
	agentId: string
	agentName?: string
	reply: string
	sessionId?: string
}

const MAX_MESSAGE_LENGTH = 4000;

const props = withDefaults(defineProps<{
	assistantId?: string
	initialMessage: string
	assistantName?: string
}>(), {
	assistantId: "1",
	assistantName: ""
});

const runtimeConfig = useRuntimeConfig();

const chatScrollViewport = ref<HTMLElement | null>(null);
const draftMessage = ref("");
const isResponding = ref(false);
const showHintOverlay = ref(true);
const chatError = ref("");
const assistantSessionId = ref("");
const runtimeAssistantName = ref("");
const chatMessages = ref<CallAssistantMessage[]>([]);

let messageCounter = 0;

function normalizeAssistantId(raw: unknown): string {
	const candidate = String(raw || "1").trim();
	return ["1", "2", "3", "4"].includes(candidate) ? candidate : "1";
}

const normalizedAssistantId = computed(() => normalizeAssistantId(props.assistantId));

const assistantNamesById = computed<Record<string, string>>(() => {
	return {
		"1": String(runtimeConfig.public.callAssistant1Name || "Олеся AI").trim(),
		"2": String(runtimeConfig.public.callAssistant2Name || "Олеся AI").trim(),
		"3": String(runtimeConfig.public.callAssistant3Name || "Assistant 3").trim(),
		"4": String(runtimeConfig.public.callAssistant4Name || "Assistant 4").trim()
	};
});

const resolvedAssistantName = computed(() => {
	if (runtimeAssistantName.value) {
		return runtimeAssistantName.value;
	}

	const byProp = String(props.assistantName || "").trim();
	if (byProp) {
		return byProp;
	}

	return assistantNamesById.value[normalizedAssistantId.value] || `Assistant ${normalizedAssistantId.value}`;
});

const canSendMessage = computed(() => {
	return !isResponding.value && Boolean(draftMessage.value.trim());
});

function makeMessage(role: "assistant" | "user", text: string): CallAssistantMessage {
	messageCounter += 1;
	return {
		id: `${Date.now()}_${messageCounter}`,
		role,
		text
	};
}

async function scrollToBottom(): Promise<void> {
	await nextTick();
	const viewport = chatScrollViewport.value;
	if (!viewport) {
		return;
	}

	viewport.scrollTop = viewport.scrollHeight;
}

function hideHintOverlay(): void {
	showHintOverlay.value = false;
}

function resetChat(): void {
	draftMessage.value = "";
	isResponding.value = false;
	showHintOverlay.value = true;
	chatError.value = "";
	assistantSessionId.value = "";
	runtimeAssistantName.value = "";

	const message = String(props.initialMessage || "").trim();
	chatMessages.value = message ? [makeMessage("assistant", message)] : [];
	void scrollToBottom();
}

async function sendMessage(): Promise<void> {
	const text = draftMessage.value.trim();
	if (!text || isResponding.value) {
		return;
	}

	hideHintOverlay();
	chatError.value = "";
	draftMessage.value = "";
	chatMessages.value.push(makeMessage("user", text));
	await scrollToBottom();

	isResponding.value = true;
	try {
		const payload = await $fetch<AssistantReplyResponse>("/api/call/assistant/respond", {
			method: "POST",
			body: {
				agentId: normalizedAssistantId.value,
				message: text,
				sessionId: assistantSessionId.value || undefined
			}
		});

		const reply = String(payload.reply || "").trim();
		if (payload.sessionId) {
			assistantSessionId.value = String(payload.sessionId).trim();
		}
		if (payload.agentName) {
			runtimeAssistantName.value = String(payload.agentName).trim();
		}

		chatMessages.value.push(
			makeMessage("assistant", reply || "Я рядом. Попробуй задать вопрос еще раз.")
		);
	} catch {
		chatError.value = "Не удалось получить ответ от ассистента.";
		chatMessages.value.push(
			makeMessage("assistant", "Сейчас не получилось ответить. Попробуй снова через пару секунд.")
		);
	} finally {
		isResponding.value = false;
		await scrollToBottom();
	}
}

watch(
	() => [props.initialMessage, normalizedAssistantId.value],
	() => {
		resetChat();
	},
	{ immediate: true }
);
</script>
