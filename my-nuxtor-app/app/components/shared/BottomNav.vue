<template>
	<nav class="fixed inset-x-0 bottom-0 z-40 flex justify-center px-5 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-2">
		<div class="flex w-full max-w-[390px] items-center gap-1 rounded-full bg-[#ececed]/95 p-1.5 shadow-[0_12px_34px_rgba(15,23,42,0.12)] backdrop-blur">
			<NuxtLink
				v-for="item in items"
				:key="item.key"
				:to="item.to"
				class="flex min-h-[62px] flex-1 flex-col items-center justify-center rounded-full px-2 py-2 text-[11px] font-semibold transition"
				:class="active === item.key ? 'bg-[#d7d8db] text-[#1170f4]' : 'text-black'"
			>
				<span class="text-[22px] leading-none">{{ item.icon }}</span>
				<span class="mt-1 leading-none">{{ item.label }}</span>
			</NuxtLink>
		</div>
	</nav>
</template>

<script setup lang="ts">
type TabKey = "home" | "stats" | "profile";

interface NavItem {
	key: TabKey
	label: string
	to: string
	icon: string
}

const props = defineProps<{
	active: TabKey
}>();

const active = computed(() => props.active);

const items: NavItem[] = [
	{ key: "home", label: "Дом", to: "/home", icon: "🏠" },
	{ key: "stats", label: "Статистика", to: "/stats", icon: "📊" },
	{ key: "profile", label: "Профиль", to: "/profile", icon: "👥" }
];
</script>
