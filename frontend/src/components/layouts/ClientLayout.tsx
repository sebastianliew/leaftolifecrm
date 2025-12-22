"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { QueryProvider } from "@/providers/query-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { PermissionErrorProvider } from "@/providers/PermissionErrorProvider";
import { Toaster } from "@/components/ui/toaster";

// Dynamically import RoleAwareNavigation
const DynamicRoleAwareNavigation = dynamic(() => import("@/components/layout/RoleAwareNavigation").then(mod => ({ default: mod.RoleAwareNavigation })), {
  ssr: false,
  loading: () => <div className="w-20 h-screen fixed left-0 top-0 bg-background border-r" />
});

// Dynamically import RootSessionIndicator
const DynamicRootSessionIndicator = dynamic(() => import("@/components/RootSessionIndicator").then(mod => ({ default: mod.RootSessionIndicator })), {
  ssr: false
});

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const isPublicRoute = pathname === '/appointments' || pathname === '/login' || pathname === '/' || pathname?.startsWith('/auth');
  
  // Show navigation for all routes except public ones
  const showNavigation = !isPublicRoute;

  return (
    <QueryProvider>
      <AuthProvider>
        <PermissionErrorProvider>
          <div className="font-open bg-gray-100 min-h-screen">
            {showNavigation && mounted && <DynamicRoleAwareNavigation />}
            {mounted && <DynamicRootSessionIndicator />}
            <div className={showNavigation ? "lg:pl-20 transition-all duration-350 ease-in-out" : ""}>
              <main className="p-4 md:p-6 lg:p-8">
                {children}
              </main>
            </div>
          </div>
          <Toaster />
        </PermissionErrorProvider>
      </AuthProvider>
    </QueryProvider>
  );
} 