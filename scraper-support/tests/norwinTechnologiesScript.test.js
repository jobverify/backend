import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Explore IT Careers &amp; Technical Jobs - Norwin</title>
  </head>
  <body>
    <h1>Join the Elite Technical Bench.</h1>
    <p>Build the next generation of enterprise infrastructure alongside experts navigating the world&apos;s most challenging technical landscapes.</p>
    <p>Not Just a Job. A Technical Career Built to Last.</p>
    <p>At Norwin, you aren't just an employee; you are a specialist integrated into some of the most complex technical environments in the world.</p>
  </body>
</html>
`

const cloudflareBlockedCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Attention Required! | Cloudflare</title>
  </head>
  <body>
    <h1>Sorry, you have been blocked</h1>
    <p>You are unable to access wpewaf.com</p>
    <p>Cloudflare Ray ID: a258df411d839870</p>
  </body>
</html>
`

const verifiedRedirectLoopProbe = {
  status: 302,
  url: 'https://norwintechnologies.com/careers/',
  location: 'https://norwintechnologies.com/careers/',
}

const boardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Norwin Technologies jobs | Norwin Technologies openings | Norwin Technologies careers</title>
  </head>
  <body>
    <h1>Jobs at Norwin Technologies</h1>
    <div class="js-card list-item list-item-clickable js-careers-page-job-list-item" data-href="/jobs/fk0india1/">
      <a href="https://norwin.hire.trakstar.com/jobs/fk0india1/">
        <div class="row">
          <div class="col-md-6 col-xs-6">
            <h3 class="rb-h3 js-job-list-opening-name">Principal Engineer</h3>
            <div class="rb-text-6 js-job-list-opening-loc">
              <span class="meta-job-location-city">Bengaluru</span>,
              <span class="meta-job-location-state">Karnataka</span>,
              <span class="meta-job-location-country">India</span>
            </div>
          </div>
        </div>
      </a>
    </div>
    <div class="js-card list-item list-item-clickable js-careers-page-job-list-item" data-href="/jobs/fk0us1/">
      <a href="https://norwin.hire.trakstar.com/jobs/fk0us1/">
        <div class="row">
          <div class="col-md-6 col-xs-6">
            <h3 class="rb-h3 js-job-list-opening-name">Sr, Storage Ops</h3>
            <div class="rb-text-6 js-job-list-opening-loc">
              <span class="meta-job-location-city">Atlanta</span>,
              <span class="meta-job-location-state">GA</span>,
              <span class="meta-job-location-country">United States</span>
            </div>
          </div>
        </div>
      </a>
    </div>
  </body>
</html>
`

const usOnlyBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Norwin Technologies jobs | Norwin Technologies openings | Norwin Technologies careers</title>
  </head>
  <body>
    <h1>Jobs at Norwin Technologies</h1>
    <div class="js-card list-item list-item-clickable js-careers-page-job-list-item" data-href="/jobs/fk0p3z/">
      <a href="https://norwin.hire.trakstar.com/jobs/fk0p3z/">
        <div class="row">
          <div class="col-md-6 col-xs-6">
            <h3 class="rb-h3 js-job-list-opening-name">Sr, Storage Ops</h3>
            <div class="rb-text-6 js-job-list-opening-loc">
              <span class="meta-job-location-city">Atlanta</span>,
              <span class="meta-job-location-state">GA</span>,
              <span class="meta-job-location-country">United States</span>
            </div>
          </div>
        </div>
      </a>
    </div>
  </body>
</html>
`

const indiaDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Principal Engineer</h1>
    <p>Job Description</p>
    <section class="job-description">
      <p>Build and operate enterprise storage and infrastructure systems for India delivery teams.</p>
    </section>
    <p>Department: Engineering</p>
    <p>Location: Bengaluru, Karnataka, India</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/norwintechnologies/script.js')
  } catch {
    assert.fail('Expected Norwin Technologies scraper module at ../../scraper/norwintechnologies/script.js')
  }
}

test('Norwin Technologies validates the careers page and extracts Trakstar job listings', async () => {
  const norwin = await loadModule()

  assert.equal(norwin.CAREERS_URL, 'https://norwintechnologies.com/careers/')
  assert.equal(norwin.BOARD_URL, 'https://norwin.hire.trakstar.com/')
  assert.equal(norwin.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(norwin.hasCloudflareProtectedCareersSignal(cloudflareBlockedCareersHtml), true)
  assert.equal(norwin.hasRedirectLoopError(new Error('fetch failed | redirect count exceeded')), true)
  assert.equal(norwin.hasVerifiedSelfRedirectingCareersUrl(verifiedRedirectLoopProbe), true)
  assert.equal(norwin.hasVerifiedTrakstarBoardSignal(boardHtml), true)
  assert.deepEqual(
    norwin.extractTrakstarListings(boardHtml).map((job) => [job.title, job.location, job.jobId]),
    [
      ['Principal Engineer', 'Bengaluru, Karnataka, India', 'fk0india1'],
      ['Sr, Storage Ops', 'Atlanta, GA, United States', 'fk0us1'],
    ],
  )
})

test('Norwin Technologies run keeps only India roles from the verified Trakstar board', async () => {
  const norwin = await loadModule()
  const requestedUrls = []

  const jobs = await norwin.createNorwinTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === norwin.CAREERS_URL) return careersHtml
      if (url === norwin.BOARD_URL) return boardHtml
      if (url === 'https://norwin.hire.trakstar.com/jobs/fk0india1/') return indiaDetailHtml
      throw new Error(`Unexpected Norwin URL: ${url}`)
    },
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    norwin.CAREERS_URL,
    norwin.BOARD_URL,
    'https://norwin.hire.trakstar.com/jobs/fk0india1/',
  ])
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.department, job.country, job.source]),
    [['Principal Engineer', 'Bengaluru, Karnataka, India', 'Engineering', 'India', 'norwintechnologies']],
  )
})

test('Norwin Technologies accepts a Cloudflare-protected careers page when the Norwin board stays public', async () => {
  const norwin = await loadModule()

  const jobs = await norwin.createNorwinTechnologiesScraper().run({
    fetchText: async (url) => {
      if (url === norwin.CAREERS_URL) return cloudflareBlockedCareersHtml
      if (url === norwin.BOARD_URL) return boardHtml
      if (url === 'https://norwin.hire.trakstar.com/jobs/fk0india1/') return indiaDetailHtml
      throw new Error(`Unexpected Norwin URL: ${url}`)
    },
    now: () => '2026-08-03T00:00:00.000Z',
  })

  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.country]),
    [['Principal Engineer', 'Bengaluru, Karnataka, India', 'India']],
  )
})

test('Norwin Technologies accepts the Friday, August 14, 2026 careers redirect loop when the Norwin board stays public with no India roles', async () => {
  const norwin = await loadModule()
  const requestedUrls = []
  const probedUrls = []

  const jobs = await norwin.createNorwinTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === norwin.CAREERS_URL) {
        throw new Error('fetch failed | redirect count exceeded')
      }
      if (url === norwin.BOARD_URL) return usOnlyBoardHtml
      throw new Error(`Unexpected Norwin URL: ${url}`)
    },
    probeCareersRedirect: async (url) => {
      probedUrls.push(url)
      return verifiedRedirectLoopProbe
    },
    now: () => '2026-08-14T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [norwin.CAREERS_URL, norwin.BOARD_URL])
  assert.deepEqual(probedUrls, [norwin.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Norwin Technologies fails closed when the verified board contract drifts', async () => {
  const norwin = await loadModule()

  await assert.rejects(
    norwin.createNorwinTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === norwin.CAREERS_URL) return careersHtml
        return boardHtml.replace('Jobs at Norwin Technologies', 'Jobs elsewhere')
      },
    }),
    /verified Trakstar board/i,
  )
})
