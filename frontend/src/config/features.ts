// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Feature switches, set in frontend/.env
// └──────────────────────────────────────────────────────────────────────────┘

const isOn = (value: unknown) => ['true', '1', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());

// VITE_SHOW_DEVELOPER=true in frontend/.env shows the Developer section (menu entry, page, and
// the link to it from Billing Systems). Any other value, or no key, hides it. Nothing is deleted.
// Vite reads .env when it starts (it restarts itself when the file changes) and when the app is
// built, so a deployed app needs a rebuild after the value changes.
export const FEATURES = {
  developer: isOn(import.meta.env.VITE_SHOW_DEVELOPER),
};
