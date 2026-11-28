import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'
import { BOARD, CAREERS, TALENT_NETWORK, verifyCHRobinsonBinding } from './nativeBinding.js'

const CURRENT_CANONICAL = 'https://www.chrobinson.com/about-us/careers/'
const captured = gunzipSync(fs.readFileSync(new URL('./fixtures/corporate-careers-20261127.html.gz', import.meta.url)))
const body = captured.toString('utf8')
const read = page => verifyCHRobinsonBinding({
  fetchPage: async () => ({ status: 200, url: CAREERS, body: page }),
  now: '2026-11-27T20:06:40.000Z',
})

test('current captured corporate canonical keeps its exact Workday handoff and company scope hold', async () => {
  assert.equal(captured.length, 110276)
  assert.equal(createHash('sha256').update(captured).digest('hex'), '6cd2eae63c7cd31d4b86e27f609da14687688b3bc3a5847e868cdfecc80e5186')
  const binding = await read(body)
  assert.equal(binding.officialURL, CAREERS)
  assert.equal(binding.boardURL, BOARD)
  assert.equal(binding.observedHandoffURL, TALENT_NETWORK)
  assert.equal(binding.companyScopeComplete, false)
})

test('the previously reviewed locale canonical still binds the same corporate page', async () => {
  const binding = await read(body.replace('href="' + CURRENT_CANONICAL + '"', 'href="' + CAREERS + '"'))
  assert.equal(binding.observedHandoffURL, TALENT_NETWORK)
  assert.equal(binding.companyScopeComplete, false)
})

for (const canonical of [
  'https://other.example/about-us/careers/',
  'https://www.chrobinson.com/about-us/',
  'http://www.chrobinson.com/about-us/careers/',
  CURRENT_CANONICAL + '?unreviewed=true',
  CURRENT_CANONICAL + '#unreviewed',
]) test('an unreviewed corporate canonical stays unavailable: ' + canonical, async () => {
  await assert.rejects(read(body.replace('href="' + CURRENT_CANONICAL + '"', 'href="' + canonical + '"')), /canonical missing/)
})

test('two competing corporate canonicals cannot supply one trusted identity', async () => {
  await assert.rejects(read(body.replace('</head>', '<link rel="canonical" href="' + CAREERS + '"></head>')), /canonical missing/)
})

test('the current canonical cannot replace a missing active Workday handoff', async () => {
  await assert.rejects(read(body.replaceAll(TALENT_NETWORK, 'https://other.wd5.myworkdayjobs.com/CHRobinson/page/changed')), /handoff missing/)
})

test('an inactive corporate page cannot bind a board through its current canonical', async () => {
  await assert.rejects(read('<div hidden>' + body + '</div>'), /canonical missing/)
})
