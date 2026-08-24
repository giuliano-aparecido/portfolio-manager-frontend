'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'

const NAV_LINKS = [
  { href: '/', label: 'Overview' },
  { href: '/securities', label: 'Securities' },
  { href: '/passive', label: 'Passive Investment' },
  { href: '/agent', label: 'Ask AI' },
]

export default function Navigation() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  function linkClass(href: string) {
    return pathname === href ? 'text-blue-600 font-semibold' : 'text-gray-600 hover:text-gray-900'
  }

  // In development there's no sign-in step at all (see DEVELOPMENT.md) -
  // useSession() never resolves to 'authenticated' unless someone manually
  // clicks through the dev sign-in flow, which would otherwise hide the
  // nav entirely for the normal `npm run dev` workflow.
  if (process.env.NODE_ENV !== 'development' && status !== 'authenticated') return null

  return (
    <nav className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="text-xl md:text-2xl font-bold text-blue-600 shrink-0" onClick={() => setIsMenuOpen(false)}>
            Portfolio Manager
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <div className="flex items-center gap-4">
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className={`text-sm ${linkClass(link.href)}`}>
                  {link.label}
                </Link>
              ))}
            </div>
            {session && (
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">{session.user?.email}</span>
                <button
                  onClick={() => signOut()}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 -mr-2 text-gray-600"
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {isMenuOpen && (
          <div className="md:hidden pb-4 flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className={`px-2 py-2 text-sm rounded-md hover:bg-gray-50 ${linkClass(link.href)}`}
              >
                {link.label}
              </Link>
            ))}
            {session && (
              <div className="mt-2 pt-3 border-t border-gray-200 flex flex-col gap-2">
                <span className="px-2 text-sm text-gray-600 truncate">{session.user?.email}</span>
                <button
                  onClick={() => {
                    setIsMenuOpen(false)
                    signOut()
                  }}
                  className="mx-2 px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition text-left"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
