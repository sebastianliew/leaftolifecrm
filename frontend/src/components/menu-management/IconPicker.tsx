"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { IconRegistry } from '@/components/navigation/config/icons.registry'
import { cn } from '@/lib/utils'

interface IconPickerProps {
  value: string
  onChange: (icon: string) => void
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  
  const iconNames = IconRegistry.list()
  const filteredIcons = iconNames.filter(name => 
    name.toLowerCase().includes(search.toLowerCase())
  )
  
  const CurrentIcon = value ? IconRegistry.get(value) : null

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start text-left font-normal"
        >
          {CurrentIcon ? (
            <>
              <CurrentIcon className="h-4 w-4 mr-2" />
              {value}
            </>
          ) : (
            <span className="text-gray-500">Select an icon...</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-2">
          <Input
            placeholder="Search icons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-2"
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto p-2">
          <div className="grid grid-cols-6 gap-1">
            {filteredIcons.map((iconName) => {
              const Icon = IconRegistry.get(iconName)
              if (!Icon) return null
              
              return (
                <button
                  key={iconName}
                  onClick={() => {
                    onChange(iconName)
                    setIsOpen(false)
                  }}
                  className={cn(
                    "p-2 rounded hover:bg-gray-100 flex flex-col items-center justify-center",
                    value === iconName && "bg-blue-50 hover:bg-blue-100"
                  )}
                  title={iconName}
                >
                  <Icon className="h-5 w-5" />
                </button>
              )
            })}
          </div>
          {filteredIcons.length === 0 && (
            <div className="text-center py-4 text-gray-500">
              No icons found
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}