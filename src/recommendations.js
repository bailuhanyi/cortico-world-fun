import { areasNow, phaseLabelAt } from './phases.js';
import { hoursState } from './venues.js';

const DAY_MINUTES = 24 * 60;

function matchingWishes(wishes, venue) {
  const placeId = venue?.id;
  return (Array.isArray(wishes) ? wishes : []).filter((wish) => wish?.status === 'active'
    && wish.placeId === placeId);
}

function feasible(wish, venue, nowMin) {
  if (hoursState(venue, nowMin) === 'closed') return false;
  if (wish.type === 'visit') return true;
  if (wish.type === 'area') return areasNow(venue, nowMin).includes(wish.target);
  if (wish.type === 'phase') return phaseLabelAt(venue, nowMin) === wish.target;
  if (wish.type === 'souvenir') {
    return (Array.isArray(venue?.souvenirs) ? venue.souvenirs : []).includes(wish.target);
  }
  return false;
}

function wishText(wish, venue) {
  const action = wish.type === 'visit'
    ? `想去${wish.placeName || venue.name}`
    : `想${wish.type === 'souvenir' ? '拿到' : '看看'}${wish.target}`;
  return `有个心愿：${action}${wish.reason ? `（${wish.reason}）` : ''}`;
}

function minuteOfDay(value) {
  const minute = Number(value);
  if (!Number.isFinite(minute)) return 0;
  return ((Math.floor(minute) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
}

function clockText(minute) {
  const hour = String(Math.floor(minute / 60)).padStart(2, '0');
  const mins = String(minute % 60).padStart(2, '0');
  return `${hour}:${mins}`;
}

function nextWish(wishes, venue, nowMin) {
  if (!wishes.length) return null;
  const start = minuteOfDay(nowMin);
  const boundaries = new Set();
  const addBoundary = (hm) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(hm ?? '').trim());
    if (!match) return;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour <= 23 && minute <= 59) boundaries.add(hour * 60 + minute);
  };

  // The shared hours and phase helpers use half-open intervals. Only their
  // transition instants can change whether one of the wishes is feasible.
  addBoundary(venue?.hours?.open);
  addBoundary(venue?.hours?.close);
  for (const phase of Array.isArray(venue?.phases) ? venue.phases : []) {
    addBoundary(phase?.from);
    addBoundary(phase?.to);
  }

  const candidates = [...boundaries].map((minute) => {
    const distance = (minute - start + DAY_MINUTES) % DAY_MINUTES;
    return distance || DAY_MINUTES;
  }).sort((a, b) => a - b);

  for (const minutesAway of candidates) {
    const minute = (start + minutesAway) % DAY_MINUTES;
    const wish = wishes.find((candidate) => feasible(candidate, venue, minute));
    if (!wish) continue;
    const day = Math.floor((start + minutesAway) / DAY_MINUTES) === 0 ? '今天' : '明天';
    return {
      text: `${wishText(wish, venue)}；${day} ${clockText(minute)}`,
      minutesAway,
    };
  }
  return null;
}

/**
 * Build a read-only snapshot of the venue's current phase, open areas, and wishes.
 * `history` is the corresponding `historyFor()` result (or null).
 */
export function recommendVenue(venue, nowMin, wishes, history) {
  const isOpen = hoursState(venue, nowMin) !== 'closed';
  const phase = isOpen ? phaseLabelAt(venue, nowMin) : '';
  const areas = isOpen ? areasNow(venue, nowMin) : [];
  const active = matchingWishes(wishes, venue);
  const currentWish = active.find((wish) => feasible(wish, venue, nowMin));
  const wishReason = currentWish ? wishText(currentWish, venue) : '';

  let revisitReason = '';
  if (isOpen && Number(history?.visitCount) > 0) {
    const seen = new Set((Array.isArray(history.areas) ? history.areas : [])
      .map((entry) => entry?.area)
      .filter(Boolean));
    const unvisited = areas.filter((area) => !seen.has(area)).slice(0, 2);
    if (unvisited.length) revisitReason = `还没去过：${unvisited.join('、')}。`;
  }

  return {
    phase,
    areas,
    wishReason,
    revisitReason,
    upcomingWish: currentWish ? null : nextWish(active, venue, nowMin),
  };
}
