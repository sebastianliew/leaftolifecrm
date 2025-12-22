"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { FaFlask, FaPlusCircle } from "react-icons/fa"

interface SimpleBlendSelectorProps {
  open: boolean
  onClose: () => void
  onSelectFixedBlend: () => void
  onSelectCustomBlend: () => void
}

export function SimpleBlendSelector({ open, onClose, onSelectFixedBlend, onSelectCustomBlend }: SimpleBlendSelectorProps) {
  const blendOptions = [
    {
      id: 'fixed',
      title: 'Pre-defined Blend',
      description: 'Select from saved blend templates',
      icon: FaFlask,
      action: onSelectFixedBlend,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 hover:bg-purple-100'
    },
    {
      id: 'custom',
      title: 'Custom Blend',
      description: 'Create a new blend on the fly',
      icon: FaPlusCircle,
      action: onSelectCustomBlend,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 hover:bg-blue-100'
    }
  ]

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select Blend Type</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3 mt-4">
          {blendOptions.map((option) => {
            const Icon = option.icon
            return (
              <Card
                key={option.id}
                className={`cursor-pointer transition-all ${option.bgColor} hover:shadow-md`}
                onClick={option.action}
              >
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <Icon className={`w-8 h-8 ${option.color} mt-1`} />
                    <div className="flex-1">
                      <CardTitle className="text-base">{option.title}</CardTitle>
                      <CardDescription className="text-sm mt-1">
                        {option.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}