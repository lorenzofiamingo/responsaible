<script lang="ts">
	// Lucide icons inlined from lucide-static via Vite `?raw` — no runtime/build dep,
	// just SVG strings bundled at build. Itaily house set: 2px rounded stroke.
	import arrowRight from '$lib/icons/arrow-right.svg?raw';
	import arrowUpRight from '$lib/icons/arrow-up-right.svg?raw';
	import ban from '$lib/icons/ban.svg?raw';
	import bookOpen from '$lib/icons/book-open.svg?raw';
	import brain from '$lib/icons/brain.svg?raw';
	import calendarClock from '$lib/icons/calendar-clock.svg?raw';
	import check from '$lib/icons/check.svg?raw';
	import chevronDown from '$lib/icons/chevron-down.svg?raw';
	import chevronRight from '$lib/icons/chevron-right.svg?raw';
	import circleAlert from '$lib/icons/circle-alert.svg?raw';
	import circleArrowUp from '$lib/icons/circle-arrow-up.svg?raw';
	import circleCheck from '$lib/icons/circle-check.svg?raw';
	import circleX from '$lib/icons/circle-x.svg?raw';
	import clock from '$lib/icons/clock.svg?raw';
	import externalLink from '$lib/icons/external-link.svg?raw';
	import fileSearch from '$lib/icons/file-search.svg?raw';
	import fileText from '$lib/icons/file-text.svg?raw';
	import folder from '$lib/icons/folder.svg?raw';
	import folderOpen from '$lib/icons/folder-open.svg?raw';
	import gavel from '$lib/icons/gavel.svg?raw';
	import gitBranch from '$lib/icons/git-branch.svg?raw';
	import gitFork from '$lib/icons/git-fork.svg?raw';
	import history from '$lib/icons/history.svg?raw';
	import listChecks from '$lib/icons/list-checks.svg?raw';
	import lock from '$lib/icons/lock.svg?raw';
	import mapPin from '$lib/icons/map-pin.svg?raw';
	import pencil from '$lib/icons/pencil.svg?raw';
	import quote from '$lib/icons/quote.svg?raw';
	import rotateCcw from '$lib/icons/rotate-ccw.svg?raw';
	import scale from '$lib/icons/scale.svg?raw';
	import search from '$lib/icons/search.svg?raw';
	import shield from '$lib/icons/shield.svg?raw';
	import shieldAlert from '$lib/icons/shield-alert.svg?raw';
	import shieldCheck from '$lib/icons/shield-check.svg?raw';
	import sparkles from '$lib/icons/sparkles.svg?raw';
	import trash2 from '$lib/icons/trash-2.svg?raw';
	import triangleAlert from '$lib/icons/triangle-alert.svg?raw';
	import xIcon from '$lib/icons/x.svg?raw';

	const RAW: Record<string, string> = {
		'arrow-right': arrowRight,
		'arrow-up-right': arrowUpRight,
		ban,
		'book-open': bookOpen,
		brain,
		'calendar-clock': calendarClock,
		check,
		'chevron-down': chevronDown,
		'chevron-right': chevronRight,
		'circle-alert': circleAlert,
		'circle-arrow-up': circleArrowUp,
		'circle-check': circleCheck,
		'circle-x': circleX,
		clock,
		'external-link': externalLink,
		'file-search': fileSearch,
		'file-text': fileText,
		folder,
		'folder-open': folderOpen,
		gavel,
		'git-branch': gitBranch,
		'git-fork': gitFork,
		history,
		'list-checks': listChecks,
		lock,
		'map-pin': mapPin,
		pencil,
		quote,
		'rotate-ccw': rotateCcw,
		scale,
		search,
		shield,
		'shield-alert': shieldAlert,
		'shield-check': shieldCheck,
		sparkles,
		'trash-2': trash2,
		'triangle-alert': triangleAlert,
		x: xIcon
	};

	let {
		name,
		size = 16,
		color = 'currentColor',
		strokeWidth = 2,
		class: klass = ''
	}: { name: string; size?: number; color?: string; strokeWidth?: number; class?: string } =
		$props();

	const svg = $derived(
		(RAW[name] ?? RAW['circle-alert'])
			.replace(/<!--[\s\S]*?-->/, '')
			.replace('width="24"', `width="${size}"`)
			.replace('height="24"', `height="${size}"`)
			.replace('stroke-width="2"', `stroke-width="${strokeWidth}"`)
	);
</script>

<span class="ic {klass}" style="color:{color}">{@html svg}</span>

<style>
	.ic {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		line-height: 0;
		flex: none;
	}
</style>
