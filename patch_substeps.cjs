const fs = require('fs');

const code = `import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { UserProfile } from '../types';
import { ArrowRight, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { calculateDailyTarget } from '../lib/personalization';

export default function OnboardingView({ onComplete }: { onComplete: () => void }) {
  const { settings, updateSettings } = useData();
  const [step, setStep] = useState(1);
  const [subStep, setSubStep] = useState(1);
  
  const [profile, setProfile] = useState<UserProfile>({
    primaryGoal: undefined,
    sex: undefined,
    age: undefined,
    heightCm: undefined,
    weightKg: undefined,
    targetWeightKg: undefined,
    activityLevel: undefined,
  });

  const [sexSelection, setSexSelection] = useState<string>(''); 
  const [ageError, setAgeError] = useState('');
  
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm');
  const [heightFt, setHeightFt] = useState<number | ''>('');
  const [heightIn, setHeightIn] = useState<number | ''>('');
  const [heightError, setHeightError] = useState('');
  
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [weightLb, setWeightLb] = useState<number | ''>('');
  const [weightError, setWeightError] = useState('');
  
  const [targetWeightError, setTargetWeightError] = useState('');
  const [targetWeightWarning, setTargetWeightWarning] = useState(false);
  const [targetWeightLb, setTargetWeightLb] = useState<number | ''>('');

  useEffect(() => {
    // When profile changes, ensure sexSelection is in sync initially
    if (profile.sex && !sexSelection) {
      if (profile.sex === 'Male' || profile.sex === 'Female') {
        setSexSelection(profile.sex);
      } else {
        setSexSelection('Other');
      }
    }
  }, [profile.sex, sexSelection]);

  const handleSkip = async () => {
    const minimalProfile = { primaryGoal: profile.primaryGoal };
    const dailyGoal = calculateDailyTarget(minimalProfile);
    await updateSettings({ ...settings, profile: minimalProfile, dailyGoal });
    onComplete();
  };

  const handleCompleteSetup = async () => {
    const finalProfile = { ...profile, startWeightKg: profile.weightKg };
    const dailyGoal = calculateDailyTarget(finalProfile);
    await updateSettings({ ...settings, profile: finalProfile, dailyGoal });
    onComplete();
  };

  const showTargetWeight = profile.primaryGoal === 'Lose Weight' || profile.primaryGoal === 'Gain Weight';

  const handleAgeChange = (val: string) => {
    setProfile({ ...profile, age: val ? Number(val) : undefined });
    setAgeError('');
  };

  const handleSexChange = (val: string) => {
    setSexSelection(val);
    if (val === 'Male' || val === 'Female') {
      setProfile({ ...profile, sex: val });
    } else {
      setProfile({ ...profile, sex: 'Other' });
    }
  };

  const handleHeightCmChange = (val: string) => {
    setProfile({ ...profile, heightCm: val ? Number(val) : undefined });
    setHeightError('');
  };

  const handleHeightFtChange = (val: string) => {
    const f = val ? Number(val) : '';
    setHeightFt(f);
    if (f !== '') {
      const totalInches = (f * 12) + (typeof heightIn === 'number' ? heightIn : 0);
      setProfile({ ...profile, heightCm: Math.round(totalInches * 2.54) });
    } else if (heightIn === '') {
      setProfile({ ...profile, heightCm: undefined });
    }
    setHeightError('');
  };

  const handleHeightInChange = (val: string) => {
    const i = val ? Number(val) : '';
    setHeightIn(i);
    if (i !== '' || heightFt !== '') {
      const f = typeof heightFt === 'number' ? heightFt : 0;
      const totalInches = (f * 12) + (i !== '' ? Number(i) : 0);
      setProfile({ ...profile, heightCm: Math.round(totalInches * 2.54) });
    } else {
      setProfile({ ...profile, heightCm: undefined });
    }
    setHeightError('');
  };

  const toggleHeightUnit = () => {
    if (heightUnit === 'cm') {
      setHeightUnit('ft');
      if (profile.heightCm) {
        const totalInches = profile.heightCm / 2.54;
        setHeightFt(Math.floor(totalInches / 12));
        setHeightIn(Math.round(totalInches % 12));
      } else {
        setHeightFt('');
        setHeightIn('');
      }
    } else {
      setHeightUnit('cm');
    }
    setHeightError('');
  };

  const handleWeightChange = (val: string) => {
    if (weightUnit === 'kg') {
      setProfile({ ...profile, weightKg: val ? Number(val) : undefined });
    } else {
      const lb = val ? Number(val) : '';
      setWeightLb(lb);
      setProfile({ ...profile, weightKg: lb !== '' ? Number((lb / 2.20462).toFixed(1)) : undefined });
    }
    setWeightError('');
  };

  const handleTargetWeightChange = (val: string) => {
    if (weightUnit === 'kg') {
      setProfile({ ...profile, targetWeightKg: val ? Number(val) : undefined });
    } else {
      const lb = val ? Number(val) : '';
      setTargetWeightLb(lb);
      setProfile({ ...profile, targetWeightKg: lb !== '' ? Number((lb / 2.20462).toFixed(1)) : undefined });
    }
    setTargetWeightError('');
    setTargetWeightWarning(false);
  };

  const toggleWeightUnit = () => {
    if (weightUnit === 'kg') {
      setWeightUnit('lb');
      if (profile.weightKg) setWeightLb(Number((profile.weightKg * 2.20462).toFixed(1)));
      if (profile.targetWeightKg) setTargetWeightLb(Number((profile.targetWeightKg * 2.20462).toFixed(1)));
    } else {
      setWeightUnit('kg');
    }
    setWeightError('');
    setTargetWeightError('');
  };

  const validateSubStep1 = () => {
    if (profile.age !== undefined && profile.age !== null) {
      if (profile.age < 13 || profile.age > 100) {
        setAgeError('Please enter an age between 13 and 100.');
        return false;
      }
    }
    setAgeError('');
    return true;
  };

  const validateSubStep2 = () => {
    let isValid = true;
    if (profile.heightCm !== undefined && profile.heightCm !== null) {
      if (profile.heightCm < 100 || profile.heightCm > 250) {
        setHeightError('Please check your height and unit.');
        isValid = false;
      } else {
        setHeightError('');
      }
    }
    
    if (profile.weightKg !== undefined && profile.weightKg !== null) {
      if (profile.weightKg < 25 || profile.weightKg > 300) {
        setWeightError('Please check the number and unit.');
        isValid = false;
      } else {
        setWeightError('');
      }
    }
    return isValid;
  };

  const validateSubStep3 = () => {
    if (profile.targetWeightKg !== undefined && profile.targetWeightKg !== null) {
      if (profile.targetWeightKg < 25 || profile.targetWeightKg > 300) {
        setTargetWeightError('Please check the number and unit.');
        return false;
      }
      setTargetWeightError('');
      
      if (!targetWeightWarning && profile.weightKg !== undefined && profile.weightKg !== null) {
        const diff = Math.abs(profile.targetWeightKg - profile.weightKg);
        if (diff > 20 || diff > profile.weightKg * 0.2) {
          setTargetWeightWarning(true);
          return false;
        }
      }
    }
    return true;
  };

  const handleContinueSubStep1 = () => {
    if (validateSubStep1()) setSubStep(2);
  };

  const handleContinueSubStep2 = () => {
    if (validateSubStep2()) setSubStep(3);
  };

  const handleContinueSubStep3 = () => {
    if (validateSubStep3()) handleCompleteSetup();
  };

  const renderStep1 = () => (
    <motion.div 
      key="step1"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white rounded-3xl shadow-xl w-full max-w-sm flex flex-col my-auto max-h-full overflow-hidden"
    >
      <div className="p-6 pb-2 shrink-0">
        <div className="mb-4">
          <h1 className="text-2xl font-black text-emerald-900 mb-1">MboaFit</h1>
          <h2 className="text-base font-bold text-gray-800 mb-2">Eat better. Track less.</h2>
          <p className="text-gray-700 text-[13px] leading-relaxed">
            Snap your meals, understand what you're eating, and get nutrition guidance built around your goals.
          </p>
        </div>
        
        <hr className="border-gray-100 mb-5" />
      </div>

      <div className="px-6 pb-4 overflow-y-auto">
        <div className="mb-2">
          <h3 className="font-bold text-gray-800 mb-3 text-sm">What is your main goal?</h3>
          <div className="space-y-2">
            {['Lose Weight', 'Gain Weight', 'Build Muscle', 'Maintain Weight', 'Eat Healthier'].map(g => (
              <button 
                key={g} 
                onClick={() => setProfile({...profile, primaryGoal: g as any})}
                className={\`w-full py-3.5 px-4 text-left rounded-xl text-sm font-bold border-2 transition-all flex items-center justify-between \${profile.primaryGoal === g ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm' : 'border-gray-100 bg-white text-gray-500 hover:border-emerald-200 hover:bg-emerald-50/50'}\`}
              >
                {g}
                {profile.primaryGoal === g && <Check className="w-4 h-4 text-emerald-500" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 pt-4 mt-auto shrink-0 flex flex-col gap-3 border-t border-gray-100 bg-white">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Step 1 of 2</span>
          <div className="flex gap-1">
            <div className="w-8 h-1.5 bg-emerald-500 rounded-full"></div>
            <div className="w-8 h-1.5 bg-gray-200 rounded-full"></div>
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={handleSkip}
            className="px-5 py-3 rounded-xl font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors whitespace-nowrap"
          >
            Skip
          </button>
          <button 
            onClick={() => {
              // Initialize profile defaults for Step 2 if needed
              if (!profile.activityLevel) setProfile(p => ({...p, activityLevel: undefined}));
              setStep(2);
            }}
            disabled={!profile.primaryGoal}
            className="flex-1 bg-emerald-600 disabled:bg-gray-300 disabled:shadow-none hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
          >
            Continue <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </motion.div>
  );

  const renderStep2Progress = () => (
    <div className="flex items-center justify-between mb-6">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Step 2 of 2</span>
      <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
        <span className={subStep === 1 ? "text-emerald-600" : ""}>1</span>
        <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
        <span className={subStep === 2 ? "text-emerald-600" : ""}>2</span>
        <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
        <span className={subStep === 3 ? "text-emerald-600" : ""}>3</span>
      </div>
    </div>
  );

  const renderSubStep1 = () => (
    <motion.div 
      key="step2-1"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-white rounded-3xl shadow-xl w-full max-w-sm flex flex-col my-auto max-h-full overflow-hidden"
    >
      <div className="p-6 pb-2 shrink-0">
        {renderStep2Progress()}
        
        <div className="mb-2">
          <h1 className="text-2xl font-black text-emerald-900 mb-1">Let's personalize your estimate</h1>
          <p className="text-gray-600 text-[13px] leading-relaxed">A few details help us make your nutrition guidance more relevant.</p>
        </div>
      </div>
      
      <div className="px-6 py-4 space-y-6 overflow-y-auto">
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">How old are you?</label>
          <div className="relative">
            <input 
              type="number"
              placeholder="e.g. 20"
              value={profile.age || ''}
              onChange={e => handleAgeChange(e.target.value)}
              className={\`w-full bg-gray-50 border \${ageError ? 'border-amber-400 focus:ring-amber-200' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-200'} rounded-xl px-4 py-3.5 text-gray-900 font-semibold focus:outline-none focus:ring-2\`}
            />
            <span className="absolute right-4 top-3.5 text-gray-400 font-medium">years</span>
          </div>
          {ageError && <p className="text-amber-600 text-xs font-bold mt-2">{ageError}</p>}
        </div>

        <div className="pb-4">
          <label className="block text-sm font-bold text-gray-800 mb-1">Which sex should we use for your energy estimate?</label>
          <p className="text-gray-500 text-xs mb-3">This helps us estimate your daily energy needs. You can skip this.</p>
          <div className="space-y-2">
            {['Female', 'Male', 'Prefer not to say', "I'm not sure"].map(opt => (
              <button 
                key={opt}
                onClick={() => handleSexChange(opt)}
                className={\`w-full py-3 px-4 text-left rounded-xl text-sm font-bold border-2 transition-all flex items-center justify-between \${sexSelection === opt ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm' : 'border-gray-100 bg-white text-gray-500 hover:border-emerald-200 hover:bg-emerald-50/50'}\`}
              >
                {opt}
                {sexSelection === opt && <Check className="w-4 h-4 text-emerald-500" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 pt-4 mt-auto shrink-0 flex flex-col gap-3 border-t border-gray-100 bg-white">
        <div className="flex gap-3">
          <button 
            onClick={() => setStep(1)}
            className="px-5 py-3 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Back
          </button>
          <button 
            onClick={handleContinueSubStep1}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
          >
            Continue <ArrowRight className="w-5 h-5" />
          </button>
        </div>
        <button onClick={handleSkip} className="text-sm font-bold text-emerald-700 hover:text-emerald-800 py-1">
          Skip for now
        </button>
      </div>
    </motion.div>
  );

  const renderSubStep2 = () => (
    <motion.div 
      key="step2-2"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-white rounded-3xl shadow-xl w-full max-w-sm flex flex-col my-auto max-h-full overflow-hidden"
    >
      <div className="p-6 pb-2 shrink-0">
        {renderStep2Progress()}
        
        <div className="mb-2">
          <h1 className="text-2xl font-black text-emerald-900 mb-1">Tell us about your body</h1>
          <p className="text-gray-600 text-[13px] leading-relaxed">These measurements help improve your nutrition estimate.</p>
        </div>
      </div>
      
      <div className="px-6 py-4 space-y-6 overflow-y-auto">
        <div>
          <div className="flex items-end justify-between mb-2">
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-0.5">How tall are you?</label>
              <p className="text-gray-500 text-xs">Used to improve your nutrition estimate.</p>
            </div>
            <button onClick={toggleHeightUnit} className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
              {heightUnit === 'cm' ? 'Switch to ft/in' : 'Switch to cm'}
            </button>
          </div>
          
          {heightUnit === 'cm' ? (
            <div className="relative">
              <input 
                type="number"
                value={profile.heightCm || ''}
                onChange={e => handleHeightCmChange(e.target.value)}
                className={\`w-full bg-gray-50 border \${heightError ? 'border-amber-400 focus:ring-amber-200' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-200'} rounded-xl px-4 py-3.5 text-gray-900 font-semibold focus:outline-none focus:ring-2\`}
              />
              <span className="absolute right-4 top-3.5 text-gray-400 font-medium">cm</span>
            </div>
          ) : (
            <div className="flex gap-3">
              <div className="relative flex-1">
                <input 
                  type="number"
                  value={heightFt}
                  onChange={e => handleHeightFtChange(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 font-semibold focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                />
                <span className="absolute right-4 top-3.5 text-gray-400 font-medium">ft</span>
              </div>
              <div className="relative flex-1">
                <input 
                  type="number"
                  value={heightIn}
                  onChange={e => handleHeightInChange(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 font-semibold focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                />
                <span className="absolute right-4 top-3.5 text-gray-400 font-medium">in</span>
              </div>
            </div>
          )}
          {heightError && <p className="text-amber-600 text-xs font-bold mt-2">{heightError}</p>}
        </div>

        <div className="pb-4">
          <div className="flex items-end justify-between mb-2">
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-0.5">What is your current weight?</label>
              <p className="text-gray-500 text-xs">Helps set targets and track change over time. An estimate is okay.</p>
            </div>
            <button onClick={toggleWeightUnit} className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
              {weightUnit === 'kg' ? 'Switch to lb' : 'Switch to kg'}
            </button>
          </div>
          
          <div className="relative">
            <input 
              type="number"
              step="0.1"
              value={weightUnit === 'kg' ? (profile.weightKg || '') : weightLb}
              onChange={e => handleWeightChange(e.target.value)}
              className={\`w-full bg-gray-50 border \${weightError ? 'border-amber-400 focus:ring-amber-200' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-200'} rounded-xl px-4 py-3.5 text-gray-900 font-semibold focus:outline-none focus:ring-2\`}
            />
            <span className="absolute right-4 top-3.5 text-gray-400 font-medium">{weightUnit}</span>
          </div>
          {weightError && <p className="text-amber-600 text-xs font-bold mt-2">{weightError}</p>}
        </div>
      </div>

      <div className="p-6 pt-4 mt-auto shrink-0 flex flex-col gap-3 border-t border-gray-100 bg-white">
        <div className="flex gap-3">
          <button 
            onClick={() => setSubStep(1)}
            className="px-5 py-3 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Back
          </button>
          <button 
            onClick={handleContinueSubStep2}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
          >
            Continue <ArrowRight className="w-5 h-5" />
          </button>
        </div>
        <button onClick={handleSkip} className="text-sm font-bold text-emerald-700 hover:text-emerald-800 py-1">
          Skip for now
        </button>
      </div>
    </motion.div>
  );

  const renderSubStep3 = () => (
    <motion.div 
      key="step2-3"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-white rounded-3xl shadow-xl w-full max-w-sm flex flex-col my-auto max-h-full overflow-hidden"
    >
      <div className="p-6 pb-2 shrink-0">
        {renderStep2Progress()}
        
        <div className="mb-2">
          <h1 className="text-2xl font-black text-emerald-900 mb-1">How active are you?</h1>
          <p className="text-gray-600 text-[13px] leading-relaxed">Choose the option that best matches your usual routine.</p>
        </div>
      </div>
      
      <div className="px-6 py-4 space-y-6 overflow-y-auto">
        <div className="space-y-2">
          {[
            { label: 'Mostly sitting', desc: 'Little planned exercise; most of the day is seated.', val: 'Sedentary' },
            { label: 'Light activity', desc: 'Walking or light exercise 1–3 days per week.', val: 'Lightly Active' },
            { label: 'Active most days', desc: 'Exercise, sports, or lots of walking 3–5 days per week.', val: 'Moderately Active' },
            { label: 'Very active', desc: 'Hard training, sports, or physically demanding work most days.', val: 'Very Active' },
            { label: 'Not sure', desc: "We'll start with a general estimate.", val: undefined }
          ].map(opt => {
            const isSelected = profile.activityLevel === opt.val;
            return (
              <button 
                key={opt.label}
                onClick={() => setProfile({...profile, activityLevel: opt.val as any})}
                className={\`w-full p-3 text-left rounded-xl border-2 transition-all flex flex-col \${isSelected ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100 bg-white hover:border-emerald-200 hover:bg-emerald-50/50'}\`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className={\`text-sm font-bold \${isSelected ? 'text-emerald-800' : 'text-gray-800'}\`}>{opt.label}</span>
                  {isSelected && <Check className="w-4 h-4 text-emerald-500" />}
                </div>
                <span className={\`text-xs \${isSelected ? 'text-emerald-700' : 'text-gray-500'}\`}>{opt.desc}</span>
              </button>
            )
          })}
        </div>

        {showTargetWeight && (
          <div className="pt-4 border-t border-gray-100 pb-4">
            <label className="block text-sm font-bold text-gray-800 mb-1">Do you have a target weight?</label>
            <p className="text-gray-500 text-xs mb-3">Optional. You can change this anytime.</p>
            
            <div className="relative">
              <input 
                type="number"
                step="0.1"
                value={weightUnit === 'kg' ? (profile.targetWeightKg || '') : targetWeightLb}
                onChange={e => handleTargetWeightChange(e.target.value)}
                className={\`w-full bg-gray-50 border \${targetWeightError ? 'border-amber-400 focus:ring-amber-200' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-200'} rounded-xl px-4 py-3.5 text-gray-900 font-semibold focus:outline-none focus:ring-2\`}
              />
              <span className="absolute right-4 top-3.5 text-gray-400 font-medium">{weightUnit}</span>
            </div>
            {targetWeightError && <p className="text-amber-600 text-xs font-bold mt-2">{targetWeightError}</p>}
            
            {targetWeightWarning && (
              <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                <p className="text-amber-800 text-xs font-semibold mb-2">
                  This target is quite different from your current weight. Would you like to review it?
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setTargetWeightWarning(false)} className="px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-amber-700 text-xs font-bold hover:bg-amber-50">
                    Review
                  </button>
                  <button onClick={handleCompleteSetup} className="px-3 py-1.5 bg-amber-600 rounded-lg text-white text-xs font-bold hover:bg-amber-700">
                    Continue anyway
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-6 pt-4 mt-auto shrink-0 flex flex-col gap-3 border-t border-gray-100 bg-white">
        <div className="flex gap-3">
          <button 
            onClick={() => setSubStep(2)}
            className="px-5 py-3 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Back
          </button>
          {!targetWeightWarning && (
            <button 
              onClick={handleContinueSubStep3}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
            >
              Finish <Check className="w-5 h-5" />
            </button>
          )}
        </div>
        {!targetWeightWarning && (
          <button onClick={handleSkip} className="text-sm font-bold text-emerald-700 hover:text-emerald-800 py-1">
            Skip for now
          </button>
        )}
      </div>
    </motion.div>
  );

  return (
    <div className="max-w-md mx-auto w-full h-[100dvh] bg-emerald-50 flex flex-col items-center justify-center p-4 sm:p-6 pb-safe overflow-hidden">
      <AnimatePresence mode="wait">
        {step === 1 && renderStep1()}
        {step === 2 && subStep === 1 && renderSubStep1()}
        {step === 2 && subStep === 2 && renderSubStep2()}
        {step === 2 && subStep === 3 && renderSubStep3()}
      </AnimatePresence>
    </div>
  );
}
`;
fs.writeFileSync('./src/views/OnboardingView.tsx', code);
