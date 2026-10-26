/**
 * Production Account Sync & Session Controller
 *
 * Coordinates:
 * - Immutable owner isolation across guest and injective user UIDs
 * - Generation tracking & cancellation of stale async loads and writes across account switches
 * - Same-owner overlapping load sequencing
 * - Coalesced pending writes outbox with entity revision tokens
 * - Atomic persistence of local mutations + outbox entries in single IndexedDB transactions
 * - Revision-checked acknowledgments preventing concurrent edit lost updates
 * - Protection of pending local settings, meals, and custom foods from remote snapshot overwrites
 * - Strict sync status reporting (synced only when acknowledged with queue empty)
 * - Explicit idempotent guest import with cloud preservation and partial-batch safety
 */

import { ConsumptionRecord, CustomFoodTemplate, UserSettings } from '../types';
import * as db from './db';
import { 
  type OwnerIdentity, 
  toOwnerKey, 
  toOwnerIdentity, 
  getOwnerOnboardingKey 
} from './ownerIdentity';
import { firestoreService } from './firestoreService';

export type SyncLifecycleStatus = 
  | 'idle'       // Guest mode / local only
  | 'syncing'    // In-flight read or write with remote server
  | 'synced'     // Server-confirmed remote state active (queue is empty)
  | 'offline'    // Device offline, writes saved locally in owner scope
  | 'error';     // Cloud operation failed, operating with owner-scoped local storage

export interface SyncControllerState {
  settings: UserSettings;
  allConsumptions: ConsumptionRecord[];
  customFoods: CustomFoodTemplate[];
  syncStatus: SyncLifecycleStatus;
  syncError: string | null;
  isLoading: boolean;
  showImportPrompt: boolean;
}

export interface SyncControllerDependencies {
  firestore?: typeof firestoreService;
  dbModule?: typeof db;
}

export type StateListener = (state: SyncControllerState) => void;

interface HydrationEpoch {
  targetOwnerKey: string;
  loadSeq: number;
  mutatedMealIds: Set<string>;
  deletedMealIds: Set<string>;
  mutatedCustomIds: Set<string>;
  deletedCustomIds: Set<string>;
  updatedSettings: UserSettings | null;
}

export class SyncController {
  private activeOwner: OwnerIdentity = { kind: 'guest' };
  private ownerKey: string = 'g_guest';
  private isOnline: boolean = true;
  private dependencies: { firestore: typeof firestoreService; db: typeof db };

  // Race condition & generation guards
  private sessionGeneration: number = 0;
  private ownerLoadSeq: number = 0;
  private isDraining: boolean = false;
  private drainChains: Map<string, Promise<void>> = new Map();
  private activeHydrations: Map<string, Set<HydrationEpoch>> = new Map();

  // Active state
  private state: SyncControllerState = {
    settings: { id: 'g_guest', dailyGoal: 2000, onboardingCompleted: false },
    allConsumptions: [],
    customFoods: [],
    syncStatus: 'idle',
    syncError: null,
    isLoading: true,
    showImportPrompt: false,
  };

  private listeners = new Set<StateListener>();

  constructor(
    initialOwner: OwnerIdentity = { kind: 'guest' }, 
    isOnline: boolean = true,
    deps?: SyncControllerDependencies
  ) {
    this.dependencies = {
      firestore: deps?.firestore || firestoreService,
      db: deps?.dbModule || db,
    };
    this.activeOwner = initialOwner;
    this.ownerKey = toOwnerKey(initialOwner);
    this.isOnline = isOnline;
    this.state.settings.id = this.ownerKey;
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): SyncControllerState {
    return { ...this.state };
  }

  public getActiveOwner(): OwnerIdentity {
    return this.activeOwner;
  }

  public getOwnerKey(): string {
    return this.ownerKey;
  }

  public getSessionGeneration(): number {
    return this.sessionGeneration;
  }

  private notify() {
    const currentState = this.getState();
    for (const listener of this.listeners) {
      listener(currentState);
    }
  }

  /**
   * Switches the active owner identity immediately.
   * Cancels in-flight stale loads/writes from prior identity by incrementing session generation.
   * Immediately clears in-memory state so prior user's data is NEVER exposed under the new identity.
   */
  public switchOwner(identity: OwnerIdentity, isOnline: boolean = this.isOnline): void {
    const nextKey = toOwnerKey(identity);
    this.isOnline = isOnline;

    if (this.ownerKey === nextKey) {
      return;
    }

    // Cancel in-flight stale responses immediately
    this.sessionGeneration++;
    this.ownerLoadSeq = 0;
    this.activeOwner = identity;
    this.ownerKey = nextKey;

    // Immediately blank out in-memory state
    this.state = {
      settings: { id: nextKey, dailyGoal: 2000, onboardingCompleted: false },
      allConsumptions: [],
      customFoods: [],
      syncStatus: identity.kind === 'user' ? (this.isOnline ? 'syncing' : 'offline') : 'idle',
      syncError: null,
      isLoading: true,
      showImportPrompt: false,
    };
    this.notify();

    // Start load for new owner
    this.loadDataForOwner(this.ownerKey, this.sessionGeneration);
  }

  public setOnline(isOnline: boolean): void {
    if (this.isOnline === isOnline) return;
    this.isOnline = isOnline;

    if (this.activeOwner.kind === 'user') {
      if (isOnline) {
        // Device reconnected: drain pending outbox and update status
        this.scheduleDrain(this.ownerKey, this.sessionGeneration);
      } else {
        this.state.syncStatus = 'offline';
        this.notify();
      }
    }
  }

  public async retrySync(): Promise<void> {
    if (this.activeOwner.kind !== 'user') return;
    this.state.syncError = null;
    const chain = this.scheduleDrain(this.ownerKey, this.sessionGeneration);
    await chain;
  }

  /**
   * Refreshes data for the current owner.
   */
  public async refresh(): Promise<void> {
    await this.loadDataForOwner(this.ownerKey, this.sessionGeneration);
  }

  /**
   * Hydrates owner-scoped data with full race guards and pending writes protection.
   */
  public async loadDataForOwner(
    targetOwnerKey: string, 
    capturedGeneration: number
  ): Promise<void> {
    const loadSeq = ++this.ownerLoadSeq;
    const isStale = () => 
      this.sessionGeneration !== capturedGeneration || 
      this.ownerKey !== targetOwnerKey || 
      this.ownerLoadSeq !== loadSeq;

    this.state.isLoading = true;
    this.state.syncError = null;
    this.notify();

    const epoch: HydrationEpoch = {
      targetOwnerKey,
      loadSeq,
      mutatedMealIds: new Set(),
      deletedMealIds: new Set(),
      mutatedCustomIds: new Set(),
      deletedCustomIds: new Set(),
      updatedSettings: null,
    };
    let epochs = this.activeHydrations.get(targetOwnerKey);
    if (!epochs) {
      epochs = new Set();
      this.activeHydrations.set(targetOwnerKey, epochs);
    }
    epochs.add(epoch);

    const identity = toOwnerIdentity(targetOwnerKey);

    try {
      if (identity.kind !== 'user') {
        // Guest mode: load strictly from guest scoped database
        const localSettings = await this.dependencies.db.getSettings(targetOwnerKey);
        const localConsumptions = await this.dependencies.db.getAllConsumptions(targetOwnerKey);
        const localCustom = await this.dependencies.db.getCustomFoods(targetOwnerKey);

        if (isStale()) return;

        this.state.settings = localSettings;
        this.state.allConsumptions = localConsumptions.sort((a, b) => b.timestamp - a.timestamp);
        this.state.customFoods = localCustom;
        this.state.syncStatus = 'idle';
        this.state.showImportPrompt = false;
        this.state.isLoading = false;
        this.notify();
        return;
      }

      // Authenticated User Lifecycle
      const uid = identity.uid;

      if (!this.isOnline) {
        // Offline authenticated: load strictly from this user's isolated local DB
        const localSettings = await this.dependencies.db.getSettings(targetOwnerKey);
        const localConsumptions = await this.dependencies.db.getAllConsumptions(targetOwnerKey);
        const localCustom = await this.dependencies.db.getCustomFoods(targetOwnerKey);

        if (isStale()) return;

        this.state.settings = localSettings;
        this.state.allConsumptions = localConsumptions.sort((a, b) => b.timestamp - a.timestamp);
        this.state.customFoods = localCustom;
        this.state.syncStatus = 'offline';
        this.state.showImportPrompt = false;
        this.state.isLoading = false;
        this.notify();
        return;
      }

      // Online authenticated sync
      this.state.syncStatus = 'syncing';
      this.notify();

      // Read pending writes outbox FIRST to prevent overwriting pending edits with stale cloud snapshots
      const pendingWrites = await this.dependencies.db.getPendingWrites(targetOwnerKey);
      if (isStale()) return;

      const pendingMealSaves = new Map<string, ConsumptionRecord>();
      const pendingMealDeletes = new Set<string>();
      const pendingCustomSaves = new Map<string, CustomFoodTemplate>();
      const pendingCustomDeletes = new Set<string>();
      let pendingSettingsSave: UserSettings | null = null;

      for (const pw of pendingWrites) {
        if (pw.operation === 'saveConsumption') {
          pendingMealSaves.set(pw.entityId, pw.payload);
        } else if (pw.operation === 'deleteConsumption') {
          pendingMealDeletes.add(pw.entityId);
        } else if (pw.operation === 'saveCustomFood') {
          pendingCustomSaves.set(pw.entityId, pw.payload);
        } else if (pw.operation === 'deleteCustomFood') {
          pendingCustomDeletes.add(pw.entityId);
        } else if (pw.operation === 'saveSettings') {
          pendingSettingsSave = pw.payload;
        }
      }

      // 1. Resolve Settings
      let activeSettings: UserSettings;
      const ownerOnboardingKey = getOwnerOnboardingKey(targetOwnerKey);
      const legacyUserOnboardingKey = `onboarding_completed_${uid}`;
      const legacyGeneralKey = `mboafit_onboarding_${uid}`;
      const hasUserLocalCompletion = typeof window !== 'undefined' && (
        localStorage.getItem(ownerOnboardingKey) === 'true' ||
        localStorage.getItem(legacyUserOnboardingKey) === 'true' ||
        localStorage.getItem(legacyGeneralKey) === 'true'
      );

      if (epoch.updatedSettings) {
        activeSettings = epoch.updatedSettings;
      } else if (pendingSettingsSave) {
        // Pending local settings takes precedence over remote snapshot!
        activeSettings = pendingSettingsSave;
      } else {
        const cloudSettings = await this.dependencies.firestore.getUserSettings(uid);
        if (isStale()) return;

        const localScopedSettings = await this.dependencies.db.getSettings(targetOwnerKey);
        if (isStale()) return;

        if (cloudSettings) {
          activeSettings = cloudSettings;
          if (hasUserLocalCompletion && !activeSettings.onboardingCompleted) {
            activeSettings = { ...activeSettings, onboardingCompleted: true };
            await this.dependencies.firestore.saveUserSettings(uid, activeSettings);
          }
        } else {
          // Fresh account without cloud settings
          if (localScopedSettings && (localScopedSettings.profile?.primaryGoal || localScopedSettings.onboardingCompleted)) {
            activeSettings = localScopedSettings;
            await this.dependencies.firestore.saveUserSettings(uid, activeSettings);
          } else {
            activeSettings = {
              id: targetOwnerKey,
              dailyGoal: 2000,
              onboardingCompleted: hasUserLocalCompletion
            };
            if (hasUserLocalCompletion) {
              await this.dependencies.firestore.saveUserSettings(uid, activeSettings);
            }
          }
        }
      }

      if (epoch.updatedSettings) {
        activeSettings = epoch.updatedSettings;
      }

      if (isStale()) return;
      await this.dependencies.db.updateSettings(targetOwnerKey, activeSettings);
      this.state.settings = activeSettings;

      // 2. Fetch remote consumptions & custom foods
      const cloudConsumptions = await this.dependencies.firestore.getUserConsumptions(uid);
      if (isStale()) return;

      const cloudCustom = await this.dependencies.firestore.getUserCustomFoods(uid);
      if (isStale()) return;

      // Re-check pending settings right before commit to honor any concurrent local edit
      const currentPendingWrites = await this.dependencies.db.getPendingWrites(targetOwnerKey);
      if (isStale()) return;

      const currentPendingSettingsSave = currentPendingWrites.find(p => p.operation === 'saveSettings')?.payload;
      if (epoch.updatedSettings) {
        activeSettings = epoch.updatedSettings;
        await this.dependencies.db.updateSettings(targetOwnerKey, activeSettings);
        this.state.settings = activeSettings;
      } else if (currentPendingSettingsSave) {
        activeSettings = currentPendingSettingsSave;
        await this.dependencies.db.updateSettings(targetOwnerKey, activeSettings);
        this.state.settings = activeSettings;
      }

      // Atomically commit remote snapshots into IndexedDB merged with pendingWrites inside single transactions
      const resolvedMeals = await this.dependencies.db.commitHydratedConsumptionsAtomic(
        targetOwnerKey, 
        cloudConsumptions, 
        epoch.mutatedMealIds,
        epoch.deletedMealIds
      );
      if (isStale()) return;

      const resolvedCustom = await this.dependencies.db.commitHydratedCustomFoodsAtomic(
        targetOwnerKey, 
        cloudCustom, 
        epoch.mutatedCustomIds,
        epoch.deletedCustomIds
      );
      if (isStale()) return;

      this.state.allConsumptions = resolvedMeals;
      this.state.customFoods = resolvedCustom;

      // 4. Check guest data for explicit consent import prompt
      const guestKey = 'g_guest';
      const guestMeals = await this.dependencies.db.getAllConsumptions(guestKey);
      const guestCustom = await this.dependencies.db.getCustomFoods(guestKey);
      const dismissedKey = `import_dismissed_${uid}`;
      const isDismissed = typeof window !== 'undefined' && localStorage.getItem(dismissedKey) === 'true';
      const hasGuestData = guestMeals.length > 0 || guestCustom.length > 0;

      if (hasGuestData && !isDismissed && cloudConsumptions.length === 0) {
        this.state.showImportPrompt = true;
      } else {
        this.state.showImportPrompt = false;
      }

      // 5. Drain pending writes outbox safely through the serialized owner writer chain
      await this.scheduleDrain(targetOwnerKey, capturedGeneration);

      if (isStale()) return;

      // Check remaining queue: report 'synced' ONLY if queue is empty!
      const remainingWrites = await this.dependencies.db.getPendingWrites(targetOwnerKey);
      if (isStale()) return;

      if (remainingWrites.length === 0) {
        this.state.syncStatus = 'synced';
        this.state.syncError = null;
      } else {
        this.state.syncStatus = 'error';
        this.state.syncError = 'Could not sync all changes to cloud. Saved in local account storage.';
      }

      this.state.isLoading = false;
      this.notify();
    } catch (err: any) {
      if (isStale()) return;
      console.error(`Error loading data for ${targetOwnerKey}:`, err);
      this.state.syncStatus = 'error';
      this.state.syncError = err?.message || 'Failed to sync with cloud. Operating with local account storage.';

      // Fallback ONLY to this owner's isolated local store
      try {
        const fallbackSettings = await this.dependencies.db.getSettings(targetOwnerKey);
        const fallbackConsumptions = await this.dependencies.db.getAllConsumptions(targetOwnerKey);
        const fallbackCustom = await this.dependencies.db.getCustomFoods(targetOwnerKey);

        if (!isStale()) {
          this.state.settings = fallbackSettings;
          this.state.allConsumptions = fallbackConsumptions.sort((a, b) => b.timestamp - a.timestamp);
          this.state.customFoods = fallbackCustom;
        }
      } catch (fallbackErr) {
        console.error('Local fallback read failed:', fallbackErr);
      } finally {
        if (!isStale()) {
          this.state.isLoading = false;
          this.notify();
        }
      }
    } finally {
      const active = this.activeHydrations.get(targetOwnerKey);
      if (active) {
        active.delete(epoch);
        if (active.size === 0) {
          this.activeHydrations.delete(targetOwnerKey);
        }
      }
    }
  }

  /**
   * Serializes remote writes through owner-keyed drain chains.
   * A hung request on Owner A never blocks Owner B.
   */
  private scheduleDrain(targetOwnerKey: string, capturedGeneration: number): Promise<void> {
    const existingChain = this.drainChains.get(targetOwnerKey) || Promise.resolve();
    const newChain = existingChain.then(async () => {
      await this.drainPendingWritesInternal(targetOwnerKey, capturedGeneration);
    }).catch(err => {
      console.warn(`Serialized drain for ${targetOwnerKey} caught:`, err);
    });
    this.drainChains.set(targetOwnerKey, newChain);
    return newChain;
  }

  public async drainPendingWrites(targetOwnerKey: string = this.ownerKey): Promise<void> {
    const chain = this.scheduleDrain(targetOwnerKey, this.sessionGeneration);
    await chain;
  }

  private async drainPendingWritesInternal(
    targetOwnerKey: string,
    capturedGeneration: number
  ): Promise<void> {
    if (!this.isOnline) return;
    const identity = toOwnerIdentity(targetOwnerKey);
    if (identity.kind !== 'user') return;

    const isStale = () =>
      this.sessionGeneration !== capturedGeneration ||
      this.ownerKey !== targetOwnerKey;

    if (isStale()) return;

    this.state.syncStatus = 'syncing';
    this.notify();

    const uid = identity.uid;
    let hasError = false;
    let lastErrorMsg = '';

    try {
      // Loop until all pending writes for this owner are drained or error encountered
      while (true) {
        if (isStale()) return;
        const pending = await this.dependencies.db.getPendingWrites(targetOwnerKey);
        if (isStale()) return;
        if (pending.length === 0) break;

        let processedAny = false;
        for (const item of pending) {
          if (isStale()) return;
          const capturedRevision = item.revision;

          try {
            if (item.operation === 'saveConsumption') {
              await this.dependencies.firestore.saveConsumption(uid, item.payload);
            } else if (item.operation === 'deleteConsumption') {
              await this.dependencies.firestore.deleteConsumption(uid, item.payload);
            } else if (item.operation === 'saveCustomFood') {
              await this.dependencies.firestore.saveCustomFood(uid, item.payload);
            } else if (item.operation === 'deleteCustomFood') {
              await this.dependencies.firestore.deleteCustomFood(uid, item.payload);
            } else if (item.operation === 'saveSettings') {
              await this.dependencies.firestore.saveUserSettings(uid, item.payload);
            }

            if (isStale()) return;

            // Acknowledge exact revision sent: preserves newer concurrent edit
            await this.dependencies.db.acknowledgePendingWrite(targetOwnerKey, item.id, capturedRevision);
            processedAny = true;
          } catch (retryErr: any) {
            console.warn(`Pending retry failed for write ${item.id}:`, retryErr);
            hasError = true;
            lastErrorMsg = retryErr?.message || 'Failed to sync with cloud.';
            break;
          }
        }

        if (hasError || !processedAny) {
          break;
        }
      }
    } catch (err: any) {
      console.warn('Error processing pending writes queue:', err);
      hasError = true;
      lastErrorMsg = err?.message || 'Failed to sync with cloud.';
    }

    if (isStale()) return;

    const remainingWrites = await this.dependencies.db.getPendingWrites(targetOwnerKey);
    if (isStale()) return;

    if (remainingWrites.length === 0 && !hasError) {
      this.state.syncStatus = 'synced';
      this.state.syncError = null;
    } else {
      this.state.syncStatus = 'error';
      this.state.syncError = lastErrorMsg || 'Could not sync all changes to cloud. Saved in local account storage.';
    }
    this.notify();
  }

  // ==========================================
  // Mutations with Atomic Persistence & Serialized Remote Drain
  // ==========================================

  public async updateSettings(s: UserSettings): Promise<void> {
    const currentOwnerKey = this.ownerKey;
    const currentGen = this.sessionGeneration;
    const identity = toOwnerIdentity(currentOwnerKey);

    const scopedSettings: UserSettings = {
      ...s,
      id: currentOwnerKey
    };

    const epochs = this.activeHydrations.get(currentOwnerKey);
    if (epochs) {
      for (const ep of epochs) {
        ep.updatedSettings = scopedSettings;
      }
    }

    // Update localStorage onboarding flag
    if (s.onboardingCompleted || (s.profile as any)?.onboardingCompleted || s.profile?.primaryGoal || s.profile?.weightKg) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(getOwnerOnboardingKey(currentOwnerKey), 'true');
        if (identity.kind === 'user') {
          localStorage.setItem(`onboarding_completed_${identity.uid}`, 'true');
          localStorage.setItem(`mboafit_onboarding_${identity.uid}`, 'true');
        } else {
          localStorage.setItem('mboafit_onboarding_completed', 'true');
          localStorage.setItem('dailycal_onboarding_completed', 'true');
        }
      }
    }

    // Atomically persist local mutation + coalesced outbox entry
    await this.dependencies.db.saveSettingsAtomic(currentOwnerKey, scopedSettings);

    if (this.sessionGeneration !== currentGen || this.ownerKey !== currentOwnerKey) return;
    this.state.settings = scopedSettings;
    this.notify();

    if (identity.kind === 'user') {
      if (this.isOnline) {
        const drainPromise = this.scheduleDrain(currentOwnerKey, currentGen);
        await drainPromise;
      } else {
        this.state.syncStatus = 'offline';
        this.notify();
      }
    }
  }

  public async addConsumption(r: ConsumptionRecord): Promise<void> {
    const currentOwnerKey = this.ownerKey;
    const currentGen = this.sessionGeneration;
    const identity = toOwnerIdentity(currentOwnerKey);

    const epochs = this.activeHydrations.get(currentOwnerKey);
    if (epochs) {
      for (const ep of epochs) {
        ep.mutatedMealIds.add(r.id);
        ep.deletedMealIds.delete(r.id);
      }
    }

    // Atomically persist local mutation + outbox entry
    await this.dependencies.db.saveConsumptionAtomic(currentOwnerKey, r);

    if (this.sessionGeneration !== currentGen || this.ownerKey !== currentOwnerKey) return;
    this.state.allConsumptions = [r, ...this.state.allConsumptions.filter(c => c.id !== r.id)];
    this.notify();

    if (identity.kind === 'user') {
      if (this.isOnline) {
        const drainPromise = this.scheduleDrain(currentOwnerKey, currentGen);
        await drainPromise;
      } else {
        this.state.syncStatus = 'offline';
        this.notify();
      }
    }
  }

  public async updateConsumption(r: ConsumptionRecord): Promise<void> {
    const currentOwnerKey = this.ownerKey;
    const currentGen = this.sessionGeneration;
    const identity = toOwnerIdentity(currentOwnerKey);

    const epochs = this.activeHydrations.get(currentOwnerKey);
    if (epochs) {
      for (const ep of epochs) {
        ep.mutatedMealIds.add(r.id);
        ep.deletedMealIds.delete(r.id);
      }
    }

    // Atomically persist local mutation + coalesced outbox entry
    await this.dependencies.db.saveConsumptionAtomic(currentOwnerKey, r);

    if (this.sessionGeneration !== currentGen || this.ownerKey !== currentOwnerKey) return;
    this.state.allConsumptions = this.state.allConsumptions.map(c => c.id === r.id ? r : c);
    this.notify();

    if (identity.kind === 'user') {
      if (this.isOnline) {
        const drainPromise = this.scheduleDrain(currentOwnerKey, currentGen);
        await drainPromise;
      } else {
        this.state.syncStatus = 'offline';
        this.notify();
      }
    }
  }

  public async deleteConsumption(id: string): Promise<void> {
    const currentOwnerKey = this.ownerKey;
    const currentGen = this.sessionGeneration;
    const identity = toOwnerIdentity(currentOwnerKey);

    const epochs = this.activeHydrations.get(currentOwnerKey);
    if (epochs) {
      for (const ep of epochs) {
        ep.deletedMealIds.add(id);
        ep.mutatedMealIds.delete(id);
      }
    }

    // Atomically persist delete + coalesced delete outbox entry
    await this.dependencies.db.deleteConsumptionAtomic(currentOwnerKey, id);

    if (this.sessionGeneration !== currentGen || this.ownerKey !== currentOwnerKey) return;
    this.state.allConsumptions = this.state.allConsumptions.filter(c => c.id !== id);
    this.notify();

    if (identity.kind === 'user') {
      if (this.isOnline) {
        const drainPromise = this.scheduleDrain(currentOwnerKey, currentGen);
        await drainPromise;
      } else {
        this.state.syncStatus = 'offline';
        this.notify();
      }
    }
  }

  public async addCustomFood(f: CustomFoodTemplate): Promise<void> {
    const currentOwnerKey = this.ownerKey;
    const currentGen = this.sessionGeneration;
    const identity = toOwnerIdentity(currentOwnerKey);

    const epochs = this.activeHydrations.get(currentOwnerKey);
    if (epochs) {
      for (const ep of epochs) {
        ep.mutatedCustomIds.add(f.id);
        ep.deletedCustomIds.delete(f.id);
      }
    }

    await this.dependencies.db.saveCustomFoodAtomic(currentOwnerKey, f);

    if (this.sessionGeneration !== currentGen || this.ownerKey !== currentOwnerKey) return;
    this.state.customFoods = [f, ...this.state.customFoods.filter(item => item.id !== f.id)];
    this.notify();

    if (identity.kind === 'user') {
      if (this.isOnline) {
        const drainPromise = this.scheduleDrain(currentOwnerKey, currentGen);
        await drainPromise;
      } else {
        this.state.syncStatus = 'offline';
        this.notify();
      }
    }
  }

  public async deleteCustomFood(id: string): Promise<void> {
    const currentOwnerKey = this.ownerKey;
    const currentGen = this.sessionGeneration;
    const identity = toOwnerIdentity(currentOwnerKey);

    const epochs = this.activeHydrations.get(currentOwnerKey);
    if (epochs) {
      for (const ep of epochs) {
        ep.deletedCustomIds.add(id);
        ep.mutatedCustomIds.delete(id);
      }
    }

    await this.dependencies.db.deleteCustomFoodAtomic(currentOwnerKey, id);

    if (this.sessionGeneration !== currentGen || this.ownerKey !== currentOwnerKey) return;
    this.state.customFoods = this.state.customFoods.filter(f => f.id !== id);
    this.notify();

    if (identity.kind === 'user') {
      if (this.isOnline) {
        const drainPromise = this.scheduleDrain(currentOwnerKey, currentGen);
        await drainPromise;
      } else {
        this.state.syncStatus = 'offline';
        this.notify();
      }
    }
  }

  // ==========================================
  // Explicit Consent Guest Import & Clean Clearing
  // ==========================================

  public async importGuestData(): Promise<{ importedMeals: number; importedCustomFoods: number }> {
    if (this.activeOwner.kind !== 'user') {
      throw new Error('Must be signed in to import data to account');
    }
    const uid = this.activeOwner.uid;
    const targetOwnerKey = this.ownerKey;
    const capturedGeneration = this.sessionGeneration;
    const guestKey = 'g_guest';

    const isStale = () =>
      this.sessionGeneration !== capturedGeneration ||
      this.ownerKey !== targetOwnerKey;

    this.state.syncStatus = 'syncing';
    this.notify();

    // STRICT PREFLIGHT: All required cloud reads must succeed BEFORE any local or cloud mutation.
    // If ANY read fails (network/auth/offline), abort immediately with no side effects!
    let cloudSettings: UserSettings | null;
    let existingCloudConsumptions: ConsumptionRecord[];
    let existingCloudCustom: CustomFoodTemplate[];

    try {
      [cloudSettings, existingCloudConsumptions, existingCloudCustom] = await Promise.all([
        this.dependencies.firestore.getUserSettings(uid),
        this.dependencies.firestore.getUserConsumptions(uid),
        this.dependencies.firestore.getUserCustomFoods(uid)
      ]);
    } catch (preflightErr: any) {
      if (!isStale()) {
        this.state.syncStatus = 'error';
        this.state.syncError = 'Cloud preflight check failed. Cannot start import.';
        this.notify();
      }
      throw new Error('Cloud preflight failed: ' + (preflightErr?.message || 'Network error'));
    }

    if (isStale()) return { importedMeals: 0, importedCustomFoods: 0 };

    try {
      const guestConsumptions = await this.dependencies.db.getAllConsumptions(guestKey);
      const guestCustom = await this.dependencies.db.getCustomFoods(guestKey);

      if (isStale()) return { importedMeals: 0, importedCustomFoods: 0 };

      // Deduplicate against existing account records (both local store AND cloud)
      const existingUserConsumptions = await this.dependencies.db.getAllConsumptions(targetOwnerKey);
      const allExistingConsumptions = [...existingUserConsumptions, ...existingCloudConsumptions];
      const existingMealIds = new Set(allExistingConsumptions.map(c => c.id));
      const existingMealKeys = new Set(allExistingConsumptions.map(c => `${c.timestamp}_${c.name.trim().toLowerCase()}`));
      
      const newConsumptionsToImport = guestConsumptions.filter(
        c => !existingMealIds.has(c.id) && !existingMealKeys.has(`${c.timestamp}_${c.name.trim().toLowerCase()}`)
      );

      const existingUserCustom = await this.dependencies.db.getCustomFoods(targetOwnerKey);
      const allExistingCustom = [...existingUserCustom, ...existingCloudCustom];
      const existingCustomIds = new Set(allExistingCustom.map(f => f.id));
      const existingCustomNames = new Set(allExistingCustom.map(f => f.name.trim().toLowerCase()));

      const newCustomToImport = guestCustom.filter(
        f => !existingCustomIds.has(f.id) && !existingCustomNames.has(f.name.trim().toLowerCase())
      );

      if (newConsumptionsToImport.length === 0 && newCustomToImport.length === 0) {
        const pending = await this.dependencies.db.getPendingWrites(targetOwnerKey);
        if (pending.length > 0) {
          await this.drainPendingWrites(targetOwnerKey);
        }
        this.state.showImportPrompt = false;
        if (typeof window !== 'undefined') {
          localStorage.setItem(`import_dismissed_${uid}`, 'true');
        }
        await this.loadDataForOwner(targetOwnerKey, this.sessionGeneration);
        return { importedMeals: 0, importedCustomFoods: 0 };
      }

      // Save novel items into user's scoped local database WITH durable atomic outbox entries
      const createdMealOutbox: any[] = [];
      for (const meal of newConsumptionsToImport) {
        const item = await this.dependencies.db.saveConsumptionAtomic(targetOwnerKey, meal);
        createdMealOutbox.push(item);
      }
      const createdCustomOutbox: any[] = [];
      for (const food of newCustomToImport) {
        const item = await this.dependencies.db.saveCustomFoodAtomic(targetOwnerKey, food);
        createdCustomOutbox.push(item);
      }

      if (isStale()) return { importedMeals: newConsumptionsToImport.length, importedCustomFoods: newCustomToImport.length };

      // Route imported entities through the EXACT same owner serialized writer queue/chain
      const priorChain = this.drainChains.get(targetOwnerKey) || Promise.resolve();
      const importTask = priorChain.then(async () => {
        if (isStale()) return;

        if (typeof this.dependencies.firestore.importLocalToCloud === 'function') {
          await this.dependencies.firestore.importLocalToCloud(
            uid,
            cloudSettings || { id: targetOwnerKey, dailyGoal: 2000 },
            newConsumptionsToImport,
            newCustomToImport,
            true // preserveCloudSettings = true
          );
          for (const item of createdMealOutbox) {
            await this.dependencies.db.acknowledgePendingWrite(targetOwnerKey, item.id, item.revision);
          }
          for (const item of createdCustomOutbox) {
            await this.dependencies.db.acknowledgePendingWrite(targetOwnerKey, item.id, item.revision);
          }
        } else {
          await this.drainPendingWritesInternal(targetOwnerKey, capturedGeneration);
        }
      });

      this.drainChains.set(targetOwnerKey, importTask.then(() => {}, () => {}));
      await importTask;

      if (isStale()) return { importedMeals: newConsumptionsToImport.length, importedCustomFoods: newCustomToImport.length };

      // Guest originals in 'g_guest' DB are preserved untouched!
      this.state.showImportPrompt = false;
      if (typeof window !== 'undefined') {
        localStorage.setItem(`import_dismissed_${uid}`, 'true');
      }

      // Refresh view
      await this.loadDataForOwner(targetOwnerKey, this.sessionGeneration);
      return {
        importedMeals: newConsumptionsToImport.length,
        importedCustomFoods: newCustomToImport.length
      };
    } catch (err: any) {
      console.error('Import failed:', err);
      if (!isStale()) {
        this.state.syncStatus = 'error';
        this.state.syncError = err?.message || 'Failed to import local records';
        this.notify();
      }
      throw err;
    }
  }

  public dismissImportPrompt(): void {
    this.state.showImportPrompt = false;
    this.notify();
    if (this.activeOwner.kind === 'user' && typeof window !== 'undefined') {
      localStorage.setItem(`import_dismissed_${this.activeOwner.uid}`, 'true');
    }
  }

  public async clearAllData(): Promise<void> {
    const currentOwnerKey = this.ownerKey;
    const capturedGeneration = this.sessionGeneration;
    const identity = toOwnerIdentity(currentOwnerKey);

    const isStale = () =>
      this.sessionGeneration !== capturedGeneration ||
      this.ownerKey !== currentOwnerKey;

    await this.dependencies.db.clearAllConsumptions(currentOwnerKey);
    if (isStale()) return;
    await this.dependencies.db.clearAllCustomFoods(currentOwnerKey);
    if (isStale()) return;
    await this.dependencies.db.clearPendingWrites(currentOwnerKey);
    if (isStale()) return;

    const defaultSettings: UserSettings = { 
      id: currentOwnerKey, 
      dailyGoal: 2000, 
      onboardingCompleted: false 
    };
    await this.dependencies.db.updateSettings(currentOwnerKey, defaultSettings);
    if (isStale()) return;

    if (typeof window !== 'undefined') {
      localStorage.removeItem(getOwnerOnboardingKey(currentOwnerKey));
      if (identity.kind === 'guest') {
        localStorage.removeItem('mboafit_onboarding_completed');
        localStorage.removeItem('dailycal_onboarding_completed');
      } else {
        localStorage.removeItem(`onboarding_completed_${identity.uid}`);
        localStorage.removeItem(`mboafit_onboarding_${identity.uid}`);
      }
    }

    this.state.settings = defaultSettings;
    this.state.allConsumptions = [];
    this.state.customFoods = [];
    this.notify();

    await this.loadDataForOwner(currentOwnerKey, this.sessionGeneration);
  }
}
