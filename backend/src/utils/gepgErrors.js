// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ GePG error codes carried on errors, for webhook acknowledgements
// └──────────────────────────────────────────────────────────────────────────┘

// Codes used for acknowledgements (descriptions: utils/gepgCodes.js).
const ACK = {
  OK: '7101',
  INVALID_DATA: '7242', // malformed XML / wrong payload shape
  INVALID_SIGNATURE: '7303', // signature missing or does not verify
  SIGNATURE_CONFIG: '7304', // our copy of GePG's public certificate is missing/unusable
  PROCESSING_ERROR: '7317' // anything else that went wrong on our side
};

function gepgError(message, gepgCode) {
  // no `cause`: it would print a stack for every rejected message
  const error = new Error(message);
  error.gepgCode = gepgCode;
  return error;
}

function ackCodeFor(error) {
  return (error && error.gepgCode) || ACK.PROCESSING_ERROR;
}

// HTTP status to send alongside the ack: 5xx only for our own failures
function httpStatusFor(code) {
  return code === ACK.PROCESSING_ERROR ? 500 : 400;
}

module.exports = { ACK, gepgError, ackCodeFor, httpStatusFor };
