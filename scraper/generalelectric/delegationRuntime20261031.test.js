import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'

import { createGeneralElectricScraper, GE_CAREERS_HUB_URL } from './script.js'
import { readInventoryDelegationEvidence } from '../../scraper-support/utils/inventoryDelegationEvidence.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const capture = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/faq-delegation-20261031.json.gz', import.meta.url))))
const packet = () => structuredClone(capture.packets[0])
const children = [
  ['geaerospace', 'GE Aerospace'], ['gevernova', 'GE Vernova'], ['gehealthcare', 'GE HealthCare'],
]
const setup = ({ mutatePage, childRun } = {}) => {
  const events = [], lists = children.map(([source, company]) => [{ source, company, title: source + ' controlled offline role', sourceListingComplete: false }])
  const scraper = createGeneralElectricScraper(Object.fromEntries(children.map(([source], index) => [
    ['geAerospaceRun', 'geVernovaRun', 'geHealthCareRun'][index], async options => {
      events.push(source)
      return childRun ? childRun({ source, index, options, lists }) : lists[index]
    },
  ])))
  return { scraper, lists, events, options: { fetchPage: async (url, { signal } = {}) => {
    assert.equal(url, GE_CAREERS_HUB_URL)
    signal?.throwIfAborted()
    events.push('faq')
    const page = packet()
    mutatePage?.(page)
    return page
  } } }
}

test('GE rechecks the authentic FAQ before each independent child and retains every child identity', async () => {
  const f = setup(), jobs = await f.scraper.run(f.options)
  assert.deepEqual(f.events, ['faq', 'geaerospace', 'gevernova', 'gehealthcare'])
  assert.deepEqual(jobs, f.lists.flat())
  assert.equal(jobs[0], f.lists[0][0])
  const proof = readInventoryDelegationEvidence(jobs)
  assert.equal(proof.source, 'generalelectric')
  assert.deepEqual(proof.sources, ['geaerospace', 'gevernova', 'gehealthcare'])
  assert.equal(proof.preservesChildSourceAndCompany, true)
  assert.equal(proof.verifiedAt, '2026-10-31T08:05:18.927Z')
  assert.equal(proof.evidence.url, GE_CAREERS_HUB_URL)
  assert.deepEqual(proof.evidence.responses, [{ url: GE_CAREERS_HUB_URL, finalUrl: GE_CAREERS_HUB_URL,
    status: 200, sha256: '6a04f551c326ba16c61eb075458d9a79fbe776a8140e0ba9f779f08187078c5f' }])
  const inventory = readInventoryEvidence(jobs)
  assert.equal(inventory.status, 'coverage-gap')
  assert.equal(inventory.listingComplete, false)
  assert.equal(inventory.reportedTotal, null)
  assert.equal(inventory.indiaFacetCount, null)
  await f.scraper.run(f.options)
  assert.equal(f.events.filter(event => event === 'faq').length, 2)
})

for (const [name, mutatePage] of [
  ['unavailable HTTP', page => { page.status = 403 }],
  ['foreign final URL', page => { page.finalUrl = 'https://example.invalid/faq' }],
  ['non-HTML MIME', page => { page.headers['content-type'] = 'text/plain' }],
  ['canonical employer mismatch', page => { page.body = page.body.replace('rel="canonical" href="https://www.ge.com/faq"', 'rel="canonical" href="https://example.invalid/faq"') }],
  ['hidden native page', page => { page.body = '<div hidden>' + page.body + '</div>' }],
  ['inert native page', page => { page.body = '<div inert>' + page.body + '</div>' }],
  ['comment-only native page', page => { page.body = '<!--' + page.body.replaceAll('-->', '') + '-->' }],
  ['missing independent-company semantics', page => { page.body = page.body.replaceAll('independent and publicly traded companies', 'subsidiaries of a single employer') }],
  ['foreign Aerospace career handoff', page => { page.body = page.body.replaceAll('https://jobs.gecareers.com/aviation/global/en/', 'https://example.invalid/aviation/global/en/') }],
  ['missing HealthCare authored career handoff', page => { page.body = page.body.replaceAll('http://careers.gehealthcare.com/global/en', 'http://example.invalid/global/en') }],
  ['hidden career FAQ despite intact independent-company identity', page => {
    const block = page.body.split('\n').find(line => line.startsWith('<div class="wp-block-custom-ge-faq-item"') && line.includes('Where can I view jobs at GE?'))
    assert.ok(block)
    page.body = page.body.replace(block, block.replace('<div class=', '<div hidden class='))
  }],
  ['template-only career FAQ despite matching JSON metadata', page => {
    const block = page.body.split('\n').find(line => line.startsWith('<div class="wp-block-custom-ge-faq-item"') && line.includes('Where can I view jobs at GE?'))
    assert.ok(block)
    page.body = page.body.replace(block, '<template>' + block + '</template>')
  }],
]) test('GE rejects ' + name + ' before invoking any child', async () => {
  const f = setup({ mutatePage })
  await assert.rejects(f.scraper.run(f.options), /GE current recruiting relationship|General Electric current/i)
  assert.deepEqual(f.events, ['faq'])
})

for (const [field, value] of [['company', 'General Electric'], ['source', 'generalelectric']]) {
  test('GE cannot attach proof after a child changes its ' + field, async () => {
    const f = setup({ childRun: ({ index, lists }) => lists[index].map(row => ({ ...row, ...(index === 1 ? { [field]: value } : {}) })) })
    await assert.rejects(f.scraper.run(f.options), /child.*identity|child.*attribution/i)
  })
}

test('GE caller cancellation prevents the FAQ and children from being invoked', async () => {
  const f = setup(), reason = Error('caller stopped GE')
  await assert.rejects(f.scraper.run({ ...f.options, signal: AbortSignal.abort(reason) }), error => error === reason)
  assert.deepEqual(f.events, [])
})

test('GE cancellation during the FAQ cannot become successful child inventories', async () => {
  const controller = new AbortController(), reason = Error('stop native FAQ'), f = setup({ mutatePage: () => controller.abort(reason) })
  await assert.rejects(f.scraper.run({ ...f.options, signal: controller.signal }), error => error === reason)
  assert.deepEqual(f.events, ['faq'])
})

test('GE cancellation inside a child cannot return a successful delegation', async () => {
  const controller = new AbortController(), reason = Error('stop GE child'), f = setup({ childRun: ({ index, lists }) => {
    controller.abort(reason)
    return lists[index]
  } })
  await assert.rejects(f.scraper.run({ ...f.options, signal: controller.signal }), error => error === reason)
})

for (const [name, mutatePage] of [
  ['untimed legacy packet', page => { delete page.capturedAt }],
  ['future packet clock', page => { page.capturedAt = '2999-01-01T00:00:00Z' }],
  ['invalid packet clock', page => { page.capturedAt = 'unknown' }],
]) test('GE ' + name + ' cannot mint a current relationship observation', async () => {
  const f = setup({ mutatePage }), jobs = await f.scraper.run(f.options)
  assert.equal(jobs.length, 3)
  assert.equal(readInventoryDelegationEvidence(jobs), null)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})

test('GE cap retains child company/source and never certifies aggregate inventory', async () => {
  const f = setup(), jobs = await f.scraper.run({ ...f.options, maxJobs: 2 })
  assert.deepEqual(jobs.map(row => [row.source, row.company]), [['geaerospace', 'GE Aerospace'], ['gevernova', 'GE Vernova']])
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})

test('GE hashes the actual validated native response rather than trusting a supplied digest', async () => {
  const f = setup({ mutatePage: page => { page.sha256 = '0'.repeat(64) } }), jobs = await f.scraper.run(f.options)
  assert.equal(readInventoryDelegationEvidence(jobs).evidence.responses[0].sha256, '6a04f551c326ba16c61eb075458d9a79fbe776a8140e0ba9f779f08187078c5f')
})
