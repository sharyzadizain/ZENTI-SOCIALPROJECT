<template>
	<main class="min-h-dvh bg-[#f4f4f5]">
		<section class="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-[430px] flex-col px-7 pb-8 pt-16">
			<header class="text-center">
				<h1 class="text-[28px] leading-tight font-medium tracking-[-0.02em] text-black">
					{{ greetingText }}
				</h1>
				<p class="mt-3 text-[15px] leading-snug text-black/70">
					{{ instructionText }}
				</p>
				<p
					aria-live="polite"
					class="mt-2 text-[14px] leading-none font-semibold text-[#4f8fea]"
				>
					Отсчет: {{ secondsLeft }} сек.
				</p>
			</header>

			<div class="flex justify-center">
				<button
					type="button"
					class="mt-5 rounded-2xl bg-[#e9e9eb] px-8 py-2 text-[20px] leading-none font-medium text-black transition hover:brightness-95 disabled:opacity-60"
					:disabled="isNavigating"
					@click="finishVolunteerEntry"
				>
					Я-Волонтер
				</button>
			</div>

			<div class="relative mt-8 flex flex-1 items-start justify-center overflow-hidden">
				<img
					:src="heartSrc"
					alt="Сердечко"
					class="w-[320px]"
				>
			</div>
		</section>
	</main>
</template>

<script setup lang="ts">
import heartPng from "@/assets/images/heart-first.png";

const auth = useStrapiAuth();
const heartSrc = heartPng;
const AUTO_REDIRECT_SECONDS = 15;
const instructionText = "Если Вы незрячий, подождите 15 секунд. Если Вы волонтер, нажмите на кнопку.";

const greetingText = ref("Здравствуйте!");
const secondsLeft = ref(AUTO_REDIRECT_SECONDS);
const isNavigating = ref(false);

let countdownTimer: ReturnType<typeof setInterval> | null = null;
let audioContext: AudioContext | null = null;
let speechUtterance: SpeechSynthesisUtterance | null = null;
let announcementFallbackTimer: ReturnType<typeof setTimeout> | null = null;

await auth.restoreSession();

function resolveGreetingByTime(now: Date): string {
	const hours = now.getHours();
	if (hours >= 5 && hours < 12) {
		return "Доброе утро!";
	}

	if (hours >= 12 && hours < 18) {
		return "Добрый день!";
	}

	return "Добрый вечер!";
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
	secondsLeft.value = AUTO_REDIRECT_SECONDS;
	void playTickSound();

	countdownTimer = setInterval(() => {
		void playTickSound();

		if (secondsLeft.value <= 1) {
			stopCountdown();
			void finishBlindEntry();
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

function runAnnouncementThenCountdown(): void {
	if (!import.meta.client || typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
		startCountdown();
		return;
	}

	stopAnnouncement();

	const announcementText = `${greetingText.value} ${instructionText}`;
	const utterance = new SpeechSynthesisUtterance(announcementText);
	utterance.lang = "ru-RU";
	utterance.rate = 1;
	utterance.pitch = 1;

	utterance.onend = () => {
		if (speechUtterance !== utterance) {
			return;
		}

		speechUtterance = null;
		clearAnnouncementFallbackTimer();
		startCountdown();
	};

	utterance.onerror = () => {
		if (speechUtterance !== utterance) {
			return;
		}

		speechUtterance = null;
		clearAnnouncementFallbackTimer();
		startCountdown();
	};

	speechUtterance = utterance;
	announcementFallbackTimer = setTimeout(() => {
		if (speechUtterance !== utterance) {
			return;
		}

		stopAnnouncement();
		startCountdown();
	}, 12000);

	window.speechSynthesis.speak(utterance);
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

async function playTickSound(): Promise<void> {
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

	const oscillator = context.createOscillator();
	const gain = context.createGain();
	oscillator.type = "sine";
	oscillator.frequency.value = 880;
	gain.gain.setValueAtTime(0.0001, context.currentTime);
	gain.gain.exponentialRampToValueAtTime(0.05, context.currentTime + 0.01);
	gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.09);
	oscillator.connect(gain);
	gain.connect(context.destination);
	oscillator.start();
	oscillator.stop(context.currentTime + 0.1);
}


async function goNext(guestRoute: string): Promise<void> {
	if (auth.isLoggedIn.value) {
		await navigateTo("/home");
		return;
	}

	await navigateTo(guestRoute);
}

async function finishVolunteerEntry(): Promise<void> {
	if (isNavigating.value) {
		return;
	}

	isNavigating.value = true;
	stopCountdown();
	stopAnnouncement();
	await goNext("/onboarding/invite");
}

async function finishBlindEntry(): Promise<void> {
	if (isNavigating.value) {
		return;
	}

	isNavigating.value = true;
	stopCountdown();
	stopAnnouncement();
	await navigateTo("/onboarding/blind-name");
}

onMounted(() => {
	greetingText.value = resolveGreetingByTime(new Date());
	runAnnouncementThenCountdown();
});

onBeforeUnmount(() => {
	stopCountdown();
	stopAnnouncement();
	if (audioContext && audioContext.state !== "closed") {
		void audioContext.close();
		audioContext = null;
	}
});
</script>
