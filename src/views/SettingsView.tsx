import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { exportToCSV, parseCSV } from '../lib/utils';
import { Target, Download, Upload, Trash2, AlertTriangle, CheckCircle2, User, Calculator } from 'lucide-react';
import { UserProfile } from '../types';
import { calculateDailyTarget, getProfileCompletion } from '../lib/personalization';

export default function SettingsView() {
  const { settings, updateSettings, allConsumptions, addConsumption, clearAllData, refreshData } = useData();
  const [goal, setGoal] = useState(settings.dailyGoal.toString());
  const [showSavedMsg, setShowSavedMsg] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

    const [profile, setProfile] = useState<UserProfile>({
    preferences: settings.profile?.preferences || [],
    age: settings.profile?.age || undefined,
    sex: settings.profile?.sex || 'Male',
    heightCm: settings.profile?.heightCm || undefined,
    weightKg: settings.profile?.weightKg || undefined,
    targetWeightKg: settings.profile?.targetWeightKg || undefined,
    activityLevel: settings.profile?.activityLevel || 'Sedentary',
    primaryGoal: settings.profile?.primaryGoal || 'Eat Healthier'
  });
  const isTargetAuto = parseInt(goal, 10) === calculateDailyTarget(profile);

  const PREFERENCE_OPTIONS = [
    "Vegetarian",
    "Vegan",
    "No Pork",
    "Dairy-Free",
    "High Protein",
    "Low Carb"
  ];

  const handleTogglePreference = (pref: string) => {
    const current = profile.preferences || [];
    if (current.includes(pref)) {
      setProfile({ ...profile, preferences: current.filter(p => p !== pref) });
    } else {
      setProfile({ ...profile, preferences: [...current, pref] });
    }
  };

  

  const handleSaveGoal = async () => {
    const newGoal = parseInt(goal, 10);
    if (!isNaN(newGoal) && newGoal > 0) {
      const finalProfile = { ...profile, startWeightKg: settings.profile?.startWeightKg || profile.weightKg };
      await updateSettings({ ...settings, dailyGoal: newGoal, profile: finalProfile });
      setShowSavedMsg(true);
      setTimeout(() => setShowSavedMsg(false), 2000);
    }
  };

  const calculateGoal = () => {
    const target = calculateDailyTarget(profile);
    setGoal(target.toString());
  };

  const handleExport = () => {
    exportToCSV(allConsumptions);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const records = await parseCSV(file);
      for (const rec of records) {
        if (rec.id && rec.timestamp && rec.name && rec.calories !== undefined) {
          await addConsumption(rec as any);
        }
      }
      await refreshData();
      alert(`Imported ${records.length} records successfully.`);
    } catch (err) {
      alert('Error importing data. Make sure it is a valid CSV exported from this app.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClearData = async () => {
    await clearAllData();
    setShowClearConfirm(false);
  };

  const profileCompletion = getProfileCompletion(settings.profile);
  const isComplete = profileCompletion.percentage === 100;

  return (
    <div className="max-w-md mx-auto w-full p-6 pb-40">
      <header className="mb-8 mt-2">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Settings</h1>
        <p className="text-sm text-gray-500 mt-1 font-medium">Manage preferences & data</p>
      </header>

      <div className="space-y-6">
        {/* Profile Completion Card */}
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold text-gray-900">Health Profile</h2>
            <span className="text-sm font-bold text-emerald-600">{profileCompletion.percentage}% complete</span>
          </div>
          
          <div className="w-full bg-gray-100 rounded-full h-2 mb-5 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-out" style={{ width: `${profileCompletion.percentage}%` }}></div>
          </div>

          {!isComplete ? (
            <div>
              <p className="text-sm text-gray-600 mb-5 leading-relaxed">
                More complete information helps MboaFit estimate your nutrition needs and tailor meal recommendations.
              </p>
              
              {profileCompletion.missing.length > 0 && (
                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Next step</span>
                    <span className="text-sm font-semibold text-gray-800">Add {profileCompletion.missing[0].toLowerCase()}</span>
                  </div>
                  <button 
                    onClick={() => {
                      document.getElementById('edit-profile-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="px-4 py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold rounded-xl text-sm transition-colors"
                  >
                    Continue profile
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="pt-2">
              <p className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                100% complete
              </p>
              <p className="text-sm text-gray-500 leading-relaxed">
                Your profile is ready for personalized nutrition guidance.
              </p>
            </div>
          )}
        </section>

        <section id="edit-profile-section" className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <User className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Edit Profile</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-800">Age <span className="text-gray-400 font-normal">(years)</span></label>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                value={profile.age || ''}
                onChange={e => setProfile({...profile, age: parseInt(e.target.value) || undefined})}
                placeholder="e.g. 30"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-800">Sex</label>
              <select
                value={profile.sex}
                onChange={e => setProfile({...profile, sex: e.target.value as any})}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-800">Height <span className="text-gray-400 font-normal">(cm)</span></label>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                value={profile.heightCm || ''}
                onChange={e => setProfile({...profile, heightCm: parseInt(e.target.value) || undefined})}
                placeholder="e.g. 175"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-800">Weight <span className="text-gray-400 font-normal">(kg)</span></label>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                value={profile.weightKg || ''}
                onChange={e => setProfile({...profile, weightKg: parseInt(e.target.value) || undefined})}
                placeholder="e.g. 70"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-800">Target weight <span className="text-gray-400 font-normal">(kg)</span></label>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                value={profile.targetWeightKg || ''}
                onChange={e => setProfile({...profile, targetWeightKg: parseInt(e.target.value) || undefined})}
                placeholder="e.g. 65"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-800">Primary goal</label>
              <select
                value={profile.primaryGoal}
                onChange={e => setProfile({...profile, primaryGoal: e.target.value as any})}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
              >
                <option value="Lose Weight">Lose Weight</option>
                <option value="Maintain Weight">Maintain Weight</option>
                <option value="Gain Weight">Gain Weight</option>
                <option value="Build Muscle">Build Muscle</option>
                <option value="Eat Healthier">Eat Healthier</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-800">Activity level</label>
            <select
              value={profile.activityLevel}
              onChange={e => setProfile({...profile, activityLevel: e.target.value as any})}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors truncate pr-8"
            >
              <option value="Sedentary">Sedentary (Little/no exercise)</option>
              <option value="Lightly Active">Lightly Active (1-3 days/wk)</option>
              <option value="Moderately Active">Moderately Active (3-5 days/wk)</option>
              <option value="Very Active">Very Active (Hard physical effort)</option>
            </select>
          </div>
          
        </section>

        {/* Food Preferences */}
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Food Preferences</h2>
            <p className="text-sm text-gray-500 mt-1">Your preferences help MboaFit suggest meals that fit you better.</p>
          </div>
          
          {(!profile.preferences || profile.preferences.length === 0) && (
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-center">
              <p className="text-sm text-gray-600 font-medium">No preferences added yet</p>
              <p className="text-xs text-gray-500 mt-1">Your recommendations will become more tailored as you add preferences.</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {PREFERENCE_OPTIONS.map(pref => {
              const isSelected = profile.preferences?.includes(pref);
              return (
                <button
                  key={pref}
                  onClick={() => handleTogglePreference(pref)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors border ${isSelected ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  {pref}
                </button>
              );
            })}
          </div>
        </section>

        {/* Daily Nutrition Goal */}
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Target className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Daily Nutrition Goal</h2>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-2xl gap-4">
            <div className="flex flex-col">
              <div className="flex items-baseline gap-1">
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="w-24 bg-transparent font-bold text-2xl text-gray-900 focus:outline-none focus:ring-0 p-0"
                  aria-label="Daily calorie goal"
                />
                <span className="text-sm font-medium text-gray-500">kcal/day</span>
              </div>
              <span className="text-xs font-medium text-emerald-600 mt-1">
                {isTargetAuto ? 'Estimated from your profile' : 'Manually set'}
              </span>
            </div>
            
            <button
              onClick={calculateGoal}
              className="w-full sm:w-auto px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold rounded-xl text-sm transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <Calculator className="w-4 h-4 shrink-0" />
              Auto-Calculate
            </button>
          </div>

          <p className="text-sm text-gray-600 leading-relaxed px-1">
            {isTargetAuto 
              ? "Your target is currently estimated from basic profile information. Complete your profile to make it more personalized." 
              : "When auto-calculate is enabled, MboaFit calculates your daily target from your profile."}
          </p>

          <div className="pt-4 border-t border-gray-50">
            <button
              onClick={handleSaveGoal}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl transition-colors shadow-sm"
            >
              {showSavedMsg ? <CheckCircle2 className="w-5 h-5" /> : null}
              {showSavedMsg ? 'Saved' : 'Save All Changes'}
            </button>
          </div>
        </section>

        {/* Data & Privacy */}
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Data & Privacy</h2>
            <p className="text-sm text-gray-500 mt-1">Export, import, or reset your nutrition history.</p>
          </div>
          
          <div className="space-y-3">
            <button
              onClick={handleExport}
              className="w-full flex flex-col p-4 rounded-2xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-colors text-left group"
            >
              <div className="flex items-center gap-3 mb-1">
                <Download className="w-5 h-5 text-gray-400 group-hover:text-emerald-600" />
                <span className="font-bold text-gray-900 group-hover:text-emerald-700">Export History</span>
              </div>
              <p className="text-sm text-gray-500 ml-8">Download your logged nutrition history as a CSV file.</p>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col p-4 rounded-2xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-colors text-left group"
            >
              <div className="flex items-center gap-3 mb-1">
                <Upload className="w-5 h-5 text-gray-400 group-hover:text-emerald-600" />
                <span className="font-bold text-gray-900 group-hover:text-emerald-700">Import History</span>
              </div>
              <p className="text-sm text-gray-500 ml-8">Restore nutrition history from a compatible CSV file.</p>
            </button>
            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleImport}
              className="hidden"
            />
          </div>

          <div className="pt-4 border-t border-gray-50">
            {showClearConfirm ? (
              <div className="p-4 rounded-2xl border border-red-200 bg-red-50 space-y-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold text-red-900">Clear all data?</p>
                    <p className="text-sm text-red-800 mt-1">
                      This will permanently remove your logged nutrition history from this device.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="w-full sm:flex-1 bg-white hover:bg-gray-100 text-gray-800 font-bold py-3 px-4 rounded-xl border border-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClearData}
                    className="w-full sm:flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-sm"
                  >
                    Clear all data
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="w-full flex flex-col p-4 rounded-2xl border border-red-100 hover:border-red-300 hover:bg-red-50 transition-colors text-left group"
              >
                <div className="flex items-center gap-3 mb-1">
                  <Trash2 className="w-5 h-5 text-red-500" />
                  <span className="font-bold text-red-600">Clear All Data</span>
                </div>
                <p className="text-sm text-red-500 ml-8">Remove your logged nutrition history from this device.</p>
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
