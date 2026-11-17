// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Digital signature utility
// └──────────────────────────────────────────────────────────────────────────┘

const crypto = require('crypto');
const fs = require('fs');
const forge = require('node-forge');
const { ACK, gepgError } = require('./gepgErrors');

class DigitalSignature {
  constructor() {
    this.algorithm = 'RSA-SHA256'; // Node's name for SHA256withRSA
    this.encoding = 'base64';
    this._privateKeyPemCache = new Map();
  }

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

  verifySignature(message, signature, publicKeyPath) {
    try {
      if (!fs.existsSync(publicKeyPath)) {
        // our certificate config is broken, not proof the message is forged
        throw gepgError(`Public key/certificate file not found: ${publicKeyPath}`, ACK.SIGNATURE_CONFIG);
      }

      const publicKeyPem = fs.readFileSync(publicKeyPath, 'utf8');
      const cleanSignature = signature.replace(/\s+/g, '');

      const verify = crypto.createVerify(this.algorithm);
      verify.update(message, 'utf8');
      verify.end();

      return verify.verify(publicKeyPem, cleanSignature, this.encoding);
    } catch (error) {
      // an undecodable signature counts as invalid (7303)
      throw gepgError(`Verification failed: ${error.message}`, error.gepgCode || ACK.INVALID_SIGNATURE, error);
    }
  }

  // Wrap an already-built GePG message XML in the signed <Gepg> envelope
  createSignedEnvelope(message, certPath, password) {
    try {
      const signature = this.signMessage(message, certPath, password);
      return `<Gepg>\n${message}\n<signature>${signature}</signature>\n</Gepg>`;
    } catch (error) {
      throw new Error(`Failed to create signed envelope: ${error.message}`);
    }
  }

  extractAndVerifyEnvelope(envelopeXML, publicKeyPath) {
    try {
      const messageMatch = envelopeXML.match(/<Gepg>\s*([\s\S]*?)\s*<signature>/);
      const signatureMatch = envelopeXML.match(/<signature>([\s\S]*?)<\/signature>/);

      if (!messageMatch || !signatureMatch) {
        // No signature element means there is nothing to verify.
        throw gepgError('Invalid envelope format: missing <Gepg> message or <signature>', ACK.INVALID_SIGNATURE);
      }

      const message = messageMatch[1].trim();
      const signature = signatureMatch[1].trim();

      const isValid = this.verifySignature(message, signature, publicKeyPath);

      return { message, signature, isValid };
    } catch (error) {
      throw gepgError(`Failed to extract and verify envelope: ${error.message}`, error.gepgCode || ACK.INVALID_SIGNATURE, error);
    }
  }
}

module.exports = new DigitalSignature();
