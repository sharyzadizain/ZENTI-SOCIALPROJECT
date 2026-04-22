<template>
	<div class="pointer-events-none absolute inset-0 z-40">
		<button
			type="button"
			class="pointer-events-auto absolute right-5 top-5 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#3f99ea] text-[12px] font-semibold text-white shadow-[0_8px_22px_rgba(0,0,0,0.24)] transition hover:brightness-105 disabled:opacity-55"
			:disabled="disabled"
			:aria-label="isOpen ? 'Закрыть помощника' : 'Открыть помощника'"
			@click="toggleMenu"
		>
			<span :class="isOpen ? 'text-[28px] leading-none font-medium' : 'text-[12px] leading-none font-semibold'">
				{{ isOpen ? "×" : "AI" }}
			</span>
		</button>

		<Transition
			enter-active-class="transition duration-180 ease-out"
			enter-from-class="opacity-0 scale-[0.98] translate-y-2"
			enter-to-class="opacity-100 scale-100 translate-y-0"
			leave-active-class="transition duration-140 ease-in"
			leave-from-class="opacity-100 scale-100 translate-y-0"
			leave-to-class="opacity-0 scale-[0.98] translate-y-2"
		>
			<section
				v-if="isOpen"
				class="pointer-events-auto absolute inset-x-3 top-3 bottom-4 flex flex-col rounded-[28px] bg-[#ececef]/98 p-3 shadow-[0_18px_36px_rgba(0,0,0,0.26)] backdrop-blur-[1px]"
			>
				<div class="mb-2 flex items-center justify-end">
					<button
						type="button"
						class="rounded-full bg-white/80 px-4 py-1 text-[12px] font-medium text-black/70 transition hover:bg-white"
						@click="closeMenu"
					>
						Скрыть чат
					</button>
				</div>

				<div class="rounded-[24px] bg-gradient-to-r from-[#4aa6ee] to-[#67b6ea] px-4 pb-3 pt-2 text-center text-[#f4f4f5]">
					<p class="text-[12px] leading-none font-medium opacity-80">
						Имя
					</p>
					<p class="mt-1 text-[36px] leading-none font-medium tracking-[-0.02em]">
						{{ resolvedBlindName }}
					</p>
				</div>

				<div
					ref="chatViewport"
					class="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1"
				>
					<div
						v-for="message in messages"
						:key="message.id"
					>
						<div
							v-if="message.role === 'assistant'"
							class="flex items-start gap-3"
						>
							<div class="mt-1 h-[44px] w-[44px] shrink-0 rounded-full bg-gradient-to-br from-[#78bbe9] to-[#3f97e6]" />

							<div class="min-w-0 max-w-[84%]">
								<p class="text-[14px] leading-none font-medium text-black">
									{{ resolvedAssistantName }}
								</p>
								<p class="mt-1 whitespace-pre-line text-[18px] leading-[1.18] tracking-[-0.02em] text-black">
									{{ message.text }}
								</p>
							</div>
						</div>

						<div
							v-else
							class="ml-auto flex max-w-[84%] items-start justify-end gap-3"
						>
							<p class="whitespace-pre-line text-right text-[18px] leading-[1.18] tracking-[-0.02em] text-black">
								{{ message.text }}
							</p>
							<div class="mt-1 h-[44px] w-[44px] shrink-0 rounded-full bg-gradient-to-br from-[#c5cad3] to-[#8f98a7]" />
						</div>
					</div>
				</div>

				<p
					v-if="isResponding"
					class="mt-2 text-[12px] font-medium text-black/55"
				>
					{{ `${resolvedAssistantName} печатает...` }}
				</p>

				<p
					v-if="chatError"
					class="mt-2 text-[12px] font-medium text-[#d13f3f]"
				>
					{{ chatError }}
				</p>

				<div class="mt-3 rounded-[18px] bg-white/65 px-4 py-3">
					<p class="text-[13px] leading-[1.2] font-medium text-black/75">
						Интересы незрячего: {{ resolvedBlindInterests }}
					</p>
				</div>

				<form
					class="relative mt-3 flex h-[56px] items-center rounded-full bg-[#f4f4f5] pl-[20px] pr-[72px]"
					@submit.prevent="sendMessage"
				>
					<input
						v-model="draftMessage"
						type="text"
						placeholder="Напишите сообщение..."
						class="h-full w-full bg-transparent text-[15px] leading-none font-medium text-black placeholder:text-black/30 focus:outline-none"
						:maxlength="MAX_MESSAGE_LENGTH"
					>

					<button
						type="submit"
						aria-label="Отправить"
						:disabled="!canSendMessage"
						class="absolute right-[7px] top-1/2 flex h-[42px] w-[42px] -translate-y-1/2 items-center justify-center rounded-full bg-[#3f99ea] text-[35px] leading-none font-light text-white shadow-[0_2px_6px_rgba(0,0,0,0.22)] transition"
						:class="canSendMessage ? 'opacity-100' : 'opacity-50'"
					>
						&gt;
					</button>
				</form>
			</section>
		</Transition>
	</div>
</template>

<script setup lang="ts">
interface MenuMessage {
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
	assistantName?: string
	blindName?: string
	blindInterests?: string
	disabled?: boolean
}>(), {
	assistantId: "2",
	assistantName: "",
	blindName: "",
	blindInterests: "",
	disabled: false
});

const runtimeConfig = useRuntimeConfig();

const isOpen = ref(false);
const chatViewport = ref<HTMLElement | null>(null);
const draftMessage = ref("");
const isResponding = ref(false);
const chatError = ref("");
const assistantSessionId = ref("");
const runtimeAssistantName = ref("");
const messages = ref<MenuMessage[]>([]);

let messageCounter = 0;

function normalizeAssistantId(raw: unknown): string {
	const candidate = String(raw || "2").trim();
	return ["1", "2", "3", "4"].includes(candidate) ? candidate : "2";
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

	const fromProps = String(props.assistantName || "").trim();
	if (fromProps) {
		return fromProps;
	}

	return assistantNamesById.value[normalizedAssistantId.value] || "Олеся AI";
});

const resolvedBlindName = computed(() => {
	return String(props.blindName || "").trim() || "Имя незрячего";
});

const resolvedBlindInterests = computed(() => {
	const raw = String(props.blindInterests || "").replace(/\s+/g, " ").trim();
	return raw || "Не указаны.";
});

const canSendMessage = computed(() => {
	return !props.disabled && !isResponding.value && Boolean(draftMessage.value.trim());
});

function makeMessage(role: "assistant" | "user", text: string): MenuMessage {
	messageCounter += 1;
	return {
		id: `${Date.now()}_${messageCounter}`,
		role,
		text
	};
}

function buildInitialAssistantMessage(): string {
	return `Я на связи во время звонка.
Интересы незрячего: ${resolvedBlindInterests.value}
Напиши вопрос, и я подскажу, как лучше поддержать разговор.`;
}

function buildAssistantPrompt(userMessage: string): string {
	return [
		`Ты второй ассистент для волонтера. Твое имя: ${resolvedAssistantName.value}.`,
		"Ты помогаешь волонтеру общаться с незрячим во время активного звонка.",
		`Имя незрячего: ${resolvedBlindName.value}.`,
		`Интересы незрячего: ${resolvedBlindInterests.value}.`,
		"Отвечай только на русском языке, кратко и по делу (1-3 предложения).",
		"Если уместно, предложи готовую фразу, которую волонтер может произнести вслух.",
		"",
		`Сообщение волонтера: ${userMessage}`
	].join("\n");
}

async function scrollToBottom(): Promise<void> {
	await nextTick();
	const viewport = chatViewport.value;
	if (!viewport) {
		return;
	}

	viewport.scrollTop = viewport.scrollHeight;
}

function resetConversation(): void {
	draftMessage.value = "";
	isResponding.value = false;
	chatError.value = "";
	assistantSessionId.value = "";
	runtimeAssistantName.value = "";
	messages.value = [makeMessage("assistant", buildInitialAssistantMessage())];
	void scrollToBottom();
}

function toggleMenu(): void {
	if (props.disabled) {
		return;
	}

	isOpen.value = !isOpen.value;
	if (isOpen.value) {
		void scrollToBottom();
	}
}

function closeMenu(): void {
	isOpen.value = false;
}

async function sendMessage(): Promise<void> {
	const text = draftMessage.value.trim();
	if (!text || isResponding.value || props.disabled) {
		return;
	}

	chatError.value = "";
	draftMessage.value = "";
	messages.value.push(makeMessage("user", text));
	await scrollToBottom();

	isResponding.value = true;
	try {
		const payload = await $fetch<AssistantReplyResponse>("/api/call/assistant/respond", {
			method: "POST",
			body: {
				agentId: normalizedAssistantId.value,
				message: buildAssistantPrompt(text),
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

		messages.value.push(
			makeMessage("assistant", reply || "Я рядом. Спроси по-другому, и я помогу подобрать реплику.")
		);
	} catch {
		chatError.value = "Не удалось получить ответ от ассистента.";
		messages.value.push(
			makeMessage("assistant", "Сейчас не получилось ответить. Попробуй еще раз через пару секунд.")
		);
	} finally {
		isResponding.value = false;
		await scrollToBottom();
	}
}

watch(
	() => [props.blindName, props.blindInterests, normalizedAssistantId.value],
	() => {
		resetConversation();
	}
);

watch(
	() => props.disabled,
	(disabled) => {
		if (disabled) {
			isOpen.value = false;
		}
	}
);

onMounted(() => {
	resetConversation();
});
</script>
