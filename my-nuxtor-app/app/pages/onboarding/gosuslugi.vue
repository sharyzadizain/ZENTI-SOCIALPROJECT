<template>
	<main class="min-h-dvh bg-[#f4f4f5]">
		<section class="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-[430px] flex-col px-7 pb-10 pt-14">
			<header>
				<h1 class="text-[50px] leading-[0.95] font-medium tracking-[-0.03em] text-black">
					Хорошо, {{ displayName }}!
				</h1>
				<p class="mt-2 text-[25px] leading-none font-medium tracking-[-0.02em] text-black">
					Осталось войти через ГосУслуги
				</p>
			</header>

			<div class="mt-auto">
				<button
					type="button"
					class="flex w-full items-center justify-center rounded-[20px] bg-[#e8e8ea] py-4 text-[20px] leading-none font-medium tracking-[-0.01em] text-black"
					@click="startYandexLogin"
				>
					Подтверждение через ГосУслуги
				</button>

				<p class="mt-3 text-center text-[12px] leading-tight text-black/45">
					Продолжая вход вы соглашаетесь
					<br>
					на обработку персональных данных
				</p>
			</div>
		</section>
	</main>
</template>

<script setup lang="ts">
const auth = useStrapiAuth();

const displayName = computed(() => auth.onboardingName.value || "Катя");

function startYandexLogin(): void {
	window.location.href = "/api/auth/yandex?mode=volunteer";
}
</script>
