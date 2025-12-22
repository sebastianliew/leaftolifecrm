"use client"

import React from 'react'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface BreadcrumbItem {
  label: string
  href?: string
  current?: boolean
}

interface PrescriptionBreadcrumbProps {
  patientName: string
  patientId: string
  currentDate?: string
  className?: string
}

export default function PrescriptionBreadcrumb({
  patientName,
  patientId,
  currentDate,
  className = ""
}: PrescriptionBreadcrumbProps) {
  const router = useRouter()
  
  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Patients', href: '/patients' },
    { label: patientName, href: `/patients/${patientId}` },
    { label: 'Prescriptions', href: `/patients/${patientId}/prescription` },
    ...(currentDate ? [{ label: currentDate, current: true }] : [])
  ]
  
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center space-x-1", className)}>
      {breadcrumbs.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
          {item.href && !item.current ? (
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto text-sm text-gray-600 hover:text-gray-900"
              onClick={() => router.push(item.href!)}
            >
              {item.label}
            </Button>
          ) : (
            <span className={cn(
              "text-sm",
              item.current ? "text-gray-900 font-medium" : "text-gray-600"
            )}>
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}