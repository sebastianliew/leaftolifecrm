"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { FiPlus, FiX, FiAlertCircle } from 'react-icons/fi'
import type { PrescriptionSpecialInstruction } from '@/types/prescription'

interface SpecialInstructionsProps {
  instructions: PrescriptionSpecialInstruction[]
  editMode: boolean
  readOnly: boolean
  onAdd: (instruction: PrescriptionSpecialInstruction) => void
  onRemove: (index: number) => void
}

export function SpecialInstructions({
  instructions,
  editMode,
  readOnly,
  onAdd,
  onRemove
}: SpecialInstructionsProps) {
  const [newInstruction, setNewInstruction] = useState('')

  const handleAddInstruction = () => {
    if (newInstruction.trim()) {
      onAdd({
        id: `instruction-${Date.now()}`,
        instruction: newInstruction.trim(),
        category: 'general',
        priority: 'medium'
      })
      setNewInstruction('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddInstruction()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FiAlertCircle className="h-5 w-5 text-amber-600" />
          Special Instructions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {instructions.map((instruction, index) => (
            <div key={instruction.id} className="flex items-start gap-2">
              <Badge variant="outline" className="mt-1">
                {index + 1}
              </Badge>
              <p className="flex-1 text-sm">{instruction.instruction}</p>
              {editMode && !readOnly && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRemove(index)}
                  className="h-6 w-6 p-0"
                >
                  <FiX className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          
          {instructions.length === 0 && !editMode && (
            <p className="text-gray-500 text-sm">No special instructions</p>
          )}

          {editMode && !readOnly && (
            <div className="flex gap-2 mt-4">
              <Input
                value={newInstruction}
                onChange={(e) => setNewInstruction(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Add special instruction..."
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={handleAddInstruction}
                disabled={!newInstruction.trim()}
              >
                <FiPlus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}