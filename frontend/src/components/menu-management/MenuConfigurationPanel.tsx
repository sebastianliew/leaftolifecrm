"use client"

import React from 'react'
import { MenuConfiguration } from '@/components/navigation/types/menu-management.types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { HiPlus, HiTrash } from 'react-icons/hi2'

interface MenuConfigurationPanelProps {
  configurations: MenuConfiguration[]
  activeConfig: MenuConfiguration | null
  onSelectConfig: (config: MenuConfiguration) => void
  onCreateConfig: () => void
  onDeleteConfig: (id: string) => void
}

export function MenuConfigurationPanel({
  configurations,
  activeConfig,
  onSelectConfig,
  onCreateConfig,
  onDeleteConfig
}: MenuConfigurationPanelProps) {
  return (
    <div className="flex gap-2">
      <Select
        value={activeConfig?.id}
        onValueChange={(id) => {
          const config = configurations.find(c => c.id === id)
          if (config) onSelectConfig(config)
        }}
      >
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="Select configuration" />
        </SelectTrigger>
        <SelectContent>
          {configurations.map((config) => (
            <SelectItem key={config.id} value={config.id}>
              {config.name}
              {config.isActive && ' (Active)'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <Button
        size="icon"
        variant="outline"
        onClick={onCreateConfig}
        title="Create new configuration"
      >
        <HiPlus className="h-4 w-4" />
      </Button>
      
      {activeConfig && configurations.length > 1 && (
        <Button
          size="icon"
          variant="outline"
          onClick={() => onDeleteConfig(activeConfig.id)}
          title="Delete configuration"
        >
          <HiTrash className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}