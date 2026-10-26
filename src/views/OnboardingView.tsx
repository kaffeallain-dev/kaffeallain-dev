import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { UserProfile } from '../types';
import { ArrowRight, Check, Globe, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { calculateDailyTarget } from '../lib/personalization';
import { useI18n } from '../lib/i18n';

export default function OnboardingView({ 
  onComplete, 
  onClose 
}: { 
  onComplete: () => void; 
  onClose?: () => void; 
}) {
  const { settings, updateSettings } = useData();
  const { t, lang, setLanguage } = useI18n();
  const [step, setStep] = useState(1);
  const [subStep, setSubStep] = useState(1);
  
  const [profile, setProfile] = useState<UserProfile>({
    primaryGoal: settings.profile?.primaryGoal || undefined,
    sex: settings.profile?.sex || undefined,
    age: settings.profile?.age || undefined,
    heightCm: settings.profile?.heightCm || undefined,
    weightKg: settings.profile?.weightKg || undefined,
    targetWeightKg: settings.profile?.targetWeightKg || undefined,
    activityLevel: settings.profile?.activityLevel || undefined,
    preferences: settings.profile?.preferences || [],
  });

  const [sexSelection, setSexSelection] = useState<string>(
    settings.profile?.sex 
      ? (settings.profile.sex === 'Male' || settings.profile.sex === 'Female' ? settings.profile.sex : 'Other')
      : ''
  ); 
  const [ageError, setAgeError] = useState('');
  
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm');
  const [heightFt, setHeightFt] = useState<number | ''>('');
  const [heightIn, setHeightIn] = useState<number | ''>('');
  const [heightError, setHeightError] = useState('');
  
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [weightLb, setWeightLb] = useState<number | ''>(
    settings.profile?.weightKg ? Number((settings.profile.weightKg * 2.20462).toFixed(1)) : ''
  );
  const [weightError, setWeightError] = useState('');
  
  const [targetWeightError, setTargetWeightError] = useState('');
  const [targetWeightWarning, setTargetWeightWarning] = useState(false);
  const [targetWeightLb, setTargetWeightLb] = useState<number | ''>(
    settings.profile?.targetWeightKg ? Number((settings.profile.targetWeightKg * 2.20462).toFixed(1)) : ''
  );

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

  const handleClose = () => {
    if (onClose) onClose();
    else onComplete();
  };

  const handleSkip = async () => {
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
    const minimalProfile: UserProfile = { 
      ...profile, 
      onboardingCompleted: true 
    };
    const dailyGoal = profile.primaryGoal ? calculateDailyTarget(minimalProfile) : 2000;
    await updateSettings({ 
      ...settings, 
      profile: minimalProfile, 
      dailyGoal, 
      onboardingCompleted: true 
    });
    onComplete();
  };

  const handleCompleteSetup = async () => {
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
    const finalProfile: UserProfile = { 
      ...profile, 
      startWeightKg: profile.weightKg, 
      onboardingCompleted: true 
    };
    const dailyGoal = calculateDailyTarget(finalProfile);
    await updateSettings({ 
      ...settings, 
      profile: finalProfile, 
      dailyGoal, 
      onboardingCompleted: true 
    });
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

  const selectHeightUnit = (unit: 'cm' | 'ft') => {
    if (heightUnit === unit) return;
    
    if (unit === 'ft') {
      if (profile.heightCm) {
        const totalInches = profile.heightCm / 2.54;
        setHeightFt(Math.floor(totalInches / 12));
        setHeightIn(Math.round(totalInches % 12));
      } else {
        setHeightFt('');
        setHeightIn('');
      }
    }
    setHeightUnit(unit);
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
        setAgeError(lang === 'fr' ? 'Veuillez entrer un âge entre 13 et 100 ans.' : 'Please enter an age between 13 and 100.');
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
        if (heightUnit === 'cm' && profile.heightCm >= 30 && profile.heightCm < 100) {
          setHeightError(lang === 'fr' 
            ? `${profile.heightCm} cm semble inhabituellement bas. Vérifiez ou utilisez ft/in.` 
            : `${profile.heightCm} cm looks unusually low. Check your height or switch to ft/in.`);
        } else {
          setHeightError(lang === 'fr' ? 'Veuillez entrer une taille valide.' : 'Please enter a valid height.');
        }
        isValid = false;
      } else {
        setHeightError('');
      }
    }
    
    if (profile.weightKg !== undefined && profile.weightKg !== null) {
      if (profile.weightKg < 25 || profile.weightKg > 300) {
        setWeightError(lang === 'fr' ? 'Veuillez vérifier le nombre et l’unité.' : 'Please check the number and unit.');
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
        setTargetWeightError(lang === 'fr' ? 'Veuillez vérifier le nombre et l’unité.' : 'Please check the number and unit.');
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
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-black text-emerald-900">MboaFit</h1>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-1 text-xs font-bold text-emerald-800">
              <Globe className="w-3.5 h-3.5" />
              <button 
                type="button"
                onClick={() => setLanguage('en')} 
                className={`px-1.5 py-0.5 rounded ${lang === 'en' ? 'bg-emerald-600 text-white' : 'text-emerald-700 hover:text-emerald-900'}`}
              >
                EN
              </button>
              <span>/</span>
              <button 
                type="button"
                onClick={() => setLanguage('fr')} 
                className={`px-1.5 py-0.5 rounded ${lang === 'fr' ? 'bg-emerald-600 text-white' : 'text-emerald-700 hover:text-emerald-900'}`}
              >
                FR
              </button>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="flex items-center gap-1.5 px-2.5 py-1 text-gray-500 hover:text-gray-800 rounded-full hover:bg-gray-100 transition-colors text-xs font-semibold"
              title={t('btn_close_wizard')}
              aria-label={t('btn_close_wizard')}
            >
              <X className="w-4 h-4" />
              <span>{t('btn_close_wizard')}</span>
            </button>
          </div>
        </div>
        <div className="mb-4">
          <h2 className="text-base font-bold text-gray-800 mb-2">{t('tagline')}</h2>
          <p className="text-gray-700 text-[13px] leading-relaxed">
            {t('subtagline')}
          </p>
        </div>
        
        <hr className="border-gray-100 mb-5" />
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-4">
        <div className="mb-2">
          <h3 className="font-bold text-gray-800 mb-3 text-sm">{t('main_goal_prompt')}</h3>
          <div className="space-y-2">
            {[
              { val: 'Lose Weight', label: t('goal_lose_weight') },
              { val: 'Gain Weight', label: t('goal_gain_weight') },
              { val: 'Build Muscle', label: t('goal_build_muscle') },
              { val: 'Maintain Weight', label: t('goal_maintain_weight') },
              { val: 'Eat Healthier', label: t('goal_eat_healthier') }
            ].map(({ val, label }) => (
              <button 
                key={val} 
                type="button"
                onClick={() => setProfile({...profile, primaryGoal: val as any})}
                className={`w-full py-3.5 px-4 text-left rounded-xl text-sm font-bold border-2 transition-all flex items-center justify-between ${profile.primaryGoal === val ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm' : 'border-gray-100 bg-white text-gray-500 hover:border-emerald-200 hover:bg-emerald-50/50'}`}
              >
                {label}
                {profile.primaryGoal === val && <Check className="w-4 h-4 text-emerald-500" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 pt-4 mt-auto shrink-0 flex flex-col gap-3 border-t border-gray-100 bg-white">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('step_of', { n: 1, m: 2 })}</span>
          <div className="flex gap-1">
            <div className="w-8 h-1.5 bg-emerald-500 rounded-full"></div>
            <div className="w-8 h-1.5 bg-gray-200 rounded-full"></div>
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            type="button"
            onClick={handleSkip}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleSkip();
              }
            }}
            tabIndex={0}
            className="px-5 py-3 rounded-xl font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            {t('btn_skip')}
          </button>
          <button 
            type="button"
            onClick={() => {
              if (!profile.activityLevel) setProfile(p => ({...p, activityLevel: undefined}));
              setStep(2);
            }}
            disabled={!profile.primaryGoal}
            className="flex-1 bg-emerald-600 disabled:bg-gray-300 disabled:shadow-none hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
          >
            {t('btn_continue')} <ArrowRight className="w-5 h-5" />
          </button>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="text-xs text-gray-400 hover:text-gray-600 font-semibold py-1 transition-colors text-center"
        >
          {t('btn_close_wizard')}
        </button>
      </div>
    </motion.div>
  );

  const renderStep2Progress = () => (
    <div className="flex items-center justify-between mb-6">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('step_of', { n: 2, m: 2 })}</span>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
          <span className={subStep === 1 ? "text-emerald-600" : ""}>1</span>
          <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
          <span className={subStep === 2 ? "text-emerald-600" : ""}>2</span>
          <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
          <span className={subStep === 3 ? "text-emerald-600" : ""}>3</span>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="flex items-center gap-1 px-2 py-1 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors text-xs font-semibold"
          title={t('btn_close_wizard')}
          aria-label={t('btn_close_wizard')}
        >
          <X className="w-4 h-4" />
          <span className="hidden sm:inline">{t('btn_close_wizard')}</span>
        </button>
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
          <h1 className="text-2xl font-black text-emerald-900 mb-1">{t('step2_title')}</h1>
          <p className="text-gray-600 text-[13px] leading-relaxed">{t('step2_desc')}</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4 space-y-6">
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">{t('age_label')}</label>
          <div className="relative">
            <input 
              type="number"
              placeholder="e.g. 20"
              value={profile.age || ''}
              onChange={e => handleAgeChange(e.target.value)}
              className={`w-full bg-gray-50 border ${ageError ? 'border-amber-400 focus:ring-amber-200' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-200'} rounded-xl px-4 py-3.5 text-gray-900 font-semibold focus:outline-none focus:ring-2`}
            />
            <span className="absolute right-4 top-3.5 text-gray-400 font-medium">{t('label_years')}</span>
          </div>
          {ageError && <p className="text-amber-600 text-xs font-bold mt-2">{ageError}</p>}
        </div>

        <div className="pb-4">
          <label className="block text-sm font-bold text-gray-800 mb-1">{t('sex_label')}</label>
          <p className="text-gray-500 text-xs mb-3">{t('sex_helper')}</p>
          <div className="space-y-2">
            {[
              { val: 'Female', label: t('sex_female') },
              { val: 'Male', label: t('sex_male') },
              { val: 'Prefer not to say', label: t('sex_prefer_not_to_say') },
              { val: "I'm not sure", label: t('sex_not_sure_option') }
            ].map(opt => (
              <button 
                key={opt.val}
                type="button"
                onClick={() => handleSexChange(opt.val)}
                className={`w-full py-3 px-4 text-left rounded-xl text-sm font-bold border-2 transition-all flex items-center justify-between ${sexSelection === opt.val ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm' : 'border-gray-100 bg-white text-gray-500 hover:border-emerald-200 hover:bg-emerald-50/50'}`}
              >
                {opt.label}
                {sexSelection === opt.val && <Check className="w-4 h-4 text-emerald-500" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 pt-4 mt-auto shrink-0 flex flex-col gap-3 border-t border-gray-100 bg-white">
        <div className="flex gap-3">
          <button 
            type="button"
            onClick={() => setStep(1)}
            className="px-5 py-3 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            {t('btn_back')}
          </button>
          <button 
            type="button"
            onClick={handleContinueSubStep1}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
          >
            {t('btn_continue')} <ArrowRight className="w-5 h-5" />
          </button>
        </div>
        <button 
          type="button"
          onClick={handleSkip} 
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleSkip();
            }
          }}
          tabIndex={0}
          className="text-sm font-bold text-emerald-700 hover:text-emerald-800 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-400 rounded-lg text-center"
        >
          {t('btn_skip_for_now')}
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
          <h1 className="text-2xl font-black text-emerald-900 mb-1">{t('onboarding_body_title')}</h1>
          <p className="text-gray-600 text-[13px] leading-relaxed">{t('onboarding_body_desc')}</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4 space-y-6">
        <div>
          <div className="flex items-end justify-between mb-2">
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-0.5">{t('height_label')}</label>
              <p className="text-gray-500 text-xs">{t('height_helper')}</p>
            </div>
            <div className="flex bg-gray-100 rounded-lg p-0.5 shrink-0">
              <button 
                type="button"
                onClick={() => selectHeightUnit('cm')} 
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${heightUnit === 'cm' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
              >
                cm
              </button>
              <button 
                type="button"
                onClick={() => selectHeightUnit('ft')} 
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${heightUnit === 'ft' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
              >
                ft/in
              </button>
            </div>
          </div>
          
          {heightUnit === 'cm' ? (
            <div className="relative">
              <input 
                type="number"
                placeholder="e.g. 170"
                value={profile.heightCm || ''}
                onChange={e => handleHeightCmChange(e.target.value)}
                className={`w-full bg-gray-50 border ${heightError ? 'border-amber-400 focus:ring-amber-200' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-200'} rounded-xl px-4 py-3.5 text-gray-900 font-semibold focus:outline-none focus:ring-2`}
              />
              <span className="absolute right-4 top-3.5 text-gray-400 font-medium">cm</span>
            </div>
          ) : (
            <div className="flex gap-3">
              <div className="relative flex-1">
                <input 
                  type="number"
                  placeholder="5"
                  value={heightFt}
                  onChange={e => handleHeightFtChange(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 font-semibold focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                />
                <span className="absolute right-4 top-3.5 text-gray-400 font-medium">ft</span>
              </div>
              <div className="relative flex-1">
                <input 
                  type="number"
                  placeholder="9"
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
              <label className="block text-sm font-bold text-gray-800 mb-0.5">{t('weight_label')}</label>
              <p className="text-gray-500 text-xs">{t('weight_helper')}</p>
            </div>
            <button type="button" onClick={toggleWeightUnit} className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
              {weightUnit === 'kg' ? t('switch_to_lb') : t('switch_to_kg')}
            </button>
          </div>
          
          <div className="relative">
            <input 
              type="number"
              step="0.1"
              value={weightUnit === 'kg' ? (profile.weightKg || '') : weightLb}
              onChange={e => handleWeightChange(e.target.value)}
              className={`w-full bg-gray-50 border ${weightError ? 'border-amber-400 focus:ring-amber-200' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-200'} rounded-xl px-4 py-3.5 text-gray-900 font-semibold focus:outline-none focus:ring-2`}
            />
            <span className="absolute right-4 top-3.5 text-gray-400 font-medium">{weightUnit}</span>
          </div>
          {weightError && <p className="text-amber-600 text-xs font-bold mt-2">{weightError}</p>}
        </div>
      </div>

      <div className="p-6 pt-4 mt-auto shrink-0 flex flex-col gap-3 border-t border-gray-100 bg-white">
        <div className="flex gap-3">
          <button 
            type="button"
            onClick={() => setSubStep(1)}
            className="px-5 py-3 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            {t('btn_back')}
          </button>
          <button 
            type="button"
            onClick={handleContinueSubStep2}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
          >
            {t('btn_continue')} <ArrowRight className="w-5 h-5" />
          </button>
        </div>
        <button 
          type="button"
          onClick={handleSkip} 
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleSkip();
            }
          }}
          tabIndex={0}
          className="text-sm font-bold text-emerald-700 hover:text-emerald-800 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-400 rounded-lg text-center"
        >
          {t('btn_skip_for_now')}
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
          <h1 className="text-2xl font-black text-emerald-900 mb-1">{t('activity_label')}</h1>
          <p className="text-gray-600 text-[13px] leading-relaxed">{t('activity_helper')}</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4 space-y-6">
        <div className="space-y-2">
          {[
            { label: t('act_mostly_sitting'), desc: t('act_mostly_sitting_desc'), val: 'Sedentary' },
            { label: t('act_light_activity'), desc: t('act_light_activity_desc'), val: 'Lightly Active' },
            { label: t('act_active_most_days'), desc: t('act_active_most_days_desc'), val: 'Moderately Active' },
            { label: t('act_very_active'), desc: t('act_very_active_desc'), val: 'Very Active' },
            { label: t('act_not_sure'), desc: t('act_not_sure_desc'), val: undefined }
          ].map(opt => {
            const isSelected = profile.activityLevel === opt.val;
            return (
              <button 
                key={opt.label}
                type="button"
                onClick={() => setProfile({...profile, activityLevel: opt.val as any})}
                className={`w-full p-3 text-left rounded-xl border-2 transition-all flex flex-col ${isSelected ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100 bg-white hover:border-emerald-200 hover:bg-emerald-50/50'}`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-sm font-bold ${isSelected ? 'text-emerald-800' : 'text-gray-800'}`}>{opt.label}</span>
                  {isSelected && <Check className="w-4 h-4 text-emerald-500" />}
                </div>
                <span className={`text-xs ${isSelected ? 'text-emerald-700' : 'text-gray-500'}`}>{opt.desc}</span>
              </button>
            );
          })}
        </div>

        {showTargetWeight && (
          <div className="pt-4 border-t border-gray-100 pb-4">
            <label className="block text-sm font-bold text-gray-800 mb-1">{t('target_weight_label')}</label>
            <p className="text-gray-500 text-xs mb-3">{t('target_weight_helper')}</p>
            
            <div className="relative">
              <input 
                type="number"
                step="0.1"
                value={weightUnit === 'kg' ? (profile.targetWeightKg || '') : targetWeightLb}
                onChange={e => handleTargetWeightChange(e.target.value)}
                className={`w-full bg-gray-50 border ${targetWeightError ? 'border-amber-400 focus:ring-amber-200' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-200'} rounded-xl px-4 py-3.5 text-gray-900 font-semibold focus:outline-none focus:ring-2`}
              />
              <span className="absolute right-4 top-3.5 text-gray-400 font-medium">{weightUnit}</span>
            </div>
            {targetWeightError && <p className="text-amber-600 text-xs font-bold mt-2">{targetWeightError}</p>}
            
            {targetWeightWarning && (
              <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                <p className="text-amber-800 text-xs font-semibold mb-2">
                  {t('target_weight_warning_title')}
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setTargetWeightWarning(false)} className="px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-amber-700 text-xs font-bold hover:bg-amber-50">
                    {t('btn_review')}
                  </button>
                  <button type="button" onClick={handleCompleteSetup} className="px-3 py-1.5 bg-amber-600 rounded-lg text-white text-xs font-bold hover:bg-amber-700">
                    {t('btn_continue_anyway')}
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
            type="button"
            onClick={() => setSubStep(2)}
            className="px-5 py-3 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            {t('btn_back')}
          </button>
          {!targetWeightWarning && (
            <button 
              type="button"
              onClick={handleContinueSubStep3}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
            >
              {t('btn_finish')} <Check className="w-5 h-5" />
            </button>
          )}
        </div>
        {!targetWeightWarning && (
          <button 
            type="button"
            onClick={handleSkip} 
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleSkip();
              }
            }}
            tabIndex={0}
            className="text-sm font-bold text-emerald-700 hover:text-emerald-800 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-400 rounded-lg text-center"
          >
            {t('btn_skip_for_now')}
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
