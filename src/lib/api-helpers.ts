import { NextResponse } from 'next/server';
import type { ZodSchema } from 'zod';
import { auth } from '@/lib/auth';

export function ok<T>(data: T, status = 200) { return NextResponse.json(data, { status }); }
export function fail(status: number, message: string, extra?: object) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export class ResponseError extends Error {
  constructor(public status: number, public msg: string) { super(msg); }
}

export async function requireUserId(): Promise<string> {
  const session = await auth();
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) throw new ResponseError(401, 'Unauthorized');
  return id;
}
export async function getUserId(): Promise<string | null> {
  const session = await auth();
  return ((session?.user as { id?: string } | undefined)?.id) ?? null;
}

export async function parseBody<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  const json = await req.json().catch(() => null);
  const result = schema.safeParse(json);
  if (!result.success) throw new ResponseError(400, 'Invalid body: ' + result.error.message);
  return result.data;
}

export function handle<C = unknown>(handler: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C) => {
    try { return await handler(req, ctx); }
    catch (e) {
      if (e instanceof ResponseError) return fail(e.status, e.msg);
      const msg = (e as Error).message ?? 'Internal error';
      if (msg.startsWith('Forbidden')) return fail(403, msg);
      console.error(e);
      return fail(500, 'Internal error');
    }
  };
}
