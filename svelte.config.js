import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		alias: {
			$domain: 'src/lib/domain',
			$server: 'src/lib/server',
			$components: 'src/lib/components',
			$client: 'src/lib/client'
		}
	},
	compilerOptions: {
		runes: true
	}
};

export default config;
