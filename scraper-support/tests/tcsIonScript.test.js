import assert from 'node:assert/strict'
import test from 'node:test'

const MARKETPLACE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>TCS iON Jobs: Explore opportunities and give your career a boost</title>
  </head>
  <body>
    <main>
      <p>Search by Job Role, Company, or Skills</p>
      <p>No Records Found</p>
      <h2>Find the Best-suited Jobs for You</h2>
      <p>Explore opportunities from leading companies and give your career a boost.</p>
      <h2>Featured Companies Hiring</h2>
      <div class="featured-company"><h4>Nest Digital</h4></div>
      <div class="featured-company"><h4>TATA ELXSI</h4></div>
      <div class="featured-company"><h4>Publicis sapient</h4></div>
      <div class="featured-company"><h4>Vedantu</h4></div>
    </main>
  </body>
</html>
`

const CURRENT_MARKETPLACE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>TCS iON Jobs: Explore opportunities and give your career a boost</title>
  </head>
  <body>
    <main>
      <section class="hero">
        <h1>Unlock Career Opportunities with AI Precision Matching</h1>
        <p>Browse job openings that align with your skills, goals, and where you want to go next.</p>
        <p>Get the Right Job Faster</p>
        <p>Search Manually</p>
        <p>Use AI Mode Coming Soon</p>
      </section>
      <section class="primer">
        <h2>TCS iON Job Primer</h2>
      </section>
      <section class="marketplace">
        <h2>Find the Best-suited Jobs for You</h2>
        <p>Explore opportunities from leading companies and give your career a boost.</p>
      </section>
      <section class="testimonials">
        <h4>Yashwant Mehta</h4>
        <p>Secretary | ABC Higher Secondary School</p>
      </section>
      <section class="hiringSection tcs-section d-none">
        <h2>Featured Companies Hiring</h2>
        <div class="featured-company"><h4>Nest Digital</h4></div>
        <div class="featured-company"><h4>TATA ELXSI</h4></div>
        <div class="featured-company"><h4>Publicis sapient</h4></div>
        <div class="featured-company"><h4>Vedantu</h4></div>
        <div class="featured-company"><h4>Presistent</h4></div>
      </section>
    </main>
  </body>
</html>
`

const EXACT_NAME_PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>TCS iON Careers</title>
  </head>
  <body>
    <article>
      <h2>Associate Product Manager</h2>
      <p>Company: TCS iON</p>
      <p>Posted by: TCS iON</p>
      <a href="https://www.tcsion.com/job-openings/tcs-ion-associate-product-manager">Apply now</a>
    </article>
  </body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/tcsion/script.js')
  } catch {
    assert.fail('Expected TCS iON scraper module at ../../scraper/tcsion/script.js')
  }
}

test('TCS iON sentinel helpers stay pinned to the verified first-party jobs marketplace instead of an exact-name employer feed', async () => {
  const tcsIon = await loadScriptModule()

  assert.equal(tcsIon.SOURCE, 'tcsion')
  assert.equal(tcsIon.COMPANY, 'TCS iON')
  assert.equal(tcsIon.OFFICIAL_BRAND_NAME, 'TCS iON')
  assert.equal(tcsIon.VERIFIED_ON, '2026-08-14')
  assert.equal(tcsIon.HOMEPAGE_URL, 'https://www.tcsion.com/')
  assert.equal(tcsIon.CAREERS_URL, 'https://www.tcsion.com/jobs/')
  assert.equal(
    tcsIon.SAMPLE_MARKETPLACE_LISTING_URL,
    'https://www.tcsion.com/job-openings/jobs-in-hyderabad',
  )
  assert.equal(tcsIon.hasOfficialJobsMarketplaceSignal(MARKETPLACE_HTML), true)
  assert.equal(tcsIon.hasOfficialJobsMarketplaceSignal(CURRENT_MARKETPLACE_HTML), true)
  assert.deepEqual(tcsIon.extractFeaturedCompanyNames(MARKETPLACE_HTML), [
    'Nest Digital',
    'TATA ELXSI',
    'Publicis sapient',
    'Vedantu',
  ])
  assert.deepEqual(tcsIon.extractFeaturedCompanyNames(CURRENT_MARKETPLACE_HTML), [
    'Nest Digital',
    'TATA ELXSI',
    'Publicis sapient',
    'Vedantu',
    'Presistent',
  ])
  assert.equal(tcsIon.marketplaceAppearsGenericMultiCompany(MARKETPLACE_HTML), true)
  assert.equal(tcsIon.marketplaceAppearsGenericMultiCompany(CURRENT_MARKETPLACE_HTML), true)
  assert.equal(tcsIon.marketplaceExposesExactNameJobs(MARKETPLACE_HTML), false)
  assert.equal(tcsIon.marketplaceExposesExactNameJobs(EXACT_NAME_PUBLIC_JOBS_HTML), true)
})

test('TCS iON returns [] for the verified multi-company marketplace and fails closed if exact-name public jobs appear', async () => {
  const tcsIon = await loadScriptModule()
  const requestedUrls = []

  const jobs = await tcsIon.createTcsIonScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === tcsIon.CAREERS_URL) {
        return { status: 200, url, html: CURRENT_MARKETPLACE_HTML }
      }

      throw new Error(`Unexpected TCS iON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [tcsIon.CAREERS_URL])
  assert.deepEqual(jobs, [])

  await assert.rejects(
    tcsIon.createTcsIonScraper().run({
      fetchPage: async () => ({
        status: 200,
        url: tcsIon.CAREERS_URL,
        html: EXACT_NAME_PUBLIC_JOBS_HTML,
      }),
    }),
    /exact-name public jobs/i,
  )

  await assert.rejects(
    tcsIon.createTcsIonScraper().run({
      fetchPage: async () => ({
        status: 200,
        url: tcsIon.CAREERS_URL,
        html: '<html><body><h1>Unexpected</h1></body></html>',
      }),
    }),
    /verified jobs marketplace changed materially/i,
  )
})

test('TCS iON returns [] when the verified marketplace host times out', async () => {
  const tcsIon = await loadScriptModule()

  const jobs = await tcsIon.createTcsIonScraper().run({
    fetchPage: async () => {
      throw new Error(`Connect Timeout Error for ${tcsIon.CAREERS_URL}`)
    },
  })

  assert.deepEqual(jobs, [])
})
