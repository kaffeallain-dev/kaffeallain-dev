import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { ConsumptionRecord, CustomFoodTemplate, UserSettings } from '../types';
import { 
  type OwnerIdentity, 
  toOwnerKey, 
  toOwnerIdentity, 
  encodeUidInjective 
} from './ownerIdentity';

export type { OwnerIdentity };
export { toOwnerKey, toOwnerIdentity };

export type OutboxEntityType = 'meal' | 'customFood' | 'settings';
export type OutboxOperationType = 
  | 'saveConsumption' 
  | 'deleteConsumption' 
  | 'saveCustomFood' 
  | 'deleteCustomFood' 
  | 'saveSettings';

export interface PendingWriteItem {
  id: string; // Coalesced entity key: e.g. "meal:abc", "customFood:xyz", "settings:settings"
  ownerKey: string;
  entityType: OutboxEntityType;
  entityId: string;
  operation: OutboxOperationType;
  payload?: any;
  revision: number; // Monotonically increasing revision token
  timestamp: number;
}

export interface ScopedMboaFitDB extends DBSchema {
  consumptions: {
    key: string;
    value: ConsumptionRecord;
    indexes: { 'by-timestamp': number };
  };
  customFoods: {
    key: string;
    value: CustomFoodTemplate;
  };
  settings: {
    key: string;
    value: UserSettings;
  };
  pendingWrites: {
    key: string;
    value: PendingWriteItem;
    indexes: { 'by-timestamp': number };
  };
}

/**
 * Legacy unpartitioned database name.
 * Quarantined: Kept untouched to avoid guessing ambiguous ownership or destroying historical data.
 */
export const LEGACY_DB_NAME = 'calorie-tracker-db';
export const isLegacyDBQuarantined = (): boolean => true;

const DB_VERSION = 1;

/**
 * Legacy sanitization helper preserved for backwards compatibility and migrations.
 */
export function legacySanitizeOwnerId(ownerId?: string | null): string {
  if (!ownerId || typeof ownerId !== 'string' || ownerId.trim() === '' || ownerId === 'guest') {
    return 'guest';
  }
  return ownerId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Maps an owner identifier to an injective, collision-free owner storage key.
 */
export function sanitizeOwnerId(ownerId?: OwnerIdentity | string | null): string {
  return toOwnerKey(ownerId);
}

/**
 * Generates an immutable, owner-scoped database name.
 * Guest and each authenticated UID receive completely separated physical databases.
 */
export function getDBNameForOwner(ownerId?: OwnerIdentity | string | null): string {
  const key = toOwnerKey(ownerId);
  if (key === 'g_guest') {
    return 'mboafit_store_guest';
  }
  return `mboafit_store_${key}`;
}

// Revision watermark map preventing ABA revision reuse across acknowledgments & entity recreations
const entityRevisionWatermarks = new Map<string, number>();

export function resetRevisionWatermarksForTesting(): void {
  entityRevisionWatermarks.clear();
}

const migratedStoresInMemory = new Set<string>();

const getSafeLocalStorage = (): Storage | null => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {}
  return null;
};

/**
 * Checks if a prior database exists from earlier versions and non-destructively
 * copies historical data over if the new database is currently empty.
 * Never deletes or drops any historical database.
 * Quarantines ambiguous or lossy mappings (e.g. UID guest reading mboafit_store_guest, or punctuation collisions).
 */
async function migratePriorStoreIfNeeded(
  targetDb: IDBPDatabase<ScopedMboaFitDB>,
  ownerId?: OwnerIdentity | string | null
): Promise<void> {
  const key = toOwnerKey(ownerId);
  if (key === 'g_guest') return; // Guest already uses mboafit_store_guest

  const storage = getSafeLocalStorage();
  const migrationCheckedKey = `mboafit_migration_checked_${key}`;
  if (migratedStoresInMemory.has(key) || storage?.getItem(migrationCheckedKey) === 'true') {
    return;
  }

  const markChecked = () => {
    migratedStoresInMemory.add(key);
    try {
      storage?.setItem(migrationCheckedKey, 'true');
    } catch {}
  };

  // Check if target database already has records
  const existingCount = await targetDb.count('consumptions');
  if (existingCount > 0) {
    markChecked();
    return;
  }

  // Extract raw UID to inspect migration safety
  const identity = toOwnerIdentity(ownerId);
  if (identity.kind !== 'user') return;

  // STRICT QUARANTINE:
  // 1. A user whose UID is literally "guest" must NEVER auto-import mboafit_store_guest
  //    because mboafit_store_guest is the unauthenticated guest session!
  if (identity.uid === 'guest') {
    markChecked();
    return;
  }

  // 2. Quarantine lossy regex mappings: if sanitizing changed the UID (e.g. "a.b" -> "a_b"),
  //    ownership is ambiguous and could collide with user "a_b". Never guess ownership!
  const oldClean = legacySanitizeOwnerId(identity.uid);
  if (oldClean !== identity.uid) {
    markChecked();
    return;
  }

  const oldDbName = `mboafit_store_${oldClean}`;
  const targetDbName = getDBNameForOwner(ownerId);
  if (oldDbName === targetDbName) {
    markChecked();
    return;
  }

  // Avoid creating ghost databases: check indexedDB.databases() first if available
  if (typeof indexedDB !== 'undefined' && typeof indexedDB.databases === 'function') {
    try {
      const dbs = await indexedDB.databases();
      const dbExists = dbs.some(d => d.name === oldDbName);
      if (!dbExists) {
        markChecked();
        return;
      }
    } catch {
      // Continue if databases() is unsupported
    }
  }

  try {
    const oldDb = await openDB<ScopedMboaFitDB>(oldDbName, DB_VERSION);
    const oldSettings = await oldDb.get('settings', oldClean);
    
    // STRICT VERIFICATION:
    // Any legacy store created by non-injective sanitization has ambiguous provenance.
    // Disable ALL automatic historical-account migration without an independently verified owner marker!
    // (e.g. verifiedOwnerUid === identity.uid)
    const verifiedOwnerMarker = (oldSettings as any)?.verifiedOwnerUid;
    if (!verifiedOwnerMarker || verifiedOwnerMarker !== identity.uid) {
      // Ambiguous provenance: keep historical store completely intact without migrating
      oldDb.close();
      markChecked();
      return;
    }

    const oldConsumptions = await oldDb.getAll('consumptions');
    const oldCustomFoods = await oldDb.getAll('customFoods');

    if (oldConsumptions.length > 0 || oldCustomFoods.length > 0 || oldSettings) {
      const tx = targetDb.transaction(['consumptions', 'customFoods', 'settings'], 'readwrite');
      for (const c of oldConsumptions) {
        await tx.objectStore('consumptions').put(c);
      }
      for (const f of oldCustomFoods) {
        await tx.objectStore('customFoods').put(f);
      }
      if (oldSettings) {
        await tx.objectStore('settings').put({ ...oldSettings, id: key });
      }
      await tx.done;
    }
    oldDb.close();
  } catch {
    // Prior store error; ignore cleanly
  } finally {
    markChecked();
  }
}

/**
 * Opens or upgrades the isolated IndexedDB database for a specific owner.
 */
export const getDB = async (ownerId?: OwnerIdentity | string | null): Promise<IDBPDatabase<ScopedMboaFitDB>> => {
  const dbName = getDBNameForOwner(ownerId);
  const database = await openDB<ScopedMboaFitDB>(dbName, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('consumptions')) {
        const store = database.createObjectStore('consumptions', { keyPath: 'id' });
        store.createIndex('by-timestamp', 'timestamp');
      }
      if (!database.objectStoreNames.contains('customFoods')) {
        database.createObjectStore('customFoods', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('settings')) {
        database.createObjectStore('settings', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('pendingWrites')) {
        const store = database.createObjectStore('pendingWrites', { keyPath: 'id' });
        store.createIndex('by-timestamp', 'timestamp');
      }
    },
  });

  // Non-destructive historical preservation
  await migratePriorStoreIfNeeded(database, ownerId);

  return database;
};

// ==========================================
// Owner-Scoped Settings Operations
// ==========================================

export const getSettings = async (ownerId?: OwnerIdentity | string | null): Promise<UserSettings> => {
  const key = toOwnerKey(ownerId);
  const database = await getDB(ownerId);
  const settings = await database.get('settings', key);
  if (settings) return settings;

  const defaultSettings: UserSettings = { 
    id: key, 
    dailyGoal: 2000, 
    onboardingCompleted: false 
  };
  await database.put('settings', defaultSettings);
  return defaultSettings;
};

export const updateSettings = async (
  ownerId: OwnerIdentity | string | null | undefined, 
  settings: UserSettings
): Promise<void> => {
  const key = toOwnerKey(ownerId);
  const database = await getDB(ownerId);
  const toSave: UserSettings = {
    ...settings,
    id: key
  };
  await database.put('settings', toSave);
};

// ==========================================
// Owner-Scoped Consumptions / Meals Operations
// ==========================================

export const getConsumptionsInRange = async (
  ownerId: OwnerIdentity | string | null | undefined,
  start: number,
  end: number
): Promise<ConsumptionRecord[]> => {
  const database = await getDB(ownerId);
  const index = database.transaction('consumptions').store.index('by-timestamp');
  const range = IDBKeyRange.bound(start, end);
  return index.getAll(range);
};

export const getAllConsumptions = async (ownerId?: OwnerIdentity | string | null): Promise<ConsumptionRecord[]> => {
  const database = await getDB(ownerId);
  return database.getAll('consumptions');
};

export const addConsumption = async (
  ownerId: OwnerIdentity | string | null | undefined,
  record: ConsumptionRecord
): Promise<void> => {
  const database = await getDB(ownerId);
  await database.put('consumptions', record);
};

export const updateConsumption = async (
  ownerId: OwnerIdentity | string | null | undefined,
  record: ConsumptionRecord
): Promise<void> => {
  const database = await getDB(ownerId);
  await database.put('consumptions', record);
};

export const deleteConsumption = async (
  ownerId: OwnerIdentity | string | null | undefined,
  id: string
): Promise<void> => {
  const database = await getDB(ownerId);
  await database.delete('consumptions', id);
};

export const clearAllConsumptions = async (ownerId?: OwnerIdentity | string | null): Promise<void> => {
  const database = await getDB(ownerId);
  await database.clear('consumptions');
};

/**
 * Atomically replaces all consumptions in the local store within a single transaction.
 */
export const replaceConsumptionsAtomic = async (
  ownerId: OwnerIdentity | string | null | undefined,
  records: ConsumptionRecord[]
): Promise<void> => {
  const database = await getDB(ownerId);
  const tx = database.transaction('consumptions', 'readwrite');
  await tx.store.clear();
  for (const r of records) {
    await tx.store.put(r);
  }
  await tx.done;
};

// ==========================================
// Owner-Scoped Custom Foods Operations
// ==========================================

export const getCustomFoods = async (ownerId?: OwnerIdentity | string | null): Promise<CustomFoodTemplate[]> => {
  const database = await getDB(ownerId);
  return database.getAll('customFoods');
};

export const addCustomFood = async (
  ownerId: OwnerIdentity | string | null | undefined,
  food: CustomFoodTemplate
): Promise<void> => {
  const database = await getDB(ownerId);
  await database.put('customFoods', food);
};

export const deleteCustomFood = async (
  ownerId: OwnerIdentity | string | null | undefined,
  id: string
): Promise<void> => {
  const database = await getDB(ownerId);
  await database.delete('customFoods', id);
};

export const clearAllCustomFoods = async (ownerId?: OwnerIdentity | string | null): Promise<void> => {
  const database = await getDB(ownerId);
  await database.clear('customFoods');
};

/**
 * Atomically replaces all custom foods in the local store within a single transaction.
 */
export const replaceCustomFoodsAtomic = async (
  ownerId: OwnerIdentity | string | null | undefined,
  foods: CustomFoodTemplate[]
): Promise<void> => {
  const database = await getDB(ownerId);
  const tx = database.transaction('customFoods', 'readwrite');
  await tx.store.clear();
  for (const f of foods) {
    await tx.store.put(f);
  }
  await tx.done;
};

// ==========================================
// Coalesced Outbox & Atomic Persistence Operations
// ==========================================

export const getPendingWrites = async (ownerId?: OwnerIdentity | string | null): Promise<PendingWriteItem[]> => {
  const database = await getDB(ownerId);
  return database.getAll('pendingWrites');
};

export const addPendingWrite = async (
  ownerId: OwnerIdentity | string | null | undefined,
  item: PendingWriteItem
): Promise<void> => {
  const database = await getDB(ownerId);
  await database.put('pendingWrites', item);
};

export const removePendingWrite = async (
  ownerId: OwnerIdentity | string | null | undefined,
  id: string
): Promise<void> => {
  const database = await getDB(ownerId);
  await database.delete('pendingWrites', id);
};

export const clearPendingWrites = async (ownerId?: OwnerIdentity | string | null): Promise<void> => {
  const database = await getDB(ownerId);
  await database.clear('pendingWrites');
};

/**
 * Atomically saves a consumption and registers/coalesces its outbox entry
 * with an incremented revision token inside a single IndexedDB transaction.
 */
export const saveConsumptionAtomic = async (
  ownerId: OwnerIdentity | string | null | undefined,
  record: ConsumptionRecord
): Promise<PendingWriteItem> => {
  const key = toOwnerKey(ownerId);
  const database = await getDB(ownerId);
  const entityId = record.id;
  const outboxId = `meal:${entityId}`;

  const tx = database.transaction(['consumptions', 'pendingWrites', 'settings'], 'readwrite');
  await tx.objectStore('consumptions').put(record);

  const pendingStore = tx.objectStore('pendingWrites');
  const settingsStore = tx.objectStore('settings');

  const existingOutbox = await pendingStore.get(outboxId);
  const wmKey = `rev_wm:${outboxId}`;
  const wmRecord = (await settingsStore.get(wmKey)) as unknown as { id: string; watermark: number } | undefined;
  const lastWatermark = Math.max(wmRecord?.watermark || 0, entityRevisionWatermarks.get(`${key}:${outboxId}`) || 0);
  const nextRevision = Math.max(existingOutbox?.revision || 0, lastWatermark) + 1;

  entityRevisionWatermarks.set(`${key}:${outboxId}`, nextRevision);
  await (settingsStore as any).put({ id: wmKey, watermark: nextRevision });

  const item: PendingWriteItem = {
    id: outboxId,
    ownerKey: key,
    entityType: 'meal',
    entityId,
    operation: 'saveConsumption',
    payload: record,
    revision: nextRevision,
    timestamp: Date.now()
  };

  await pendingStore.put(item);
  await tx.done;
  return item;
};

/**
 * Atomically deletes a consumption and registers its delete outbox entry
 * with an incremented revision token inside a single IndexedDB transaction.
 */
export const deleteConsumptionAtomic = async (
  ownerId: OwnerIdentity | string | null | undefined,
  id: string
): Promise<PendingWriteItem> => {
  const key = toOwnerKey(ownerId);
  const database = await getDB(ownerId);
  const outboxId = `meal:${id}`;

  const tx = database.transaction(['consumptions', 'pendingWrites', 'settings'], 'readwrite');
  await tx.objectStore('consumptions').delete(id);

  const pendingStore = tx.objectStore('pendingWrites');
  const settingsStore = tx.objectStore('settings');

  const existingOutbox = await pendingStore.get(outboxId);
  const wmKey = `rev_wm:${outboxId}`;
  const wmRecord = (await settingsStore.get(wmKey)) as unknown as { id: string; watermark: number } | undefined;
  const lastWatermark = Math.max(wmRecord?.watermark || 0, entityRevisionWatermarks.get(`${key}:${outboxId}`) || 0);
  const nextRevision = Math.max(existingOutbox?.revision || 0, lastWatermark) + 1;

  entityRevisionWatermarks.set(`${key}:${outboxId}`, nextRevision);
  await (settingsStore as any).put({ id: wmKey, watermark: nextRevision });

  const item: PendingWriteItem = {
    id: outboxId,
    ownerKey: key,
    entityType: 'meal',
    entityId: id,
    operation: 'deleteConsumption',
    payload: id,
    revision: nextRevision,
    timestamp: Date.now()
  };

  await pendingStore.put(item);
  await tx.done;
  return item;
};

/**
 * Atomically saves a custom food and registers/coalesces its outbox entry.
 */
export const saveCustomFoodAtomic = async (
  ownerId: OwnerIdentity | string | null | undefined,
  food: CustomFoodTemplate
): Promise<PendingWriteItem> => {
  const key = toOwnerKey(ownerId);
  const database = await getDB(ownerId);
  const outboxId = `customFood:${food.id}`;

  const tx = database.transaction(['customFoods', 'pendingWrites', 'settings'], 'readwrite');
  await tx.objectStore('customFoods').put(food);

  const pendingStore = tx.objectStore('pendingWrites');
  const settingsStore = tx.objectStore('settings');

  const existingOutbox = await pendingStore.get(outboxId);
  const wmKey = `rev_wm:${outboxId}`;
  const wmRecord = (await settingsStore.get(wmKey)) as unknown as { id: string; watermark: number } | undefined;
  const lastWatermark = Math.max(wmRecord?.watermark || 0, entityRevisionWatermarks.get(`${key}:${outboxId}`) || 0);
  const nextRevision = Math.max(existingOutbox?.revision || 0, lastWatermark) + 1;

  entityRevisionWatermarks.set(`${key}:${outboxId}`, nextRevision);
  await (settingsStore as any).put({ id: wmKey, watermark: nextRevision });

  const item: PendingWriteItem = {
    id: outboxId,
    ownerKey: key,
    entityType: 'customFood',
    entityId: food.id,
    operation: 'saveCustomFood',
    payload: food,
    revision: nextRevision,
    timestamp: Date.now()
  };

  await pendingStore.put(item);
  await tx.done;
  return item;
};

/**
 * Atomically deletes a custom food and registers its delete outbox entry.
 */
export const deleteCustomFoodAtomic = async (
  ownerId: OwnerIdentity | string | null | undefined,
  id: string
): Promise<PendingWriteItem> => {
  const key = toOwnerKey(ownerId);
  const database = await getDB(ownerId);
  const outboxId = `customFood:${id}`;

  const tx = database.transaction(['customFoods', 'pendingWrites', 'settings'], 'readwrite');
  await tx.objectStore('customFoods').delete(id);

  const pendingStore = tx.objectStore('pendingWrites');
  const settingsStore = tx.objectStore('settings');

  const existingOutbox = await pendingStore.get(outboxId);
  const wmKey = `rev_wm:${outboxId}`;
  const wmRecord = (await settingsStore.get(wmKey)) as unknown as { id: string; watermark: number } | undefined;
  const lastWatermark = Math.max(wmRecord?.watermark || 0, entityRevisionWatermarks.get(`${key}:${outboxId}`) || 0);
  const nextRevision = Math.max(existingOutbox?.revision || 0, lastWatermark) + 1;

  entityRevisionWatermarks.set(`${key}:${outboxId}`, nextRevision);
  await (settingsStore as any).put({ id: wmKey, watermark: nextRevision });

  const item: PendingWriteItem = {
    id: outboxId,
    ownerKey: key,
    entityType: 'customFood',
    entityId: id,
    operation: 'deleteCustomFood',
    payload: id,
    revision: nextRevision,
    timestamp: Date.now()
  };

  await pendingStore.put(item);
  await tx.done;
  return item;
};

/**
 * Atomically saves settings and registers its outbox entry.
 */
export const saveSettingsAtomic = async (
  ownerId: OwnerIdentity | string | null | undefined,
  settings: UserSettings
): Promise<PendingWriteItem> => {
  const key = toOwnerKey(ownerId);
  const database = await getDB(ownerId);
  const outboxId = 'settings:settings';
  const toSave: UserSettings = { ...settings, id: key };

  const tx = database.transaction(['settings', 'pendingWrites'], 'readwrite');
  const settingsStore = tx.objectStore('settings');
  const pendingStore = tx.objectStore('pendingWrites');

  await settingsStore.put(toSave);

  const existingOutbox = await pendingStore.get(outboxId);
  const wmKey = `rev_wm:${outboxId}`;
  const wmRecord = (await settingsStore.get(wmKey)) as unknown as { id: string; watermark: number } | undefined;
  const lastWatermark = Math.max(wmRecord?.watermark || 0, entityRevisionWatermarks.get(`${key}:${outboxId}`) || 0);
  const nextRevision = Math.max(existingOutbox?.revision || 0, lastWatermark) + 1;

  entityRevisionWatermarks.set(`${key}:${outboxId}`, nextRevision);
  await (settingsStore as any).put({ id: wmKey, watermark: nextRevision });

  const item: PendingWriteItem = {
    id: outboxId,
    ownerKey: key,
    entityType: 'settings',
    entityId: 'settings',
    operation: 'saveSettings',
    payload: toSave,
    revision: nextRevision,
    timestamp: Date.now()
  };

  await pendingStore.put(item);
  await tx.done;
  return item;
};

/**
 * Acknowledges a pending write ONLY if the outbox entry's current revision
 * in IndexedDB exactly matches the acknowledged revision.
 * If a concurrent newer edit occurred, the outbox entry is preserved!
 *
 * @returns true if the outbox entry was acknowledged and deleted, false if revision changed.
 */
export const acknowledgePendingWrite = async (
  ownerId: OwnerIdentity | string | null | undefined,
  id: string,
  acknowledgedRevision: number
): Promise<boolean> => {
  const database = await getDB(ownerId);
  const tx = database.transaction('pendingWrites', 'readwrite');
  const current = await tx.store.get(id);

  if (current && current.revision === acknowledgedRevision) {
    await tx.store.delete(id);
    await tx.done;
    return true;
  }

  await tx.done;
  return false;
};

/**
 * Atomically commits a remote snapshot of consumptions into IndexedDB.
 * Merges inside a single transaction with pendingWrites:
 * - Omits records marked for deletion in pendingWrites
 * - Preserves/overwrites records with local pending saves (creates/edits made offline or during hydration)
 * - Excludes local records that were deleted remotely (neither in cloud nor in pending writes)
 *
 * Prevents resurrection of remote deletions while protecting concurrent mutations.
 */
export const commitHydratedConsumptionsAtomic = async (
  ownerId: OwnerIdentity | string | null | undefined,
  remoteRecords: ConsumptionRecord[],
  preserveIds?: Set<string>,
  deletedIds?: Set<string>
): Promise<ConsumptionRecord[]> => {
  const database = await getDB(ownerId);
  const tx = database.transaction(['consumptions', 'pendingWrites'], 'readwrite');
  const consumptionsStore = tx.objectStore('consumptions');
  const pendingStore = tx.objectStore('pendingWrites');

  const allPending = await pendingStore.getAll();
  const existingLocal = await consumptionsStore.getAll();
  const pendingMealSaves = new Map<string, ConsumptionRecord>();
  const pendingMealDeletes = new Set<string>();

  for (const pw of allPending) {
    if (pw.entityType === 'meal') {
      if (pw.operation === 'saveConsumption') {
        pendingMealSaves.set(pw.entityId, pw.payload);
      } else if (pw.operation === 'deleteConsumption') {
        pendingMealDeletes.add(pw.entityId);
      }
    }
  }

  const merged = new Map<string, ConsumptionRecord>();
  // 1. Add cloud consumptions not pending deletion AND not deleted during active load
  for (const cr of remoteRecords) {
    if (!pendingMealDeletes.has(cr.id) && !deletedIds?.has(cr.id)) {
      merged.set(cr.id, cr);
    }
  }
  // 2. Preserved local items mutated during hydration fetch (if not deleted)
  if (preserveIds && preserveIds.size > 0) {
    for (const el of existingLocal) {
      if (preserveIds.has(el.id) && !pendingMealDeletes.has(el.id) && !deletedIds?.has(el.id)) {
        merged.set(el.id, el);
      }
    }
  }
  // 3. Local pending saves take precedence (if not deleted)
  for (const [id, saveRecord] of pendingMealSaves.entries()) {
    if (!deletedIds?.has(id)) {
      merged.set(id, saveRecord);
    }
  }

  await consumptionsStore.clear();
  for (const r of merged.values()) {
    await consumptionsStore.put(r);
  }
  await tx.done;

  return Array.from(merged.values()).sort((a, b) => b.timestamp - a.timestamp);
};

/**
 * Atomically commits a remote snapshot of custom foods into IndexedDB.
 */
export const commitHydratedCustomFoodsAtomic = async (
  ownerId: OwnerIdentity | string | null | undefined,
  remoteFoods: CustomFoodTemplate[],
  preserveIds?: Set<string>,
  deletedIds?: Set<string>
): Promise<CustomFoodTemplate[]> => {
  const database = await getDB(ownerId);
  const tx = database.transaction(['customFoods', 'pendingWrites'], 'readwrite');
  const customStore = tx.objectStore('customFoods');
  const pendingStore = tx.objectStore('pendingWrites');

  const allPending = await pendingStore.getAll();
  const existingLocal = await customStore.getAll();
  const pendingCustomSaves = new Map<string, CustomFoodTemplate>();
  const pendingCustomDeletes = new Set<string>();

  for (const pw of allPending) {
    if (pw.entityType === 'customFood') {
      if (pw.operation === 'saveCustomFood') {
        pendingCustomSaves.set(pw.entityId, pw.payload);
      } else if (pw.operation === 'deleteCustomFood') {
        pendingCustomDeletes.add(pw.entityId);
      }
    }
  }

  const merged = new Map<string, CustomFoodTemplate>();
  for (const cf of remoteFoods) {
    if (!pendingCustomDeletes.has(cf.id) && !deletedIds?.has(cf.id)) {
      merged.set(cf.id, cf);
    }
  }
  if (preserveIds && preserveIds.size > 0) {
    for (const el of existingLocal) {
      if (preserveIds.has(el.id) && !pendingCustomDeletes.has(el.id) && !deletedIds?.has(el.id)) {
        merged.set(el.id, el);
      }
    }
  }
  for (const [id, saveFood] of pendingCustomSaves.entries()) {
    if (!deletedIds?.has(id)) {
      merged.set(id, saveFood);
    }
  }

  await customStore.clear();
  for (const f of merged.values()) {
    await customStore.put(f);
  }
  await tx.done;

  return Array.from(merged.values());
};
