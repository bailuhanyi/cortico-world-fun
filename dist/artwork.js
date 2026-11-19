/** Original miniature line scenes drawn for fun-world. No external assets or requests.
 * Shared geometry/palette keeps the twenty places one little illustrated world.
 * These are decorative illustrations, never photographs or records of a visit.
 */
const line = (d, extra = '') => `<path d="${d}" ${extra}/>`;
const rect = (x, y, w, h, r = 3, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${extra}/>`;
const circle = (x, y, r, extra = '') => `<circle cx="${x}" cy="${y}" r="${r}" ${extra}/>`;
const warm = 'fill="var(--f-art-warm,#e9b97e)"';
const mint = 'fill="var(--f-art-mint,#99c7b9)"';
const blue = 'fill="var(--f-art-blue,#9abfd0)"';
const pink = 'fill="var(--f-art-pink,#d9abc1)"';
const paper = 'fill="var(--f-card,#fbfbfb)"';
const scenes = {
  amusement: circle(139, 48, 34, blue) + line('M139 14V82M105 48H173M115 24L163 72M115 72L163 24M139 48L113 108H165Z') + [ [139,14],[173,48],[139,82],[105,48] ].map(([x,y]) => rect(x-6,y-4,12,10,3,warm)).join('') + line('M202 104V64H267V104M196 64L235 38L274 64Z', warm) + rect(220,77,25,27,5,pink) + line('M39 91V45M39 45L69 53L39 63Z',mint),
  aquarium: line('M68 108V57C68 8 249 8 249 57V108',blue) + line('M88 108V58C88 31 229 31 229 58V108',paper) + line('M132 56C154 39 180 41 192 52L210 45V67L192 60C170 73 144 68 132 56Z',mint) + circle(181,52,1.5,'fill="currentColor"') + line('M105 108L108 87L117 100L121 78L128 108M208 108L215 82L219 99L228 89L231 108') + circle(111,57,3) + circle(118,43,2),
  templefair: line('M67 108V38M91 108V38M225 108V38M249 108V38M52 31Q157 47 264 31L260 44H56ZM58 56H258',warm) + line('M102 80H215M109 80V107M207 80V107M99 79L158 54L218 79Z',mint) + [111,157,203].map(x=>circle(x,60,9,pink)+line(`M${x} 47V51M${x} 69V74`)).join(''),
  con: rect(77,35,164,72,5,paper) + rect(91,48,63,47,3,pink) + line('M107 83L116 65L124 76L137 57L146 83Z') + rect(169,49,56,13,2,warm) + line('M169 73H225M169 83H209M91 107V114M227 107V114') + line('M47 57L53 43L59 57L73 63L59 69L53 83L47 69L33 63Z',blue),
  cinema: rect(75,23,174,79,5,blue) + rect(89,35,146,53,2,paper) + line('M149 46L149 76L175 61Z',warm) + [98,131,164,197,230].map(x=>rect(x-9,96,21,16,4,pink)).join('') + line('M42 96L38 68H62L58 96Z',warm) + line('M40 68Q39 54 48 59Q58 48 62 62'),
  zoo: rect(73,36,177,71,10,mint) + line('M82 42L100 22H224L243 42',warm) + line('M117 107V72Q117 46 142 46Q167 46 167 72V107',paper) + circle(137,62,3) + circle(153,62,3) + line('M140 78Q146 84 152 78M201 107V67M195 67Q177 42 193 43Q200 24 207 43Q226 38 219 57Z',blue) + circle(53,61,18,mint) + line('M53 79V107'),
  park: line('M119 114Q125 89 154 78Q176 67 178 49',warm) + circle(76,54,27,mint) + circle(236,49,33,mint) + line('M76 65V109M236 62V109') + rect(104,75,63,10,3,paper) + line('M110 86V102M160 86V102M105 67H166M113 67V76M157 67V76') + circle(157,25,13,warm),
  arcade: rect(105,25,85,82,7,pink) + rect(116,35,63,39,3,blue) + line('M129 58L139 45L150 60L159 49L169 65') + line('M105 81L94 94H199L190 81Z',warm) + circle(126,88,3) + circle(168,88,3) + line('M122 85V78') + rect(128,98,37,4,1,paper) + line('M224 45L235 34M233 62H251M215 32V19'),
  ktv: rect(62,29,126,69,6,blue) + line('M78 47H161M78 62H134M78 77H151') + line('M220 53L190 95Q187 103 195 106Q201 108 205 103L234 64',warm) + circle(231,48,17,pink) + line('M220 35L242 60M214 43L235 65M206 106Q236 121 255 99M272 31V61Q258 55 257 65Q260 77 273 69V40L290 35V55'),
  museum: line('M64 47L159 15L253 47Z',warm) + rect(65,47,188,10,1,paper) + [86,125,164,203].map(x=>rect(x,57,16,43,2,blue)).join('') + rect(61,101,195,10,1,paper) + circle(159,36,8,mint) + line('M41 110H278'),
  catcafe: rect(66,30,123,71,5,warm) + line('M76 43H178M128 43V101M76 77H178') + line('M201 97C177 89 185 72 199 73L198 58L211 67L225 59L228 78C242 102 217 110 201 97Z',pink) + circle(207,81,1.5,'fill="currentColor"') + circle(220,81,1.5,'fill="currentColor"') + line('M206 91Q215 96 221 88M237 98Q263 100 253 83') + rect(89,87,18,15,3,paper) + line('M107 90Q119 90 112 98'),
  hiking: line('M45 108L128 21L197 108Z',mint) + line('M127 21L104 47L128 43L145 47Z',paper) + line('M143 108L219 42L278 108Z',blue) + line('M150 108L145 94L164 79L164 70M219 42L205 56H232',paper) + circle(241,24,12,warm) + line('M83 109V85M75 93L83 79L91 93ZM248 109V86M239 96L248 78L257 96Z'),
  cafe: rect(77,30,159,77,4,warm) + line('M69 48H243L232 25H81Z',pink) + rect(89,61,61,46,3,blue) + rect(167,61,55,34,3,paper) + line('M177 73H204V85H177ZM204 75Q216 74 211 82M183 64Q178 59 184 55M195 64Q190 59 196 55M119 62V106M89 82H150'),
  milktea: rect(77,29,164,78,5,pink) + rect(88,38,141,15,2,paper) + line('M107 64L113 105H145L151 64Z',warm) + line('M102 64H156M127 64L135 40',paper) + [119,129,139].map(x=>circle(x,94,2.5,'fill="currentColor"')).join('') + rect(174,67,40,40,3,blue) + line('M179 80H209M179 89H201'),
  diner: rect(67,29,183,78,6,warm) + rect(80,40,69,48,3,blue) + line('M114 41V87M80 64H149') + line('M171 80H225M177 81V105M220 81V105') + line('M184 69H216Q217 56 201 56Q184 56 184 69ZM201 56V51',paper) + line('M183 36V47M196 32V43M209 36V47') + rect(88,95,51,11,3,pink),
  library: rect(71,29,177,78,4,warm) + line('M87 35V99M155 35V99M231 35V99M87 65H231M87 99H231') + [95,110,126,164,179,211].map((x,i)=>rect(x, i%2?45:41,10,i%2?19:23,1,i%2?mint:blue)).join('') + line('M106 83Q133 75 159 85Q183 75 208 83V111Q183 102 159 111Q134 102 106 111ZM159 85V111',paper),
  market: line('M51 31Q156 58 269 30') + [75,116,158,200,242].map(x=>circle(x,x===158?52:45,7,warm)).join('') + line('M60 104V77H130V104M49 77L67 59H123L141 77Z',pink) + line('M180 104V77H250V104M169 77L187 59H243L261 77Z',blue) + line('M73 90H118M192 89H237M81 104V92M225 104V90') + rect(142,93,22,14,2,mint),
  bathhouse: rect(69,33,181,74,5,warm) + line('M60 34L89 18H229L258 34Z',blue) + rect(89,53,142,54,2,paper) + line('M89 54H231V76Q211 66 195 76Q177 67 160 77Q141 67 124 76Q105 66 89 76ZM160 54V107',mint) + line('M112 44Q102 34 112 25M156 45Q145 34 156 25M200 44Q189 34 200 25'),
  thrift: rect(67,29,179,78,4,mint) + line('M60 48H253L241 26H73Z',warm) + rect(84,64,56,43,3,paper) + circle(112,81,12,blue) + line('M112 72V81L119 84') + line('M163 80L180 65L197 80M180 65V59Q180 53 187 55M163 80H197',pink) + rect(205,86,26,21,2,pink) + line('M210 86V79H226V86M90 103L102 96H129'),
  riverside: line('M36 90Q93 80 151 90T284 90M36 103Q93 93 151 103T284 103M52 115Q99 107 145 115M187 115Q224 107 269 115',blue) + line('M62 82V57M88 82V57M114 82V57M140 82V57M57 63H147M57 75H147') + line('M165 60Q202 8 262 60M173 60V78M253 60V78M170 60H259',warm) + circle(103,26,13,pink) + line('M218 105L230 96H253L247 105Z',mint),
};

export function venueArtwork(id) {
  const drawing = scenes[id] ?? (line('M83 107V51L160 20L237 51V107Z',mint) + rect(108,64,32,43,3,paper) + rect(169,62,42,27,3,blue));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 128" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M28 112H292" opacity=".2"/><g>${drawing}</g></svg>`;
}

const symbols = {
  ticket: line('M4 6H20V10Q16 12 20 14V18H4V14Q8 12 4 10ZM14 7V9M14 11V13M14 15V17'),
  keychain: circle(9,7,4) + line('M9 11V15M7 15H15L18 21H5Z'),
  bookmark: line('M7 3H17V21L12 17L7 21ZM10 7H14M10 10H14'),
  postcard: rect(3,5,18,14,2) + line('M14 8V16M17 9H19M6 14L9 10L12 14ZM6 16H12'),
  sticker: line('M4 4H20V15L15 20H4ZM15 20V15H20') + circle(9,9,1) + circle(15,9,1) + line('M8 12Q12 16 16 12'),
  coin: circle(12,12,9) + circle(12,12,6) + line('M12 7L14 10L17 12L14 14L12 17L10 14L7 12L10 10Z'),
  cup: line('M5 8H16V17Q10 22 5 17ZM16 10H20V15H16M8 3V5M12 3V5'),
  light: line('M8 15Q1 7 8 4Q16 0 19 8Q20 12 16 15V19H8ZM9 22H15M9 16H15'),
  plush: circle(6,6,3) + circle(18,6,3) + circle(12,10,7) + line('M7 16Q4 23 12 22Q20 23 17 16') + circle(9,9,1) + circle(15,9,1) + line('M11 12H13'),
  charm: line('M12 3V6M7 6H17L20 12L17 21H7L4 12ZM9 10H15M9 14H15M10 18H14'),
  generic: rect(4,8,16,13,2) + rect(3,5,18,4,1) + line('M12 5V21M12 5Q4 4 7 1Q10 0 12 5Q14 0 17 1Q20 4 12 5'),
};
export function souvenirCategory(name) {
  const value = String(name ?? '');
  return (/票|券|入场/.test(value) ? 'ticket' : /钥匙|挂件|挂饰|吊坠/.test(value) ? 'keychain'
    : /书签/.test(value) ? 'bookmark' : /明信片|卡片|画片|海报/.test(value) ? 'postcard'
      : /贴纸|贴画|徽章/.test(value) ? 'sticker' : /币|章/.test(value) ? 'coin'
        : /杯|茶|咖啡/.test(value) ? 'cup' : /灯/.test(value) ? 'light'
          : /玩偶|公仔|小熊|毛绒/.test(value) ? 'plush' : /御守|护符|签/.test(value) ? 'charm' : 'generic');
}
export function souvenirArtwork(name) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${symbols[souvenirCategory(name)]}</svg>`;
}
