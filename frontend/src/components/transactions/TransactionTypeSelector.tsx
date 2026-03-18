"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { FaBox, FaFlask, FaCubes, FaStethoscope } from "react-icons/fa"
import { HiOutlinePencilSquare } from "react-icons/hi2"

interface TransactionTypeSelectorProps {
  open: boolean
  onClose: () => void
  onSelectType: (type: 'product' | 'blend' | 'bundle' | 'consultation' | 'miscellaneous') => void
}

export function TransactionTypeSelector({ open, onClose, onSelectType }: TransactionTypeSelectorProps) {
  const transactionTypes = [
    {
      id: 'product',
      title: 'Sell Product',
      description: 'Sell individual products from inventory',
      icon: FaBox,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 hover:bg-blue-100',
      disabled: false
    },
    {
      id: 'blend',
      title: 'Create Blend',
      description: 'Mix custom or pre-defined blends',
      icon: FaFlask,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 hover:bg-purple-100',
      disabled: false
    },
    {
      id: 'bundle',
      title: 'Sell Bundle',
      description: 'Pre-packaged product bundles',
      icon: FaCubes,
      color: 'text-green-600',
      bgColor: 'bg-green-50 hover:bg-green-100',
      disabled: false
    },
    {
      id: 'consultation',
      title: 'Consultation',
      description: 'Professional consultation services',
      icon: FaStethoscope,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 hover:bg-orange-100',
      disabled: false
    },
    {
      id: 'miscellaneous',
      title: 'Miscellaneous',
      description: 'Other items (supplies, fees, services)',
      icon: HiOutlinePencilSquare,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50 hover:bg-gray-100',
      disabled: false
    }
  ]

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">What would you like to sell?</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-3 gap-4 mt-4">
          {transactionTypes.map((type) => {
            const Icon = type.icon
            return (
              <Card
                key={type.id}
                className={`cursor-pointer transition-all ${type.bgColor} ${
                  type.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'
                }`}
                onClick={() => !type.disabled && onSelectType(type.id as 'product' | 'blend' | 'bundle' | 'consultation' | 'miscellaneous')}
              >
                <CardHeader className="text-center">
                  <Icon className={`w-12 h-12 mx-auto mb-2 ${type.color}`} />
                  <CardTitle className="text-lg">{type.title}</CardTitle>
                  <CardDescription className="text-sm">{type.description}</CardDescription>
                </CardHeader>
              </Card>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}