"use client"

import { useEffect } from 'react'
import { useNavigationItem } from '../hooks/useNavigationItem'
import { HiBeaker } from 'react-icons/hi2'
import { IconRegistry } from '../config/icons.registry'

// Example of adding a custom navigation item dynamically
export function CustomNavigationExample() {
  const { addNavigationItem } = useNavigationItem()

  useEffect(() => {
    // Register custom icon
    IconRegistry.register('lab-tests', HiBeaker)

    // Add custom navigation item
    addNavigationItem({
      id: 'lab-tests',
      name: 'Lab Tests',
      href: '/lab-tests',
      icon: 'lab-tests',
      description: 'Manage laboratory test results',
      visibility: {
        roles: ['admin', 'super_admin'],
        permissions: [
          { category: 'patients', permission: 'canViewMedicalHistory' }
        ]
      }
    }, 'end') // Add at the end of navigation

    // Add a submenu item to existing menu
    addNavigationItem({
      id: 'lab-reports',
      name: 'Lab Reports',
      href: '/reports/lab',
      icon: 'lab-tests',
      description: 'View laboratory test reports',
      visibility: {
        permissions: [
          { category: 'reports', permission: 'canViewLabReports' }
        ]
      }
    })
  }, [addNavigationItem])

  return null
}