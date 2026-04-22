<template>
	<main class="min-h-dvh bg-[#f4f4f5]">
		<section class="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-7 pb-10 pt-14">
			<header>
				<h1 class="text-[50px] leading-[0.95] font-medium tracking-[-0.03em] text-black">
					Вход через Яндекс
				</h1>
				<p class="mt-2 text-[20px] leading-[1.1] font-medium text-black/60">
					Email/пароль отключены для волонтерского приложения.
				</p>
			</header>

			<div class="mt-auto">
				<button
					type="button"
					class="flex w-full items-center justify-center rounded-[20px] bg-[#e8e8ea] py-4 text-[20px] leading-none font-medium tracking-[-0.01em] text-black"
					@click="startYandexLogin"
				>
					Войти через Яндекс
				</button>
			</div>
		</section>
	</main>
</template>

<script setup lang="ts">
function startYandexLogin(): void {
	window.location.href = "/api/auth/yandex?mode=volunteer";
}
</script>
