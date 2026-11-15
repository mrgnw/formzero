import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-cloudflare';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
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
