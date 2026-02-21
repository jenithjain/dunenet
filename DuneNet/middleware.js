import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const authSecret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;

export async function middleware(request) {
  let token = null;
  try {
    token = await getToken({
      req: request,
      secret: authSecret,
    });
  } catch {
    token = null;
  }

  const { pathname } = request.nextUrl;

  // Public routes
  const publicRoutes = ['/', '/login', '/auth', '/api/auth'];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  // If user is not authenticated and trying to access protected route
  if (!token && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // If authenticated user tries to access login/auth, redirect to dashboard
  if (token && (pathname === '/login' || pathname === '/auth')) {
    const dashboardUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
