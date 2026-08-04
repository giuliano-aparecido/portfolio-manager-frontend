import { withAuth } from 'next-auth/middleware'
import { NextRequest } from 'next/server'
import { authOptions } from '@/lib/auth'

export const proxy =
  process.env.NODE_ENV === 'development'
    ? (req: NextRequest) => undefined
    : withAuth(
        function proxy() {
          return undefined
        },
        {
          callbacks: {
            authorized: ({ token }) => !!token,
          },
          pages: {
            signIn: '/login',
          },
          // withAuth's own getToken() call otherwise falls back to NextAuth's
          // default JWE decode, which can't read the HS256 JWT authOptions.jwt
          // actually issues - every request then looks unauthenticated.
          jwt: {
            decode: authOptions.jwt!.decode,
          },
        }
      )

export const config = {
  matcher: ['/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)'],
}
