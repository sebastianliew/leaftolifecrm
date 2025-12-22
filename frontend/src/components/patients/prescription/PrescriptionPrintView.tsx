"use client"

import React from 'react'
import { format } from 'date-fns'
import type { Prescription } from '@/types/prescription'
import type { Patient } from '@/types/patient'
import { PrescriptionPrintStyles } from './PrescriptionPrintStyles'

interface PrescriptionPrintViewProps {
  patient: Patient
  prescription: Prescription
  remedyRows: Array<{ id: string; name: string }>
  rowData: Record<string, string>
}

export function PrescriptionPrintView({
  patient,
  prescription,
  remedyRows,
  rowData
}: PrescriptionPrintViewProps) {
  const meals = ['breakfast', 'lunch', 'dinner'] as const
  const timings = ['before', 'during', 'after'] as const
  
  const getCellKey = (rowId: string, meal: string, timing: string) => {
    return `${rowId}-${meal}-${timing}`
  }

  return (
    <div className="print-container">
      <PrescriptionPrintStyles />
      
      {/* Header */}
      <div className="prescription-header">
        <h1>Naturopathic Prescription</h1>
        <div className="practitioner-info">
          <p>{prescription.practitionerName}</p>
          <p>{prescription.practitionerCredentials}</p>
        </div>
      </div>

      {/* Patient Information */}
      <div className="avoid-break mb-6">
        <h2 className="text-lg font-bold mb-2">Patient Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p><strong>Name:</strong> {prescription.patientName}</p>
            <p><strong>Patient ID:</strong> {patient.id}</p>
          </div>
          <div>
            <p><strong>Date:</strong> {prescription.date}</p>
            <p><strong>Status:</strong> {prescription.status}</p>
          </div>
        </div>
      </div>

      {/* Remedy Schedule */}
      <div className="avoid-break mb-6">
        <h2 className="text-lg font-bold mb-2">Daily Remedy Schedule</h2>
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left">Remedy</th>
              {meals.map(meal => (
                <React.Fragment key={meal}>
                  <th colSpan={3} className="text-center capitalize">{meal}</th>
                </React.Fragment>
              ))}
            </tr>
            <tr>
              <th></th>
              {meals.map(meal => (
                timings.map(timing => (
                  <th key={`${meal}-${timing}`} className="text-center text-xs capitalize">
                    {timing}
                  </th>
                ))
              ))}
            </tr>
          </thead>
          <tbody>
            {remedyRows.map(row => (
              <tr key={row.id}>
                <td className="font-medium">
                  {rowData[`${row.id}-name`] || row.name || ''}
                </td>
                {meals.map(meal => (
                  timings.map(timing => {
                    const cellKey = getCellKey(row.id, meal, timing)
                    return (
                      <td key={cellKey} className="text-center">
                        {rowData[cellKey] || ''}
                      </td>
                    )
                  })
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Special Instructions */}
      {prescription.specialInstructions.length > 0 && (
        <div className="avoid-break mb-6">
          <h2 className="text-lg font-bold mb-2">Special Instructions</h2>
          <ol className="list-decimal list-inside space-y-1">
            {prescription.specialInstructions.map((instruction) => (
              <li key={instruction.id}>{instruction.instruction}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Dietary Advice */}
      {prescription.dietaryAdvice.length > 0 && (
        <div className="avoid-break mb-6">
          <h2 className="text-lg font-bold mb-2">Dietary Advice</h2>
          <ul className="list-disc list-inside space-y-1">
            {prescription.dietaryAdvice.map((advice, index) => (
              <li key={index}>{advice}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Lifestyle Advice */}
      {prescription.lifestyleAdvice.length > 0 && (
        <div className="avoid-break mb-6">
          <h2 className="text-lg font-bold mb-2">Lifestyle Advice</h2>
          <ul className="list-disc list-inside space-y-1">
            {prescription.lifestyleAdvice.map((advice, index) => (
              <li key={index}>{advice}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 pt-6 border-t">
        <div className="grid grid-cols-2 gap-8">
          <div>
            <p className="mb-8">_________________________</p>
            <p>Practitioner Signature</p>
            <p className="text-sm text-gray-600">{prescription.practitionerName}</p>
          </div>
          <div className="text-right">
            <p>Date: {format(new Date(), 'dd/MM/yyyy')}</p>
            <p className="text-sm text-gray-600 mt-2">
              Prescription ID: {prescription.id || 'Draft'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}