import assert from 'node:assert/strict'
import test from 'node:test'
import { run } from '../../scraper/civicaindia/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { civicaCapture, civicaNativeOptions } from './fixtures/civicaNativeOptions.js'
const execute = async (mutate = () => {}, extra = {}) => {
  const fixture = civicaCapture(), options = civicaNativeOptions(fixture, mutate)
  return { jobs: await run({ ...options, ...extra }), options, fixture }
}
const changeJson = (packet, mutate) => { const data = JSON.parse(packet.body); mutate(data); packet.body = JSON.stringify(data) }

test('Civica follows its current employer-selected tenant and returns all15 native India full details rather than historical zero', async () => {
  const { jobs, options, fixture } = await execute()
  assert.equal(jobs.length, 15)
  assert.equal(new Set(jobs.map(job => job.jobId)).size, 15)
  assert.ok(jobs.every(job => job.company === 'Civica' && job.country === 'India' && job.sourceDetailComplete === true))
  assert.ok(options.calls.every(call => call.url !== 'https://apply.workable.com/civica/llms.txt'))
  assert.equal(options.calls.filter(call => call.url.includes('/api/v3/')).length, 12)
  assert.equal(options.calls.filter(call => call.url.includes('/api/v2/')).length, 30)
  for (const job of jobs) {
    const detail = JSON.parse(fixture.packets.find(p => p.url.endsWith('/jobs/' + job.jobId)).body)
    assert.equal(job.postingDate, new Date(detail.published).toISOString())
    assert.equal(job.nativeEmployerBrand, 'Civica')
    assert.equal(job.sourceNativeEmployerEvidence.accountUid, '8433007d-b16d-4cd7-bd7d-a8cd3a8ebff3')
    assert.equal(job.sourceNativeDescriptionSections.description, detail.description)
    assert.ok(job.sourceDescription.length > 1000)
    assert.equal(job.applyUrl, `https://apply.workable.com/civica-uk-ltd-1/j/${job.jobId}/apply/`)
  }
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 53)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 15)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

for (const [label, mutate] of [
  ['wrong account', value => { value.uid = 'other' }],
  ['wrong native employer', value => { value.name = 'Civica India Staffing' }],
  ['wrong reciprocal website route', value => { value.url = 'https://www.civica.com/other/' }],
  ['foreign reciprocal website', value => { value.url = 'https://other.example/en-gb/' }],
]) test(`Civica rejects ${label}`, async () => {
  await assert.rejects(execute(packet => { if (packet.url.includes('/api/v1/')) changeJson(packet, mutate) }), /identity|website|account|employer/i)
})

for (const [label, change] of [
  ['retired tenant', html => html.replaceAll('https://apply.workable.com/civica-uk-ltd-1/', 'https://apply.workable.com/civica/')],
  ['hidden handoff', html => html.replace(/<a(?=[^>]*href="https:\/\/apply\.workable\.com\/civica-uk-ltd-1\/)/g, '<a hidden')],
  ['stylesheet-hidden handoff', html => html.replace('</head>', '<style>a[href]{display:none}</style></head>')],
]) test(`Civica cannot bind a ${label}`, async () => {
  await assert.rejects(execute(packet => { if (packet.url.includes('www.civica.com/en-in/')) packet.body = change(packet.body) }), /handoff/i)
})

test('Civica checks all initial and closing cursor pages and India details before a caller output cap', async () => {
  const { jobs, options } = await execute(() => {}, { maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(options.calls.filter(call => call.url.includes('/api/v3/')).length, 12)
  assert.equal(options.calls.filter(call => call.url.includes('/api/v2/')).length, 30)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('Civica drops a role whose native publication date changes in the closing snapshot', async () => {
  const { jobs, fixture } = await execute((packet, index) => {
    if (index !== 1 || !/\/api\/v[23]\//.test(packet.url)) return
    changeJson(packet, value => {
      const rows = value.results || [value]
      for (const row of rows) if (row.shortcode === 'B55E557FEF') row.published = new Date(Date.parse(row.published) - 1000).toISOString()
    })
  })
  assert.equal(jobs.length, 14)
  assert.ok(!jobs.some(job => job.jobId === 'B55E557FEF'))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /closing/)
})

test('Civica cannot publish a native description hidden by CSS', async () => {
  const { jobs } = await execute(packet => {
    if (packet.url.endsWith('/jobs/B55E557FEF')) changeJson(packet, value => {
      value.description = `<style>#hidden-description{display:none}</style><div id="hidden-description">${value.description}</div>`
    })
  })
  assert.equal(jobs.length, 14)
  assert.ok(!jobs.some(job => job.jobId === 'B55E557FEF'))
  assert.match(readInventoryEvidence(jobs).reason, /description/)
})

test('Civica cannot substitute a challenge page for current corporate authority', async () => {
  await assert.rejects(execute(packet => {
    if (packet.url.includes('www.civica.com/en-in/')) { packet.status = 403; packet.body = '<title>Just a moment...</title>challenges.cloudflare.com noindex,nofollow' }
  }), /first-party|unavailable/i)
})

test('Civica honors cancellation before requesting a public endpoint', async () => {
  await assert.rejects(execute(() => {}, { signal: AbortSignal.abort(new Error('source cancelled')) }), /source cancelled/)
})
