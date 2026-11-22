/** Coo serves only the declared entry script, so sibling files must not be needed. */
import { readFile } from 'node:fs/promises';

export async function loadStandaloneWebUi(file) {
  const source = await readFile(file, 'utf8');
  // A data URL has no sibling directory. Relative imports fail here just as they
  // do when Coo returns 404 for an undeclared extension asset.
  try {
    return await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  } catch (error) {
    throw Object.assign(new Error(`面板入口不能独立加载（${error.code ?? error.name}）；请将所有浏览器依赖打入 webui.js。`), { code: error.code });
  }
}
