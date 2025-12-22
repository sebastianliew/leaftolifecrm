"use client"

import React from "react"
import { useToast } from "@/hooks/use-toast"
import {
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts, dismiss } = useToast()
  const timersRef = React.useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Auto dismiss logic for all toasts
  React.useEffect(() => {
    const timers = timersRef.current
    
    // Set up timers for new toasts
    toasts.forEach((toast) => {
      if (!timers.has(toast.id)) {
        const timer = setTimeout(() => {
          dismiss(toast.id)
          timers.delete(toast.id)
        }, 5000)
        
        timers.set(toast.id, timer)
      }
    })

    // Clean up timers for removed toasts
    const toastIds = new Set(toasts.map(t => t.id))
    timers.forEach((timer, id) => {
      if (!toastIds.has(id)) {
        clearTimeout(timer)
        timers.delete(id)
      }
    })

    // Cleanup all timers on unmount
    return () => {
      timers.forEach(timer => clearTimeout(timer))
      timers.clear()
    }
  }, [toasts, dismiss])

  const getVariantStyles = (variant?: string) => {
    switch (variant) {
      case "destructive":
        return "bg-red-50 border-red-200"
      case "success":
        return "bg-green-50 border-green-200"
      default:
        return "bg-white border-gray-200"
    }
  }

  return (
    <ToastProvider>
      <div className="fixed top-0 right-0 z-[100] flex flex-col-reverse p-4 space-y-4 space-y-reverse">
        {toasts.map(function ({ id, title, description, action, ...props }) {
          return (
            <div
              key={id}
              className={`relative ${getVariantStyles(props.variant)} rounded-lg shadow-lg p-4 min-w-[300px] max-w-[400px]`}
            >
              <div className="grid gap-1 pr-8">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
              {action}
              <ToastClose onClose={() => dismiss(id)} />
            </div>
          )
        })}
      </div>
      <ToastViewport />
    </ToastProvider>
  )
}
