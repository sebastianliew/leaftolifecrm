"use client"

import * as React from "react"
import { format, parse, isValid } from "date-fns"
import { enGB } from "date-fns/locale"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export interface DateInputProps {
  value?: Date | string
  onChange?: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
  id?: string
}

/**
 * Date Input Component with DD/MM/YYYY format
 * Provides consistent date display for all users regardless of browser locale
 */
export function DateInput({
  value,
  onChange,
  placeholder = "DD/MM/YYYY",
  disabled = false,
  required = false,
  className,
  id,
}: DateInputProps) {
  const [inputValue, setInputValue] = React.useState("")

  // Convert Date object to DD/MM/YYYY string
  const formatToDisplay = (date: Date | string | undefined): string => {
    if (!date) return ""

    try {
      const dateObj = typeof date === "string" ? new Date(date) : date
      if (!isValid(dateObj)) return ""
      return format(dateObj, "dd/MM/yyyy", { locale: enGB })
    } catch {
      return ""
    }
  }

  // Parse DD/MM/YYYY string to Date object
  const parseFromDisplay = (dateString: string): Date | undefined => {
    if (!dateString) return undefined

    try {
      // Try parsing DD/MM/YYYY format
      const parsedDate = parse(dateString, "dd/MM/yyyy", new Date(), { locale: enGB })
      if (isValid(parsedDate)) return parsedDate

      // Fallback to ISO date parsing
      const isoDate = new Date(dateString)
      if (isValid(isoDate)) return isoDate

      return undefined
    } catch {
      return undefined
    }
  }

  // Sync input value with prop value
  React.useEffect(() => {
    setInputValue(formatToDisplay(value))
  }, [value])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value

    // Remove any non-numeric characters except slashes
    newValue = newValue.replace(/[^\d/]/g, '')

    // Get only the digits
    const digits = newValue.replace(/\//g, '')

    // Format as DD/MM/YYYY with auto-slashes
    let formatted = ''
    for (let i = 0; i < digits.length && i < 8; i++) {
      if (i === 2 || i === 4) {
        formatted += '/'
      }
      formatted += digits[i]
    }

    setInputValue(formatted)

    // Try to parse the input when complete
    if (formatted.length === 10) {
      const parsedDate = parseFromDisplay(formatted)
      if (parsedDate) {
        onChange?.(parsedDate)
      }
    } else if (formatted === "") {
      onChange?.(undefined)
    }
  }

  const handleInputBlur = () => {
    // Validate and reformat on blur
    const parsedDate = parseFromDisplay(inputValue)

    if (parsedDate) {
      setInputValue(formatToDisplay(parsedDate))
      onChange?.(parsedDate)
    } else if (inputValue && inputValue.length > 0) {
      // Reset to last valid date or clear
      setInputValue(formatToDisplay(value))
    }
  }

  return (
    <Input
      id={id}
      type="text"
      value={inputValue}
      onChange={handleInputChange}
      onBlur={handleInputBlur}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      className={cn(className)}
      maxLength={10}
    />
  )
}
