'use client'

export default function SortHeader({
  label,
  active,
  dir,
  onClick,
  align = 'left',
}: {
  label: string
  active: boolean
  dir: 'asc' | 'desc'
  onClick: () => void
  align?: 'left' | 'right'
}) {
  const arrow = active ? (dir === 'asc' ? ' ↑' : ' ↓') : ''
  return (
    <button
      onClick={onClick}
      className={`font-semibold hover:bg-gray-200 px-1 rounded cursor-pointer ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {label}
      {arrow}
    </button>
  )
}
