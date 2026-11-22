import { validateStoryPack } from '../../src/story-packs.js';
export { SAMPLE_STORY, SAMPLE_STYLE, SAMPLE_VENUE, VALIDATED_SAMPLE } from './creek-letter.mjs';

const drafts = [
  {
    version: 1,
    id: 'riverside-late-lights',
    title: '桥底下的灯影',
    description: '江边夜里，桥下的一点回声把两种安静串到一起。',
    placeId: 'riverside',
    start: 'under-bridge',
    nodes: [
      {
        id: 'under-bridge',
        area: '桥底下',
        event: '桥底的回声短了一拍，对岸的灯影正好从水面上慢慢移过去。',
        prompt: '你想沿着哪一种安静继续？',
        when: { from: '19:30', to: '23:30', phases: ['night'] },
        choices: [
          { id: 'sit-by-river', label: '去长椅边听一会儿', result: '把刚才那段回声留在身后，脚步慢下来。', next: 'bench-ending' },
          { id: 'watch-lights', label: '看对岸的灯', result: '灯影被水纹拉长，远处的亮點也跟着轻轻晃。', next: 'shore-ending' },
        ],
      },
      {
        id: 'bench-ending',
        area: '长椅上',
        event: '长椅旁的风声盖过了桥下的回响，几盏路灯隔着水安静地亮着。',
        when: { from: '19:30', to: '23:30', phases: ['night'] },
      },
      {
        id: 'shore-ending',
        area: '栏杆边',
        event: '栏杆外的水面一圈圈散开，对岸的灯还在远处连成一条柔和的线。',
        when: { from: '19:30', to: '23:30', phases: ['night'] },
      },
    ],
  },
  {
    version: 1,
    id: 'market-last-lantern',
    title: '街尾最后一盏灯',
    description: '夜市快收摊时，在台阶边做一个不着急的决定。',
    placeId: 'market',
    start: 'last-steps',
    nodes: [
      {
        id: 'last-steps',
        area: '街尾的台阶',
        event: '街尾的台阶空出一小块位置，远处的串灯一盏接一盏暗下去。',
        prompt: '最后再走向哪边看看？',
        when: { from: '00:00', to: '01:00', phases: ['closing'] },
        choices: [
          { id: 'last-stall', label: '绕到还亮着的摊前', result: '卷帘门落下的声音渐渐远了，只剩一角暖光。', next: 'stall-ending' },
          { id: 'quiet-corner', label: '在街尾多坐一会儿', result: '人声散开后，路面上只留下零星的脚步声。', next: 'steps-ending' },
        ],
      },
      {
        id: 'stall-ending',
        area: '烧烤摊',
        event: '摊前的灯还亮着，老板把空纸箱叠好，准备收起桌边的小牌子。',
        when: { from: '00:00', to: '01:00', phases: ['closing'] },
      },
      {
        id: 'steps-ending',
        area: '糖水铺',
        event: '糖水铺的白汽慢慢散掉，收摊的人把桌面擦了一遍又一遍。',
        when: { from: '00:00', to: '01:00', phases: ['closing'] },
      },
    ],
  },
  {
    version: 1,
    id: 'con-poster-hour',
    title: '海报墙的最后一小时',
    description: '展馆快结束时，在熟悉的颜色里再留一小会儿。',
    placeId: 'con',
    start: 'poster-wall',
    nodes: [
      {
        id: 'poster-wall',
        area: '海报墙',
        event: '海报墙上的彩色边缘被灯光照得发亮，胶带翘起一角，像还没说完的话。',
        prompt: '接下来想去人声更近的地方，还是回到熟悉的摊位？',
        when: { from: '17:00', to: '18:00' },
        choices: [
          { id: 'stage', label: '去舞台区听最后一段广播', result: '广播声在展馆顶上绕了一圈，慢慢淡下去。', next: 'stage-ending' },
          { id: 'artists', label: '再看一眼同人展台', result: '隔板边的纸袋被轻轻收好，展台也渐渐空下来。', next: 'table-ending' },
        ],
      },
      {
        id: 'stage-ending',
        area: '舞台区',
        event: '舞台边的灯一盏盏熄下去，最后一段广播提醒大家慢慢离场。',
        when: { from: '17:00', to: '18:00' },
      },
      {
        id: 'table-ending',
        area: '同人展台',
        event: '同人展台的摊主把纸张理齐，隔壁通道里的脚步声稀疏下来。',
        when: { from: '17:00', to: '18:00' },
      },
    ],
  },
  {
    version: 2,
    id: 'duo-cafe-date',
    title: '咖啡店的双人约会',
    description: '在咖啡店里一起安排一段安静的约会。',
    metadata: { author: '从0开始的肥鱼大冒险示例', release: '1.0.0', genre: '日常约会', synopsis: '一张靠窗的双人座空了下来。两个人先一起决定坐在哪里，再由鱼明确选择接下来的小安排。', participation: 'duo', durationMinutes: 20, requirements: ['双人故事；owner 与 fish 轮流提交明确选择'], jointResolution: 'require-agreement' },
    placeId: 'cafe', start: 'owner-turn', nodes: [
      { id: 'owner-turn', area: '角落的双人座', actor: 'owner', event: '靠窗的双人座刚好空下来，桌上留着两张干净的杯垫。', prompt: '你想和鱼坐在窗边，还是留在角落慢慢聊？', choices: [
        { id: 'window-seat', label: '坐到靠窗的位置', result: '你们把杯垫移到窗边。', next: 'joint-turn' },
        { id: 'quiet-corner', label: '留在角落慢慢聊', result: '你们在角落安顿下来。', next: 'joint-turn' },
      ] },
      { id: 'joint-turn', area: '角落的双人座', actor: 'joint', event: '你们都坐定后，桌边多了一张小小的留言卡。', prompt: '两个人都要明确选中同一项，才能继续。', choices: [
        { id: 'write-note', label: '一起写一句留言', result: '你们在卡片上留下一句话。', next: 'fish-turn' },
        { id: 'keep-card', label: '把卡片收好', result: '你们把卡片夹进了书页。', next: 'fish-turn' },
      ] },
      { id: 'fish-turn', area: '靠窗的位子', actor: 'fish', event: '窗外的光在杯沿旁停了一会儿。', prompt: '鱼可以自己选择一个小安排。', choices: [
        { id: 'share-book', label: '一起看一页书', result: '鱼翻开书，两个人把这一页读完。', next: 'date-ending-reading' },
        { id: 'watch-window', label: '看一会儿窗外', result: '鱼把视线留给窗外经过的行人。', next: 'date-ending-window' },
      ] },
      { id: 'date-ending-reading', area: '靠窗的位子', event: '鱼把书合上，你们决定下次再读下一页。' },
      { id: 'date-ending-window', area: '靠窗的位子', event: '窗外的光慢慢移开，你们把这段安静留在了今天。' },
    ],
  },
];

function validateBuiltin(draft) {
  const result = validateStoryPack(draft);
  if (!result.ok) throw new Error(`Invalid built-in story pack ${draft.id}: ${result.errors.join('; ')}`);
  return result.pack;
}

export const BUILTIN_STORY_PACKS = drafts.map(validateBuiltin);

export const storyFixtureJson = ({ revision, ...draft }) => JSON.stringify(draft);
