import { areasNow } from './phases.js';
import { VENUES, hoursState } from './venues.js';
const RIVER = '栏杆外的水面一直在动';
const MARKET = '走到一半被人流推着往前走';
const WHALE = '一条大鲸从头顶慢慢游过去，影子把整条隧道盖了一下';
const JELLY = '看到有人在水母缸前面站了十分钟一动不动';
const PENGUINS = '企鹅馆正好赶上喂食，一群企鹅扑通扑通全下了水';
const options = (rows) => rows.map(([id,label,result]) => ({id,label,result}));
const already = (session,event) => (session?.events ?? []).includes(event) || (session?.choices ?? []).some((c)=>c.event===event) || session?.pendingChoice?.event===event;

/** Offers a location-bound decision once; it does not move the companion. */
export function branchChoiceFor(venueId, area, session, nowMin) {
  const venue=VENUES.find((v)=>v.id===venueId);
  if(!venue || hoursState(venue,nowMin)==='closed' || !areasNow(venue,nowMin).includes(area)) return null;
  if(venueId==='riverside' && area==='栏杆边' && !already(session,RIVER)) {
    const wait = Number(nowMin)<17.5*60;
    return {id:'branch-riverside',event:RIVER,area,prompt:wait?'想在江边等到傍晚亮灯，还是沿步道走走？':'想沿着灯光走，还是坐下来听一会儿水声？',options:options([
      ['lights',wait?'等到傍晚亮灯':'沿灯光走走',wait?'决定等到傍晚，再到步道看看沿岸的灯':'决定到步道沿着灯光走走'],
      ['water','去长椅坐坐','决定去长椅上听一会儿水声'],
    ])};
  }
  if(venueId==='market' && ['烧烤摊','铁板鱿鱼摊'].includes(area) && !already(session,MARKET)) {
    const live=areasNow(venue,nowMin);
    const targets=['糖水铺','卖小玩意儿的摊子','街尾的台阶'].filter((a)=>live.includes(a)).slice(0,2);
    if(targets.length<2) return null;
    return {id:'branch-market',event:MARKET,area,prompt:'夜市里人流往前涌，接下来想往哪一处慢慢逛？',options:options(targets.map((a)=>['to:'+a,'去'+a,'决定接着去'+a+'看看']))};
  }
  return null;
}

const AQUARIUM = [
  [WHALE,'wait','海底隧道','又停在隧道中央时，刚才鲸影经过的位置留在了记忆里'],
  [WHALE,'walk','水母缸','从鲸影下走到水母缸前，抬头看的视线慢慢落回玻璃里的光点'],
  [JELLY,'stay','水母缸','多停留了一会儿之后，才注意到水母张合之间细小的节奏'],
  [JELLY,'move-on','企鹅馆','离开安静的水母缸，企鹅馆的水声让这段路忽然热闹起来'],
  [PENGUINS,'watch','企鹅馆','仍留在企鹅馆看着，水里的小黑影又绕过了玻璃前'],
  [PENGUINS,'photo','纪念品店','逛到纪念品店时，又想起刚才特意记下的企鹅喂食时间'],
];

/** A follow-up is emitted only at the chosen real area, with no implicit movement. */
export function branchFollowup(venueId,area,session,nowMin) {
  const venue=VENUES.find((v)=>v.id===venueId);
  if(!venue || hoursState(venue,nowMin)==='closed' || !areasNow(venue,nowMin).includes(area)) return null;
  const emit=(event,option,target,text,condition=true)=>{
    const id=venueId+'::'+event+'::'+option;
    if(!condition || area!==target || !(session?.choices ?? []).some((c)=>c.event===event&&c.option===option)) return null;
    if((session?.branchSeen ?? []).includes(id) || (session?.events ?? []).includes(text)) return null;
    return {id,event:text};
  };
  if(venueId==='riverside') {
    return emit(RIVER,'lights','步道','沿岸的灯亮起来了，刚才决定等候的这一段江面终于换了颜色',Number(nowMin)>=17.5*60)
      ?? emit(RIVER,'water','长椅上','坐上长椅以后，刚才决定慢下来听的水声逐渐清楚了');
  }
  if(venueId==='market') {
    for(const target of ['糖水铺','卖小玩意儿的摊子','街尾的台阶']) {
      const text=target==='糖水铺'?'从人流里转到糖水铺，终于能在摊边停下来看一看招牌':target==='卖小玩意儿的摊子'?'沿刚才选的方向到了小摊前，摊面上的小东西能一件件慢慢看':'走到选好的街尾台阶，人群的声音留在了身后';
      const found=emit(MARKET,'to:'+target,target,text); if(found)return found;
    }
  }
  if(venueId==='aquarium') for(const [event,option,target,text] of AQUARIUM) {const found=emit(event,option,target,text);if(found)return found;}
  return null;
}
