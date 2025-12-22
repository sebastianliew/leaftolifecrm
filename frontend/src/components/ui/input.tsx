import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-10px border border-gray-300 bg-white px-4 py-3 text-14px font-open text-gray-700 placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medsy-green focus-visible:border-medsy-green transition-all duration-350 disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:text-14px file:font-medium",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
