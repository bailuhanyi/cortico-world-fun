import { createHash } from 'node:crypto';
import { areasNow, phaseAt } from './phases.js';
import { hoursState } from './venues.js';
import { DEFAULT_STORY_NODE_LIMIT, isValidStoryNodeLimit } from './story-node-limit.js';

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

function normalizeReferences(raw, nodes, errors) {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > 24) {
    errors.push('references: must be an array of at most 24 entries');
    return [];
  }
  return raw.flatMap((item, i) => {
    const path = `references[${i}]`;
    if (!isRecord(item)) { errors.push(`${path}: must be an object`); return []; }
    addUnknownKeys(item, new Set(['area', 'afterNode', 'afterChoice', 'audience', 'text']), path, errors);
    const area = textValue(item.area, `${path}.area`, 80, errors);
    const afterNode = validId(item.afterNode, `${path}.afterNode`, errors);
    const afterChoice = item.afterChoice === undefined ? undefined : validId(item.afterChoice, `${path}.afterChoice`, errors);
    const node = nodes.find((entry) => afterNode && entry.id === afterNode);
    if (!node) errors.push(`${path}.afterNode: node does not exist`);
    if (!nodes.some((entry) => entry.area === area)) errors.push(`${path}.area: must be an authored story area`);
    if (afterChoice && !node?.choices?.some((choice) => choice.id === afterChoice)) errors.push(`${path}.afterChoice: must be a choice of afterNode`);
    if (!['player', 'fish', 'dm'].includes(item.audience)) errors.push(`${path}.audience: must be player, fish, or dm`);
    const text = textValue(item.text, `${path}.text`, 240, errors);
    return [{ area, afterNode, ...(afterChoice ? { afterChoice } : {}), audience: item.audience, text }];
  });
}

/** Only send unlocked references for this audience; never send the conditions or other text. */
export function storyReferences(pack, outing, audience) {
  const progress = outing?.storyProgress?.find((entry) => entry.packId === pack?.id && entry.revision === pack?.revision);
  const area = outing?.visited?.at(-1)?.area;
  if (!area || !progress?.triggered?.length) return [];
  return (pack.references ?? []).filter((item) => item.audience === audience && item.area === area
    && progress.triggered.includes(item.afterNode)
    && (!item.afterChoice || (outing.choices ?? []).some((choice) => choice.option === item.afterChoice)))
    .slice(0, 6).map((item) => item.text);
}

/** Validate and canonicalize an authored version-1 or version-2 story pack. */
export function validateStoryPack(raw, options = {}) {
  const requestedLimit = options?.maxNodes;
  const maxNodes = requestedLimit === undefined ? DEFAULT_STORY_NODE_LIMIT
    : isValidStoryNodeLimit(requestedLimit) ? requestedLimit : DEFAULT_STORY_NODE_LIMIT;
  const errors = [];
  const value = parseRaw(raw, errors);
  if (!isRecord(value)) {
    if (value !== null) errors.push('root: must be an object');
    return { ok: false, pack: null, errors };
  }
  // 自由模式（场景包）与选项图是两套内容形态，走各自的校验，互不影响。
  if (value.version === 3) return validateFreePack(value, errors);
  if (![1, 2].includes(value.version)) errors.push('version: must equal 1 or 2');
  const version = value.version;
  const rootKeys = new Set(['version', 'id', 'title', 'description', 'placeId', 'start', 'nodes', ...(version === 2 ? ['metadata', 'references'] : [])]);
  addUnknownKeys(value, rootKeys, '$', errors);
  const id = validId(value.id, 'id', errors);
  let placeId;
  if (typeof value.placeId !== 'string' || !PLACE_ID_RE.test(value.placeId)) {
    errors.push('placeId: must match [a-z0-9_-]{1,40}');
  } else placeId = value.placeId;
  const start = validId(value.start, 'start', errors);
  const title = textValue(value.title, 'title', 80, errors);
  const description = textValue(value.description, 'description', 240, errors, { required: false });
  let metadata;
  if (version === 2) {
    if (!isRecord(value.metadata)) {
      errors.push('metadata: must be an object for version 2');
    } else {
      const rawMetadata = value.metadata;
      addUnknownKeys(rawMetadata, new Set(['author', 'release', 'genre', 'synopsis', 'participation', 'durationMinutes', 'requirements', 'seriesId', 'chapter', 'requiresCompleted', 'jointResolution']), 'metadata', errors);
      const author = textValue(rawMetadata.author, 'metadata.author', 80, errors);
      const release = textValue(rawMetadata.release, 'metadata.release', 24, errors);
      if (release && !/^[A-Za-z0-9][A-Za-z0-9.+_-]{0,23}$/.test(release)) errors.push('metadata.release: must be a short version label');
      const genre = textValue(rawMetadata.genre, 'metadata.genre', 40, errors);
      const synopsis = textValue(rawMetadata.synopsis, 'metadata.synopsis', 240, errors);
      const participation = rawMetadata.participation;
      if (!['solo', 'duo'].includes(participation)) errors.push('metadata.participation: must be solo or duo');
      let jointResolution;
      if (rawMetadata.jointResolution !== undefined) {
        if (!['require-agreement', 'owner-final', 'fish-final'].includes(rawMetadata.jointResolution)) errors.push('metadata.jointResolution: must be require-agreement, owner-final, or fish-final');
        else jointResolution = rawMetadata.jointResolution;
      }
      let durationMinutes;
      if (rawMetadata.durationMinutes !== undefined) {
        if (!Number.isInteger(rawMetadata.durationMinutes) || rawMetadata.durationMinutes < 1 || rawMetadata.durationMinutes > 600) errors.push('metadata.durationMinutes: must be an integer from 1 to 600');
        else durationMinutes = rawMetadata.durationMinutes;
      }
      let requirements = [];
      if (rawMetadata.requirements !== undefined) {
        if (!Array.isArray(rawMetadata.requirements) || rawMetadata.requirements.length > 8) errors.push('metadata.requirements: must be an array of at most 8 items');
        else requirements = rawMetadata.requirements.map((item, index) => textValue(item, `metadata.requirements[${index}]`, 80, errors));
      }
      let seriesId;
      if (rawMetadata.seriesId !== undefined) seriesId = validId(rawMetadata.seriesId, 'metadata.seriesId', errors);
      let chapter;
      if (rawMetadata.chapter !== undefined) {
        if (!Number.isInteger(rawMetadata.chapter) || rawMetadata.chapter < 1 || rawMetadata.chapter > 1000) errors.push('metadata.chapter: must be an integer from 1 to 1000');
        else chapter = rawMetadata.chapter;
      }
      if ((seriesId === undefined) !== (chapter === undefined)) errors.push('metadata.seriesId and metadata.chapter must be supplied together');
      let requiresCompleted = [];
      if (rawMetadata.requiresCompleted !== undefined) {
        if (!Array.isArray(rawMetadata.requiresCompleted) || rawMetadata.requiresCompleted.length > 8) errors.push('metadata.requiresCompleted: must be an array of at most 8 story ids');
        else requiresCompleted = rawMetadata.requiresCompleted.map((item, index) => validId(item, `metadata.requiresCompleted[${index}]`, errors)).filter(Boolean);
        if (new Set(requiresCompleted).size !== requiresCompleted.length) errors.push('metadata.requiresCompleted: ids must be unique');
      }
      if (participation === 'duo' && !jointResolution) errors.push('metadata.jointResolution: required for duo stories');
      if (participation === 'solo' && jointResolution) errors.push('metadata.jointResolution: only valid for duo stories');
      metadata = { author, release, genre, synopsis, participation, ...(jointResolution ? { jointResolution } : {}), ...(durationMinutes !== undefined ? { durationMinutes } : {}), requirements,
        ...(seriesId !== undefined ? { seriesId, chapter } : {}), ...(requiresCompleted.length ? { requiresCompleted } : {}) };
    }
  }

  const nodes = [];
  const rawNodes = value.nodes;
  if (!Array.isArray(rawNodes) || rawNodes.length < 1 || (maxNodes !== 0 && rawNodes.length > maxNodes)) {
    errors.push(maxNodes === 0 ? 'nodes: must contain at least 1 node' : `nodes: must contain 1 to ${maxNodes} nodes`);
  } else {
    for (const [index, rawNode] of rawNodes.entries()) {
      const path = `nodes[${index}]`;
      if (!isRecord(rawNode)) {
        errors.push(`${path}: must be an object`);
        continue;
      }
      addUnknownKeys(rawNode, new Set(['id', 'area', 'event', 'prompt', 'when', 'choices', 'next', ...(version === 2 ? ['actor'] : [])]), path, errors);
      const nodeId = validId(rawNode.id, `${path}.id`, errors);
      const area = textValue(rawNode.area, `${path}.area`, 80, errors);
      const event = textValue(rawNode.event, `${path}.event`, 120, errors);
      const prompt = textValue(rawNode.prompt, `${path}.prompt`, 160, errors, { required: false });
      const when = normalizeWhen(rawNode.when, `${path}.when`, errors);
      let actor;
      if (version === 2 && rawNode.choices !== undefined) {
        actor = rawNode.actor;
        if (metadata?.participation === 'duo') {
          if (!['owner', 'fish', 'joint'].includes(actor)) errors.push(`${path}.actor: duo choice nodes require owner, fish, or joint`);
        } else if (actor !== undefined && actor !== 'owner') errors.push(`${path}.actor: solo stories cannot declare a fish or joint turn`);
        if (metadata?.participation === 'solo') actor = undefined;
      } else if (version === 2 && rawNode.actor !== undefined) {
        errors.push(`${path}.actor: only choice nodes may declare an actor`);
      }
      if (version === 1 && rawNode.actor !== undefined) errors.push(`${path}.actor: requires version 2`);
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
        ...(actor !== undefined && ['owner', 'fish', 'joint'].includes(actor) ? { actor } : {}),
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

  const references = version === 2 ? normalizeReferences(value.references, nodes, errors) : [];
  if (errors.length) return { ok: false, pack: null, errors };
  const content = {
    version,
    id,
    title,
    ...(description !== undefined ? { description } : {}),
    ...(version === 2 ? { metadata } : {}),
    ...(references.length ? { references } : {}),
    placeId,
    start,
    nodes,
  };
  const pack = { ...content, revision: canonicalRevision(content) };
  return { ok: true, pack, errors: [] };
}

const FREE_STATE_ID = /^[a-z0-9_-]{1,24}$/;
const FREE_WHEN_KEYS = new Set(['all', 'any', 'flag', 'counter', 'fact', 'gte', 'lte', 'equals']);

function textList(raw, path, maxItems, maxChars, errors) {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > maxItems) {
    errors.push(`${path}: must be an array of at most ${maxItems} strings`);
    return [];
  }
  return raw.map((item, index) => textValue(item, `${path}[${index}]`, maxChars, errors)).filter((item) => item !== undefined);
}

function freeIds(raw, path, maxItems, build, errors) {
  if (!Array.isArray(raw) || raw.length > maxItems) {
    errors.push(`${path}: must be an array of at most ${maxItems} entries`);
    return [];
  }
  const out = [];
  for (const [index, item] of raw.entries()) {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(item)) { errors.push(`${itemPath}: must be an object`); continue; }
    out.push(build(item, itemPath, errors));
  }
  const ids = out.map((entry) => entry?.id).filter(Boolean);
  if (new Set(ids).size !== ids.length) errors.push(`${path}: ids must be unique`);
  return out.filter(Boolean);
}

/** 自由模式的判定条件：all / any / flag / counter / fact，只引用已登记的状态 id。 */
function normalizeFreeWhen(raw, path, errors, stateIds) {
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) { errors.push(`${path}: must be an object`); return undefined; }
  addUnknownKeys(raw, FREE_WHEN_KEYS, path, errors);
  const keys = Object.keys(raw).filter((key) => ['all', 'any', 'flag', 'counter', 'fact'].includes(key));
  if (keys.length !== 1) { errors.push(`${path}: must contain exactly one of all, any, flag, counter, fact`); return undefined; }
  const key = keys[0];
  if (key === 'all' || key === 'any') {
    if (!Array.isArray(raw[key]) || raw[key].length < 1 || raw[key].length > 8) {
      errors.push(`${path}.${key}: must be an array of 1 to 8 conditions`);
      return undefined;
    }
    const clauses = raw[key].map((item, index) => normalizeFreeWhen(item, `${path}.${key}[${index}]`, errors, stateIds)).filter(Boolean);
    return { [key]: clauses };
  }
  if (key === 'flag') {
    if (typeof raw.flag !== 'string' || !stateIds.flags.has(raw.flag)) { errors.push(`${path}.flag: unknown flag id`); return undefined; }
    return { flag: raw.flag };
  }
  if (key === 'counter') {
    if (typeof raw.counter !== 'string' || !stateIds.counters.has(raw.counter)) { errors.push(`${path}.counter: unknown counter id`); return undefined; }
    const clause = { counter: raw.counter };
    for (const field of ['gte', 'lte']) {
      if (raw[field] === undefined) continue;
      if (!Number.isSafeInteger(raw[field])) { errors.push(`${path}.${field}: must be an integer`); continue; }
      clause[field] = raw[field];
    }
    if (clause.gte === undefined && clause.lte === undefined) { errors.push(`${path}: counter condition needs gte or lte`); return undefined; }
    return clause;
  }
  if (typeof raw.fact !== 'string' || !stateIds.facts.has(raw.fact)) { errors.push(`${path}.fact: unknown fact id`); return undefined; }
  if (typeof raw.equals !== 'string') { errors.push(`${path}.equals: must be a string`); return undefined; }
  return { fact: raw.fact, equals: raw.equals.slice(0, 200) };
}

function normalizeFreeSetting(raw, errors) {
  if (!isRecord(raw)) { errors.push('setting: must be an object for version 3'); return undefined; }
  addUnknownKeys(raw, new Set(['premise', 'canon', 'forbidden', 'cast', 'locations', 'opening', 'flags', 'counters', 'facts', 'goals', 'ends', 'beats']), 'setting', errors);
  const premise = textValue(raw.premise, 'setting.premise', 240, errors);
  const opening = textValue(raw.opening, 'setting.opening', 400, errors);
  const canon = textList(raw.canon, 'setting.canon', 12, 120, errors);
  if (canon.length < 3) errors.push('setting.canon: needs at least 3 fixed facts');
  const forbidden = textList(raw.forbidden, 'setting.forbidden', 8, 120, errors);
  const beats = textList(raw.beats, 'setting.beats', 6, 60, errors);

  const cast = freeIds(raw.cast, 'setting.cast', 8, (item, path) => ({
    id: validId(item.id, `${path}.id`, errors),
    name: textValue(item.name, `${path}.name`, 40, errors),
    role: textValue(item.role, `${path}.role`, 120, errors, { required: false }) ?? '',
    secret: textValue(item.secret, `${path}.secret`, 120, errors, { required: false }) ?? '',
  }), errors);
  const locations = freeIds(raw.locations, 'setting.locations', 8, (item, path) => ({
    id: validId(item.id, `${path}.id`, errors),
    name: textValue(item.name, `${path}.name`, 40, errors),
    desc: textValue(item.desc, `${path}.desc`, 160, errors, { required: false }) ?? '',
  }), errors);
  const flags = freeIds(raw.flags, 'setting.flags', 12, (item, path) => ({
    id: validId(item.id, `${path}.id`, errors),
    label: textValue(item.label, `${path}.label`, 40, errors, { required: false }) ?? '',
    initial: item.initial === true,
  }), errors);
  const facts = freeIds(raw.facts, 'setting.facts', 12, (item, path) => ({
    id: validId(item.id, `${path}.id`, errors),
    label: textValue(item.label, `${path}.label`, 40, errors, { required: false }) ?? '',
    initial: textValue(item.initial, `${path}.initial`, 200, errors, { required: false }) ?? '',
  }), errors);
  const counters = freeIds(raw.counters, 'setting.counters', 8, (item, path) => {
    const min = Number.isSafeInteger(item.min) ? item.min : 0;
    const max = Number.isSafeInteger(item.max) ? item.max : 10;
    if (min < 0 || max > 100 || min >= max) errors.push(`${path}: needs 0 <= min < max <= 100`);
    const initial = Number.isSafeInteger(item.initial) ? item.initial : min;
    if (initial < min || initial > max) errors.push(`${path}.initial: must be within min..max`);
    return { id: validId(item.id, `${path}.id`, errors), label: textValue(item.label, `${path}.label`, 40, errors, { required: false }) ?? '', min, max, initial };
  }, errors);

  // 三个状态区共用一个 id 空间：delta 里写的是哪个区都不许含糊。
  const stateIds = {
    flags: new Set(flags.map((item) => item.id)),
    counters: new Set(counters.map((item) => item.id)),
    facts: new Set(facts.map((item) => item.id)),
  };
  const allStateIds = new Set([...stateIds.flags, ...stateIds.counters, ...stateIds.facts]);
  if (allStateIds.size !== stateIds.flags.size + stateIds.counters.size + stateIds.facts.size) errors.push('setting: flag/counter/fact ids must not repeat across sections');

  const goals = freeIds(raw.goals, 'setting.goals', 4, (item, path) => ({
    id: validId(item.id, `${path}.id`, errors),
    text: textValue(item.text, `${path}.text`, 120, errors),
    when: normalizeFreeWhen(item.when, `${path}.when`, errors, stateIds),
  }), errors);
  const ends = freeIds(raw.ends, 'setting.ends', 4, (item, path) => {
    const when = normalizeFreeWhen(item.when, `${path}.when`, errors, stateIds);
    if (when === undefined) errors.push(`${path}.when: endings need a condition`);
    return { id: validId(item.id, `${path}.id`, errors), text: textValue(item.text, `${path}.text`, 120, errors), when };
  }, errors);
  if (!ends.length) errors.push('setting.ends: needs at least one ending');

  return { premise, canon, ...(forbidden.length ? { forbidden } : {}), cast, locations, opening, flags, counters, facts, goals, ends, ...(beats.length ? { beats } : {}) };
}

function normalizeFreeMetadata(raw, errors) {
  if (!isRecord(raw)) { errors.push('metadata: must be an object for version 3'); return undefined; }
  addUnknownKeys(raw, new Set(['mode', 'author', 'release', 'genre', 'synopsis', 'participation', 'durationMinutes', 'maxTurns']), 'metadata', errors);
  if (raw.mode !== 'free') errors.push('metadata.mode: must equal free for version 3');
  const author = textValue(raw.author, 'metadata.author', 80, errors);
  const release = textValue(raw.release, 'metadata.release', 24, errors);
  if (release && !/^[A-Za-z0-9][A-Za-z0-9.+_-]{0,23}$/.test(release)) errors.push('metadata.release: must be a short version label');
  const genre = textValue(raw.genre, 'metadata.genre', 40, errors, { required: false }) ?? '';
  const synopsis = textValue(raw.synopsis, 'metadata.synopsis', 240, errors);
  if (!['solo', 'duo', 'group'].includes(raw.participation)) errors.push('metadata.participation: must be solo, duo, or group');
  let durationMinutes;
  if (raw.durationMinutes !== undefined) {
    if (!Number.isInteger(raw.durationMinutes) || raw.durationMinutes < 1 || raw.durationMinutes > 600) errors.push('metadata.durationMinutes: must be an integer from 1 to 600');
    else durationMinutes = raw.durationMinutes;
  }
  let maxTurns;
  if (raw.maxTurns !== undefined) {
    if (!Number.isInteger(raw.maxTurns) || raw.maxTurns < 1 || raw.maxTurns > 200) errors.push('metadata.maxTurns: must be an integer from 1 to 200');
    else maxTurns = raw.maxTurns;
  }
  return { mode: 'free', author, release, genre, synopsis, participation: raw.participation, ...(durationMinutes ? { durationMinutes } : {}), ...(maxTurns ? { maxTurns } : {}) };
}

/** version 3：只写设定与判定条件，不写节点、不写选项。 */
function validateFreePack(value, errors) {
  addUnknownKeys(value, new Set(['version', 'id', 'title', 'description', 'placeId', 'metadata', 'setting']), '$', errors);
  const id = validId(value.id, 'id', errors);
  const title = textValue(value.title, 'title', 80, errors);
  const description = textValue(value.description, 'description', 240, errors, { required: false });
  let placeId;
  if (typeof value.placeId !== 'string' || !PLACE_ID_RE.test(value.placeId)) errors.push('placeId: must match [a-z0-9_-]{1,40}');
  else placeId = value.placeId;
  const metadata = normalizeFreeMetadata(value.metadata, errors);
  const setting = normalizeFreeSetting(value.setting, errors);
  if (errors.length) return { ok: false, pack: null, errors };
  const content = { version: 3, id, title, ...(description !== undefined ? { description } : {}), metadata, placeId, setting };
  return { ok: true, pack: { ...content, revision: canonicalRevision(content) }, errors: [] };
}

/**
 * Check whether a structurally valid pack can be used with a venue catalog.
 *
 * 每条警告都直接说明「差什么、去哪儿补」：这里的中文会原样出现在故事工坊的作品卡和
 * `fun_story` 的列表回执里，玩家就是靠它判断「导进去了为什么一直不触发」。
 * `placeMissing` / `missingAreas` 另给一份结构化结果，面板据此直接摆出「绑定到现有地点」，
 * 不必去解析文案。
 */
export function storyAvailability(pack, venues, completedStoryIds = []) {
  const warnings = [];
  const venueList = Array.isArray(venues) ? venues : (venues ? [venues] : []);
  const placeId = typeof pack?.placeId === 'string' ? pack.placeId : '';
  const venue = venueList.find((item) => item?.id === placeId);
  const placeName = typeof venue?.name === 'string' ? venue.name : placeId;
  if (!venue) {
    warnings.push(`这处地点「${placeId}」在地点册里没有。先新建它，或把故事包绑到已有地点。`);
    return { available: false, placeMissing: true, placeId, placeName, warnings };
  }
  const venueAreas = new Set(Array.isArray(venue.areas) ? venue.areas : []);
  const missingAreas = [...new Set((Array.isArray(pack.nodes) ? pack.nodes : []).map((node) => node?.area).filter((area) => typeof area === 'string' && !venueAreas.has(area)))];
  if (missingAreas.length) warnings.push(`「${placeName}」缺少故事要用的区域：${missingAreas.join('、')}。在地点册的「能逛的」里补上同名的区域。`);
  const phases = new Set(Array.isArray(venue.phases) ? venue.phases.map((phase) => phase?.key).filter((key) => typeof key === 'string') : []);
  const referencedPhases = [...new Set((Array.isArray(pack.nodes) ? pack.nodes : []).flatMap((node) => node?.when?.phases ?? []))];
  const missingPhases = referencedPhases.filter((key) => !phases.has(key));
  if (missingPhases.length) warnings.push(`「${placeName}」没有故事要用的时段：${missingPhases.join('、')}。`);
  const completed = completedStoryIds instanceof Set ? completedStoryIds : new Set(Array.isArray(completedStoryIds) ? completedStoryIds : []);
  const missingStoryIds = (pack?.metadata?.requiresCompleted ?? []).filter((id) => !completed.has(id));
  if (missingStoryIds.length) warnings.push(`要先完成这些故事：${missingStoryIds.join('、')}。`);
  return { available: warnings.length === 0, placeMissing: false, placeId, placeName, warnings, ...(missingAreas.length ? { missingAreas } : {}), ...(missingStoryIds.length ? { missingStoryIds } : {}) };
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
    const triggered = Array.isArray(item.triggered) ? [...new Set(item.triggered.filter((id) => typeof id === 'string' && ID_RE.test(id)))].slice(0, 16) : [];
    out.push({ packId, revision, nodeId, waitingChoiceId, options, done: item.done, ...(triggered.length ? { triggered } : {}) });
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

/**
 * 说出「这一步为什么走不动」——比笼统的「不满足条件」有用得多。
 * 只在 `pickStory` 已经判否之后调用，所以这里只解释原因，不做判定。
 */
export function storyStepBlock(pack, node, venue, nowMin, visits = 0) {
  if (!node || !venue) return '';
  const hhmm = (value) => `${String(Math.floor(Number(value) / 60)).padStart(2, '0')}:${String(Number(value) % 60).padStart(2, '0')}`;
  const currentPhase = phaseAt(venue, nowMin)?.phase;
  const phaseName = currentPhase?.label ?? '';
  const when = node.when;
  if (when?.from !== undefined && !inWindow(when.from, when.to, nowMin)) {
    return `这一步要等到 ${when.from}–${when.to} 才会触发；现在是 ${hhmm(nowMin)}。可以先接着逛别的，或按已有记录回家。`;
  }
  if (when?.phases?.length) {
    const key = currentPhase?.key;
    if (!key || !when.phases.includes(key)) {
      const labels = (venue.phases ?? []).filter((phase) => when.phases.includes(phase.key)).map((phase) => `${phase.label}（${phase.from}–${phase.to}）`);
      return `这一步只在${labels.join('、') || when.phases.join('、')}触发；现在是${phaseName || hhmm(nowMin)}。`;
    }
  }
  if (when?.minVisits !== undefined && !(Number(visits) >= when.minVisits)) {
    return `这一步要来这处至少 ${when.minVisits} 次之后才会触发；现在已经来过 ${Number(visits) || 0} 次。`;
  }
  if (!Array.isArray(venue.areas) || !venue.areas.includes(node.area)) {
    return `故事要去的「${node.area}」不在这处地点里。请在从0开始的肥鱼大冒险核对故事包绑定的区域和地点。`;
  }
  if (!areasNow(venue, nowMin).includes(node.area)) {
    const windows = (venue.phases ?? []).filter((phase) => (phase.areas ?? []).includes(node.area))
      .map((phase) => `${phase.label}（${phase.from}–${phase.to}）`);
    return `下一处「${node.area}」这会儿没开：它只在${windows.join('、') || '别的时段'}开放，现在是${phaseName || hhmm(nowMin)}（${hhmm(nowMin)}）。可以等到那时候，或按已有记录回家。`;
  }
  if (hoursState(venue, nowMin) === 'closed') {
    return `这处地点已经过了开放时段（${venue.hours?.open ?? ''}–${venue.hours?.close ?? ''}）。可以改天再来，或按已有记录回家。`;
  }
  return '';
}

function validatedPack(raw, maxNodes = 0) {
  if (!isRecord(raw)) return null;
  const { revision, ...content } = raw;
  const result = validateStoryPack(content, { maxNodes });
  if (!result.ok || (revision !== undefined && revision !== result.pack.revision)) return null;
  return result.pack;
}

/** Select the one matching story step, returning a cloned next progress snapshot. */
export function pickStory(catalog, venue, area, nowMin, session, visits, completedStoryIds = []) {
  if (!Array.isArray(catalog) || !venue || typeof area !== 'string' || !Number.isFinite(Number(nowMin)) || Number(nowMin) < 0 || Number(nowMin) >= 1440 || hoursState(venue, nowMin) === 'closed') return null;
  const current = normalizeStoryProgress(session?.storyProgress);
  const candidates = [];
  for (const row of catalog) {
    if (!row || row.enabled !== true || !row.pack) continue;
    const pack = validatedPack(row.pack);
    if (!pack || pack.version === 3) continue; // 自由模式没有区域节点，不会被游逛自动触发
    if (pack.placeId !== venue.id || !storyAvailability(pack, [venue], completedStoryIds).available) continue;
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

    if (pack.references?.length) entry.triggered = [...new Set([...(entry.triggered ?? []), node.id])];
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
        ...(pack.version === 2 && pack.metadata.participation === 'duo'
          ? { actor: node.actor, jointResolution: pack.metadata.jointResolution ?? null } : {}),
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
