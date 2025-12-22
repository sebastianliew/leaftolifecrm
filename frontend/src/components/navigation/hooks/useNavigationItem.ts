import { useCallback } from 'react'
import { useNavigation } from '../NavigationProvider'
import { NavigationItem } from '../types/navigation.types'

export function useNavigationItem() {
  const { registerItem } = useNavigation()

  const addNavigationItem = useCallback((
    item: NavigationItem,
    position?: 'start' | 'end' | number
  ) => {
    registerItem(item, position)
  }, [registerItem])

  return {
    addNavigationItem
  }
}