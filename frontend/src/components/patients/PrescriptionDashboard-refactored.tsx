"use client"

import React from 'react'
import { PrescriptionHeader } from './prescription/PrescriptionHeader'
import { RemedyScheduleTable } from './prescription/RemedyScheduleTable'
import { SpecialInstructions } from './prescription/SpecialInstructions'
import { AdviceSection } from './prescription/AdviceSection'
import { MedicalPhotos } from './prescription/MedicalPhotos'
import { usePrescriptionForm } from '@/hooks/usePrescriptionForm'
import type { Prescription } from '@/types/prescription'
import type { Patient } from '@/types/patient'

interface PrescriptionDashboardProps {
  patient: Patient
  prescription?: Prescription
  onSave?: (prescription: Prescription) => void
  onPrint?: (prescription: Prescription) => void
  readOnly?: boolean
  className?: string
}

export default function PrescriptionDashboard({ 
  patient, 
  prescription, 
  onSave, 
  onPrint, 
  readOnly = false,
  className = ""
}: PrescriptionDashboardProps) {
  const {
    prescription: currentPrescription,
    editMode,
    remedyRows,
    rowData,
    medicalPhotos,
    addRemedyRow,
    deleteRemedyRow,
    updateCellData,
    addSpecialInstruction,
    removeSpecialInstruction,
    updateDietaryAdvice,
    updateLifestyleAdvice,
    addPhoto,
    deletePhoto,
    toggleEditMode,
    handlePrint
  } = usePrescriptionForm({ patient, prescription, onSave })

  const handlePrintClick = () => {
    if (onPrint) {
      onPrint(currentPrescription)
    } else {
      handlePrint()
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Prescription Header */}
      <PrescriptionHeader
        patient={patient}
        prescription={currentPrescription}
        editMode={editMode}
        readOnly={readOnly}
        onEditToggle={toggleEditMode}
        onPrint={handlePrintClick}
      />

      {/* Remedy Schedule Table */}
      <RemedyScheduleTable
        remedyRows={remedyRows}
        rowData={rowData}
        editMode={editMode}
        readOnly={readOnly}
        onAddRow={addRemedyRow}
        onDeleteRow={deleteRemedyRow}
        onCellChange={updateCellData}
      />

      {/* Special Instructions */}
      <SpecialInstructions
        instructions={currentPrescription.specialInstructions}
        editMode={editMode}
        readOnly={readOnly}
        onAdd={addSpecialInstruction}
        onRemove={removeSpecialInstruction}
      />

      {/* Dietary & Lifestyle Advice */}
      <AdviceSection
        dietaryAdvice={currentPrescription.dietaryAdvice}
        lifestyleAdvice={currentPrescription.lifestyleAdvice}
        editMode={editMode}
        readOnly={readOnly}
        onDietaryAdviceChange={updateDietaryAdvice}
        onLifestyleAdviceChange={updateLifestyleAdvice}
      />

      {/* Medical Photos */}
      <MedicalPhotos
        photos={medicalPhotos}
        editMode={editMode}
        readOnly={readOnly}
        patientId={patient.id}
        onPhotoAdd={addPhoto}
        onPhotoDelete={deletePhoto}
      />
    </div>
  )
}