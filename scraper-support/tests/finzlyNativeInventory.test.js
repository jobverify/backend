import assert from 'node:assert/strict'
import test from 'node:test'
import { createFinzlyScraper } from '../../scraper/finzly/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { finzlyCapture, finzlyNativeOptions } from './fixtures/finzlyNativeOptions.js'
const execute = async (mutate = () => {}, extra = {}) => {
  const options = finzlyNativeOptions(finzlyCapture(), mutate)
  return { jobs: await createFinzlyScraper({ now: options.now }).run({ ...options, ...extra }), options }
}
const jsonBody = (packet, change) => { const value = JSON.parse(packet.body); change(value); packet.body = JSON.stringify(value) }

test('Finzly follows current first-party role cards and full descriptions instead of the retired Workable zero', async () => {
  const { jobs, options } = await execute()
  assert.equal(jobs.length, 12)
  assert.equal(new Set(jobs.map(job => job.jobId)).size, 12)
  assert.ok(jobs.every(job => job.company === 'Finzly' && job.country === 'India' && job.sourceDetailComplete === true))
  assert.ok(jobs.every(job => job.sourceDescription.length > 1000 && job.postingDate === null))
  assert.ok(jobs.every(job => job.sourceListingComplete === false && job.lifecycleCleanupAllowed === false))
  assert.ok(jobs.every(job => job.applyUrl === 'mailto:careers@finzly.com' && job.sourceUrl.startsWith('https://finzly.com/careers/')))
  const first = jobs.find(job => job.jobId === '8189')
  assert.match(first.sourceDescription, /Design Patterns[\s\S]*Knowledge of Credit products[\s\S]*Apply/)
  assert.doesNotMatch(first.sourceDescription, /Schedule a Demo|Finzly BankOS|\[vc_/)
  assert.deepEqual(first.locations, ['Chennai, India', 'Pune, India'])
  assert.deepEqual(jobs.find(job => job.jobId === '8203').locations, ['Chennai, India', 'Pune, India'])
  assert.deepEqual(jobs.find(job => job.jobId === '8212').locations, ['Chennai, India'])
  assert.equal(jobs.find(job => job.jobId === '8236').remoteStatus, 'Remote')
  assert.ok(options.calls.every(url => !url.includes('workable')))
  assert.equal(options.calls.filter(url => /\/wp-json\/wp\/v2\/pages\/\d+$/.test(url)).length, 14)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /published-career-pages-not-advertised/)
  assert.equal(first.sourcePublishedCareerPageCount, 17)
  assert.equal(first.sourceNativeForeignOfficeEvidence.country, 'US')
  assert.doesNotMatch(readInventoryEvidence(jobs).reason, /unresolved:11784/)
})

test('Finzly keeps WordPress document dates separate from unavailable job posting dates', async () => {
  const { jobs } = await execute()
  const first = jobs.find(job => job.jobId === '8189')
  assert.equal(first.postingDate, null)
  assert.equal(first.sourcePublicationDateUnavailable, true)
  assert.equal(first.sourceNativePageDates.createdGMT, '2026-03-18T05:53:56')
  assert.equal(first.sourceNativePageDates.modifiedGMT, '2026-05-14T18:23:46')
  assert.equal(first.requisitionId, null)
})

test('Finzly enumerates every native detail before applying caller output limits', async () => {
  const { jobs, options } = await execute(() => {}, { maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(options.calls.filter(url => /\/wp-json\/wp\/v2\/pages\/\d+$/.test(url)).length, 14)
  assert.match(readInventoryEvidence(jobs).reason, /source-job-limit/)
})

test('Finzly rejects a changed current filtering client instead of guessing inventory scope', async () => {
  await assert.rejects(execute(packet => { if (packet.url.includes('/assets/js/app.js')) packet.body += '\n// changed client' }), /Finzly.*client/i)
})

test('Finzly retains independently bound native roles when the optional Yoast REST plugin metadata disappears', async () => {
  const { jobs } = await execute(packet => {
    if (/\/wp-json\/wp\/v2\/pages\/\d+$/.test(packet.url)) jsonBody(packet, value => { delete value.yoast_head_json })
  })
  assert.equal(jobs.length, 12)
  assert.ok(jobs.every(job => job.sourceDetailComplete === true && job.country === 'India'))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

for (const [label, change] of [
  ['native page ID', value => { value.id = 999999 }],
  ['native role URL', value => { value.link = 'https://other.example/role/' }],
  ['native parent', value => { value.parent = 999999 }],
  ['native title', value => { value.title.rendered = 'Other Role' }],
  ['native employer', value => { value.yoast_head_json.og_site_name = 'Other Company' }],
]) test(`Finzly rejects conflicting ${label}`, async () => {
  await assert.rejects(execute(packet => { if (packet.url.endsWith('/pages/8189')) jsonBody(packet, change) }), /Finzly.*identity/i)
})

test('Finzly retains healthy roles when a native page is no longer published', async () => {
  const { jobs } = await execute(packet => { if (packet.url.endsWith('/pages/8189')) jsonBody(packet, value => { value.status = 'draft' }) })
  assert.equal(jobs.length, 11)
  assert.ok(!jobs.some(job => job.jobId === '8189'))
  assert.match(readInventoryEvidence(jobs).reason, /published|unavailable/)
})

test('Finzly cannot publish a stylesheet-hidden full native description', async () => {
  const { jobs } = await execute(packet => {
    if (packet.url.endsWith('/senior-full-stack-engineer/')) packet.body = packet.body.replace('</head>', '<style>.vc_custom_1773078699074~.review-hidden{display:none}</style><style>#review-hidden{display:none}</style></head>')
      .replace('<h2 class="fusion-responsive-typography-calculated"', '<span id="review-hidden"><h2 class="fusion-responsive-typography-calculated"')
  })
  assert.ok(!jobs.some(job => job.jobId === '8189'))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Finzly does not substitute a truncated native description for the current full visible role', async () => {
  const { jobs } = await execute(packet => { if (packet.url.endsWith('/pages/8189')) jsonBody(packet, value => { value.content.rendered = value.content.rendered.replace('Knowledge of Credit products', 'Removed native section') }) })
  assert.equal(jobs.length, 11)
  assert.ok(!jobs.some(job => job.jobId === '8189'))
})

test('Finzly excludes a role whose location changes in the closing advertised inventory', async () => {
  const { jobs } = await execute((packet, index) => {
    if (packet.url === 'https://finzly.com/careers/' && index === 1) packet.body = packet.body.replace(
      /(class="c-finzly-open-roles__role-location"[^>]*>\s*)India \u2013 Chennai\/Pune/, '$1USA - Remote')
  })
  assert.equal(jobs.length, 11)
  assert.ok(!jobs.some(job => job.jobId === '8189'))
  assert.match(readInventoryEvidence(jobs).reason, /closing/)
})

test('Finzly does not derive India work scope from the company biography', async () => {
  const { jobs } = await execute(packet => {
    if (packet.url.endsWith('/senior-full-stack-engineer/')) packet.body = packet.body.replace('>India – Chennai/Pune</p>', '>USA - Remote</p>')
  })
  assert.equal(jobs.length, 11)
  assert.ok(!jobs.some(job => job.jobId === '8189'))
})

test('Finzly honors cancellation before a public request', async () => {
  await assert.rejects(execute(() => {}, { signal: AbortSignal.abort(new Error('source cancelled')) }), /source cancelled/)
})

test('Finzly excludes a role removed from the closing published-page collection despite a stale advertised card', async () => {
  const { jobs } = await execute((packet, index) => {
    if (packet.url.includes('/wp-json/wp/v2/pages?') && index === 1) {
      packet.body = JSON.stringify(JSON.parse(packet.body).filter(row => row.id !== 8189))
      packet.wpTotal = '16'
    }
  })
  assert.equal(jobs.length, 11)
  assert.ok(!jobs.some(job => job.jobId === '8189'))
  assert.match(readInventoryEvidence(jobs).reason, /closing-native-page-state-changed:8189/)
})

test('Finzly cannot prove Charlotte country from a hidden or mismatching office address', async () => {
  const { jobs } = await execute(packet => {
    if (packet.url === 'https://finzly.com/contact/') packet.body = packet.body.replace('Charlotte, NC 28217 USA', 'Different office address')
  })
  assert.equal(jobs.length, 12)
  assert.match(readInventoryEvidence(jobs).reason, /native-country-scope-unresolved:11784/)
  assert.ok(jobs.every(job => job.sourceNativeForeignOfficeEvidence === null))
})

test('Finzly fully paginates native published career pages without treating extra pages as advertised vacancies', async () => {
  const fixture = finzlyCapture(), base = 'https://finzly.com/wp-json/wp/v2/pages?parent=7713&per_page=100'
  for (const packet of fixture.packets.filter(packet => packet.url === base)) {
    const originals = JSON.parse(packet.body), additional = Array.from({ length: 100 }, (_, index) => {
      const copy = structuredClone(originals[0])
      copy.id = 100000 + index; copy.slug = 'unadvertised-native-page-' + index; copy.link = 'https://finzly.com/careers/' + copy.slug + '/'
      return copy
    }), rows = [...originals, ...additional]
    packet.body = JSON.stringify(rows.slice(0, 100)); packet.wpTotal = '117'; packet.wpTotalPages = '2'
    fixture.packets.push({ ...packet, url: base + '&page=2', finalUrl: base + '&page=2', body: JSON.stringify(rows.slice(100)) })
  }
  const options = finzlyNativeOptions(fixture), jobs = await createFinzlyScraper({ now: options.now }).run(options)
  assert.equal(jobs.length, 12)
  assert.ok(jobs.every(job => job.sourcePublishedCareerPageCount === 117))
  assert.equal(options.calls.filter(url => url === base + '&page=2').length, 2)
  assert.equal(options.calls.filter(url => /\/pages\/\d+$/.test(url)).length, 14)
})

test('Finzly rejects an unpublished closing page instead of treating it as an optional collection outage', async () => {
  await assert.rejects(execute((packet, index) => {
    if (packet.url.includes('/wp-json/wp/v2/pages?') && index === 1) jsonBody(packet, rows => { rows.find(row => row.id === 8189).status = 'draft' })
  }), /published-page.*unpublished/i)
})
