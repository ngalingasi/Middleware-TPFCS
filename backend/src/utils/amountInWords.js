// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Amount in words utility
// └──────────────────────────────────────────────────────────────────────────┘

// Amount in words for printed bills and receipts

const ONES = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const SCALES = [
  { value: 1e12, name: 'Trillion' },
  { value: 1e9, name: 'Billion' },
  { value: 1e6, name: 'Million' },
  { value: 1e3, name: 'Thousand' }
];

const CURRENCY_NAMES = {
  TZS: 'Tanzanian Shilling',
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  KES: 'Kenyan Shilling',
  UGX: 'Ugandan Shilling'
};

// 1..999 -> words
function underThousand(n) {
  const parts = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;

  if (hundreds > 0) parts.push(`${ONES[hundreds]} Hundred`);

  if (rest > 0) {
    if (hundreds > 0) parts.push('and');
    if (rest < 20) {
      parts.push(ONES[rest]);
    } else {
      const unit = rest % 10;
      parts.push(unit ? `${TENS[Math.floor(rest / 10)]}-${ONES[unit]}` : TENS[Math.floor(rest / 10)]);
    }
  }

  return parts.join(' ');
}

function integerToWords(n) {
  if (n === 0) return 'Zero';

  const parts = [];
  let remaining = n;

  for (const scale of SCALES) {
    if (remaining >= scale.value) {
      const count = Math.floor(remaining / scale.value);
      parts.push(`${underThousand(count)} ${scale.name}`);
      remaining -= count * scale.value;
    }
  }

  if (remaining > 0) {
    // "One Thousand and Five", not "One Thousand Five"
    parts.push(parts.length > 0 && remaining < 100 ? `and ${underThousand(remaining)}` : underThousand(remaining));
  }

  return parts.join(' ');
}

function amountInWords(amount, currency = 'TZS') {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) return '';

  // Work in minor units to avoid float artefacts (e.g. 0.1 + 0.2).
  const totalMinor = Math.round(value * 100);
  const major = Math.floor(totalMinor / 100);
  const minor = totalMinor % 100;

  const code = String(currency || 'TZS').toUpperCase();
  const currencyName = CURRENCY_NAMES[code] || code;

  let words = `${integerToWords(major)} ${currencyName}`;
  if (minor > 0) {
    words += ` and ${integerToWords(minor)} Cents`;
  }

  return `${words} Only.`;
}

module.exports = { amountInWords, integerToWords };
