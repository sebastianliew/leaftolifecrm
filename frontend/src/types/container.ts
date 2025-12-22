export interface ContainerType {
  id: string
  name: string
  description: string
  allowedUoms: string[] // Array of allowed UOMs for this container type
  isActive: boolean
  createdAt: Date
  updatedAt: Date
} 