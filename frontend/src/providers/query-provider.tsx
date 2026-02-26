"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { toast } from "sonner";


export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error, query) => {
            // Skip rate limit errors (already handled by api-client with custom toast)
            const errorMessage = error instanceof Error ? error.message : '';
            if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('too many')) {
              return;
            }
            // Only show error toast for user-facing queries
            if (query.meta?.showErrorToast !== false) {
              toast.error(
                `Error: ${error instanceof Error ? error.message : "Something went wrong"}`
              );
            }
          },
        }),
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            // Skip rate limit errors (already handled by api-client with custom toast)
            const errorMessage = error instanceof Error ? error.message : '';
            if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('too many')) {
              return;
            }
            // Only show error toast for user-facing mutations
            if (mutation.meta?.showErrorToast !== false) {
              toast.error(
                `Error: ${error instanceof Error ? error.message : "Failed to save changes"}`
              );
            }
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 0,  // No caching — internal clinic software
            gcTime: 0,
            retry: 1,
            refetchOnWindowFocus: true, // Always fresh — internal clinic software
          },
          mutations: {
            retry: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}