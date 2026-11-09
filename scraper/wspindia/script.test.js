import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs/promises'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const BLOCKED_PAGE_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Just a moment...</title>
  </head>
  <body>
    <main>
      <p>Please enable cookies.</p>
      <p>Cloudflare</p>
      <script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script>
    </main>
  </body>
</html>
`

const INDIA_SITE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>We are WSP - Engineers, Designers, Planners, Researchers | WSP</title>
  </head>
  <body>
    <main>
      <h1>WSP India</h1>
      <a href="https://www.wsp.com/en-gl/careers/job-opportunities?country=IN">Search and apply</a>
    </main>
  </body>
</html>
`

const JOBS_PAGE_ONE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Find your dream job | WSP</title>
  </head>
  <body>
    <section>
      <a href="https://emit.fa.ca3.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_2001/requisitions/preview/89283">
        <div>
          <h2 class="typo__24_20">Engineer - Roads <img alt="Link"></h2>
          <div class="office-group">
            <div class="office-address m-t-1">
              <span class="icon job-location"></span>
              <div class="text text-locations overflow-container">Bengaluru | Noida</div>
            </div>
          </div>
        </div>
      </a>
      <div class="pagination">
        <a class="pageprev">1</a>
        <a class="pageprev">2</a>
        <a class="pageprev">28</a>
        <a class="pagenext"></a>
      </div>
    </section>
  </body>
</html>
`

const JOBS_PAGE_TWO_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Find your dream job | WSP</title>
  </head>
  <body>
    <section>
      <a href="https://emit.fa.ca3.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_2001/requisitions/preview/90362">
        <div>
          <h2 class="typo__24_20">BIM Technician - Rail Civils <img alt="Link"></h2>
          <div class="office-group">
            <div class="office-address m-t-1">
              <span class="icon job-location"></span>
              <div class="text text-locations overflow-container">Noida | Bengaluru</div>
            </div>
          </div>
        </div>
      </a>
    </section>
  </body>
</html>
`

test('WSP India recognizes the verified Cloudflare challenge and extracts rendered Oracle-backed cards cleanly', async () => {
  const wspIndia = await loadModule()
  assert.ok(wspIndia, 'WSP India scraper module should load')

  assert.equal(wspIndia.hasCloudflareChallengeSignal(BLOCKED_PAGE_HTML), true)
  assert.equal(wspIndia.hasOfficialIndiaSiteSignal(INDIA_SITE_HTML), true)
  assert.equal(wspIndia.hasOfficialJobsPageSignal(JOBS_PAGE_ONE_HTML), true)
  assert.equal(wspIndia.extractMaxPageNumber(JOBS_PAGE_ONE_HTML), 28)
  assert.deepEqual(wspIndia.extractJobsFromHtml(JOBS_PAGE_ONE_HTML), [
    {
      title: 'Engineer - Roads',
      company: 'WSP India',
      location: 'Bengaluru | Noida',
      city: 'Bengaluru',
      sourceUrl: 'https://emit.fa.ca3.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_2001/requisitions/preview/89283',
      applyUrl: 'https://emit.fa.ca3.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_2001/requisitions/preview/89283',
      jobId: '89283',
      requisitionId: '89283',
      jobDescription: null,
    },
  ])
})

test('WSP India rejects the official India site Cloudflare challenge without claiming an empty inventory', async () => {
  const wspIndia = await loadModule()
  assert.ok(wspIndia, 'WSP India scraper module should load')

  const rawRequestedUrls = []
  await assert.rejects(wspIndia.createWspIndiaScraper({ maxPages: 2 }).run({
    fetchPage: async (url) => {
      rawRequestedUrls.push(url)
      return {
        status: 403,
        url,
        html: BLOCKED_PAGE_HTML,
      }
    },
    now: () => '2026-08-04T00:00:00.000Z',
  }), /Cloudflare/i)

  assert.deepEqual(rawRequestedUrls, [wspIndia.INDIA_SITE_URL])
})

test('WSP India fails closed when the official jobs page surface changes materially', async () => {
  const wspIndia = await loadModule()
  assert.ok(wspIndia, 'WSP India scraper module should load')

  await assert.rejects(
    wspIndia.createWspIndiaScraper({ maxPages: 1 }).run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: url === wspIndia.INDIA_SITE_URL
          ? INDIA_SITE_HTML
          : '<html><body><h1>Jobs</h1></body></html>',
      }),
    }),
    /jobs page surface changed/i,
  )
})

const loadCurrentWspFixtures = async () => {
  const [first, second, ...details] = await Promise.all([
    fs.readFile(new URL('./fixtures/jobs-current-page-1.html', import.meta.url), 'utf8'),
    fs.readFile(new URL('./fixtures/jobs-current-page-2.html', import.meta.url), 'utf8'),
    ...['97196', '97197', '91677'].map(id => fs.readFile(new URL('./fixtures/detail-' + id + '.json', import.meta.url), 'utf8').then(JSON.parse)),
  ])
  return { first, second, details }
}

const fixtureWspFetches = (wspIndia, fixtures) => ({
  fetchPage: async url => ({
    status: 200, url,
    html: url === wspIndia.INDIA_SITE_URL ? INDIA_SITE_HTML
      : url === wspIndia.buildJobsPageUrl({ page: 1 }) ? fixtures.first
        : url === wspIndia.buildJobsPageUrl({ page: 2 }) ? fixtures.second
          : (() => { throw Error('Unexpected fixture URL: ' + url) })(),
  }),
  fetchJson: async url => {
    const payload = fixtures.details.find(item => url === wspIndia.buildJobDetailsApiUrl(item.items[0].Id))
    if (!payload) throw Error('Unexpected Oracle fixture URL: ' + url)
    return payload
  },
})

test('WSP India verifies current official heading and extracts the published Oracle job links', async () => {
  const wspIndia = await loadModule()
  const fixtures = await loadCurrentWspFixtures()
  assert.equal(wspIndia.hasOfficialJobsPageSignal(fixtures.first), true)
  assert.deepEqual(wspIndia.extractJobsFromHtml(fixtures.first).map(job => job.jobId), ['97196', '97197'])
  assert.equal(wspIndia.extractMaxPageNumber(fixtures.first), 2)
})

test('WSP India reconciles current pages and required Oracle details for the full India inventory', async () => {
  const wspIndia = await loadModule()
  const fixtures = await loadCurrentWspFixtures()
  const jobs = await wspIndia.createWspIndiaScraper().run(fixtureWspFetches(wspIndia, fixtures))
  assert.deepEqual(jobs.map(job => job.jobId), ['97196', '97197', '91677'])
  assert.ok(jobs.every(job => job.country === 'India' && job.publicExperienceChecked && job.jobDescription.length > 100))
  assert.ok(jobs.every(job => job.sourceListingComplete === false && job.nativeListingEnumerationComplete === true
    && job.sourceDetailComplete === true && job.sourceScopeComplete === false && job.lifecycleCleanupAllowed === false))
  assert.match(jobs[0].sourceUrl, /sites\/CX_2001\/job\/97196$/)
})

test('WSP India rejects a completed listing missing an advertised job', async () => {
  const wspIndia = await loadModule()
  const fixtures = await loadCurrentWspFixtures()
  fixtures.first = fixtures.first.replace('Showing 3 jobs', 'Showing 4 jobs')
  fixtures.second = fixtures.second.replace('Showing 3 jobs', 'Showing 4 jobs')
  await assert.rejects(wspIndia.createWspIndiaScraper().run(fixtureWspFetches(wspIndia, fixtures)), /inventory/i)
})

test('WSP India rejects Oracle identity and country drift rather than emitting an India job', async () => {
  const wspIndia = await loadModule()
  for (const change of [{ Id: '99999' }, { PrimaryLocationCountry: 'US' }, { Title: 'Different role' }]) {
    const fixtures = await loadCurrentWspFixtures()
    const payload = fixtures.details[0]
    Object.assign(payload.items[0], change)
    const fetches = fixtureWspFetches(wspIndia, fixtures)
    fetches.fetchJson = async url => url === wspIndia.buildJobDetailsApiUrl('97196') ? payload
      : fixtures.details.find(item => url === wspIndia.buildJobDetailsApiUrl(item.items[0].Id))
    await assert.rejects(wspIndia.createWspIndiaScraper().run(fetches), /Oracle.*identity|Oracle.*India/i)
  }
})

for (const limits of [{ maxJobs: 2 }, { maxPages: 1 }]) {
  test('WSP India marks capped current inventory incomplete ' + JSON.stringify(limits), async () => {
    const wspIndia = await loadModule()
    const fixtures = await loadCurrentWspFixtures()
    const jobs = await wspIndia.createWspIndiaScraper(limits).run(fixtureWspFetches(wspIndia, fixtures))
    assert.deepEqual(jobs.map(job => job.jobId), ['97196', '97197'])
    assert.ok(jobs.every(job => job.sourceListingComplete === false))
  })
}

test('WSP India current Oracle job links cannot silently become an empty parsed inventory', async () => {
  const wspIndia = await loadModule()
  const fixtures = await loadCurrentWspFixtures()
  assert.deepEqual(wspIndia.extractJobsFromHtml(fixtures.first).map(job => job.jobId), ['97196', '97197'])
})

test('WSP India holds a role with no public criteria without treating company boilerplate as its description', async () => {
  const wspIndia = await loadModule()
  const html = await fs.readFile(new URL('./fixtures/jobs-current-bare-description.html', import.meta.url), 'utf8')
  const payload = JSON.parse(await fs.readFile(new URL('./fixtures/detail-94515.json', import.meta.url), 'utf8'))
  const jobs = await wspIndia.createWspIndiaScraper().run({
    fetchPage: async url => ({ status: 200, url, html: url === wspIndia.INDIA_SITE_URL ? INDIA_SITE_HTML : html }),
    fetchJson: async url => {
      assert.equal(url, wspIndia.buildJobDetailsApiUrl('94515'))
      return payload
    },
  })
  assert.equal(jobs.length, 0)
  assert.equal(jobs.nativeCollectionEvidence.heldNativeRoles[0].id, '94515')
  assert.match(jobs.nativeCollectionEvidence.heldNativeRoles[0].reason, /public role criteria missing/)
  const {readInventoryEvidence}=await import('../../scraper-support/utils/inventoryEvidence.js')
  assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('WSP India bounds concurrent detail reads while preserving published job order', async () => {
  const wspIndia = await loadModule()
  const fixtures = await loadCurrentWspFixtures()
  const fetches = fixtureWspFetches(wspIndia, fixtures)
  const originalFetchJson = fetches.fetchJson
  let active = 0
  let peak = 0
  fetches.fetchJson = async url => {
    active += 1
    peak = Math.max(peak, active)
    await new Promise(resolve => setTimeout(resolve, url === wspIndia.buildJobDetailsApiUrl('97196') ? 20 : 5))
    const payload = await originalFetchJson(url)
    active -= 1
    return payload
  }
  const jobs = await wspIndia.createWspIndiaScraper().run(fetches)
  assert.ok(peak > 1 && peak <= 4)
  assert.deepEqual(jobs.map(job => job.jobId), ['97196', '97197', '91677'])
})

test('WSP India default enumerates verified pagination beyond the shared ten-page cap', async () => {
  const wspIndia = await loadModule()
  const fixtures = await loadCurrentWspFixtures()
  const card = fixtures.first.match(/<a href="https:\/\/emit[\s\S]*?<\/a>/)[0]
  const requestedPages = []
  const jobs = await wspIndia.run({
    fetchPage: async url => {
      if (url === wspIndia.INDIA_SITE_URL) return { status: 200, url, html: INDIA_SITE_HTML }
      const page = Number(new URL(url).searchParams.get('page') || 1)
      requestedPages.push(page)
      const id = String(97196 + page)
      return { status: 200, url, html: '<html><head><title>Find your next opportunity | WSP</title><link rel="canonical" href="https://www.wsp.com/en-gl/careers/job-opportunities"></head><body><h2 id="dict-title">Showing 11 jobs</h2><div id="jobscontainer">' + card.replaceAll('97196', id) + '</div><div class="pagination"><div class="pagelist current"><a class="pageprev" data-value="' + page + '">' + page + '</a></div><a class="pageprev">11</a></div></body></html>' }
    },
    fetchJson: async url => {
      const payload = structuredClone(fixtures.details[0])
      payload.items[0].Id = url.match(/Id=%22(\d+)%22/)[1]
      return payload
    },
  })
  assert.deepEqual(requestedPages, Array.from({ length: 11 }, (_, index) => index + 1))
  assert.equal(jobs.length, 11)
  assert.ok(jobs.every(job => job.sourceListingComplete === false && job.nativeListingEnumerationComplete === true))
})

test('WSP India accounts for identical publisher duplicate rows without duplicating requisitions', async () => {
  const wspIndia = await loadModule()
  const { readInventoryEvidence } = await import('../../scraper-support/utils/inventoryEvidence.js')
  const fixtures = await loadCurrentWspFixtures()
  const repeatedCard = fixtures.first.match(/<a href="https:\/\/emit[\s\S]*?<\/a>/)[0]
  fixtures.first = fixtures.first.replace('Showing 3 jobs', 'Showing 4 jobs')
  fixtures.second = fixtures.second.replace('Showing 3 jobs', 'Showing 4 jobs').replace('<div id="jobscontainer">', '<div id="jobscontainer">' + repeatedCard)
  const fetches = fixtureWspFetches(wspIndia, fixtures)
  const originalFetchJson = fetches.fetchJson
  const requestedIds = []
  fetches.fetchJson = async url => {
    requestedIds.push(url.match(/Id=%22(\d+)%22/)[1])
    return originalFetchJson(url)
  }
  const jobs = await wspIndia.createWspIndiaScraper().run(fetches)
  assert.deepEqual(jobs.map(job => job.jobId), ['97196', '97197', '91677'])
  assert.deepEqual(requestedIds, ['97196', '97197', '91677'])
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 4)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 3)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs.nativeCollectionEvidence.enumerationComplete, true)
})

test('WSP India rejects conflicting repeated requisition cards instead of silently deduplicating', async () => {
  const wspIndia = await loadModule()
  const fixtures = await loadCurrentWspFixtures()
  const repeatedCard = fixtures.first.match(/<a href="https:\/\/emit[\s\S]*?<\/a>/)[0]
    .replace('<div class="text text-locations overflow-container">Noida</div>', '<div class="text text-locations overflow-container">Mumbai</div>')
  fixtures.second = fixtures.second.replace('<div id="jobscontainer">', '<div id="jobscontainer">' + repeatedCard)
  await assert.rejects(wspIndia.createWspIndiaScraper().run(fixtureWspFetches(wspIndia, fixtures)), /conflicting.*requisition/i)
})

test('WSP India marks a maxJobs limit inside the last page incomplete even when all rows were parsed', async () => {
  const wspIndia = await loadModule()
  const fixtures = await loadCurrentWspFixtures()
  const secondCard = [...fixtures.first.matchAll(/<a href="https:\/\/emit[\s\S]*?<\/a>/g)][1][0]
  fixtures.first = fixtures.first.replace(secondCard, '')
  fixtures.second = fixtures.second.replace('</div><div class="pagination">', secondCard + '</div><div class="pagination">')
  const jobs = await wspIndia.createWspIndiaScraper({ maxJobs: 2 }).run(fixtureWspFetches(wspIndia, fixtures))
  assert.deepEqual(jobs.map(job => job.jobId), ['97196', '91677'])
  assert.ok(jobs.every(job => job.sourceListingComplete === false))
})
