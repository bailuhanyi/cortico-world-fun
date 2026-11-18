const CHOICES = {
  '看到有人在水母缸前面站了十分钟一动不动': {
    prompt: '水母缸前的光点慢慢浮着，你想怎么做？',
    options: [
      { id: 'stay', label: '也站一会儿', result: '在水母缸前多停了一会儿' },
      { id: 'move-on', label: '继续往前逛', result: '看了一会儿便继续往前逛' },
    ],
  },
  '企鹅馆正好赶上喂食，一群企鹅扑通扑通全下了水': {
    prompt: '企鹅刚下水，接下来想怎么留住这一刻？',
    options: [
      { id: 'watch', label: '再看一会儿', result: '在企鹅馆多看了一会儿' },
      { id: 'photo', label: '记下这个时间，继续逛', result: '记下了企鹅喂食的时间' },
    ],
  },
  '一条大鲸从头顶慢慢游过去，影子把整条隧道盖了一下': {
    prompt: '鲸影从拱顶移过去了，你想怎么做？',
    options: [
      { id: 'wait', label: '等它再游回来', result: '在海底隧道等了一会儿鲸影' },
      { id: 'walk', label: '沿隧道继续走', result: '沿着海底隧道继续往前走' },
    ],
  },
};

const clean = (v, max = 160) => typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';

export function choiceForEvent(event, context = {}) {
  const base = CHOICES[clean(event, 200)];
  if (!base) return null;
  const area = clean(context.area, 60);
  return {
    id: `choice-${clean(event, 80)}`,
    event: clean(event, 200),
    area,
    prompt: base.prompt,
    options: base.options.map((x) => ({ id: x.id, label: x.label, result: x.result })),
  };
}

export function normalizeChoice(raw) {
  if (!raw || typeof raw !== 'object' || !clean(raw.id, 100) || !clean(raw.event, 200)) return null;
  const options = Array.isArray(raw.options) ? raw.options.map((x) => ({ id: clean(x?.id, 50), label: clean(x?.label, 100), result: clean(x?.result, 160) })).filter((x) => x.id && x.label).slice(0, 4) : [];
  if (!options.length) return null;
  return { id: clean(raw.id, 100), event: clean(raw.event, 200), area: clean(raw.area, 60), prompt: clean(raw.prompt, 180), options };
}

export function applyChoice(pending, optionId) {
  const choice = normalizeChoice(pending);
  const id = clean(optionId, 50);
  if (!choice) return { ok: false, error: '当前没有待选择的事件。' };
  const option = choice.options.find((x) => x.id === id);
  if (!option) return { ok: false, error: '没有这个选项，请按当前回执提供的选项选择。' };
  return { ok: true, choice, option };
}
