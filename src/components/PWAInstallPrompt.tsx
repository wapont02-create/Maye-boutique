'use client';

import { useEffect, useState } from 'react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export default function PWAInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  useEffect(() => {
    const standaloneQuery = window.matchMedia('(display-mode: standalone)');
    const installed = standaloneQuery.matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

    setIsInstalled(installed);
    setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1));

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setShowIOSHelp(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') setInstallPrompt(null);
  };

  if (isInstalled) return null;
  if (!installPrompt && !isIOS) return null;

  return (
    <>
      <div className="fixed bottom-4 right-4 z-[100] max-w-[calc(100vw-2rem)]">
        {installPrompt ? (
          <button
            type="button"
            onClick={handleInstall}
            className="flex items-center gap-2 rounded-full bg-[#0b1f3a] px-5 py-3 text-sm font-semibold text-white shadow-xl ring-1 ring-white/20 transition hover:bg-[#12345b] focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <span aria-hidden="true">⬇</span>
            Instalar POS Enterprise
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowIOSHelp((visible) => !visible)}
            className="rounded-full bg-[#0b1f3a] px-5 py-3 text-sm font-semibold text-white shadow-xl ring-1 ring-white/20 transition hover:bg-[#12345b] focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-expanded={showIOSHelp}
          >
            Cómo instalar la app
          </button>
        )}
      </div>

      {isIOS && showIOSHelp && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-ios-title"
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => setShowIOSHelp(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 text-slate-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="pwa-ios-title" className="text-lg font-bold">Instalar POS Enterprise</h2>
            <p className="mt-2 text-sm text-slate-600">
              En Safari, toca el botón <strong>Compartir</strong> y luego selecciona
              <strong> Añadir a pantalla de inicio</strong>. Confirma con «Añadir».
            </p>
            <button
              type="button"
              onClick={() => setShowIOSHelp(false)}
              className="mt-4 w-full rounded-xl bg-[#0b1f3a] px-4 py-3 text-sm font-semibold text-white"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
