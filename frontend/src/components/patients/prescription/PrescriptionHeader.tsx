"use client"

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FiEdit, FiPrinter, FiUser } from 'react-icons/fi'
import { format } from 'date-fns'
import type { Prescription } from '@/types/prescription'
import type { Patient } from '@/types/patient'

interface PrescriptionHeaderProps {
  patient: Patient
  prescription: Prescription
  editMode: boolean
  readOnly: boolean
  onEditToggle: () => void
  onPrint: () => void
}

export function PrescriptionHeader({
  patient,
  prescription,
  editMode,
  readOnly,
  onEditToggle,
  onPrint
}: PrescriptionHeaderProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'completed':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <FiUser className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-2xl">{prescription.patientName}</CardTitle>
              <CardDescription>
                Patient ID: {patient.id} | Date: {prescription.date}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(prescription.status)}>
              {prescription.status}
            </Badge>
            {!readOnly && (
              <Button
                variant={editMode ? "default" : "outline"}
                size="sm"
                onClick={onEditToggle}
              >
                <FiEdit className="h-4 w-4 mr-2" />
                {editMode ? 'Save' : 'Edit'}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onPrint}
            >
              <FiPrinter className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Practitioner</p>
            <p className="font-medium">{prescription.practitionerName}</p>
            <p className="text-sm text-gray-500">{prescription.practitionerCredentials}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Created</p>
            <p className="font-medium">{format(new Date(prescription.createdAt), 'dd/MM/yyyy HH:mm')}</p>
            <p className="text-sm text-gray-500">By: {prescription.createdBy}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}