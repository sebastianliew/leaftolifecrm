'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription
} from '@/components/ui/sheet';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  Users,
  Settings,
  Shield,
  UserCheck,
  UserX,
  Download,
  Trash2,
  CheckCircle,
  Clock,
  RefreshCw,
  Play,
  X
} from 'lucide-react';

interface User {
  _id: string;
  username: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  lastLogin?: string;
  featurePermissions?: Record<string, unknown>;
}

interface RoleTemplate {
  name: string;
  displayName: string;
  description: string;
  permissions: Record<string, unknown>;
}

interface BulkOperation {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  userIds: string[];
  parameters: Record<string, unknown>;
  createdAt: string;
  completedAt?: string;
  results?: {
    success: number;
    failed: number;
    errors: string[];
  };
}

interface BulkUserOperationsProps {
  selectedUsers: string[];
  users: User[];
  onUsersUpdated: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function BulkUserOperations({ 
  selectedUsers, 
  users, 
  onUsersUpdated, 
  isOpen, 
  onClose 
}: BulkUserOperationsProps) {
  const [templates, setTemplates] = useState<RoleTemplate[]>([]);
  const [operations, setOperations] = useState<BulkOperation[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('permissions');
  const [operationInProgress, setOperationInProgress] = useState<string | null>(null);

  // Form states for different operations
  const [permissionChanges, setPermissionChanges] = useState<Record<string, unknown>>({});
  const [roleChange, setRoleChange] = useState('');
  const [statusChange, setStatusChange] = useState<'activate' | 'deactivate' | ''>('');
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState('');
  const [exportOptions, setExportOptions] = useState({
    format: 'csv',
    includePermissions: true,
    includeAuditLogs: false
  });

  // Fetch templates and operations
  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      fetchOperations();
    }
  }, [isOpen]);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/admin/permissions/templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  };

  const fetchOperations = async () => {
    try {
      const response = await fetch('/api/admin/bulk-operations');
      if (response.ok) {
        const data = await response.json();
        setOperations(data.operations);
      }
    } catch (error) {
      console.error('Failed to fetch operations:', error);
    }
  };

  // Execute bulk operation
  const executeBulkOperation = async (operationType: string, parameters: Record<string, unknown>) => {
    if (selectedUsers.length === 0) {
      toast({
        title: 'No users selected',
        description: 'Please select users to perform bulk operations',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);
      setOperationInProgress(operationType);

      const response = await fetch('/api/admin/bulk-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: operationType,
          userIds: selectedUsers,
          parameters
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: 'Success',
          description: `Bulk operation started. ${result.operation.id}`
        });
        fetchOperations();
        onUsersUpdated();
      } else {
        const error = await response.json();
        throw new Error(error.error?.message || 'Operation failed');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Operation failed',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setOperationInProgress(null);
    }
  };

  // Apply role template
  const applyRoleTemplate = async (templateName: string) => {
    await executeBulkOperation('APPLY_ROLE_TEMPLATE', { templateName });
  };

  // Update permissions
  const updatePermissions = async () => {
    if (Object.keys(permissionChanges).length === 0) {
      toast({
        title: 'No changes',
        description: 'Please make some permission changes first',
        variant: 'destructive'
      });
      return;
    }

    await executeBulkOperation('UPDATE_PERMISSIONS', { permissions: permissionChanges });
  };

  // Change user roles
  const changeUserRoles = async () => {
    if (!roleChange) {
      toast({
        title: 'No role selected',
        description: 'Please select a role to assign',
        variant: 'destructive'
      });
      return;
    }

    await executeBulkOperation('CHANGE_ROLE', { newRole: roleChange });
  };

  // Change user status
  const changeUserStatus = async () => {
    if (!statusChange) {
      toast({
        title: 'No status selected',
        description: 'Please select an action',
        variant: 'destructive'
      });
      return;
    }

    await executeBulkOperation('CHANGE_STATUS', { 
      action: statusChange,
      isActive: statusChange === 'activate'
    });
  };

  // Delete users
  const deleteUsers = async () => {
    if (bulkDeleteConfirm !== 'DELETE') {
      toast({
        title: 'Confirmation required',
        description: 'Please type DELETE to confirm',
        variant: 'destructive'
      });
      return;
    }

    await executeBulkOperation('DELETE_USERS', {});
    setBulkDeleteConfirm('');
  };

  // Export users
  const exportUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        userIds: selectedUsers.join(','),
        format: exportOptions.format,
        includePermissions: exportOptions.includePermissions.toString(),
        includeAuditLogs: exportOptions.includeAuditLogs.toString()
      });

      const response = await fetch(`/api/admin/users/export?${params}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `users-export-${new Date().toISOString().split('T')[0]}.${exportOptions.format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: 'Success',
          description: 'Users exported successfully'
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to export users',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Update permission
  const updatePermission = (category: string, permission: string, value: boolean | number) => {
    setPermissionChanges(prev => ({
      ...prev,
      [category]: {
        ...(prev[category] || {}),
        [permission]: value
      }
    }));
  };

  // Get operation status badge
  const getOperationStatusBadge = (status: string) => {
    const config = {
      pending: { variant: 'outline' as const, icon: Clock, color: 'text-gray-600' },
      running: { variant: 'secondary' as const, icon: Play, color: 'text-blue-600' },
      completed: { variant: 'outline' as const, icon: CheckCircle, color: 'text-green-600' },
      failed: { variant: 'destructive' as const, icon: X, color: 'text-red-600' }
    };

    const { variant, icon: Icon, color } = config[status as keyof typeof config] || config.pending;

    return (
      <Badge variant={variant} className={color}>
        <Icon className="h-3 w-3 mr-1" />
        {status.toUpperCase()}
      </Badge>
    );
  };

  // Get selected users info
  const selectedUsersInfo = users.filter(user => selectedUsers.includes(user._id));

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[800px] sm:w-[800px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bulk User Operations
          </SheetTitle>
          <SheetDescription>
            Perform operations on {selectedUsers.length} selected user{selectedUsers.length !== 1 ? 's' : ''}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Selected Users Preview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Selected Users ({selectedUsers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-32 overflow-y-auto">
                <div className="grid grid-cols-2 gap-2">
                  {selectedUsersInfo.slice(0, 20).map(user => (
                    <div key={user._id} className="text-xs flex items-center gap-2">
                      <Badge variant="outline" className="text-xs capitalize">
                        {user.role}
                      </Badge>
                      {user.fullName}
                    </div>
                  ))}
                  {selectedUsers.length > 20 && (
                    <div className="text-xs text-gray-500 col-span-2">
                      ... and {selectedUsers.length - 20} more users
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Operation Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="permissions">Permissions</TabsTrigger>
              <TabsTrigger value="roles">Roles</TabsTrigger>
              <TabsTrigger value="status">Status</TabsTrigger>
              <TabsTrigger value="export">Export</TabsTrigger>
              <TabsTrigger value="operations">Operations</TabsTrigger>
            </TabsList>

            {/* Permission Operations */}
            <TabsContent value="permissions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Apply Role Template</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Select Template</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {templates.map(template => (
                        <Button
                          key={template.name}
                          variant="outline"
                          size="sm"
                          onClick={() => applyRoleTemplate(template.name)}
                          disabled={loading || operationInProgress === 'APPLY_ROLE_TEMPLATE'}
                        >
                          <Shield className="h-3 w-3 mr-1" />
                          {template.displayName}
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    onClick={() => executeBulkOperation('RESET_TO_ROLE_DEFAULTS', {})}
                    disabled={loading}
                    className="w-full"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reset to Role Defaults
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Custom Permission Changes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium">Discount Permissions</Label>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Apply Discounts</Label>
                          <Switch
                            checked={Boolean((permissionChanges.discounts as Record<string, boolean | number>)?.canApplyProductDiscounts || false)}
                            onCheckedChange={(checked) => updatePermission('discounts', 'canApplyProductDiscounts', checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Bill Discounts</Label>
                          <Switch
                            checked={Boolean((permissionChanges.discounts as Record<string, boolean | number>)?.canApplyBillDiscounts || false)}
                            onCheckedChange={(checked) => updatePermission('discounts', 'canApplyBillDiscounts', checked)}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                          <Label className="text-xs">Max Discount %</Label>
                          <Input
                            type="number"
                            size={40}
                            placeholder="0"
                            value={(() => {
                              const value = (permissionChanges.discounts as Record<string, boolean | number>)?.maxDiscountPercent;
                              return typeof value === 'number' ? value.toString() : '';
                            })()}
                            onChange={(e) => updatePermission('discounts', 'maxDiscountPercent', parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Max Amount S$</Label>
                          <Input
                            type="number"
                            size={40}
                            placeholder="0"
                            value={(() => {
                              const value = (permissionChanges.discounts as Record<string, boolean | number>)?.maxDiscountAmount;
                              return typeof value === 'number' ? value.toString() : '';
                            })()}
                            onChange={(e) => updatePermission('discounts', 'maxDiscountAmount', parseInt(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Inventory Permissions</Label>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {[
                          { key: 'canAddProducts', label: 'Add Products' },
                          { key: 'canEditProducts', label: 'Edit Products' },
                          { key: 'canDeleteProducts', label: 'Delete Products' },
                          { key: 'canManageStock', label: 'Manage Stock' }
                        ].map(({ key, label }) => (
                          <div key={key} className="flex items-center justify-between">
                            <Label className="text-xs">{label}</Label>
                            <Switch
                              checked={Boolean((permissionChanges.inventory as Record<string, boolean | number>)?.[key] || false)}
                              onCheckedChange={(checked) => updatePermission('inventory', key, checked)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={updatePermissions}
                    disabled={loading || Object.keys(permissionChanges).length === 0}
                    className="w-full"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Apply Permission Changes
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Role Operations */}
            <TabsContent value="roles" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Change User Roles</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>New Role</Label>
                    <Select value={roleChange} onValueChange={setRoleChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        disabled={!roleChange || loading}
                        className="w-full"
                      >
                        <UserCheck className="h-4 w-4 mr-2" />
                        Change Role to {roleChange || '...'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Role Change</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to change the role of {selectedUsers.length} user(s) to {roleChange}? 
                          This will reset their permissions to the role defaults.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={changeUserRoles}>
                          Change Roles
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Status Operations */}
            <TabsContent value="status" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">User Status Management</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Action</Label>
                    <Select value={statusChange} onValueChange={(value) => setStatusChange(value as 'activate' | 'deactivate' | '')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select action" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="activate">Activate Users</SelectItem>
                        <SelectItem value="deactivate">Deactivate Users</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={changeUserStatus}
                    disabled={!statusChange || loading}
                    className="w-full"
                    variant={statusChange === 'activate' ? 'default' : 'destructive'}
                  >
                    {statusChange === 'activate' ? (
                      <UserCheck className="h-4 w-4 mr-2" />
                    ) : (
                      <UserX className="h-4 w-4 mr-2" />
                    )}
                    {statusChange === 'activate' ? 'Activate' : 'Deactivate'} Users
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-red-600">Danger Zone</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Delete Users</Label>
                    <Input
                      placeholder="Type DELETE to confirm"
                      value={bulkDeleteConfirm}
                      onChange={(e) => setBulkDeleteConfirm(e.target.value)}
                    />
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        disabled={bulkDeleteConfirm !== 'DELETE' || loading}
                        className="w-full"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete {selectedUsers.length} User(s)
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirm User Deletion</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete {selectedUsers.length} user(s) 
                          and remove all their data from the system.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={deleteUsers} className="bg-red-600">
                          Delete Users
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Export Operations */}
            <TabsContent value="export" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Export Selected Users</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Export Format</Label>
                    <Select 
                      value={exportOptions.format} 
                      onValueChange={(value) => setExportOptions(prev => ({ ...prev, format: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="csv">CSV</SelectItem>
                        <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Include Data</Label>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="includePermissions"
                        checked={exportOptions.includePermissions}
                        onCheckedChange={(checked) => 
                          setExportOptions(prev => ({ ...prev, includePermissions: checked as boolean }))
                        }
                      />
                      <Label htmlFor="includePermissions" className="text-sm">Include Permissions</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="includeAuditLogs"
                        checked={exportOptions.includeAuditLogs}
                        onCheckedChange={(checked) => 
                          setExportOptions(prev => ({ ...prev, includeAuditLogs: checked as boolean }))
                        }
                      />
                      <Label htmlFor="includeAuditLogs" className="text-sm">Include Recent Audit Logs</Label>
                    </div>
                  </div>

                  <Button
                    onClick={exportUsers}
                    disabled={loading}
                    className="w-full"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export {selectedUsers.length} User(s)
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Operations History */}
            <TabsContent value="operations" className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Recent Operations</CardTitle>
                  <Button variant="outline" size="sm" onClick={fetchOperations}>
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Refresh
                  </Button>
                </CardHeader>
                <CardContent>
                  {operations.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No bulk operations yet
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {operations.slice(0, 10).map(operation => (
                        <div key={operation.id} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {operation.type.replace(/_/g, ' ')}
                              </span>
                              {getOperationStatusBadge(operation.status)}
                            </div>
                            <span className="text-xs text-gray-500">
                              {new Date(operation.createdAt).toLocaleString('en-GB')}
                            </span>
                          </div>
                          
                          <div className="text-xs text-gray-600">
                            Users: {operation.userIds.length}
                            {operation.results && (
                              <span className="ml-4">
                                Success: {operation.results.success}, 
                                Failed: {operation.results.failed}
                              </span>
                            )}
                          </div>

                          {operation.results?.errors && operation.results.errors.length > 0 && (
                            <div className="mt-2 text-xs text-red-600">
                              Errors: {operation.results.errors.slice(0, 2).join(', ')}
                              {operation.results.errors.length > 2 && '...'}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}