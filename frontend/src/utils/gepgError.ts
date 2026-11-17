// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ GePG error message utility
// └──────────────────────────────────────────────────────────────────────────┘

// Build the user-facing text for a failed API call
export function gepgErrorMessage(err: any, fallback = 'Unknown error'): string {
  const data = err?.response?.data;
  const message: string = data?.message ?? fallback;
  return data?.code ? `${message} (GePG code ${data.code})` : message;
}
