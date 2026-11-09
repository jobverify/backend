import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { isFreshCompleteInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261107/current-next-and-smartrecruiters.json.gz', import.meta.url))))
const provider = getScraperCatalog().find(row => row.source === 'checkpointindia')
const currentUrl = 'https://careers.checkpoint.com/jobs'
const apiPrefix = 'https://api.smartrecruiters.com/v1/companies/CheckPointSoftwareTechnologies2/postings'
const listings = JSON.parse(fixture[2].body)
const mutateNext = (html, mutate) => html.replace(/(<script\b[^>]*\bid="__NEXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/, (_all, start, json, end) => {
  const data = JSON.parse(json)
  mutate(data.props.pageProps)
  return start + JSON.stringify(data).replace(/</g, '\\u003c') + end
})

function replay({ pageMutation, detailMutation, listingMutation, closingMutation, closePageMutation } = {}) {
  const calls = [], counts = new Map()
  const options = {
    async fetchPage(url) {
      calls.push(url)
      if (url === 'https://www.checkpoint.com/careers/') return { status: 200, url, html: fixture[0].body }
      const close = url === currentUrl
      assert.ok(close || url.includes('fa[]=country_s:India'), 'unexpected native page request: ' + url)
      let html = fixture[1].body
      if (close && closePageMutation) html = mutateNext(html, closePageMutation)
      else if (pageMutation) html = mutateNext(html, pageMutation)
      return { status: 200, url: currentUrl, html }
    },
    async fetchJson(url) {
      calls.push(url)
      counts.set(url, (counts.get(url) || 0) + 1)
      const packet = fixture.find(row => row.requestUrl === url)
      assert.ok(packet, 'unexpected native API request: ' + url)
      const payload = JSON.parse(packet.body)
      if (Array.isArray(payload.content)) {
        listingMutation?.(payload)
        if (counts.get(url) > 1) closingMutation?.(payload)
      } else detailMutation?.(payload)
      return payload
    },
  }
  // The previous implementation accepts only fetchText. Keep the regression
  // entirely offline while exercising that old failure before the repair.
  options.fetchText = async url => (await options.fetchPage(url)).html
  return { options, calls }
}

test('registered source follows the current native Next.js handoff and closes all 11 India roles', async () => {
  const { options, calls } = replay()
  const jobs = await createCatalogScraper(provider).run(options)
  assert.equal(jobs.length, 11)
  assert.deepEqual(jobs.map(job => job.jobId).sort(), listings.content.map(job => job.id).sort())
  assert.ok(jobs.every(job => job.country === 'India' && job.jobDescription.length > 100))
  assert.ok(jobs.every(job => job.lifecycleCleanupAllowed === false))
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(jobs)), true)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 11)
  assert.equal(calls.filter(url => url.startsWith(apiPrefix + '?')).length, 2)
  assert.ok(calls.includes(currentUrl))
})

for (const [name, mutation] of [
  ['foreign canonical host', page => { page.__canonical = 'https://foreign.example/jobs' }],
  ['foreign native ATS board', page => { page.result.jobPostingsList[0].applyUrl = page.result.jobPostingsList[0].applyUrl.replace('CheckPointSoftwareTechnologies2', 'AnotherEmployer') }],
  ['native India count mismatch', page => { page.result.facetsList.country_s.find(row => row.facetValue === 'India').count++ }],
  ['non-default native filter', page => { page.queryState.filters = { country_s: ['United States'] } }],
]) test('current native handoff rejects ' + name, async () => {
  const { options } = replay({ pageMutation: mutation })
  await assert.rejects(createCatalogScraper(provider).run(options), /Check Point current/)
})

for (const [name, mutation] of [
  ['foreign detail country', detail => { detail.location.country = 'us' }],
  ['wrong detail identity', detail => { detail.id += '1' }],
  ['withdrawn detail', detail => { detail.active = false }],
  ['foreign apply authority', detail => { detail.applyUrl = 'https://foreign.example/apply' }],
  ['missing full description', detail => { detail.jobAd.sections.jobDescription.text = '' }],
]) test('current native inventory rejects ' + name, async () => {
  const { options } = replay({ detailMutation: mutation })
  await assert.rejects(createCatalogScraper(provider).run(options), /Check Point current/)
})

test('a changing closing API inventory cannot establish completion', async () => {
  const { options } = replay({ closingMutation: payload => { payload.content[0].name += ' changed' } })
  await assert.rejects(createCatalogScraper(provider).run(options), /Check Point current.*closing/i)
})

test('a changing closing native page cannot establish completion', async () => {
  const { options } = replay({ closePageMutation: page => { page.result.jobPostingsList[0].title += ' changed' } })
  await assert.rejects(createCatalogScraper(provider).run(options), /Check Point current.*closing/i)
})

test('a caller cap retains observed roles and marks inventory incomplete', async () => {
  const { options } = replay()
  const jobs = await createCatalogScraper(provider).run({ ...options, maxJobs: 2 })
  assert.equal(jobs.length, 2)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
