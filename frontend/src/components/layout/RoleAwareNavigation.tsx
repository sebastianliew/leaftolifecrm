"use client"

import { NavigationProvider } from "../navigation/NavigationProvider"
import { NavigationRenderer } from "../navigation/NavigationRenderer"

export function RoleAwareNavigation() {
  return (
    <NavigationProvider>
      <NavigationRenderer />
    </NavigationProvider>
  )
}