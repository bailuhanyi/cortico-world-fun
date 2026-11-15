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
  CROWD_LABEL, KIND_LABEL, VENUES, allPlaces, findVenue, hasScene, hmToMin, hoursState,
  pickOne, pickSome, suggestPlaces,
} from './venues.js';
export {
  MAX_TRIPS, buySouvenir, closeSession, dayIn, enterVenue, hmIn, isStale, minutesIn,
  newState, normalizeState, photoSpotsFor, recentPlaceIds, souvenirsFor, takePhoto,
  tripSummary, venueById, visitedText, wanderOnce,
} from './state.js';
