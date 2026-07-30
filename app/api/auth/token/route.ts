import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Extracts the raw (still-encoded) session JWT so the client can attach it
// as a Bearer token to backend API calls — useSession()/getServerSession()
// only expose the decoded payload, and the session cookie itself is
// httpOnly (inaccessible to client JS), so this small endpoint is the only
// way to get the actual signed string out.
export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, raw: true })
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ token })
}
