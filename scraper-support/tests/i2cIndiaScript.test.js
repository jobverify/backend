import assert from 'node:assert/strict'
import test from 'node:test'

const careersLandingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Be A Part of i2c - Current Openings</title>
  </head>
  <body>
    <main>
      <h1>Race ahead Make your mark</h1>
      <p>At i2c, innovation isn't optional-it's our lifeline.</p>
      <p>The future won't wait-and neither should you.</p>
      <a href="https://careers.i2cinc.com/careers/">Join Our Team</a>
      <a href="https://careers.i2cinc.com/careers/">Work With Us</a>
    </main>
  </body>
</html>
`

const jobsListHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>i2c Recruitment Portal | Jobs List</title>
  </head>
  <body>
    <main>
      <h1>Power your career Accelerate your future</h1>
      <p>89 Open Positions</p>
      <section>
        <h2>All Locations</h2>
        <ul>
          <li>United States</li>
          <li>Pakistan</li>
        </ul>
      </section>
      <section>
        <a href="https://careers.i2cinc.com/careers/index.php/showjob/software-engineer-technical-product-support-28-positions">
          Software Engineer - Product Operations
        </a>
        <span>Lahore, Punjab</span>
      </section>
    </main>
  </body>
</html>
`

const jobsListWithIndiaHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>i2c Recruitment Portal | Jobs List</title>
  </head>
  <body>
    <main>
      <h1>Power your career Accelerate your future</h1>
      <p>89 Open Positions</p>
      <section>
        <h2>All Locations</h2>
        <ul>
          <li>United States</li>
          <li>Pakistan</li>
          <li>India</li>
        </ul>
      </section>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/i2cindia/script.js')
  } catch {
    assert.fail('Expected i2c India scraper module at ../../scraper/i2cindia/script.js')
  }
}

test('i2c India sentinel pins the verified official i2c landing page and public jobs list URLs', async () => {
  const i2cIndia = await loadModule()

  assert.equal(i2cIndia.SOURCE, 'i2cindia')
  assert.equal(i2cIndia.COMPANY, 'i2c India')
  assert.equal(
    i2cIndia.CAREERS_LANDING_URL,
    'https://www.i2cinc.com/who-we-are/supercharge-your-career/',
  )
  assert.equal(i2cIndia.JOBS_LIST_URL, 'https://careers.i2cinc.com/careers/')
  assert.equal(i2cIndia.hasOfficialCareersLandingSignal(careersLandingHtml), true)
  assert.equal(
    i2cIndia.extractVerifiedJobsListUrl(careersLandingHtml),
    'https://careers.i2cinc.com/careers/',
  )
  assert.equal(i2cIndia.hasOfficialJobsListSignal(jobsListHtml), true)
  assert.equal(i2cIndia.extractLocationFacetSegment(jobsListHtml).includes('United States'), true)
  assert.equal(i2cIndia.extractLocationFacetSegment(jobsListHtml).includes('Pakistan'), true)
  assert.equal(i2cIndia.hasIndiaLocationFilter(jobsListHtml), false)
  assert.equal(i2cIndia.hasIndiaLocationFilter(jobsListWithIndiaHtml), true)
})

test('i2c India returns no jobs only while the verified public board remains a non-India slice', async () => {
  const i2cIndia = await loadModule()
  const requested = []

  const jobs = await i2cIndia.createI2cIndiaScraper().run({
    fetchText: async (url) => {
      requested.push(url)

      if (url === i2cIndia.CAREERS_LANDING_URL) return careersLandingHtml
      if (url === i2cIndia.JOBS_LIST_URL) return jobsListHtml

      throw new Error(`Unexpected i2c India fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requested, [
    i2cIndia.CAREERS_LANDING_URL,
    i2cIndia.JOBS_LIST_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('i2c India fails closed when the landing page drifts or India appears on the verified jobs board', async () => {
  const i2cIndia = await loadModule()

  await assert.rejects(
    i2cIndia.createI2cIndiaScraper().run({
      fetchText: async (url) => {
        if (url === i2cIndia.CAREERS_LANDING_URL) {
          return '<html><body><h1>Unexpected</h1></body></html>'
        }

        throw new Error(`Unexpected i2c India fixture URL: ${url}`)
      },
    }),
    /official i2c careers landing page/i,
  )

  await assert.rejects(
    i2cIndia.createI2cIndiaScraper().run({
      fetchText: async (url) => {
        if (url === i2cIndia.CAREERS_LANDING_URL) return careersLandingHtml
        if (url === i2cIndia.JOBS_LIST_URL) return jobsListWithIndiaHtml
        throw new Error(`Unexpected i2c India fixture URL: ${url}`)
      },
    }),
    /India location filter|India jobs/i,
  )

  await assert.rejects(
    i2cIndia.createI2cIndiaScraper().run({
      fetchText: async (url) => {
        if (url === i2cIndia.CAREERS_LANDING_URL) return careersLandingHtml
        if (url === i2cIndia.JOBS_LIST_URL) {
          return '<html><body><h1>Jobs</h1><p>No verified portal markers.</p></body></html>'
        }

        throw new Error(`Unexpected i2c India fixture URL: ${url}`)
      },
    }),
    /official i2c jobs list/i,
  )
})

const readCurrentFixture = async (name) => (await import('node:fs/promises')).readFile(new URL('./fixtures/i2cindia/' + name, import.meta.url), 'utf8')
const loadCurrentFixtures = async () => ({landing:await readCurrentFixture('current-landing.html'),portal:await readCurrentFixture('current-portal.html'),payload:JSON.parse(await readCurrentFixture('current-listing.json'))})

test('i2c accepts current careers copy only with verified title, brand and portal handoff', async () => {
  const i2c = await loadModule(); const fixture=await loadCurrentFixtures()
  assert.equal(i2c.hasOfficialCareersLandingSignal(fixture.landing), true)
  assert.equal(i2c.hasOfficialCareersLandingSignal(fixture.landing.replaceAll('https://careers.i2cinc.com/careers/', 'https://example.com/jobs/')), false)
})

test('i2c verifies every current public listing before returning zero India roles', async () => {
  const i2c = await loadModule(); const fixture=await loadCurrentFixtures(); const requested=[]
  const jobs=await i2c.run({fetchText:async url=>url===i2c.CAREERS_LANDING_URL?fixture.landing:fixture.portal,fetchJobsPage:async start=>{requested.push(start);return fixture.payload}})
  assert.deepEqual(jobs, []); assert.deepEqual(requested,[0])
})

test('i2c rejects incomplete, duplicate, unknown or India inventory and blocked portals', async () => {
  const i2c = await loadModule(); const fixture=await loadCurrentFixtures()
  const runWith=payload=>i2c.run({fetchText:async url=>url===i2c.CAREERS_LANDING_URL?fixture.landing:fixture.portal,fetchJobsPage:async()=>payload})
  for(const payload of [{...fixture.payload,jobCount:17},{...fixture.payload,html:''},{...fixture.payload,html:fixture.payload.html.replace('Pakistan','India')},{...fixture.payload,html:fixture.payload.html.replace('Pakistan','Remote')},{...fixture.payload,totalOpenings:'0'},{...fixture.payload,html:fixture.payload.html.replace('senior-data-scientist-3','principal-data-scientist')}]) await assert.rejects(runWith(payload), /inventory|country|location|positions|duplicate/i)
  await assert.rejects(i2c.run({fetchText:async url=>url===i2c.CAREERS_LANDING_URL?fixture.landing:'window["bobcmn"];window["failureConfig"];TSPD_123'}),/blocked|challenge/i)
})

test('i2c traverses count-advertised public jobs pagination and rejects changing totals', async () => {
  const i2c = await loadModule(); const fixture=await loadCurrentFixtures()
  const articles=[...fixture.payload.html.matchAll(/<article\b[\s\S]*?<\/article>/gi)].map(x=>x[0]); let requests=[]
  const first=Array.from({length:32},(_,index)=>articles[0].replace('principal-data-scientist','role-'+index)); const last=articles[0].replace('principal-data-scientist','role-32')
  const page=(start,changes={})=>({html:start===0?first.join(''):last,startValue:String(start),postPerpage:'32',counterField:start===0?'1':'2',limit:32,jobCount:33,totalOpenings:'33',...changes})
  await i2c.run({fetchText:async url=>url===i2c.CAREERS_LANDING_URL?fixture.landing:fixture.portal,fetchJobsPage:async start=>{requests.push(start);return page(start)}})
  assert.deepEqual(requests,[0,32])
  await assert.rejects(i2c.run({fetchText:async url=>url===i2c.CAREERS_LANDING_URL?fixture.landing:fixture.portal,fetchJobsPage:async start=>page(start,start?{jobCount:34}:{})}), /inventory|totals/i)
})

test('i2c reports HTTP and challenge responses as unavailable inventory instead of parser failures', async t => {
  const i2c = await loadModule()
  const fixture = await loadCurrentFixtures()
  const { classifyScraperError } = await import('../utils/failureClassification.js')
  for (const [status, url, body, expected] of [
    [403, i2c.JOBS_API_URL, '<html>Forbidden</html>', /HTTP 403/],
    [200, i2c.JOBS_API_URL, 'window["bobcmn"];window["failureConfig"];TSPD_123', /bot challenge/],
    [200, 'https://careers.i2cinc.com/denied', '{}', /redirected/],
  ]) {
    const mock = t.mock.method(globalThis, 'fetch', async () => ({ status, url, text: async () => body }))
    await assert.rejects(i2c.run({
      fetchText: async url => url === i2c.CAREERS_LANDING_URL ? fixture.landing : fixture.portal,
    }), error => {
      assert.match(error.message, expected)
      assert.equal(classifyScraperError(error).softFailure, true)
      return true
    })
    mock.mock.restore()
  }
})
