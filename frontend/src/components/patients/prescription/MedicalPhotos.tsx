"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FiUpload, FiX, FiMaximize2, FiLoader } from 'react-icons/fi'
import { format } from 'date-fns'
import Image from 'next/image'
import { useToast } from '@/components/ui/use-toast'

export interface MedicalPhoto {
  id: string
  url: string
  name: string
  uploadedAt: string
}

interface MedicalPhotosProps {
  photos: MedicalPhoto[]
  editMode: boolean
  readOnly: boolean
  patientId: string
  onPhotoAdd: (photo: MedicalPhoto) => void
  onPhotoDelete: (photoId: string) => void
}

export function MedicalPhotos({
  photos,
  editMode,
  readOnly,
  patientId,
  onPhotoAdd,
  onPhotoDelete
}: MedicalPhotosProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const { toast } = useToast()

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        
        const response = await fetch(`/api/patients/${patientId}/photos`, {
          method: 'POST',
          body: formData
        })
        
        if (!response.ok) {
          throw new Error('Failed to upload photo')
        }
        
        const data = await response.json()
        onPhotoAdd(data.photo)
      }
      
      toast({
        title: 'Success',
        description: `${files.length} photo(s) uploaded successfully`
      })
    } catch (error) {
      console.error('Error uploading photos:', error)
      toast({
        title: 'Error',
        description: 'Failed to upload photos',
        variant: 'destructive'
      })
    } finally {
      setUploading(false)
      // Reset input
      e.target.value = ''
    }
  }
  
  const handleDeletePhoto = async (photoId: string) => {
    setDeleting(photoId)
    
    try {
      const response = await fetch(`/api/patients/${patientId}/photos?photoId=${encodeURIComponent(photoId)}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete photo')
      }
      
      onPhotoDelete(photoId)
      
      toast({
        title: 'Success',
        description: 'Photo deleted successfully'
      })
    } catch (error) {
      console.error('Error deleting photo:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete photo',
        variant: 'destructive'
      })
    } finally {
      setDeleting(null)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Medical Photos</CardTitle>
            {editMode && !readOnly && (
              <div>
                <input
                  type="file"
                  id="photo-upload"
                  className="hidden"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
                <label
                  htmlFor="photo-upload"
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <FiLoader className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <FiUpload className="h-4 w-4 mr-2" />
                      Upload Photos
                    </>
                  )}
                </label>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {photos.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {photos.map((photo) => (
                <div key={photo.id} className="relative group">
                  <div 
                    className="aspect-square rounded-lg overflow-hidden cursor-pointer border-2 border-gray-200 hover:border-blue-500 transition-colors"
                    onClick={() => setSelectedPhoto(photo.url)}
                  >
                    <Image
                      src={photo.url}
                      alt={photo.name}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity flex items-center justify-center">
                      <FiMaximize2 className="text-white opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6" />
                    </div>
                  </div>
                  {editMode && !readOnly && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeletePhoto(photo.id)
                      }}
                      disabled={deleting === photo.id}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 disabled:opacity-50"
                    >
                      {deleting === photo.id ? (
                        <FiLoader className="h-4 w-4 animate-spin" />
                      ) : (
                        <FiX className="h-4 w-4" />
                      )}
                    </button>
                  )}
                  <p className="mt-2 text-xs text-gray-600 truncate">{photo.name}</p>
                  <p className="text-xs text-gray-500">{format(new Date(photo.uploadedAt), 'dd/MM/yyyy')}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">No medical photos uploaded yet</p>
              {editMode && !readOnly && (
                <p className="text-sm text-gray-400 mt-2">Click &quot;Upload Photos&quot; to add medical images</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Photo Viewer Modal */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-7xl max-h-full">
            <Image
              src={selectedPhoto}
              alt="Medical photo"
              width={1200}
              height={800}
              className="max-w-full max-h-[90vh] object-contain"
              style={{ width: 'auto', height: 'auto' }}
            />
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 p-2 bg-white text-black rounded-full hover:bg-gray-200"
            >
              <FiX className="h-6 w-6" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}