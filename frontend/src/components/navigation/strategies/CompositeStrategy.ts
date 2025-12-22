import { NavigationStrategy, NavigationItem, NavigationContext } from '../types/navigation.types'

export class CompositeStrategy implements NavigationStrategy {
  name = 'composite'
  
  constructor(private strategies: NavigationStrategy[]) {}

  shouldShow(item: NavigationItem, context: NavigationContext): boolean {
    // All strategies must approve for item to be shown
    return this.strategies.every(strategy => strategy.shouldShow(item, context))
  }

  filterItems(items: NavigationItem[], context: NavigationContext): NavigationItem[] {
    // Apply all strategies in sequence
    return this.strategies.reduce(
      (filteredItems, strategy) => strategy.filterItems(filteredItems, context),
      items
    )
  }

  addStrategy(strategy: NavigationStrategy): void {
    this.strategies.push(strategy)
  }

  removeStrategy(name: string): void {
    this.strategies = this.strategies.filter(s => s.name !== name)
  }
}