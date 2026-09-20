import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { ConsumptionRecord, CustomFoodTemplate, UserSettings } from '../types';
import * as db from '../lib/db';
import { startOfDay, endOfDay, isSameDay } from 'date-fns';

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
}

const DataContext = createContext<DataContextType | null>(null);

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
};

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<UserSettings>({ id: 'user', dailyGoal: 2000 });
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDateConsumptions, setSelectedDateConsumptions] = useState<ConsumptionRecord[]>([]);
  const [allConsumptions, setAllConsumptions] = useState<ConsumptionRecord[]>([]);
  const [customFoods, setCustomFoods] = useState<CustomFoodTemplate[]>([]);

  const loadData = async () => {
    const s = await db.getSettings();
    setSettings(s);

    const tStart = startOfDay(selectedDate).getTime();
    const tEnd = endOfDay(selectedDate).getTime();
    
    const today = await db.getConsumptionsInRange(tStart, tEnd);
    setSelectedDateConsumptions(today.sort((a,b) => b.timestamp - a.timestamp));

    const all = await db.getAllConsumptions();
    setAllConsumptions(all.sort((a,b) => b.timestamp - a.timestamp));

    const custom = await db.getCustomFoods();
    setCustomFoods(custom);
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const handleUpdateSettings = async (s: UserSettings) => {
    await db.updateSettings(s);
    setSettings(s);
  };

  const handleAddConsumption = async (r: ConsumptionRecord) => {
    await db.addConsumption(r);
    await loadData();
  };

  const handleUpdateConsumption = async (r: ConsumptionRecord) => {
    await db.updateConsumption(r);
    await loadData();
  };

  const handleDeleteConsumption = async (id: string) => {
    await db.deleteConsumption(id);
    await loadData();
  };

  const handleAddCustomFood = async (f: CustomFoodTemplate) => {
    await db.addCustomFood(f);
    await loadData();
  };

  const handleDeleteCustomFood = async (id: string) => {
    await db.deleteCustomFood(id);
    await loadData();
  };

  const clearAllData = async () => {
    await db.clearAllConsumptions();
    setSelectedDate(new Date());
    await loadData();
  };

  return (
    <DataContext.Provider value={{
      settings,
      updateSettings: handleUpdateSettings,
      selectedDate,
      setSelectedDate,
      selectedDateConsumptions,
      allConsumptions,
      addConsumption: handleAddConsumption,
      updateConsumption: handleUpdateConsumption,
      deleteConsumption: handleDeleteConsumption,
      customFoods,
      addCustomFood: handleAddCustomFood,
      deleteCustomFood: handleDeleteCustomFood,
      refreshData: loadData,
      clearAllData
    }}>
      {children}
    </DataContext.Provider>
  );
};

