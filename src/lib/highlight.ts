import Prism from 'prismjs';
import 'prismjs/components/prism-jsx.js';
import 'prismjs/components/prism-typescript.js';

export type Language = 'markup' | 'javascript' | 'jsx' | 'typescript';

export type TokenStream = Prism.TokenStream;

export function tokenize(code: string, language: Language): TokenStream {
	return Prism.tokenize(code, Prism.languages[language]);
}

export function tokenClass(token: Prism.Token) {
	return ['token', token.type, token.alias ?? []].flat().join(' ');
}
