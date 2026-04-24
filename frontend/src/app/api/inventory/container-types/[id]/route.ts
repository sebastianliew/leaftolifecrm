import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { ContainerType, IContainerType } from '@/models/ContainerType'

// GET /api/inventory/container-types/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const { id } = await params

    const ct = await ContainerType.findById(id).lean() as IContainerType | null

    if (!ct) {
      return NextResponse.json(
        { error: 'Container type not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      id: ct._id.toString(),
      name: ct.name,
      description: ct.description,
      allowedUomTypes: ct.allowedUomTypes ?? [],
      isActive: ct.isActive !== false,
      createdAt: ct.createdAt || new Date(),
      updatedAt: ct.updatedAt || new Date()
    })

  } catch (error: unknown) {
    console.error('Get Container Type API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch container type', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PUT /api/inventory/container-types/[id]
export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const { id } = await params

    const body = await _request.json()
    const { name, description, allowedUomTypes, isActive } = body

    const existing = await ContainerType.findById(id)
    if (!existing) {
      return NextResponse.json(
        { error: 'Container type not found' },
        { status: 404 }
      )
    }

    if (name && name !== existing.name) {
      const nameConflict = await ContainerType.findOne({
        name,
        isActive: true,
        _id: { $ne: id }
      })
      if (nameConflict) {
        return NextResponse.json(
          { error: 'Container type with this name already exists' },
          { status: 400 }
        )
      }
    }

    if (allowedUomTypes !== undefined && (!Array.isArray(allowedUomTypes) || allowedUomTypes.length === 0)) {
      return NextResponse.json(
        { error: 'At least one allowed unit of measurement type is required' },
        { status: 400 }
      )
    }

    const updated = await ContainerType.findByIdAndUpdate(
      id,
      {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
        ...(allowedUomTypes !== undefined && { allowedUomTypes }),
        updatedAt: new Date()
      },
      { new: true, lean: true }
    ) as IContainerType | null

    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update container type' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      id: updated._id.toString(),
      name: updated.name,
      description: updated.description,
      allowedUomTypes: updated.allowedUomTypes ?? [],
      isActive: updated.isActive !== false,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    })

  } catch (error: unknown) {
    console.error('Update Container Type API Error:', error)
    return NextResponse.json(
      { error: 'Failed to update container type', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE /api/inventory/container-types/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const { id } = await params

    const ct = await ContainerType.findById(id)
    if (!ct) {
      return NextResponse.json(
        { error: 'Container type not found' },
        { status: 404 }
      )
    }

    const { Product } = await import('@/models/Product')
    const productsUsing = await Product.countDocuments({
      containerType: id,
      isActive: true
    })

    if (productsUsing > 0) {
      return NextResponse.json(
        { error: `Cannot delete container type. ${productsUsing} active products are using this container type.` },
        { status: 400 }
      )
    }

    await ContainerType.findByIdAndDelete(id)

    return NextResponse.json({ message: 'Container type deleted successfully' })

  } catch (error: unknown) {
    console.error('Delete Container Type API Error:', error)
    return NextResponse.json(
      { error: 'Failed to delete container type', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
