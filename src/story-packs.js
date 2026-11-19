import { createHash } from 'node:crypto';
import { areasNow, phaseAt } from './phases.js';
import { hoursState } from './venues.js';

const MAX_RAW_BYTES = 32 * 1024;
const ID_RE = /^[a-z0-9_-]{1,24}$/;
const PLACE_ID_RE = /^[a-z0-9_-]{1,40}$/;
const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const UNSAFE_TEXT_RE = /(?:https?:\/\/|ftp:\/\/|file:\/\/|javascript:|data:|vbscript:|<|>|(?:^|\s)(?:\/|\\\\|\.\.?(?:\/|\\)|[A-Za-z]:[\\/])|(?:^|\s)[\w.-]+(?:[\\/][\w.-]+)+|(?:^|[^\w])(?:eval|Function|fetch|XMLHttpRequest|require|import)\s*\()/i;

function isRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function addUnknownKeys(value, allowed, path, errors) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${path}.${key}: unsupported field`);
  }
}

function textValue(value, path, max, errors, { required = true } = {}) {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string') {
    errors.push(`${path}: must be a string`);
    return undefined;
  }
  const normalized = value.replace(/\r\n?/g, '\n').replace(/[\t\n ]+/g, ' ').trim();
  if (required && !normalized) errors.push(`${path}: must not be empty`);
  if (normalized.length > max) errors.push(`${path}: exceeds ${max} characters`);
  if (UNSAFE_TEXT_RE.test(normalized)) errors.push(`${path}: executable or network/path content is not allowed`);
  return normalized;
}

function validId(value, path, errors) {
  if (typeof value !== 'string' || !ID_RE.test(value)) {
    errors.push(`${path}: must match [a-z0-9_-]{1,24}`);
    return undefined;
  }
  return value;
}

function canonicalRevision(content) {
  return createHash('sha256').update(JSON.stringify(content), 'utf8').digest('hex').slice(0, 32);
}

function parseRaw(raw, errors) {
  let value = raw;
  if (typeof raw === 'string') {
    if (Buffer.byteLength(raw, 'utf8') > MAX_RAW_BYTES) {
      errors.push('root: JSON exceeds 32 KB');
      return null;
    }
    try {
      value = JSON.parse(raw);
    } catch {
      errors.push('root: invalid JSON');
      return null;
    }
  } else {
    try {
      const encoded = JSON.stringify(raw);
      if (typeof encoded !== 'string' || Buffer.byteLength(encoded, 'utf8') > MAX_RAW_BYTES) {
        errors.push('root: JSON exceeds 32 KB or is not serializable');
        return null;
      }
    } catch {
      errors.push('root: value is not serializable JSON');
      return null;
    }
  }
  return value;
}

function normalizeWhen(raw, path, errors) {
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) {
    errors.push(`${path}: must be an object`);
    return undefined;
  }
  addUnknownKeys(raw, new Set(['from', 'to', 'phases', 'minVisits']), path, errors);
  const out = {};
  if ((raw.from === undefined) !== (raw.to === undefined)) {
    errors.push(`${path}: from and to must be supplied together`);
  }
  if (raw.from !== undefined) {
    if (typeof raw.from !== 'string' || !TIME_RE.test(raw.from)) errors.push(`${path}.from: must be HH:MM`);
    else out.from = raw.from;
  }
  if (raw.to !== undefined) {
    if (typeof raw.to !== 'string' || !TIME_RE.test(raw.to)) errors.push(`${path}.to: must be HH:MM`);
    else out.to = raw.to;
  }
  if (out.from !== undefined && out.to !== undefined && out.from === out.to) {
    errors.push(`${path}: from and to must describe a non-empty time window`);
  }
  if (raw.phases !== undefined) {
    if (!Array.isArray(raw.phases) || raw.phases.length > 16) {
      errors.push(`${path}.phases: must be an array of at most 16 phase ids`);
    } else {
      const phases = [];
      for (const [index, phase] of raw.phases.entries()) {
        const id = validId(phase, `${path}.phases[${index}]`, errors);
        if (id !== undefined) phases.push(id);
      }
      if (new Set(phases).size !== phases.length) errors.push(`${path}.phases: ids must be unique`);
      out.phases = phases;
    }
  }
  if (raw.minVisits !== undefined) {
    if (!Number.isInteger(raw.minVisits) || raw.minVisits < 0 || raw.minVisits > 100000) {
      errors.push(`${path}.minVisits: must be an integer from 0 to 100000`);
    } else out.minVisits = raw.minVisits;
  }
  return out;
}

/** Validate and canonicalize an authored version-1 story pack. */
export function validateStoryPack(raw) {
  const errors = [];
  const value = parseRaw(raw, errors);
  if (!isRecord(value)) {
    if (value !== null) errors.push('root: must be an object');
    return { ok: false, pack: null, errors };
  }
  addUnknownKeys(value, new Set(['version', 'id', 'title', 'description', 'placeId', 'start', 'nodes']), '$', errors);
  if (value.version !== 1) errors.push('version: must equal 1');
  const id = validId(value.id, 'id', errors);
  let placeId;
  if (typeof value.placeId !== 'string' || !PLACE_ID_RE.test(value.placeId)) {
    errors.push('placeId: must match [a-z0-9_-]{1,40}');
  } else placeId = value.placeId;
  const start = validId(value.start, 'start', errors);
  const title = textValue(value.title, 'title', 80, errors);
  const description = textValue(value.description, 'description', 240, errors, { required: false });

  const nodes = [];
  const rawNodes = value.nodes;
  if (!Array.isArray(rawNodes) || rawNodes.length < 1 || rawNodes.length > 16) {
    errors.push('nodes: must contain 1 to 16 nodes');
  } else {
    for (const [index, rawNode] of rawNodes.entries()) {
      const path = `nodes[${index}]`;
      if (!isRecord(rawNode)) {
        errors.push(`${path}: must be an object`);
        continue;
      }
      addUnknownKeys(rawNode, new Set(['id', 'area', 'event', 'prompt', 'when', 'choices', 'next']), path, errors);
      const nodeId = validId(rawNode.id, `${path}.id`, errors);
      const area = textValue(rawNode.area, `${path}.area`, 80, errors);
      const event = textValue(rawNode.event, `${path}.event`, 120, errors);
      const prompt = textValue(rawNode.prompt, `${path}.prompt`, 160, errors, { required: false });
      const when = normalizeWhen(rawNode.when, `${path}.when`, errors);
      let next;
      if (rawNode.next !== undefined) next = validId(rawNode.next, `${path}.next`, errors);

      let choices;
      if (rawNode.choices !== undefined) {
        if (!Array.isArray(rawNode.choices) || rawNode.choices.length < 2 || rawNode.choices.length > 4) {
          errors.push(`${path}.choices: must contain 2 to 4 options`);
        } else {
          choices = [];
          for (const [choiceIndex, rawChoice] of rawNode.choices.entries()) {
            const choicePath = `${path}.choices[${choiceIndex}]`;
            if (!isRecord(rawChoice)) {
              errors.push(`${choicePath}: must be an object`);
              continue;
            }
            addUnknownKeys(rawChoice, new Set(['id', 'label', 'result', 'next']), choicePath, errors);
            const choiceId = validId(rawChoice.id, `${choicePath}.id`, errors);
            if (choiceId === 'skip') errors.push(`${choicePath}.id: skip is reserved`);
            const label = textValue(rawChoice.label, `${choicePath}.label`, 160, errors);
            const result = textValue(rawChoice.result, `${choicePath}.result`, 160, errors);
            let choiceNext;
            if (rawChoice.next !== undefined) choiceNext = validId(rawChoice.next, `${choicePath}.next`, errors);
            choices.push({ id: choiceId, label, result, ...(choiceNext !== undefined ? { next: choiceNext } : {}) });
          }
          if (choices.length === rawNode.choices.length && new Set(choices.map((choice) => choice.id)).size !== choices.length) {
            errors.push(`${path}.choices: ids must be unique`);
          }
        }
        if (rawNode.next !== undefined) errors.push(`${path}: use either choices or next, not both`);
      }
      nodes.push({
        id: nodeId,
        area,
        event,
        ...(prompt !== undefined ? { prompt } : {}),
        ...(when !== undefined ? { when } : {}),
        ...(choices !== undefined ? { choices } : {}),
        ...(next !== undefined ? { next } : {}),
      });
    }
  }

  if (nodes.length === rawNodes?.length) {
    const ids = nodes.map((node) => node.id);
    if (new Set(ids).size !== ids.length) errors.push('nodes: ids must be unique');
    const nodeIds = new Set(ids);
    if (start !== undefined && !nodeIds.has(start)) errors.push('start: node does not exist');
    const choiceIds = new Set();
    for (const node of nodes) {
      if (node.choices) {
        for (const choice of node.choices) {
          if (choice.id !== undefined) choiceIds.add(choice.id);
          if (choice.next !== undefined && !nodeIds.has(choice.next)) errors.push(`nodes.${node.id}.choices.${choice.id}: next node does not exist`);
        }
      }
      if (node.next !== undefined && !nodeIds.has(node.next)) errors.push(`nodes.${node.id}.next: node does not exist`);
    }
    if (choiceIds.size < nodes.flatMap((node) => node.choices ?? []).length) errors.push('choices: ids must be unique within a pack');

    if (start !== undefined && nodeIds.has(start)) {
      const byId = new Map(nodes.map((node) => [node.id, node]));
      const reached = new Set();
      const visiting = new Set();
      const visited = new Set();
      let cycle = false;
      const visit = (nodeId) => {
        if (visiting.has(nodeId)) { cycle = true; return; }
        if (visited.has(nodeId)) return;
        const node = byId.get(nodeId);
        if (!node) return;
        visiting.add(nodeId);
        reached.add(nodeId);
        const edges = node.choices ? node.choices.map((choice) => choice.next).filter(Boolean) : (node.next ? [node.next] : []);
        for (const target of edges) visit(target);
        visiting.delete(nodeId);
        visited.add(nodeId);
      };
      visit(start);
      if (cycle) errors.push('nodes: graph must not contain cycles');
      if (reached.size !== nodes.length) errors.push('nodes: every node must be reachable from start');
      const hasTerminal = nodes.some((node) => reached.has(node.id) && (
        node.choices ? node.choices.some((choice) => !choice.next) : !node.next
      ));
      if (!hasTerminal) errors.push('nodes: graph must have a terminal path');
    }
  }

  if (errors.length) return { ok: false, pack: null, errors };
  const content = {
    version: 1,
    id,
    title,
    ...(description !== undefined ? { description } : {}),
    placeId,
    start,
    nodes,
  };
  const pack = { ...content, revision: canonicalRevision(content) };
  return { ok: true, pack, errors: [] };
}

/** Check whether a structurally valid pack can be used with a venue catalog. */
export function storyAvailability(pack, venues) {
  const warnings = [];
  const venueList = Array.isArray(venues) ? venues : (venues ? [venues] : []);
  const venue = venueList.find((item) => item?.id === pack?.placeId);
  const placeName = typeof venue?.name === 'string' ? venue.name : (pack?.placeId ?? '');
  if (!venue) {
    warnings.push(`Place “${pack?.placeId ?? ''}” is not available.`);
    return { available: false, placeName, warnings };
  }
  const venueAreas = new Set(Array.isArray(venue.areas) ? venue.areas : []);
  const missingAreas = [...new Set((Array.isArray(pack.nodes) ? pack.nodes : []).map((node) => node?.area).filter((area) => typeof area === 'string' && !venueAreas.has(area)))];
  if (missingAreas.length) warnings.push(`Missing areas: ${missingAreas.join(', ')}.`);
  const phases = new Set(Array.isArray(venue.phases) ? venue.phases.map((phase) => phase?.key).filter((key) => typeof key === 'string') : []);
  const referencedPhases = [...new Set((Array.isArray(pack.nodes) ? pack.nodes : []).flatMap((node) => node?.when?.phases ?? []))];
  const missingPhases = referencedPhases.filter((key) => !phases.has(key));
  if (missingPhases.length) warnings.push(`Unsupported phases: ${missingPhases.join(', ')}.`);
  return { available: warnings.length === 0, placeName, warnings };
}

function progressId(value) {
  return typeof value === 'string' && ID_RE.test(value) ? value : null;
}

/** Keep only the small JSON-safe cursor snapshots needed to resume a story. */
export function normalizeStoryProgress(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (out.length >= 32) break;
    if (!isRecord(item)) continue;
    const packId = progressId(item.packId);
    const nodeId = progressId(item.nodeId);
    const revision = typeof item.revision === 'string' && item.revision.length > 0 && item.revision.length <= 100 && /^[A-Za-z0-9_-]+$/.test(item.revision)
      ? item.revision : null;
    if (!packId || !nodeId || !revision || typeof item.done !== 'boolean') continue;
    const waitingChoiceId = item.waitingChoiceId === null || item.waitingChoiceId === undefined
      ? null
      : (typeof item.waitingChoiceId === 'string' && /^[A-Za-z0-9:_-]{1,100}$/.test(item.waitingChoiceId) ? item.waitingChoiceId : null);
    if (item.waitingChoiceId != null && waitingChoiceId === null) continue;
    if (!Array.isArray(item.options) || item.options.length > 4) continue;
    const options = [];
    let invalidOptions = false;
    for (const option of item.options) {
      if (!isRecord(option) || !progressId(option.id)) { invalidOptions = true; break; }
      if (option.next !== null && option.next !== undefined && !progressId(option.next)) { invalidOptions = true; break; }
      options.push({ id: option.id, next: option.next ?? null });
    }
    if (invalidOptions || new Set(options.map((option) => option.id)).size !== options.length) continue;
    if (waitingChoiceId && (options.length < 2 || options.length > 4 || item.done)) continue;
    if (!waitingChoiceId && options.length) continue;
    out.push({ packId, revision, nodeId, waitingChoiceId, options, done: item.done });
  }
  return out;
}

function inWindow(from, to, nowMin) {
  if (from === undefined || to === undefined) return true;
  const parse = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
  const start = parse(from);
  const end = parse(to);
  const now = Number(nowMin);
  if (!Number.isFinite(now)) return false;
  return end > start ? now >= start && now < end : now >= start || now < end;
}

function nodeMatches(node, venue, area, nowMin, visits) {
  if (node.area !== area || hoursState(venue, nowMin) === 'closed') return false;
  if (!areasNow(venue, nowMin).includes(area)) return false;
  const when = node.when;
  if (!when) return true;
  if (!inWindow(when.from, when.to, nowMin)) return false;
  if (when.minVisits !== undefined && !(Number(visits) >= when.minVisits)) return false;
  if (when.phases?.length) {
    const phaseKey = phaseAt(venue, nowMin).phase?.key;
    if (!phaseKey || !when.phases.includes(phaseKey)) return false;
  }
  return true;
}

function validatedPack(raw) {
  if (!isRecord(raw)) return null;
  const { revision, ...content } = raw;
  const result = validateStoryPack(content);
  if (!result.ok || (revision !== undefined && revision !== result.pack.revision)) return null;
  return result.pack;
}

/** Select the one matching story step, returning a cloned next progress snapshot. */
export function pickStory(catalog, venue, area, nowMin, session, visits) {
  if (!Array.isArray(catalog) || !venue || typeof area !== 'string' || !Number.isFinite(Number(nowMin)) || Number(nowMin) < 0 || Number(nowMin) >= 1440 || hoursState(venue, nowMin) === 'closed') return null;
  const current = normalizeStoryProgress(session?.storyProgress);
  const candidates = [];
  for (const row of catalog) {
    if (!row || row.enabled !== true || !row.pack) continue;
    const pack = validatedPack(row.pack);
    if (!pack || pack.placeId !== venue.id || !storyAvailability(pack, [venue]).available) continue;
    const existingIndex = current.findIndex((entry) => entry.packId === pack.id);
    const existing = existingIndex >= 0 ? current[existingIndex] : null;
    // A cursor from another revision is deliberately paused, never silently restarted.
    if (existing && existing.revision !== pack.revision) continue;
    if (existing && (existing.done || existing.waitingChoiceId)) continue;
    candidates.push({
      pack,
      existingIndex,
      existing,
      active: Boolean(existing && !existing.done && !existing.waitingChoiceId),
    });
  }
  candidates.sort((left, right) => Number(right.active) - Number(left.active));

  for (const candidate of candidates) {
    const { pack, existingIndex, existing } = candidate;
    const cursor = existing?.nodeId ?? pack.start;
    const node = pack.nodes.find((candidate) => candidate.id === cursor);
    if (!node || !nodeMatches(node, venue, area, nowMin, visits)) continue;

    const progress = current.map((entry) => ({ ...entry, options: entry.options.map((option) => ({ ...option })) }));
    let entry;
    if (existingIndex >= 0) entry = progress[existingIndex];
    else {
      if (progress.length >= 32) continue;
      entry = { packId: pack.id, revision: pack.revision, nodeId: node.id, waitingChoiceId: null, options: [], done: false };
      progress.push(entry);
    }

    let choice = null;
    if (node.choices) {
      const choiceId = `story:${pack.id}:${pack.revision}:${node.id}`;
      entry.waitingChoiceId = choiceId;
      entry.options = node.choices.map((option) => ({ id: option.id, next: option.next ?? null }));
      choice = {
        id: choiceId,
        event: node.event,
        area: node.area,
        prompt: node.prompt ?? node.event,
        options: node.choices.map(({ id, label, result }) => ({ id, label, result })),
      };
    } else if (node.next) {
      entry.nodeId = node.next;
      entry.waitingChoiceId = null;
      entry.options = [];
    } else {
      entry.done = true;
      entry.waitingChoiceId = null;
      entry.options = [];
    }
    return { event: node.event, choice, progress };
  }
  return null;
}

/** Resolve an offered choice using its serialized edge snapshot (or finish on skip). */
export function advanceStoryChoice(rawProgress, choiceId, optionId) {
  const progress = normalizeStoryProgress(rawProgress).map((entry) => ({ ...entry, options: entry.options.map((option) => ({ ...option })) }));
  const index = progress.findIndex((entry) => entry.waitingChoiceId === choiceId);
  if (index < 0) return progress;
  const entry = progress[index];
  const selected = entry.options.find((option) => option.id === optionId);
  const skip = optionId === null || optionId === undefined || optionId === 'skip';
  if (skip) {
    entry.done = true;
  } else if (!selected) {
    return progress;
  } else if (selected.next) {
    entry.nodeId = selected.next;
  } else {
    entry.done = true;
  }
  entry.waitingChoiceId = null;
  entry.options = [];
  return progress;
}
