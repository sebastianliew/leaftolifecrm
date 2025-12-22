import * as React from "react"
import { Input } from "./input"
import { Label } from "./label"
import { cn } from "@/lib/utils"

interface ValidatedInputProps extends React.ComponentProps<typeof Input> {
  label?: string
  error?: string
  touched?: boolean
  required?: boolean
}

export const ValidatedInput = React.forwardRef<HTMLInputElement, ValidatedInputProps>(
  ({ className, label, error, touched, required, id, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`
    const hasError = touched && error
    
    return (
      <div className="space-y-2">
        {label && (
          <Label htmlFor={inputId}>
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        <Input
          ref={ref}
          id={inputId}
          className={cn(
            hasError && "border-destructive focus-visible:ring-destructive",
            className
          )}
          aria-invalid={!!hasError}
          aria-describedby={hasError ? `${inputId}-error` : undefined}
          {...props}
        />
        {hasError && (
          <p id={`${inputId}-error`} className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    )
  }
)

ValidatedInput.displayName = "ValidatedInput"