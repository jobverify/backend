import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import { CAREERS_URL, createIprogrammerSolutionsScraper, hasVerifiedOpeningsSignal } from '../../scraper/iprogrammersolutions/script.js'
const dir = new URL('./fixtures/iprogrammersolutions/', import.meta.url)
const homepage = await fs.readFile(new URL('current-redirect-homepage.html', dir), 'utf8')
const prototype = JSON.parse(await fs.readFile(new URL('current-prototype-feed.json', dir), 'utf8'))

test('current iProgrammer careers redirect response remains a source failure without a zero count', async () => {
  assert.match(homepage, /iProgrammer \| AI, Digital Engineering/)
  assert.equal(hasVerifiedOpeningsSignal(homepage), false)
  const calls = []
  await assert.rejects(createIprogrammerSolutionsScraper().run({
    fetchText: async url => { calls.push(url); return homepage },
  }), /verified iProgrammer Solutions openings surface/i)
  assert.deepEqual(calls, [CAREERS_URL])
})
test('current official mission-control data cannot qualify prototype localhost applications as recruiting inventory', () => {
  assert.equal(prototype.meta.pagination.total, 4)
  assert.equal(prototype.data.length, 4)
  assert.ok(prototype.data.every(row => new URL(row.attributes.applyUrl).hostname === 'localhost'))
  assert.ok(prototype.data.every(row => row.attributes.title === 'Staff Data Scientist'))
  assert.ok(prototype.data.every(row => JSON.stringify(row.attributes.aboutRole).includes('sales professional')))
  assert.equal(hasVerifiedOpeningsSignal(JSON.stringify(prototype)), false)
})
