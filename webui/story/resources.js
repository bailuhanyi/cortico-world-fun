export const RESOURCE_SLOTS = Object.freeze([
  { id: 'home-day', title: '鱼的家', description: '家景 · 建议 16:9 横图' },
  { id: 'creek-evening', title: '傍晚溪边', description: '地点与入场场景 · 建议 16:9 横图' },
  { id: 'creek-letter-ending', title: '蓝绳与便笺', description: '样章结尾插画 · 建议 16:9 横图' },
]);
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 16 * 1024 * 1024;
const TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const PREFIX = 'story-artwork-v1:';

export function validateImageBytes(type, buffer) {
  if (!TYPES.has(type)) throw new Error('只接受 PNG、JPEG、WebP 图片，不支持 SVG 或 GIF。');
  if (!buffer || !buffer.byteLength || buffer.byteLength > MAX_IMAGE_BYTES) throw new Error('每张图片须大于 0 且不超过 2 MB。');
  const bytes = new Uint8Array(buffer);
  const match = type === 'image/png'
    ? [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
    : type === 'image/jpeg'
      ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (!match) throw new Error('图片内容与文件类型不一致，请重新选择原始图片。');
  return true;
}

/** Only explicit local artwork enters memo. No trip, choice or mode is stored. */
export function createArtworkStore(ctx, onChange = () => {}) {
  const memory = new Map();
  const invalid = new Set();
  for (const slot of RESOURCE_SLOTS) {
    try {
      const saved = ctx.memo?.get(PREFIX + slot.id, null);
      if (typeof saved === 'string' && saved.length <= MAX_IMAGE_BYTES * 1.4 + 100
        && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(saved)) memory.set(slot.id, saved);
    } catch { /* A restricted browser still supports an in-memory illustration. */ }
  }
  const validSlot = (id) => RESOURCE_SLOTS.some((slot) => slot.id === id);
  return {
    get(id) { return !invalid.has(id) ? memory.get(id) ?? null : null; },
    markFailed(id) { invalid.add(id); },
    clear(id) {
      if (!validSlot(id)) return;
      memory.delete(id); invalid.delete(id);
      try { ctx.memo?.set(PREFIX + id, null); } catch { /* Memory-only fallback. */ }
      onChange();
    },
    async import(id, file) {
      if (!validSlot(id)) throw new Error('未知的资源槽位。');
      if (!file || !TYPES.has(file.type)) throw new Error('请选择 PNG、JPEG 或 WebP 图片。');
      if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) throw new Error('每张图片须大于 0 且不超过 2 MB。');
      const buffer = await file.arrayBuffer();
      validateImageBytes(file.type, buffer);
      if (ctx.signal?.aborted) return;
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        const abort = () => { reader.abort(); reject(new Error('面板已关闭，已取消导入。')); };
        ctx.signal?.addEventListener('abort', abort, { once: true });
        reader.onload = () => { ctx.signal?.removeEventListener('abort', abort); resolve(reader.result); };
        reader.onerror = () => { ctx.signal?.removeEventListener('abort', abort); reject(new Error('无法读取这张图片。')); };
        reader.onabort = () => { ctx.signal?.removeEventListener('abort', abort); reject(new Error('图片读取已取消。')); };
        reader.readAsDataURL(file);
      });
      const dimensions = await new Promise((resolve, reject) => {
        const image = new Image();
        const abort = () => { image.src = ''; reject(new Error('面板已关闭，已取消导入。')); };
        const cleanup = () => { image.onload = null; image.onerror = null; ctx.signal?.removeEventListener('abort', abort); };
        ctx.signal?.addEventListener('abort', abort, { once: true });
        image.onload = () => { const size = { width: image.naturalWidth, height: image.naturalHeight }; cleanup(); resolve(size); };
        image.onerror = () => { cleanup(); reject(new Error('无法解码这张图片，请更换文件。')); };
        image.src = dataUrl;
      });
      if (ctx.signal?.aborted) return;
      if (!dimensions.width || !dimensions.height || dimensions.width * dimensions.height > MAX_IMAGE_PIXELS) throw new Error('图片像素过大，请缩小到 1600 万像素以内。');
      memory.set(id, dataUrl); invalid.delete(id);
      let persistent = Boolean(ctx.memo);
      try { ctx.memo?.set(PREFIX + id, dataUrl); } catch { persistent = false; }
      onChange();
      return { persistent };
    },
  };
}
