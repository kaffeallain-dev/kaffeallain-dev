import React, { useEffect, useState } from 'react';
import { GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../lib/i18n';
import { accountRequest, apiUrl } from '../lib/apiClient';
import { getDB, toOwnerKey } from '../lib/db';

export function PrivacyPanel({ standalone = false, deletionOnly = false }: { standalone?: boolean; deletionOnly?: boolean }) {
  const { lang, setLanguage } = useI18n();
  const fr = lang === 'fr';
  const { user, signInWithGoogle, signOutUser } = useAuth();
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const support = String(import.meta.env.VITE_SUPPORT_EMAIL || 'kaffeallain@gmail.com');
  useEffect(() => {
    let active = true;
    try {
      fetch(apiUrl('capabilities'), { signal: AbortSignal.timeout(8000) }).then(r => r.ok ? r.json() : {}).then((c: { deletionEnabled?: boolean }) => { if (active) setEnabled(c.deletionEnabled === true); }).catch(() => {});
    } catch {}
    return () => { active = false; };
  }, []);

  async function removeAccount() {
    if (!user || confirmation !== 'DELETE' || !enabled || busy) return;
    setBusy(true); setMessage('');
    const uid = user.uid;
    let deleted = false;
    try {
      await reauthenticateWithPopup(user, new GoogleAuthProvider());
      const result = await accountRequest('account', { method: 'DELETE', body: JSON.stringify({ confirmation: 'DELETE' }) });
      if (result.deleted !== true) throw new Error('account_deletion_incomplete');
      deleted = true;
      // Sign out before clearing only this account's current cache; never call cloud refresh/import.
      await signOutUser();
      const key = toOwnerKey({ kind: 'user', uid });
      const database = await getDB({ kind: 'user', uid });
      const tx = database.transaction(['consumptions', 'customFoods', 'settings', 'pendingWrites'], 'readwrite');
      for (const store of ['consumptions', 'customFoods', 'settings', 'pendingWrites'] as const) await tx.objectStore(store).clear();
      await tx.done;
      for (const storageKey of [`mboafit_onboarding_${key}`, `onboarding_completed_${uid}`, `mboafit_onboarding_${uid}`, `import_dismissed_${uid}`]) localStorage.removeItem(storageKey);
      setMessage(fr ? 'Votre compte et ses donn�es actives ont �t� supprim�s. Les sauvegardes que vous avez export�es restent sous votre contr�le.' : 'Your account and its active data were deleted. Backups you exported remain under your control.');
    } catch {
      setMessage(deleted
        ? (fr ? 'Le compte a �t� supprim�, mais le nettoyage de cet appareil reste � v�rifier. Fermez la session et contactez l�assistance.' : 'The account was deleted, but device cleanup needs checking. Sign out and contact support.')
        : (fr ? 'Suppression non confirm�e. V�rifiez votre connexion et votre identit�, puis r�essayez. Une suppression partielle reste en attente et peut �tre reprise.' : 'Deletion was not confirmed. Check your connection and identity, then retry. Partial cleanup remains pending and can be resumed.'));
    } finally { setBusy(false); }
  }

  return <section className={`${standalone ? 'max-w-2xl mx-auto p-6 min-h-screen bg-stone-50' : 'bg-white rounded-2xl p-5 border border-emerald-100'} space-y-4`} aria-label={fr ? 'Confidentialit� et compte' : 'Privacy and account'}>
    <header className="flex justify-between items-center gap-3">
      <h2 className="text-xl font-bold text-emerald-950">{deletionOnly ? (fr ? 'Supprimer mon compte MboaFit' : 'Delete my MboaFit account') : (fr ? 'Confidentialit� et assistance' : 'Privacy and support')}</h2>
      {standalone && <div><button type="button" className="p-2" onClick={() => setLanguage('en')}>EN</button><button type="button" className="p-2" onClick={() => setLanguage('fr')}>FR</button></div>}
    </header>
    {!deletionOnly && <>
      <p className="text-sm text-amber-900">{fr ? 'Informations de confidentialit� de la b�ta � � finaliser avant publication sur Google Play.' : 'Beta privacy information � must be finalized before Google Play publication.'}</p>
      <p>{fr ? 'MboaFit estime la nutrition de vos repas. Les portions et calories sont approximatives : v�rifiez-les avant de les enregistrer. L�application ne pose pas de diagnostic et ne remplace pas un professionnel de sant�.' : 'MboaFit estimates meal nutrition. Portions and calories are approximate: review them before saving. The app does not diagnose conditions or replace a health professional.'}</p>
      <p>{fr ? 'Vos repas, aliments personnalis�s et informations de profil sont conserv�s sur cet appareil. Si vous vous connectez, ces donn�es sont aussi enregistr�es dans votre espace Firebase. Google traite la connexion et l�h�bergement de ces donn�es.' : 'Meals, custom foods and profile information are kept on this device. If you sign in, these records are also saved in your Firebase account space. Google processes sign-in and cloud storage.'}</p>
      <p>{fr ? 'Lorsque l�analyse en ligne est configur�e et que vous la demandez, la photo du repas est envoy�e au serveur MboaFit puis � Google Gemini. Ce code ne stocke pas la photo sur le serveur. Il conserve les r�sultats et m�tadonn�es techniques li�s au compte pour les limites et les nouvelles tentatives. N�incluez pas de visage ni de document personnel. Les r�gles de conservation du fournisseur restent � confirmer avant lancement.' : 'When online scanning is configured and you request it, the meal photo is sent to the MboaFit server and then Google Gemini. This code does not persist the photo on the server. It keeps account-linked results and technical metadata for limits and retries. Do not include faces or personal documents. Provider retention terms must be confirmed before launch.'}</p>
      <p>{fr ? 'Effacer les donn�es locales ne supprime pas votre compte en ligne. La suppression du compte retire ses donn�es actives du cloud et le compte MboaFit g�r� par Firebase (pas votre compte Google). Un marqueur technique minimal bloque la r�apparition d�anciennes donn�es en attente. Les anciens espaces locaux ambigus et vos fichiers export�s ne sont pas effac�s automatiquement.' : 'Clearing local data does not delete your online account. Account deletion removes its active cloud records and Firebase sign-in account. A minimal technical marker prevents old queued data from recreating that account. Ambiguous historical local stores and exported backup files are not automatically erased.'}</p>
      {/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(support)
        ? <a className="underline text-emerald-800 block" href={`mailto:${support}`}>{fr ? 'Contacter l�assistance' : 'Contact support'}</a>
        : <p className="text-sm text-amber-900">{fr ? 'Le contact d�assistance doit �tre configur� avant la publication.' : 'A support contact must be configured before publication.'}</p>}
      <a className="underline text-emerald-800 block" href="/privacy">{fr ? 'Ouvrir les informations de confidentialit�' : 'Open privacy information'}</a>
    </>}
    <div className="border-t pt-4 space-y-3">
      <h3 className="font-bold">{fr ? 'Suppression du compte' : 'Account deletion'}</h3>
      <p>{fr ? 'Cette action est d�finitive. Elle supprime les repas, le profil, les aliments personnalis�s et les donn�es techniques actives de ce compte. Exportez vos donn�es si vous souhaitez les conserver. Tapez DELETE puis v�rifiez votre identit� avec Google.' : 'This action is permanent. It removes this account�s meals, profile, custom foods and active technical records. Export your records first if you want a copy. Type DELETE, then verify your identity with Google.'}</p>
      {!enabled && <p role="status" className="text-amber-900">{fr ? 'La suppression en ligne n�est pas encore activ�e sur ce serveur. Aucune suppression n�a �t� effectu�e.' : 'Online deletion is not enabled on this server yet. No deletion has been performed.'}</p>}
      {user ? <>
        <label className="block">{fr ? 'Confirmation : tapez DELETE' : 'Confirmation: type DELETE'}<input className="block border rounded-lg p-3 w-full mt-1" value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy} autoComplete="off" /></label>
        <button type="button" className="rounded-xl bg-red-700 text-white p-3 disabled:opacity-50" disabled={!enabled || busy || confirmation !== 'DELETE' || Capacitor.isNativePlatform()} onClick={removeAccount}>{busy ? (fr ? 'Suppression en cours�' : 'Deleting�') : (fr ? 'V�rifier et supprimer mon compte' : 'Verify and delete my account')}</button>
      </> : <button type="button" className="p-3 border rounded-xl" onClick={signInWithGoogle} disabled={Capacitor.isNativePlatform()}>{fr ? 'Se connecter pour demander la suppression' : 'Sign in to request deletion'}</button>}
      {message && <p role="status">{message}</p>}
    </div>
    {standalone && <a className="underline text-emerald-800 block" href="/">{fr ? 'Retour � MboaFit' : 'Return to MboaFit'}</a>}
  </section>;
}
