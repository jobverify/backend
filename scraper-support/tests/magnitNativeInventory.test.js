import assert from 'node:assert/strict'
import test from 'node:test'
import { createMagnitGlobalScraper } from '../../scraper/magnitglobal/script.js'
import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { magnitNativeOptions, magnitDayforceIndiaRole, magnitDirectIndiaRole, magnitTwoPageCapture } from './fixtures/magnitNativeOptions.js'
const C = 'https://magnitglobal.com/about/careers'
const execute = async (mutate = () => {}, extra = {}) => {
  const options = magnitNativeOptions(mutate)
  return { jobs: await createMagnitGlobalScraper().run({ ...options, ...extra }), options }
}
test('Magnit reconciles all advertised locales and both native systems before establishing zero current India postings', async () => {
  const { jobs, options } = await execute(), evidence = readInventoryEvidence(jobs)
  assert.equal(jobs.length, 0)
  assert.ok(evidence, 'Bare empty results cannot establish complete native inventory')
  assert.equal(evidence.status, 'complete-inventory')
  assert.equal(evidence.reportedTotal, 9)
  assert.equal(evidence.indiaFacetCount, 0)
  const searches = options.calls.filter(call => call.method === 'POST')
  assert.equal(searches.length, 10)
  assert.equal(new Set(searches.map(call => JSON.parse(call.body).cultureCode)).size, 5)
  assert.ok(searches.every(call => !Object.hasOwn(JSON.parse(call.body), 'location')))
  assert.equal(options.calls.filter(call => /\/api\/geo\/prounlimited\/jobposting\/prounlimited\//.test(call.url)).length, 5)
  assert.equal(options.calls.filter(call => /\/eu\/magnitglobal\/jobs\/\d+-/.test(call.url)).length, 4)
  assert.ok(options.calls.every(call => call.method === 'GET' || call.url.endsWith('/jobposting/search')))
})
test('Magnit extracts a future explicit India Dayforce posting with full nested header/body/footer and native requisition/date', async () => {
  const { jobs } = await execute(magnitDayforceIndiaRole)
  assert.equal(jobs.length, 1)
  const job = jobs[0]
  assert.equal(job.jobId, '7493')
  assert.equal(job.requisitionId, '2796')
  assert.equal(job.country, 'India')
  assert.equal(job.city, 'Bengaluru')
  assert.equal(job.postingDate, '2026-10-08T10:00:00.000Z')
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.sourceNativeDescriptionFragmentCount, 3)
  assert.match(job.sourceDescription, /Who We Are[\s\S]*Magnit/)
  assert.ok(job.sourceDescription.length > 3000)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 1)
})
test('Magnit cannot substitute company header/footer for a missing native role body', async () => {
  const { jobs } = await execute(packet => {
    magnitDayforceIndiaRole(packet)
    const emptyBody = raw => { const value = JSON.parse(raw); value.jobPostingContent.jobDescription = ''; return JSON.stringify(value) }
    if (packet.name === 'dayforce-detail-7493') packet.body = emptyBody(packet.body)
    if (packet.name === 'dayforce-page-7493') packet.body = packet.body.replace(/(<script\b[^>]*id="__NEXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/,
      (all, start, raw, end) => { const next = JSON.parse(raw); for (const query of next.props.pageProps.dehydratedState.queries) if (query.state.data?.jobPostingId === 7493) query.state.data.jobPostingContent.jobDescription = ''; return start + JSON.stringify(next) + end })
  })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
test('Magnit rejects a changed native Dayforce employer account', async () => {
  await assert.rejects(execute(packet => { if (packet.name.includes('dayforce-board')) packet.body = packet.body.replaceAll('"clientId":80745', '"clientId":999999') }), /Magnit.*(?:account|employer|identity)/i)
})
test('Magnit rejects mismatching native job/requisition identity instead of using a search summary', async () => {
  await assert.rejects(execute(packet => { if (packet.name === 'dayforce-detail-7493') { const value = JSON.parse(packet.body); value.jobReqId = 999999; packet.body = JSON.stringify(value) } }), /Magnit.*(?:identity|requisition)/i)
})
test('Magnit rejects native pagination totals that do not reconcile', async () => {
  await assert.rejects(execute(packet => { if (packet.name === 'initial-search-en-US-0') { const value = JSON.parse(packet.body); value.maxCount = 100; packet.body = JSON.stringify(value) } }), /Magnit.*(?:pagination|count|inventory)/i)
})
test('Magnit treats a location without an authoritative country as unresolved rather than foreign', async () => {
  const { jobs } = await execute(packet => {
    if (packet.name === 'dayforce-detail-7493') { const value = JSON.parse(packet.body); value.postingLocations[0].isoCountryCode = ''; packet.body = JSON.stringify(value) }
  })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
test('Magnit rejects another employer in DirectSource structured job metadata', async () => {
  await assert.rejects(execute(packet => { if (packet.name === 'directsource-detail-0') packet.body = packet.body.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/,
    (all, start, raw, end) => { const value = JSON.parse(raw); value.hiringOrganization.name = 'Other Employer'; return start + JSON.stringify(value) + end }) }), /Magnit.*(?:employer|identity)/i)
})
test('Magnit rejects a DirectSource application for another posting', async () => {
  await assert.rejects(execute(packet => { if (packet.name === 'directsource-detail-0') packet.body = packet.body.replace('job-apply/view?id=434', 'job-apply/view?id=403') }), /Magnit.*(?:application|identity)/i)
})
test('Magnit does not interpret the Poland Remote posting as India', async () => {
  const { jobs, options } = await execute()
  assert.equal(jobs.length, 0)
  assert.ok(options.calls.some(call => call.url.includes('403-business-consultant-fabric-remote')))
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
})
test('Magnit registered execution preserves current native inventory evidence', async () => {
  const jobs = await createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'magnitglobal')).run(magnitNativeOptions())
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 9)
})
test('Magnit propagates caller cancellation before public session bootstrap', async () => {
  const options = magnitNativeOptions(), controller = new AbortController()
  controller.abort(Error('Magnit caller cancelled'))
  await assert.rejects(createMagnitGlobalScraper().run({ ...options, signal: controller.signal }), /caller cancelled/)
  assert.equal(options.calls.length, 0)
})

test('Magnit supports explicit India DirectSource postings without inventing a requisition, timezone or fresh date', async () => {
  const { jobs } = await execute(magnitDirectIndiaRole)
  assert.equal(jobs.length, 1)
  const job = jobs[0]
  assert.equal(job.jobId, 'directsource:434')
  assert.equal(job.requisitionId, null)
  assert.equal(job.city, 'Bengaluru')
  assert.equal(job.country, 'India')
  assert.equal(job.postingDate, '2026-07-08')
  assert.equal(job.closingDate, null)
  assert.equal(job.sourceNativeDates.timezoneUnavailable, true)
  assert.equal(job.sourceDetailComplete, true)
  assert.ok(job.sourceDescription.length > 1000)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 1)
})

test('Magnit traverses offset 25 and reconciles every detail before certifying a two-page native inventory', async () => {
  const options = magnitNativeOptions(() => {}, magnitTwoPageCapture())
  const jobs = await createMagnitGlobalScraper().run(options)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 30)
  assert.equal(options.calls.filter(call => call.method === 'POST' && JSON.parse(call.body).paginationStart === 25).length, 2)
  assert.equal(options.calls.filter(call => /\/jobposting\/prounlimited\//.test(call.url)).length, 26)
})

test('Magnit does not certify a filtered DirectSource business-group inventory', async () => {
  await assert.rejects(execute(packet => {
    if (packet.name === 'initial-directsource-list') packet.body = packet.body.replace(/(<option\b[^>]*value="ALLGRP"[^>]*?) selected/, '$1')
  }), /Magnit.*(?:filtered|industry|group)/i)
})

test('Magnit applies output caps only after all details and closing inventories, retaining partial evidence', async () => {
  const { jobs, options } = await execute(packet => { magnitDayforceIndiaRole(packet); magnitDirectIndiaRole(packet) }, { maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(options.calls.length, 37)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

for (const [label, addition] of [
  ['another ATS link', '<a href="https://example.manatal.com/jobs">Other careers</a>'],
  ['another ATS script', '<script src="https://example.careers-page.com/widget.js"></script>'],
  ['unknown recruiting frame', '<iframe src="https://example.com/roles"></iframe>'],
  ['unlisted native posting', '<a href="https://jobs.dayforcehcm.com/prounlimited/CANDIDATEPORTAL/jobs/999999">Job</a>'],
  ['additional Workday account with generic label', '<a href="https://magnit.wd5.myworkdayjobs.com/External">Learn More</a>'],
]) test('Magnit keeps additional hiring scope partial: ' + label, async () => {
  const { jobs } = await execute(packet => { if (packet.url === C) packet.body = packet.body.replace('</body>', addition + '</body>') })
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Magnit cannot use a CSS-hidden country heading as current India scope evidence', async () => {
  await assert.rejects(execute(packet => { if (packet.url === C) packet.body = packet.body.replace('</head>', '<style>.columns-2 h6 {display:none!important}</style></head>') }), /Magnit.*(?:India|region|heading)/i)
})

test('Magnit evaluates the full CSS ancestor selector before hiding a current heading', async () => {
  const { jobs } = await execute(packet => { if (packet.url === C) packet.body = packet.body.replace('</head>', '<style>.nonexistent-parent .columns-2 {display:none!important}</style></head>') })
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('Magnit retains partial evidence when closing native location/country states change', async () => {
  const { jobs } = await execute(packet => {
    magnitDayforceIndiaRole(packet)
    if (packet.name.startsWith('closing-search')) {
      const data = JSON.parse(packet.body)
      for (const row of data.jobPostings) if (row.jobPostingId === 7493) row.postingLocations[0].formattedAddress += ' - changed'
      packet.body = JSON.stringify(data)
    }
  })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Magnit rejects DirectSource geography that conflicts with the visible primary role location', async () => {
  await assert.rejects(execute(packet => {
    magnitDirectIndiaRole(packet)
    if (packet.name === 'directsource-detail-0') packet.body = packet.body.replace('Bengaluru, Karnataka  (Remote)', 'Warsaw, Mazowieckie  (Remote)')
  }), /Magnit.*(?:country|location|geograph)/i)
})

test('Magnit cannot certify a company-only structured paragraph when the visible native role description is longer', async () => {
  const { jobs } = await execute(packet => {
    magnitDirectIndiaRole(packet)
    if (packet.name === 'directsource-detail-0') packet.body = packet.body.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/,
      (all, start, raw, end) => {
        const value = JSON.parse(raw)
        value.description = value.description.match(/<p\b[^>]*>\s*Magnit is[\s\S]*?<\/p>/i)?.[0]
        assert.ok(value.description, 'Regression must retain the actual company-only paragraph')
        return start + JSON.stringify(value) + end
      })
  })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDescription, null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Magnit excludes a visibly closed DirectSource role and retains incomplete listing evidence', async () => {
  const { jobs } = await execute(packet => {
    magnitDirectIndiaRole(packet)
    if (packet.name === 'directsource-detail-0') packet.body = packet.body.replace('<h3 class="main-title', '<p>This position is closed. We are no longer accepting applications.</p><h3 class="main-title')
  })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Magnit cannot certify an opacity-hidden native Dayforce body even when API and rendered JSON agree', async () => {
  const hide = value => { if (value?.jobPostingId === 7493) value.jobPostingContent.jobDescription = '<div style="opacity:0">' + value.jobPostingContent.jobDescription + '</div>'; return value }
  const { jobs } = await execute(packet => {
    magnitDayforceIndiaRole(packet)
    if (packet.name === 'dayforce-detail-7493') packet.body = JSON.stringify(hide(JSON.parse(packet.body)))
    if (packet.name === 'dayforce-page-7493') packet.body = packet.body.replace(/(<script\b[^>]*id="__NEXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/,
      (all, start, raw, end) => { const next = JSON.parse(raw); next.props.pageProps.dehydratedState.queries.forEach(query => hide(query.state.data)); return start + JSON.stringify(next) + end })
  })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDescription, null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
