<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status} - FormZero</title>
</svelte:head>

<main class="container mx-auto p-4 pt-16">
	<h1>{page.status === 404 ? '404' : 'Error'}</h1>
	<p>{page.status === 404 ? 'The requested page could not be found.' : page.error?.message || 'An unexpected error occurred.'}</p>
</main>
