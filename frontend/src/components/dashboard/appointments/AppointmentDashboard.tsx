"use client";

import { useState, useMemo } from 'react';
import { DashboardAppointment, AppointmentStatus, AppointmentHistory } from '@/types/appointments';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { format } from 'date-fns';
import { Search, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { AppointmentDeleteDialog } from './appointment-delete-dialog';
import { AppointmentBulkDeleteDialog } from './appointment-bulk-delete-dialog';
import { useToast } from '@/components/ui/use-toast';
import { useAppointmentsQuery, useDeleteAppointmentMutation, useBulkDeleteAppointmentsMutation } from '@/hooks/dashboard/use-appointments-query';

export default function AppointmentDashboard() {
  const [selectedStatus, setSelectedStatus] = useState<AppointmentStatus | 'all'>('all');
  const [selectedAppointment, setSelectedAppointment] = useState<DashboardAppointment | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<DashboardAppointment | null>(null);
  const { toast } = useToast();
  
  // Bulk selection state
  const [selectedAppointments, setSelectedAppointments] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  
  // Sorting state
  const [sortBy, setSortBy] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Use TanStack Query
  const { data: appointments = [], isLoading: loading, error, refetch } = useAppointmentsQuery(selectedStatus);
  const deleteAppointmentMutation = useDeleteAppointmentMutation();
  const bulkDeleteAppointmentsMutation = useBulkDeleteAppointmentsMutation();

  // Filter and sort appointments
  const filteredAppointments = useMemo(() => {
    const filtered = appointments.filter(appointment => {
      const searchLower = searchTerm.toLowerCase();
      return (
        appointment.patientId.toLowerCase().includes(searchLower) ||
        appointment.service.toLowerCase().includes(searchLower) ||
        appointment.status.toLowerCase().includes(searchLower) ||
        (appointment.notes && appointment.notes.toLowerCase().includes(searchLower)) ||
        (appointment.id && appointment.id.toLowerCase().includes(searchLower))
      );
    });
    
    // Sort the filtered appointments
    const sorted = [...filtered].sort((a, b) => {
      let aValue: unknown;
      let bValue: unknown;
      
      switch (sortBy) {
        case 'date':
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
          break;
        case 'time':
          aValue = a.startTime;
          bValue = b.startTime;
          break;
        case 'patient':
          aValue = a.patientId.toLowerCase();
          bValue = b.patientId.toLowerCase();
          break;
        case 'service':
          aValue = a.service.toLowerCase();
          bValue = b.service.toLowerCase();
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        default:
          return 0;
      }
      
      if ((aValue as string) < (bValue as string)) return sortOrder === 'asc' ? -1 : 1;
      if ((aValue as string) > (bValue as string)) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [appointments, searchTerm, sortBy, sortOrder]);

  // Bulk selection logic
  const isAllSelected = filteredAppointments.length > 0 && filteredAppointments.every(a => selectedAppointments.has(a.id));
  const isIndeterminate = filteredAppointments.some(a => selectedAppointments.has(a.id)) && !isAllSelected;

  // Bulk selection handlers
  const handleSelectAppointment = (appointmentId: string, checked: boolean) => {
    setSelectedAppointments(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(appointmentId);
      } else {
        newSet.delete(appointmentId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allDisplayedIds = new Set(filteredAppointments.map(a => a.id));
      setSelectedAppointments(allDisplayedIds);
    } else {
      setSelectedAppointments(new Set());
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };


  const handleStatusChange = async (appointmentId: string, newStatus: AppointmentStatus) => {
    try {
      const response = await fetch(`/api/dashboard/appointments/${appointmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) throw new Error('Failed to update appointment');
      
      refetch();
    } catch {
      toast({
        title: "Error",
        description: "Failed to update appointment status",
        variant: "destructive",
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!appointmentToDelete) return;

    try {
      await deleteAppointmentMutation.mutateAsync(appointmentToDelete.id);
      
      toast({
        title: "Appointment deleted",
        description: "The appointment has been successfully deleted.",
      });
      
      setShowDeleteDialog(false);
      setAppointmentToDelete(null);
      refetch();
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete appointment. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedAppointments.size === 0) return;
    
    try {
      const result = await bulkDeleteAppointmentsMutation.mutateAsync(Array.from(selectedAppointments));
      
      toast({
        title: "Success",
        description: result.message,
      });
      
      setSelectedAppointments(new Set());
      setShowBulkDeleteDialog(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete appointments. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div>
      <header className="mb-6">
        <div>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Appointment Management</h1>
              <p className="text-gray-600">Manage appointments and schedules</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="w-full sm:w-[300px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search appointments..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="w-full sm:w-[180px]">
                <Select
                  value={selectedStatus}
                  onValueChange={(value) => setSelectedStatus(value as AppointmentStatus | 'all')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Appointments</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="rescheduled">Rescheduled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main>
        {selectedAppointments.size > 0 && (
          <div className="mb-4 flex items-center gap-2">
            <Badge variant="secondary" className="text-xs px-2 py-0.5">
              {selectedAppointments.size} appointment{selectedAppointments.size !== 1 ? 's' : ''} selected
            </Badge>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowBulkDeleteDialog(true)}
              className="text-xs h-7 px-2"
            >
              <Trash2 className="w-2.5 h-2.5 mr-1" />
              Delete Selected
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedAppointments(new Set())}
              className="text-xs h-7 px-2"
            >
              Clear Selection
            </Button>
          </div>
        )}
        {error && (
          <Alert variant="destructive" className="mb-6">
            {error instanceof Error ? error.message : 'Failed to load appointments'}
          </Alert>
        )}

        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={handleSelectAll}
                      data-indeterminate={isIndeterminate}
                    />
                  </TableHead>
                  <TableHead className="w-32">
                    <button 
                      onClick={() => handleSort('date')}
                      className="flex items-center hover:text-blue-600 transition-colors"
                    >
                      Date
                      {sortBy === 'date' && (
                        sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="w-24">
                    <button 
                      onClick={() => handleSort('time')}
                      className="flex items-center hover:text-blue-600 transition-colors"
                    >
                      Time
                      {sortBy === 'time' && (
                        sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="w-48">
                    <button 
                      onClick={() => handleSort('patient')}
                      className="flex items-center hover:text-blue-600 transition-colors"
                    >
                      Patient Email
                      {sortBy === 'patient' && (
                        sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="w-36">
                    <button 
                      onClick={() => handleSort('service')}
                      className="flex items-center hover:text-blue-600 transition-colors"
                    >
                      Service
                      {sortBy === 'service' && (
                        sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="w-24 text-center">
                    <button 
                      onClick={() => handleSort('status')}
                      className="flex items-center justify-center hover:text-blue-600 transition-colors w-full"
                    >
                      Status
                      {sortBy === 'status' && (
                        sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="w-24 text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Loading appointments...
                    </TableCell>
                  </TableRow>
                ) : filteredAppointments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      No appointments found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAppointments.map((appointment) => (
                    <TableRow key={appointment.id} className="hover:bg-gray-50">
                      <TableCell>
                        <Checkbox
                          checked={selectedAppointments.has(appointment.id)}
                          onCheckedChange={(checked) => handleSelectAppointment(appointment.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {appointment.date && !isNaN(new Date(appointment.date).getTime())
                          ? format(new Date(appointment.date), 'dd MMM yyyy')
                          : 'Invalid date'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {appointment.startTime} - {appointment.endTime}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{appointment.patientId}</div>
                          {appointment.notes && appointment.notes.includes('Health Concerns:') && (
                            <div className="text-xs text-gray-500 mt-1">
                              {appointment.notes.split('\n')[0].replace('Health Concerns: ', '')}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{appointment.service}</TableCell>
                      <TableCell className="text-center">
                        <Select
                          value={appointment.status}
                          onValueChange={(value) => handleStatusChange(appointment.id, value as AppointmentStatus)}
                        >
                          <SelectTrigger className="w-[110px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="scheduled">Scheduled</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                            <SelectItem value="rescheduled">Rescheduled</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center space-x-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedAppointment(appointment);
                              setShowDetails(true);
                            }}
                          >
                            View
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setAppointmentToDelete(appointment);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">Date & Time</h3>
                <p>
                  {selectedAppointment.date && !isNaN(new Date(selectedAppointment.date).getTime())
                    ? format(new Date(selectedAppointment.date), 'dd MMM yyyy')
                    : 'Invalid date'} at{' '}
                  {selectedAppointment.startTime} - {selectedAppointment.endTime}
                </p>
              </div>
              <div>
                <h3 className="font-semibold">Patient</h3>
                <p>{selectedAppointment.patientId}</p>
              </div>
              <div>
                <h3 className="font-semibold">Service</h3>
                <p>{selectedAppointment.service}</p>
              </div>
              <div>
                <h3 className="font-semibold">Status</h3>
                <p>{selectedAppointment.status}</p>
              </div>
              {selectedAppointment.notes && (
                <div>
                  <h3 className="font-semibold">Notes</h3>
                  <p>{selectedAppointment.notes}</p>
                </div>
              )}
              <div>
                <h3 className="font-semibold">History</h3>
                <div className="space-y-2">
                  {selectedAppointment.history.map((entry: AppointmentHistory) => (
                    <div key={entry.id} className="text-sm">
                      <p>
                        {entry.changedAt && !isNaN(new Date(entry.changedAt).getTime()) 
                          ? format(new Date(entry.changedAt), 'MMM dd, yyyy HH:mm') 
                          : 'Unknown date'} -{' '}
                        {entry.status} by {entry.changedBy}
                      </p>
                      {entry.notes && <p className="text-gray-500">{entry.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

        <AppointmentDeleteDialog
          appointment={appointmentToDelete}
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          onConfirm={handleDeleteConfirm}
          loading={deleteAppointmentMutation.isPending}
        />
        
        <AppointmentBulkDeleteDialog
          open={showBulkDeleteDialog}
          onOpenChange={setShowBulkDeleteDialog}
          onConfirm={handleBulkDelete}
          selectedCount={selectedAppointments.size}
          loading={bulkDeleteAppointmentsMutation.isPending}
        />
      </main>
    </div>
  );
} 