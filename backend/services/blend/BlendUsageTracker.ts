import dbConnect from '@/lib/mongoose';
import { BlendTemplate } from '../../models/BlendTemplate.js';

/**
 * Tracks usage statistics for blend templates
 * Single Responsibility: Usage tracking and statistics
 */
export class BlendUsageTracker {
  
  async recordUsage(templateId: string): Promise<void> {
    await dbConnect();
    
    try {
      const template = await BlendTemplate.findById(templateId);
      if (template) {
        template.usageCount = (template.usageCount || 0) + 1;
        template.lastUsed = new Date();
        await template.save();
      }
    } catch (error) {
      // Don't throw error for usage tracking failure
      console.error('Error recording template usage:', error);
    }
  }
  
  async getUsageStats(templateId: string): Promise<{ usageCount: number; lastUsed: Date | null }> {
    await dbConnect();
    
    const template = await BlendTemplate.findById(templateId).select('usageCount lastUsed');
    
    if (!template) {
      return { usageCount: 0, lastUsed: null };
    }
    
    return {
      usageCount: template.usageCount || 0,
      lastUsed: template.lastUsed || null
    };
  }
  
  async getMostUsedTemplates(limit: number = 10): Promise<Array<{ id: string; name: string; usageCount: number }>> {
    await dbConnect();
    
    const templates = await BlendTemplate.find({ isActive: true })
      .sort({ usageCount: -1 })
      .limit(limit)
      .select('name usageCount');
      
    return templates.map(t => ({
      id: t._id.toString(),
      name: t.name,
      usageCount: t.usageCount || 0
    }));
  }
  
  async getRecentlyUsedTemplates(limit: number = 10): Promise<Array<{ id: string; name: string; lastUsed: Date }>> {
    await dbConnect();
    
    const templates = await BlendTemplate.find({ 
      isActive: true,
      lastUsed: { $exists: true }
    })
      .sort({ lastUsed: -1 })
      .limit(limit)
      .select('name lastUsed');
      
    return templates.map(t => ({
      id: t._id.toString(),
      name: t.name,
      lastUsed: t.lastUsed!
    }));
  }
}