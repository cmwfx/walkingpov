import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.sql']);
const forbiddenIntegrationPatterns = [
  /\bwhop\b/i,
  /@whop\//i,
  /whop\.com/i,
  /instantvidgrab/i,
  /(?:LIVE|SANDBOX)_WHOP_/i,
];

async function collectRuntimeFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'tests') continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectRuntimeFiles(entryPath));
    } else if (sourceExtensions.has(path.extname(entry.name)) && !/\.(test|spec)\.[^.]+$/i.test(entry.name)) {
      files.push(entryPath);
    }
  }
  return files;
}

test('CandidFan runtime has no direct-card or cross-site checkout integration', async () => {
  const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const productRoot = path.resolve(serverRoot, '..');
  const runtimeRoots = [
    path.join(productRoot, 'src'),
    path.join(serverRoot, 'src'),
    path.join(productRoot, 'media', 'src'),
  ];
  const runtimeFiles = (await Promise.all(runtimeRoots.map(collectRuntimeFiles))).flat();
  const violations: string[] = [];

  for (const filename of runtimeFiles) {
    const source = await readFile(filename, 'utf8');
    if (forbiddenIntegrationPatterns.some((pattern) => pattern.test(source))) {
      violations.push(path.relative(productRoot, filename));
    }
  }

  assert.deepEqual(violations, []);
});

test('CandidFan packages and environment templates contain no cross-site payment integration', async () => {
  const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const productRoot = path.resolve(serverRoot, '..');
  const configurationFiles = [
    'package.json',
    'package-lock.json',
    '.env.example',
    'server/package.json',
    'server/package-lock.json',
    'server/.env.example',
    'media/package.json',
    'media/package-lock.json',
    'media/.env.example',
  ].map((relativePath) => path.join(productRoot, relativePath));
  const violations: string[] = [];

  for (const filename of configurationFiles) {
    const source = await readFile(filename, 'utf8');
    if (forbiddenIntegrationPatterns.some((pattern) => pattern.test(source))) {
      violations.push(path.relative(productRoot, filename));
    }
  }

  assert.deepEqual(violations, []);
});
