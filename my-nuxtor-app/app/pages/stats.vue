<template>
	<main class="min-h-dvh bg-gradient-to-b from-[#b8cee0] to-[#f4f4f5]">
		<section class="mx-auto w-full max-w-[430px] px-7 pb-28 pt-12">
			<header class="text-center">
				<h1 class="text-[50px] leading-none font-medium tracking-[-0.03em] text-black">
					Статистика
				</h1>
			</header>

			<div class="mt-8 grid grid-cols-2 gap-4">
				<article class="rounded-[24px] bg-[#ececef] px-5 py-4">
					<p class="text-[15px] leading-none font-medium text-black">
						Кол-во Подвигов
					</p>
					<p class="mt-3 text-[15px] leading-none font-medium text-[#5da9e8]">
						дальше - больше!
					</p>
					<p class="mt-2 text-[100px] leading-[0.9] font-medium tracking-[-0.04em] text-[#5da9e8]">
						{{ deedsCount }}
					</p>
				</article>

				<article class="rounded-[24px] bg-[#ececef] px-5 py-4">
					<p class="text-[15px] leading-none font-medium text-black">
						Общее Время
					</p>
					<p class="mt-3 text-[15px] leading-none font-medium text-[#5da9e8]">
						часов
					</p>
					<p class="mt-2 text-[100px] leading-[0.9] font-medium tracking-[-0.04em] text-[#5da9e8]">
						{{ totalHoursDecimal }}
					</p>
				</article>
			</div>

			<h2 class="mt-6 text-center text-[20px] leading-none font-medium tracking-[-0.02em] text-black">
				Достижения
			</h2>

			<NuxtLink
				to="/achievements"
				class="mt-4 block rounded-[18px] bg-[#ececef] px-5 py-3 text-center text-[15px] font-medium text-black"
			>
				Посмотреть все существующие достижения
			</NuxtLink>

			<p
				v-if="errorMessage"
				class="mt-4 rounded-2xl bg-[#fee2e2] px-4 py-2 text-sm text-[#991b1b]"
			>
				{{ errorMessage }}
			</p>

			<div
				v-if="cards.length"
				class="mt-4"
			>
				<div class="grid grid-cols-2 gap-4">
					<button
						v-for="item in firstRow"
						:key="item.id"
						type="button"
						class="rounded-[22px] bg-[#ececef] px-4 pb-4 pt-4 text-left transition active:scale-[0.99]"
						@click="openAchievement(item.id)"
					>
						<p class="line-clamp-2 text-[15px] leading-none font-medium text-black">
							{{ item.title }}
						</p>
						<p class="mt-2 text-[12px] leading-none font-medium text-black/45">
							{{ item.receivedLabel }}
						</p>
						<div class="mt-4 flex h-[98px] items-center justify-center">
							<img
								v-if="item.iconUrl"
								:src="item.iconUrl"
								:alt="item.title"
								class="h-[84px] w-[84px] rounded-full object-cover"
								:class="item.isReceived ? '' : 'opacity-60 blur-[1px]'"
							>
							<div
								v-else
								class="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-[#d9e7f4] text-[28px] font-semibold text-[#4f8fbe]"
								:class="item.isReceived ? '' : 'opacity-60 blur-[1px]'"
							>
								{{ item.badge }}
							</div>
						</div>
					</button>
				</div>

				<button
					v-if="featured"
					type="button"
					class="mt-4 block w-full rounded-[22px] bg-[#ececef] px-4 pb-4 pt-4 text-center transition active:scale-[0.995]"
					@click="openAchievement(featured.id)"
				>
					<p class="text-[15px] leading-none font-medium text-black">
						{{ featured.title }}
					</p>
					<p class="mt-2 text-[12px] leading-none font-medium text-black/45">
						{{ featured.receivedLabel }}
					</p>
					<div class="mt-4 flex h-[98px] items-center justify-center">
						<img
							v-if="featured.iconUrl"
							:src="featured.iconUrl"
							:alt="featured.title"
							class="h-[84px] w-[84px] rounded-full object-cover"
							:class="featured.isReceived ? '' : 'opacity-60 blur-[1px]'"
						>
						<div
							v-else
							class="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-[#d9e7f4] text-[28px] font-semibold text-[#4f8fbe]"
							:class="featured.isReceived ? '' : 'opacity-60 blur-[1px]'"
						>
							{{ featured.badge }}
						</div>
					</div>
				</button>

				<div
					v-if="rest.length"
					class="mt-4 grid grid-cols-2 gap-4"
				>
					<button
						v-for="item in rest"
						:key="item.id"
						type="button"
						class="rounded-[22px] bg-[#ececef] px-4 pb-4 pt-4 text-left transition active:scale-[0.99]"
						@click="openAchievement(item.id)"
					>
						<p class="line-clamp-2 text-[15px] leading-none font-medium text-black">
							{{ item.title }}
						</p>
						<p class="mt-2 text-[12px] leading-none font-medium text-black/45">
							{{ item.receivedLabel }}
						</p>
						<div class="mt-4 flex h-[98px] items-center justify-center">
							<img
								v-if="item.iconUrl"
								:src="item.iconUrl"
								:alt="item.title"
								class="h-[84px] w-[84px] rounded-full object-cover"
								:class="item.isReceived ? '' : 'opacity-60 blur-[1px]'"
							>
							<div
								v-else
								class="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-[#d9e7f4] text-[28px] font-semibold text-[#4f8fbe]"
								:class="item.isReceived ? '' : 'opacity-60 blur-[1px]'"
							>
								{{ item.badge }}
							</div>
						</div>
					</button>
				</div>
			</div>

			<article
				v-else
				class="mt-4 rounded-[22px] bg-[#ececef] px-5 py-8 text-center text-[15px] text-black/55"
			>
				Пока нет достижений
			</article>
		</section>

		<SharedBottomNav active="stats" />
	</main>
</template>

<script setup lang="ts">
const auth = useStrapiAuth();
const errorMessage = ref("");

interface AchievementCard {
	id: number
	title: string
	receivedLabel: string
	isReceived: boolean
	iconUrl: string | null
	badge: string
}

const deedsCount = computed(() => auth.profile.value?.deedsCount ?? 0);

const totalTalkMinutes = computed(() => {
	const rawTotal = Number(auth.profile.value?.totalHours ?? 0);
	const rawDeeds = Number(auth.profile.value?.deedsCount ?? 0);

	const safeTotal = Number.isFinite(rawTotal) ? Math.max(0, Math.round(rawTotal)) : 0;
	const safeDeeds = Number.isFinite(rawDeeds) ? Math.max(0, Math.round(rawDeeds)) : 0;

	// Legacy data stored "hours"; current logic stores minutes.
	if (safeTotal > 0 && safeTotal <= safeDeeds) {
		return safeTotal * 60;
	}

	return safeTotal;
});

const totalHoursDecimal = computed(() => {
	const hours = totalTalkMinutes.value / 60;
	return String(Math.round(hours));
});

const cards = computed<AchievementCard[]>(() => {
	return auth.achievements.value.map(item => ({
		id: item.id,
		title: item.title || "Достижение",
		receivedLabel: item.isReceived
			? (item.receivedAt ? `Получено ${formatDate(item.receivedAt)}` : "Получено")
			: "Не получено",
		isReceived: item.isReceived,
		iconUrl: item.iconUrl,
		badge: makeBadge(item.title)
	}));
});

const firstRow = computed(() => cards.value.slice(0, 2));
const featured = computed(() => cards.value[2] || null);
const rest = computed(() => cards.value.slice(3, 7));

onMounted(async () => {
	try {
		await auth.restoreSession();
		await auth.refreshDashboard();
	} catch (error) {
		errorMessage.value = auth.normalizeError(error);
	}
});

function openAchievement(id: number): void {
	void navigateTo(`/achievements/${id}`);
}

function makeBadge(title: string): string {
	const words = title.trim().split(/\s+/).filter(Boolean).slice(0, 2);
	if (!words.length) {
		return "OK";
	}

	return words.map(word => word[0]?.toUpperCase() || "").join("").slice(0, 2);
}

function formatDate(value: string): string {
	if (!value) {
		return "-";
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return new Intl.DateTimeFormat("ru-RU", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric"
	}).format(date);
}
</script>
