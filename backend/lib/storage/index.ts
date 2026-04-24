import type { StorageDriver } from './types.js';
import { wasabiDriver } from './wasabi.js';

let activeDriver: StorageDriver = wasabiDriver;

export function getStorageDriver(): StorageDriver {
  return activeDriver;
}

export function setStorageDriver(driver: StorageDriver): void {
  activeDriver = driver;
}

export type { StorageDriver } from './types.js';
