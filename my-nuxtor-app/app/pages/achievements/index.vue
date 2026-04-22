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

			<h1 class="mt-3 text-[50px] leading-none font-medium tracking-[-0.03em] text-black">
				Все достижения
			</h1>

			<p
				v-if="errorMessage"
				class="mt-4 rounded-2xl bg-[#fee2e2] px-4 py-2 text-sm text-[#991b1b]"
			>
				{{ errorMessage }}
			</p>

			<div
				v-if="cards.length"
				class="mt-12 grid grid-cols-2 gap-3"
			>
				<button
					v-for="(item, index) in cards"
					:key="item.id"
					type="button"
					class="rounded-[22px] bg-[#ececef] px-4 pb-3 pt-3 text-center transition active:scale-[0.99]"
					:class="index % 3 === 2 ? 'col-span-2 min-h-[168px]' : 'min-h-[176px]'"
					@click="openAchievement(item.id)"
				>
					<p
						class="line-clamp-2 text-[15px] leading-[1.1] font-medium text-black"
						:class="index % 3 === 2 ? 'mx-auto max-w-[220px]' : 'mx-auto max-w-[180px]'"
					>
						{{ item.title }}
					</p>
					<p class="mt-1.5 text-[10px] leading-none font-medium text-black/38">
						{{ item.receivedLabel }}
					</p>
					<div class="mt-2.5 flex items-center justify-center">
						<img
							v-if="item.iconUrl"
							:src="item.iconUrl"
							:alt="item.title"
							class="h-[70px] w-[70px] rounded-full object-cover"
							:class="item.isReceived ? '' : 'opacity-55 blur-[1.5px]'"
						>
						<div
							v-else
							class="flex h-[70px] w-[70px] items-center justify-center rounded-full bg-[#d9e7f4] text-[22px] font-semibold text-[#4f8fbe]"
							:class="item.isReceived ? '' : 'opacity-55 blur-[1.5px]'"
						>
							{{ item.badge }}
						</div>
					</div>
				</button>
			</div>

			<article
				v-else-if="!loading"
				class="mt-12 rounded-[22px] bg-[#ececef] px-5 py-8 text-center text-[15px] text-black/55"
			>
				Пока нет достижений
			</article>
		</section>
	</main>
</template>

<script setup lang="ts">
const auth = useStrapiAuth();

const loading = ref(true);
const errorMessage = ref("");

interface AchievementCard {
	id: number
	title: string
	receivedLabel: string
	isReceived: boolean
	iconUrl: string | null
	badge: string
}

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

onMounted(async () => {
	await refresh();
});

async function refresh(): Promise<void> {
	loading.value = true;
	errorMessage.value = "";

	try {
		await auth.restoreSession();
		await auth.refreshDashboard();
	} catch (error) {
		errorMessage.value = auth.normalizeError(error);
	} finally {
		loading.value = false;
	}
}

function goBack(): void {
	void navigateTo("/stats");
}

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
