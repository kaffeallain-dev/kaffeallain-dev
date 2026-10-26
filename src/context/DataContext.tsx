import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef, useMemo } from 'react';
import { ConsumptionRecord, CustomFoodTemplate, UserSettings } from '../types';
import { useAuth } from './AuthContext';
import { startOfDay, endOfDay } from 'date-fns';
import { 
  SyncController, 
  type SyncControllerState, 
  type SyncLifecycleStatus 
} from '../lib/syncController';
import { 
  type OwnerIdentity, 
  toOwnerKey 
} from '../lib/ownerIdentity';

export type { SyncLifecycleStatus };

interface DataContextType {
  settings: UserSettings;
  updateSettings: (s: UserSettings) => Promise<void>;
  
  selectedDate: Date;
  setSelectedDate: (d: Date) => void;
  selectedDateConsumptions: ConsumptionRecord[];
  
  allConsumptions: ConsumptionRecord[];
  addConsumption: (r: ConsumptionRecord) => Promise<void>;
  updateConsumption: (r: ConsumptionRecord) => Promise<void>;
  deleteConsumption: (id: string) => Promise<void>;
  
  customFoods: CustomFoodTemplate[];
  addCustomFood: (f: CustomFoodTemplate) => Promise<void>;
  deleteCustomFood: (id: string) => Promise<void>;

  refreshData: () => Promise<void>;
  clearAllData: () => Promise<void>;

  // Cloud sync & account lifecycle state
  isCloudSynced: boolean;
  syncStatus: SyncLifecycleStatus;
  syncError: string | null;
  retrySync: () => Promise<void>;
  showImportPrompt: boolean;
  importLocalData: () => Promise<{ importedMeals: number; importedCustomFoods: number }>;
  dismissImportPrompt: () => void;
  isLoading: boolean;
}

export const DataContext = createContext<DataContextType | null>(null);

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
};

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading, isOnline } = useAuth();

  // Explicit, typed owner identity
  const currentIdentity: OwnerIdentity = useMemo(() => {
    return user ? { kind: 'user', uid: user.uid } : { kind: 'guest' };
  }, [user]);

  const currentOwnerKey = useMemo(() => toOwnerKey(currentIdentity), [currentIdentity]);

  // Production SyncController singleton ref
  const controllerRef = useRef<SyncController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new SyncController(currentIdentity, isOnline);
  }
  const controller = controllerRef.current;

  // SyncController reactive state
  const [controllerState, setControllerState] = useState<SyncControllerState>(() => controller.getState());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Subscribe to controller updates
  useEffect(() => {
    const unsubscribe = controller.subscribe((newState) => {
      setControllerState(newState);
    });
    return unsubscribe;
  }, [controller]);

  // React to auth identity changes immediately
  useEffect(() => {
    if (authLoading) return;
    controller.switchOwner(currentIdentity, isOnline);
  }, [currentOwnerKey, authLoading, controller, currentIdentity, isOnline]);

  // React to network connectivity changes
  useEffect(() => {
    controller.setOnline(isOnline);
  }, [isOnline, controller]);

  // IMMEDIATE RENDER-TIME IDENTITY GATING:
  // If AuthContext switched identity, but controller effect has not run yet in this render tick,
  // immediately mask and withhold prior owner's state so User A's data is NEVER exposed under User B.
  const isOwnerMismatch = controller.getOwnerKey() !== currentOwnerKey;

  const effectiveSettings: UserSettings = isOwnerMismatch
    ? { id: currentOwnerKey, dailyGoal: 2000, onboardingCompleted: false }
    : controllerState.settings;

  const effectiveAllConsumptions: ConsumptionRecord[] = isOwnerMismatch
    ? []
    : controllerState.allConsumptions;

  const effectiveCustomFoods: CustomFoodTemplate[] = isOwnerMismatch
    ? []
    : controllerState.customFoods;

  const effectiveLoading: boolean = authLoading || isOwnerMismatch || controllerState.isLoading;

  const effectiveSyncStatus: SyncLifecycleStatus = isOwnerMismatch
    ? (user ? (isOnline ? 'syncing' : 'offline') : 'idle')
    : controllerState.syncStatus;

  const effectiveSyncError: string | null = isOwnerMismatch ? null : controllerState.syncError;
  const effectiveShowImportPrompt: boolean = isOwnerMismatch ? false : controllerState.showImportPrompt;

  // Filter consumptions for selectedDate
  const selectedDateConsumptions = useMemo(() => {
    const tStart = startOfDay(selectedDate).getTime();
    const tEnd = endOfDay(selectedDate).getTime();
    return effectiveAllConsumptions
      .filter(c => c.timestamp >= tStart && c.timestamp <= tEnd)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [effectiveAllConsumptions, selectedDate]);

  const handleUpdateSettings = useCallback(async (s: UserSettings) => {
    await controller.updateSettings(s);
  }, [controller]);

  const handleAddConsumption = useCallback(async (r: ConsumptionRecord) => {
    await controller.addConsumption(r);
  }, [controller]);

  const handleUpdateConsumption = useCallback(async (r: ConsumptionRecord) => {
    await controller.updateConsumption(r);
  }, [controller]);

  const handleDeleteConsumption = useCallback(async (id: string) => {
    await controller.deleteConsumption(id);
  }, [controller]);

  const handleAddCustomFood = useCallback(async (f: CustomFoodTemplate) => {
    await controller.addCustomFood(f);
  }, [controller]);

  const handleDeleteCustomFood = useCallback(async (id: string) => {
    await controller.deleteCustomFood(id);
  }, [controller]);

  const handleRefreshData = useCallback(async () => {
    await controller.refresh();
  }, [controller]);

  const handleClearAllData = useCallback(async () => {
    await controller.clearAllData();
  }, [controller]);

  const handleImportLocalData = useCallback(async () => {
    return await controller.importGuestData();
  }, [controller]);

  const handleDismissImportPrompt = useCallback(() => {
    controller.dismissImportPrompt();
  }, [controller]);

  const handleRetrySync = useCallback(async () => {
    await controller.retrySync();
  }, [controller]);

  const contextValue: DataContextType = {
    settings: effectiveSettings,
    updateSettings: handleUpdateSettings,
    selectedDate,
    setSelectedDate,
    selectedDateConsumptions,
    allConsumptions: effectiveAllConsumptions,
    addConsumption: handleAddConsumption,
    updateConsumption: handleUpdateConsumption,
    deleteConsumption: handleDeleteConsumption,
    customFoods: effectiveCustomFoods,
    addCustomFood: handleAddCustomFood,
    deleteCustomFood: handleDeleteCustomFood,
    refreshData: handleRefreshData,
    clearAllData: handleClearAllData,
    isCloudSynced: Boolean(user && effectiveSyncStatus === 'synced'),
    syncStatus: effectiveSyncStatus,
    syncError: effectiveSyncError,
    retrySync: handleRetrySync,
    showImportPrompt: effectiveShowImportPrompt,
    importLocalData: handleImportLocalData,
    dismissImportPrompt: handleDismissImportPrompt,
    isLoading: effectiveLoading,
  };

  return (
    <DataContext.Provider value={contextValue}>
      {children}
    </DataContext.Provider>
  );
};
