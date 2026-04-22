<template>
	<main class="min-h-dvh bg-gradient-to-b from-[#bfd4e5] to-[#f4f4f5]">
		<section class="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-[430px] flex-col px-7 pb-28 pt-12">
			<header class="text-center">
				<h1 class="text-[50px] leading-none font-medium tracking-[-0.03em] text-black">
					Привет {{ firstName }}!
				</h1>
				<p class="text-[25px] leading-none font-medium tracking-[-0.02em] text-black">
					Время помогать :)
				</p>
			</header>

			<article class="mt-8 rounded-[30px] bg-[#ececef] px-6 pb-5 pt-10">
				<button
					type="button"
					class="relative mx-auto block h-[280px] w-[248px] overflow-hidden focus:outline-none"
					:disabled="actionLoading"
					@click="handleHelpNow"
				>
					<img
						:src="heartSrc"
						alt="Сердце"
						class="h-auto w-full"
					>
	
				</button>

				<p class="mt-7 text-center text-[15px] leading-none font-medium tracking-[-0.01em] text-black/45">
					Прямо сейчас в помощи нуждаются {{ peopleNeedHelp }} человек
				</p>
			</article>

			<p
				v-if="errorMessage"
				class="mt-4 rounded-2xl bg-[#fee2e2] px-4 py-2 text-sm text-[#991b1b]"
			>
				{{ errorMessage }}
			</p>
		</section>

		<SharedBottomNav active="home" />
	</main>
</template>

<script setup lang="ts">
import heartPng from "@/assets/images/heart-first.png";

const auth = useStrapiAuth();
const call = useCallMatching();
const WAITING_COUNT_POLL_MS = 3000;

const heartSrc = heartPng;
const actionLoading = ref(false);
const errorMessage = ref("");
const waitingBlindCount = ref<number | null>(null);
let waitingCountPollTimer: ReturnType<typeof setInterval> | null = null;
let waitingCountInFlight = false;

const firstName = computed(() => auth.profile.value?.firstName || auth.onboardingName.value || "Катя");
const peopleNeedHelp = computed(() => waitingBlindCount.value ?? auth.profile.value?.peopleNeedHelp ?? 0);

function clearWaitingCountPollTimer(): void {
	if (!waitingCountPollTimer) {
		return;
	}

	clearInterval(waitingCountPollTimer);
	waitingCountPollTimer = null;
}

async function refreshWaitingBlindCount(): Promise<void> {
	if (waitingCountInFlight) {
		return;
	}

	waitingCountInFlight = true;
	try {
		waitingBlindCount.value = await call.getWaitingBlindCount();
	} catch {
		// keep last successful value
	} finally {
		waitingCountInFlight = false;
	}
}

onMounted(async () => {
	try {
		await auth.restoreSession();
		await auth.refreshDashboard();
		await refreshWaitingBlindCount();
		clearWaitingCountPollTimer();
		waitingCountPollTimer = setInterval(() => {
			void refreshWaitingBlindCount();
		}, WAITING_COUNT_POLL_MS);
	} catch (error) {
		errorMessage.value = auth.normalizeError(error);
	}
});

onBeforeUnmount(() => {
	clearWaitingCountPollTimer();
});

async function handleHelpNow(): Promise<void> {
	if (actionLoading.value) {
		return;
	}

	errorMessage.value = "";
	actionLoading.value = true;

	try {
		await navigateTo("/call");
	} catch (error) {
		errorMessage.value = auth.normalizeError(error);
	} finally {
		actionLoading.value = false;
	}
}
</script>
