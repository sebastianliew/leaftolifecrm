"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FiClock, FiAlertCircle, FiEye, FiShoppingCart, FiLoader } from 'react-icons/fi';
import type { Prescription, PrescriptionVersion } from '@/types/prescription';
import { PrescriptionVersionManager } from '@/lib/prescription-versioning';

interface PrescriptionSelectorProps {
  open: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  onSelectPrescription: (prescriptionId: string, selectedRemedies?: string[], modifications?: Record<string, {
    quantity: number;
    notes: string;
    reason: string;
  }>) => Promise<void>;
  loading?: boolean;
}

// Using PrescriptionVersion from @/types/prescription instead

interface RemedySelection {
  remedyId: string;
  selected: boolean;
  quantity?: number;
  notes?: string;
}

export default function PrescriptionSelector({
  open,
  onClose,
  patientId,
  patientName,
  onSelectPrescription,
  loading = false
}: PrescriptionSelectorProps) {
  const [prescriptionVersions, setPrescriptionVersions] = useState<PrescriptionVersion[]>([]);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [remedySelections, setRemedySelections] = useState<Record<string, RemedySelection>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRemedyDetails, setShowRemedyDetails] = useState(false);

  const loadPrescriptionVersions = useCallback(() => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Get all prescription versions for this patient
      const versions = PrescriptionVersionManager.getAllVersions(patientId);
      
      if (versions.length === 0) {
        setError('No prescriptions found for this patient');
        setPrescriptionVersions([]);
        return;
      }

      // Sort by date (newest first)
      const sortedVersions = versions.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setPrescriptionVersions(sortedVersions);
    } catch {
      setError('Failed to load prescriptions');
      setPrescriptionVersions([]);
    } finally {
      setIsLoading(false);
    }
  }, [patientId]);

  // Load prescription versions when modal opens
  useEffect(() => {
    if (open && patientId) {
      loadPrescriptionVersions();
    }
  }, [open, patientId, loadPrescriptionVersions]);

  const handleSelectPrescription = (prescription: Prescription) => {
    setSelectedPrescription(prescription);
    setShowRemedyDetails(true);
    
    // Initialize remedy selections
    const selections: Record<string, RemedySelection> = {};
    
    // Extract all remedies from the prescription
    const meals = ['breakfast', 'lunch', 'dinner'] as const;
    const timings = ['before', 'during', 'after'] as const;
    
    meals.forEach(meal => {
      timings.forEach(timing => {
        const remedies = prescription.dailySchedule[meal][timing];
        remedies.forEach(remedy => {
          if (remedy.name.trim()) {
            selections[remedy.id] = {
              remedyId: remedy.id,
              selected: true, // Default to selected
              quantity: 1, // Default quantity
              notes: ''
            };
          }
        });
      });
    });
    
    setRemedySelections(selections);
  };

  const handleToggleRemedy = (remedyId: string, selected: boolean) => {
    setRemedySelections(prev => ({
      ...prev,
      [remedyId]: {
        ...prev[remedyId],
        selected
      }
    }));
  };

  const handleQuantityChange = (remedyId: string, quantity: number) => {
    setRemedySelections(prev => ({
      ...prev,
      [remedyId]: {
        ...prev[remedyId],
        quantity: Math.max(1, quantity)
      }
    }));
  };

  const handleNotesChange = (remedyId: string, notes: string) => {
    setRemedySelections(prev => ({
      ...prev,
      [remedyId]: {
        ...prev[remedyId],
        notes
      }
    }));
  };

  const handleCreateTransaction = async () => {
    if (!selectedPrescription) return;

    try {
      // Get selected remedies
      const selectedRemedyIds = Object.entries(remedySelections)
        .filter(([_, selection]) => selection.selected)
        .map(([remedyId, _]) => remedyId);

      if (selectedRemedyIds.length === 0) {
        setError('Please select at least one remedy');
        return;
      }

      // Prepare modifications
      const modifications: Record<string, {
        quantity: number;
        notes: string;
        reason: string;
      }> = {};
      Object.entries(remedySelections).forEach(([remedyId, selection]) => {
        if (selection.selected && (selection.quantity !== 1 || selection.notes)) {
          modifications[remedyId] = {
            quantity: selection.quantity || 1,
            notes: selection.notes || '',
            reason: 'User adjustment during transaction creation'
          };
        }
      });

      await onSelectPrescription(selectedPrescription.id, selectedRemedyIds, modifications);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create transaction');
    }
  };

  const filteredVersions = prescriptionVersions.filter(version => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    const prescription = version.prescription;
    
    // Search in prescription date, status, or remedy names
    if (prescription.date.toLowerCase().includes(searchLower)) return true;
    if (prescription.status.toLowerCase().includes(searchLower)) return true;
    
    // Search in remedy names
    const meals = ['breakfast', 'lunch', 'dinner'] as const;
    const timings = ['before', 'during', 'after'] as const;
    
    for (const meal of meals) {
      for (const timing of timings) {
        const remedies = prescription.dailySchedule[meal][timing];
        for (const remedy of remedies) {
          if (remedy.name.toLowerCase().includes(searchLower)) {
            return true;
          }
        }
      }
    }
    
    return false;
  });

  const getRemediesList = (prescription: Prescription) => {
    const remedies: Array<{ timing: string; name: string; [key: string]: unknown }> = [];
    const meals = ['breakfast', 'lunch', 'dinner'] as const;
    const timings = ['before', 'during', 'after'] as const;
    
    meals.forEach(meal => {
      timings.forEach(timing => {
        const mealRemedies = prescription.dailySchedule[meal][timing];
        mealRemedies.forEach(remedy => {
          if (remedy.name.trim()) {
            remedies.push({
              ...remedy,
              timing: `${meal} ${timing}`
            });
          }
        });
      });
    });
    
    return remedies;
  };

  const getSelectedCount = () => {
    return Object.values(remedySelections).filter(s => s.selected).length;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FiClock className="h-5 w-5 text-purple-600" />
            Copy from Prescription - {patientName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {!showRemedyDetails ? (
            <>
              {/* Search and Filter */}
              <div className="space-y-4">
                <div className="relative">
                  <Input
                    placeholder="Search prescriptions by date, status, or remedy name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-4"
                  />
                </div>
              </div>

              {/* Loading State */}
              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <FiLoader className="animate-spin w-6 h-6 text-blue-500 mr-2" />
                  <span>Loading prescriptions...</span>
                </div>
              )}

              {/* Error State */}
              {error && !isLoading && (
                <Alert>
                  <FiAlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Prescription List */}
              {!isLoading && !error && (
                <div className="space-y-4">
                  {filteredVersions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <FiClock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No prescriptions found matching your search</p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {filteredVersions.map((version) => {
                        const remedies = getRemediesList(version.prescription);
                        
                        return (
                          <Card 
                            key={version.id} 
                            className="cursor-pointer hover:bg-gray-50 transition-colors border-2 hover:border-purple-200"
                            onClick={() => handleSelectPrescription(version.prescription)}
                          >
                            <CardHeader className="pb-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <CardTitle className="text-lg">{version.prescription.date}</CardTitle>
                                  <CardDescription>
                                    Version {version.version} • {remedies.length} remedies
                                  </CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge 
                                    className={
                                      version.prescription.status === 'active' ? 'bg-green-100 text-green-800' :
                                      version.prescription.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                                      version.prescription.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                                      'bg-red-100 text-red-800'
                                    }
                                  >
                                    {version.prescription.status}
                                  </Badge>
                                  <Button variant="ghost" size="sm">
                                    <FiEye className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-gray-600">Remedies:</Label>
                                <div className="flex flex-wrap gap-1">
                                  {remedies.slice(0, 5).map((remedy, index) => (
                                    <Badge key={index} variant="outline" className="text-xs">
                                      {remedy.name}
                                    </Badge>
                                  ))}
                                  {remedies.length > 5 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{remedies.length - 5} more
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Remedy Selection Details */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Select Remedies</h3>
                    <p className="text-sm text-gray-600">
                      From prescription: {selectedPrescription?.date} • {getSelectedCount()} selected
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => setShowRemedyDetails(false)}>
                    ← Back to Prescriptions
                  </Button>
                </div>

                {selectedPrescription && (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">Select</TableHead>
                          <TableHead>Remedy</TableHead>
                          <TableHead>Timing</TableHead>
                          <TableHead>Dosage</TableHead>
                          <TableHead>Instructions</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getRemediesList(selectedPrescription).map((remedy) => {
                          const selection = remedySelections[String(remedy.id)];
                          
                          return (
                            <TableRow key={String(remedy.id)}>
                              <TableCell>
                                <Checkbox
                                  checked={selection?.selected || false}
                                  onCheckedChange={(checked) => 
                                    handleToggleRemedy(String(remedy.id), checked as boolean)
                                  }
                                />
                              </TableCell>
                              <TableCell className="font-medium">{remedy.name}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {remedy.timing}
                                </Badge>
                              </TableCell>
                              <TableCell>{String(remedy.dosage || '')}</TableCell>
                              <TableCell className="max-w-xs">
                                <div className="truncate" title={String(remedy.instructions || '')}>
                                  {String(remedy.instructions || '')}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="1"
                                  value={selection?.quantity || 1}
                                  onChange={(e) => 
                                    handleQuantityChange(String(remedy.id), parseInt(e.target.value) || 1)
                                  }
                                  className="w-20"
                                  disabled={!selection?.selected}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  placeholder="Optional notes..."
                                  value={selection?.notes || ''}
                                  onChange={(e) => handleNotesChange(String(remedy.id), e.target.value)}
                                  className="w-32"
                                  disabled={!selection?.selected}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {error && (
                  <Alert>
                    <FiAlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateTransaction}
                    disabled={loading || getSelectedCount() === 0}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {loading ? (
                      <>
                        <FiLoader className="animate-spin w-4 h-4 mr-2" />
                        Creating Transaction...
                      </>
                    ) : (
                      <>
                        <FiShoppingCart className="w-4 h-4 mr-2" />
                        Add {getSelectedCount()} Remedies to Transaction
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}