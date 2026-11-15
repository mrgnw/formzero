<script lang="ts">
	import CopyButton from '#lib/components/CopyButton.svelte';
	import { tokenClass, tokenize, type Language, type TokenStream } from '#lib/highlight.js';

	let { code, language, label }: { code: string; language: Language; label: string } = $props();

	const tokens = $derived(tokenize(code, language));
</script>

{#snippet render(stream: TokenStream)}{#if typeof stream === 'string'}{stream}{:else if Array.isArray(stream)}{#each stream as token, index (index)}{@render render(token)}{/each}{:else}<span class={tokenClass(stream)}>{@render render(stream.content)}</span>{/if}{/snippet}

<div class="relative">
	<CopyButton
		text={code}
		{label}
		variant="ghost"
		size="sm"
		class="absolute top-2 right-2 z-10 h-7 px-2 text-xs text-[#d4d4d4] hover:bg-white/10 hover:text-white [&_svg]:size-3"
	/>
	<pre data-language={language}><code>{@render render(tokens)}</code></pre>
</div>

<style>
	pre {
		color-scheme: dark;
		margin: 0;
		border-radius: 0.375rem;
		padding: 0.75rem;
		overflow-x: auto;
		background: #1e1e1e;
		color: #9cdcfe;
		font-size: 0.75rem;
	}

	pre :global {
		.token.prolog {
			color: rgb(0, 0, 128);
		}
		.token.comment {
			color: rgb(106, 153, 85);
		}
		.token.builtin,
		.token.changed,
		.token.keyword,
		.token.interpolation-punctuation {
			color: rgb(86, 156, 214);
		}
		.token.number,
		.token.inserted {
			color: rgb(181, 206, 168);
		}
		.token.constant {
			color: rgb(100, 102, 149);
		}
		.token.attr-name,
		.token.variable {
			color: rgb(156, 220, 254);
		}
		.token.deleted,
		.token.string,
		.token.attr-value,
		.token.template-punctuation {
			color: rgb(206, 145, 120);
		}
		.token.selector {
			color: rgb(215, 186, 125);
		}
		.token.tag,
		.token.class-name {
			color: rgb(78, 201, 176);
		}
		.token.punctuation,
		.token.operator {
			color: rgb(212, 212, 212);
		}
		.token.function {
			color: rgb(220, 220, 170);
		}
		.token.char {
			color: rgb(209, 105, 105);
		}
	}

	pre[data-language="markup"] :global {
		.token.tag {
			color: rgb(86, 156, 214);
		}
		.token.punctuation {
			color: #808080;
		}
	}
</style>
