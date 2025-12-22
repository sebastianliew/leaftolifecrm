"use client"

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { FiClock, FiPlus, FiCamera } from 'react-icons/fi'
import type { Prescription } from '@/types/prescription'

interface PrescriptionLandingProps {
  currentPrescription?: Prescription
  prescriptionCount: number
  onNewPrescription: () => void
  onViewHistory: () => void
  onManagePhotos: () => void
}

export default function PrescriptionLanding({
  prescriptionCount,
  onNewPrescription,
  onViewHistory,
  onManagePhotos
}: PrescriptionLandingProps) {

  return (
    <div className="space-y-6">
      {/* Quick Actions - Main Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* New Prescription */}
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onNewPrescription}>
          <CardContent className="flex items-center p-6">
            <div className="rounded-lg bg-blue-100 p-3 mr-4">
              <FiPlus className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">New Prescription</h3>
              <p className="text-sm text-gray-500">Create a prescription</p>
            </div>
          </CardContent>
        </Card>

        {/* View History */}
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onViewHistory}>
          <CardContent className="flex items-center p-6">
            <div className="rounded-lg bg-purple-100 p-3 mr-4">
              <FiClock className="h-6 w-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Prescription History</h3>
              <p className="text-sm text-gray-500">
                {prescriptionCount > 0 
                  ? `${prescriptionCount} prescriptions`
                  : 'No prescriptions yet'
                }
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Upload Photos */}
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onManagePhotos}>
          <CardContent className="flex items-center p-6">
            <div className="rounded-lg bg-green-100 p-3 mr-4">
              <FiCamera className="h-6 w-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Medical Photos</h3>
              <p className="text-sm text-gray-500">Upload patient photos</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}