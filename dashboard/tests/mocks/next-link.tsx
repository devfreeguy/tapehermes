import type { ReactNode } from 'react'

/** next/link as a plain anchor, so components that link can render without a router. */
export default function Link({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) {
  return <a href={href} {...rest}>{children}</a>
}
