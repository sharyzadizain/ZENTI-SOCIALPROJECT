<template>
	<main class="min-h-dvh bg-gradient-to-b from-[#b8cee0] to-[#f4f4f5]">
		<section class="mx-auto w-full max-w-[430px] px-7 pb-14 pt-12">
			<button
				type="button"
				class="text-[15px] font-medium text-black/80"
				@click="goBack"
			>
				↩ Вернуться назад
			</button>

			<p
				v-if="errorMessage"
				class="mt-4 rounded-2xl bg-[#fee2e2] px-4 py-2 text-sm text-[#991b1b]"
			>
				{{ errorMessage }}
			</p>

			<article
				v-if="achievement"
				class="pt-4"
			>
				<h1 class="text-center text-[50px] leading-[0.92] font-medium tracking-[-0.03em] text-black">
					{{ achievement.title }}
				</h1>
				<p class="mt-4 text-center text-[20px] leading-none font-medium text-black/45">
					{{ receivedLabel }}
				</p>

				<div class="mt-8 flex items-center justify-center">
					<img
						v-if="achievement.iconUrl"
						:src="achievement.iconUrl"
						:alt="achievement.title"
						class="h-[260px] w-[260px] object-contain"
						:class="achievement.isReceived ? '' : 'opacity-55 blur-[3px]'"
					>
					<div
						v-else
						class="flex h-[220px] w-[220px] items-center justify-center rounded-full bg-[#d9e7f4] text-[56px] font-semibold text-[#4f8fbe]"
						:class="achievement.isReceived ? '' : 'opacity-55 blur-[3px]'"
					>
						{{ badgeText }}
					</div>
				</div>

				<section
					v-if="!achievement.isReceived"
					class="mt-8 rounded-[22px] bg-[#ececef] px-5 py-4"
				>
					<h2 class="text-[20px] leading-none font-medium text-black">
						Прогресс
					</h2>
					<div class="mt-4 h-2.5 rounded-full bg-[#bcd6ea]">
						<div
							class="h-2.5 rounded-full bg-[#4f8fea] transition-all"
							:style="{ width: `${progressPercent}%` }"
						/>
					</div>
					<div class="mt-2 flex items-center justify-between text-[15px] leading-none font-medium text-black">
						<p>{{ progressLeft }}</p>
						<p>{{ progressRight }}</p>
					</div>
				</section>

				<section class="mt-8 text-center">
					<h2 class="text-[20px] leading-none font-medium text-black">
						Описание
					</h2>
					<p class="mx-auto mt-4 max-w-[320px] text-[20px] leading-[1.15] font-medium tracking-[-0.01em] text-black">
						{{ descriptionText }}
					</p>
				</section>
			</article>

			<article
				v-else-if="!loading"
				class="mt-10 rounded-[22px] bg-[#ececef] px-5 py-8 text-center text-base text-black/55"
			>
				Достижение не найдено
			</article>
		</section>
	</main>
</template>

<script setup lang="ts">
const route = useRoute();
const auth = useStrapiAuth();

const loading = ref(true);
const errorMessage = ref("");
const achievement = ref<ReturnType<typeof useStrapiAuth>["achievements"]["value"][number] | null>(null);

const receivedLabel = computed(() => {
	if (!achievement.value) {
		return "";
	}

	if (!achievement.value.isReceived) {
		return "Не Получено";
	}

	if (!achievement.value.receivedAt) {
		return "Получено";
	}

	return `Получено ${formatDate(achievement.value.receivedAt)}`;
});

const progressPercent = computed(() => {
	if (!achievement.value) {
		return 0;
	}

	const target = Math.max(1, achievement.value.progressTarget);
	const current = Math.max(0, achievement.value.progressCurrent);
	return Math.min(100, Math.round((current / target) * 100));
});

const progressLeft = computed(() => {
	if (!achievement.value) {
		return "0";
	}

	return `${achievement.value.progressCurrent} ${achievement.value.progressUnit}`;
});

const progressRight = computed(() => {
	if (!achievement.value) {
		return "0";
	}

	return `${achievement.value.progressTarget} ${achievement.value.progressUnit}`;
});

const badgeText = computed(() => {
	if (!achievement.value) {
		return "OK";
	}

	const words = achievement.value.title.trim().split(/\s+/).filter(Boolean).slice(0, 2);
	if (!words.length) {
		return "OK";
	}

	return words.map(word => word[0]?.toUpperCase() || "").join("").slice(0, 2);
});

const descriptionText = computed(() => {
	return achievement.value?.description?.trim() || "";
});

watch(
	() => route.params.id,
	() => {
		void refresh();
	},
	{ immediate: true }
);

async function refresh(): Promise<void> {
	loading.value = true;
	errorMessage.value = "";
	achievement.value = null;

	const achievementId = Number(route.params.id);
	if (!Number.isFinite(achievementId) || achievementId <= 0) {
		loading.value = false;
		return;
	}

	try {
		await auth.restoreSession();
		await auth.refreshDashboard();

		achievement.value = auth.achievements.value.find(item => item.id === achievementId) || null;
		if (!achievement.value) {
			achievement.value = await auth.loadAchievementById(achievementId);
		}
	} catch (error) {
		errorMessage.value = auth.normalizeError(error);
	} finally {
		loading.value = false;
	}
}

function goBack(): void {
	void navigateTo("/achievements");
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
