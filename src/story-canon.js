// One completed main experience per work. Later plays are recollections/replays.
// This compact ledger outlives the bounded detailed trip book.
export function normalizeStoryCanon(raw, trips = []) {
  const rows = Array.isArray(raw) ? raw : [];
  const result = [];
  const ids = new Set();
  const add = (row) => {
    if (!row || !/^[a-z0-9_-]{1,24}$/.test(row.packId ?? '') || ids.has(row.packId)
      || typeof row.runId !== 'string' || !row.runId || row.runId.length > 100
      || typeof row.endingNodeId !== 'string' || !row.endingNodeId || row.endingNodeId.length > 24
      || typeof row.revision !== 'string' || row.revision.length > 60) return;
    ids.add(row.packId);
    result.push({ packId: row.packId, runId: row.runId, revision: row.revision, endingNodeId: row.endingNodeId });
  };
  rows.forEach(add);
  [...trips].sort((a, b) => (a.leftAt || 0) - (b.leftAt || 0)).forEach((trip) => {
    const run = trip.storyRun;
    if (run?.canonical !== false && run?.endingNodeId) add({ ...run, runId: run.runId || trip.id });
  });
  return result;
}
