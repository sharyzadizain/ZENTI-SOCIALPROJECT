<template>
	<main class="min-h-dvh bg-[#f4f4f5]">
		<section class="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-[430px] flex-col px-6 pt-[168px]">
			<button
				type="button"
				class="h-[280px] w-full rounded-[24px] bg-[#3f75df] text-[62px] leading-[0.92] font-semibold tracking-[-0.03em] text-[#f4f4f5] transition active:scale-[0.99]"
				@click="startYandexLogin"
			>
				ВХОД
				<br>
				ЧЕРЕЗ
				<br>
				YANDEX
			</button>

			<p class="mt-5 text-center text-[16px] leading-tight font-medium text-black/70">
				Нажми большую кнопку для входа через Yandex.
			</p>
		</section>
	</main>
</template>

<script setup lang="ts">
function startYandexLogin(): void {
	window.location.href = "/api/auth/yandex?mode=blind";
}
</script>
