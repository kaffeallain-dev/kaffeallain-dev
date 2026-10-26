import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider } from './context/AuthContext';
import { DataProvider, useData } from './context/DataContext';
import DashboardView from './views/DashboardView';
import LogFoodView from './views/LogFoodView';
import OnboardingView from './views/OnboardingView';
import SettingsView from './views/SettingsView';
import AnalyticsView from './views/AnalyticsView';
import { PrivacyPanel } from './components/PrivacyPanel';
import { Capacitor } from '@capacitor/core';

import { CameraScreen } from './components/CameraScreen';
import { ScanningScreen } from './components/ScanningScreen';
import { ResultsScreen } from './components/ResultsScreen';
import { SummaryScreen } from './components/SummaryScreen';
import { FoodRecognitionPipeline } from './features/vision/domain/pipeline/FoodRecognitionPipeline';
import { ProcessedImageResult } from './features/vision/presentation/acquisition/CameraEngine';
import { FoodRecognitionResult } from './features/vision/domain/pipeline/FoodRecognitionPipelineTypes';
import { MealCategory, FoodItemTemplate, ConsumptionRecord } from './types';
import { Home, PieChart, Camera, User, Utensils, AlertCircle, CloudUpload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { parseServingGrams } from './lib/nutritionScaling';
import { useI18n } from './lib/i18n';

type Tab = 'Home' | 'Meals' | 'Analytics' | 'Settings';
type ViewState = 'ONBOARDING' | 'DASHBOARD' | 'CAMERA' | 'SCANNING' | 'RESULTS' | 'SUMMARY';

function MainApp() {
  const { 
    settings, 
    updateSettings,
    isLoading,
    addConsumption, 
    showImportPrompt, 
    importLocalData, 
    dismissImportPrompt,
    selectedDateConsumptions,
    allConsumptions,
    syncStatus,
    syncError,
    retrySync
  } = useData();
  const { t } = useI18n();

  const [currentTab, setCurrentTab] = useState<Tab>('Home');
  const [viewState, setViewState] = useState<ViewState>('DASHBOARD');
  const [hasInitializedView, setHasInitializedView] = useState(false);
  
  const [logMealContext, setLogMealContext] = useState<{meal: MealCategory, food?: FoodItemTemplate | null, record?: ConsumptionRecord | null}>({ meal: 'Snacks' });
  
  const [capturedImage, setCapturedImage] = useState<ProcessedImageResult | null>(null);
  const [recognitionResult, setRecognitionResult] = useState<FoodRecognitionResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const isDeliberateReopenRef = useRef(false);

  // Reliable onboarding check: casual/skipping users, goal-setters, returning users, and explicit relaunch
  useEffect(() => {
    // 1. Check if explicitly requested via URL (e.g. ?onboarding=true or #onboarding)
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('onboarding') === 'true' || window.location.hash === '#onboarding') {
        setViewState('ONBOARDING');
        setHasInitializedView(true);
        return;
      }
    }

    // 2. Initial startup hydration & post-login check: only determine initial route once data is loaded
    if (!isLoading) {
      const ownerId = settings.id || 'guest';
      const isOwnerCompleted = typeof window !== 'undefined' && (
        localStorage.getItem(`mboafit_onboarding_${ownerId}`) === 'true' ||
        (ownerId !== 'guest' && localStorage.getItem(`onboarding_completed_${ownerId}`) === 'true') ||
        (ownerId === 'guest' && (
          localStorage.getItem('mboafit_onboarding_completed') === 'true' ||
          localStorage.getItem('dailycal_onboarding_completed') === 'true'
        ))
      );
      const hasLoggedMeals = Boolean(allConsumptions && allConsumptions.length > 0);
      const isSetupDone = Boolean(
        settings.onboardingCompleted || 
        (settings.profile as any)?.onboardingCompleted || 
        settings.profile?.primaryGoal ||
        settings.profile?.weightKg ||
        settings.profile?.age ||
        isOwnerCompleted ||
        hasLoggedMeals
      );

      if (!hasInitializedView) {
        if (!isSetupDone) {
          setViewState('ONBOARDING');
        } else {
          setViewState('DASHBOARD');
          if (!settings.onboardingCompleted) {
            updateSettings({ ...settings, onboardingCompleted: true });
          }
        }
        setHasInitializedView(true);
      } else if (viewState === 'ONBOARDING' && isSetupDone && !isDeliberateReopenRef.current) {
        // If view is currently ONBOARDING from cold boot check but user already has data, auto-transition to DASHBOARD
        const isExplicitUrl = typeof window !== 'undefined' && (
          new URLSearchParams(window.location.search).get('onboarding') === 'true' || 
          window.location.hash === '#onboarding'
        );
        if (!isExplicitUrl) {
          setViewState('DASHBOARD');
        }
      }
    }
  }, [settings, isLoading, hasInitializedView, allConsumptions, viewState, updateSettings]);

  const handleOpenOnboarding = () => {
    isDeliberateReopenRef.current = true;
    setViewState('ONBOARDING');
  };

  const handleStartScan = () => {
    if (Capacitor.isNativePlatform()) { setScanError(t('android_beta_scan')); return; }
    setScanError(null);
    setViewState('CAMERA');
  };

  const handleImageCaptured = async (image: ProcessedImageResult) => {
    setCapturedImage(image);
    setViewState('SCANNING');
    
    try {
      const currentCalories = selectedDateConsumptions.reduce((sum, item) => sum + item.calories, 0);
      const currentProtein = selectedDateConsumptions.reduce((sum, item) => sum + item.protein, 0);
      const currentCarbs = selectedDateConsumptions.reduce((sum, item) => sum + item.carbs, 0);
      const currentFat = selectedDateConsumptions.reduce((sum, item) => sum + item.fat, 0);

      const targetCalories = settings.dailyGoal || 2000;
      const targetProtein = Math.round(targetCalories * 0.2 / 4); // 20% from protein
      const targetCarbs = Math.round(targetCalories * 0.5 / 4); // 50% from carbs
      const targetFat = Math.round(targetCalories * 0.3 / 9); // 30% from fat

      let primaryGoal: any = 'healthyEating';
      if (settings.profile?.primaryGoal === 'Lose Weight') primaryGoal = 'weightLoss';
      if (settings.profile?.primaryGoal === 'Gain Weight') primaryGoal = 'weightGain';
      if (settings.profile?.primaryGoal === 'Build Muscle') primaryGoal = 'muscleBuilding';
      if (settings.profile?.primaryGoal === 'Maintain Weight') primaryGoal = 'weightMaintenance';

      const userProfile = {
        primaryGoal,
        conditions: [],
        dailyTargets: {
          calories: targetCalories,
          protein: targetProtein,
          carbs: targetCarbs,
          fat: targetFat
        },
        currentIntake: {
          calories: currentCalories,
          protein: currentProtein,
          carbs: currentCarbs,
          fat: currentFat
        }
      };

      const { commonFoods } = await import('./data/foodDatabase');
      const foodIndex = commonFoods.map(f => ({
        id: f.id,
        name: f.name,
        aliases: f.aliases || [],
        searchKeywords: [...(f.aliases || []), f.name.toLowerCase()],
        category: f.category
      }));

      const fetchFoodKnowledgeById = async (id: string) => {
        const item = commonFoods.find(f => f.id === id);
        if (!item) return null;
        return {
          id: item.id,
          name: item.name,
          aliases: item.aliases || [],
          searchKeywords: [],
          category: item.category || 'Other',
          mealType: ['Lunch', 'Dinner'],
          country: 'Cameroon',
          regions: [],
          servingSizes: { medium: item.servingSizeText || '1 serving' },
          nutrition: {
            calories: item.calories,
            protein: item.protein,
            carbohydrates: item.carbs,
            fat: item.fat,
            fiber: item.fiber || 0,
            sugar: item.sugar || 0,
            sodium: item.sodium || 0,
          },
          foodIntelligence: { concerns: item.concerns || [] },
          goalCompatibility: {},
          scores: { healthScore: 7, satietyScore: 7 },
          foodRelationships: { betterAlternatives: item.alternatives || [] },
          aiCoaching: []
        } as any;
      };

      const result = await FoodRecognitionPipeline.process(image, {
        userProfile,
        foodIndex,
        fetchFoodKnowledgeById
      });
      
      // Delay for UX
      setTimeout(() => {
        setRecognitionResult(result);
        setViewState('RESULTS');
      }, 1500);
    } catch (error: any) {
      console.error("Pipeline failed", error);
      setScanError(error?.message || t('recognition_error_desc'));
      setViewState('CAMERA');
    }
  };

  const handleResultsConfirmed = (updatedResult: FoodRecognitionResult) => {
    setRecognitionResult(updatedResult);
    setViewState('SUMMARY');
  };

  const handleSaveMeal = async () => {
    if (recognitionResult) {
      for (const item of recognitionResult.items) {
        if (item.foodKnowledge) {
          const baseGrams = parseServingGrams(item.foodKnowledge.servingSizes?.medium);
          const weight = item.estimatedPortion.estimatedWeight;
          const scale = baseGrams && baseGrams > 0 && weight && weight > 0
            ? weight / baseGrams
            : 1;
          const scaledCals = Math.round((item.foodKnowledge.nutrition.calories || 0) * scale);
          const scaledProt = Math.round((item.foodKnowledge.nutrition.protein || 0) * scale * 10) / 10;
          const scaledCarb = Math.round((item.foodKnowledge.nutrition.carbohydrates || 0) * scale * 10) / 10;
          const scaledFat = Math.round((item.foodKnowledge.nutrition.fat || 0) * scale * 10) / 10;
          await addConsumption({
            id: Date.now().toString() + Math.random().toString(),
            name: item.detectedLabel,
            calories: scaledCals,
            protein: scaledProt,
            carbs: scaledCarb,
            fat: scaledFat,
            servings: Math.round(scale * 100) / 100,
            mealCategory: 'Lunch',
            timestamp: Date.now(),
            foodId: item.foodKnowledge.id,
            servingSizeText: item.foodKnowledge.servingSizes?.medium
          });
        }
      }
    }
    setViewState('DASHBOARD');
    setCapturedImage(null);
    setRecognitionResult(null);
  };

  return (
    <div className="flex justify-center items-center h-screen bg-gray-100 sm:p-4">
      <div className="w-full h-full sm:w-[400px] sm:h-[800px] bg-white sm:rounded-[40px] sm:shadow-2xl overflow-hidden relative flex flex-col sm:border-[8px] sm:border-gray-900">
        
        <div className="flex-1 overflow-hidden relative bg-gray-50 flex flex-col">
          {/* Explicit Consent Local Data Import Banner */}
          {showImportPrompt && viewState === 'DASHBOARD' && (
            <div className="bg-emerald-900 text-white p-3 mx-3 mt-2 rounded-2xl shadow-lg border border-emerald-700/50 flex flex-col gap-2 relative z-30 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start gap-2.5">
                <div className="p-2 bg-emerald-800 rounded-xl shrink-0">
                  <CloudUpload className="w-5 h-5 text-emerald-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-white leading-tight">{t('import_prompt_title')}</h4>
                  <p className="text-[11px] text-emerald-200 mt-0.5 leading-snug">{t('import_prompt_desc')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 justify-end pt-1">
                <button 
                  type="button" 
                  onClick={dismissImportPrompt} 
                  className="text-[11px] font-semibold text-emerald-300 hover:text-white px-2.5 py-1 rounded-lg"
                >
                  {t('btn_dismiss')}
                </button>
                <button 
                  type="button" 
                  onClick={importLocalData} 
                  className="text-[11px] font-bold bg-white text-emerald-900 hover:bg-emerald-50 px-3 py-1 rounded-lg shadow-sm"
                >
                  {t('btn_import_now')}
                </button>
              </div>
            </div>
          )}

          {/* Cloud Sync Error / Retry Banner */}
          {syncStatus === 'error' && viewState === 'DASHBOARD' && (
            <div className="bg-amber-900 text-white p-2.5 mx-3 mt-2 rounded-xl shadow-md border border-amber-700/50 flex items-center justify-between gap-2 relative z-30 animate-in fade-in">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 text-amber-300 shrink-0" />
                <span className="text-[11px] text-amber-100 truncate font-medium">
                  {syncError || t('status_sync_error')}
                </span>
              </div>
              <button
                type="button"
                onClick={retrySync}
                className="text-[11px] font-bold bg-white text-amber-900 hover:bg-amber-50 px-2.5 py-1 rounded-lg shadow-xs shrink-0"
              >
                {t('btn_retry_sync')}
              </button>
            </div>
          )}

          <div className="flex-1 overflow-hidden relative">
            <AnimatePresence mode="wait">
              {viewState === 'ONBOARDING' && (
                <motion.div key="onboarding" className="absolute inset-0 z-50 bg-white" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
                  <OnboardingView 
                    onComplete={() => {
                      isDeliberateReopenRef.current = false;
                      const ownerId = settings.id || 'guest';
                      if (typeof window !== 'undefined') {
                        localStorage.setItem(`mboafit_onboarding_${ownerId}`, 'true');
                        if (ownerId === 'guest') {
                          localStorage.setItem('mboafit_onboarding_completed', 'true');
                          localStorage.setItem('dailycal_onboarding_completed', 'true');
                        } else {
                          localStorage.setItem(`onboarding_completed_${ownerId}`, 'true');
                        }
                      }
                      setViewState('DASHBOARD');
                    }} 
                    onClose={() => {
                      isDeliberateReopenRef.current = false;
                      if (typeof window !== 'undefined') {
                        if (window.location.hash === '#onboarding') {
                          window.location.hash = '';
                        }
                        const url = new URL(window.location.href);
                        if (url.searchParams.has('onboarding')) {
                          url.searchParams.delete('onboarding');
                          window.history.replaceState(null, '', url.pathname + (url.search ? url.search : '') + url.hash);
                        }
                      }
                      setViewState('DASHBOARD');
                    }}
                  />
                </motion.div>
              )}

              {viewState === 'DASHBOARD' && (
                <motion.div key="dashboard" className="absolute inset-0 flex flex-col" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
                  <div className="flex-1 overflow-y-auto pb-safe">
                    {currentTab === 'Home' && (
                      <DashboardView 
                        onLogFood={(meal, food, record) => {
                          const validFood = (food && typeof food === 'object' && 'name' in food && typeof food.name === 'string' && food.name.trim().length > 0) ? food : null;
                          const validRecord = (record && typeof record === 'object' && 'name' in record && typeof record.name === 'string' && record.name.trim().length > 0) ? record : null;
                          setLogMealContext({ meal, food: validFood, record: validRecord });
                          setCurrentTab('Meals');
                        }} 
                        onOpenSettings={() => setCurrentTab('Settings')}
                        onOpenOnboarding={handleOpenOnboarding}
                      />
                    )}
                    {currentTab === 'Meals' && (
                      <LogFoodView 
                        initialMeal={logMealContext.meal} 
                        initialFood={logMealContext.food} 
                        initialRecord={logMealContext.record} 
                        onBack={() => setCurrentTab('Home')} 
                      />
                    )}
                    {currentTab === 'Analytics' && (
                      <AnalyticsView 
                        onLogFood={(food) => {
                          const validFood = (food && typeof food === 'object' && 'name' in food && typeof food.name === 'string' && food.name.trim().length > 0) ? food : null;
                          setLogMealContext({ meal: 'Snacks', food: validFood, record: null });
                          setCurrentTab('Meals');
                        }} 
                      />
                    )}
                    {currentTab === 'Settings' && (
                      <SettingsView 
                        onOpenOnboarding={handleOpenOnboarding} 
                      />
                    )}
                  </div>

                  {/* Bottom Navigation */}
                  <div className="bg-white border-t border-gray-100 h-20 flex justify-around items-center px-4 sm:px-6 pb-2 relative z-10 shrink-0">
                    <button 
                      onClick={() => setCurrentTab('Home')} 
                      className={`p-2 flex flex-col items-center min-w-0 ${currentTab === 'Home' ? 'text-emerald-600' : 'text-gray-400'}`}
                    >
                      <Home size={22} />
                      <span className="text-[10px] mt-1 font-medium truncate max-w-[64px]">{t('nav_home')}</span>
                    </button>
                    <button 
                      onClick={() => { setLogMealContext({ meal: 'Snacks', food: null, record: null }); setCurrentTab('Meals'); }} 
                      className={`p-2 flex flex-col items-center mr-6 sm:mr-8 min-w-0 ${currentTab === 'Meals' ? 'text-emerald-600' : 'text-gray-400 hover:text-emerald-600'} transition-colors`}
                    >
                      <Utensils size={22} />
                      <span className="text-[10px] mt-1 truncate max-w-[64px]">{t('nav_meals')}</span>
                    </button>
                    <button 
                      onClick={() => setCurrentTab('Analytics')} 
                      className={`p-2 flex flex-col items-center ml-6 sm:ml-8 min-w-0 ${currentTab === 'Analytics' ? 'text-emerald-600' : 'text-gray-400'}`}
                    >
                      <PieChart size={22} />
                      <span className="text-[10px] mt-1 truncate max-w-[64px]">{t('nav_insights')}</span>
                    </button>
                    <button 
                      onClick={() => setCurrentTab('Settings')} 
                      className={`p-2 flex flex-col items-center min-w-0 ${currentTab === 'Settings' ? 'text-emerald-600' : 'text-gray-400'}`}
                    >
                      <User size={22} />
                      <span className="text-[10px] mt-1 truncate max-w-[64px]">{t('nav_profile')}</span>
                    </button>
                  </div>
                  
                  {/* Floating Scan Button */}
                  <div className="absolute bottom-[60px] left-1/2 -translate-x-1/2 z-20">
                    <motion.button 
                      whileTap={{ scale: 0.9 }}
                      onClick={handleStartScan}
                      aria-label={t('scan_photo')}
                      className="bg-emerald-600 text-white p-4 rounded-full shadow-lg shadow-emerald-600/30 flex items-center justify-center border-4 border-white"
                    >
                      <Camera size={26} className="fill-emerald-600" />
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {viewState === 'CAMERA' && (
                <motion.div key="camera" className="absolute inset-0 z-50 bg-black" initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}}>
                  <CameraScreen 
                    onCapture={handleImageCaptured} 
                    onClose={() => setViewState('DASHBOARD')} 
                    onManualEntry={() => {
                      setViewState('DASHBOARD');
                      setLogMealContext({ meal: 'Lunch', food: null, record: null });
                      setCurrentTab('Meals');
                    }}
                  />
                </motion.div>
              )}
              {viewState === 'SCANNING' && (
                <motion.div key="scanning" className="absolute inset-0 z-50 bg-gray-900" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
                  <ScanningScreen image={capturedImage} />
                </motion.div>
              )}
              {viewState === 'RESULTS' && recognitionResult && (
                <motion.div key="results" className="absolute inset-0 z-50 bg-white" initial={{x:'100%'}} animate={{x:0}} exit={{x:'-100%'}}>
                  <ResultsScreen 
                    result={recognitionResult} 
                    onConfirm={handleResultsConfirmed} 
                    onRetake={() => setViewState('CAMERA')}
                    onManualAdd={() => {
                      setViewState('DASHBOARD');
                      setLogMealContext({meal: 'Lunch', food: null}); 
                      setCurrentTab('Meals');
                    }}
                  />
                </motion.div>
              )}
              {viewState === 'SUMMARY' && recognitionResult && (
                <motion.div key="summary" className="absolute inset-0 z-50 bg-gray-50" initial={{x:'100%'}} animate={{x:0}} exit={{x:'-100%'}}>
                  <SummaryScreen 
                    result={recognitionResult} 
                    onSave={handleSaveMeal} 
                    onBack={() => setViewState('RESULTS')} 
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Recoverable Vision Pipeline Error State */}
          {scanError && (
            <div className="absolute inset-0 z-[60] bg-black/75 backdrop-blur-xs flex items-center justify-center p-6 animate-in fade-in">
              <div 
                className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 space-y-4"
                role="alertdialog"
                aria-modal="true"
              >
                <div className="flex items-start gap-3">
                  <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl shrink-0">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{t('recognition_unavailable')}</h3>
                    <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                      {t('recognition_error_desc')}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setScanError(null)}
                    className="w-full sm:flex-1 py-3 px-4 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors text-center order-2 sm:order-1"
                  >
                    {t('retry_photo')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScanError(null);
                      setViewState('DASHBOARD');
                      setLogMealContext({ meal: 'Lunch', food: null });
                      setCurrentTab('Meals');
                    }}
                    className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors shadow-sm text-center order-1 sm:order-2"
                  >
                    {t('log_manually')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Safe Area Notch Mock */}
        <div className="hidden sm:block absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-900 rounded-b-3xl z-[100]"></div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      {['/privacy', '/delete-account'].includes(window.location.pathname) ? (
        <PrivacyPanel standalone deletionOnly={window.location.pathname === '/delete-account'} />
      ) : <DataProvider><MainApp /></DataProvider>}
    </AuthProvider>
  );
}
