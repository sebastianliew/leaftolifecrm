"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface AdviceSectionProps {
  dietaryAdvice: string[]
  lifestyleAdvice: string[]
  editMode: boolean
  readOnly: boolean
  onDietaryAdviceChange: (advice: string[]) => void
  onLifestyleAdviceChange: (advice: string[]) => void
}

export function AdviceSection({
  dietaryAdvice,
  lifestyleAdvice,
  editMode,
  readOnly,
  onDietaryAdviceChange,
  onLifestyleAdviceChange
}: AdviceSectionProps) {
  const [dietaryText, setDietaryText] = useState(dietaryAdvice.join('\n'))
  const [lifestyleText, setLifestyleText] = useState(lifestyleAdvice.join('\n'))

  const handleDietaryChange = (value: string) => {
    setDietaryText(value)
    const lines = value.split('\n').filter(line => line.trim())
    onDietaryAdviceChange(lines)
  }

  const handleLifestyleChange = (value: string) => {
    setLifestyleText(value)
    const lines = value.split('\n').filter(line => line.trim())
    onLifestyleAdviceChange(lines)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Advice & Recommendations</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="dietary" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dietary">Dietary Advice</TabsTrigger>
            <TabsTrigger value="lifestyle">Lifestyle Advice</TabsTrigger>
          </TabsList>
          
          <TabsContent value="dietary" className="space-y-4">
            {editMode && !readOnly ? (
              <Textarea
                value={dietaryText}
                onChange={(e) => handleDietaryChange(e.target.value)}
                placeholder="Enter dietary advice (one item per line)..."
                className="min-h-[200px]"
              />
            ) : (
              <div className="space-y-2">
                {dietaryAdvice.length > 0 ? (
                  dietaryAdvice.map((advice, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <span className="text-blue-600 mt-1">•</span>
                      <p className="text-sm">{advice}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">No dietary advice provided</p>
                )}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="lifestyle" className="space-y-4">
            {editMode && !readOnly ? (
              <Textarea
                value={lifestyleText}
                onChange={(e) => handleLifestyleChange(e.target.value)}
                placeholder="Enter lifestyle advice (one item per line)..."
                className="min-h-[200px]"
              />
            ) : (
              <div className="space-y-2">
                {lifestyleAdvice.length > 0 ? (
                  lifestyleAdvice.map((advice, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <span className="text-green-600 mt-1">•</span>
                      <p className="text-sm">{advice}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">No lifestyle advice provided</p>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}