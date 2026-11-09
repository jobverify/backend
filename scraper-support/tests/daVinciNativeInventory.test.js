import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { createDaVinciTradingScraper } from '../../scraper/davincitrading/script.js'
import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { daVinciNativeOptions, mutateDaVinciModel, daVinciTwoPageCapture } from './fixtures/daVinciNativeOptions.js'
const B = 'https://job-boards.eu.greenhouse.io/davinciderivatives'
const originalFetch = globalThis.fetch
before(() => { globalThis.fetch = async () => { throw Error('Unexpected implicit network request in captured Da Vinci regression') } })
after(() => { globalThis.fetch = originalFetch })
const execute = async (mutate = () => {}, extra = {}) => {
  const options = daVinciNativeOptions(mutate)
  return { jobs: await createDaVinciTradingScraper().run({ ...options, ...extra }), options }
}
test('Da Vinci replaces placeholder extraction with all current employer-bound native postings and complete India content', async () => {
  const { jobs, options } = await execute()
  assert.equal(jobs.length, 1)
  const job = jobs[0]
  assert.equal(job.jobId, '4046811101')
  assert.equal(job.requisitionId, '6')
  assert.equal(job.country, 'India')
  assert.equal(job.city, 'Mumbai')
  assert.equal(job.title, 'Experienced Quant')
  assert.equal(job.sourceUrl, 'https://davincitrading.com/job/quant-researcher-3/')
  assert.equal(job.applyUrl, B + '/jobs/4046811101')
  assert.equal(job.postingDate, '2022-11-14T10:13:07.000Z')
  assert.ok(job.sourceDescription.length > 2500)
  assert.match(job.sourceDescription, /Responsibilities[\s\S]*Requirements[\s\S]*Benefits/)
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(readInventoryEvidence(jobs)?.status, 'complete-inventory')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 15)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 1)
  assert.equal(options.calls.length, 36)
  assert.equal(options.calls.filter(call => /^https:\/\/job-boards\.eu\.greenhouse\.io\/davinciderivatives\/jobs\//.test(call.url)).length, 15)
  assert.ok(options.calls.every(call => call.method === 'GET'))
})

test('Da Vinci never substitutes corporate SEO dates or native update timestamps for original native publication', async () => {
  const { jobs } = await execute()
  assert.equal(jobs[0].sourceNativeDates.corporateDatePosted, '2025-04-23')
  assert.equal(jobs[0].sourceNativeDates.publishedAt, '2022-11-14T05:13:07-05:00')
  assert.match(jobs[0].sourceNativeDates.updatedAt, /^2026-10-21/)
  assert.equal(jobs[0].postingDate, '2022-11-14T10:13:07.000Z')
})

test('Da Vinci verifies current native employer and board account identities', async () => {
  await assert.rejects(execute(packet => {
    if (packet.name === 'initial-board') mutateDaVinciModel(packet, data => { data['routes/$url_token'].board.name = 'Another Employer' })
  }), /Da Vinci.*(?:employer|board|identity)/i)
})

test('Da Vinci rejects conflicting first-party structured posting and application handoff IDs', async () => {
  await assert.rejects(execute(packet => {
    if (packet.name === 'corporate-detail-11') packet.body = packet.body.replace('"value":"4046811101"', '"value":"9999999999"')
  }), /Da Vinci.*(?:identity|handoff|posting)/i)
})

test('Da Vinci rejects native internal-job identity conflicts with the board posting', async () => {
  await assert.rejects(execute(packet => {
    if (packet.name === 'native-detail-4046811101') mutateDaVinciModel(packet, data => { data['routes/$url_token_.jobs_.$job_post_id'].jobPost.hiring_plan_id = 1 })
  }), /Da Vinci.*(?:identity|posting)/i)
})

test('Da Vinci rejects a native application submit route for another posting', async () => {
  await assert.rejects(execute(packet => {
    if (packet.name === 'native-detail-4046811101') mutateDaVinciModel(packet, data => { data['routes/$url_token_.jobs_.$job_post_id'].submitPath = 'https://boards.eu.greenhouse.io/davinciderivatives/jobs/9999999999' })
  }), /Da Vinci.*(?:identity|application)/i)
})

test('Da Vinci keeps hidden native role content nullable and incomplete', async () => {
  const { jobs } = await execute(packet => {
    if (packet.name === 'native-detail-4046811101') packet.body = packet.body.replace('class="job__description body"', 'class="job__description body" style="opacity:0"')
  })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceDescription, null)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Da Vinci does not replace an empty native body with an introduction or a corporate description', async () => {
  const { jobs } = await execute(packet => {
    if (packet.name === 'native-detail-4046811101') mutateDaVinciModel(packet, data => {
      const job = data['routes/$url_token_.jobs_.$job_post_id'].jobPost
      job.content = ''; job.introduction = '<p>Welcome to Da Vinci, an international trading company.</p>'
    })
  })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceDescription, null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Da Vinci excludes an India role whose native closing update state changed during the scrape', async () => {
  const { jobs } = await execute(packet => {
    if (packet.name === 'closing-board') mutateDaVinciModel(packet, data => { data['routes/$url_token'].jobPosts.data.find(row => row.id === 4046811101).updated_at = '2026-10-26T17:00:00Z' })
  })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Da Vinci rejects an unfiltered-board contract that silently omits native postings', async () => {
  await assert.rejects(execute(packet => {
    if (packet.name === 'initial-board') mutateDaVinciModel(packet, data => { data['routes/$url_token'].jobPosts.total = 50 })
  }), /Da Vinci.*(?:pagination|count|inventory)/i)
})

test('Da Vinci retains partial scope for another recruiting board even when the link says Learn More', async () => {
  const { jobs } = await execute(packet => {
    if (packet.name === 'initial-careers' || packet.name === 'closing-careers') packet.body = packet.body.replace('</body>', '<a href="https://davinci.wd5.myworkdayjobs.com/Other">Learn More</a></body>')
  })
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Da Vinci registered execution preserves full native inventory evidence and posting identity', async () => {
  const jobs = await createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'davincitrading')).run(daVinciNativeOptions())
  assert.equal(jobs[0].jobId, '4046811101')
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 15)
})

test('Da Vinci propagates cancellation before any public request', async () => {
  const options = daVinciNativeOptions(), controller = new AbortController()
  controller.abort(Error('Da Vinci caller cancelled'))
  await assert.rejects(createDaVinciTradingScraper().run({ ...options, signal: controller.signal }), /caller cancelled/)
  assert.equal(options.calls.length, 0)
})

for (const [label, transform] of [
  ['conflicting active job ID', raw => raw.replace("var jobId = '4046811101'", "var jobId = '9999999999'")],
  ['commented-out loader', raw => '/*' + raw + '*/'],
]) test('Da Vinci rejects a raw fallback URL as handoff proof with ' + label, async () => {
  await assert.rejects(execute(packet => {
    if (packet.name === 'corporate-detail-11') packet.body = packet.body.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/g,
      (all, start, raw, end) => /var jobId = '4046811101'/.test(raw) ? start + transform(raw) + end : all)
  }), /Da Vinci.*(?:handoff|loader|application|identity)/i)
})

test('Da Vinci rejects a wrong native embed account even if the fallback URL still names the correct posting', async () => {
  await assert.rejects(execute(packet => {
    if (packet.name === 'corporate-detail-11') packet.body = packet.body.replace('job_board/js?for=davinciderivatives', 'job_board/js?for=otheremployer')
  }), /Da Vinci.*(?:handoff|employer|board|identity)/i)
})

test('Da Vinci rejects a visible native country that conflicts with the native job model', async () => {
  await assert.rejects(execute(packet => {
    if (packet.name === 'native-detail-4046811101') packet.body = packet.body.replace('</svg><div>Mumbai, Maharashtra, India</div>', '</svg><div>London, United Kingdom</div>')
  }), /Da Vinci.*(?:location|geograph|country)/i)
})

test('Da Vinci selects the explicit India segment without relabelling a foreign city as India', async () => {
  const { jobs } = await execute(packet => { packet.body = packet.body.replaceAll('Mumbai, Maharashtra, India', 'London, United Kingdom / Mumbai, Maharashtra, India') })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].city, 'Mumbai')
  assert.equal(jobs[0].location, 'Mumbai, Maharashtra, India')
})

test('Da Vinci cannot certify India when current listing and detail location fields say only Remote', async () => {
  const { jobs } = await execute(packet => {
    packet.body = packet.body.replaceAll('Mumbai, Maharashtra, India', 'Remote')
    if (packet.name === 'corporate-detail-11') packet.body = packet.body.replace(/("addressCountry"\s*:\s*")India(")/, '$1$2')
  })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Da Vinci rejects a contradictory explicit native country field', async () => {
  await assert.rejects(execute(packet => {
    if (packet.name === 'native-detail-4046811101') mutateDaVinciModel(packet, data => { data['routes/$url_token_.jobs_.$job_post_id'].jobPost.countryCode = 'US' })
  }), /Da Vinci.*country/i)
})

test('Da Vinci enumerates all 51 native postings across two pages and retains the unmatched corporate scope as partial', async () => {
  const options = daVinciNativeOptions(() => {}, daVinciTwoPageCapture())
  const jobs = await createDaVinciTradingScraper().run(options)
  assert.equal(jobs.length, 1)
  assert.equal(options.calls.filter(call => call.url === B + '?page=2').length, 2)
  assert.equal(options.calls.filter(call => call.url.startsWith(B + '/jobs/')).length, 51)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Da Vinci reads every role and closing page before applying a requested India output cap', async () => {
  const { jobs, options } = await execute(packet => {
    packet.body = packet.body.replaceAll('Miami', 'Mumbai').replaceAll('Florida', 'Maharashtra').replaceAll('United States', 'India')
  }, { maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(options.calls.length, 36)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('Da Vinci does not ignore a real recruiting URL substituted into the malformed privacy control', async () => {
  const { jobs } = await execute(packet => {
    if (packet.name === 'native-detail-4046811101') packet.body = packet.body.replaceAll('href="For more information, please see the Privacy Statement"', 'href="https://other.wd5.myworkdayjobs.com/Jobs"')
  })
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
