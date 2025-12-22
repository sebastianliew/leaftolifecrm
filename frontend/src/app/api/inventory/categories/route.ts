import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { Category } from '@/models/Category'

// GET /api/inventory/categories
export async function GET(request: NextRequest) {
  try {
    await connectDB()

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const isActive = searchParams.get('isActive')
    const level = searchParams.get('level')
    const parent = searchParams.get('parent')
    const sortBy = searchParams.get('sortBy') || 'name'
    const order = searchParams.get('order') || 'asc'

    // Build filter object
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
    // Temporarily show all categories for debugging
    // else {
    //   // Default to active categories only
    //   filter.isActive = true
    // }

    if (level) {
      filter.level = parseInt(level)
    }

    if (parent) {
      filter.parent = parent
    }

    // Build sort object
    const sortOrder = order === 'desc' ? -1 : 1
    const sort = { [sortBy]: sortOrder }

    // Fetch categories
    const categories = await Category.find(filter)
      .sort(sort as Record<string, 1 | -1>)
      .lean()

    // Transform to match frontend interface
    interface CategoryDoc {
      _id: unknown;
      name: string;
      description?: string;
      level?: number;
      isActive?: boolean;
      parent?: unknown;
      createdAt?: Date;
      updatedAt?: Date;
    }
    
    const transformedCategories = categories.map((category: unknown) => {
      const cat = category as CategoryDoc
      return {
        id: String(cat._id),
        name: cat.name,
        description: cat.description,
        level: cat.level || 1,
        isActive: cat.isActive !== false, // Default to true if not specified
        parent: cat.parent ? String(cat.parent) : undefined,
        createdAt: cat.createdAt || new Date(),
        updatedAt: cat.updatedAt || new Date()
      }
    }
  )

    return NextResponse.json(transformedCategories)

  } catch (error: unknown) {
    console.error('Categories API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch categories', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST /api/inventory/categories
export async function POST(request: NextRequest) {
  try {
    await connectDB()

    const body = await request.json()
    const { name, description, parent } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      )
    }

    // Check if category with this name already exists
    const existingCategory = await Category.findOne({ name, isActive: true })
    if (existingCategory) {
      return NextResponse.json(
        { error: 'Category with this name already exists' },
        { status: 400 }
      )
    }

    // Determine level based on parent
    let level = 1
    if (parent) {
      const parentCategory = await Category.findById(parent)
      if (parentCategory) {
        level = (parentCategory.level || 1) + 1
      }
    }

    const category = await Category.create({
      name,
      description,
      parent: parent || undefined,
      level,
      isActive: true
    })

    // Transform response
    const transformedCategory = {
      id: category._id.toString(),
      name: category.name,
      description: category.description,
      level: category.level || 1,
      isActive: category.isActive !== false,
      parent: category.parent?.toString(),
      createdAt: category.createdAt,
      updatedAt: category.updatedAt
    }

    return NextResponse.json(transformedCategory, { status: 201 })

  } catch (error: unknown) {
    console.error('Create Category API Error:', error)
    return NextResponse.json(
      { error: 'Failed to create category', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}