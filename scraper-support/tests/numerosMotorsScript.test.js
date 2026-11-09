import assert from 'node:assert/strict'
import test from 'node:test'

const loadNumerosMotorsModule = async () => {
  try {
    return await import('../../scraper/numerosmotors/script.js')
  } catch {
    assert.fail('Expected Numeros Motors scraper module at ../../scraper/numerosmotors/script.js')
  }
}

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Always Moving, Always Numeros: Cleaner, Smarter Electric | Numeros Motors</title>
    <link rel="canonical" href="https://numerosmotors.com/" />
    <meta property="og:site_name" content="Numeros Motors - Innovation is our way of life" />
  </head>
  <body>
    <header>
      <a href="https://numerosmotors.com/careers/">Careers</a>
      <a href="/careers">Join Us</a>
    </header>
  </body>
</html>
`

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Numeros Motors | Join the EV Revolution</title>
    <link rel="canonical" href="https://numerosmotors.com/careers/" />
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <h3>Lead the Change with Us</h3>
      <p>
        We are constantly looking to hire candidates across different levels and competencies,
        to strengthen our 250+ team.
      </p>
      <div class="elementor-button-wrapper">
        <a class="elementor-button elementor-size-sm" href="/open-positions">
          <span class="elementor-button-text">Click to See Open Positions &amp; Apply</span>
        </a>
      </div>
    </main>
  </body>
</html>
`

const officialOpenPositionsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Open Positions at Numeros Motors | Join the EV Revolution</title>
    <link rel="canonical" href="https://numerosmotors.com/open-positions/" />
  </head>
  <body>
    <main>
      <h1>Open Positions</h1>

      <div class="elementor-element elementor-widget elementor-widget-icon-box">
        <div class="elementor-widget-container">
          <div class="elementor-icon-box-content">
            <h4 class="elementor-icon-box-title">
              <span>Senior Engineer - Embedded Hardware</span>
            </h4>
            <p class="elementor-icon-box-description">04--06 Year of Exp.</p>
          </div>
        </div>
      </div>
      <div class="elementor-element popmake-14016 elementor-widget elementor-widget-button">
        <div class="elementor-widget-container">
          <div class="elementor-button-wrapper">
            <a class="elementor-button elementor-size-sm" role="button">
              <span class="elementor-button-text">Apply Now</span>
            </a>
          </div>
        </div>
      </div>

      <div class="elementor-element elementor-widget elementor-widget-icon-box">
        <div class="elementor-widget-container">
          <div class="elementor-icon-box-content">
            <h4 class="elementor-icon-box-title">
              <span>Manager - Sales (Chennai)</span>
            </h4>
            <p class="elementor-icon-box-description">08--12 Year of Exp.</p>
          </div>
        </div>
      </div>
      <div class="elementor-element popmake-14016 elementor-widget elementor-widget-button">
        <div class="elementor-widget-container">
          <div class="elementor-button-wrapper">
            <a class="elementor-button elementor-size-sm" role="button">
              <span class="elementor-button-text">Apply Now</span>
            </a>
          </div>
        </div>
      </div>

      <div class="elementor-element elementor-widget elementor-widget-icon-box">
        <div class="elementor-widget-container">
          <div class="elementor-icon-box-content">
            <h4 class="elementor-icon-box-title">
              <span>Applied Research Engineer- Electrical &amp; Electronics (Advanced Engineering &amp; Research)</span>
            </h4>
            <p class="elementor-icon-box-description">00--05 Year of Exp.</p>
          </div>
        </div>
      </div>
      <div class="elementor-element popmake-14016 elementor-widget elementor-widget-button">
        <div class="elementor-widget-container">
          <div class="elementor-button-wrapper">
            <a class="elementor-button elementor-size-sm" role="button">
              <span class="elementor-button-text">Apply Now</span>
            </a>
          </div>
        </div>
      </div>

      <div class="elementor-element elementor-widget elementor-widget-icon-box">
        <div class="elementor-widget-container">
          <div class="elementor-icon-box-content">
            <h4 class="elementor-icon-box-title">
              <span>Intern - Marketing</span>
            </h4>
            <p class="elementor-icon-box-description">0 Year of Exp.</p>
          </div>
        </div>
      </div>
      <div class="elementor-element popmake-14016 elementor-widget elementor-widget-button">
        <div class="elementor-widget-container">
          <div class="elementor-button-wrapper">
            <a class="elementor-button elementor-size-sm" role="button">
              <span class="elementor-button-text">Apply Now</span>
            </a>
          </div>
        </div>
      </div>

      <div class="elementor-element elementor-widget elementor-widget-icon-box">
        <div class="elementor-widget-container">
          <div class="elementor-icon-box-content">
            <h4 class="elementor-icon-box-title">
              <span>Lead - IP &amp; Strategy</span>
            </h4>
            <p class="elementor-icon-box-description">10--15 Year of Exp.</p>
          </div>
        </div>
      </div>
      <div class="elementor-element popmake-14016 elementor-widget elementor-widget-button">
        <div class="elementor-widget-container">
          <div class="elementor-button-wrapper">
            <a class="elementor-button elementor-size-sm" role="button">
              <span class="elementor-button-text">Apply Now</span>
            </a>
          </div>
        </div>
      </div>

      <div class="elementor-element elementor-widget elementor-widget-icon-box">
        <div class="elementor-widget-container">
          <div class="elementor-icon-box-content">
            <h4 class="elementor-icon-box-title">
              <span>Lead - IP &amp; Strategy</span>
            </h4>
            <p class="elementor-icon-box-description">10 - 14 Year of Exp.</p>
          </div>
        </div>
      </div>
      <div class="elementor-element popmake-14016 elementor-widget elementor-widget-button">
        <div class="elementor-widget-container">
          <div class="elementor-button-wrapper">
            <a class="elementor-button elementor-size-sm" role="button">
              <span class="elementor-button-text">Apply Now</span>
            </a>
          </div>
        </div>
      </div>

      <div class="elementor-element elementor-widget elementor-widget-icon-box">
        <div class="elementor-widget-container">
          <div class="elementor-icon-box-content">
            <h4 class="elementor-icon-box-title">
              <span>Senior Manager -Sales ( Kerala )</span>
            </h4>
            <p class="elementor-icon-box-description">10 - 12 Year of Exp.</p>
          </div>
        </div>
      </div>
      <div class="elementor-element popmake-14016 elementor-widget elementor-widget-button">
        <div class="elementor-widget-container">
          <div class="elementor-button-wrapper">
            <a class="elementor-button elementor-size-sm" role="button">
              <span class="elementor-button-text">Apply Now</span>
            </a>
          </div>
        </div>
      </div>
    </main>

    <script>
      var pum_popups = {"pum-14016":{"id":14016,"slug":"career-form"}};
    </script>
  </body>
</html>
`

test('Numeros Motors scraper validates the verified homepage, careers handoff, and public open positions page', async () => {
  const numerosMotors = await loadNumerosMotorsModule()

  assert.equal(numerosMotors.SOURCE, 'numerosmotors')
  assert.equal(numerosMotors.COMPANY, 'Numeros Motors')
  assert.equal(numerosMotors.HOMEPAGE_URL, 'https://numerosmotors.com/')
  assert.equal(numerosMotors.CAREERS_URL, 'https://numerosmotors.com/careers/')
  assert.equal(numerosMotors.OPEN_POSITIONS_URL, 'https://numerosmotors.com/open-positions/')
  assert.equal(numerosMotors.APPLY_URL, 'https://numerosmotors.com/open-positions/')
  assert.equal(numerosMotors.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(numerosMotors.extractCareersUrlFromHomepage(officialHomepageHtml), numerosMotors.CAREERS_URL)
  assert.equal(numerosMotors.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(numerosMotors.extractOpenPositionsUrl(officialCareersHtml), numerosMotors.OPEN_POSITIONS_URL)
  assert.equal(numerosMotors.hasOfficialOpenPositionsSignal(officialOpenPositionsHtml), true)

  const jobs = numerosMotors.extractOpenings(officialOpenPositionsHtml)

  assert.equal(jobs.length, 6)
  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'Senior Engineer - Embedded Hardware',
      'Manager - Sales (Chennai)',
      'Applied Research Engineer - Electrical & Electronics (Advanced Engineering & Research)',
      'Intern - Marketing',
      'Lead - IP & Strategy',
      'Senior Manager - Sales (Kerala)',
    ],
  )
  assert.deepEqual(jobs[0], {
    title: 'Senior Engineer - Embedded Hardware',
    department: null,
    location: null,
    city: null,
    country: 'India',
    sourceUrl: 'https://numerosmotors.com/open-positions/',
    applyUrl: 'https://numerosmotors.com/open-positions/',
    jobId: 'numerosmotors-senior-engineer-embedded-hardware',
    requisitionId: 'numerosmotors-senior-engineer-embedded-hardware',
    employmentType: null,
    experienceRequired: '04-06 Year of Exp.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Official Numeros Motors opening listed on the public open positions page. Experience: 04-06 Year of Exp.',
    remoteStatus: null,
  })
  assert.deepEqual(jobs[1], {
    title: 'Manager - Sales (Chennai)',
    department: null,
    location: 'Chennai, India',
    city: 'Chennai',
    country: 'India',
    sourceUrl: 'https://numerosmotors.com/open-positions/',
    applyUrl: 'https://numerosmotors.com/open-positions/',
    jobId: 'numerosmotors-manager-sales-chennai',
    requisitionId: 'numerosmotors-manager-sales-chennai',
    employmentType: null,
    experienceRequired: '08-12 Year of Exp.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Official Numeros Motors opening listed on the public open positions page. Location: Chennai, India. Experience: 08-12 Year of Exp.',
    remoteStatus: null,
  })
  assert.equal(jobs[2].location, null)
  assert.equal(jobs[3].employmentType, 'Internship')
  assert.equal(jobs[4].experienceRequired, '10-15 Year of Exp.')
  assert.equal(jobs[5].location, 'Kerala, India')
  assert.equal(jobs[5].city, null)
})

test('Numeros Motors run validates the verified first-party flow and decorates the scraped openings', async () => {
  const numerosMotors = await loadNumerosMotorsModule()
  const requestedUrls = []

  const jobs = await numerosMotors.createNumerosMotorsScraper({
    now: () => '2026-07-11T09:30:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === numerosMotors.HOMEPAGE_URL) return officialHomepageHtml
      if (url === numerosMotors.CAREERS_URL) return officialCareersHtml
      if (url === numerosMotors.OPEN_POSITIONS_URL) return officialOpenPositionsHtml

      throw new Error(`Unexpected Numeros Motors URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    numerosMotors.HOMEPAGE_URL,
    numerosMotors.CAREERS_URL,
    numerosMotors.OPEN_POSITIONS_URL,
  ])
  assert.equal(jobs.length, 6)
  assert.deepEqual(jobs[0], {
    title: 'Senior Engineer - Embedded Hardware',
    department: null,
    company: 'Numeros Motors',
    location: null,
    city: null,
    country: 'India',
    source: 'numerosmotors',
    companyCareerPage: 'https://numerosmotors.com/open-positions/',
    companyDomain: 'numerosmotors.com',
    atsPlatform: 'official-company-careers',
    sourceUrl: 'https://numerosmotors.com/open-positions/',
    applyUrl: 'https://numerosmotors.com/open-positions/',
    link: 'https://numerosmotors.com/open-positions/',
    jobId: 'numerosmotors-senior-engineer-embedded-hardware',
    requisitionId: 'numerosmotors-senior-engineer-embedded-hardware',
    employmentType: null,
    experienceRequired: '04-06 Year of Exp.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Official Numeros Motors opening listed on the public open positions page. Experience: 04-06 Year of Exp.',
    remoteStatus: null,
    scrapedAt: '2026-07-11T09:30:00.000Z',
  })
  assert.equal(jobs[3].employmentType, 'Internship')
  assert.equal(jobs[4].jobId, 'numerosmotors-lead-ip-strategy')
})

test('Numeros Motors fails closed when the verified homepage handoff or jobs surface drifts', async () => {
  const numerosMotors = await loadNumerosMotorsModule()

  await assert.rejects(
    numerosMotors.createNumerosMotorsScraper().run({
      fetchText: async (url) => {
        if (url === numerosMotors.HOMEPAGE_URL) {
          return '<html><head><title>Unexpected</title></head><body></body></html>'
        }

        throw new Error(`Unexpected Numeros Motors URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    numerosMotors.createNumerosMotorsScraper().run({
      fetchText: async (url) => {
        if (url === numerosMotors.HOMEPAGE_URL) return officialHomepageHtml
        if (url === numerosMotors.CAREERS_URL) {
          return officialCareersHtml.replace('/open-positions', '/join-us')
        }

        throw new Error(`Unexpected Numeros Motors URL: ${url}`)
      },
    }),
    /verified open positions handoff/i,
  )

  await assert.rejects(
    numerosMotors.createNumerosMotorsScraper().run({
      fetchText: async (url) => {
        if (url === numerosMotors.HOMEPAGE_URL) return officialHomepageHtml
        if (url === numerosMotors.CAREERS_URL) return officialCareersHtml
        if (url === numerosMotors.OPEN_POSITIONS_URL) {
          return officialOpenPositionsHtml.replaceAll('Apply Now', 'Submit Resume')
        }

        throw new Error(`Unexpected Numeros Motors URL: ${url}`)
      },
    }),
    /verified open positions page/i,
  )
})
