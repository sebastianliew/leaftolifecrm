"use client"

import React, { useState } from 'react'
import { NavigationItem } from '@/components/navigation/types/navigation.types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { 
  HiChevronRight, 
  HiChevronDown, 
  HiPlus, 
  HiTrash,
  HiBars3,
  HiFolder,
  HiFolderOpen,
  HiDocument
} from 'react-icons/hi2'
import { resolveIcon } from '@/components/navigation/config/icons.registry'

interface MenuTreeViewProps {
  items: NavigationItem[]
  selectedItem: NavigationItem | null
  onSelectItem: (item: NavigationItem) => void
  onReorderItems: (items: NavigationItem[]) => void
  onAddItem: (parentId?: string) => void
  onDeleteItem: (itemId: string) => void
}

interface TreeNodeProps {
  item: NavigationItem
  level: number
  isSelected: boolean
  onSelect: () => void
  onAddChild: () => void
  onDelete: () => void
  onDragStart: (e: React.DragEvent, item: NavigationItem) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent, targetItem: NavigationItem) => void
}

function TreeNode({ 
  item, 
  level, 
  isSelected, 
  onSelect, 
  onAddChild, 
  onDelete,
  onDragStart,
  onDragOver,
  onDrop
}: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const hasChildren = item.children && item.children.length > 0
  const Icon = resolveIcon(item.icon)

  return (
    <div>
      <div
        draggable
        onDragStart={(e) => onDragStart(e, item)}
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, item)}
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-gray-100 group",
          isSelected && "bg-blue-50 hover:bg-blue-100",
          "transition-colors"
        )}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={onSelect}
      >
        {/* Drag Handle */}
        <HiBars3 className="h-4 w-4 text-gray-400 cursor-move opacity-0 group-hover:opacity-100 transition-opacity" />
        
        {/* Expand/Collapse */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(!isExpanded)
            }}
            className="p-0.5 hover:bg-gray-200 rounded"
          >
            {isExpanded ? (
              <HiChevronDown className="h-3 w-3" />
            ) : (
              <HiChevronRight className="h-3 w-3" />
            )}
          </button>
        ) : (
          <div className="w-4" />
        )}

        {/* Icon */}
        {hasChildren ? (
          isExpanded ? (
            <HiFolderOpen className="h-4 w-4 text-blue-500" />
          ) : (
            <HiFolder className="h-4 w-4 text-blue-500" />
          )
        ) : Icon ? (
          <Icon className="h-4 w-4 text-gray-500" />
        ) : (
          <HiDocument className="h-4 w-4 text-gray-500" />
        )}

        {/* Name */}
        <span className="flex-1 text-sm font-medium">{item.name}</span>

        {/* Actions */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAddChild()
            }}
            className="p-1 hover:bg-gray-200 rounded"
            title="Add child item"
          >
            <HiPlus className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="p-1 hover:bg-red-100 text-red-600 rounded"
            title="Delete item"
          >
            <HiTrash className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {item.children!.map((child) => (
            <TreeNode
              key={child.id}
              item={child}
              level={level + 1}
              isSelected={isSelected}
              onSelect={onSelect}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function MenuTreeView({
  items,
  selectedItem,
  onSelectItem,
  onReorderItems,
  onAddItem,
  onDeleteItem
}: MenuTreeViewProps) {
  const [draggedItem, setDraggedItem] = useState<NavigationItem | null>(null)

  const handleDragStart = (e: React.DragEvent, item: NavigationItem) => {
    setDraggedItem(item)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetItem: NavigationItem) => {
    e.preventDefault()
    
    if (!draggedItem || draggedItem.id === targetItem.id) {
      return
    }

    // Remove dragged item from tree
    const removeItem = (items: NavigationItem[], itemToRemove: NavigationItem): NavigationItem[] => {
      return items
        .filter(item => item.id !== itemToRemove.id)
        .map(item => ({
          ...item,
          children: item.children ? removeItem(item.children, itemToRemove) : undefined
        }))
    }

    // Insert dragged item after target
    const insertItem = (
      items: NavigationItem[], 
      targetId: string, 
      itemToInsert: NavigationItem
    ): NavigationItem[] => {
      const result: NavigationItem[] = []
      
      for (const item of items) {
        result.push(item)
        
        if (item.id === targetId) {
          result.push(itemToInsert)
        }
        
        if (item.children) {
          result[result.length - 1] = {
            ...item,
            children: insertItem(item.children, targetId, itemToInsert)
          }
        }
      }
      
      return result
    }

    let newItems = removeItem(items, draggedItem)
    newItems = insertItem(newItems, targetItem.id, draggedItem)
    
    onReorderItems(newItems)
    setDraggedItem(null)
  }

  const renderTree = (items: NavigationItem[], level = 0) => {
    return items.map((item) => (
      <TreeNode
        key={item.id}
        item={item}
        level={level}
        isSelected={selectedItem?.id === item.id}
        onSelect={() => onSelectItem(item)}
        onAddChild={() => onAddItem(item.id)}
        onDelete={() => onDeleteItem(item.id)}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      />
    ))
  }

  return (
    <div className="border rounded-lg p-2 min-h-[400px] max-h-[600px] overflow-y-auto">
      {items.length > 0 ? (
        renderTree(items)
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>No menu items yet</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAddItem()}
            className="mt-4"
          >
            <HiPlus className="h-4 w-4 mr-2" />
            Add First Item
          </Button>
        </div>
      )}
    </div>
  )
}