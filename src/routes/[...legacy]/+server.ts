import { createRequestHandler } from 'react-router';
import { env, waitUntil } from 'cloudflare:workers';
import * as build from 'virtual:react-build';
import type { RequestHandler } from './$types';

const handle = createRequestHandler(build, 'production');
const ctx = { waitUntil, passThroughOnException() {}, props: {} } as unknown as ExecutionContext;

export const fallback: RequestHandler = ({ request }) => handle(request, { cloudflare: { env, ctx } });
