"use client"

import React from "react"
import { TableCell, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { FaEye, FaEdit, FaTrash } from "react-icons/fa"

interface Patient {
  id: string
  firstName: string
  lastName: string
  nric?: string
  dateOfBirth: string
  gender: string
  email: string
  phone: string
  occupation?: string
  status: "active" | "inactive"
  legacyCustomerNo?: string
  createdAt: string
  updatedAt: string
  financialSummary?: {
    totalTransactionCount: number
    totalSpent: number
    averageTransactionValue: number
    lastTransactionDate?: Date
    preferredPaymentMethod?: string
  }
  memberBenefits?: {
    discountPercentage: number
    discountReason?: string
    membershipTier: string
    discountStartDate?: Date
  }
  marketingPreferences?: {
    partnerOffers: boolean
    newsletter: boolean
    lastUpdated?: Date
  }
  enrichmentInfo?: {
    lastEnriched?: Date
    enrichmentVersion?: string
    enrichmentSources?: string[]
    dataCompleteness?: number
  }
}

interface PatientTableRowProps {
  patient: Patient
  isSelected: boolean
  onSelect: (patientId: string, checked: boolean) => void
  onDelete: (patientId: string) => void
}

const formatDisplayName = (patient: Patient) => {
  if (patient.lastName && patient.lastName !== 'Unknown') {
    return `${patient.firstName} ${patient.lastName}`.trim()
  }
  return patient.firstName
}

const formatDate = (dateString: string) => {
  try {
    return new Date(dateString).toLocaleDateString('en-GB')
  } catch {
    return dateString
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800"
    case "inactive":
      return "bg-yellow-100 text-yellow-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

export const PatientTableRow = React.memo(({ 
  patient, 
  isSelected, 
  onSelect, 
  onDelete 
}: PatientTableRowProps) => {
  return (
    <TableRow className="hover:bg-gray-50">
      <TableCell className="w-12">
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelect(patient.id, checked as boolean)}
        />
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <Link href={`/patients/${patient.id}`} className="block hover:underline">
          <div>
            <div className="font-medium text-blue-600 hover:text-blue-800">{formatDisplayName(patient)}</div>
            {patient.occupation && (
              <div className="text-sm text-muted-foreground">
                {patient.occupation}
              </div>
            )}
          </div>
        </Link>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <div className="font-mono text-sm">
          {patient.nric || '-'}
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <div className="text-sm">
          {formatDate(patient.dateOfBirth)}
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <div className="text-sm">{patient.email}</div>
        {patient.phone && patient.phone !== '00000000' && (
          <div className="text-sm text-muted-foreground">
            {patient.phone}
          </div>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {patient.financialSummary ? (
          <div className="text-sm">
            <div className="font-semibold text-green-600">
              ${patient.financialSummary.totalSpent.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground">
              {patient.financialSummary.totalTransactionCount} transactions
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No data</div>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {patient.memberBenefits ? (
          <div className="text-sm">
            <Badge className="bg-purple-100 text-purple-800 text-xs">
              {patient.memberBenefits.membershipTier}
            </Badge>
            {patient.memberBenefits.discountPercentage > 0 && (
              <div className="text-xs text-green-600 mt-1">
                {patient.memberBenefits.discountPercentage}% discount
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Standard</div>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <div className="font-mono text-sm text-blue-600">
          {patient.legacyCustomerNo || '-'}
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <Badge className={getStatusColor(patient.status)}>
          {patient.status}
        </Badge>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <div className="flex items-center gap-2">
          <Link href={`/patients/${patient.id}`}>
            <Button variant="ghost" size="icon" title="View patient">
              <FaEye className="h-4 w-4" />
            </Button>
          </Link>
          <Link href={`/patients/${patient.id}/edit`}>
            <Button variant="ghost" size="icon" title="Edit patient">
              <FaEdit className="h-4 w-4" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            title="Delete patient"
            onClick={() => onDelete(patient.id)}
          >
            <FaTrash className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  return prevProps.patient.id === nextProps.patient.id &&
         prevProps.patient.status === nextProps.patient.status &&
         prevProps.isSelected === nextProps.isSelected &&
         JSON.stringify(prevProps.patient.financialSummary) === JSON.stringify(nextProps.patient.financialSummary) &&
         JSON.stringify(prevProps.patient.memberBenefits) === JSON.stringify(nextProps.patient.memberBenefits)
})

PatientTableRow.displayName = 'PatientTableRow'