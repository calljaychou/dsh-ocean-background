/** Bundle and slot-contract checks that do not require a running DSH instance. */
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const bundlePath = new URL('../lib/client.js', import.meta.url);
const registrations = [];
const storage = new Map();

const fakeReact = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (value) => [value, () => {}],
  useEffect: () => {},
  useRef: (value) => ({ current: value }),
  useCallback: (callback) => callback,
};

const sandbox = {
  window: {
    __ModuleLoader__: {
      load(registration) {
        registrations.push(registration);
      },
    },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
  },
  console,
  Map,
  Set,
  Math,
  Float32Array,
  Object,
  Number,
  Array,
  JSON,
  Date,
};
sandbox.globalThis = sandbox;

runInContext(readFileSync(bundlePath, 'utf8'), createContext(sandbox), {
  filename: bundlePath.pathname,
});

const registration = registrations[0];
const plugin = registration.factory((id) => {
  if (id === 'react') return fakeReact;
  throw new Error(`unexpected require("${id}")`);
});
const slotRegistrations = [];
const slotInjections = [];
let themeSnapshot = { active: { colorScheme: 'light' } };
let themeChangeListener;
const ctx = {
  theme: {
    getTheme() {
      return themeSnapshot;
    },
  },
  effect(callback) {
    callback();
  },
  on(event, callback) {
    if (event === 'theme/change') themeChangeListener = callback;
    return () => {};
  },
  slots: {
    inject(key, callback) {
      slotInjections.push(key);
      return callback();
    },
    register(options, component) {
      slotRegistrations.push({ options, component });
      return () => {};
    },
  },
};
plugin.apply(ctx);

const checks = [
  ['bundle registers one factory', registrations.length === 1],
  ['bundle id matches package name', registration.id === 'dsh-ocean-background'],
  ['plugin exports slots injection', plugin.inject.includes('slots')],
  ['plugin exports theme injection', plugin.inject.includes('theme')],
  ['plugin reads the DSH theme snapshot', themeSnapshot.active.colorScheme === 'light'],
  ['plugin subscribes to theme changes', typeof themeChangeListener === 'function'],
  ['plugin injects both slots', slotInjections.join(',') === 'shell.overlay,settings.section'],
  ['plugin registers two components', slotRegistrations.length === 2],
  [
    'overlay registration is additive',
    slotRegistrations[0].options.name === 'shell.overlay' &&
      slotRegistrations[0].options.id === 'dsh-ocean-background-layer',
  ],
  [
    'settings section exposes Chinese label',
    slotRegistrations[1].options.name === 'settings.section' &&
      slotRegistrations[1].options.label() === '海洋背景',
  ],
  [
    'both registrations expose components',
    slotRegistrations.every((entry) => typeof entry.component === 'function'),
  ],
];

let failed = 0;
for (const [label, passed] of checks) {
  console.log(`  ${passed ? 'PASS' : 'FAIL'}  ${label}`);
  if (!passed) failed++;
}
console.log(`\n结果：${checks.length - failed}/${checks.length} 通过`);
process.exit(failed === 0 ? 0 : 1);
