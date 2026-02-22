"use client"

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

// Patient Form
export const PatientForm = dynamic(
  () => import('@/components/patients/patient-form').then(mod => ({ default: mod.PatientForm })),
  {
    loading: () => <FormSkeleton />,
    ssr: false
  }
)

// Add Product Modal
export const AddProductModal = dynamic(
  () => import('@/components/inventory/add-product-modal').then(mod => ({ default: mod.AddProductModal })),
  {
    loading: () => <ModalSkeleton />,
    ssr: false
  }
)

// Edit Product Modal
export const EditProductModal = dynamic(
  () => import('@/components/inventory/edit-product-modal').then(mod => ({ default: mod.EditProductModal })),
  {
    loading: () => <ModalSkeleton />,
    ssr: false
  }
)

// Bundle Form
export const BundleForm = dynamic(
  () => import('@/components/bundles/BundleForm').then(mod => ({ default: mod.BundleForm })),
  {
    loading: () => <FormSkeleton />,
    ssr: false
  }
)

// Chart Components (if we add them)
export const DashboardChart = dynamic(
  () => import('@/components/ui/chart').then(mod => ({ default: mod.ChartContainer })),
  {
    loading: () => <ChartSkeleton />,
    ssr: false
  }
)

// Skeleton Components
function FormSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-64" />
      <div className="flex justify-end gap-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  )
}

function ModalSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64" />
      <div className="flex justify-end gap-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  )
}

function ChartSkeleton() {
  return <Skeleton className="h-[400px] w-full" />
}