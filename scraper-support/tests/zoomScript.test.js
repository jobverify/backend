import assert from 'node:assert/strict'
import test from 'node:test'
import * as zoom from '../../scraper/zoom/script.js'
const createZoomScraper = (options) => {
  assert.equal(typeof zoom.createZoomScraper, 'function', 'Zoom needs an injectable scraper for the current public listing')
  return zoom.createZoomScraper(options)
}

const SITE = 'a5bcebfa-981b-46cd-b46f-ad91a50505b8'
const CAREERS = 'https://www.careers.zoom.us/'
const CONFIG_API = 'https://shazamme.io/Job-Listing/src/php/regional/actions'
const JOBS_API = 'https://shazamme.io/job-results/' + SITE
const HOME = '<title>Zoom Careers - Imagine what you can...</title><script>SiteAlias: \'22d89a44\'</script><a href="/job-results">All jobs</a><script src="https://sdk.shazamme.io/js/shazamme-1.0.3.min.js"></script>'
const row = (id, country = 'India') => ({ data: {
  jobID: id, referenceNumber: 'R19720', jobName: 'Data Engineer - Marketing',
  advertiserName: 'Zoom', siteName: 'Zoom Careers', siteID: SITE, dudaSiteID: '22d89a44',
  activeStatus: true, country, city: country === 'India' ? 'Bangalore (IND)' : 'San Jose',
  fullAddress: country === 'India' ? 'Bangalore (IND), India' : 'San Jose, United States of America',
  fullDescription: '<p>Build analytics pipelines.</p>', postedDate: '03-Oct-2026',
  addedOnUTC: '2026-10-03T00:08:34.4', category: 'Information Technology',
  jobURL: 'https://careers.zoom.com/job-details/data-engineer-' + id,
  applicationURL: null, workModel: null, workType: null,
} })
const getJson = (rows) => async (url, init) => {
  if (url === CONFIG_API) {
    assert.equal(init.method, 'POST')
    assert.deepEqual(JSON.parse(init.body), { action: 'Get Site ID', dudaSiteID: '22d89a44' })
    return { status: true, response: { items: [{ siteID: SITE, businessName: 'Zoom Careers', isLive: true, dudaSiteID: '22d89a44' }] } }
  }
  assert.equal(url, JOBS_API)
  return rows
}
const getText = async (url) => {
  if (url === CAREERS) return HOME
  const id = new URL(url).pathname.split('-').pop()
  return '<title>Data Engineer - Marketing</title><script type="application/ld+json">{"@type":"JobPosting"}</script><a href="/job-application?jobID=' + id + '">Apply Now</a>'
}

test('Zoom follows its live Shazamme site mapping, collects India jobs, and emits verified same-host application links', async () => {
  const jobs = await createZoomScraper({ now: () => '2026-10-03T00:00:00.000Z' }).run({
    fetchText: getText, fetchJson: getJson([row('one'), row('foreign', 'United States of America')]),
  })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Data Engineer - Marketing')
  assert.equal(jobs[0].city, 'Bangalore')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceUrl, CAREERS + 'job-details/data-engineer-one')
  assert.equal(jobs[0].applyUrl, CAREERS + 'job-application?jobID=one')
  assert.equal(jobs[0].jobDescription, 'Build analytics pipelines.')
  assert.equal(jobs[0].postingDate, '2026-10-03T00:08:34.400Z')
  assert.equal(jobs[0].atsPlatform, 'shazamme')
  assert.equal(jobs[0].source, 'zoom')
})

test('Zoom rejects unverified site mapping and malformed global inventory instead of returning zero jobs', async () => {
  await assert.rejects(createZoomScraper().run({ fetchText: getText, fetchJson: async () => ({ status: false }) }), /site mapping/)
  for (const payload of [{}, [{ data: {} }], [row('one'), { data: { ...row('two').data, siteID: 'other' } }]]) {
    await assert.rejects(createZoomScraper().run({ fetchText: getText, fetchJson: getJson(payload) }), /inventory/)
  }
})

test('Zoom validates each India detail application handoff and propagates upstream errors', async () => {
  await assert.rejects(createZoomScraper().run({
    fetchText: async (url) => url === CAREERS ? HOME : '<title>Not found</title>',
    fetchJson: getJson([row('one')]),
  }), /application handoff/)
  await assert.rejects(createZoomScraper().run({
    fetchText: getText, fetchJson: async () => { throw new Error('HTTP 404 upstream') },
  }), /HTTP 404 upstream/)
})

test('Zoom accepts confirmed empty collections and marks explicitly capped listings incomplete', async () => {
  assert.deepEqual(await createZoomScraper().run({ fetchText: getText, fetchJson: getJson([]) }), [])
  const jobs = await createZoomScraper({ maxJobs: 1 }).run({ fetchText: getText, fetchJson: getJson([row('one'), row('two')]) })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceListingComplete, false)
})

test('Zoom rejects changed official careers surfaces and honours pre-aborted cancellation', async () => {
  await assert.rejects(createZoomScraper().run({ fetchText: async () => '<title>Unrelated</title>' }), /careers/)
  const controller = new AbortController()
  controller.abort(new Error('cancelled Zoom'))
  await assert.rejects(createZoomScraper().run({ signal: controller.signal, fetchText: async () => assert.fail('Cancelled request') }), /cancelled Zoom/)
})

test('Zoom accepts the current public bare-host URL while preserving its trusted widget detail path and employer', async () => {
  const { readFile } = await import('node:fs/promises')
  const rows = JSON.parse(await readFile(new URL('./fixtures/zoom/current-bare-host.json', import.meta.url), 'utf8'))
  const jobs = zoom.extractSearchResults(rows, rows[0].data.siteID)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(new URL(jobs[0].sourceUrl).origin, 'https://www.careers.zoom.us')
  const changed = structuredClone(rows)
  changed[0].data.jobURL = changed[0].data.jobURL.replace('careers.zoom.us', 'example.com')
  assert.throws(() => zoom.extractSearchResults(changed, rows[0].data.siteID), /unverified detail/)
  changed[0] = structuredClone(rows[0]); changed[0].data.advertiserName = 'Unrelated employer'
  assert.throws(() => zoom.extractSearchResults(changed, rows[0].data.siteID), /employer|identity/)
})
