import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'nibras-supervisors-dashboard-secret-key-987654321';
const STUDENT_SECRET = process.env.STUDENT_JWT_SECRET || 'nibras-students-portal-secret-key-123456789';

export type UserSession = {
  id: number;
  email: string;
  name: string;
  role: string; // 'admin' | 'supervisor'
};

// ==================== PURE JS CRYPTO HELPERS ====================

function sha256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i, j; // Used as a counter across the whole file
  let result = '';

  const words: number[] = [];
  const asciiLength = ascii[lengthProperty] * 8;
  
  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: { [key: number]: number } = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = 1;
      }
      hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  
  ascii += '\x80'; // Append Ɨ bit (technically a 1 bit then 7 zeros)
  while (ascii[lengthProperty] % 64 - 56) ascii += '\x00'; // More zeros
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return ''; // ASCII-only: fail on non-ASCII characters
    words[i >> 2] |= j << ((3 - i % 4) * 8);
  }
  words[words[lengthProperty]] = ((asciiLength / maxWord) | 0);
  words[words[lengthProperty]] = (asciiLength | 0);
  
  // process each chunk
  for (j = 0; j < words[lengthProperty];) {
    const w = words.slice(j, j += 16); // The 512-bit chunks
    const oldHash = [...hash];
    
    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];

      // Feedback
      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      const w_i = w[i] = (i < 16) ? w[i] : (
        w[i - 16] +
        s0 +
        w[i - 7] +
        s1
      ) | 0;

      const a = hash[0], e = hash[4];
      const temp1 = hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) + // S1
        ((e & hash[5]) ^ (~e & hash[6])) + // ch
        k[i] +
        w_i;
      
      // Major
      const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) + // S0
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2])); // maj
      
      hash.unshift((temp1 + temp2) | 0);
      hash[4] = (hash[4] + temp1) | 0;
      hash.length = 8;
    }
    
    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }
  
  for (i = 0; i < 8; i++) {
    let val = hash[i];
    if (val < 0) val += maxWord;
    let hex = val.toString(16);
    while (hex[lengthProperty] < 8) hex = '0' + hex;
    result += hex;
  }
  return result;
}

function hmacSha256(key: string, message: string): string {
  if (key.length > 64) {
    const hex = sha256(key);
    let binary = '';
    for (let i = 0; i < hex.length; i += 2) {
      binary += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    key = binary;
  }
  while (key.length < 64) {
    key += '\x00';
  }
  
  let ipad = '';
  let opad = '';
  for (let i = 0; i < 64; i++) {
    ipad += String.fromCharCode(key.charCodeAt(i) ^ 0x36);
    opad += String.fromCharCode(key.charCodeAt(i) ^ 0x5c);
  }
  
  const innerHex = sha256(ipad + message);
  let innerBinary = '';
  for (let i = 0; i < innerHex.length; i += 2) {
    innerBinary += String.fromCharCode(parseInt(innerHex.substr(i, 2), 16));
  }
  
  return sha256(opad + innerBinary);
}

function base64UrlEncode(str: string): string {
  const base64 = btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  );
  return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return decodeURIComponent(
    atob(base64)
      .split('')
      .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
}

function hexToBase64Url(hex: string): string {
  let binary = '';
  for (let i = 0; i < hex.length; i += 2) {
    binary += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
  }
  const base64 = btoa(binary);
  return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// ==================== SUPERVISOR AUTH ====================

/**
 * Signs a payload creating a standard signed JWT token using HMAC-SHA256.
 */
export function signToken(payload: UserSession): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = hexToBase64Url(hmacSha256(JWT_SECRET, `${header}.${body}`));
  return `${header}.${body}.${signature}`;
}

/**
 * Verifies a JWT token signature and decodes the session payload.
 */
export function verifyToken(token: string): UserSession | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSig = hexToBase64Url(hmacSha256(JWT_SECRET, `${header}.${body}`));
    if (signature !== expectedSig) return null;
    return JSON.parse(base64UrlDecode(body)) as UserSession;
  } catch {
    return null;
  }
}

/**
 * Extracts the user session from the request cookies.
 */
export function getSession(req: NextRequest): UserSession | null {
  const token = req.cookies.get('session')?.value;
  if (!token) return null;
  return verifyToken(token);
}

// ==================== STUDENT AUTH ====================

export type StudentSession = {
  id: number;        // registrationId
  membershipNo: number;
  name: string;
  stage: string;
  grade: string;
  groupId: number | null;
};

export function signStudentToken(payload: StudentSession): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = hexToBase64Url(hmacSha256(STUDENT_SECRET, `${header}.${body}`));
  return `${header}.${body}.${signature}`;
}

export function verifyStudentToken(token: string): StudentSession | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSig = hexToBase64Url(hmacSha256(STUDENT_SECRET, `${header}.${body}`));
    if (signature !== expectedSig) return null;
    return JSON.parse(base64UrlDecode(body)) as StudentSession;
  } catch {
    return null;
  }
}

export function getStudentSession(req: NextRequest): StudentSession | null {
  const token = req.cookies.get('student_session')?.value;
  if (!token) return null;
  return verifyStudentToken(token);
}
