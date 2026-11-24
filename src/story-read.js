/**
 * 六个公开只读故事查询的实现（从 `world.js` 拆出来的第一个域）。
 *
 * 为什么单独一份：这几个查询是**只读契约**——不开始故事、不推进事件、
 * 不写日程或长期记忆；它们同时被文字通道、面板和测试调用，行为必须完全一致。
 * 放在 `world.js` 里时，读的代码和写的代码混在一起，改一个字段容易越界。
 *
 * 依赖全部由调用方以 `ctx` 传入（都是只读闭包），这个模块自己不认识 FunWorld，
 * 也就不可能顺手改状态。
 */
import { areasNow, descNow } from './phases.js';
import { hoursState } from './venues.js';
import { minutesIn } from './state.js';
import { describeMemory, describePack } from './story-panel.js';
import { jointView } from './joint.js';

/** 一篇故事的公开卡：只有元数据与「能不能玩」，不返回节点内容或未来分支。 */
function publicCard(ctx, row) {
  const { pack, enabled } = row;
  const venue = ctx.allPlaces.find((item) => item.id === pack.placeId);
  const view = describePack(row, venue, minutesIn(ctx.timezone, ctx.now), ctx.visitCount(pack.placeId), ctx.completedStoryIds(), { freeEnabled: ctx.freeEnabled });
  const meta = pack.metadata ?? {};
  return {
    id: pack.id, title: pack.title, placeId: pack.placeId, placeName: venue?.name ?? pack.placeId,
    revision: pack.revision, formatVersion: pack.version, mode: pack.version === 3 ? 'free' : 'static',
    author: meta.author ?? '未标注',
    release: meta.release ?? 'v1', genre: meta.genre ?? '未标注', synopsis: meta.synopsis ?? '',
    participation: meta.participation ?? 'solo', durationMinutes: meta.durationMinutes ?? null,
    duration: meta.durationMinutes === undefined ? '未知' : `${meta.durationMinutes} 分钟`,
    requirements: [...(meta.requirements ?? [])], enabled, available: view.available,
    reason: view.problem ?? null, queryAt: ctx.now,
  };
}

/**
 * @param {object} ctx
 * @param {string} ctx.name   工具名（六选一）
 * @param {object} ctx.args
 * @returns {Promise<object>} 可直接 JSON 化的回执
 */
export async function readStoryQuery(ctx) {
  const { name } = ctx;
  const args = ctx.args ?? {};
  const queryAt = ctx.now;
  const places = ctx.places;
  if (name === 'fun_story_places') {
    const library = await ctx.locationsSnapshot();
    const nowMin = minutesIn(ctx.timezone, queryAt);
    const project = (place, detail = false) => {
      const venue = places.find((item) => item.id === place.id);
      return { id: place.id, name: place.name, playable: Boolean(venue?.areas?.length), isHome: place.isHome,
        openState: venue ? hoursState(venue, nowMin) : null,
        ...(detail ? { description: venue ? descNow(venue, nowMin) : place.desc,
          aliases: [...place.aliases], kind: place.kind, tags: [...place.tags],
          areas: venue ? [...areasNow(venue, nowMin)] : [], hours: venue ? { ...venue.hours } : null } : {}) };
    };
    if (args.id) {
      const place = library.places.find((item) => item.id === args.id);
      return place ? { ok: true, queryAt, place: project(place, true) }
        : { ok: false, code: 'NOT_FOUND', error: '地点不存在。' };
    }
    return { ok: true, queryAt, places: library.places.map((place) => project(place)) };
  }
  const catalog = ctx.catalog();
  if (name === 'fun_story_candidates' || name === 'fun_story_detail' || name === 'fun_story_schedule') {
    const cards = catalog.map((row) => publicCard(ctx, row));
    if (name === 'fun_story_detail') {
      const card = cards.find((item) => item.id === args.id);
      return card ? { ok: true, queryAt, story: card } : { ok: false, code: 'NOT_FOUND', error: '故事不存在。' };
    }
    const available = cards.filter((card) => card.enabled && card.available);
    const candidates = cards.filter((card) => card.enabled);
    if (name === 'fun_story_schedule') {
      const card = args.id ? available.find((item) => item.id === args.id) : available[0];
      if (!card) return { ok: false, code: args.id ? 'NOT_AVAILABLE' : 'NO_CANDIDATE', error: '当前没有符合条件的故事候选。' };
      return { ok: true, queryAt, source: 'fun_story_schedule', text: `可考虑《${card.title}》· ${card.placeName} · 参与方式：${card.participation} · 时长：${card.duration}。这只是候选，不会开始故事或写入日程。` };
    }
    return { ok: true, queryAt, candidates };
  }
  if (name === 'fun_story_current') {
    const status = ctx.status();
    if (!status.ok) return status;
    const trip = status.trip;
    const pending = trip?.pending ?? null;
    const labelOf = (id) => pending?.options?.find(({ id: value }) => value === id)?.label ?? id;
    // 共同决定只从 joint.js 取一份：阶段、该谁投、谁能投、文案全在里面。
    const joint = pending?.actor === 'joint' ? jointView(pending, labelOf, ctx.language) : null;
    return { ok: true, queryAt, state: trip ? trip.state : 'none', startStamp: status.startStamp, party: trip?.party ?? ctx.party ?? [], trip: trip ? {
      id: trip.id, runId: ctx.runId,
      title: trip.title, packId: trip.packId, revision: trip.revision, placeId: trip.placeId, placeName: trip.placeName,
      step: trip.step, actor: trip.actor ?? null, complete: trip.complete, blocked: trip.blocked || null, nextArea: trip.nextArea || null,
      mode: trip.mode ?? 'static', maxTurns: trip.maxTurns ?? null, free: trip.free ?? null, participation: trip.participation ?? 'solo', party: trip.party ?? [],
      events: [...trip.events], choices: [...trip.choices], pending: trip.pending ? { id: trip.pending.id, event: trip.pending.event,
        prompt: trip.pending.prompt, actor: trip.pending.actor ?? 'owner',
        jointResolution: trip.pending.jointResolution ?? null, votes: { ...(trip.pending.votes ?? {}) },
        options: trip.pending.options.map(({ id, label }) => ({ id, label })) } : null,
      // 文字通道只看这一行就知道该谁投：共同决定里空票面两席都能先投，只剩一席时才是那一席的回合。
      joint: joint ? { stage: joint.stage, seat: joint.seat, resolution: joint.resolution, canVote: joint.canVote,
        votes: joint.votes, seats: joint.seats, hint: joint.hint } : null,
      hint: trip.step !== 'choose' ? null : joint ? joint.hint
        : trip.actor === 'fish'
          ? '这一票轮到鱼（你）自己提交：把她的选择用 say 交进来即可，不要等用户替她选。'
          : trip.actor === 'owner' ? '这一票等用户（主人）自己提交；鱼不能代投。' : null,
      timeline: [...trip.timeline],
    } : null };
  }
  if (name === 'fun_story_recap') {
    const memories = ctx.savedTrips().filter((trip) => trip.storyRun);
    const memory = args.id ? memories.find((trip) => trip.id === args.id || trip.storyRun.runId === args.id) : memories[0];
    if (!memory) return { ok: false, code: args.id ? 'NOT_FOUND' : 'NO_MEMORY', error: '没有找到已保存的故事回忆。' };
    const view = describeMemory(memory);
    const areas = [...new Set((memory.visited ?? []).map((item) => item.area).filter(Boolean))];
    const choices = (memory.choices ?? []).map((item) => item.option).filter(Boolean);
    const summary = [`${memory.storyRun.endingNodeId ? '完整' : '中途结束'}：${memory.storyRun.title}`, memory.placeName,
      areas.length ? `实际走过：${areas.join('、')}` : '', choices.length ? `实际选择：${choices.join('、')}` : '',
      memory.events?.length ? `实际事件：${memory.events.join('；')}` : ''].filter(Boolean).join('。');
    return { ok: true, queryAt, source: 'fun_story_recap', memory: { ...view, runId: memory.storyRun.runId ?? null,
      sourceRunId: memory.storyRun.sourceRunId ?? null, summary } };
  }
  return { ok: false, code: 'UNSUPPORTED_QUERY', error: '不支持的只读故事查询。' };
}
