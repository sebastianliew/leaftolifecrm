"use client"

/**
 * Bridge layer: maps the legacy useToast / toast({ title, description, variant })
 * API to sonner so every callsite works without changes.
 */

import { toast as sonnerToast } from "sonner"

interface ToastOptions {
  title?: string
  description?: string
  variant?: "default" | "destructive" | "success"
  // Legacy fields kept for type compat
  open?: boolean
  onOpenChange?: (open: boolean) => void
  action?: React.ReactElement
}

function toast(opts: ToastOptions) {
  const message = opts.title || opts.description || ""
  const desc = opts.title ? opts.description : undefined

  if (opts.variant === "destructive") {
    return sonnerToast.error(message, { description: desc })
  }
  if (opts.variant === "success") {
    return sonnerToast.success(message, { description: desc })
  }
  return sonnerToast(message, { description: desc })
}

function useToast() {
  return {
    toast,
    toasts: [] as never[],
    dismiss: (id?: string | number) => {
      if (id !== undefined) sonnerToast.dismiss(id)
      else sonnerToast.dismiss()
    },
  }
}

export { useToast, toast }
