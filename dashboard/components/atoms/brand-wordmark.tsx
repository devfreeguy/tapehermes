import Image from 'next/image'

export function BrandWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-3 font-(family-name:--font-auth) text-xl font-bold tracking-tight">
      <Image
        src="/brand/tapehermes-mark.webp"
        alt=""
        width={44}
        height={44}
        unoptimized
        className="size-11 rounded-lg"
      />
      <span className={compact ? 'sr-only lg:not-sr-only' : undefined}>TapeHermes</span>
    </span>
  )
}
