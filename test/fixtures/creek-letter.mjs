import { cleanUserVenue } from '../../src/user-venues.js';
import { validateStoryPack } from '../../src/story-packs.js';

export const SAMPLE_STYLE = '暮色水彩 · 苔绿、浅金与雾蓝';

export const SAMPLE_VENUE = cleanUserVenue({
  id: 'user-story-creek-letter',
  name: '溪边', tags: ['户外', '故事样章'],
  desc: '一条不宽的溪从旧木桥底下拐弯。沿着岸走，先是摇晃的芦苇，再往前是一张背朝小路的长椅。',
  hours: { open: '00:00', close: '23:59' },
  areas: ['旧木桥', '芦苇滩', '河岸长椅'],
}).venue;

export const SAMPLE_STORY = {
  version: 1, id: 'creek-drift-letter', title: '溪边的漂流信',
  description: '一只玻璃瓶卡在旧木桥下。信纸上只有三行字，其中一行提到溪边的一个记号。',
  placeId: SAMPLE_VENUE.id, start: 'bottle',
  nodes: [
    {
      id: 'bottle', area: '旧木桥',
      event: '旧木桥的第三块木板吱呀一声。鱼低下头，从桥墩旁捞起一只玻璃瓶。瓶里折着一张旧信：「如果你刚好有空，去找一找溪边系了蓝绳的地方。」',
      prompt: '鱼把沾水的瓶子搁在桥栏上。要沿溪找那个记号，还是先把信带在身边？',
      choices: [
        { id: 'follow', label: '沿溪寻找', result: '鱼记下「蓝绳」，准备顺着水声往芦苇滩走。', next: 'reeds-ending' },
        { id: 'keep', label: '先把信收好', result: '鱼把信夹进本子里，打算到长椅上写几句回信。', next: 'bench-ending' },
      ],
    },
    {
      id: 'reeds-ending', area: '芦苇滩',
      event: '芦苇后有根歪木桩，蓝绳已经晒得发白。绳结里夹着第二张便笺：「我搬走前，把这里最安静的一小会儿留给你。听完水声，也替后来的人留一会儿吧。」鱼靠着木桩坐了一小会儿，把便笺塞回原处。',
    },
    {
      id: 'bench-ending', area: '河岸长椅',
      event: '河岸长椅还留着一点暖意。鱼在信背面写道：「我还没去找那个记号。不过今天有一只白鸟从桥下飞过去。我想你也会喜欢。」她把原信和回信一起放回瓶里，留在长椅下避雨的石缝中。',
    },
  ],
};

export const VALIDATED_SAMPLE = validateStoryPack(SAMPLE_STORY).pack;
