import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { ContainerType } from '@/models/ContainerType'

// GET /api/inventory/container-types
export async function GET(request: NextRequest) {
  try {
    await connectDB()

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const isActive = searchParams.get('isActive')
    const sortBy = searchParams.get('sortBy') || 'name'
    const order = searchParams.get('order') || 'asc'

    const filter: Record<string, unknown> = {}

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ]
    }

    if (isActive !== null && isActive !== undefined) {
      filter.isActive = isActive === 'true'
    }

    const sortOrder = order === 'desc' ? -1 : 1
    const sort = { [sortBy]: sortOrder }

    const containerTypes = await ContainerType.find(filter)
      .sort(sort as Record<string, 1 | -1>)
      .lean()

    interface ContainerTypeDoc {
      _id: unknown;
      name: string;
      description?: string;
      allowedUomTypes?: string[];
      isActive?: boolean;
      createdAt?: Date;
      updatedAt?: Date;
    }

    const transformed = (containerTypes as unknown as ContainerTypeDoc[]).map((ct) => ({
      id: String(ct._id),
      name: ct.name,
      description: ct.description,
      allowedUomTypes: ct.allowedUomTypes ?? [],
      isActive: ct.isActive !== false,
      createdAt: ct.createdAt || new Date(),
      updatedAt: ct.updatedAt || new Date()
    }))

    return NextResponse.json(transformed)

  } catch (error: unknown) {
    console.error('Container Types API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch container types', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST /api/inventory/container-types
export async function POST(request: NextRequest) {
  try {
    await connectDB()

    const body = await request.json()
    const { name, description, allowedUomTypes } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Container type name is required' },
        { status: 400 }
      )
    }

    if (!allowedUomTypes || !Array.isArray(allowedUomTypes) || allowedUomTypes.length === 0) {
      return NextResponse.json(
        { error: 'At least one allowed unit of measurement type is required' },
        { status: 400 }
      )
    }

    const existing = await ContainerType.findOne({ name, isActive: true })
    if (existing) {
      return NextResponse.json(
        { error: 'Container type with this name already exists' },
        { status: 400 }
      )
    }

    const ct = await ContainerType.create({
      name,
      description,
      isActive: true,
      allowedUomTypes
    })

    const transformed = {
      id: ct._id.toString(),
      name: ct.name,
      description: ct.description,
      allowedUomTypes: ct.allowedUomTypes ?? [],
      isActive: ct.isActive !== false,
      createdAt: ct.createdAt,
      updatedAt: ct.updatedAt
    }

    return NextResponse.json(transformed, { status: 201 })

  } catch (error: unknown) {
    console.error('Create Container Type API Error:', error)
    return NextResponse.json(
      { error: 'Failed to create container type', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
