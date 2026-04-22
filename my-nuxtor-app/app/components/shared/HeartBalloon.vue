<template>
	<svg
		:viewBox="viewBox"
		class="h-auto w-full"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			d="M170 70 C150 35 95 35 70 80 C45 123 53 185 96 225 C126 252 149 267 170 290 C191 267 214 252 244 225 C287 185 295 123 270 80 C245 35 190 35 170 70 Z"
			:stroke="strokeColor"
			stroke-width="7"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
		<path
			v-if="longTail"
			d="M170 290 C170 340 168 365 182 385 C208 422 197 458 171 488 C139 525 149 571 182 604 C196 619 198 642 192 660"
			:stroke="strokeColor"
			stroke-width="7"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
		<path
			v-else
			d="M170 290 C170 316 168 327 174 340"
			:stroke="strokeColor"
			stroke-width="7"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>
</template>

<script setup lang="ts">
	const props = withDefaults(defineProps<{
		longTail?: boolean
		stroke?: string
	}>(), {
		longTail: false,
		stroke: "#9BC5E6"
	});

	const longTail = computed(() => props.longTail);
	const strokeColor = computed(() => props.stroke);
	const viewBox = computed(() => (longTail.value ? "0 0 340 680" : "0 0 340 360"));
</script>
