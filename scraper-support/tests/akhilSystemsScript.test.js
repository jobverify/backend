import assert from 'node:assert/strict'
import test from 'node:test'

const loadAkhilSystemsModule = async () => {
  try {
    return await import('../../scraper/akhilsystems/script.js')
  } catch {
    assert.fail('Expected Akhil Systems scraper module at ../../scraper/akhilsystems/script.js')
  }
}

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Healthcare Software Solutions | Hospital Information System | Akhil Systems</title>
  </head>
  <body>
    <header>
      <nav>
        <a href="/Aboutus/" class="nav-link">About Us</a>
        <a href="/OurCareer" class="nav-link">Career</a>
        <a href="/contact/" class="nav-link">Contact Us</a>
      </nav>
    </header>
    <main>
      <h1>Healthcare Software Solutions</h1>
      <p>Akhil Systems Pvt. Ltd.</p>
      <p>Hospital Information System</p>
    </main>
    <footer>
      <p>© 2023 Akhil Systems Pvt. Ltd. All rights reserved.</p>
    </footer>
  </body>
</html>
`

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Akhil Systems &mdash; Join Our Healthcare Mission</title>
    <link rel="canonical" href="https://akhilsystems.com/OurCareer/" />
  </head>
  <body>
    <main>
      <h1>Join our mission to transform healthcare through innovation and technology.</h1>
      <h2>Filter on Jobs</h2>
      <div class="box-career-show border p-3 mb-3">
        <div><span class="font-medium">Designation:</span><span>Lead- Scrum Master</span></div>
        <div><span class="font-medium">Job Location:</span><span>Gurugram</span></div>
        <div><span class="font-medium">Experience Level:</span><span>8-10 Years</span></div>
        <div><span class="font-medium">No. of Opening:</span><span>1</span></div>
      </div>
      <div class="box-career-show border p-3 mb-3">
        <div><span class="font-medium">Designation:</span><span>AI Solutions Architect</span></div>
        <div><span class="font-medium">Job Location:</span><span>Gurugram</span></div>
        <div><span class="font-medium">Experience Level:</span><span>5-8 Years</span></div>
        <div><span class="font-medium">No. of Opening:</span><span>1</span></div>
      </div>
    </main>
  </body>
</html>
`

test('Akhil Systems helpers stay pinned to the verified homepage Career link and canonical careers card contract', async () => {
  const akhilSystems = await loadAkhilSystemsModule()

  assert.equal(akhilSystems.SOURCE, 'akhilsystems')
  assert.equal(akhilSystems.COMPANY, 'Akhil Systems')
  assert.equal(akhilSystems.VERIFIED_AT, '2026-07-19')
  assert.equal(akhilSystems.HOMEPAGE_URL, 'https://akhilsystems.com/')
  assert.equal(akhilSystems.CAREERS_ALIAS_URL, 'https://akhilsystems.com/OurCareer/')
  assert.equal(akhilSystems.CAREERS_URL, 'https://akhilsystems.com/OurCareer/')
  assert.deepEqual(akhilSystems.ACCEPTED_CAREERS_URLS, [
    'https://akhilsystems.com/OurCareer',
    'https://akhilsystems.com/OurCareer/',
  ])

  assert.equal(akhilSystems.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(
    akhilSystems.extractHomepageCareerUrl(officialHomepageHtml),
    'https://akhilsystems.com/OurCareer',
  )
  assert.equal(akhilSystems.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.deepEqual(akhilSystems.extractCareerListings(officialCareersHtml), [
    {
      title: 'Lead- Scrum Master',
      location: 'Gurugram',
      experienceRequired: '8-10 Years',
      openings: '1',
    },
    {
      title: 'AI Solutions Architect',
      location: 'Gurugram',
      experienceRequired: '5-8 Years',
      openings: '1',
    },
  ])
})

test('Akhil Systems run extracts the verified inline first-party careers cards into normalized India jobs', async () => {
  const akhilSystems = await loadAkhilSystemsModule()
  const requestedUrls = []

  const jobs = await akhilSystems.createAkhilSystemsScraper({
    now: () => '2026-07-15T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === akhilSystems.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          html: officialHomepageHtml,
        }
      }

      if (url === akhilSystems.CAREERS_URL) {
        return {
          status: 200,
          url,
          html: officialCareersHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    akhilSystems.HOMEPAGE_URL,
    akhilSystems.CAREERS_URL,
  ])
  assert.equal(jobs.length, 2)

  assert.deepEqual(jobs[0], {
    title: 'Lead- Scrum Master',
    company: 'Akhil Systems',
    location: 'Gurugram, India',
    city: 'Gurgaon',
    country: 'India',
    link: 'https://akhilsystems.com/OurCareer/',
    applyUrl: 'https://akhilsystems.com/OurCareer/',
    sourceUrl: 'https://akhilsystems.com/OurCareer/',
    source: 'akhilsystems',
    jobId: 'lead-scrum-master-gurugram',
    requisitionId: 'lead-scrum-master-gurugram',
    department: null,
    employmentType: null,
    experienceRequired: '8-10 Years',
    jobDescription: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    remoteStatus: 'On-site',
    scrapedAt: '2026-07-15T00:00:00.000Z',
  })

  assert.deepEqual(jobs[1], {
    title: 'AI Solutions Architect',
    company: 'Akhil Systems',
    location: 'Gurugram, India',
    city: 'Gurgaon',
    country: 'India',
    link: 'https://akhilsystems.com/OurCareer/',
    applyUrl: 'https://akhilsystems.com/OurCareer/',
    sourceUrl: 'https://akhilsystems.com/OurCareer/',
    source: 'akhilsystems',
    jobId: 'ai-solutions-architect-gurugram',
    requisitionId: 'ai-solutions-architect-gurugram',
    department: null,
    employmentType: null,
    experienceRequired: '5-8 Years',
    jobDescription: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    remoteStatus: 'On-site',
    scrapedAt: '2026-07-15T00:00:00.000Z',
  })
})

test('Akhil Systems fails closed when the verified homepage Career route or inline careers cards drift', async () => {
  const akhilSystems = await loadAkhilSystemsModule()

  await assert.rejects(
    akhilSystems.createAkhilSystemsScraper().run({
      fetchPage: async (url) => {
        if (url === akhilSystems.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: officialHomepageHtml.replace('/OurCareer', 'https://jobs.lever.co/akhilsystems'),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified homepage career navigation/i,
  )

  await assert.rejects(
    akhilSystems.createAkhilSystemsScraper().run({
      fetchPage: async (url) => {
        if (url === akhilSystems.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: officialHomepageHtml,
          }
        }

        if (url === akhilSystems.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Careers</h1></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official careers surface/i,
  )

  await assert.rejects(
    akhilSystems.createAkhilSystemsScraper().run({
      fetchPage: async (url) => {
        if (url === akhilSystems.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: officialHomepageHtml,
          }
        }

        if (url === akhilSystems.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: officialCareersHtml.replace(/No\. of Opening:/g, 'Openings Total:'),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /trusted first-party job cards/i,
  )
})

test('Akhil Systems reports an API-only migration error when its official careers request is blocked', async () => {
  const akhilSystems = await loadAkhilSystemsModule()

  await assert.rejects(
    akhilSystems.createAkhilSystemsScraper().run({
      fetchPage: async () => { throw new Error('HTTP 403') },
    }),
    /akhil systems API-only migration.*HTTP 403/i,
  )
})
