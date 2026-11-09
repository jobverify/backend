import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { run, CAREERS_URL, extractJobCards } from '../../scraper/stridelysolutions/script.js'

const html = readFileSync(new URL('./fixtures/stridelysolutions/current-openings.html', import.meta.url), 'utf8')
const unknownUrl = 'https://www.stridelysolutions.com/jobs/sap-bw/'
const detail = (country = 'IN', employer = 'Stridely Solutions') => '<html><title>SAP BW - Stridely Solutions</title>'
  + '<link rel="canonical" href="' + unknownUrl + '"><h1>SAP BW</h1><script type="application/ld+json">'
  + JSON.stringify({ '@type': 'JobPosting', title: 'SAP BW', url: unknownUrl, hiringOrganization: { name: employer },
    jobLocation: { '@type': 'Place', address: { addressLocality: country === 'IN' ? 'Pune' : 'Toronto', addressCountry: country } } })
  + '</script></html>'

test('Stridely keeps all 16 observed cards available for country verification', () => {
  const jobs = extractJobCards(html)
  assert.equal(jobs.length, 16)
  assert.equal(jobs.find(job => job.title === 'SAP BW').country, null)
  assert.equal(jobs.find(job => job.title === 'ODI').country, 'Canada')
})

test('Stridely includes the missing-scope India role only after exact employer detail proof', async () => {
  const requested = []
  const jobs = await run({ fetchText: async (url) => {
    requested.push(url)
    return url === CAREERS_URL ? html : detail()
  } })
  assert.equal(jobs.length, 15)
  assert.deepEqual(requested, [CAREERS_URL, unknownUrl])
  assert.equal(jobs.find(job => job.title === 'SAP BW').location, 'Pune, India')
  assert.equal(jobs.some(job => job.title === 'ODI'), false)
  assert.equal(jobs.some(job => job.sourceListingComplete === false), false)
  assert.equal(jobs.find(job => job.title === 'SAP ABAP').postingDate, '2026-09-11T00:00:00.000Z')
})

test('Stridely marks every verified job incomplete when the required unknown-scope detail is blocked', async () => {
  const requested = []
  const jobs = await run({ fetchText: async (url) => {
    requested.push(url)
    if (url === CAREERS_URL) return html
    throw Object.assign(new Error('HTTP 403'), { status: 403 })
  } })
  assert.equal(jobs.length, 14)
  assert.ok(jobs.every(job => job.sourceListingComplete === false))
  assert.deepEqual(requested, [CAREERS_URL, unknownUrl])
})

test('Stridely excludes a detail-confirmed foreign role without hiding unknown records', async () => {
  const jobs = await run({ fetchText: async (url) => url === CAREERS_URL ? html : detail('CA') })
  assert.equal(jobs.length, 14)
  assert.equal(jobs.some(job => job.sourceListingComplete === false), false)
})

test('Stridely rejects malformed cards and foreign employer detail instead of accepting a partial parser result', async () => {
  await assert.rejects(run({ fetchText: async () => html.replace(/>\s*SAP ABAP\s*<\/a>/, '></a>') }), /incomplete|malformed/i)
  await assert.rejects(run({ fetchText: async (url) => url === CAREERS_URL ? html : detail('IN', 'Other Employer') }), /identity|employer/i)
  await assert.rejects(run({ fetchText: async () => html.replaceAll('https://www.stridelysolutions.com/jobs/sap-abap/', 'https://other.example/jobs/sap-abap/') }), /identity|domain/i)
})

test('Stridely does not infer India from an unfamiliar location slug', async () => {
  const jobs = await run({ fetchText: async (url) => {
    if (url === CAREERS_URL) return html.replace('job-location-ahmedabad job-location-pune job-location-vadodara', 'job-location-berlin')
    if (url === unknownUrl) return detail()
    throw Object.assign(new Error('HTTP 403'), { status: 403 })
  } })
  assert.equal(jobs.some(job => job.title === 'SAP ABAP'), false)
  assert.ok(jobs.every(job => job.sourceListingComplete === false))
})

test('Stridely marks pending pagination incomplete instead of publishing it as a complete snapshot', async () => {
  const jobs = await run({ fetchText: async (url) => url === CAREERS_URL
    ? html + '<a class="e-load-more-anchor" data-next-page="2" href="/careers/current-openings/page/2/"></a>' : detail() })
  assert.ok(jobs.every(job => job.sourceListingComplete === false))
})

test('Stridely cancellation stops before listing requests and after required detail requests', async () => {
  const reason = new Error('source stopped')
  let calls = 0
  await assert.rejects(run({ signal: AbortSignal.abort(reason), fetchText: async () => { calls++; return html } }), error => error === reason)
  assert.equal(calls, 0)
  const controller = new AbortController()
  await assert.rejects(run({ signal: controller.signal, fetchText: async (url, options) => {
    assert.equal(options.signal, controller.signal)
    if (url === CAREERS_URL) return html
    controller.abort(reason)
    return detail()
  } }), error => error === reason)
})


test('Stridely rejects a broken article boundary that would otherwise hide an unresolved role', async () => {
  const malformed = html.replace('</article>', '')
  await assert.rejects(run({ fetchText: async (url) => url === CAREERS_URL ? malformed : detail() }), /incomplete|malformed/i)
})
