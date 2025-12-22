import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { Category, ICategory } from '@/models/Category'

// GET /api/inventory/categories/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const { id } = await params

    const category = await Category.findById(id).lean() as ICategory | null
    
    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      )
    }

    // Transform to match frontend interface
    const transformedCategory = {
      id: category._id.toString(),
      name: category.name,
      description: category.description,
      level: category.level || 1,
      isActive: category.isActive !== false,
      parent: category.parent?.toString(),
      createdAt: category.createdAt || new Date(),
      updatedAt: category.updatedAt || new Date()
    }

    return NextResponse.json(transformedCategory)

  } catch (error: unknown) {
    console.error('Get Category API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch category', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PUT /api/inventory/categories/[id]
export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const { id } = await params

    const body = await _request.json()
    const { name, description } = body

    // Check if category exists
    const existingCategory = await Category.findById(id)
    if (!existingCategory) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      )
    }

    // Check if name is being changed and conflicts with another category
    if (name && name !== existingCategory.name) {
      const nameConflict = await Category.findOne({ 
        name, 
        isActive: true,
        _id: { $ne: id }
      })
      if (nameConflict) {
        return NextResponse.json(
          { error: 'Category with this name already exists' },
          { status: 400 }
        )
      }
    }

    // Update category
    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      { 
        ...(name && { name }),
        ...(description !== undefined && { description }),
        updatedAt: new Date()
      },
      { new: true, lean: true }
    ) as ICategory | null

    if (!updatedCategory) {
      return NextResponse.json(
        { error: 'Failed to update category' },
        { status: 500 }
      )
    }

    // Transform response
    const transformedCategory = {
      id: updatedCategory._id.toString(),
      name: updatedCategory.name,
      description: updatedCategory.description,
      level: updatedCategory.level || 1,
      isActive: updatedCategory.isActive !== false,
      parent: updatedCategory.parent?.toString(),
      createdAt: updatedCategory.createdAt,
      updatedAt: updatedCategory.updatedAt
    }

    return NextResponse.json(transformedCategory)

  } catch (error: unknown) {
    console.error('Update Category API Error:', error)
    return NextResponse.json(
      { error: 'Failed to update category', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE /api/inventory/categories/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()
    const { id } = await params

    // Check if category exists
    const category = await Category.findById(id)
    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      )
    }

    // Check if category has products using it
    const { Product } = await import('@/models/Product')
    const productsUsingCategory = await Product.countDocuments({ 
      category: id,
      isActive: true 
    })

    if (productsUsingCategory > 0) {
      return NextResponse.json(
        { 
          error: `Cannot delete category. ${productsUsingCategory} active products are using this category.` 
        },
        { status: 400 }
      )
    }

    // Check if other categories use this as parent
    const childCategories = await Category.countDocuments({
      parent: id,
      isActive: true
    })

    if (childCategories > 0) {
      return NextResponse.json(
        { 
          error: `Cannot delete category. ${childCategories} subcategories depend on this category.` 
        },
        { status: 400 }
      )
    }

    // Delete the category
    await Category.findByIdAndDelete(id)

    return NextResponse.json({ 
      message: 'Category deleted successfully' 
    })

  } catch (error: unknown) {
    console.error('Delete Category API Error:', error)
    return NextResponse.json(
      { error: 'Failed to delete category', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}