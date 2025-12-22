import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-10px text-14px font-semibold transition-all duration-350 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medsy-green focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-medsy-green text-white hover:bg-medsy-green-hover shadow-float hover:shadow-floatBig",
        destructive:
          "bg-error text-white hover:bg-error/90 shadow-float hover:shadow-floatBig",
        outline:
          "border border-gray-300 bg-white hover:bg-gray-100 hover:text-medsy-green text-gray-700",
        secondary:
          "bg-gray-200 text-gray-900 hover:bg-gray-300 shadow-float",
        ghost: "hover:bg-gray-100 hover:text-medsy-green text-gray-700",
        link: "text-medsy-green underline-offset-4 hover:underline",
      },
      size: {
        default: "h-12 px-6 py-3",
        sm: "h-10 rounded-10px px-4 py-2",
        lg: "h-14 rounded-10px px-8 py-4",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
