import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { SignJWT } from 'jose/jwt/sign'
import { jwtVerify } from 'jose/jwt/verify'

const IS_DEV = process.env.NODE_ENV === 'development'
const DEV_EMAIL = 'dev@local.test'
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60 // 30 days, NextAuth's default

const INSECURE_DEFAULT_SECRET = 'dev-only-insecure-secret-change-me'

if (!IS_DEV && (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET === INSECURE_DEFAULT_SECRET)) {
  throw new Error(
    'NEXTAUTH_SECRET must be set to a real secret outside development — refusing to sign session tokens with the insecure default.'
  )
}

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || INSECURE_DEFAULT_SECRET)

export const authOptions: NextAuthOptions = {
  providers: IS_DEV
    ? [
        CredentialsProvider({
          id: 'dev',
          name: 'Development (auto-signin)',
          credentials: {},
          async authorize() {
            return { id: DEV_EMAIL, email: DEV_EMAIL, name: 'Dev User', image: null }
          },
        }),
      ]
    : [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID || '',
          clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        }),
      ],
  callbacks: {
    // Auth allowlist enforcement lives entirely on the backend now — the
    // User table there is the single source of truth (see
    // get_authenticated_user_id in the backend repo). The frontend only
    // asserts identity via Google OAuth (or fake dev credentials) and
    // mints a signed session token; every API call independently
    // re-checks the allowlist backend-side, so duplicating that check
    // here would just be a second, weaker copy of the same rule.
    async signIn({ user }) {
      return !!user.email
    },
    async jwt({ token, user }) {
      if (user?.email) {
        token.email = user.email
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = (token.email as string) || session.user.email || ''
      }
      return session
    },
  },
  jwt: {
    // NextAuth's default session token is an encrypted JWE, which is
    // fragile/non-trivial to verify from a separate Python service. This
    // override replaces it with a standard HS256-signed JWT using the
    // same NEXTAUTH_SECRET as the shared HMAC key — the FastAPI backend
    // verifies it with plain PyJWT, no NextAuth-internal-format
    // replication needed.
    async encode({ token }) {
      return new SignJWT({ email: token?.email })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS)
        .sign(secret)
    },
    async decode({ token }) {
      if (!token) return null
      try {
        const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })
        return payload
      } catch {
        return null
      }
    },
  },
  pages: IS_DEV ? {} : { signIn: '/login', error: '/login' },
}
