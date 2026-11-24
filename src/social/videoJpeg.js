import decode from 'jpeg-js/lib/decoder.js';
import { socialError, validateSocialJpeg } from './policy.js';

// Check dimensions before allocation, then decode every MCU with truncation
// tolerance disabled. Limits cover only this fixed 1080x1920 template.
export function validateReelCover(bytes, type) {
  const asset = validateSocialJpeg(bytes, type, 1920);
  try {
    const image = decode(bytes, {
      useTArray: true, formatAsRGBA: false, tolerantDecoding: false,
      maxResolutionInMP: 2.1, maxMemoryUsageInMB: 32,
    });
    if (image.width !== 1080 || image.height !== 1920 || image.data.length !== 1080 * 1920 * 3) throw new Error('Incomplete portrait');
  } catch { throw socialError('Invalid JPEG image or incomplete encoded scan.'); }
  return asset;
}
