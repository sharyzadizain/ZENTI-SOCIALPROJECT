<template>
	<main class="min-h-dvh bg-[#f4f4f5]">
		<section class="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-[56px] pb-[44px] pt-[121px]">
			<h1 class="text-[50px] leading-[0.95] font-medium tracking-[-0.03em] text-black">
				Как тебя зовут?
			</h1>

			<div class="mt-[320px] flex flex-col items-center">
				<button
					type="button"
					class="group relative h-[198px] w-[198px] touch-none"
					@pointerdown.prevent="startHold"
					@pointerup="stopHold"
					@pointerleave="stopHold"
					@pointercancel="stopHold"
				>
					<img
						ref="starImage"
						src="/Star%202.png"
						alt="Кнопка записи"
						class="h-full w-full object-contain"
					>
					<span class="absolute inset-0 flex items-center justify-center text-base font-semibold text-[#244256]">
						{{ name ? `Имя: ${name}` : "Ввести имя" }}
					</span>
				</button>

				<div class="mt-[92px] flex w-full max-w-[320px] flex-col items-start self-start">
					<img
						src="/Vector%20100.png"
						alt=""
						aria-hidden="true"
						class="h-[52px] w-[23px] shrink-0 object-contain"
					>
					<p class="-mt-1 text-[20px] leading-[1.05] font-medium tracking-[-0.01em] text-black">
						Зажми и скажи свое Имя :)
					</p>
				</div>

				<div class="mt-5 w-full">
					<input
						v-if="showInput"
						ref="nameInput"
						v-model="name"
						type="text"
						maxlength="40"
						placeholder="Введи имя"
						class="w-full rounded-2xl border border-[#d4e0ea] bg-white px-4 py-3 text-base text-black outline-none focus:border-[#9bc5e6]"
					>

					<p
						v-if="statusMessage"
						aria-live="polite"
						class="mt-3 text-center text-[14px] leading-tight font-medium text-black/60"
					>
						{{ statusMessage }}
					</p>

					<button
						v-if="canContinue"
						type="button"
						class="mt-4 w-full rounded-2xl bg-[#93c5ea] py-3 text-base font-semibold text-white shadow-[0_14px_30px_rgba(99,145,184,0.34)] transition hover:brightness-105"
						@click="goNext"
					>
						Продолжить
					</button>
				</div>
			</div>
		</section>
	</main>
</template>

<script setup lang="ts">
import { gsap } from "gsap";

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

const auth = useStrapiAuth();

const name = ref(auth.onboardingName.value);
const showInput = ref(Boolean(name.value));
const statusMessage = ref("");
const nameInput = useTemplateRef<HTMLInputElement>("nameInput");
const starImage = useTemplateRef<HTMLImageElement>("starImage");
const isHolding = ref(false);
const isListening = ref(false);

const canContinue = computed(() => name.value.trim().length >= 2);

let recognition: SpeechRecognitionLike | null = null;
let spinTween: gsap.core.Tween | null = null;

watch(name, (value) => {
	auth.setOnboardingName(value);
});

onMounted(() => {
	stopAnySpeechSynthesis();
});

onBeforeUnmount(() => {
	stopHold();
});

function stopAnySpeechSynthesis(): void {
	if (!import.meta.client || typeof window === "undefined" || !("speechSynthesis" in window)) {
		return;
	}

	window.speechSynthesis.cancel();
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
		return "Не расслышал имя. Попробуй еще раз.";
	}

	if (errorCode === "audio-capture") {
		return "Микрофон недоступен. Введи имя вручную.";
	}

	if (errorCode === "not-allowed") {
		return "Нет доступа к микрофону. Разреши доступ или введи имя вручную.";
	}

	if (errorCode === "network") {
		return "Ошибка сети при распознавании. Попробуй снова.";
	}

	return "Не удалось распознать речь. Введи имя вручную.";
}

function startSpin(): void {
	if (!starImage.value || spinTween) {
		return;
	}

	spinTween = gsap.to(starImage.value, {
		rotation: "+=360",
		repeat: -1,
		duration: 1.5,
		ease: "none"
	});
}

function stopSpin(): void {
	if (!spinTween) {
		if (starImage.value) {
			gsap.set(starImage.value, {
				rotation: 0
			});
		}
		return;
	}

	spinTween.kill();
	spinTween = null;

	if (starImage.value) {
		gsap.set(starImage.value, {
			rotation: 0
		});
	}
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
	instance.continuous = true;
	instance.interimResults = false;
	instance.maxAlternatives = 1;

	instance.onstart = () => {
		isListening.value = true;
		statusMessage.value = "";
	};

	instance.onresult = (event) => {
		const results = event?.results;
		const lastIndex = results?.length ? results.length - 1 : 0;
		const transcript = String(results?.[lastIndex]?.[0]?.transcript || "").trim();

		if (!transcript) {
			return;
		}

		name.value = transcript;
		auth.setOnboardingName(transcript);
		showInput.value = false;
		statusMessage.value = `Имя: ${transcript}`;
	};

	instance.onerror = (event) => {
		const errorCode = String(event?.error || "");
		statusMessage.value = mapSpeechError(errorCode);
		showInput.value = true;
		nextTick(() => {
			nameInput.value?.focus();
		});
	};

	instance.onend = () => {
		isListening.value = false;
	};

	recognition = instance;
	return recognition;
}

function startListening(): void {
	if (isListening.value) {
		return;
	}

	const speechRecognition = ensureRecognition();
	if (!speechRecognition) {
		showInput.value = true;
		statusMessage.value = "В этом браузере нет распознавания речи. Введи имя вручную.";
		nextTick(() => {
			nameInput.value?.focus();
		});
		return;
	}

	try {
		speechRecognition.start();
	} catch {
		// Ignore duplicate start attempts from rapid pointer events.
	}
}

function startHold(event: PointerEvent): void {
	const target = event.currentTarget as HTMLElement | null;
	target?.setPointerCapture?.(event.pointerId);

	if (isHolding.value) {
		return;
	}

	isHolding.value = true;
	statusMessage.value = "";
	startSpin();
	startListening();
}

function stopHold(event?: PointerEvent): void {
	if (event) {
		const target = event.currentTarget as HTMLElement | null;
		if (target?.hasPointerCapture?.(event.pointerId)) {
			target.releasePointerCapture(event.pointerId);
		}
	}

	if (!isHolding.value && !isListening.value && !spinTween) {
		return;
	}

	isHolding.value = false;
	stopSpin();
	stopListening();
}

function goNext(): void {
	if (!canContinue.value) {
		return;
	}

	auth.setOnboardingName(name.value);
	navigateTo("/onboarding/name");
}
</script>
