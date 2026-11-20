'use client'

import { useTranslator } from '@/lib/locale-context'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

const edgeTolerance = 1

export function TabScrollArea({ children }: { children: ReactNode }) {
  const t = useTranslator()
  const id = useId()
  const container = useRef<HTMLDivElement>(null)
  const leftButton = useRef<HTMLButtonElement>(null)
  const rightButton = useRef<HTMLButtonElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  function getViewport() {
    return container.current?.querySelector<HTMLElement>('[data-radix-scroll-area-viewport]')
  }

  useEffect(() => {
    const viewport = getViewport()
    if (!viewport) return

    function update() {
      if (!viewport) return
      const left = viewport.scrollLeft > edgeTolerance
      const right = viewport.scrollWidth - viewport.clientWidth - viewport.scrollLeft > edgeTolerance
      if ((!left && document.activeElement === leftButton.current) || (!right && document.activeElement === rightButton.current)) {
        viewport.focus({ preventScroll: true })
      }
      setEdges((previous) => previous.left === left && previous.right === right ? previous : { left, right })
    }

    const observer = new ResizeObserver(update)
    observer.observe(viewport)
    if (viewport.firstElementChild) observer.observe(viewport.firstElementChild)
    viewport.addEventListener('scroll', update, { passive: true })
    update()
    return () => {
      observer.disconnect()
      viewport.removeEventListener('scroll', update)
    }
  }, [])

  function move(direction: -1 | 1) {
    const viewport = getViewport()
    if (!viewport) return
    const bounds = viewport.getBoundingClientRect()
    const tabs = Array.from(viewport.querySelectorAll('nav a'))
    const firstVisible = tabs.findIndex((tab) => tab.getBoundingClientRect().right > bounds.left + edgeTolerance)
    if (firstVisible < 0) return
    const next = tabs[Math.max(0, Math.min(firstVisible + direction * 2, tabs.length - 1))]
    viewport.scrollTo({
      left: viewport.scrollLeft + next.getBoundingClientRect().left - bounds.left,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    })
  }

  const buttonClass = 'size-11 shrink-0 rounded-full bg-primary-action/12 text-primary-action hover:bg-primary-action/20 hover:text-primary-action md:hidden'

  return (
    <div ref={container} className="flex min-w-0 items-center">
      <Button type="button" variant="ghost" size="icon" ref={leftButton}
        className={cn(buttonClass, !edges.left && 'invisible')} disabled={!edges.left}
        aria-label={t('Scroll tabs left')} aria-controls={id} onClick={() => move(-1)}
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <div id={id} className="min-w-0 flex-1">
        <ScrollArea label={t('Site navigation')} orientation="horizontal" className="max-md:[&_[data-orientation=horizontal]]:hidden">
          {children}
        </ScrollArea>
      </div>
      <Button type="button" variant="ghost" size="icon" ref={rightButton}
        className={cn(buttonClass, !edges.right && 'invisible')} disabled={!edges.right}
        aria-label={t('Scroll tabs right')} aria-controls={id} onClick={() => move(1)}
      >
        <ChevronRight aria-hidden="true" />
      </Button>
    </div>
  )
}
