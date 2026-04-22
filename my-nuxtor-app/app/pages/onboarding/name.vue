<template>
	<main class="min-h-dvh bg-[#f4f4f5]">
		<section class="mx-auto w-full max-w-[430px] px-7 pb-10 pt-14">
			<header class="text-center">
				<p class="text-[25px] leading-none font-medium tracking-[-0.02em] text-black/45">
					Ты в шаге от
				</p>
				<h1 class="mt-1 text-[50px] leading-[0.94] font-medium tracking-[-0.03em] text-black">
					Добрых дел
				</h1>
			</header>

			<article class="mt-6 rounded-[30px] bg-[#ececef] px-6 pb-6 pt-7">
				<p class="text-[25px] leading-[1.03] font-medium tracking-[-0.02em] text-black">
					Пригласи друга - и пусть
					<br>
					добрых дел будет
					<span class="underline decoration-[#9bc5e6] decoration-[3px] underline-offset-[5px]">вдвое</span>
					<br>
					больше
				</p>

				<button
					type="button"
					class="mt-28 w-full rounded-[20px] bg-[#9bc5e6] py-4 text-[20px] leading-none font-medium tracking-[-0.01em] text-white"
					@click="copyInviteLink"
				>
					Отправить ссылку
				</button>
				<p
					v-if="copyMessage"
					class="mt-3 text-center text-xs text-[#0f766e]"
				>
					{{ copyMessage }}
				</p>
			</article>

			<NuxtLink
				to="/onboarding/gosuslugi"
				class="mt-6 flex w-full items-center justify-center rounded-[20px] bg-[#e8e8ea] py-4 text-[20px] leading-none font-medium tracking-[-0.01em] text-black"
			>
				Войти через Госуслуги
			</NuxtLink>

			<NuxtLink
				to="/onboarding/gosuslugi"
				class="mt-5 block text-center text-[15px] leading-none font-medium text-black"
			>
				Регистрация
			</NuxtLink>
		</section>
	</main>
</template>

<script setup lang="ts">
const copyMessage = ref("");

async function copyInviteLink(): Promise<void> {
	const inviteUrl = `${window.location.origin}/invite/volunteer`;

	try {
		await navigator.clipboard.writeText(inviteUrl);
		copyMessage.value = "Ссылка скопирована.";
	} catch {
		copyMessage.value = `Скопируй вручную: ${inviteUrl}`;
	}

	setTimeout(() => {
		copyMessage.value = "";
	}, 3000);
}
</script>
