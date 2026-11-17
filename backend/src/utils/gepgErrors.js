// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ GePG error codes carried on errors, for webhook acknowledgements
// └──────────────────────────────────────────────────────────────────────────┘

/**
 * Inbound GePG webhooks must acknowledge with a code that says *why* a
 * message was refused (spec 3.3 / 4.1): GePG acts on it - e.g. 7242 means
 * "fix the XML before resending", 7303 means "your signature did not verify",
 * and the SIT sheet (PK001-PK003) checks that an invalid signature is
 * reported as such. Errors raised while handling a message carry that code
 * in `gepgCode`; ackCodeFor() reads it back when building the ack.
 */

// Codes used for acknowledgements (descriptions: utils/gepgCodes.js).
const ACK = {
  OK: '7101',
  INVALID_DATA: '7242', // malformed XML / wrong payload shape
  INVALID_SIGNATURE: '7303', // signature missing or does not verify
  SIGNATURE_CONFIG: '7304', // our copy of GePG's public certificate is missing/unusable
  PROCESSING_ERROR: '7317' // anything else that went wrong on our side
};

function gepgError(message, gepgCode) {
  // The wrapped message already carries the original error's text, so the
  // original is not attached as `cause` (it would print a stack per rejected message).
  const error = new Error(message);
  error.gepgCode = gepgCode;
  return error;
}

/**
 * Ack code for an error caught in a webhook. Unclassified errors are our own
 * failures (database down, bug), not the sender's fault, so they are 7317
 * rather than 7242 - telling GePG its data was invalid would be wrong.
 */
function ackCodeFor(error) {
  return (error && error.gepgCode) || ACK.PROCESSING_ERROR;
}

/** HTTP status to send alongside the ack: 5xx only for our own failures. */
function httpStatusFor(code) {
  return code === ACK.PROCESSING_ERROR ? 500 : 400;
}

module.exports = { ACK, gepgError, ackCodeFor, httpStatusFor };
