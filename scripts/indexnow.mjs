#!/usr/bin/env node
/**
 * Submit URLs to IndexNow.
 *
 * IndexNow is a shared protocol used by Bing, Yandex, Naver, Seznam, Yep and
 * other search engines to notify them that URLs changed. Google does not use
 * IndexNow, but it reads <lastmod> from sitemap.xml on its normal crawl.
 *
 * Usage:
 *   node scripts/indexnow.mjs                  # sitemap URL + llms/site data files
 *   node scripts/indexnow.mjs https://p2s-academy.com/ [...]
 *   node scripts/indexnow.mjs --dry-run        # print payload, do not send
 *   node scripts/indexnow.mjs --skip-verify    # skip the key-file live check
 *
 * Environment:
 *   INDEXNOW_HOST             default: p2s-academy.com
 *   INDEXNOW_KEY              override the key file
 *   INDEXNOW_ENDPOINT         default: https://api.indexnow.org/indexnow
 *   INDEXNOW_WAIT_SECONDS     wait for the key file to go live after deploy
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HOST = (process.env.INDEXNOW_HOST || 'p2s-academy.com').trim();
const ORIGIN = `https://${HOST}`;
const ENDPOINT =
  process.env.INDEXNOW_ENDPOINT || 'https://api.indexnow.org/indexnow';
const flags = new Set(process.argv.slice(2).filter((arg) => arg.startsWith('--')));
const cliArgs = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));

function fail(message) {
  console.error(`\nIndexNow error: ${message}\n`);
  process.exit(1);
}

function findKey() {
  if (process.env.INDEXNOW_KEY) {
    return { key: process.env.INDEXNOW_KEY.trim(), file: null };
  }

  const candidates = readdirSync(root).filter(
    (file) =>
      file !== 'robots.txt' &&
      /^[a-zA-Z0-9-]{8,128}\.txt$/.test(file),
  );

  if (!candidates.length) {
    fail('no IndexNow key file found at the repository root');
  }

  // Prefer the project's p2s-* key over unrelated text files.
  const file =
    candidates.find((name) => name.startsWith('p2s-')) || candidates[0];
  const key = readFileSync(join(root, file), 'utf8').trim();

  if (!key) fail(`key file ${file} is empty`);
  return { key, file };
}

function sitemapUrls() {
  const xml = readFileSync(join(root, 'sitemap.xml'), 'utf8');
  const urls = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(
    (match) => match[1],
  );
  if (!urls.length) fail('no <loc> URLs found in sitemap.xml');
  return urls;
}

function defaultUrls() {
  const urls = sitemapUrls();
  for (const file of ['llms.txt', 'llms-full.txt', 'site.json']) {
    if (existsSync(join(root, file))) urls.push(`${ORIGIN}/${file}`);
  }
  return urls;
}

function normalize(url) {
  return new URL(url, ORIGIN).href;
}

async function keyIsLive(key, keyLocation) {
  try {
    const response = await fetch(keyLocation, { cache: 'no-store' });
    const body = (await response.text()).trim();
    return { ok: response.status === 200 && body === key, status: response.status };
  } catch (error) {
    return { ok: false, status: error.message };
  }
}

const { key, file } = findKey();
const keyLocation = `${ORIGIN}/${file || `${key}.txt`}`;
const urls = (cliArgs.length ? cliArgs : defaultUrls()).map(normalize);
const uniqueUrls = [...new Set(urls)];

const payload = {
  host: HOST,
  key,
  keyLocation,
  urlList: uniqueUrls,
};

console.log(`IndexNow host:     ${HOST}`);
console.log(`IndexNow endpoint: ${ENDPOINT}`);
console.log(`Key location:      ${keyLocation}`);
console.log(`URLs:              ${uniqueUrls.length}`);
for (const url of uniqueUrls) console.log(`  - ${url}`);

if (flags.has('--dry-run')) {
  console.log('\nDry run payload:\n' + JSON.stringify(payload, null, 2));
  process.exit(0);
}

if (!flags.has('--skip-verify')) {
  const waitSeconds = Number(process.env.INDEXNOW_WAIT_SECONDS || 0);
  const deadline = Date.now() + waitSeconds * 1000;
  let check = await keyIsLive(key, keyLocation);

  while (!check.ok && Date.now() < deadline) {
    console.log(
      `Key file not live yet (${check.status}); retrying in 15s...`,
    );
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 15_000));
    check = await keyIsLive(key, keyLocation);
  }

  if (!check.ok) {
    fail(
      `key file is not live at ${keyLocation} (HTTP ${check.status}). ` +
        'Deploy first, or use --skip-verify to submit anyway.',
    );
  }
  console.log('Key file verified live.');
}

console.log('\nSubmitting to IndexNow...');
let response;
try {
  response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  });
} catch (error) {
  fail(`request failed: ${error.message}`);
}

const text = await response.text();
console.log(`HTTP ${response.status} ${response.statusText}`);
if (text) console.log(text);

if (!response.ok) {
  fail(`IndexNow returned HTTP ${response.status}`);
}

console.log('Done. Search engines can re-fetch the submitted URLs.');
