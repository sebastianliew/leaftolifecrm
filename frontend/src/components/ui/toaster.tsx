"use client"

import { Toaster as SonnerToaster } from "sonner"

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      expand={false}
      richColors
      closeButton
      toastOptions={{
        duration: 5000,
        style: {
          borderRadius: "12px",
          fontSize: "14px",
          boxShadow: "0 8px 30px rgba(0, 0, 0, 0.12)",
        },
      }}
    />
  )
}
