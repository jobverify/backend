import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { run, JOBS_URL } from './script.js'

const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url)))
const receipts = [...fixture('official-responses'), fixture('native-company'), fixture('native-jobs'), ...fixture('native-details').responses]
const runWithBoard = transform => run({
  maxJobs: 8,
  now: () => '2026-10-23T06:20:00.000Z',
  fetchImpl: async url => {
    const row = receipts.find(item => item.url === url)
    assert.ok(row, 'Uncaptured URL ' + url)
    return { status: row.status, url: row.finalUrl, text: async () => url === JOBS_URL ? transform(row.body) : row.body }
  },
})

test('RenewBuy recovers independently verified partial roles when optional ItemList is absent', async () => {
  const jobs = await runWithBoard(html => {
    const doc = document(html)
    for (const node of doc.nodes(n => n.tag === 'script' && n.attrs.type === 'application/ld+json')) {
      if (JSON.parse(node.raw)['@type'] === 'ItemList') html = html.replace(doc.outer(node), '')
    }
    return html
  })
  assert.deepEqual(jobs.map(job => job.jobId).sort(), ['4457850766', '4457853673', '4457854693', '4457857705', '4457863691', '4457863692', '4457866682'])
  assert.ok(jobs.every(job => job.country === 'India' && job.company === 'RenewBuy'))
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('RenewBuy still rejects duplicate structured inventories', async () => {
  await assert.rejects(runWithBoard(html => {
    const doc = document(html)
    const node = doc.nodes(n => n.tag === 'script' && n.attrs.type === 'application/ld+json').find(n => JSON.parse(n.raw)['@type'] === 'ItemList')
    return html + doc.outer(node)
  }), /ambiguous structured native inventory/)
})
