const crypto = require('crypto');
const fs = require('fs');
const forge = require('node-forge');

/**
 * Implements GePG's digital signature requirements (API v4.0, section 7):
 *  - Messages are signed with the participant's PKCS#12 (.p12/.pfx) private key
 *  - Algorithm: SHA1withRSA
 *  - Signature is BASE64 encoded
 *  - Signed envelope shape: <Gepg><message/><gepgSignature/></Gepg>
 *
 * Online payment redirect forms (section 5.8) use a *different* scheme -
 * HMAC-SHA256 over a sorted field list - kept separate below.
 */
class DigitalSignature {
  constructor() {
    this.algorithm = 'RSA-SHA1'; // Node's name for SHA1withRSA
    this.encoding = 'base64';
    this._privateKeyPemCache = new Map();
  }

  /**
   * Extracts the PEM private key from a PKCS#12 file, once per path/password
   * combination (parsing PKCS#12 is not cheap).
   */
  _loadPrivateKeyFromPkcs12(p12Path, password) {
    const cacheKey = p12Path;
    if (this._privateKeyPemCache.has(cacheKey)) {
      return this._privateKeyPemCache.get(cacheKey);
    }

    if (!fs.existsSync(p12Path)) {
      throw new Error(`Certificate file not found: ${p12Path}`);
    }

    const p12Der = fs.readFileSync(p12Path, 'binary');
    const p12Asn1 = forge.asn1.fromDer(p12Der);

    let p12;
    try {
      p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password || '');
    } catch (err) {
      throw new Error(`Unable to open PKCS12 certificate (wrong password or corrupt file): ${err.message}`);
    }

    // Private keys can show up as either shrouded (encrypted) or plain key bags
    const shrouded = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const plain = p12.getBags({ bagType: forge.pki.oids.keyBag });

    const bag =
      (shrouded[forge.pki.oids.pkcs8ShroudedKeyBag] || [])[0] ||
      (plain[forge.pki.oids.keyBag] || [])[0];

    if (!bag || !bag.key) {
      throw new Error('No private key found inside the PKCS12 certificate');
    }

    const privateKeyPem = forge.pki.privateKeyToPem(bag.key);
    this._privateKeyPemCache.set(cacheKey, privateKeyPem);
    return privateKeyPem;
  }

  _resolvePrivateKeyPem(certPath, password) {
    if (certPath.endsWith('.pem') || certPath.endsWith('.key')) {
      return fs.readFileSync(certPath, 'utf8');
    }
    return this._loadPrivateKeyFromPkcs12(certPath, password);
  }

  /**
   * Sign a message per GePG's rules: SHA1withRSA, base64 encoded.
   */
  signMessage(message, certPath, password) {
    try {
      const privateKeyPem = this._resolvePrivateKeyPem(certPath, password);

      const sign = crypto.createSign(this.algorithm);
      sign.update(message, 'utf8');
      sign.end();

      return sign.sign(privateKeyPem, this.encoding);
    } catch (error) {
      throw new Error(`Signing failed: ${error.message}`);
    }
  }

  /**
   * Verify a signature against a public key/certificate (PEM). GePG shares
   * their public certificate out-of-band during integration.
   */
  verifySignature(message, signature, publicKeyPath) {
    try {
      if (!fs.existsSync(publicKeyPath)) {
        throw new Error(`Public key/certificate file not found: ${publicKeyPath}`);
      }

      const publicKeyPem = fs.readFileSync(publicKeyPath, 'utf8');
      const cleanSignature = signature.replace(/\s+/g, '');

      const verify = crypto.createVerify(this.algorithm);
      verify.update(message, 'utf8');
      verify.end();

      return verify.verify(publicKeyPem, cleanSignature, this.encoding);
    } catch (error) {
      throw new Error(`Verification failed: ${error.message}`);
    }
  }

  /**
   * Wrap an already-built GePG message XML in the signed <Gepg> envelope.
   */
  createSignedEnvelope(message, certPath, password) {
    try {
      const signature = this.signMessage(message, certPath, password);
      return `<Gepg>\n${message}\n<gepgSignature>${signature}</gepgSignature>\n</Gepg>`;
    } catch (error) {
      throw new Error(`Failed to create signed envelope: ${error.message}`);
    }
  }

  /**
   * Extract the message + signature from a <Gepg> envelope and verify it
   * against GePG's public certificate. Used for every inbound message
   * (bill responses, payment notifications, reconciliation responses).
   */
  extractAndVerifyEnvelope(envelopeXML, publicKeyPath) {
    try {
      const messageMatch = envelopeXML.match(/<Gepg>\s*([\s\S]*?)\s*<gepgSignature>/);
      const signatureMatch = envelopeXML.match(/<gepgSignature>([\s\S]*?)<\/gepgSignature>/);

      if (!messageMatch || !signatureMatch) {
        throw new Error('Invalid envelope format: missing <Gepg> message or <gepgSignature>');
      }

      const message = messageMatch[1].trim();
      const signature = signatureMatch[1].trim();

      const isValid = this.verifySignature(message, signature, publicKeyPath);

      return { message, signature, isValid };
    } catch (error) {
      throw new Error(`Failed to extract and verify envelope: ${error.message}`);
    }
  }

  /**
   * Section 5.8 - Hash Generation for online payment redirect forms.
   * Distinct scheme: HMAC-SHA256 over field values sorted by field name.
   */
  generateHash(data, secretKey) {
    try {
      const sortedKeys = Object.keys(data).sort();
      const sourceString = sortedKeys.map(key => data[key]).join('');

      const hmac = crypto.createHmac('sha256', secretKey);
      hmac.update(sourceString);

      return hmac.digest('hex').toUpperCase();
    } catch (error) {
      throw new Error(`Hash generation failed: ${error.message}`);
    }
  }

  verifyHash(data, providedHash, secretKey) {
    try {
      const calculatedHash = this.generateHash(data, secretKey);
      return calculatedHash === providedHash.toUpperCase();
    } catch (error) {
      throw new Error(`Hash verification failed: ${error.message}`);
    }
  }
}

module.exports = new DigitalSignature();
