export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#1D4ED8" />
      <path d="M8 22.5 23.5 9.5 19.2 23l-4.1-5.1L8 22.5Z" fill="#BFDBFE" />
      <path d="m15.1 17.9 8.4-8.4-6.3 10.6-2.1-2.2Z" fill="#fff" />
    </svg>
  )
}
