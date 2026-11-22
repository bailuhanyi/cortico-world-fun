import { mountPanel } from './panel.js';

export { mountPanel };
export { RESOURCE_SLOTS } from './resources.js';

/** Native Coopanion WebUiClientBundle; owner supplies ctx.storyCall adapter. */
export default {
  panels: {
    story: {
      mount(ctx) { return mountPanel(ctx.root, ctx); },
    },
  },
};
