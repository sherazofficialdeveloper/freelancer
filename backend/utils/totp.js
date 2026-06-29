import crypto from 'crypto';

// Base32 Alphabet
const b32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// Generate a random Base32 secret (16 chars, 80 bits, standard)
export function generateBase32Secret() {
  const bytes = crypto.randomBytes(10); // 80 bits
  let secret = '';
  let val = 0;
  let count = 0;
  for (let i = 0; i < bytes.length; i++) {
    val = (val << 8) | bytes[i];
    count += 8;
    while (count >= 5) {
      secret += b32Alphabet[(val >>> (count - 5)) & 31];
      count -= 5;
    }
  }
  if (count > 0) {
    secret += b32Alphabet[(val << (5 - count)) & 31];
  }
  return secret;
}

// Decode Base32 to a Buffer
function decodeBase32(b32) {
  const cleanB32 = b32.toUpperCase().replace(/=+$/, '');
  let bytes = [];
  let val = 0;
  let count = 0;
  for (let i = 0; i < cleanB32.length; i++) {
    const idx = b32Alphabet.indexOf(cleanB32[i]);
    if (idx === -1) continue;
    val = (val << 5) | idx;
    count += 5;
    if (count >= 8) {
      bytes.push((val >>> (count - 8)) & 255);
      count -= 8;
    }
  }
  return Buffer.from(bytes);
}

// Generate TOTP (6-digit code)
export function generateTOTP(secret, timeStepIndex) {
  const key = decodeBase32(secret);
  
  // Buffer representing 8-byte time step counter
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(timeStepIndex / 0x100000000), 0);
  buffer.writeUInt32BE(timeStepIndex % 0x100000000, 4);

  // HMAC-SHA1
  const hmac = crypto.createHmac('sha1', key);
  hmac.update(buffer);
  const hmacResult = hmac.digest();

  // Dynamic truncation
  const offset = hmacResult[hmacResult.length - 1] & 0xf;
  const binary = ((hmacResult[offset] & 0x7f) << 24) |
                 ((hmacResult[offset + 1] & 0xff) << 16) |
                 ((hmacResult[offset + 2] & 0xff) << 8) |
                 (hmacResult[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

// Verify TOTP token with a window for clock drift (default +/- 1 step)
export function verifyTOTP(secret, token, windowSteps = 1) {
  const currentTime = Math.floor(Date.now() / 1000);
  const currentStep = Math.floor(currentTime / 30);

  for (let i = -windowSteps; i <= windowSteps; i++) {
    const stepOtp = generateTOTP(secret, currentStep + i);
    if (stepOtp === token.trim()) {
      return true;
    }
  }
  return false;
}

export default {
  generateBase32Secret,
  generateTOTP,
  verifyTOTP
};
