<template>
	<main class="min-h-dvh bg-gradient-to-b from-[#bfd4e5] from-[0%] to-[#f4f4f5] to-[68%]">
		<section class="mx-auto flex min-h-dvh w-full max-w-[440px] px-[30px] pb-8 pt-8">
			<article
				class="mt-[64px] w-full rounded-[30px] bg-[#ececef]"
				:class="screenState === 'searching'
					? 'relative h-[620px] px-[22px] pb-7 pt-[22px]'
					: screenState === 'not_found'
						? 'h-[646px] px-7 pb-12 pt-[74px]'
						: 'h-[620px] px-7 pb-10 pt-[74px]'"
			>
				<template v-if="screenState === 'searching'">
					<div class="rounded-[30px] bg-gradient-to-b from-[#3d9fea] to-[#66b3ea] px-4 pb-[22px] pt-[18px] text-center text-[#f4f4f5]">
						<p class="text-[48px] leading-none font-medium tracking-[-0.02em]">
							Поиск звонка
						</p>
						<p class="mt-6 text-[70px] leading-none font-medium tracking-[-0.03em]">
							{{ formattedSearchTime }}
						</p>
						<p class="-mt-1 text-[24px] leading-none font-medium tracking-[-0.02em] text-white/45">
							минуты:секунды
						</p>
					</div>

					<CallAssistantChat
						assistant-id="1"
						assistant-name="Олеся AI"
						:initial-message="initialAssistantMessage"
					/>
				</template>

				<template v-else-if="screenState === 'found'">
					<div
						ref="foundPhoneVisual"
						class="relative mx-auto w-[244px]"
					>
						<img
							src="/find.png"
							alt="Звонок найден"
							class="relative z-10 mx-auto h-auto w-[244px] object-contain"
						>

						<div
							ref="fireworksLayer"
							aria-hidden="true"
							class="pointer-events-none absolute inset-0 z-20"
						/>
					</div>
					<p class="mt-[92px] text-center text-[22px] leading-[1.1] font-medium tracking-[-0.01em] text-black">
						Звонок найден!
						<br>
						Соединяем...
					</p>
				</template>

				<template v-else>
					<img
						src="/nofind.png"
						alt="Звонок не найден"
						class="mx-auto h-auto w-[246px] object-contain"
					>
					<p class="mt-[86px] text-center text-[22px] leading-[1.1] font-medium tracking-[-0.01em] text-black">
						Звонок не найден :(
						<br>
						Давай попробуем позже
					</p>

					<div class="mt-[28px] flex flex-col items-center">
						<button
							type="button"
							class="h-[56px] w-full max-w-[254px] rounded-[22px] bg-[#50a9ed] text-[16px] leading-none font-medium tracking-[-0.01em] text-[#f4f4f5] transition hover:brightness-105"
							:disabled="isBusy"
							@click="startSearch"
						>
							Попробовать снова
						</button>

						<NuxtLink
							to="/home"
							class="mt-[14px] flex h-[50px] w-full max-w-[190px] items-center justify-center rounded-[22px] bg-black text-[14px] leading-none font-medium tracking-[-0.01em] text-[#f4f4f5] transition hover:brightness-110"
						>
							Главный экран
						</NuxtLink>
					</div>
				</template>
			</article>
		</section>
	</main>
</template>

<script setup lang="ts">
import { gsap } from "gsap";

const SEARCH_TOTAL_SECONDS = 39;
const SEARCH_TIMEOUT_MS = SEARCH_TOTAL_SECONDS * 1000;
const RETRY_INTERVAL_MS = 1500;

type SearchState = "searching" | "found" | "not_found";

const call = useCallMatching();
const route = useRoute();
const auth = useStrapiAuth();

const screenState = ref<SearchState>("searching");
const isBusy = ref(false);
const searchRunId = ref(0);
const searchSecondsPassed = ref(0);
const fireworksLayer = ref<HTMLElement | null>(null);
const foundPhoneVisual = ref<HTMLElement | null>(null);

let countdownTimer: ReturnType<typeof setInterval> | null = null;
let countdownStartedAtMs = 0;
let fireworksTimer: ReturnType<typeof setInterval> | null = null;

const initialAssistantMessage = `Пока ищем собеседника, можно немного подготовиться:
подумай, о чем хочешь поговорить в первую очередь.

Если хочешь, просто дождись соединения - я рядом и подскажу.`;

const formattedSearchTime = computed(() => {
	return `0:${String(Math.max(0, searchSecondsPassed.value)).padStart(2, "0")}`;
});

function clearCountdownTimer(): void {
	if (!countdownTimer) {
		return;
	}

	clearInterval(countdownTimer);
	countdownTimer = null;
}

function startCountdown(): void {
	clearCountdownTimer();
	countdownStartedAtMs = Date.now();
	searchSecondsPassed.value = 0;

	countdownTimer = setInterval(() => {
		const elapsedSeconds = Math.floor((Date.now() - countdownStartedAtMs) / 1000);
		searchSecondsPassed.value = Math.min(SEARCH_TOTAL_SECONDS, Math.max(0, elapsedSeconds));
		if (searchSecondsPassed.value >= SEARCH_TOTAL_SECONDS) {
			clearCountdownTimer();
		}
	}, 250);
}

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function randomBetween(min: number, max: number): number {
	return min + Math.random() * (max - min);
}

function clearFireworksLayer(): void {
	const layer = fireworksLayer.value;
	if (!layer) {
		return;
	}

	const children = Array.from(layer.children);
	if (children.length) {
		gsap.killTweensOf(children);
	}
	layer.replaceChildren();
}

function stopFoundFireworks(): void {
	if (fireworksTimer) {
		clearInterval(fireworksTimer);
		fireworksTimer = null;
	}

	clearFireworksLayer();
}

function createFireworkBurst(): void {
	const layer = fireworksLayer.value;
	const visual = foundPhoneVisual.value;
	if (!layer || !visual) {
		return;
	}

	const width = visual.clientWidth || 0;
	const height = visual.clientHeight || 0;
	if (!width || !height) {
		return;
	}

	const centerX = width / 2 + randomBetween(-18, 18);
	const centerY = height / 2 + randomBetween(-12, 12);
	const colors = ["#ffffff", "#9ed0ff", "#73bfff", "#ffd166", "#ff8fab"];
	const particlesCount = 18;

	for (let index = 0; index < particlesCount; index += 1) {
		const particle = document.createElement("span");
		const size = randomBetween(4, 9);
		const angle = (Math.PI * 2 * index) / particlesCount + randomBetween(-0.2, 0.2);
		const distance = randomBetween(52, 116);
		const x = Math.cos(angle) * distance;
		const y = Math.sin(angle) * distance;
		const color = colors[Math.floor(Math.random() * colors.length)] || "#ffffff";

		particle.className = "absolute rounded-full";
		particle.style.left = `${centerX}px`;
		particle.style.top = `${centerY}px`;
		particle.style.width = `${size}px`;
		particle.style.height = `${size}px`;
		particle.style.background = color;
		particle.style.boxShadow = `0 0 12px ${color}`;
		particle.style.transform = "translate(-50%, -50%)";

		layer.appendChild(particle);

		gsap.fromTo(
			particle,
			{
				x: 0,
				y: 0,
				scale: 0.25,
				opacity: 1
			},
			{
				x,
				y: y - randomBetween(8, 24),
				scale: randomBetween(0.75, 1.25),
				opacity: 0,
				duration: randomBetween(0.75, 1.1),
				ease: "power2.out",
				onComplete: () => {
					particle.remove();
				}
			}
		);
	}

	const ring = document.createElement("span");
	ring.className = "absolute rounded-full border border-white/80";
	ring.style.left = `${centerX}px`;
	ring.style.top = `${centerY}px`;
	ring.style.width = "12px";
	ring.style.height = "12px";
	ring.style.transform = "translate(-50%, -50%)";
	layer.appendChild(ring);

	gsap.fromTo(
		ring,
		{
			scale: 0.25,
			opacity: 0.9
		},
		{
			scale: 4.6,
			opacity: 0,
			duration: 0.8,
			ease: "power2.out",
			onComplete: () => {
				ring.remove();
			}
		}
	);
}

async function startFoundFireworks(): Promise<void> {
	stopFoundFireworks();
	await nextTick();
	createFireworkBurst();
	fireworksTimer = setInterval(() => {
		createFireworkBurst();
	}, 520);
}

function buildVolunteerMatchMeta(): { volunteerProfileId: number | null, volunteerProfileDocumentId: string, volunteerName: string } {
	const isVolunteerProfile = auth.profileCollection.value === "volunteer-profiles";
	const profileId = Number(auth.profile.value?.id || 0);
	const volunteerProfileId = isVolunteerProfile && Number.isFinite(profileId) && profileId > 0
		? Math.floor(profileId)
		: null;
	const volunteerProfileDocumentId = isVolunteerProfile
		? String(auth.profile.value?.documentId || "").trim()
		: "";
	const volunteerName = String(
		auth.profile.value?.firstName
		|| auth.onboardingName.value
		|| ""
	).trim();

	return {
		volunteerProfileId,
		volunteerProfileDocumentId,
		volunteerName
	};
}

async function ensureVolunteerMeta(): Promise<void> {
	if (auth.profile.value) {
		return;
	}

	try {
		await auth.restoreSession();
	} catch {
		// noop
	}

	if (!auth.user.value || auth.profile.value) {
		return;
	}

	try {
		await auth.refreshDashboard();
	} catch {
		// noop
	}
}

async function startSearch(): Promise<void> {
	if (isBusy.value) {
		return;
	}

	const runId = searchRunId.value + 1;
	searchRunId.value = runId;
	isBusy.value = true;
	screenState.value = "searching";
	startCountdown();
	await ensureVolunteerMeta();

	const startedAt = Date.now();
	try {
		while (runId === searchRunId.value && Date.now() - startedAt < SEARCH_TIMEOUT_MS) {
			let result: Awaited<ReturnType<typeof call.claimHelpRequest>> | null = null;
			try {
				result = await call.claimHelpRequest(buildVolunteerMatchMeta());
			} catch {
				await sleep(RETRY_INTERVAL_MS);
				continue;
			}

			if (result.found && result.sessionId) {
				screenState.value = "found";
				clearCountdownTimer();
				await sleep(900);

				if (runId !== searchRunId.value) {
					return;
				}

				const targetPath = "/call/session";
				const targetQuery: Record<string, string> = {
					session: result.sessionId,
					name: String(result.blindName || "").trim()
				};
				const blindInterests = String(result.blindInterests || "").replace(/\s+/g, " ").trim();
				if (blindInterests) {
					targetQuery.interests = blindInterests;
				}

				try {
					await navigateTo({
						path: targetPath,
						query: targetQuery
					});
				} catch {
					if (import.meta.client) {
						const params = new URLSearchParams(targetQuery).toString();
						window.location.assign(`${targetPath}?${params}`);
					}
				}

				if (import.meta.client && route.path === "/call") {
					const params = new URLSearchParams(targetQuery).toString();
					window.location.assign(`${targetPath}?${params}`);
				}
				return;
			}

			await sleep(RETRY_INTERVAL_MS);
		}

		if (runId === searchRunId.value) {
			screenState.value = "not_found";
		}
	} finally {
		if (runId === searchRunId.value) {
			clearCountdownTimer();
			isBusy.value = false;
		}
	}
}

onMounted(() => {
	void startSearch();
});

watch(
	() => screenState.value,
	(state) => {
		if (state === "found") {
			void startFoundFireworks();
			return;
		}

		stopFoundFireworks();
	}
);

onBeforeUnmount(() => {
	searchRunId.value += 1;
	clearCountdownTimer();
	stopFoundFireworks();
});
</script>

