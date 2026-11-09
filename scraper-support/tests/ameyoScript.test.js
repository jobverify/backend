import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-15T00:00:00.000Z'

const homepageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Call Center Software | Call Center Solution | Helpdesk Software - Ameyo</title>
    <link rel="canonical" href="https://www.ameyo.com/" />
  </head>
  <body>
    <nav>
      <a href="https://exotel.com/careers/">Careers</a>
      <a href="https://exotel.com/newsroom/">Newsroom</a>
    </nav>
    <p>Ameyo XTRM by Exotel, an all-new CCaaS solution powered with conversational AI</p>
  </body>
</html>
`

const currentHomepageHtml = homepageHtml
  .replace('<a href="https://exotel.com/careers/">Careers</a>', '<img src="/wp-content/uploads/2023/04/ameyo-by-exotel-logo.svg">')

const upstreamCareersHtml = `
<!doctype html>
<html lang="en-IN">
  <head>
    <title>Careers | Exotel</title>
    <link rel="canonical" href="https://exotel.com/about-us/careers/" />
  </head>
  <body>
    <h1>Build what connects the world</h1>
    <h2>Find the job that matches your skills</h2>
    <div id="rbox-loader-script">
      <div></div>
      <div></div>
      <div class="rbox-opening-list"></div>
    </div>
  </body>
</html>
`

const homepage522Html = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>kinsta.cloud | 522: Connection timed out</title>
  </head>
  <body>
    <div id="cf-error-details">
      <h1>Connection timed out</h1>
      <span>Error code 522</span>
    </div>
  </body>
</html>
`

const openingsPayload = [
  {
    id: 701455,
    title: 'Business Operations - Intern',
    position_type: 'Full-time',
    location: {
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
    },
    company_name: 'Exotel Techcom Pvt Ltd',
    job_code: 'exotel73617',
    team: 'OPERATIONS',
    description: '<h1>About us</h1><p>Exotel builds customer communication software.</p>',
  },
  {
    id: 701172,
    title: 'Senior Manager - TAM',
    position_type: 'Full-time',
    location: {
      city: 'Bengaluru/Gurugram',
      state: null,
      country: null,
    },
    company_name: 'Exotel Techcom Pvt Ltd',
    job_code: 'exotel202967',
    team: 'Customer Operations',
    description: '<h2>Location: Bangalore / Gurugram</h2><p>Lead strategic customer programs.</p>',
  },
  {
    id: 700001,
    title: 'Dubai Role',
    position_type: 'Full-time',
    location: {
      city: 'Dubai',
      state: null,
      country: 'United Arab Emirates',
    },
    company_name: 'Exotel Techcom Pvt Ltd',
    job_code: 'exotel00001',
    team: 'Other',
    description: '<p>Ignore this non-India role.</p>',
  },
]

const loadModule = async () => {
  try {
    return await import('../../scraper/ameyo/script.js')
  } catch {
    assert.fail('Expected Ameyo scraper module at ../../scraper/ameyo/script.js')
  }
}

test('Ameyo constants and validators stay pinned to the verified homepage handoff and Recruiterbox feed', async () => {
  const ameyo = await loadModule()

  assert.equal(ameyo.COMPANY_NAME, 'Ameyo')
  assert.equal(ameyo.SOURCE, 'ameyo')
  assert.equal(ameyo.COUNTRY_FILTER, 'India')
  assert.equal(ameyo.HOMEPAGE_URL, 'https://www.ameyo.com/')
  assert.equal(ameyo.OFFICIAL_CAREERS_HANDOFF_URL, 'https://exotel.com/careers/')
  assert.equal(ameyo.CAREERS_HOME_URL, 'https://exotel.com/about-us/careers/')
  assert.equal(ameyo.OPENINGS_API_URL, 'https://app.recruiterbox.com/widget/2176/openings/')
  assert.equal(
    ameyo.VERIFIED_UPSTREAM_JOB_URL,
    'https://app.recruiterbox.com/widget/2176/opening/708128/',
  )
  assert.equal(ameyo.UPSTREAM_COMPANY_NAME, 'Exotel Techcom Pvt Ltd')
  assert.equal(ameyo.extractCareersUrl(homepageHtml), ameyo.OFFICIAL_CAREERS_HANDOFF_URL)
  assert.equal(ameyo.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(ameyo.hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(
    ameyo.hasExpectedHomepageOutageSignal({
      status: 522,
      url: 'https://www.ameyo.com/',
      html: homepage522Html,
    }),
    true,
  )
  assert.equal(ameyo.hasUpstreamCareersSignal(upstreamCareersHtml), true)

  const jobs = ameyo.extractSearchResults(openingsPayload)
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Business Operations - Intern',
    company: 'Exotel Techcom Pvt Ltd',
    department: 'OPERATIONS',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '701455',
    requisitionId: 'exotel73617',
    sourceUrl: 'https://app.recruiterbox.com/widget/2176/opening/701455/',
    applyUrl: 'https://app.recruiterbox.com/widget/2176/opening/701455/',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'About us Exotel builds customer communication software.',
    jobType: 'Full-time',
    additionalLocations: null,
  })
  assert.equal(jobs[1].city, 'Bengaluru/Gurugram')
})

test('run validates the Ameyo homepage handoff, the upstream Exotel careers surface, and decorates India jobs', async () => {
  const ameyo = await loadModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await ameyo.createAmeyoScraper({ maxJobs: 1, now: () => FIXED_SCRAPED_AT }).run({
    fetchPage: async (url) => {
      if (url === ameyo.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      throw new Error(`Unexpected Ameyo page fixture URL: ${url}`)
    },
    fetchText: async (url) => {
      requestedTextUrls.push(url)

      if (url === ameyo.CAREERS_HOME_URL) return upstreamCareersHtml

      throw new Error(`Unexpected Ameyo text fixture URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)

      if (url === ameyo.OPENINGS_API_URL) return openingsPayload

      throw new Error(`Unexpected Ameyo JSON fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTextUrls, [
    ameyo.CAREERS_HOME_URL,
  ])
  assert.deepEqual(requestedJsonUrls, [ameyo.OPENINGS_API_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'ameyo')
  assert.equal(jobs[0].company, 'Ameyo')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('run accepts the current Exotel-branded Ameyo homepage without careers navigation while verifying upstream jobs', async () => {
  const ameyo = await loadModule()
  const jobs = await ameyo.createAmeyoScraper().run({
    fetchPage: async (url) => ({ status: 200, url, html: currentHomepageHtml }),
    fetchText: async () => upstreamCareersHtml,
    fetchJson: async () => openingsPayload,
  })
  assert.equal(jobs.length, 2)
})

test('run continues through the verified Ameyo homepage 522 outage while the upstream Exotel careers surface and Recruiterbox feed remain healthy', async () => {
  const ameyo = await loadModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await ameyo.createAmeyoScraper({ maxJobs: 1, now: () => FIXED_SCRAPED_AT }).run({
    fetchPage: async (url) => {
      if (url === ameyo.HOMEPAGE_URL) {
        return {
          status: 522,
          url,
          html: homepage522Html,
        }
      }

      throw new Error(`Unexpected Ameyo page fixture URL: ${url}`)
    },
    fetchText: async (url) => {
      requestedTextUrls.push(url)

      if (url === ameyo.CAREERS_HOME_URL) return upstreamCareersHtml

      throw new Error(`Unexpected Ameyo text fixture URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)

      if (url === ameyo.OPENINGS_API_URL) return openingsPayload

      throw new Error(`Unexpected Ameyo JSON fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTextUrls, [ameyo.CAREERS_HOME_URL])
  assert.deepEqual(requestedJsonUrls, [ameyo.OPENINGS_API_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'ameyo')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('Ameyo continues after a homepage connection timeout only through the verified Exotel board', async () => {
  const ameyo = await loadModule()
  const outage = new TypeError('fetch failed', { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } })
  const options = {
    fetchPage: async () => { throw outage },
    fetchText: async () => upstreamCareersHtml,
    fetchJson: async () => openingsPayload,
  }
  const jobs = await ameyo.createAmeyoScraper().run(options)
  assert.equal(jobs.length, 2)
  await assert.rejects(ameyo.createAmeyoScraper().run({ ...options,
    fetchText: async () => '<title>Unrelated careers page</title>',
  }), /upstream careers page/i)
  await assert.rejects(ameyo.createAmeyoScraper().run({ ...options,
    fetchPage: async () => { throw new Error('Certificate identity mismatch') },
  }), /Certificate identity mismatch/)
})

test('Ameyo scraper fails closed when the homepage handoff, upstream careers page, or openings feed drifts', async () => {
  const ameyo = await loadModule()

  await assert.rejects(
    ameyo.createAmeyoScraper().run({
      fetchPage: async (url) => {
        if (url === ameyo.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml.replaceAll('https://exotel.com/careers/', 'https://exotel.com/jobs/') }
        }

        throw new Error(`Unexpected Ameyo page fixture URL: ${url}`)
      },
      fetchText: async (url) => {
        throw new Error(`Unexpected Ameyo text fixture URL: ${url}`)
      },
      fetchJson: async () => openingsPayload,
    }),
    /homepage handoff/i,
  )

  await assert.rejects(
    ameyo.createAmeyoScraper().run({
      fetchPage: async (url) => {
        if (url === ameyo.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        throw new Error(`Unexpected Ameyo page fixture URL: ${url}`)
      },
      fetchText: async (url) => {
        if (url === ameyo.CAREERS_HOME_URL) {
          return upstreamCareersHtml.replace('rbox-opening-list', 'openings-placeholder')
        }

        throw new Error(`Unexpected Ameyo text fixture URL: ${url}`)
      },
      fetchJson: async () => openingsPayload,
    }),
    /upstream careers page/i,
  )

  await assert.rejects(
    ameyo.createAmeyoScraper().run({
      fetchPage: async (url) => {
        if (url === ameyo.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        throw new Error(`Unexpected Ameyo page fixture URL: ${url}`)
      },
      fetchText: async (url) => {
        if (url === ameyo.CAREERS_HOME_URL) return upstreamCareersHtml

        throw new Error(`Unexpected Ameyo text fixture URL: ${url}`)
      },
      fetchJson: async () => ({ jobs: openingsPayload }),
    }),
    /openings feed/i,
  )
})
