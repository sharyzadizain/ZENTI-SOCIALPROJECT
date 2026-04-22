<template>
	<main class="min-h-dvh bg-[#f4f4f5] text-black">
		<section class="mx-auto min-h-dvh w-full max-w-[390px] px-4 pb-12">
			<IosStatusBar />

			<header class="mt-[42px] text-center">
				<h1 class="text-[34px] leading-[0.95] font-medium tracking-[-0.03em]">
					{{ volunteerName }}, спасибо!
				</h1>
				<p class="mt-2 text-[17px] leading-none font-medium tracking-[-0.01em] text-black/36">
					Звонок продлился {{ callDurationLabel }}
				</p>
			</header>

			<section
				v-if="hasAchievement"
				class="mx-auto mt-[40px] w-full max-w-[334px] rounded-[22px] bg-[#ececef] px-6 pb-8 pt-7"
			>
				<p class="text-center text-[14px] leading-none font-medium tracking-[-0.01em] text-black">
					Получено новое достижение!
				</p>

				<img
					v-if="achievementIconSrc"
					:src="achievementIconSrc"
					alt=""
					aria-hidden="true"
					class="mx-auto mt-8 h-auto w-[160px] object-contain"
				>

				<p class="mt-7 text-center text-[16px] leading-none font-medium tracking-[-0.01em] text-black">
					{{ displayAchievementTitle }}
				</p>
				<p class="mt-2 text-center text-[12px] leading-none font-medium tracking-[-0.01em] text-black/32">
					Такое есть у 5% пользователей
				</p>
			</section>

			<section
				v-else
				class="mx-auto mt-[54px] w-full max-w-[310px]"
			>
				<img
					src="/heart2.png"
					alt=""
					aria-hidden="true"
					class="mx-auto h-auto w-[270px] object-contain"
				>
				<p class="mt-[24px] text-center text-[16px] leading-none font-medium tracking-[-0.01em] text-[#1f9bff]">
					Еще одно сердце было согрето!
				</p>
			</section>

			<NuxtLink
				to="/home"
				class="mx-auto mt-[104px] flex h-[56px] w-full max-w-[220px] items-center justify-center rounded-[19px] bg-[#ececef] text-[17px] leading-none font-medium tracking-[-0.01em] text-black"
				:class="hasAchievement ? 'mt-[122px]' : 'mt-[110px]'"
			>
				Продолжить
			</NuxtLink>
		</section>
	</main>
</template>

<script setup lang="ts">
const route = useRoute();
const auth = useStrapiAuth();

function queryToString(value: string | string[] | undefined): string {
	if (Array.isArray(value)) {
		return String(value[0] || "").trim();
	}

	return String(value || "").trim();
}

function toPositiveInteger(value: string, fallback: number): number {
	const parsed = Math.round(Number(value));
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return fallback;
	}
	return parsed;
}

function formatMinutes(value: number): string {
	const minutes = Math.max(1, Math.round(value));
	const lastTwo = minutes % 100;
	const last = minutes % 10;

	if (lastTwo >= 11 && lastTwo <= 14) {
		return `${minutes} минут`;
	}

	if (last === 1) {
		return `${minutes} минуту`;
	}

	if (last >= 2 && last <= 4) {
		return `${minutes} минуты`;
	}

	return `${minutes} минут`;
}

const hasAchievement = computed(() => queryToString(route.query.achievement as string | string[] | undefined) === "1");
const achievementTitleFromQuery = computed(() => queryToString(route.query.title as string | string[] | undefined));
const achievementIconFromQuery = computed(() => queryToString(route.query.icon as string | string[] | undefined));
const volunteerNameFromQuery = computed(() => queryToString(route.query.name as string | string[] | undefined));
const callDurationMinutes = computed(() => toPositiveInteger(
	queryToString(route.query.minutes as string | string[] | undefined),
	5
));
const callDurationLabel = computed(() => formatMinutes(callDurationMinutes.value));

const volunteerName = computed(() => {
	const explicitName = volunteerNameFromQuery.value;
	if (explicitName) {
		return explicitName;
	}

	const profileFirstName = String(auth.profile.value?.firstName || "").trim();
	if (profileFirstName) {
		return profileFirstName;
	}

	return "Катя";
});

const matchingAchievement = computed(() => {
	if (!hasAchievement.value) {
		return null;
	}

	const titleKey = achievementTitleFromQuery.value.toLowerCase();
	if (titleKey) {
		return auth.achievements.value.find(item => item.title.trim().toLowerCase() === titleKey) || null;
	}

	return auth.achievements.value.find(item => item.isReceived) || null;
});

const displayAchievementTitle = computed(() => {
	return achievementTitleFromQuery.value || matchingAchievement.value?.title || "Всегда рядом";
});

const achievementIconSrc = computed(() => {
	return achievementIconFromQuery.value || String(matchingAchievement.value?.iconUrl || "").trim();
});
</script>
