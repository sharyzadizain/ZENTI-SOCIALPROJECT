<template>
	<header class="mx-auto flex w-full max-w-[390px] items-center justify-between px-6 pt-4">
		<p class="text-[16px] leading-none font-semibold tracking-[0.01em]">9:41</p>
		<div class="flex items-center gap-2">
			<div class="flex items-end gap-[2px]">
				<span class="h-[4px] w-[2px] rounded bg-black" />
				<span class="h-[6px] w-[2px] rounded bg-black" />
				<span class="h-[8px] w-[2px] rounded bg-black" />
				<span class="h-[10px] w-[2px] rounded bg-black" />
			</div>

			<svg
				class="h-3.5 w-4"
				viewBox="0 0 18 14"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path d="M1 5.5C3.8 2.5 6.5 1 9 1C11.5 1 14.2 2.5 17 5.5" stroke="#000" stroke-width="1.4" stroke-linecap="round" />
				<path d="M4 8.5C5.9 6.6 7.5 5.8 9 5.8C10.5 5.8 12.1 6.6 14 8.5" stroke="#000" stroke-width="1.4" stroke-linecap="round" />
				<circle cx="9" cy="11.3" r="1.2" fill="#000" />
			</svg>

			<div class="flex items-center gap-[2px]">
				<div class="h-3.5 w-6 rounded-[4px] border border-black p-[1px]">
					<div class="h-full w-[72%] rounded-[2px] bg-black" />
				</div>
				<span class="h-1.5 w-[2px] rounded-full bg-black/80" />
			</div>
		</div>
	</header>
</template>
