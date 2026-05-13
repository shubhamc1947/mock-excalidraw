import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { nextUrl } = req;
  const isAuthed = !!req.auth;
  const isLogin = nextUrl.pathname.startsWith('/login');
  const isPublic = nextUrl.pathname.startsWith('/p/') || nextUrl.pathname.startsWith('/api/auth');

  if (isPublic) return;
  if (!isAuthed && !isLogin) {
    return NextResponse.redirect(new URL('/login', nextUrl));
  }
  if (isAuthed && isLogin) {
    return NextResponse.redirect(new URL('/', nextUrl));
  }
});

export const config = {
  matcher: ['/((?!_next|favicon.ico|.*\\..*).*)'],
};
