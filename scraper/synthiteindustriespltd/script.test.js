import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Synthite | Global Leader in Natural Ingredient Solutions for Food, Health & Fragrance</title>
    </head>
    <body>
      <main>
        <h1>The World's Leading Producer of Botanical Extracts</h1>
        <p>At Synthite, we go beyond delivering natural ingredients; we partner with you to craft tailored, high-impact solutions.</p>
        <h2>Built on Experience Engineered for Impact</h2>
        <p>50+ Years. 90+ Countries. 1 Mission.</p>
        <a href="/careers/">Careers</a>
      </main>
    </body>
  </html>
`

const legacyHomepageHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <main>
        <h1>The World's Largest Producer of Value-Added Spices</h1>
        <p>50+ Years. 90+ Countries. 1 Mission.</p>
        <a href="/careers/">Careers</a>
      </main>
    </body>
  </html>
`

const careersLandingHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Careers at Synthite | Job Opportunities | Employee Benefits | Global Natural Ingredients Leader</title>
    </head>
    <body>
      <main>
        <h1>Build Your Career with a Global Leader in Natural Ingredients Innovation</h1>
        <a href="/careers/career-opportunities/">Explore Current Openings</a>
        <section>
          <h2>Career Opportunities</h2>
          <p>Explore current job openings, graduate programs, internships, and international assignments across our worldwide operations.</p>
        </section>
        <section>
          <h2>Employee Experience</h2>
        </section>
      </main>
  </body>
  </html>
`

const careerOpportunitiesHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Career Opportunities at Synthite | Current Jobs | Graduate Programs | Internships | Research Positions</title>
      <meta
        name="description"
        content="Explore diverse career opportunities at Synthite Industries including current openings, graduate programs, internships, research positions, and international assignments across natural ingredients innovation."
      />
    </head>
    <body>
      <main>
        <h1>Explore career opportunities at Synthite across research, manufacturing, business development, and leadership roles.</h1>
        <div class="cursor-pointer">View Current Openings</div>
        <h2>Current Openings</h2>
        <p>We offer structured pathways from graduate entry programs to senior executive roles, supporting career development aligned with organizational goals.</p>
        <h3>Our Opportunity Spectrum Includes</h3>
        <p>Application Access:</p>
        <p>Career Portal: Available through website</p>
        <p>Graduate programs, internships, research positions, and international assignments.</p>
        <p>Email Updates: <a href="mailto:careers@synthite.com">careers@synthite.com</a> for application support and inquiries</p>
      </main>
    </body>
  </html>
`

test('Synthite sentinel validates the verified first-party homepage, careers landing, and current-opportunities surfaces', async () => {
  const synthite = await loadModule()
  assert.ok(synthite, 'Synthite scraper module should load')

  assert.equal(synthite.SOURCE, 'synthiteindustriespltd')
  assert.equal(synthite.COMPANY, 'Synthite Industries (P) Ltd')
  assert.equal(synthite.HOMEPAGE_URL, 'https://www.synthite.com/')
  assert.equal(synthite.CAREERS_URL, 'https://www.synthite.com/careers/')
  assert.equal(synthite.CAREER_OPPORTUNITIES_URL, 'https://www.synthite.com/careers/career-opportunities/')
  assert.equal(synthite.CAREERS_EMAIL, 'careers@synthite.com')
  assert.equal(synthite.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(synthite.hasOfficialHomepageSignal(legacyHomepageHtml), true)
  assert.equal(synthite.hasOfficialCareersLandingSignal(careersLandingHtml), true)
  assert.equal(synthite.hasOfficialCareerOpportunitiesSignal(careerOpportunitiesHtml), true)
  assert.deepEqual(synthite.extractCareerContact(careerOpportunitiesHtml), {
    email: 'careers@synthite.com',
  })
  assert.equal(synthite.hasPublicJobBoardSignal(careerOpportunitiesHtml), false)
})

test('Synthite run returns an empty list while the verified first-party surface exposes only contact handoffs', async () => {
  const synthite = await loadModule()
  assert.ok(synthite, 'Synthite scraper module should load')

  const requestedUrls = []
  const jobs = await synthite.createSynthiteIndustriesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === synthite.HOMEPAGE_URL) return homepageHtml
      if (url === synthite.CAREERS_URL) return careersLandingHtml
      if (url === synthite.CAREER_OPPORTUNITIES_URL) return careerOpportunitiesHtml
      throw new Error(`Unexpected Synthite URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.synthite.com/',
    'https://www.synthite.com/careers/',
    'https://www.synthite.com/careers/career-opportunities/',
  ])
  assert.deepEqual(jobs, [])
})

test('Synthite fails closed when the trusted pages drift or a concrete public jobs surface appears', async () => {
  const synthite = await loadModule()
  assert.ok(synthite, 'Synthite scraper module should load')

  await assert.rejects(
    synthite.createSynthiteIndustriesScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected homepage</h1></body></html>',
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    synthite.createSynthiteIndustriesScraper().run({
      fetchText: async (url) => {
        if (url === synthite.HOMEPAGE_URL) return homepageHtml
        return '<html><body><h1>Unexpected careers page</h1></body></html>'
      },
    }),
    /verified careers landing/i,
  )

  await assert.rejects(
    synthite.createSynthiteIndustriesScraper().run({
      fetchText: async (url) => {
        if (url === synthite.HOMEPAGE_URL) return homepageHtml
        if (url === synthite.CAREERS_URL) return careersLandingHtml
        return careerOpportunitiesHtml.replace(
          '</main>',
          '<a href="https://synthite.darwinbox.in/ms/candidatecareers">Apply now</a></main>',
        )
      },
    }),
    /public jobs surface/i,
  )
})
