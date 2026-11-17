/**
 * 扩展入口：默认导出必须是 WorldDefinition。
 * package.json 里 cortico.kind = world、cortico.api = 6。
 */
import definition, { funDefinition } from './definition.js';

export default definition;
export { funDefinition };
export { FUN_TOOL_DECLS, FunWorld, venueNames } from './world.js';
export { ID as FUN_WORLD_ID, DEFAULTS as FUN_DEFAULTS } from './config.js';
export {
  CROWD_LABEL, KIND_LABEL, VENUES, allPlaces, findVenue, hasFood, hasScene, hmToMin, hoursState,
  pickOne, pickSome, suggestPlaces,
} from './venues.js';
export {
  MAX_TRIPS, buySouvenir, closeSession, dayIn, enterVenue, hmIn, isStale, minutesIn,
  newState, normalizeState, photoSpotsFor, recentPlaceIds, recordConsume, souvenirsFor,
  takePhoto, tripSummary, venueById, visitedText, wanderOnce,
} from './state.js';
export {
  areasNow, checkPhases, descNow, eventsNow, phaseAt, phaseContains, phaseLabelAt,
} from './phases.js';
export {
  cameEarlierToday, dayPhrase, filterRepeatedEvents, historyFor, memoryLine, untriedAreas,
} from './memories.js';
export {
  OVERRIDABLE, USER_PREFIX, blankVenue, cleanOverride, cleanUserVenue, idFromName,
  isPresetId, mergeVenues, overrideEntries, parseVenueFile, stringifyVenueFile,
} from './user-venues.js';
