import { mountPanel } from './story/webui.js';

const PAUSE_PATH = '/api/webui/providers/world%3Afun/panels/story/pause';

export function mountFishStory(ctx) {
  async function storyCall(method, payload, options = {}) {
    const args = payload === undefined ? [] : [payload];
    if (method === 'pause' && options.keepalive) {
      // The native invoke is cancelled on unmount. The same owner RPC accepts a
      // best-effort revocation even after the panel lifecycle has ended.
      const response = await fetch(PAUSE_PATH, {
        method: 'POST', keepalive: true, credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ args }),
      });
      if (!response.ok) throw new Error(`暂停请求失败（HTTP ${response.status}）`);
      return response.json();
    }
    let timer;
    try {
      return await Promise.race([
        ctx.invoke(method, args),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('宿主请求超时，请重新读取进度。')), options.timeoutMs ?? 20_000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  return mountPanel(ctx.root, { ...ctx, storyCall });
}
