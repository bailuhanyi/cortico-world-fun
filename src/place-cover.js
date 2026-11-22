import { createHash } from 'node:crypto';

// Reads cortico-world-map (Little World) v1 exports by Qing (青), MIT.
// Format reference: https://github.com/bailuhanyi/cortico-world-map/blob/main/src/transfer.js
export const MAX_COVER_BYTES = 8 * 1024 * 1024;
export const MAX_BUNDLE_BYTES = 64 * 1024 * 1024;
const MAX_IMAGE_SIDE = 8192;
const MAX_IMAGE_PIXELS = 24 * 1024 * 1024;
const MAX_ANIMATED_PIXELS = 96 * 1024 * 1024;
const MAX_FRAMES = 300;
const DATA_URL = /^data:(image\/(?:png|jpeg|jpg|gif|webp));base64,([A-Za-z0-9+/]+={0,2})$/;
const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');
const JPEG_SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

export class PlaceLibraryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PlaceLibraryError';
    this.code = code;
  }
}

export function reject(code, message) {
  throw new PlaceLibraryError(code, message);
}

export function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function safeCanvas(width, height, frames = 1) {
  return width > 0 && height > 0 && width <= MAX_IMAGE_SIDE && height <= MAX_IMAGE_SIDE
    && width * height <= MAX_IMAGE_PIXELS && frames > 0 && frames <= MAX_FRAMES
    && width * height * frames <= MAX_ANIMATED_PIXELS;
}

function png(b) {
  if (b.length < 45 || !b.subarray(0, 8).equals(PNG_SIGNATURE) || b.readUInt32BE(8) !== 13
    || b.toString('ascii', 12, 16) !== 'IHDR') return false;
  const width = b.readUInt32BE(16);
  const height = b.readUInt32BE(20);
  let frames = 1;
  let frameControls = 0;
  let hasData = false;
  for (let i = 33; i + 12 <= b.length;) {
    const length = b.readUInt32BE(i);
    const end = i + 12 + length;
    if (end > b.length) return false;
    const kind = b.toString('ascii', i + 4, i + 8);
    if (kind === 'acTL') {
      if (length !== 8 || hasData) return false;
      frames = b.readUInt32BE(i + 8);
    }
    if (kind === 'fcTL') {
      if (length !== 26) return false;
      frameControls += 1;
      const w = b.readUInt32BE(i + 12), h = b.readUInt32BE(i + 16);
      if (!safeCanvas(w, h) || w + b.readUInt32BE(i + 20) > width || h + b.readUInt32BE(i + 24) > height) return false;
    }
    if (kind === 'IDAT' && length) hasData = true;
    if (kind === 'IEND') return length === 0 && end === b.length && hasData
      && (frameControls === 0 || frameControls === frames) && safeCanvas(width, height, frames);
    i = end;
  }
  return false;
}

function jpeg(b) {
  if (b.length < 12 || b[0] !== 0xff || b[1] !== 0xd8 || b.at(-2) !== 0xff || b.at(-1) !== 0xd9) return false;
  let dimensions = false;
  for (let i = 2; i + 4 <= b.length;) {
    if (b[i++] !== 0xff) return false;
    while (b[i] === 0xff) i += 1;
    const marker = b[i++];
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (i + 2 > b.length) return false;
    const length = b.readUInt16BE(i);
    if (length < 2 || i + length > b.length) return false;
    if (JPEG_SOF.has(marker)) {
      if (length < 8 || !safeCanvas(b.readUInt16BE(i + 5), b.readUInt16BE(i + 3))) return false;
      dimensions = true;
    }
    if (marker === 0xda) return dimensions && i + length < b.length - 2;
    i += length;
  }
  return false;
}

function gif(b) {
  if (b.length < 14 || !['GIF87a', 'GIF89a'].includes(b.toString('ascii', 0, 6))) return false;
  const width = b.readUInt16LE(6), height = b.readUInt16LE(8);
  let i = 13;
  let frames = 0;
  if (b[10] & 128) i += 3 * (2 << (b[10] & 7));
  while (i < b.length) {
    const tag = b[i++];
    if (tag === 0x3b) return i === b.length && safeCanvas(width, height, frames);
    if (tag === 0x21 && i < b.length) {
      i += 1;
    } else if (tag === 0x2c && i + 9 < b.length) {
      const x = b.readUInt16LE(i), y = b.readUInt16LE(i + 2);
      const w = b.readUInt16LE(i + 4), h = b.readUInt16LE(i + 6);
      if (!w || !h || x + w > width || y + h > height || !safeCanvas(width, height, ++frames)) return false;
      const packed = b[i + 8];
      i += 9 + (packed & 128 ? 3 * (2 << (packed & 7)) : 0) + 1;
    } else return false;
    while (i < b.length && b[i] !== 0) i += b[i] + 1;
    if (i >= b.length) return false;
    i += 1;
  }
  return false;
}

function webp(b) {
  if (b.length < 26 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP'
    || b.readUInt32LE(4) + 8 !== b.length) return false;
  let w = 0, h = 0, frames = 0, still = false;
  let i = 12;
  for (; i + 8 <= b.length;) {
    const kind = b.toString('ascii', i, i + 4);
    const length = b.readUInt32LE(i + 4);
    const start = i + 8;
    const end = start + length + (length % 2);
    if (end > b.length) return false;
    if (kind === 'VP8X' && length === 10) {
      w = b.readUIntLE(start + 4, 3) + 1;
      h = b.readUIntLE(start + 7, 3) + 1;
    } else if (kind === 'VP8 ' && length >= 10 && b.readUIntBE(start + 3, 3) === 0x9d012a) {
      const width = b.readUInt16LE(start + 6) & 0x3fff, height = b.readUInt16LE(start + 8) & 0x3fff;
      if (!safeCanvas(width, height) || (w && (w !== width || h !== height))) return false;
      w = width; h = height; still = true;
    } else if (kind === 'VP8L' && length >= 5 && b[start] === 0x2f) {
      const bits = b.readUInt32LE(start + 1);
      const width = (bits & 0x3fff) + 1, height = ((bits >> 14) & 0x3fff) + 1;
      if (!safeCanvas(width, height) || (w && (w !== width || h !== height))) return false;
      w = width; h = height; still = true;
    } else if (kind === 'ANMF') {
      if (length < 24 || !safeCanvas(w, h, ++frames)) return false;
      const x = b.readUIntLE(start, 3) * 2, y = b.readUIntLE(start + 3, 3) * 2;
      const width = b.readUIntLE(start + 6, 3) + 1, height = b.readUIntLE(start + 9, 3) + 1;
      if (x + width > w || y + height > h) return false;
    }
    i = end;
  }
  return i === b.length && (still || frames > 0) && safeCanvas(w, h, frames || 1);
}

const TYPES = new Map([
  ['image/png', { ext: 'png', validate: png }], ['image/jpeg', { ext: 'jpg', validate: jpeg }],
  ['image/gif', { ext: 'gif', validate: gif }], ['image/webp', { ext: 'webp', validate: webp }],
]);
export const COVER_ID = /^[a-f0-9]{64}\.(?:png|jpg|gif|webp)$/;

export function decodeCover(dataUrl) {
  if (typeof dataUrl !== 'string' || dataUrl.length > 32 + Math.ceil(MAX_COVER_BYTES / 3) * 4) {
    reject('INVALID_COVER', 'Cover must be image bytes supplied as a data URL (maximum 8 MiB).');
  }
  const match = DATA_URL.exec(dataUrl);
  if (!match) reject('INVALID_COVER', 'Cover must be a PNG, JPEG, GIF or WebP data URL.');
  const mime = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
  const { ext, validate } = TYPES.get(mime);
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > MAX_COVER_BYTES || bytes.toString('base64') !== match[2] || !validate(bytes)) {
    reject('INVALID_COVER', 'Cover is malformed, mismatched, or exceeds safe image limits.');
  }
  return { mime, bytes, cover: `${digest(bytes)}.${ext}` };
}

export function storedCover(cover, bytes) {
  const entry = [...TYPES].find(([, type]) => cover.endsWith(`.${type.ext}`));
  if (!entry || !cover.startsWith(`${digest(bytes)}.`) || !entry[1].validate(bytes)) {
    reject('DAMAGED_LIBRARY', 'Stored cover is damaged.');
  }
  const mime = entry[0];
  return { cover, mime, byteLength: bytes.length, dataUrl: `data:${mime};base64,${bytes.toString('base64')}` };
}
