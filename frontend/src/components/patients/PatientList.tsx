'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { Patient, PatientFormData } from '@/types/patient';
import { HiPencilAlt, HiTrash, HiEye } from "react-icons/hi";
import { formatDate } from "@/lib/utils";

interface PatientListProps {
  patients: Patient[];
  loading?: boolean;
  onUpdatePatient?: (id: string, data: PatientFormData) => Promise<void>;
  onDeletePatient?: (patient: Patient) => Promise<void>;
  onCreateClick?: () => void;
  isSubmitting?: boolean;
}

export function PatientList({
  patients,
  loading = false,
  onDeletePatient,
  onCreateClick,
  isSubmitting = false
}: PatientListProps) {
  const handleDeletePatient = async (patient: Patient) => {
    if (onDeletePatient) {
      await onDeletePatient(patient);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medsy-green mx-auto mb-4"></div>
          <p>Loading patients...</p>
        </div>
      </div>
    );
  }

  if (patients.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 mb-4">No patients found</p>
        {onCreateClick && (
          <Button onClick={onCreateClick}>Add First Patient</Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Date of Birth</TableHead>
            <TableHead>Gender</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Tier / Discount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {patients.map((patient) => {
            const patientName = patient.name || `${patient.firstName} ${patient.lastName}`.trim();
            return (
              <TableRow key={patient.id || patient._id}>
                <TableCell className="font-medium">
                  {patientName}
                </TableCell>
                <TableCell>
                  {formatDate(patient.dateOfBirth)}
                </TableCell>
                <TableCell className="capitalize">{patient.gender}</TableCell>
                <TableCell>
                  <div className="text-sm">
                    <div>{patient.phone}</div>
                    <div className="text-gray-500">{patient.email}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {patient.memberBenefits ? (
                      <>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={
                              patient.memberBenefits.membershipTier === 'platinum' ? 'default' :
                              patient.memberBenefits.membershipTier === 'vip' ? 'secondary' :
                              patient.memberBenefits.membershipTier === 'silver' ? 'outline' :
                              patient.memberBenefits.membershipTier === 'standard' ? 'outline' :
                              'secondary'
                            }
                            className={
                              patient.memberBenefits.membershipTier === 'platinum' ? 'bg-yellow-600 hover:bg-yellow-700 text-white' :
                              patient.memberBenefits.membershipTier === 'vip' ? 'bg-purple-600 hover:bg-purple-700 text-white' :
                              patient.memberBenefits.membershipTier === 'silver' ? 'border-gray-400' :
                              patient.memberBenefits.membershipTier === 'standard' ? 'border-green-400 text-green-700' :
                              ''
                            }
                          >
                            {patient.memberBenefits.membershipTier.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="text-gray-500 mt-1">
                          {patient.memberBenefits.discountPercentage}% off
                        </div>
                      </>
                    ) : (
                      <span className="text-gray-400">No tier data</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={patient.status === 'active' ? 'default' : 'secondary'}>
                    {patient.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Link href={`/patients/${patient.id}`}>
                      <Button variant="outline" size="sm" disabled={isSubmitting}>
                        <HiEye className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Link href={`/patients/${patient.id}/edit`}>
                      <Button variant="outline" size="sm" disabled={isSubmitting}>
                        <HiPencilAlt className="w-4 h-4" />
                      </Button>
                    </Link>
                    {onDeletePatient && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" disabled={isSubmitting}>
                            <HiTrash className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Patient</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete {patientName}? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeletePatient(patient)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
} 