/** 内置事件的明确前置条件；没有可靠来源的收获不自动补造。 */
export const EVENT_METADATA = {
  '过山车冲下去那一下喊得嗓子发干，下来喝了半瓶水': { areas: ['过山车'] },
  '在套圈摊套中了一个歪歪的小熊': { disabled: true },
  '在纪念品店犹豫了很久，最后挑了那个鲸鱼挂件': { areas: ['纪念品店'], souvenir: '鲸鱼挂件' },
  '抽了一支签，是「小吉」': { areas: ['抽签处'], souvenir: '一支签' },
  '捞金鱼捞上来两条，纸破了第三条跑了': { disabled: true },
  '苹果糖咬第一口把嘴唇粘住了': { souvenir: '苹果糖' },
  '吧唧挑了半天，最后把一整组都买了': { disabled: true },
  '买到最后一桶焦糖爆米花': { disabled: true },
  '抓娃娃抓了七次才中': { areas: ['抓娃娃机'], souvenir: '抓到的娃娃' },
  '文创店买到最后一个帆布袋': { areas: ['文创店'], souvenir: '文创帆布袋' },
  '手冲等得有点久，但端上来的时候正好': { consume: '手冲' },
  '拉花歪了一点，店员说要重做，你说不用': { consumeAny: true },
  '犹豫很久，最后还是要了少糖': { consumeAny: true },
  '封口机把杯子封歪了，店员重新封了一次': { consumeAny: true },
  '拿到手的那一刻杯壁上全是水珠': { consumeAny: true },
  '吸管戳下去的时候珍珠一下涌上来': { consume: '珍珠奶茶' },
  '最后一道上得特别慢，但确实值得等': { consumeAny: true },
  '点的那道菜比想象中辣': { disabled: true },
  '等位等了二十分钟，服务员送了一小碟花生': { disabled: true },
  '厨房多送了一碟小菜，说今天做多了': { disabled: true },
  '最后一块点心被端到你面前，说是送的': { disabled: true },
  '店员说新出了一款，今天试做，送一杯': { disabled: true },
  '集点卡差最后一个印，店员说这次盖满': { disabled: true },
  '老板多给了一串': { disabled: true },
  '摊主认出你来过，多给了一串': { disabled: true },
  '气球摊的老板认出了你，说上次那个没给你打折': { disabled: true },
  '店员说你抓的次数够多了，多送了一次': { disabled: true },
  '抽签的师傅说这支签今年只发出去几支': { areas: ['抽签处'], souvenir: '一支签' },
  '常坐的那个位子今天正好空着': { disabled: true },
  '小卖部的酸奶冰得正好': { areas: ['小卖部'], souvenir: '一瓶酸奶' },
};

// 完整项目名之外的内置简称，只做明确字面匹配，不猜测用户文本语义。
const AREA_TERMS = {
  aquarium: { '隧道': ['海底隧道'] },
  zoo: { '熊猫': ['熊猫馆'], '长颈鹿': ['长颈鹿区'], '猴子': ['猴山'], '小火车': ['园内小火车'] },
  park: { '草坪': ['大草坪'], '长椅': ['湖边长椅'], '下棋': ['老树下的棋盘'], '棋局': ['老树下的棋盘'] },
  arcade: { '抓娃娃': ['抓娃娃机'] },
  ktv: { '唱到': ['包厢沙发', '点歌屏'], '唱完': ['包厢沙发', '点歌屏'], '点了一首': ['点歌屏'] },
  cinema: { '前排': ['影厅', '最后一排'], '电影放到': ['影厅', '最后一排'], '片尾': ['影厅', '最后一排'], '爆米花': ['爆米花柜台'], '检票': ['取票厅'] },
  museum: { '中庭': ['中庭长椅'] },
  hiking: { '山顶': ['山顶的大石头'], '凉亭': ['半山腰的凉亭'], '半山腰': ['半山腰的凉亭'], '下山': ['下山的小路'], '山脚': ['山脚入口'] },
  cafe: { '露天座': ['门口的露天座'], '窗边': ['靠窗的位子'] },
  milktea: { '档口': ['点单的档口'], '台阶': ['门口的台阶'] },
  market: { '套圈摊': ['套圈摊'], '烤串': ['烧烤摊'], '糖水': ['糖水铺'], '铁板': ['铁板鱿鱼摊'] },
  bathhouse: { '休息区': ['休息区的躺椅'] },
  thrift: { '旧书': ['旧书摊'], '磁带': ['磁带和唱片'], '旧钟表': ['旧钟表摊'], '旧衣服': ['旧衣服的架子'] },
  riverside: { '台阶': ['下到水边的台阶'], '长椅': ['长椅上'], '栏杆': ['栏杆边'], '桥底': ['桥底下'] },
};

export function filterEventsForArea(events, area, venue, context = {}) {
  const pool = Array.isArray(events) ? events : [];
  const areas = Array.isArray(venue?.areas) ? venue.areas : [];
  const terms = { ...Object.fromEntries(areas.map((a) => [a, [a]])), ...(AREA_TERMS[venue?.id] ?? {}) };
  const ate = Array.isArray(context?.ate) ? context.ate : [];
  return pool.filter((line) => {
    if (typeof line !== 'string' || !line.trim()) return false;
    const meta = EVENT_METADATA[line];
    if (meta?.disabled) return false;
    if (meta?.areas && !meta.areas.includes(area)) return false;
    if (meta?.souvenir && !(context?.souvenirs ?? []).includes(meta.souvenir)) return false;
    if (meta?.consume && !ate.some((x) => x?.item === meta.consume)) return false;
    if (meta?.consumeAny && !ate.length) return false;
    // 显式元数据的项目约束优先，否则按文本中明确提到的项目取并集。
    if (meta?.areas) return true;
    const mentioned = Object.entries(terms).filter(([term]) => line.includes(term)).flatMap(([, names]) => names);
    return !mentioned.length || mentioned.includes(area);
  });
}
