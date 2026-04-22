<template>
	<main class="min-h-dvh bg-[#f4f4f5]">
		<section class="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col items-center justify-center px-7 pb-10 pt-14 text-center">
			<div class="h-10 w-10 animate-spin rounded-full border-4 border-[#9bc5e6] border-t-transparent" />
			<h1 class="mt-5 text-[28px] leading-none font-medium tracking-[-0.02em] text-black">
				Входим через Яндекс
			</h1>
			<p
				v-if="errorMessage"
				class="mt-4 max-w-[300px] rounded-xl bg-[#fee2e2] px-4 py-2 text-sm text-[#991b1b]"
			>
				{{ errorMessage }}
			</p>
		</section>
	</main>
</template>

<script setup lang="ts">
const auth = useStrapiAuth();
const errorMessage = ref("");

onMounted(async () => {
	try {
		const restored = await auth.restoreFromYandexSession();
		if (!restored) {
			errorMessage.value = "Не удалось завершить вход. Попробуйте еще раз.";
			return;
		}

		await navigateTo(auth.profileCollection.value === "profiles" ? "/blind/home" : "/home");
	} catch (error) {
		errorMessage.value = auth.normalizeError(error);
	}
});
</script>
