"use client"

import * as React from "react"
import { IoClose } from "react-icons/io5"
import { cn } from "@/lib/utils"

export type ToastActionElement = React.ReactElement

export interface ToastProps {
  title?: string
  description?: string
  variant?: "default" | "destructive" | "success"
  onClose?: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function Toast({ title, description, variant = "default", onClose, children }: ToastProps & { children?: React.ReactNode }) {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onClose?.()
    }, 5000)

    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div
      className={cn("fixed top-4 right-4 z-[100] w-full max-w-sm rounded-lg border p-4 shadow-lg", {
        "bg-white border-gray-200": variant === "default",
        "bg-red-50 border-red-200": variant === "destructive",
        "bg-green-50 border-green-200": variant === "success",
      })}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1">
          {title && (
            <div
              className={cn("font-semibold text-sm", {
                "text-gray-900": variant === "default",
                "text-red-900": variant === "destructive",
                "text-green-900": variant === "success",
              })}
            >
              {title}
            </div>
          )}
          {description && (
            <div
              className={cn("text-sm mt-1", {
                "text-gray-600": variant === "default",
                "text-red-700": variant === "destructive",
                "text-green-700": variant === "success",
              })}
            >
              {description}
            </div>
          )}
          {children}
        </div>
        <button
          onClick={onClose}
          className={cn("text-gray-400 hover:text-gray-600", {
            "hover:text-red-600": variant === "destructive",
            "hover:text-green-600": variant === "success",
          })}
        >
          <IoClose className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// Additional exports for compatibility with toaster
export function ToastProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export function ToastViewport() {
  return null
}

export function ToastClose({ onClose }: { onClose?: () => void }) {
  return (
    <button
      onClick={onClose}
      className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
    >
      <IoClose className="h-4 w-4" />
    </button>
  )
}

export function ToastTitle({ children }: { children: React.ReactNode }) {
  return <div className="font-semibold text-sm">{children}</div>
}

export function ToastDescription({ children }: { children: React.ReactNode }) {
  return <div className="text-sm">{children}</div>
}

export function useToast() {
  const [toasts, setToasts] = React.useState<Array<ToastProps & { id: string }>>([])
  const idCounter = React.useRef(0)

  const toast = React.useCallback((props: ToastProps) => {
    const id = `toast-${++idCounter.current}`
    setToasts((prev) => [...prev, { ...props, id }])
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const ToastContainer = React.useCallback(
    () => (
      <>
        {toasts.map(({ id, ...props }) => (
          <Toast key={id} {...props} onClose={() => removeToast(id)} />
        ))}
      </>
    ),
    [toasts, removeToast],
  )

  return { toast, ToastContainer }
}
