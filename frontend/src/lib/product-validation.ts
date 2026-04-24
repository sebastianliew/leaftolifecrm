/**
 * Shared product configuration validators.
 * Used by add-product-modal and edit-product-modal.
 */

export function validateLooseConfig(
  canSellLoose: boolean,
  containerCapacity: number | undefined | null
): string | null {
  if (canSellLoose && (!containerCapacity || containerCapacity <= 1)) {
    return 'Container capacity must be greater than 1 to enable loose sales (e.g. 75 for a 75ml bottle)'
  }
  return null
}
