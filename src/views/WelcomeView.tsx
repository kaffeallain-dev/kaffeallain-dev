import { ArrowRight, BookOpen, Globe2, Leaf, LogIn } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../lib/i18n';
import { getCompositeMeals } from '../data/compositeMeals';
import { commonFoods } from '../data/foodDatabase';

const catalogCount = new Set([...commonFoods, ...getCompositeMeals()].map(food => food.id)).size;
const welcomePhoto = `${import.meta.env.BASE_URL}ndole-plantain.jpg`;

export function WelcomeView({ onExplore, onJournal }: { onExplore: () => void; onJournal: () => void }) {
  const { t, lang, setLanguage } = useI18n();
  const reducedMotion = useReducedMotion();

  return (
    <main className="h-full overflow-y-auto bg-[#f8f6ee] text-[#153a2d]">
      <div className="mx-auto max-w-lg px-5 pb-7 pt-5 sm:px-6">
        <header className="flex items-center justify-between gap-4">
          <p className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
            <Leaf aria-hidden="true" size={21} /> MboaFit
          </p>
          <button type="button" lang={lang === 'en' ? 'fr' : 'en'} onClick={() => setLanguage(lang === 'en' ? 'fr' : 'en')}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-emerald-900/20 px-3 text-sm font-semibold focus-visible:outline-2">
            <Globe2 aria-hidden="true" size={16} /> {lang === 'en' ? 'Français' : 'English'}
          </button>
        </header>
        <h1 className="mt-6 max-w-[13ch] text-[clamp(1.9rem,8vw,3rem)] font-extrabold leading-[1.04] tracking-tight">{t('welcome_title')}</h1>
        <p className="mt-3 text-sm leading-relaxed text-emerald-950/80">{t('welcome_desc', { count: catalogCount })}</p>
        <motion.figure initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.38, ease: 'easeOut' }}
          className="relative mt-5 aspect-[16/10] overflow-hidden rounded-3xl bg-emerald-950">
          <motion.img src={welcomePhoto} width="540" height="582" alt={t('welcome_photo')}
            animate={reducedMotion ? {} : { scale: [1, 1.07, 1], x: ['0%', '1%', '0%'] }}
            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
            className="h-full w-full object-cover object-[50%_55%]" />
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-4 pb-3 pt-8 text-sm font-semibold text-white">
            {t('welcome_photo')}
          </figcaption>
        </motion.figure>
        <div className="mt-5 grid gap-2">
          <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={onJournal}
            className="flex min-h-12 items-center justify-between rounded-xl bg-[#194c37] px-4 py-2 font-semibold text-white">
            {t('welcome_start')} <ArrowRight aria-hidden="true" size={19} />
          </motion.button>
          <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={onExplore}
            className="flex min-h-12 items-center justify-between rounded-xl border border-emerald-900/25 bg-white/65 px-4 py-2 font-semibold text-emerald-900">
            <span className="inline-flex items-center gap-2"><BookOpen aria-hidden="true" size={18} />{t('welcome_explore')}</span>
            <ArrowRight aria-hidden="true" size={19} />
          </motion.button>
        </div>
      </div>
    </main>
  );
}

export function AccountView({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  const { t } = useI18n();
  const { user, signingIn, signInWithGoogle, error } = useAuth();
  return (
    <main className="flex h-full flex-col overflow-y-auto bg-[#f8f6ee] px-6 py-8 text-[#153a2d]">
      <button type="button" onClick={onBack} className="min-h-11 self-start text-sm font-semibold underline">{t('btn_back')}</button>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4">
        <Leaf aria-hidden="true" size={32} />
        <h1 className="text-3xl font-extrabold">{t('welcome_account_title')}</h1>
        <p className="leading-relaxed text-emerald-950/80">{t('account_description')}</p>
        {user ? (
          <button type="button" onClick={onContinue} className="min-h-12 rounded-xl bg-emerald-800 px-4 font-semibold text-white">{t('account_continue')}</button>
        ) : (
          <>
            <button type="button" onClick={signInWithGoogle} disabled={signingIn} aria-busy={signingIn}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 font-semibold text-white disabled:opacity-60">
              <LogIn aria-hidden="true" size={18} />{t(signingIn ? 'signing_in_google' : 'sign_in_google')}
            </button>
            <button type="button" onClick={onContinue} className="min-h-11 rounded-xl border border-emerald-900/25 px-4 font-semibold">{t('welcome_guest')}</button>
          </>
        )}
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      </div>
    </main>
  );
}
