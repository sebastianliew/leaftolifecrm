"use client"

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FaSearch, FaUser, FaCheck } from 'react-icons/fa';
import { ImSpinner8 } from 'react-icons/im';
import { usePatients } from '@/hooks/usePatients';
import type { Patient } from '@/types/patient';

interface PatientSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelectPatient: (patient: Patient) => void;
}

// Debounce hook
function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function PatientSelector({ open, onClose, onSelectPatient }: PatientSelectorProps) {
  const { patients, loading, getPatients } = usePatients();
  const [searchTerm, setSearchTerm] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  
  // Debounce search term to avoid excessive API calls
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    if (open && debouncedSearchTerm.length >= 2) {
      setHasSearched(true);
      // Only show active patients in the selector
      getPatients(debouncedSearchTerm, 1, 50, 'active');
    } else if (debouncedSearchTerm.length < 2) {
      setHasSearched(false);
    }
  }, [open, debouncedSearchTerm, getPatients]);
  

  // Optimized filtering with memoization - matches backend text search behavior
  const filteredPatients = useMemo(() => {
    if (!searchTerm.trim()) return patients;

    const search = searchTerm.toLowerCase().trim();
    const searchTerms = search.split(/\s+/).filter(Boolean);

    return patients.filter(patient => {
      if (!patient) return false;

      // Combine all searchable fields into one string (like text index does)
      const searchableText = [
        patient.firstName,
        patient.lastName,
        patient.email,
        patient.phone,
        patient.nric,
        patient.legacyCustomerNo
      ].filter(Boolean).join(' ').toLowerCase();

      // Check if ALL search terms exist anywhere in the combined text
      // This matches how MongoDB text search works
      return searchTerms.every(term => searchableText.includes(term));
    });
  }, [patients, searchTerm]);

  const handleSelectPatient = (patient: Patient) => {
    onSelectPatient(patient);
    onClose();
    setSearchTerm('');
    setHasSearched(false);
  };

  const handleClose = () => {
    onClose();
    setSearchTerm('');
    setHasSearched(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FaUser className="h-5 w-5" />
            Select Patient
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <FaSearch className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name, email, phone, or patient ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>

          {/* Patients Table */}
          <div className="border rounded-lg overflow-hidden">
            {loading ? (
              <div className="flex justify-center items-center py-8">
                <ImSpinner8 className="h-6 w-6 animate-spin text-gray-500" />
                <span className="ml-2 text-gray-500">Searching patients...</span>
              </div>
            ) : !hasSearched ? (
              <div className="text-center py-8">
                <div className="text-gray-500">
                  <FaSearch className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-lg font-medium">Search for patients</p>
                  <p className="text-sm mt-1">Enter a name, email, phone, or patient ID to search</p>
                </div>
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No patients found matching &quot;{searchTerm}&quot;
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto overflow-x-hidden">
                <Table className="w-full table-fixed">
                  <TableHeader className="sticky top-0 bg-white z-10">
                    <TableRow>
                      <TableHead className="w-[25%]">Patient ID</TableHead>
                      <TableHead className="w-[20%]">Name</TableHead>
                      <TableHead className="w-[25%]">Email</TableHead>
                      <TableHead className="w-[12%]">Phone</TableHead>
                      <TableHead className="w-[8%]">Status</TableHead>
                      <TableHead className="w-[10%] text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPatients.map((patient) => (
                      <TableRow 
                        key={patient.id || patient._id} 
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleSelectPatient(patient)}
                      >
                        <TableCell className="font-medium">
                          <div className="truncate pr-2" title={patient.legacyCustomerNo || patient.id || 'N/A'}>
                            {patient.legacyCustomerNo || patient.id || 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {`${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Unknown'}
                            </div>
                            {patient.dateOfBirth && (
                              <div className="text-sm text-gray-500">
                                DOB: {new Date(patient.dateOfBirth).toLocaleDateString('en-GB')}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm truncate pr-2" title={patient.email || 'N/A'}>
                            {patient.email || 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{patient.phone || 'N/A'}</div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={patient.status === 'active' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {patient.status || 'active'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectPatient(patient);
                            }}
                          >
                            <FaCheck className="h-3 w-3 mr-1" />
                            Select
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Quick Stats */}
          {!loading && hasSearched && filteredPatients.length > 0 && (
            <div className="text-sm text-gray-600 text-center">
              Showing {filteredPatients.length} patient{filteredPatients.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}