// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface Platform {}
	}
}

export {}; 

// Svelte action typing for our custom markdown action
declare namespace svelteHTML {
  interface HTMLAttributes<T> {
    'use:renderMarkdown'?: string;
  }
}

// Module declarations to satisfy TypeScript for runtime-only imports
declare module 'marked';
declare module 'dompurify';