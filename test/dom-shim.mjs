/**
 * 面板测试共用的极简 DOM 桩。
 *
 * 以前「家」和「地点册」两个面板测试各写一份 `class Node`（各六七十行），
 * 连 `append` / `querySelectorAll` 的怪癖都要各修一遍。这里留一份够用的实现：
 * 能挂载面板、点按钮、读文字、填表单；不做布局，也不冒充浏览器。
 *
 * 两个面板的取值口径略有差别，用选项保留：
 *   - `textValueFallback: true`（家）：没设过 value 的输入框回落到 textContent；
 *   - `textValueFallback: false`（地点册）：只有 textarea 才回落到 textContent。
 *
 * 更复杂的面板（出游 / 故事工坊）有自己的交互记录桩，不在这一份里硬凑。
 */

export function createShimDom({ textValueFallback = false } = {}) {
  class ShimNode extends EventTarget {
    constructor(tag, document) {
      super();
      this.tagName = String(tag).toUpperCase();
      this.ownerDocument = document;
      this.childNodes = [];
      this.attributes = new Map();
      this.dataset = {};
      this.className = '';
      this.hidden = false;
      this.disabled = false;
      this.selected = false;
      this.open = false;
      this.checked = false;
      this.placeholder = '';
      this._text = '';
      this._value = '';
      this._noSelection = false;
      this.parentNode = null;
      this.style = {};
    }

    /* -- 表单值：SELECT 按选中项，其余按 _value / 文本 ---------------------- */

    get value() {
      if (this.tagName === 'SELECT') {
        const options = this.querySelectorAll('option');
        return (options.find((option) => option.selected) ?? (this._noSelection ? null : options[0]))?.value ?? '';
      }
      if (this._value !== '') return this._value;
      if (this.tagName === 'TEXTAREA' || textValueFallback) return this.textContent;
      return '';
    }

    set value(value) {
      this._value = String(value);
      if (this.tagName === 'SELECT') {
        for (const option of this.querySelectorAll('option')) option.selected = option.value === this._value;
        this._noSelection = !this.querySelectorAll('option').some((option) => option.selected);
      }
    }

    /* -- 文本 ---------------------------------------------------------------- */

    get textContent() {
      return this._text + this.childNodes.map((child) => child.textContent).join('');
    }

    set textContent(value) {
      this.childNodes = [];
      this._text = value === null || value === undefined ? '' : String(value);
    }

    /* -- 属性 ---------------------------------------------------------------- */

    setAttribute(name, value) {
      this.attributes.set(name, String(value));
      if (name === 'class') this.className = String(value);
      else if (name === 'value') this.value = value;
      else if (name === 'placeholder') this.placeholder = String(value);
      else if (name === 'disabled') this.disabled = true;
    }

    getAttribute(name) {
      return this.attributes.get(name) ?? null;
    }

    /* -- 事件：走 EventTarget 原生实现，click() 才能真正触发监听器 ---------- */

    click() {
      if (!this.disabled) this.dispatchEvent(new Event('click'));
    }

    focus() {
      this.ownerDocument.activeElement = this;
    }

    /* -- 树 ------------------------------------------------------------------ */

    appendChild(node) {
      if (node === null || node === undefined) return node;
      if (typeof node !== 'object') node = this.ownerDocument.createTextNode(String(node));
      this.childNodes.push(node);
      node.parentNode = this;
      return node;
    }

    append(...nodes) {
      for (const node of nodes) this.appendChild(node);
    }

    replaceChildren(...nodes) {
      for (const child of this.childNodes) child.parentNode = null;
      this.childNodes = [];
      this._text = '';
      for (const node of nodes) this.appendChild(node);
    }

    remove() {
      if (!this.parentNode) return;
      const siblings = this.parentNode.childNodes;
      const at = siblings.indexOf(this);
      if (at >= 0) siblings.splice(at, 1);
      this.parentNode = null;
    }

    contains(element) {
      return this === element || this.childNodes.some((child) => child.contains?.(element));
    }

    *walk() {
      yield this;
      for (const child of this.childNodes) yield* child.walk();
    }

    querySelectorAll(selector) {
      const tags = selector.split(',').map((tag) => tag.trim().toUpperCase());
      return [...this.walk()].filter((node) => node !== this && tags.includes(node.tagName));
    }

    querySelector(selector) {
      return this.querySelectorAll(selector)[0] ?? null;
    }
  }

  function createDocument() {
    const doc = { activeElement: null };
    doc.createElement = (tag) => new ShimNode(tag, doc);
    doc.createTextNode = (text) => {
      const node = new ShimNode('#text', doc);
      node.textContent = text;
      return node;
    };
    return doc;
  }

  return { ShimNode, createDocument };
}