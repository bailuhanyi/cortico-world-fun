#!/usr/bin/env node
import assert from 'node:assert/strict';
import { loadStandaloneWebUi } from './load-webui.mjs';

const client = await loadStandaloneWebUi(new URL('../dist/webui.js', import.meta.url));
const panels = client.default?.panels;
assert.ok(panels && typeof panels === 'object' && !Array.isArray(panels), '面板入口必须默认导出 panels');
assert.ok(Object.keys(panels).length > 0, '面板不能为空');
for (const [id, panel] of Object.entries(panels)) assert.equal(typeof panel.mount, 'function', `${id} 缺 mount`);
console.log(`面板单文件加载通过：${Object.keys(panels).join('、')}，无需相邻模块。`);
