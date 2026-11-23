/**
 * 面板共用的小 DOM 层。
 *
 * 以前 `el()` 有三个版本（`webui.js`、`stories.js`、`home/webui.js`），
 * `errorCard` / `heading` 也各写一份——改一处漏一处，bundle 还更胖。
 * 这里保留两种入口：
 *
 *   - `el(tag, props, ...kids)`：用全局 `document`，主面板与故事面板共用；
 *   - `elIn(document, tag, attrs, ...children)`：家面板要把 `document` 传进来
 *     （它的测试桩与宿主生命周期都自己带着 document），行为与原来那份一致。
 *
 * 属性口径取并集：`class` → className，`text` → textContent，`html` → innerHTML，
 * `on*` → 事件，`style` 对象 → 逐条赋值，其余走 setAttribute；假值跳过。
 */

/** 建元素 + 设属性。用全局 `document`。 */
export function el(tag, props, ...kids) {
  const node = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'html') node.innerHTML = value;
      else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
      else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
      else if (key === 'style') node.setAttribute('style', String(value));
      else if (key === 'hidden') node.hidden = Boolean(value);
      else node.setAttribute(key, value);
    }
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    node.appendChild(typeof kid === 'string' || typeof kid === 'number'
      ? document.createTextNode(String(kid)) : kid);
  }
  return node;
}

/** 同 `el`，但用调用方给的 `document`（家面板的宿主注入）。 */
export function elIn(doc, tag, attrs = {}, ...children) {
  const element = doc.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (name === 'class') element.className = value;
    else if (name === 'text') element.textContent = String(value);
    else if (name === 'style') element.setAttribute('style', value);
    else if (name === 'hidden') element.hidden = Boolean(value);
    else if (name.startsWith('on') && typeof value === 'function') element.addEventListener(name.slice(2), value);
    else element.setAttribute(name, String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    element.append(typeof child === 'object' ? child : String(child));
  }
  return element;
}

/** 读取失败时的错误卡；`retained` 表示只是刷新失败、旧内容还在。 */
export function errorCard(err, retry, retained = false) {
  return el('div', { class: 'fun-err', role: 'alert' },
    el('span', { text: retained ? `刷新失败，保留上次内容：${err?.message ?? String(err)}` : `面板加载失败：${err?.message ?? String(err)}` }),
    retry ? el('button', { type: 'button', onclick: () => { void retry(); } }, '重试') : null);
}

/** 面板抬头：小标题 + 大标题 + 一行说明。 */
export function heading(title, subtitle) {
  return el('header', { class: 'fun-heading' },
    el('p', { class: 'fun-kicker', text: `从0开始的肥鱼大冒险 · ${title}` }),
    el('h2', { text: title }),
    subtitle ? el('p', { class: 'fun-heading-lead', text: subtitle }) : null);
}

/**
 * 面板顶部的一条状态栏：创建、插进 `box`、返回节点，文字由调用方自己写。
 *
 * 故事工坊的 `feedback()` 不是这一个——它还带错误列表和 `set()`，
 * 形状不同，故意各留各的。
 */
export function feedback(box) {
  const node = el('div', { class: 'fun-feedback' });
  box.appendChild(node);
  return node;
}