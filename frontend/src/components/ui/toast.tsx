"use client"

import * as React from "react"

// Type exports kept for backward compatibility with existing imports
export type ToastActionElement = React.ReactElement

export interface ToastProps {
  title?: string
  description?: string
  variant?: "default" | "destructive" | "success"
  onClose?: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

// Re-export useToast for files that import from "@/components/ui/toast"
export { useToast } from "@/hooks/use-toast"

// Stub components kept for any lingering imports
export function ToastProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export function ToastViewport() {
  return null
}

export function ToastClose(_props: { onClose?: () => void }) {
  return null
}

export function ToastTitle({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}

export function ToastDescription({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}
