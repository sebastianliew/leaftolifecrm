import { ImSpinner8 } from 'react-icons/im'

export default function PageLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <ImSpinner8 className="h-12 w-12 animate-spin mx-auto mb-4 text-gray-600" />
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  )
}