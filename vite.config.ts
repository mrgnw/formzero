import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-cloudflare';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			adapter: adapter(),
			csrf: { trustedOrigins: ['*'] }
		})
	],
	resolve: {
		alias: { 'virtual:react-build': fileURLToPath(new URL('./build/react/server/index.js', import.meta.url)) }
	},
	server: { port: 5473, strictPort: true }
});
