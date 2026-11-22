import { decodeCover, digest, MAX_BUNDLE_BYTES, PlaceLibraryError, reject } from './place-cover.js';

// Interoperability reference: cortico-world-map 0.3.0 (Qing / 青, MIT), src/transfer.js
// and src/places.js. This parser reads only bytes in the supplied v1 export.
export const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
export const SOURCE_MAX = 120;
const OLD_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;
const OLD_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/;
const MAX_SOURCE_PLACES = 300;
const MAX_TEXT_INPUT = 8192;
const UNSAFE_TEXT = /[<>\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/u;
const DIRECTION = /路线|导航|坐标|左转|右转|距离|路程|公里|千米|几分钟|[\d一二三四五六七八九十百几]+\s*(?:米|分钟|小时)|(?:向|往|朝|正)[东西南北]|[东西南北](?:侧|面|边|方)|(?:左|右)(?:侧|边|面)|\b(?:routes?|navigation|coordinates?|distance|east|west|north|south)\b/i;
export const BASIC_FIELDS = ['name', 'aliases', 'tags', 'kind', 'desc', 'style', 'scene', 'relations'];
export const SUPPLEMENT_FIELDS = ['style', 'relations'];
export const LIMITS = { name: 40, desc: 400, style: 160, scene: 40, kind: 40, aliases: 40, tags: 24, note: 80 };
export const isObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

export function safeId(id, regex = ID) {
  return typeof id === 'string' && regex.test(id) && !id.includes('..');
}

export function text(value, max, label, { strict = true, descriptive = false } = {}) {
  if (typeof value !== 'string' || value.length > MAX_TEXT_INPUT) {
    if (strict) reject('INVALID_INPUT', `${label} must be bounded text.`);
    return '';
  }
  const full = value.replace(/\s+/gu, ' ').trim();
  if ((descriptive && (UNSAFE_TEXT.test(full) || DIRECTION.test(full))) || /[\u0000-\u001f\u007f]/u.test(full)) {
    if (strict) reject('INVALID_INPUT', `${label} contains unsupported text.`);
    return '';
  }
  const chars = Array.from(full);
  if (strict && chars.length > max) reject('INVALID_INPUT', `${label} must contain at most ${max} characters.`);
  return chars.slice(0, max).join('');
}

function stringList(value, label, strict) {
  if (!Array.isArray(value) || (strict && value.length > 8)) {
    if (strict) reject('INVALID_INPUT', `${label} must be a list of up to 8 entries.`);
    return [];
  }
  return [...new Set(value.slice(0, 8).map((item) => text(item, LIMITS[label], label, {
    strict, descriptive: label === 'tags',
  })).filter(Boolean))];
}

export function focus(value, strict = true) {
  if (value == null) return null;
  if (isObject(value) && [value.x, value.y].every((n) => Number.isFinite(n) && n >= 0 && n <= 100)) {
    return { x: value.x, y: value.y };
  }
  if (strict) reject('INVALID_INPUT', 'Cover focus must be image percentages from 0 through 100.');
  return null;
}

function relationList(value, id, strict) {
  if (!Array.isArray(value) || (strict && value.length > 8)) {
    if (strict) reject('INVALID_INPUT', 'Relations must be a list of up to 8 entries.');
    return [];
  }
  const seen = new Set();
  const relations = [];
  for (const item of value.slice(0, 8)) {
    const target = item?.placeId;
    const note = text(item?.note, LIMITS.note, 'note', { strict, descriptive: true });
    if (!isObject(item) || !safeId(target, strict ? ID : OLD_ID) || target === id || seen.has(target) || !note) {
      if (strict) reject('INVALID_RELATION', 'Relations need a unique, different place ID and a descriptive note.');
      continue;
    }
    seen.add(target);
    relations.push({ placeId: target, note });
  }
  return relations;
}

export function editableFields(raw, id, { strict = true, fields = BASIC_FIELDS } = {}) {
  if (!isObject(raw)) reject('INVALID_INPUT', 'Place fields must be an object.');
  const result = {};
  for (const key of fields) {
    if (!Object.hasOwn(raw, key)) continue;
    switch (key) {
      case 'aliases': case 'tags': result[key] = stringList(raw[key], key, strict); break;
      case 'relations': result[key] = relationList(raw[key], id, strict); break;
      default: result[key] = text(raw[key], LIMITS[key], key, { strict });
    }
  }
  if (Object.hasOwn(result, 'name') && !result.name) reject('INVALID_INPUT', 'Place name cannot be empty.');
  return result;
}

export function blankPlace(id) {
  return { id, name: '', desc: '', kind: 'around', aliases: [], tags: [], style: '', scene: '', relations: [], cover: '', coverFocus: null };
}

export const blankSupplement = () => ({ style: '', relations: [], cover: '', coverFocus: null });

export function bundlesize(input) {
  if (typeof input === 'string') {
    if (Buffer.byteLength(input, 'utf8') > MAX_BUNDLE_BYTES) reject('INVALID_EXPORT', 'Export exceeds 64 MiB.');
    try { return JSON.parse(input); } catch { reject('INVALID_EXPORT', 'Export is not valid JSON.'); }
  }
  let encoded;
  try { encoded = JSON.stringify(input); } catch { reject('INVALID_EXPORT', 'Export is not JSON data.'); }
  if (typeof encoded !== 'string' || Buffer.byteLength(encoded, 'utf8') > MAX_BUNDLE_BYTES) {
    reject('INVALID_EXPORT', 'Export is missing or exceeds 64 MiB.');
  }
  return JSON.parse(encoded);
}

export function readLittleWorld(input) {
  const bundle = bundlesize(input);
  if (!isObject(bundle) || bundle.format !== 'little-world' || bundle.version !== 1 || !isObject(bundle.state)
    || bundle.state.version !== 1 || !Array.isArray(bundle.state.places) || !isObject(bundle.covers)) {
    reject('INVALID_EXPORT', 'Expected a little-world version 1 export with state and covers.');
  }
  if (bundle.state.places.length > MAX_SOURCE_PLACES || Object.keys(bundle.covers).length > MAX_SOURCE_PLACES) {
    reject('INVALID_EXPORT', 'Export has too many places or covers.');
  }
  const ids = new Set();
  const files = new Map();
  const warnings = [];
  const places = bundle.state.places.map((raw) => {
    if (!isObject(raw) || !safeId(raw.id, OLD_ID) || ids.has(raw.id) || !Object.hasOwn(raw, 'name')) {
      reject('INVALID_EXPORT', 'Export contains an invalid or duplicate place ID or a missing place name.');
    }
    ids.add(raw.id);
    const place = { ...blankPlace(raw.id), ...editableFields(raw, raw.id, { strict: false }) };
    place.kind ||= 'around';
    place.aliases = place.aliases.filter((alias) => alias !== place.name);
    place.legacyFunVenue = text(raw.funVenue, 40, 'funVenue', { strict: false });
    if (!raw.cover) return { place, coverStatus: 'none', coverKey: '', image: null };
    const key = raw.cover;
    if (!safeId(key, OLD_FILE)) {
      warnings.push(`${place.name}: invalid cover file name.`);
      return { place, coverStatus: 'invalid', coverKey: '', image: null };
    }
    if (!files.has(key)) {
      if (!Object.hasOwn(bundle.covers, key)) files.set(key, { coverStatus: 'missing', image: null });
      else {
        try { files.set(key, { coverStatus: 'valid', image: decodeCover(bundle.covers[key]) }); }
        catch (err) {
          if (!(err instanceof PlaceLibraryError)) throw err;
          files.set(key, { coverStatus: 'invalid', image: null });
        }
      }
    }
    const result = files.get(key);
    if (result.image) place.coverFocus = focus(raw.coverFocus, false);
    else warnings.push(`${place.name}: cover is ${result.coverStatus}.`);
    return { place, coverKey: key, ...result };
  });
  const rawHomeId = bundle.state.homeId ?? '';
  const homeId = ids.has(rawHomeId) ? rawHomeId : null;
  if (rawHomeId && !homeId) warnings.push('The exported home is missing or invalid.');
  // Ignore serialization order and volatile metadata, but include every transferable field.
  const signature = digest(JSON.stringify([homeId, places.map(({ place, coverStatus, image }) => (
    [place, coverStatus, image?.cover ?? '']
  )).sort((a, b) => a[0].id.localeCompare(b[0].id))]));
  const images = [...files.values()].filter((item) => item.image).map((item) => item.image);
  return { places, homeId, signature, warnings, coverCount: images.length,
    coverBytes: images.reduce((sum, image) => sum + image.bytes.length, 0) };
}
