import assert from 'node:assert/strict'
import test from 'node:test'
import { installWorkbookOfflineGuard } from './helpers/workbookBatchCatalogAssertions20261102.js'

test.beforeEach((t) => installWorkbookOfflineGuard(t))


const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const loadModule = async (relativePath) => {
  try {
    return await import(relativePath)
  } catch {
    assert.fail(`Expected scraper module at ${relativePath}`)
  }
}

const qualizealChallengeHtml = 'Javascript is required. Please enable javascript before you are allowed to see this page.'

const soleraCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Revving Up For Growth</h1>
    <a href="https://solera.wd5.myworkdayjobs.com/Global_Career_Site">See Open Positions</a>
    <p>Ready to take things to the next level? Start your journey here.</p>
  </body>
</html>
`

const factspanCurrentOpeningsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Current Openings</h1>
    <p>From Data to AI, explore career opportunities at Factspan</p>
    <p>Reach us at</p>
    <p>contact@factspan.com</p>
    <div>Data and AI</div>
  </body>
</html>
`

const pubmaticJobsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>OPPORTUNITY. DELIVERED.</h1>
    <p>62 open positions</p>
    <section>
      <h4>Gurugram, IN</h4>
      <a href="https://pubmatic.com/careers/job/senior-performance-advertising-engineer/">Senior Performance Advertising Engineer</a>
      <a href="https://pubmatic.com/careers/job/director-advertising-solutions-brand-direct/">Director Advertising Solutions, Brand Direct - APAC</a>
    </section>
    <section>
      <h4>Pune, IN</h4>
      <a href="https://pubmatic.com/careers/job/senior-machine-learning-engineer/">Senior Machine Learning Engineer</a>
      <a href="https://pubmatic.com/careers/job/principal-software-engineer-data-analytics/">Principal Software Engineer - Data Analytics</a>
    </section>
    <section>
      <h4>Chicago, IL</h4>
      <a href="https://pubmatic.com/careers/job/account-executive-commerce-media/">Account Executive, Commerce Media</a>
    </section>
  </body>
</html>
`

const currentPubmaticJobsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <div class="search-bar">
      <form id="job-search-form">
        <select id="job-location">
          <option value="all">All Locations</option>
          <option value="Pune, IN">Pune, IN</option>
          <option value="Gurugram, IN">Gurugram, IN</option>
        </select>
        <div class="actions">
          <a href="https://pubmatic.com/careers/job-search-engineering/">View Engineering Jobs</a>
        </div>
      </form>
    </div>
    <div class="container postings-results">
      <h4 class="postings-count">66 open positions</h4>
      <hr>
      <h4 class="location-name">Gurugram, IN</h4>
      <div class="postings">
        <div class="postings-left">
          <a href="/job/?gh_jid=5348226008" class="posting">Customer Success Operations Manager - Spanish Language Expert</a>
        </div>
        <div class="postings-right">
          <a href="/job/?gh_jid=5282036008" class="posting">Senior Performance Advertising Engineer</a>
        </div>
      </div>
      <hr>
      <h4 class="location-name">Pune, IN</h4>
      <div class="postings">
        <div class="postings-left">
          <a href="/job/?gh_jid=5166449008" class="posting">Principal Software Engineer - Data Analytics</a>
          <a href="/job/?gh_jid=5121514008" class="posting">Senior Machine Learning Engineer</a>
        </div>
        <div class="postings-right">
          <a href="/job/?gh_jid=5368771008" class="posting">Senior Software Engineer - Java API</a>
        </div>
      </div>
    </div>
  </body>
</html>
`

const juegoStudioCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h2>OPEN POSITIONS</h2>
    <section class="job">
      <h5>3D Artist I / II</h5>
      <h5>Bangalore</h5>
      <h6>Department:</h6>
      <p>Modelling</p>
      <h6>Position:</h6>
      <p>3D Artist I, 3D Artist II</p>
      <h6>Relevant Experience:</h6>
      <p>2- 4 years</p>
      <a href="https://jhub.juegostudio.com/jobs/3d-artist">Apply Now</a>
    </section>
    <section class="job">
      <h5>UI UX Designer</h5>
      <h5>Bangalore</h5>
      <h6>Department:</h6>
      <p>UI Design</p>
      <h6>Position:</h6>
      <p>Senior UI-Designer</p>
      <h6>Relevant Experience:</h6>
      <p>5+ years</p>
      <a href="https://jhub.juegostudio.com/jobs/ui-ux-designer">Apply Now</a>
    </section>
    <section class="job">
      <h5>Lead Animator</h5>
      <h5>Bangalore</h5>
      <h6>Department:</h6>
      <p>Animation</p>
      <h6>Position:</h6>
      <p>Lead Animator</p>
      <h6>Relevant Experience:</h6>
      <p>6-8 years</p>
      <a href="https://jhub.juegostudio.com/jobs/lead-animator">Apply Now</a>
    </section>
  </body>
</html>
`

test('QualiZeal sentinel validates the anti-bot challenge and returns []', async () => {
  const qualizeal = await loadModule('../../scraper/qualizeal/script.js')

  assert.equal(qualizeal.hasChallengePageSignal(qualizealChallengeHtml), true)

  const jobs = await qualizeal.createQualiZealScraper().run({
    fetchText: async (url) => {
      assert.equal(url, qualizeal.HOMEPAGE_URL)
      return qualizealChallengeHtml
    },
  })

  assert.deepEqual(jobs, [])
})

test('Solera legacy careers shell cannot certify native inventory through a body-only override', async () => {
  const solera = await loadModule('../../scraper/solera/script.js')
  assert.equal(solera.hasOfficialCareersSignal(soleraCareersHtml), true)
  assert.equal(solera.hasWorkdayHandoffSignal(soleraCareersHtml), true)
  assert.equal(solera.hasInlineJobCards(soleraCareersHtml), false)
  let bodyReads = 0
  await assert.rejects(solera.createSoleraScraper().run({ fetchText: async () => {
    bodyReads += 1
    return soleraCareersHtml
  } }), /native HTTP response metadata is required; body-only transport overrides are unsupported/)
  assert.equal(bodyReads, 0)
  await assert.rejects(solera.run({ maxJobs: 1 }), /inventory caps and page limits are unsupported/)
  const cancelled = new Error('cancel before Solera source reads')
  await assert.rejects(solera.run({ signal: AbortSignal.abort(cancelled) }), error => error === cancelled)
})

test('Factspan sentinel validates the current-openings shell and returns [] when no public jobs inventory is present', async () => {
  const factspan = await loadModule('../../scraper/factspan/script.js')

  assert.equal(factspan.hasCurrentOpeningsSignal(factspanCurrentOpeningsHtml), true)
  assert.equal(factspan.hasPublicJobListingsSignal(factspanCurrentOpeningsHtml), false)

  const jobs = await factspan.createFactspanScraper().run({
    fetchText: async (url) => {
      assert.equal(url, factspan.CURRENT_OPENINGS_URL)
      return factspanCurrentOpeningsHtml
    },
  })

  assert.deepEqual(jobs, [])
})

test('PubMatic scraper returns normalized India jobs from the verified first-party grouped jobs page', async () => {
  const pubmatic = await loadModule('../../scraper/pubmatic/script.js')

  assert.equal(pubmatic.hasOfficialJobsSignal(pubmaticJobsHtml), true)
  assert.deepEqual(
    pubmatic.extractLocationGroups(pubmaticJobsHtml).map((group) => group.location),
    ['Gurugram, IN', 'Pune, IN', 'Chicago, IL'],
  )

  const jobs = await pubmatic.createPubMaticScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      assert.equal(url, pubmatic.CAREERS_URL)
      return pubmaticJobsHtml
    },
  })

  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      country: job.country,
      applyUrl: job.applyUrl,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Director Advertising Solutions, Brand Direct - APAC',
        location: 'Gurugram, Haryana, India',
        city: 'Gurugram',
        country: 'India',
        applyUrl: 'https://pubmatic.com/careers/job/director-advertising-solutions-brand-direct/',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Principal Software Engineer - Data Analytics',
        location: 'Pune, Maharashtra, India',
        city: 'Pune',
        country: 'India',
        applyUrl: 'https://pubmatic.com/careers/job/principal-software-engineer-data-analytics/',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Senior Machine Learning Engineer',
        location: 'Pune, Maharashtra, India',
        city: 'Pune',
        country: 'India',
        applyUrl: 'https://pubmatic.com/careers/job/senior-machine-learning-engineer/',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Senior Performance Advertising Engineer',
        location: 'Gurugram, Haryana, India',
        city: 'Gurugram',
        country: 'India',
        applyUrl: 'https://pubmatic.com/careers/job/senior-performance-advertising-engineer/',
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )
})

test('PubMatic scraper accepts the current grouped postings layout and updated job count', async () => {
  const pubmatic = await loadModule('../../scraper/pubmatic/script.js')

  assert.equal(pubmatic.hasOfficialJobsSignal(currentPubmaticJobsHtml), true)
  assert.deepEqual(
    pubmatic.extractLocationGroups(currentPubmaticJobsHtml).map((group) => ({
      location: group.location,
      titles: group.jobs.map((job) => job.title),
    })),
    [
      {
        location: 'Gurugram, IN',
        titles: [
          'Customer Success Operations Manager - Spanish Language Expert',
          'Senior Performance Advertising Engineer',
        ],
      },
      {
        location: 'Pune, IN',
        titles: [
          'Principal Software Engineer - Data Analytics',
          'Senior Machine Learning Engineer',
          'Senior Software Engineer - Java API',
        ],
      },
    ],
  )
})

test('Juego Studio current run rejects legacy opening cards without current job identity, country and full JD proof', async () => {
  const juegoStudio = await loadModule('../../scraper/juegostudio/script.js')
  assert.equal(juegoStudio.hasOfficialCareersSignal(juegoStudioCareersHtml), true)
  assert.deepEqual(
    juegoStudio.extractOpenPositions(juegoStudioCareersHtml).map((job) => job.title),
    ['3D Artist I / II', 'UI UX Designer', 'Lead Animator'],
  )
  await assert.rejects(
    juegoStudio.createJuegoStudioScraper({ now: () => FIXED_SCRAPED_AT }).run({
      fetchText: async () => juegoStudioCareersHtml,
    }),
    /Verified LinkedIn/,
  )
})
