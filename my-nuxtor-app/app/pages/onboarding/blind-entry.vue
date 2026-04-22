<template>
	<main class="min-h-dvh bg-[#f4f4f5]">
		<section class="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-[430px] flex-col px-7 pb-10 pt-14">
			<h1 class="text-[50px] leading-[0.95] font-medium tracking-[-0.03em] text-black">
				Как тебя зовут?
			</h1>

			<div class="mt-auto">
				<label class="block text-[20px] leading-none font-medium tracking-[-0.01em] text-black">
					Введи имя
				</label>

				<input
					ref="nameInput"
					v-model="name"
					type="text"
					maxlength="40"
					placeholder="Имя"
					class="mt-4 w-full rounded-[20px] border border-[#d4e0ea] bg-white px-5 py-4 text-[22px] leading-none text-black outline-none focus:border-[#83addf]"
				>

				<p class="mt-5 text-[18px] leading-[1.05] font-medium tracking-[-0.01em] text-black">
					Если сложно печатать, скажи имя вслух.
				</p>

				<button
					type="button"
					class="mt-6 w-full rounded-[20px] py-4 text-[20px] leading-none font-medium text-white transition"
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
const auth = useStrapiAuth();
const INTRO_ANNOUNCEMENT_TEXT = "Давай познакомимся! Как тебя зовут? Просто скажи имя, или введи имя с клавиатуры, я - запомню.";

const name = ref(auth.onboardingName.value);
const nameInput = useTemplateRef<HTMLInputElement>("nameInput");
let speechUtterance: SpeechSynthesisUtterance | null = null;

const canContinue = computed(() => name.value.trim().length >= 2);

watch(name, (value) => {
	auth.setOnboardingName(value);
});

onMounted(() => {
	playIntroductionSpeech();
	nextTick(() => {
		nameInput.value?.focus();
	});
});

onBeforeUnmount(() => {
	stopIntroductionSpeech();
});

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
	};

	utterance.onerror = () => {
		if (speechUtterance !== utterance) {
			return;
		}

		speechUtterance = null;
	};

	speechUtterance = utterance;
	window.speechSynthesis.speak(utterance);
}

function goNext(): void {
	if (!canContinue.value) {
		return;
	}

	auth.setOnboardingName(name.value);
	void navigateTo("/onboarding/blind-repeat");
}
</script>
