import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

import { createInnovalDigitalSolutionsScraper } from '../../scraper/innovaldigitalsolutions/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const companyUrl = 'https://www.ivldsp.com/company/?tab=careers'
const portalUrl = 'https://career.ivldsp.in/portal/'
const shareUrl = 'https://share.google/YUvEYvyEyaXQzpKOu'
const chunkUrl = 'https://www.ivldsp.com/_next/static/chunks/0hi2d35c12qtd.js'
const fixture = name => readFile(new URL('./fixtures/innovaldigitalsolutions/' + name, import.meta.url), 'utf8')
const now = () => '2026-10-08T22:00:00.000Z'
const makeHarness = async ({ company, chunk, portal, detail112, detail107, redirect = portalUrl } = {}) => {
  const pages = new Map([
    [companyUrl, { status: 200, url: companyUrl, html: company ?? await fixture('company.html') }],
    [chunkUrl, { status: 200, url: chunkUrl, html: chunk ?? await fixture('careers-chunk.js') }],
    [shareUrl, { status: 200, url: redirect, html: portal ?? await fixture('portal.html') }],
    [portalUrl + 'viewDetails112.html', { status: 200, url: portalUrl + 'viewDetails112.html', html: detail112 ?? await fixture('detail-112.html') }],
    [portalUrl + 'viewDetails107.html', { status: 200, url: portalUrl + 'viewDetails107.html', html: detail107 ?? await fixture('detail-107.html') }],
  ])
  const calls = []
  return {
    calls,
    run: () => createInnovalDigitalSolutionsScraper({ now }).run({
      // Also inject the legacy dependency: the regression must fail without a live request.
      fetchText: async () => pages.get(companyUrl).html,
      fetchPage: async url => {
        calls.push(url)
        assert.ok(pages.has(url), 'Unexpected public request: ' + url)
        return pages.get(url)
      },
    }),
  }
}

test('Innoval follows its current official careers handoff and returns both complete India roles', async () => {
  const harness = await makeHarness()
  const jobs = await harness.run()
  assert.deepEqual(jobs.map(job => [job.jobId, job.title, job.location, job.experienceRequired]), [
    ['112', 'EXIM Consultant', 'Mumbai / Trivandrum', '5-8 years'],
    ['107', 'SAP ABAP Consultant', 'Trivandrum / Mumbai', '5+ Yrs'],
  ])
  for (const job of jobs) {
    assert.equal(job.company, 'Innoval Digital Solutions')
    assert.equal(job.country, 'India')
    assert.equal(job.source, 'innovaldigitalsolutions')
    assert.equal(job.sourceUrl, portalUrl + 'viewDetails' + job.jobId + '.html')
    assert.equal(job.applyUrl, job.sourceUrl)
    assert.equal(job.postingDate, '2026-10-07')
    assert.equal(job.closingDate, '2026-11-15')
    assert.equal(job.publicExperienceChecked, true)
    assert.ok(job.jobDescription.length > 200)
    assert.ok(!/[<>]/.test(job.jobDescription))
  }
  // The nested spans and final bullet must survive complete description extraction.
  assert.match(jobs[0].jobDescription, /Foreign Trade Policy/i)
  assert.match(jobs[1].jobDescription, /Good communication and problem-solving skills/i)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'complete-inventory')
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.firstParty, true)
  assert.equal(evidence.surface, portalUrl)
  assert.equal(evidence.reportedTotal, null) // The public page publishes no numeric total.
  assert.equal(evidence.indiaFacetCount, 2)
  assert.equal(harness.calls.filter(url => /viewDetails/.test(url)).length, 2)
})

test('Innoval fails closed if its company page no longer exposes the verified careers navigation', async () => {
  const harness = await makeHarness({ company: '<title>Innoval Digital</title><p>Company</p>' })
  await assert.rejects(harness.run(), /official careers handoff/i)
})
test('Innoval fails closed if the current first-party application loses the current-openings CTA', async () => {
  const harness = await makeHarness({ chunk: 'href:"' + shareUrl + '",children:"About us"' })
  await assert.rejects(harness.run(), /official careers handoff/i)
})
test('Innoval rejects a careers redirect to another employer or insecure host', async () => {
  for (const redirect of ['https://other.example/portal/', 'http://career.ivldsp.in/portal/']) {
    const harness = await makeHarness({ redirect })
    await assert.rejects(harness.run(), /verified careers portal/i)
  }
})
test('Innoval rejects a missing job card link instead of dropping the role', async () => {
  const portal = (await fixture('portal.html')).replace('href="viewDetails107.html"', 'href="#"')
  await assert.rejects((await makeHarness({ portal })).run(), /incomplete public job inventory/i)
})
test('Innoval rejects repeated job IDs and listing/detail ID disagreement', async () => {
  const portal = (await fixture('portal.html')).replace('value="107"', 'value="112"')
  await assert.rejects((await makeHarness({ portal })).run(), /incomplete public job inventory/i)
})
test('Innoval rejects an unsupported pagination control instead of claiming completeness', async () => {
  const portal = (await fixture('portal.html')).replace('</body>', '<a rel="next" href="?page=2">Next</a></body>')
  await assert.rejects((await makeHarness({ portal })).run(), /pagination/i)
})
test('Innoval does not turn a zero-card parser result into a verified empty inventory', async () => {
  const portal = '<title>Career | Innoval Digital Solutions Pvt Ltd</title><img alt="Innoval Digital Solutions"><h2>Hot Jobs</h2><div id="job-openings"></div>'
  await assert.rejects((await makeHarness({ portal })).run(), /incomplete public job inventory/i)
})
test('Innoval rejects detail identity mismatches and missing descriptions', async () => {
  const detail = await fixture('detail-112.html')
  for (const detail112 of [detail.replace('value="112"', 'value="999"'), detail.replace('id="rptjobDesc_ctl00_Label1"', 'id="unrelated-description"')]) {
    await assert.rejects((await makeHarness({ detail112 })).run(), /job detail/i)
  }
})
test('Innoval excludes expired openings after checking all public details', async () => {
  const oldDate = html => html.replaceAll('15-11-2026', '01-10-2026')
  const harness = await makeHarness({ portal: oldDate(await fixture('portal.html')), detail112: oldDate(await fixture('detail-112.html')), detail107: oldDate(await fixture('detail-107.html')) })
  const jobs = await harness.run()
  assert.equal(jobs.length, 0)
  assert.equal(harness.calls.filter(url => /viewDetails/.test(url)).length, 2)
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
})
test('Innoval rejects malformed dates and unresolved location countries', async () => {
  for (const mutate of [html => html.replaceAll('15-11-2026', '31-11-2026'), html => html.replaceAll('Mumbai / Trivandrum', 'Unspecified')]) {
    await assert.rejects((await makeHarness({ portal: mutate(await fixture('portal.html')), detail112: mutate(await fixture('detail-112.html')) })).run(), /date|location country/i)
  }
})
test('Innoval excludes an explicitly foreign role without duplicating multi-city India roles', async () => {
  const foreign = html => html.replaceAll('Mumbai / Trivandrum', 'Singapore')
  const harness = await makeHarness({ portal: foreign(await fixture('portal.html')), detail112: foreign(await fixture('detail-112.html')) })
  const jobs = await harness.run()
  assert.deepEqual(jobs.map(job => job.jobId), ['107'])
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 1)
  assert.equal(harness.calls.filter(url => /viewDetails/.test(url)).length, 2)
})
