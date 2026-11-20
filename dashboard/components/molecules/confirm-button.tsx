'use client'

import { useTranslator } from '@/lib/locale-context'
import type { ReactNode } from 'react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

/** A button that asks "are you sure" first. Used for anything that cannot be undone. */
export function ConfirmButton({ trigger, title, description, confirmLabel, onConfirm, destructive = false }: { trigger: ReactNode; title: string; description: string; confirmLabel: string; onConfirm: () => void; destructive?: boolean }) {
  const t = useTranslator()
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className={destructive ? 'pill-control' : undefined}>{t('Cancel')}</AlertDialogCancel>
          <AlertDialogAction variant={destructive ? 'destructive' : 'default'} className={destructive ? 'pill-control' : undefined} onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
