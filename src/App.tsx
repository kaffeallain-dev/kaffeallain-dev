import React, { useState, useEffect } from 'react';
import { DataProvider, useData } from './context/DataContext';
import DashboardView from './views/DashboardView';
import LogFoodView from './views/LogFoodView';
import OnboardingView from './views/OnboardingView';
import SettingsView from './views/SettingsView';
import AnalyticsView from './views/AnalyticsView';

import { CameraScreen } from './components/CameraScreen';
import { ScanningScreen } from './components/ScanningScreen';
import { ResultsScreen } from './components/ResultsScreen';
import { SummaryScreen } from './components/SummaryScreen';
import { FoodRecognitionPipeline } from './features/vision/domain/pipeline/FoodRecognitionPipeline';
import { ProcessedImageResult } from './features/vision/presentation/acquisition/CameraEngine';
import { FoodRecognitionResult } from './features/vision/domain/pipeline/FoodRecognitionPipelineTypes';
import { MealCategory, FoodItemTemplate, ConsumptionRecord } from './types';
import { Home, PieChart, Settings, Camera, Search, Activity, User, Utensils } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Tab = 'Home' | 'Meals' | 'Analytics' | 'Settings';
type ViewState = 'ONBOARDING' | 'DASHBOARD' | 'CAMERA' | 'SCANNING' | 'RESULTS' | 'SUMMARY';

function MainApp() {
  const { settings, addConsumption } = useData();
  const [currentTab, setCurrentTab] = useState<Tab>('Home');
  const [viewState, setViewState] = useState<ViewState>('DASHBOARD');
  
  const [logMealContext, setLogMealContext] = useState<{meal: MealCategory, food?: FoodItemTemplate | null, record?: ConsumptionRecord | null}>({ meal: 'Snacks' });
  
  const [capturedImage, setCapturedImage] = useState<ProcessedImageResult | null>(null);
  const [recognitionResult, setRecognitionResult] = useState<FoodRecognitionResult | null>(null);

  const { selectedDateConsumptions } = useData();

  useEffect(() => {
    if (!settings.profile?.primaryGoal) {
      setViewState('ONBOARDING');
    }
  }, [settings.profile]);

  const handleStartScan = () => {
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

      const targetCalories = settings.dailyGoal;
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
    } catch (error) {
      console.error("Pipeline failed", error);
      alert("Failed to analyze image.");
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
          const scale = (item.estimatedPortion.estimatedWeight || 250) / 250;
          await addConsumption({
            id: Date.now().toString() + Math.random().toString(),
            name: item.detectedLabel,
            calories: Math.round((item.foodKnowledge.nutrition.calories || 0) * scale),
            protein: (item.foodKnowledge.nutrition.protein || 0) * scale,
            carbs: (item.foodKnowledge.nutrition.carbohydrates || 0) * scale,
            fat: (item.foodKnowledge.nutrition.fat || 0) * scale,
            servings: 1,
            mealCategory: 'Lunch', // Simplified
            timestamp: Date.now()
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
        
        <div className="flex-1 overflow-hidden relative bg-gray-50">
          <AnimatePresence mode="wait">
            {viewState === 'ONBOARDING' && (
              <motion.div key="onboarding" className="absolute inset-0 z-50 bg-white" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
                <OnboardingView onComplete={() => setViewState('DASHBOARD')} />
              </motion.div>
            )}

            {viewState === 'DASHBOARD' && (
              <motion.div key="dashboard" className="absolute inset-0 flex flex-col" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
                <div className="flex-1 overflow-y-auto pb-safe">
                  {currentTab === 'Home' && (
                    <DashboardView 
                      onLogFood={(meal, food, record) => { setLogMealContext({meal, food, record}); setCurrentTab('Meals'); }} 
                      onOpenSettings={() => setCurrentTab('Settings')}
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
                      onLogFood={(food) => { setLogMealContext({meal: 'Snacks', food: food || null}); setCurrentTab('Meals'); }} 
                    />
                  )}
                  {currentTab === 'Settings' && <SettingsView />}
                </div>

                {/* Bottom Navigation */}
                <div className="bg-white border-t border-gray-100 h-20 flex justify-around items-center px-6 pb-2 relative z-10 shrink-0">
                  <button onClick={() => setCurrentTab('Home')} className={`p-2 flex flex-col items-center ${currentTab === 'Home' ? 'text-emerald-600' : 'text-gray-400'}`}>
                    <Home size={24} />
                    <span className="text-[10px] mt-1 font-medium">Home</span>
                  </button>
                  <button onClick={() => { setLogMealContext({meal: 'Snacks', food: null}); setCurrentTab('Meals'); }} className={`p-2 flex flex-col items-center mr-8 ${currentTab === 'Meals' ? 'text-emerald-600' : 'text-gray-400 hover:text-emerald-600'} transition-colors`}>
                    <Utensils size={24} />
                    <span className="text-[10px] mt-1">Meals</span>
                  </button>
                  <button onClick={() => setCurrentTab('Analytics')} className={`p-2 flex flex-col items-center ml-8 ${currentTab === 'Analytics' ? 'text-emerald-600' : 'text-gray-400'}`}>
                    <PieChart size={24} />
                    <span className="text-[10px] mt-1">Insights</span>
                  </button>
                  <button onClick={() => setCurrentTab('Settings')} className={`p-2 flex flex-col items-center ${currentTab === 'Settings' ? 'text-emerald-600' : 'text-gray-400'}`}>
                    <User size={24} />
                    <span className="text-[10px] mt-1">Profile</span>
                  </button>
                </div>
                
                {/* Floating Scan Button */}
                <div className="absolute bottom-[60px] left-1/2 -translate-x-1/2 z-20">
                  <motion.button 
                    whileTap={{ scale: 0.9 }}
                    onClick={handleStartScan}
                    className="bg-emerald-600 text-white p-4 rounded-full shadow-lg shadow-emerald-600/30 flex items-center justify-center border-4 border-white"
                  >
                    <Camera size={28} className="fill-emerald-600" />
                  </motion.button>
                </div>
              </motion.div>
            )}

            {viewState === 'CAMERA' && (
              <motion.div key="camera" className="absolute inset-0 z-50 bg-black" initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}}>
                <CameraScreen onCapture={handleImageCaptured} onClose={() => setViewState('DASHBOARD')} />
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

        {/* Safe Area Notch Mock */}
        <div className="hidden sm:block absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-900 rounded-b-3xl z-[100]"></div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <DataProvider>
      <MainApp />
    </DataProvider>
  );
}
