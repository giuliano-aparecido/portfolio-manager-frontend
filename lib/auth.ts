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
