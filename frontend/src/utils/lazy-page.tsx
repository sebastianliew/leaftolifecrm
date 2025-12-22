import dynamic from 'next/dynamic'
import PageLoading from '@/components/ui/page-loading'

/**
 * Create a lazy-loaded page component with loading fallback
 * @param importFn Function that imports the page component
 * @returns Lazy-loaded component
 */
export function createLazyPage<T = Record<string, unknown>>(
  importFn: () => Promise<{ default: React.ComponentType<T> }>
) {
  return dynamic(importFn, {
    loading: () => <PageLoading />,
    ssr: true // Enable server-side rendering
  })
}