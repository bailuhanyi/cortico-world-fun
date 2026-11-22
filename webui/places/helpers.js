export const list = (value) => Array.isArray(value) ? value : [];

export function dom(document) {
  function node(tag, attributes, ...children) {
    const element = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes ?? {})) {
      if (value == null) continue;
      if (name === 'class') element.className = value;
      else if (['checked', 'disabled', 'required', 'selected'].includes(name)) element[name] = Boolean(value);
      else if (name.startsWith('on')) element.addEventListener(name.slice(2), value);
      else element.setAttribute(name, String(value));
    }
    for (const child of children.flat(Infinity)) {
      if (child != null && child !== false) element.append(typeof child === 'object' ? child : String(child));
    }
    return element;
  }
  const row = (...children) => node('div', { class: 'fpl-row' }, children);
  const note = (content) => node('p', { class: 'fpl-muted fpl-wrap' }, content);
  const button = (text, callback, attrs = {}) => node('button', { type: 'button', onclick: callback, ...attrs }, text);
  const field = (label, control, hint) => node('label', { class: 'fpl-field' }, label, control, hint ? note(hint) : null);
  const option = (value, label) => node('option', { value }, label);
  const chip = (text) => node('span', { class: 'fpl-chip' }, text);
  return { node, row, note, button, field, option, chip };
}

export function styleDescription(place) {
  if (place.styleSource === 'place' || place.style?.trim()) return '地点画风';
  if (place.styleSource === 'source-default') return '补录的旧世界默认画风';
  if (place.effectiveStyle) return '从0开始的肥鱼大冒险默认画风';
  return '未设置';
}

export function hasSafeImage(dataUrl) {
  return typeof dataUrl === 'string' && /^data:image\/(?:png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(dataUrl);
}

export function selectedMappings(items, decisions) {
  const usedTargets = new Set();
  return items.map((item) => {
    const choice = decisions.get(item.sourceId);
    if (!choice || !['new', 'bind', 'skip'].includes(choice.action)) throw new Error(`请选择「${item.name}」的迁入方式。`);
    if (choice.action !== 'bind') return { sourceId: item.sourceId, action: choice.action };
    if (!choice.targetId) throw new Error(`请为「${item.name}」选择接收地点。`);
    if (usedTargets.has(choice.targetId)) throw new Error('同一个本地地点只能接收一条来源记录。');
    usedTargets.add(choice.targetId);
    return { sourceId: item.sourceId, action: choice.action, targetId: choice.targetId, policy: choice.policy === 'overwrite' ? 'overwrite' : 'keep' };
  });
}

export function pictureData(file, maxBytes, FileReaderClass = globalThis.FileReader) {
  const supported = /^(?:image\/(?:png|jpeg|jpg|gif|webp))$/;
  if (!file || !file.size || file.size > maxBytes) throw new Error(`请选择大小在 ${maxBytes / (1024 * 1024)} MiB 以内的图片。`);
  if (file.type && !supported.test(file.type)) throw new Error('请选择 PNG、JPEG、GIF 或 WebP 图片。');
  return new Promise((resolve, reject) => {
    const reader = new FileReaderClass();
    reader.onload = () => {
      let result = reader.result;
      if (typeof result === 'string' && result.startsWith('data:application/octet-stream;base64,')) {
        const mime = { png: 'png', jpg: 'jpeg', jpeg: 'jpeg', gif: 'gif', webp: 'webp' }[file.name?.toLowerCase().split('.').at(-1)];
        if (mime) result = result.replace('application/octet-stream', `image/${mime}`);
      }
      if (hasSafeImage(result)) resolve(result);
      else reject(new Error('没有读到受支持的图片。'));
    };
    reader.onerror = () => reject(new Error('无法读取这张图片。'));
    reader.onabort = () => reject(new Error('图片读取已取消。'));
    reader.readAsDataURL(file);
  });
}
