import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Globe,
  LogIn,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Utensils,
  X
} from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../context/AuthContext';

function usePrefersReducedMotion(): boolean {
  const motionHookPref = useReducedMotion();
  const [mediaQueryPref, setMediaQueryPref] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setMediaQueryPref(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMediaQueryPref(e.matches);
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, []);

  return Boolean(motionHookPref || mediaQueryPref);
}

export interface WelcomeScreenProps {
  onProceedToOnboarding: () => void;
  onDismissToDashboard: () => void;
  isReplay?: boolean;
}

export default function WelcomeScreen({
  onProceedToOnboarding,
  onDismissToDashboard,
  isReplay = false
}: WelcomeScreenProps) {
  const { t, lang, setLanguage } = useI18n();
  const auth = useAuth();
  const prefersReducedMotion = usePrefersReducedMotion();

  const [step, setStep] = useState<'INTRO' | 'AUTH_CHOICE'>('INTRO');
  const [isSigningIn, setIsSigningIn] = useState(false);

  const markWelcomeSeen = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('mboafit_welcome_seen', 'true');
    }
  };

  const handleStartClick = () => {
    markWelcomeSeen();
    setStep('AUTH_CHOICE');
  };

  const handleContinueAsGuest = () => {
    markWelcomeSeen();
    onProceedToOnboarding();
  };

  const handleGoogleSignIn = async () => {
    markWelcomeSeen();
    if (!auth?.signInWithGoogle) {
      onProceedToOnboarding();
      return;
    }
    setIsSigningIn(true);
    try {
      await auth.signInWithGoogle();
      onProceedToOnboarding();
    } catch {
      // Even if popup is cancelled in preview environment, let user continue smoothly
      setIsSigningIn(false);
    }
  };

  const handleQuickDismiss = () => {
    markWelcomeSeen();
    onDismissToDashboard();
  };

  // Gentle floating animation props that strictly respect prefers-reduced-motion
  const plateFloatAnimation = prefersReducedMotion
    ? {}
    : {
        animate: { y: [0, -7, 0], rotate: [0, 1.2, 0] },
        transition: { duration: 4.5, repeat: Infinity, ease: 'easeInOut' as const }
      };

  const badgeFloatLeft = prefersReducedMotion
    ? {}
    : {
        animate: { y: [0, 5, 0] },
        transition: { duration: 3.8, repeat: Infinity, ease: 'easeInOut' as const, delay: 0.3 }
      };

  const badgeFloatRight = prefersReducedMotion
    ? {}
    : {
        animate: { y: [0, -5, 0] },
        transition: { duration: 4.1, repeat: Infinity, ease: 'easeInOut' as const, delay: 0.7 }
      };

  return (
    <div
      data-testid="welcome-screen"
      data-reduced-motion={prefersReducedMotion ? 'true' : 'false'}
      className="h-full w-full bg-[#F7F9F4] text-slate-900 flex flex-col justify-between px-6 py-6 overflow-y-auto select-none"
    >
      {/* Top Bar: Brand + Language Toggle + Optional Back/Skip */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-[#064E3B] text-white flex items-center justify-center font-bold text-base shadow-2xs">
            M
          </div>
          <span className="text-lg font-bold tracking-tight text-[#064E3B]">
            MboaFit
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="welcome-lang-toggle"
            onClick={() => setLanguage(lang === 'en' ? 'fr' : 'en')}
            className="min-h-[44px] px-3 py-1.5 rounded-xl bg-white border border-emerald-200/80 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 transition-colors inline-flex items-center gap-1.5 shadow-2xs"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-700" />
            <span>{lang === 'en' ? 'FR' : 'EN'}</span>
          </button>

          <button
            type="button"
            data-testid="welcome-skip-to-app-btn"
            onClick={handleQuickDismiss}
            aria-label={isReplay ? t('welcome_back_to_app') : t('welcome_skip_to_app')}
            className="min-h-[44px] px-3 py-1.5 rounded-xl bg-white/80 hover:bg-white border border-slate-200/80 text-xs font-semibold text-slate-700 transition-colors inline-flex items-center gap-1"
          >
            <span>{isReplay ? t('welcome_back_to_app') : t('btn_skip')}</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Center Content: Animated Local Food Platter Graphic + Editorial Copy */}
      <div className="my-auto py-5 space-y-6">
        {/* Gentle Animated Local Meal Illustration Container */}
        <div
          data-testid="welcome-animated-food-graphic"
          className="relative mx-auto w-full max-w-[290px] h-52 rounded-3xl bg-gradient-to-br from-[#064E3B] via-[#065F46] to-[#047857] p-5 shadow-md flex items-center justify-center overflow-hidden border border-emerald-800/40"
        >
          {/* Soft ambient botanical circles */}
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-emerald-400/15 pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-28 h-28 rounded-full bg-amber-300/15 pointer-events-none" />

          {/* Animated Center Plate SVG Illustration */}
          <motion.div
            {...plateFloatAnimation}
            data-testid="welcome-moving-plate"
            className="relative z-10 w-32 h-32 rounded-full bg-[#FAF8F2] shadow-lg border-4 border-emerald-200/80 flex items-center justify-center"
          >
            <svg
              viewBox="0 0 120 120"
              className="w-24 h-24"
              role="img"
              aria-label="Traditional Cameroonian meal bowl with Ndolé, plantains, and rice and beans"
            >
              {/* Inner plate rim */}
              <circle cx="60" cy="60" r="48" fill="#F3EFE6" stroke="#D6D3C9" strokeWidth="1.5" />
              {/* Leafy green Ndolé / Eru portion */}
              <path
                d="M26 58 C26 36, 56 26, 66 44 C74 58, 52 74, 34 68 Z"
                fill="#15803D"
              />
              <circle cx="44" cy="48" r="3.5" fill="#86EFAC" />
              <circle cx="54" cy="54" r="3" fill="#BBF7D0" />
              {/* Golden ripe plantain slices */}
              <ellipse cx="78" cy="46" rx="13" ry="8" transform="rotate(24 78 46)" fill="#F59E0B" />
              <ellipse cx="82" cy="62" rx="13" ry="8" transform="rotate(12 82 62)" fill="#D97706" />
              {/* Warm rice & red beans portion */}
              <path
                d="M36 74 C46 64, 74 68, 78 84 C70 96, 44 94, 36 74 Z"
                fill="#FFFFFF"
              />
              <circle cx="52" cy="79" r="3.5" fill="#991B1B" />
              <circle cx="62" cy="83" r="3.5" fill="#7F1D1D" />
              <circle cx="57" cy="74" r="3" fill="#B91C1C" />
            </svg>
          </motion.div>

          {/* Gentle Floating Dish Labels */}
          <motion.div
            {...badgeFloatLeft}
            className="absolute top-3.5 left-3.5 bg-[#FAF8F2]/95 text-[#064E3B] px-2.5 py-1 rounded-xl text-[11px] font-bold shadow-xs flex items-center gap-1"
          >
            <Utensils className="w-3 h-3 text-emerald-700" />
            <span>{t('welcome_dish_ndole')}</span>
          </motion.div>

          <motion.div
            {...badgeFloatRight}
            className="absolute bottom-3.5 right-3.5 bg-[#FAF8F2]/95 text-[#064E3B] px-2.5 py-1 rounded-xl text-[11px] font-bold shadow-xs flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3 text-amber-600" />
            <span>{t('welcome_dish_rice_beans')}</span>
          </motion.div>
        </div>

        {/* Headline & Tagline */}
        <div className="space-y-2.5 text-center">
          <p className="text-xs font-semibold text-emerald-800 tracking-tight">
            {t('welcome_badge')}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-[#064E3B] leading-snug">
            {t('welcome_title')}
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            {t('welcome_subtitle')}
          </p>
        </div>

        {step === 'INTRO' ? (
          /* Value Highlights Card */
          <div className="bg-white rounded-2xl p-4 border border-emerald-100/90 shadow-2xs space-y-2.5 text-xs text-slate-700">
            <div className="flex items-center gap-2.5">
              <Camera className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{t('welcome_feature_1')}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{t('welcome_feature_2')}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{t('welcome_feature_3')}</span>
            </div>
          </div>
        ) : (
          /* Step 2 after clicking Start: Sign in with Google or Continue as Guest -> Optional Profile Setup */
          <div
            data-testid="welcome-auth-choice-panel"
            className="bg-white rounded-3xl p-5 border border-emerald-200/80 shadow-xs space-y-3"
          >
            <p className="text-xs font-bold text-[#064E3B] text-center">
              {t('welcome_choose_how_to_begin')}
            </p>

            <button
              type="button"
              data-testid="welcome-google-signin-btn"
              disabled={isSigningIn}
              onClick={handleGoogleSignIn}
              className="w-full min-h-[46px] py-3 px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-900 font-semibold text-sm border border-slate-200 transition-colors flex items-center justify-center gap-2 shadow-2xs"
            >
              <LogIn className="w-4 h-4 text-emerald-700" />
              <span>{t('sign_in_google')}</span>
            </button>

            <button
              type="button"
              data-testid="welcome-continue-guest-btn"
              onClick={handleContinueAsGuest}
              className="w-full min-h-[46px] py-3 px-4 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-xs"
            >
              <UserCheck className="w-4 h-4" />
              <span>{t('welcome_continue_guest')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              data-testid="welcome-direct-home-btn"
              onClick={handleQuickDismiss}
              className="w-full min-h-[40px] py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors text-center"
            >
              {isReplay ? t('welcome_back_to_app') : t('welcome_skip_to_app')}
            </button>
          </div>
        )}
      </div>

      {/* Bottom Action Area */}
      <div className="space-y-2.5 shrink-0 pt-2">
        {step === 'INTRO' && (
          <>
            <button
              type="button"
              data-testid="welcome-start-btn"
              onClick={handleStartClick}
              className="w-full min-h-[48px] py-3.5 px-6 rounded-2xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-base transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <span>{t('welcome_start_btn')}</span>
              <ArrowRight className="w-5 h-5" />
            </button>

            {isReplay && (
              <button
                type="button"
                data-testid="welcome-return-btn"
                onClick={handleQuickDismiss}
                className="w-full min-h-[42px] py-2 text-xs font-semibold text-emerald-900 hover:text-emerald-950 transition-colors text-center"
              >
                {t('welcome_back_to_app')}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
