// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Sign in page
// └──────────────────────────────────────────────────────────────────────────┘

import GridShape from '../../components/common/GridShape';
import ThemeTogglerTwo from '../../components/common/ThemeTogglerTwo';
import GepgSignInForm from '../../components/auth/GepgSignInForm';

export default function GepgSignIn() {
  return (
    <div className="relative z-1 bg-white p-6 dark:bg-gray-900 sm:p-0">
      <div className="relative flex h-screen w-full flex-col justify-center dark:bg-gray-900 sm:p-0 lg:flex-row">
        <GepgSignInForm />

        <div className="hidden h-full w-full items-center bg-brand-950 dark:bg-white/5 lg:grid lg:w-1/2">
          <div className="relative z-1 flex items-center justify-center">
            <GridShape />
            <div className="flex max-w-sm flex-col items-center px-8">
              <img src="/logo.png" alt="Tanzania Police Force Corporation Sole" className="mb-6 h-48 w-48 object-contain drop-shadow-2xl" />
              <h2 className="mb-2 text-center text-xl font-bold text-white">Tanzania Police Force Corporation Sole</h2>
              <p className="text-center text-sm text-gray-300 dark:text-white/70">Middleware</p>
              <p className="mt-4 text-center text-sm italic text-gray-400 dark:text-white/60">
                Manage bills, payments, and reconciliation with the Government Electronic Payment Gateway.
              </p>
            </div>
          </div>
        </div>

        <div className="fixed bottom-6 right-6 z-50 hidden sm:block">
          <ThemeTogglerTwo />
        </div>
      </div>
    </div>
  );
}
