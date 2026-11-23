/**
 * 共同决定（两席同票）的**唯一派生**。
 *
 * 规格在 `docs/JOINT-DECISION-SPEC.md`；这里只做纯函数：读入参、不修改 `pending`、
 * 不依赖 `this` / 时间 / 文件系统。谁可以投、什么时候前进、给人看什么字，全部从这里取，
 * 世界、面板、只读查询都不许再自己比对票面——0.7.6 的卡死 bug 就是三份实现各长各的。
 *
 * 规则（2026-11-23 拍板的收窄版）：
 *   - 空票面：两席都能先投，不限先后；
 *   - 只剩一席没投：只有那一席能投（已投的那一席此刻不能改票、也不能连投第二次）；
 *   - 两票都在且不同：两席都能改自己那一票，只写自己这一席，改成一致才前进；
 *   - `skip` 在 joint 里永远非法；`substitute`（代投）不适用于 joint。
 *
 * 入参缺字段（老存档、半截数据）按「没有那一票」处理：不抛错。
 */

const SEATS = ['owner', 'fish'];
const RESOLUTIONS = new Set(['require-agreement', 'owner-final', 'fish-final']);
const DEFAULT_RESOLUTION = 'require-agreement';

/** 本步合法选项 id 的集合；`options` 缺失或坏掉时为空集。 */
function optionIds(pending) {
  const options = Array.isArray(pending?.options) ? pending.options : [];
  return new Set(options.map((option) => option?.id).filter((id) => typeof id === 'string' && id));
}

/**
 * 票面的规整副本：只留「该席真的投了、且投的是本步合法选项」的项。
 * `src/state.js` 归一化时已经过滤过一遍，这里再挡一次手写的半截数据。
 */
export function jointVotes(pending) {
  if (pending?.actor !== 'joint') return {};
  const ids = optionIds(pending);
  const votes = {};
  for (const seat of SEATS) {
    const id = pending?.votes?.[seat];
    if (typeof id === 'string' && ids.has(id)) votes[seat] = id;
  }
  return votes;
}

/** 异票怎么办；缺失或非法一律按 `require-agreement`（不静默拿某一席的票当共识）。 */
export function jointResolutionOf(pending) {
  const resolution = pending?.jointResolution;
  return RESOLUTIONS.has(resolution) ? resolution : DEFAULT_RESOLUTION;
}

/** 阶段：'empty' | 'waiting-owner' | 'waiting-fish' | 'disagree' | 'agreed'；非 joint 返回 null。 */
export function jointStage(pending) {
  if (pending?.actor !== 'joint') return null;
  const votes = jointVotes(pending);
  const owner = Boolean(votes.owner);
  const fish = Boolean(votes.fish);
  if (owner && fish) return votes.owner === votes.fish ? 'agreed' : 'disagree';
  if (owner) return 'waiting-fish';
  if (fish) return 'waiting-owner';
  return 'empty';
}

/**
 * 现在该提示谁：'owner' | 'fish'；非 joint 返回 null。**只用于文案，不是权限。**
 * 空票面默认主人（聊天里通常是主人在说话），但两席都能先投。
 */
export function jointActor(pending) {
  const stage = jointStage(pending);
  if (!stage) return null;
  return stage === 'waiting-fish' ? 'fish' : 'owner';
}

/** 这一席此刻能不能提交：权限只认这里。 */
export function jointCanVote(pending, seat) {
  const stage = jointStage(pending);
  if (!stage || !SEATS.includes(seat) || !optionIds(pending).size) return false;
  if (stage === 'empty' || stage === 'disagree') return true;
  if (stage === 'waiting-owner') return seat === 'owner';
  if (stage === 'waiting-fish') return seat === 'fish';
  // agreed：两票都在且相同，下一步就是提交，不再收新的票。
  return false;
}

/**
 * 这一提交的结果：要不要前进、按哪一票。
 * 异票且 `require-agreement` 时 `advance: false`（两票都留）；`owner-final` / `fish-final` 直接前进。
 */
export function jointDecision(pending) {
  const stage = jointStage(pending);
  const votes = jointVotes(pending);
  if (stage === 'agreed') return { stage, advance: true, optionId: votes.owner ?? null };
  if (stage === 'disagree') {
    const resolution = jointResolutionOf(pending);
    if (resolution === 'require-agreement') return { stage, advance: false, optionId: null };
    return { stage, advance: true, optionId: resolution === 'owner-final' ? votes.owner ?? null : votes.fish ?? null };
  }
  return { stage, advance: false, optionId: null };
}

const ZH = {
  seatName: { owner: '你这一席', fish: '鱼那一席' },
  headline: {
    empty: '两席各选一项',
    'waiting-owner': '现在轮到你了',
    'waiting-fish': '现在轮到鱼',
    disagree: '两边票不一样',
    agreed: '两票一致',
  },
  resolutionNote: {
    'require-agreement': '双方必须明确同意；分歧保持待定',
    'owner-final': '分歧按你的明确选择',
    'fish-final': '分歧按鱼的明确选择',
  },
  hint: {
    empty: () => '两席各投一票，同票才出发：谁先投都行；两票一致才前进。',
    'waiting-owner': ({ fish }) => `鱼那一票已经记下了（${fish}）。现在轮到你投这一票（鱼不能代投）；两票相同才会前进。`,
    'waiting-fish': ({ owner }) => `你这一票已经记下了（${owner}）。这一票要鱼自己投；两票相同才会前进。`,
    disagree: ({ owner, fish }) => `两边票不一样（你：${owner} / 鱼：${fish}）：这一轮不前进，也不清掉任何一席的票。谁都可以改自己那一票，两边一致才递交；也可以先回家。`,
    agreed: ({ owner }) => `两票已经一致（${owner}）；提交就会前进。`,
  },
  note: {
    empty: () => '共同决定：两席各投一票，谁先投都行；两边同票才会前进，等待与超时都不算同意。',
    'waiting-owner': () => '共同决定：现在等你投这一票；两边同票才会前进，等待与超时都不算同意。',
    'waiting-fish': () => '共同决定：现在轮到鱼投她那一票；两边同票才会前进，等待与超时都不算同意。',
    disagree: ({ owner, fish }) => `共同决定：两边票不一样（你：${owner} / 鱼：${fish}），这一轮不前进，两票都留着。谁都可以改自己那一票；也可以先回家。等待与超时都不算同意。`,
    agreed: () => '共同决定：两票已经一致。',
  },
  saved: {
    owner: ({ label }) => `你的选择已保存（${label}）。现在等鱼自己提交她那一票；没有以等待或超时当作同意。`,
    fish: ({ label }) => `鱼的选择已保存（${label}）。现在等你（主人）自己投这一票；没有以等待或超时当作同意。`,
  },
  seatsText: ({ owner, fish, hasOwner, hasFish }) => `你${hasOwner ? `已选「${owner}」` : '还没投'}，鱼${hasFish ? `已选「${fish}」` : '还没投'}`,
  blocked: {
    owner: ({ owner }) => `你那一票已经记下了（${owner}）；这一步等鱼自己投她那一票，你不能代投。`,
    fish: ({ fish }) => `鱼那一票已经记下了（${fish}）；这一步等你（主人）自己投，鱼不能代投。`,
  },
  agreedBlocked: '两票已经一致，这一步不再收新的票。',
  invalid: '共同选择需要用户或鱼分别提交有效选项。',
  skip: '共同选择不能用略过代替双方决定。',
  substitute: '共同决定要两席各投自己那一票，不能由一席代投。',
};

const EN = {
  seatName: { owner: 'Your seat', fish: 'Fish’s seat' },
  headline: {
    empty: 'Each seat picks one',
    'waiting-owner': 'Your turn now',
    'waiting-fish': 'Waiting for the fish',
    disagree: 'The votes differ',
    agreed: 'Both votes match',
  },
  resolutionNote: {
    'require-agreement': 'Both seats must agree; a split stays pending',
    'owner-final': 'A split follows your explicit choice',
    'fish-final': 'A split follows the fish’s explicit choice',
  },
  hint: {
    empty: () => 'Both seats vote and the choice only moves on when the votes match: either seat may go first.',
    'waiting-owner': ({ fish }) => `The fish's vote is saved (${fish}). Now cast your own vote; the fish cannot vote for you, and the choice moves on only when both votes match.`,
    'waiting-fish': ({ owner }) => `Your vote is saved (${owner}). The fish has to cast hers herself; the choice moves on only when both votes match.`,
    disagree: ({ owner, fish }) => `The votes differ (you: ${owner} / fish: ${fish}): nothing advances and neither vote is cleared. Either seat may change its own vote, and it moves on once they match. You can also head home.`,
    agreed: ({ owner }) => `Both votes already match (${owner}); submitting will move on.`,
  },
  note: {
    empty: () => 'Joint decision: both seats vote, either may go first; it only moves on when the votes match, and waiting or a timeout is never consent.',
    'waiting-owner': () => 'Joint decision: your vote is the one still missing; it only moves on when the votes match, and waiting or a timeout is never consent.',
    'waiting-fish': () => 'Joint decision: the fish still has to cast her vote; it only moves on when the votes match, and waiting or a timeout is never consent.',
    disagree: ({ owner, fish }) => `Joint decision: the votes differ (you: ${owner} / fish: ${fish}); nothing advances and both votes stay. Either seat may change its own vote, or you can head home. Waiting or a timeout is never consent.`,
    agreed: () => 'Joint decision: both votes already match.',
  },
  saved: {
    owner: ({ label }) => `Your choice was saved (${label}). Now wait for the fish to submit hers herself; waiting or a timeout is never consent.`,
    fish: ({ label }) => `The fish's choice was saved (${label}). Now cast your own vote; waiting or a timeout is never consent.`,
  },
  seatsText: ({ owner, fish, hasOwner, hasFish }) => `you ${hasOwner ? `picked “${owner}”` : 'have not voted'}, fish ${hasFish ? `picked “${fish}”` : 'has not voted'}`,
  blocked: {
    owner: ({ owner }) => `Your vote is already recorded (${owner}); this vote has to be the fish's own, and you cannot cast it for her.`,
    fish: ({ fish }) => `The fish's vote is already recorded (${fish}); this vote has to be yours, and the fish cannot cast it for you.`,
  },
  agreedBlocked: 'Both votes already match; this step takes no new votes.',
  invalid: 'A joint choice needs a valid option submitted by the owner or the fish.',
  skip: 'A joint choice cannot use skip in place of both decisions.',
  substitute: 'A joint decision takes one vote from each seat; neither seat may vote for the other.',
};

const TEXT = { zh: ZH, en: EN };

/**
 * 给人看的那一份：阶段、该提示谁、两席票面、以及各处共用的文案。
 * `optionLabel(id)` 用来把选项 id 换成作者写的选项文字；`language` 跟随现有机制（默认中文）。
 * 非 joint 步返回 null。
 */
export function jointView(pending, optionLabel, language = 'zh') {
  const stage = jointStage(pending);
  if (!stage) return null;
  const copy = language === 'en' ? TEXT.en : TEXT.zh;
  const labelOf = typeof optionLabel === 'function' ? optionLabel : (id) => (typeof id === 'string' ? id : '');
  const votes = jointVotes(pending);
  const label = (seat) => {
    const id = votes[seat];
    if (typeof id !== 'string') return '';
    const text = labelOf(id);
    return typeof text === 'string' && text ? text : id;
  };
  const ctx = { owner: label('owner'), fish: label('fish'), hasOwner: Boolean(votes.owner), hasFish: Boolean(votes.fish) };
  const canVote = { owner: jointCanVote(pending, 'owner'), fish: jointCanVote(pending, 'fish') };
  const resolution = jointResolutionOf(pending);
  const blocked = {};
  for (const seat of SEATS) {
    if (canVote[seat]) { blocked[seat] = null; continue; }
    if (stage === 'agreed') { blocked[seat] = copy.agreedBlocked; continue; }
    const other = votes[seat === 'owner' ? 'fish' : 'owner'];
    blocked[seat] = other ? copy.blocked[seat](ctx) : copy.invalid;
  }
  return {
    stage,
    seat: jointActor(pending),
    resolution,
    votes,
    canVote,
    seats: SEATS.map((seat) => ({ seat, name: copy.seatName[seat], voted: Boolean(votes[seat]), optionId: votes[seat] ?? null, label: label(seat) })),
    headline: copy.headline[stage],
    hint: copy.hint[stage](ctx),
    note: copy.note[stage](ctx),
    resolutionNote: copy.resolutionNote[resolution],
    seatsText: copy.seatsText(ctx),
    saved: { owner: copy.saved.owner({ label: ctx.owner }), fish: copy.saved.fish({ label: ctx.fish }) },
    blocked,
    skipText: copy.skip,
    substituteText: copy.substitute,
    invalidText: copy.invalid,
  };
}