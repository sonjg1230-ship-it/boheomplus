const RSA_PUBLIC_JWK: JsonWebKey = {
  key_ops: ['encrypt'],
  ext: true,
  alg: 'RSA-OAEP-256',
  kty: 'RSA',
  n: 'th11l66992G1C2rT9J4PPC_V7UEcUwbO2ez3iwHauYICi6dNFm4kj9C6wVpKMmPDSUtVwMjtS4fiFNXYpAZCi0-G0L_rtqvqkT61LCg0Fo6NKK9DE8SAAnWXi6VQqK3z3D1c6FFtePfDxc1iL11hp9BXXNaSHIzXWYFH3bseXwfwTGfezQxiUKDlYbUduZ11Tp8JGn5Qff02nrqzr8C37PIM-EpVPMNcWf0KX97YfNpL_iC1ozWjyGrTW0GHCQwVKcUxkAYta_T7n6v_gPr4H5cCoHHtfkkkeBNxErQ7dHV0odSqKJY4MOjiyoHmKniZ0XpWx6X8Xu9HrTMUB_VlBQ',
  e: 'AQAB',
};

const ECDSA_PUBLIC_JWK: JsonWebKey = {
  key_ops: ['verify'],
  ext: true,
  kty: 'EC',
  x: 's-FGI1gfynG_M5lkYRB9H_b944A1s51Gyxi47elnSmM',
  y: 'S5Ls23_kmLKygNIT7tzlB-bXcokf1xaQRXRWPmRWMKE',
  crv: 'P-256',
};

const VAULT_SALT_B64 = 'dV/9slpfzjuj8N81jyv7PQ==';
const VAULT_IV_B64 = '0lNl9GmLOj8FJlLS';
const VAULT_ENCRYPTED_BUNDLE_B64 =
  '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';

export interface UnlockedVaultKeyPair {
  rsaPrivateJwk: JsonWebKey;
  ecdsaPrivateJwk: JsonWebKey;
}

export interface ImportedVaultKeys {
  rsaPrivateKey: CryptoKey;
  ecdsaPrivateKey: CryptoKey;
  jwkPair: UnlockedVaultKeyPair;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

function toExactArrayBuffer(view: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(view.byteLength);
  copy.set(view);
  return copy.buffer;
}

export async function importVaultKeyPair(jwkPair: UnlockedVaultKeyPair): Promise<ImportedVaultKeys> {
  const [rsaPrivateKey, ecdsaPrivateKey] = await Promise.all([
    crypto.subtle.importKey(
      'jwk',
      jwkPair.rsaPrivateJwk,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['decrypt']
    ),
    crypto.subtle.importKey(
      'jwk',
      jwkPair.ecdsaPrivateJwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    ),
  ]);
  return { rsaPrivateKey, ecdsaPrivateKey, jwkPair };
}

export async function unlockVaultWithPassword(password: string): Promise<ImportedVaultKeys> {
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const saltBytes = toExactArrayBuffer(b64ToBytes(VAULT_SALT_B64));
  const ivBytes = toExactArrayBuffer(b64ToBytes(VAULT_IV_B64));
  const cipherBytes = toExactArrayBuffer(b64ToBytes(VAULT_ENCRYPTED_BUNDLE_B64));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 150000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    aesKey,
    cipherBytes
  );

  const parsed = JSON.parse(dec.decode(plainBuf)) as UnlockedVaultKeyPair;
  return importVaultKeyPair(parsed);
}

export async function encryptVaultPayload(payload: unknown): Promise<{
  encData: string;
  wrappedKey: string;
  iv: string;
}> {
  const enc = new TextEncoder();
  const rsaPublicKey = await crypto.subtle.importKey(
    'jwk',
    RSA_PUBLIC_JWK,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );

  const aesKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plainBytes = enc.encode(JSON.stringify(payload));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toExactArrayBuffer(iv) },
    aesKey,
    plainBytes
  );

  const rawAesBuf = await crypto.subtle.exportKey('raw', aesKey);
  const wrappedBuf = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, rsaPublicKey, rawAesBuf);

  return {
    encData: bytesToB64(new Uint8Array(cipherBuf)),
    wrappedKey: bytesToB64(new Uint8Array(wrappedBuf)),
    iv: bytesToB64(iv),
  };
}

export async function decryptVaultPayload<T>(
  rsaPrivateKey: CryptoKey,
  encDataB64: string,
  wrappedKeyB64: string,
  ivB64: string
): Promise<T> {
  const dec = new TextDecoder();
  const rawAesBuf = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    rsaPrivateKey,
    toExactArrayBuffer(b64ToBytes(wrappedKeyB64))
  );
  const aesKey = await crypto.subtle.importKey(
    'raw',
    rawAesBuf,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toExactArrayBuffer(b64ToBytes(ivB64)) },
    aesKey,
    toExactArrayBuffer(b64ToBytes(encDataB64))
  );

  return JSON.parse(dec.decode(plainBuf)) as T;
}

export async function signVaultEvent(
  ecdsaPrivateKey: CryptoKey,
  targetId: string,
  encData: string,
  wrappedKey: string,
  iv: string
): Promise<string> {
  const enc = new TextEncoder();
  const message = `${targetId}|${encData}|${wrappedKey}|${iv}`;
  const sigBuf = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    ecdsaPrivateKey,
    enc.encode(message)
  );
  return bytesToB64(new Uint8Array(sigBuf));
}

export async function verifyVaultEvent(
  targetId: string,
  encData: string,
  wrappedKey: string,
  iv: string,
  signatureB64: string
): Promise<boolean> {
  try {
    const enc = new TextEncoder();
    const verifyKey = await crypto.subtle.importKey(
      'jwk',
      ECDSA_PUBLIC_JWK,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    );
    const message = `${targetId}|${encData}|${wrappedKey}|${iv}`;
    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      verifyKey,
      toExactArrayBuffer(b64ToBytes(signatureB64)),
      enc.encode(message)
    );
  } catch {
    return false;
  }
}
