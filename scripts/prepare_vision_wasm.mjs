import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDirectory = resolve(projectRoot, 'node_modules/@mediapipe/tasks-vision/wasm');
const destinationDirectory = resolve(projectRoot, 'public/wasm');
const wasmFiles = ['vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.wasm'];

mkdirSync(destinationDirectory, { recursive: true });

for (const file of wasmFiles) {
  copyFileSync(resolve(sourceDirectory, file), resolve(destinationDirectory, file));
  console.info(`[VisionAssets] Prepared ${file}`);
}
