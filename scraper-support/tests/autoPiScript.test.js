import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-15T00:00:00.000Z'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join Our Team | AutoPi Careers</title>
  </head>
  <body>
    <main>
      <h1>Join our team</h1>
      <section>
        <div>// open positions</div>
        <h2>Roles we're hiring for</h2>
      </section>

      <div class="role-card">
        <h4>Software Developer Full Time</h4>
        <span>Aalborg, Denmark</span>
        <span>Full-time</span>
        <p>AutoPi is looking for a Software Developer for our headquarters in Aalborg to support our continued growth.</p>
        <a class="stretched-link" href="/careers/software-developer/"></a>
      </div>

      <div class="role-card">
        <h4>Student Software Developer</h4>
        <span>Aalborg, Denmark</span>
        <span>Student Position</span>
        <p>As a Student Software Developer, unleash your passion and develop your IT skills with a growing company.</p>
        <a class="stretched-link" href="/careers/student-softwate-developer/"></a>
      </div>
    </main>
  </body>
</html>
`

const indiaCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join Our Team | AutoPi Careers</title>
  </head>
  <body>
    <main>
      <h1>Join our team</h1>
      <section>
        <div>// open positions</div>
        <h2>Roles we're hiring for</h2>
      </section>

      <div class="role-card">
        <h4>Embedded Software Engineer</h4>
        <span>Bengaluru, India</span>
        <span>Full-time</span>
        <p>Help build connected mobility software for a growing AutoPi engineering team.</p>
        <a class="stretched-link" href="/careers/embedded-software-engineer-india/"></a>
      </div>
    </main>
  </body>
</html>
`

const indiaRoleDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Embedded Software Engineer | AutoPi.io</title>
  </head>
  <body>
    <main>
      <article>
        <h1>Embedded Software Engineer</h1>
        <p>Join AutoPi to build production-grade connected vehicle software and diagnostics tooling.</p>
      </article>
      <aside>
        <div>// apply now</div>
        <p>Send your CV and resume to us directly and we'll get back to you shortly.</p>
        <a href="mailto:jobs@autopi.io">Apply at jobs@autopi.io</a>
        <dl>
          <dt>Location</dt>
          <dd>Bengaluru, India</dd>
          <dt>Job type</dt>
          <dd>Full-time</dd>
        </dl>
      </aside>
    </main>
  </body>
</html>
`

const invalidCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>AutoPi Careers</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>Join us someday.</p>
    </main>
  </body>
</html>
`

const invalidRoleDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Embedded Software Engineer | AutoPi.io</title>
  </head>
  <body>
    <main>
      <article>
        <h1>Embedded Software Engineer</h1>
      </article>
      <aside>
        <dl>
          <dt>Location</dt>
          <dd>Bengaluru, India</dd>
          <dt>Job type</dt>
          <dd>Full-time</dd>
        </dl>
      </aside>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/autopi/script.js')
  } catch {
    assert.fail('Expected AutoPi scraper module at ../../scraper/autopi/script.js')
  }
}

test('AutoPi constants and parsers stay pinned to the verified first-party careers and mailto-apply contract', async () => {
  const autoPi = await loadModule()

  assert.equal(autoPi.COMPANY_NAME, 'AutoPi')
  assert.equal(autoPi.OFFICIAL_BRAND_NAME, 'AutoPi.io')
  assert.equal(autoPi.SOURCE, 'autopi')
  assert.equal(autoPi.COUNTRY_FILTER, 'India')
  assert.equal(autoPi.HOMEPAGE_URL, 'https://www.autopi.io/')
  assert.equal(autoPi.CAREERS_URL, 'https://www.autopi.io/careers/')
  assert.equal(autoPi.APPLICATION_EMAIL, 'jobs@autopi.io')
  assert.equal(autoPi.APPLICATION_URL, 'mailto:jobs@autopi.io')
  assert.deepEqual(autoPi.VERIFIED_ROLE_URLS, [
    'https://www.autopi.io/careers/software-developer/',
    'https://www.autopi.io/careers/student-softwate-developer/',
  ])
  assert.equal(autoPi.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.deepEqual(autoPi.extractRoleCards(officialCareersHtml), [
    {
      title: 'Software Developer Full Time',
      location: 'Aalborg, Denmark',
      employmentType: 'Full-time',
      summary: 'AutoPi is looking for a Software Developer for our headquarters in Aalborg to support our continued growth.',
      sourceUrl: 'https://www.autopi.io/careers/software-developer/',
    },
    {
      title: 'Student Software Developer',
      location: 'Aalborg, Denmark',
      employmentType: 'Student Position',
      summary: 'As a Student Software Developer, unleash your passion and develop your IT skills with a growing company.',
      sourceUrl: 'https://www.autopi.io/careers/student-softwate-developer/',
    },
  ])
  assert.equal(autoPi.isIndiaLocation('Aalborg, Denmark'), false)
  assert.equal(autoPi.isIndiaLocation('Bengaluru, India'), true)
  assert.equal(autoPi.hasOfficialRoleDetailSignal(indiaRoleDetailHtml), true)
  assert.equal(autoPi.extractApplicationEmail(indiaRoleDetailHtml), 'jobs@autopi.io')
})

test('AutoPi run returns no jobs while the verified first-party careers surface has only non-India roles', async () => {
  const autoPi = await loadModule()
  const requestedUrls = []

  const jobs = await autoPi.createAutoPiScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === autoPi.CAREERS_URL) return officialCareersHtml

      throw new Error(`Unexpected AutoPi URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [autoPi.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('AutoPi run can extract an India role when the verified first-party page shape includes one', async () => {
  const autoPi = await loadModule()
  const requestedUrls = []

  const jobs = await autoPi.createAutoPiScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === autoPi.CAREERS_URL) return indiaCareersHtml
      if (url === 'https://www.autopi.io/careers/embedded-software-engineer-india/') {
        return indiaRoleDetailHtml
      }

      throw new Error(`Unexpected AutoPi URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedUrls, [
    autoPi.CAREERS_URL,
    'https://www.autopi.io/careers/embedded-software-engineer-india/',
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Embedded Software Engineer',
      company: 'AutoPi',
      department: null,
      location: 'Bengaluru, India',
      city: 'Bangalore',
      state: null,
      country: 'India',
      jobId: 'embedded-software-engineer-india',
      requisitionId: 'embedded-software-engineer-india',
      sourceUrl: 'https://www.autopi.io/careers/embedded-software-engineer-india/',
      applyUrl: 'mailto:jobs@autopi.io',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Help build connected mobility software for a growing AutoPi engineering team.',
      source: 'autopi',
      link: 'mailto:jobs@autopi.io',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('AutoPi fails closed when the verified careers shell or role detail apply surface drifts materially', async () => {
  const autoPi = await loadModule()

  await assert.rejects(
    autoPi.createAutoPiScraper().run({
      fetchText: async () => invalidCareersHtml,
    }),
    /verified official careers surface/i,
  )

  await assert.rejects(
    autoPi.createAutoPiScraper().run({
      fetchText: async (url) => {
        if (url === autoPi.CAREERS_URL) return indiaCareersHtml
        if (url === 'https://www.autopi.io/careers/embedded-software-engineer-india/') {
          return invalidRoleDetailHtml
        }

        throw new Error(`Unexpected AutoPi URL: ${url}`)
      },
    }),
    /verified role detail surface/i,
  )
})


const emptyOfficialCareersHtml = '<html><head><title>Join Our Team | AutoPi Careers</title></head><body><div>// open positions</div><h2>Roles we\'re hiring for</h2><p>No open positions right now - but we\'re always interested in great people.</p></body></html>'

test('AutoPi returns an empty inventory when its verified careers page explicitly has no open positions', async () => {
  const autoPi = await loadModule()
  const jobs = await autoPi.createAutoPiScraper().run({ fetchText: async () => emptyOfficialCareersHtml })
  assert.deepEqual(jobs, [])
  await assert.rejects(autoPi.createAutoPiScraper().run({ fetchText: async () => emptyOfficialCareersHtml.replace('No open positions right now', 'Please check back later') }), /verified official careers surface/)
})
