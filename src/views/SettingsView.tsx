import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useI18n, translations } from '../lib/i18n';
import { 
  exportCompleteJSONBackup, 
  validateAndParseJSONBackup, 
  exportToCSV, 
  parseCSV 
} from '../lib/utils';
import { 
  Target, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  User as UserIcon, 
  Calculator, 
  Cloud, 
  CloudOff, 
  LogOut, 
  LogIn, 
  Globe, 
  FileJson, 
  FileSpreadsheet, 
  AlertCircle,
  Upload
} from 'lucide-react';
import { UserProfile } from '../types';
import { PrivacyPanel } from '../components/PrivacyPanel';
import { calculateDailyTarget, getProfileCompletion, isProfileSufficientForTarget } from '../lib/personalization';

export default function SettingsView({ 
  onOpenOnboarding 
}: { 
  onOpenOnboarding?: () => void; 
} = {}) {
  const { 
    settings, 
    updateSettings, 
    allConsumptions, 
    customFoods, 
    addConsumption, 
    addCustomFood, 
    clearAllData, 
    refreshData,
    isCloudSynced,
    syncStatus,
    syncError,
    retrySync
  } = useData();

  const { user, signInWithGoogle, signOutUser, error: authError, clearError, isOnline } = useAuth();
  const { t, lang, setLanguage } = useI18n();

  const [goal, setGoal] = useState(settings.dailyGoal.toString());
  const [showSavedMsg, setShowSavedMsg] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<UserProfile>({
    preferences: settings.profile?.preferences || [],
    age: settings.profile?.age || undefined,
    sex: settings.profile?.sex || 'Male',
    heightCm: settings.profile?.heightCm || undefined,
    weightKg: settings.profile?.weightKg || undefined,
    targetWeightKg: settings.profile?.targetWeightKg || undefined,
    activityLevel: settings.profile?.activityLevel || 'Sedentary',
    primaryGoal: settings.profile?.primaryGoal || undefined
  });

  const isTargetAuto = parseInt(goal, 10) === calculateDailyTarget(profile);

  const PREFERENCE_MAP: { id: string; key: keyof typeof translations['en'] }[] = [
    { id: 'Vegetarian', key: 'pref_vegetarian' },
    { id: 'Vegan', key: 'pref_vegan' },
    { id: 'No Pork', key: 'pref_no_pork' },
    { id: 'Dairy-Free', key: 'pref_dairy_free' },
    { id: 'High Protein', key: 'pref_high_protein' },
    { id: 'Low Carb', key: 'pref_low_carb' }
  ];

  const handleTogglePreference = (prefId: string) => {
    const current = profile.preferences || [];
    if (current.includes(prefId)) {
      setProfile({ ...profile, preferences: current.filter(p => p !== prefId) });
    } else {
      setProfile({ ...profile, preferences: [...current, prefId] });
    }
  };

  useEffect(() => {
    setGoal(settings.dailyGoal.toString());
    setProfile({
      preferences: settings.profile?.preferences || [],
      age: settings.profile?.age || undefined,
      sex: settings.profile?.sex || 'Male',
      heightCm: settings.profile?.heightCm || undefined,
      weightKg: settings.profile?.weightKg || undefined,
      targetWeightKg: settings.profile?.targetWeightKg || undefined,
      activityLevel: settings.profile?.activityLevel || 'Sedentary',
      primaryGoal: settings.profile?.primaryGoal || undefined
    });
  }, [settings]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showClearConfirm) {
        setShowClearConfirm(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showClearConfirm]);

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

  const handleExportJSON = () => {
    exportCompleteJSONBackup(settings, allConsumptions, customFoods);
  };

  const handleExportCSV = () => {
    exportToCSV(allConsumptions);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus(null);
    setIsImporting(true);

    try {
      const existingIds = new Set(allConsumptions.map(c => c.id));
      let importedCount = 0;

      if (file.name.toLowerCase().endsWith('.json')) {
        const text = await file.text();
        const backup = validateAndParseJSONBackup(text);

        // Import custom foods if present
        if (backup.customFoods) {
          for (const f of backup.customFoods) {
            await addCustomFood(f);
          }
        }

        // Import consumptions idempotently
        for (const rec of backup.consumptions) {
          if (!existingIds.has(rec.id)) {
            await addConsumption(rec);
            existingIds.add(rec.id);
            importedCount++;
          }
        }

        // Import settings if present
        if (backup.settings) {
          await updateSettings({
            ...settings,
            dailyGoal: backup.settings.dailyGoal || settings.dailyGoal,
            profile: backup.settings.profile || settings.profile
          });
        }

        await refreshData();
        setImportStatus({
          type: 'success',
          message: lang === 'fr' 
            ? `${importedCount} repas et réglages importés avec succès !`
            : `Successfully imported ${importedCount} meal records and settings.`
        });
      } else {
        // CSV import
        const records = await parseCSV(file);
        for (const rec of records) {
          if (!existingIds.has(rec.id)) {
            await addConsumption(rec);
            existingIds.add(rec.id);
            importedCount++;
          }
        }
        await refreshData();
        setImportStatus({
          type: 'success',
          message: lang === 'fr'
            ? `${importedCount} repas importés depuis le fichier CSV.`
            : `Successfully imported ${importedCount} meal records from CSV.`
        });
      }
    } catch (err: any) {
      console.error('Import error:', err);
      setImportStatus({
        type: 'error',
        message: err.message || (lang === 'fr' 
          ? 'Échec de l’importation du fichier. Vérifiez qu’il s’agit d’une sauvegarde valide.'
          : 'Failed to import file. Please check that it is a valid MboaFit backup.')
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClearData = async () => {
    await clearAllData();
    setShowClearConfirm(false);
  };

  const profileCompletion = getProfileCompletion(settings.profile);
  const isComplete = profileCompletion.percentage === 100;

  const translateMissingField = (field: string) => {
    const fLower = field.toLowerCase();
    if (fLower.includes('age')) return t('field_age');
    if (fLower.includes('sex')) return t('field_sex');
    if (fLower.includes('height')) return t('field_height');
    if (fLower.includes('target')) return t('field_target_weight');
    if (fLower.includes('weight')) return t('field_weight');
    if (fLower.includes('activity')) return t('field_activity');
    return field.toLowerCase();
  };

  const getSyncStatusText = () => {
    if (!user) return t('status_browser_storage');
    if (!isOnline || syncStatus === 'offline') return t('status_offline_pending');
    if (syncStatus === 'syncing') return t('status_syncing');
    if (syncStatus === 'synced') return t('status_server_synced');
    if (syncStatus === 'error') return t('status_sync_error');
    return t('status_browser_storage');
  };

  return (
    <div className="max-w-md mx-auto w-full p-4 sm:p-6 pb-40">
      <header className="mb-6 mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">{t('nav_profile')}</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5 font-medium">{t('manage_pref_account')}</p>
        </div>

        {/* Language selector toggle */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-2xl p-1 shadow-xs">
          <Globe className="w-3.5 h-3.5 text-gray-400 ml-1.5" />
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`px-2 py-1 text-xs font-bold rounded-xl transition-colors ${lang === 'en' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:text-gray-900'}`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLanguage('fr')}
            className={`px-2 py-1 text-xs font-bold rounded-xl transition-colors ${lang === 'fr' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:text-gray-900'}`}
          >
            FR
          </button>
        </div>
      </header>

      <div className="space-y-6">
        {/* Account & Cloud Sync Section */}
        <section className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`p-2.5 rounded-2xl shrink-0 ${isCloudSynced ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-600'}`}>
                {isCloudSynced ? <Cloud className="w-5 h-5" /> : <CloudOff className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-gray-900 truncate">
                  {isCloudSynced ? t('cloud_synced') : t('local_mode')}
                </h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`w-2 h-2 rounded-full ${isCloudSynced ? 'bg-emerald-500' : (!isOnline ? 'bg-amber-400' : 'bg-gray-400')}`}></span>
                  <span className="text-xs text-gray-500 truncate">
                    {getSyncStatusText()}
                  </span>
                </div>
              </div>
            </div>

            {isCloudSynced && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                {t('active_badge')}
              </span>
            )}
          </div>

          <p className="text-xs text-gray-600 leading-relaxed">
            {isCloudSynced ? t('cloud_synced_desc') : t('local_mode_desc')}
          </p>

          {syncStatus === 'error' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-xs text-amber-800 truncate font-medium">
                  {syncError || t('status_sync_error')}
                </span>
              </div>
              <button
                type="button"
                onClick={retrySync}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-colors shrink-0 shadow-xs"
              >
                {t('btn_retry_sync')}
              </button>
            </div>
          )}

          {authError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-red-700 font-medium">{authError}</p>
                <button type="button" onClick={clearError} className="text-[11px] text-red-600 underline font-bold mt-1">
                  {t('dismiss')}
                </button>
              </div>
            </div>
          )}

          {user ? (
            <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-xs font-bold text-gray-900 block truncate">
                  {user.displayName || user.email || 'Google User'}
                </span>
                <span className="text-[11px] text-gray-400 block truncate">
                  {user.email}
                </span>
              </div>
              <button
                type="button"
                onClick={signOutUser}
                className="w-full sm:w-auto px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                {t('sign_out')}
              </button>
            </div>
          ) : (
            <div className="pt-2">
              <button
                type="button"
                onClick={signInWithGoogle}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                {t('sign_in_google')}
              </button>
            </div>
          )}
        </section>

        {/* Setup Wizard / Onboarding Questionnaire Card */}
        <section className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-5 sm:p-6 rounded-3xl shadow-sm text-white space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/20 rounded-2xl">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white leading-tight">
                  {t('open_onboarding_wizard')}
                </h2>
                <p className="text-xs text-emerald-100 mt-1 leading-relaxed">
                  {t('open_onboarding_desc')}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {onOpenOnboarding && (
              <button
                type="button"
                onClick={onOpenOnboarding}
                className="px-4 py-2.5 bg-white text-emerald-900 hover:bg-emerald-50 font-bold rounded-xl text-xs transition-colors shadow-sm"
              >
                {t('relaunch_onboarding')}
              </button>
            )}
            <button
              type="button"
              onClick={async () => {
                if (typeof window !== 'undefined') {
                  localStorage.removeItem('mboafit_onboarding_completed');
                  localStorage.removeItem('dailycal_onboarding_completed');
                  localStorage.removeItem('mboafit_profile_prompt_dismissed');
                  if (user) {
                    localStorage.removeItem(`onboarding_completed_${user.uid}`);
                  }
                }
                await updateSettings({
                  ...settings,
                  onboardingCompleted: false,
                  profile: {
                    ...settings.profile,
                    onboardingCompleted: false,
                    primaryGoal: undefined
                  }
                });
                if (onOpenOnboarding) {
                  onOpenOnboarding();
                }
              }}
              className="px-3.5 py-2.5 bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-100 font-semibold rounded-xl text-xs transition-colors border border-emerald-400/30"
            >
              {t('reset_onboarding_btn')}
            </button>
          </div>
        </section>

        {/* Profile Completion Card */}
        <section className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold text-gray-900">{t('health_profile')}</h2>
            <span className="text-sm font-bold text-emerald-600">
              {t('percent_complete', { n: profileCompletion.percentage })}
            </span>
          </div>
          
          <div className="w-full bg-gray-100 rounded-full h-2 mb-5 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-out" style={{ width: `${profileCompletion.percentage}%` }}></div>
          </div>

          {!isComplete ? (
            <div>
              <p className="text-sm text-gray-600 mb-5 leading-relaxed">
                {t('profile_incomplete_desc')}
              </p>
              
              {profileCompletion.missing.length > 0 && (
                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{t('next_step')}</span>
                    <span className="text-sm font-semibold text-gray-800">
                      {t('add_prefix')} {translateMissingField(profileCompletion.missing[0])}
                    </span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      const nextField = profileCompletion.missing[0];
                      let targetId = 'edit-profile-section';
                      if (nextField === 'Age') targetId = 'profile-age-input';
                      else if (nextField === 'Gender' || nextField === 'Sex') targetId = 'profile-sex-select';
                      else if (nextField === 'Height') targetId = 'profile-height-input';
                      else if (nextField === 'Current Weight') targetId = 'profile-weight-input';
                      else if (nextField === 'Target Weight') targetId = 'profile-target-weight-input';
                      else if (nextField === 'Primary Goal') targetId = 'profile-goal-select';
                      else if (nextField === 'Activity Level') targetId = 'profile-activity-select';

                      const el = document.getElementById(targetId);
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        if ('focus' in el && typeof el.focus === 'function') {
                          el.focus();
                        }
                      } else {
                        document.getElementById('edit-profile-section')?.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    className="px-4 py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold rounded-xl text-sm transition-colors"
                  >
                    {t('continue_profile')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="pt-2">
              <p className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                {t('profile_ready_title')}
              </p>
              <p className="text-sm text-gray-500 leading-relaxed">
                {t('profile_ready_desc')}
              </p>
            </div>
          )}
        </section>

        {/* Edit Profile */}
        <section id="edit-profile-section" className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-gray-100 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <UserIcon className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">{t('edit_profile')}</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="profile-age-input" className="block text-sm font-semibold text-gray-800">{t('label_age')} <span className="text-gray-400 font-normal">({t('label_years')})</span></label>
              <input
                id="profile-age-input"
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                value={profile.age || ''}
                onChange={e => setProfile({...profile, age: parseInt(e.target.value) || undefined})}
                placeholder="e.g. 21"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="profile-sex-select" className="block text-sm font-semibold text-gray-800">{t('label_sex')}</label>
              <select
                id="profile-sex-select"
                value={profile.sex}
                onChange={e => setProfile({...profile, sex: e.target.value as any})}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
              >
                <option value="Male">{t('sex_male')}</option>
                <option value="Female">{t('sex_female')}</option>
                <option value="Other">{t('sex_other')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="profile-height-input" className="block text-sm font-semibold text-gray-800">{t('label_height')} <span className="text-gray-400 font-normal">(cm)</span></label>
              <input
                id="profile-height-input"
                type="number"
                inputMode="decimal"
                step="0.1"
                value={profile.heightCm !== undefined ? profile.heightCm : ''}
                onChange={e => {
                  const val = e.target.value;
                  const num = parseFloat(val);
                  setProfile({
                    ...profile,
                    heightCm: val !== '' && !isNaN(num) && Number.isFinite(num) ? num : undefined
                  });
                }}
                placeholder="e.g. 175"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="profile-weight-input" className="block text-sm font-semibold text-gray-800">{t('label_weight')} <span className="text-gray-400 font-normal">(kg)</span></label>
              <input
                id="profile-weight-input"
                type="number"
                inputMode="decimal"
                step="0.1"
                value={profile.weightKg !== undefined ? profile.weightKg : ''}
                onChange={e => {
                  const val = e.target.value;
                  const num = parseFloat(val);
                  setProfile({
                    ...profile,
                    weightKg: val !== '' && !isNaN(num) && Number.isFinite(num) ? num : undefined
                  });
                }}
                placeholder="e.g. 70"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="profile-target-weight-input" className="block text-sm font-semibold text-gray-800">{t('label_target_weight')} <span className="text-gray-400 font-normal">(kg)</span></label>
              <input
                id="profile-target-weight-input"
                type="number"
                inputMode="decimal"
                step="0.1"
                value={profile.targetWeightKg !== undefined ? profile.targetWeightKg : ''}
                onChange={e => {
                  const val = e.target.value;
                  const num = parseFloat(val);
                  setProfile({
                    ...profile,
                    targetWeightKg: val !== '' && !isNaN(num) && Number.isFinite(num) ? num : undefined
                  });
                }}
                placeholder="e.g. 65"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="profile-goal-select" className="block text-sm font-semibold text-gray-800">{t('label_primary_goal')}</label>
              <select
                id="profile-goal-select"
                value={profile.primaryGoal || ''}
                onChange={e => setProfile({...profile, primaryGoal: (e.target.value as any) || undefined})}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
              >
                <option value="">{t('no_goal_selected')}</option>
                <option value="Lose Weight">{t('goal_lose_weight')}</option>
                <option value="Maintain Weight">{t('goal_maintain_weight')}</option>
                <option value="Gain Weight">{t('goal_gain_weight')}</option>
                <option value="Build Muscle">{t('goal_build_muscle')}</option>
                <option value="Eat Healthier">{t('goal_eat_healthier')}</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="profile-activity-select" className="block text-sm font-semibold text-gray-800">{t('label_activity_level')}</label>
            <select
              id="profile-activity-select"
              value={profile.activityLevel}
              onChange={e => setProfile({...profile, activityLevel: e.target.value as any})}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors truncate pr-8"
            >
              <option value="Sedentary">{t('act_sedentary')}</option>
              <option value="Lightly Active">{t('act_light')}</option>
              <option value="Moderately Active">{t('act_moderate')}</option>
              <option value="Very Active">{t('act_very')}</option>
            </select>
          </div>
        </section>

        {/* Food Preferences */}
        <section className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-gray-100 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t('food_preferences')}</h2>
            <p className="text-sm text-gray-500 mt-1">{t('food_preferences_desc')}</p>
          </div>
          
          {(!profile.preferences || profile.preferences.length === 0) && (
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-center">
              <p className="text-sm text-gray-600 font-medium">{t('no_pref_added')}</p>
              <p className="text-xs text-gray-500 mt-1">{t('no_pref_desc')}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {PREFERENCE_MAP.map(pref => {
              const isSelected = profile.preferences?.includes(pref.id);
              return (
                <button
                  key={pref.id}
                  type="button"
                  onClick={() => handleTogglePreference(pref.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors border ${isSelected ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  {t(pref.key)}
                </button>
              );
            })}
          </div>
        </section>

        {/* Daily Nutrition Goal */}
        <section className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-gray-100 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Target className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">{t('daily_goal_title')}</h2>
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
                  aria-label={isProfileSufficientForTarget(profile)
                    ? t('aria_personalized_calorie_goal', { goal })
                    : t('aria_reference_calorie_goal', { goal })}
                />
                <span className="text-sm font-medium text-gray-500">{t('kcal_day')}</span>
              </div>
              <span className="text-xs font-medium mt-1 flex items-center gap-1.5">
                {isTargetAuto ? (
                  isProfileSufficientForTarget(profile) ? (
                    <span className="text-emerald-600 font-semibold">{t('personalized_target_full')}</span>
                  ) : (
                    <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 font-semibold">
                      {t('general_ref_target_full')}
                    </span>
                  )
                ) : (
                  <span className="text-gray-500">{t('manually_set')}</span>
                )}
              </span>
            </div>
            
            <button
              type="button"
              onClick={calculateGoal}
              className="w-full sm:w-auto px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold rounded-xl text-sm transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <Calculator className="w-4 h-4 shrink-0" />
              {t('auto_calculate')}
            </button>
          </div>

          <p className="text-sm text-gray-600 leading-relaxed px-1">
            {isTargetAuto 
              ? (isProfileSufficientForTarget(profile) 
                  ? t('goal_estimated_desc') 
                  : (lang === 'fr' 
                      ? 'Votre objectif est actuellement basé sur une référence standard (2000 kcal). Renseignez votre profil pour obtenir une cible personnalisée.' 
                      : 'Your target is currently based on a general standard reference (2000 kcal). Complete your profile to calculate a personalized target.'))
              : t('goal_manual_desc')}
          </p>

          <div className="pt-4 border-t border-gray-50">
            <button
              type="button"
              onClick={handleSaveGoal}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl transition-colors shadow-sm"
            >
              {showSavedMsg ? <CheckCircle2 className="w-5 h-5" /> : null}
              {showSavedMsg ? t('saved') : t('save_changes')}
            </button>
          </div>
        </section>

        {/* Data & Backup Section */}
        <section className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-gray-100 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t('backup_export_title')}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {t('data_backup_desc')}
            </p>
          </div>

          {importStatus && (
            <div className={`p-4 rounded-2xl border text-sm font-semibold flex items-start gap-2.5 ${importStatus.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {importStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />}
              <span className="flex-1">{importStatus.message}</span>
            </div>
          )}
          
          <div className="space-y-3">
            {/* Complete JSON Export */}
            <button
              type="button"
              onClick={handleExportJSON}
              className="w-full flex flex-col p-4 rounded-2xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-colors text-left group"
            >
              <div className="flex items-center gap-3 mb-1">
                <FileJson className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 transition-colors" />
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">
                    {t('export_json')}
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                    {t('recommended_badge')}
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-500 ml-8">{t('export_json_desc')}</p>
            </button>

            {/* CSV Table Export */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="w-full flex flex-col p-4 rounded-2xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-colors text-left group"
            >
              <div className="flex items-center gap-3 mb-1">
                <FileSpreadsheet className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 transition-colors" />
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">{t('export_csv')}</span>
                  <span className="text-[11px] font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">{t('spreadsheet_badge')}</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 ml-8">{t('export_csv_desc')}</p>
            </button>

            {/* Import Backup */}
            <button
              type="button"
              disabled={isImporting}
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col p-4 rounded-2xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-colors text-left group disabled:opacity-50"
            >
              <div className="flex items-center gap-3 mb-1">
                <Upload className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 transition-colors" />
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">
                    {isImporting ? t('importing') : t('import_json')}
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                    JSON / CSV
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-500 ml-8">{t('import_backup_desc')}</p>
            </button>
            <input
              type="file"
              accept=".json,.csv"
              ref={fileInputRef}
              onChange={handleImportFile}
              className="hidden"
            />
          </div>

          <div className="pt-4 border-t border-gray-50">
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="w-full flex flex-col p-4 rounded-2xl border border-red-100 hover:border-red-300 hover:bg-red-50/60 transition-colors text-left group"
            >
              <div className="flex items-center gap-3 mb-1">
                <Trash2 className="w-5 h-5 text-red-500" />
                <span className="font-bold text-red-600">{t('clear_all_data')}</span>
              </div>
              <p className="text-xs text-red-500/80 ml-8">{t('clear_data_desc')}</p>
            </button>
          </div>
        </section>
      </div>

      <div className="px-4 pb-8"><PrivacyPanel /></div>

      {/* Confirmation Modal */}
      {showClearConfirm && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowClearConfirm(false)}
        >
          <div 
            className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 space-y-5 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-data-dialog-title"
          >
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-red-100 text-red-600 rounded-2xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 id="clear-data-dialog-title" className="text-lg font-bold text-gray-900">
                  {t('clear_data_confirm_title')}
                </h3>
                <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                  {t('clear_data_confirm_desc')}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors text-center order-2 sm:order-1"
              >
                {t('btn_cancel')}
              </button>
              <button
                type="button"
                onClick={handleClearData}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-colors shadow-sm text-center order-1 sm:order-2"
              >
                {t('btn_confirm_clear')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
