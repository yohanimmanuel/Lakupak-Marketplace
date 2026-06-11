/**
 * Generate expo-router typed route declarations for `tsc` on CI (no dev server).
 */
const fs = require('fs');
const path = require('path');
const { getTypedRoutesDeclarationFile } = require('expo-router/build/typed-routes/generate');
const { EXPO_ROUTER_CTX_IGNORE } = require('expo-router/_ctx-shared');
const requireContext = require('expo-router/build/testing-library/require-context-ponyfill').default;

const appRoot = path.resolve(__dirname, '..', 'app');
const outputDir = path.resolve(__dirname, '..', '.expo', 'types');

process.env.EXPO_ROUTER_APP_ROOT = appRoot;

const ctx = requireContext(appRoot, true, EXPO_ROUTER_CTX_IGNORE);
const file = getTypedRoutesDeclarationFile(ctx);

if (!file) {
  console.error('Failed to generate expo-router types');
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'router.d.ts'), file);
