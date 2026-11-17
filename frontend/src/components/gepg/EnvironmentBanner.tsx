// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ UAT banner shown on every page
// └──────────────────────────────────────────────────────────────────────────┘

import { useEffect, useState } from 'react';
import { gepgSettingsApi } from '../../api/gepgSettings';

export const ENVIRONMENT_CHANGED = 'gepg-environment-changed';

export default function EnvironmentBanner() {
  const [environment, setEnvironment] = useState('');

  useEffect(() => {
    const load = () =>
      gepgSettingsApi
        .environment()
        .then((res) => setEnvironment(res.data.data.environment))
        .catch(() => setEnvironment(''));

    load();
    window.addEventListener(ENVIRONMENT_CHANGED, load);
    return () => window.removeEventListener(ENVIRONMENT_CHANGED, load);
  }, []);

  if (environment !== 'UAT') return null;

  return (
    <div className="bg-warning-500 px-4 py-1.5 text-center text-xs font-semibold text-white">
      UAT test environment: bills and payments here are not real
    </div>
  );
}
