"use client";

import { useEffect } from 'react';
import { permissionErrorHandler, type PermissionError } from '@/lib/permission-error-handler';
import { useToast } from '@/components/ui/toast';

interface PermissionErrorProviderProps {
  children: React.ReactNode;
}

export function PermissionErrorProvider({ children }: PermissionErrorProviderProps) {
  const { toast, ToastContainer } = useToast();

  useEffect(() => {
    const unsubscribe = permissionErrorHandler.subscribe((error: PermissionError) => {
      const actionText = getActionText(error.action);
      const description = `You don't have permission to ${actionText} ${error.resource}.`;

      toast({
        title: 'Access Denied',
        description,
        variant: 'destructive',
      });
    });

    return () => {
      unsubscribe();
    };
  }, [toast]);

  return (
    <>
      {children}
      <ToastContainer />
    </>
  );
}

/**
 * Convert action to human-readable text
 */
function getActionText(action?: string): string {
  if (!action) return 'access';

  const actionMap: Record<string, string> = {
    view: 'view',
    create: 'create',
    add: 'add',
    update: 'update',
    edit: 'edit',
    delete: 'delete',
    process: 'process',
    download: 'download',
    access: 'access',
  };

  return actionMap[action.toLowerCase()] || action;
}

// Export a hook for manual permission error triggering
export function usePermissionError() {
  const { toast } = useToast();

  const showPermissionError = (resource: string, action: string = 'access') => {
    const actionText = getActionText(action);
    toast({
      title: 'Access Denied',
      description: `You don't have permission to ${actionText} ${resource}.`,
      variant: 'destructive',
    });
  };

  return { showPermissionError };
}
