import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const ABOUT_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>At Goodera, we are on a mission to make social impact accessible to every team on the planet.</h1>
      <p>What does engineering have to do with volunteering?</p>
      <p>Goodera aims to be the Airbnb of employee volunteering by engaging every workplace with volunteering experiences.</p>
      <p>People of Goodera</p>
      <a href="https://careers.kula.ai/goodera">Careers</a>
    </main>
  </body>
</html>
`

const CONTACT_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Contact Goodera</h1>
      <p>Looking to create meaningful volunteering experiences, design impactful social initiatives, or explore ways to engage your people with purpose?</p>
      <p>Careers</p>
      <p>careers@goodera.com</p>
      <a href="https://careers.kula.ai/goodera">Find a job that you’ll love</a>
      <p>© 2026 Goodera. All rights reserved.</p>
    </main>
  </body>
</html>
`

const buildEscapedKulaHtml = (jobs) => {
  const escapedJobs = JSON.stringify(jobs).replace(/"/g, '\\"')
  return `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Work that powers the world of good.</h1>
      <p>Open Positions</p>
      <p>Explore our current job openings across various departments</p>
      before \\"accountName\\":\\"goodera\\",\\"jobs\\":${escapedJobs},\\"departments\\":[] after
    </main>
  </body>
</html>
`
}

const buildCurrentKulaHtml = (jobs) => {
  const escapedJobs = JSON.stringify(jobs).replace(/"/g, '\\"')
  return `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Goodera | Powering the World of Good</title>
  </head>
  <body>
    <main>
      <h1>Powering the World of Good</h1>
      <p>Open Positions</p>
      <p>Explore our current job openings across various departments</p>
      before \\"accountName\\":\\"goodera\\",\\"jobs\\":${escapedJobs},\\"departments\\":[] after
    </main>
  </body>
</html>
`
}

const loadModule = async () => {
  try {
    return await import('../../scraper/goodera/script.js')
  } catch {
    assert.fail('Expected Goodera scraper module at ../../scraper/goodera/script.js')
  }
}

test('Goodera constants and helpers stay pinned to the verified first-party handoff and public Kula board', async () => {
  const goodera = await loadModule()

  assert.equal(goodera.SOURCE, 'goodera')
  assert.equal(goodera.COMPANY_NAME, 'Goodera')
  assert.equal(goodera.COUNTRY_FILTER, 'India')
  assert.equal(goodera.HOMEPAGE_URL, 'https://www.goodera.com/')
  assert.equal(goodera.ABOUT_US_URL, 'https://www.goodera.com/about/about-us')
  assert.equal(goodera.CAREERS_PAGE_URL, 'https://www.goodera.com/about/contact-us')
  assert.equal(goodera.KULA_COMPANY_URL, 'https://careers.kula.ai/goodera')
  assert.equal(goodera.KULA_JOBS_URL, 'https://careers.kula.ai/goodera?jobs=true')
  assert.equal(goodera.VERIFIED_ON, '2026-07-17')
  assert.equal(goodera.hasAboutUsSignal(ABOUT_HTML), true)
  assert.equal(goodera.hasContactPageSignal(CONTACT_HTML), true)
  assert.equal(goodera.extractKulaCompanyUrl(CONTACT_HTML), 'https://careers.kula.ai/goodera')
  assert.equal(goodera.hasOfficialKulaBoardSignal(buildEscapedKulaHtml([])), true)
  assert.equal(goodera.hasOfficialKulaBoardSignal(buildCurrentKulaHtml([])), true)
  assert.equal(goodera.buildSearchUrl(), goodera.KULA_JOBS_URL)
})

test('Goodera extractSearchResults keeps only India roles from the public Kula board', async () => {
  const goodera = await loadModule()
  const html = buildEscapedKulaHtml([
    {
      id: 40001,
      title: 'AI Engineer',
      listed: true,
      kind: 'external',
      ats_job: {
        employment_type: 'full_time',
        workplace: 'On-Site',
        job_description: 'Build AI workflows for Goodera.',
        ats_department: {
          name: 'Engineering',
        },
        offices: [
          {
            location: 'Bengaluru, Karnataka, India',
            country: 'India',
            remote: false,
          },
        ],
      },
    },
    {
      id: 32968,
      title: 'Skill-Based Volunteering Associate',
      listed: true,
      kind: 'external',
      ats_job: {
        employment_type: 'full_time',
        workplace: 'On-Site',
        job_description: 'Design high-impact skills-based volunteering offerings.',
        ats_department: {
          name: 'New Initiatives',
        },
        offices: [
          {
            location: 'Bengaluru, Karnataka, India',
            country: 'India',
            remote: false,
          },
        ],
      },
    },
    {
      id: 50001,
      title: 'Account Executive',
      listed: true,
      kind: 'external',
      ats_job: {
        employment_type: 'full_time',
        workplace: 'Remote',
        job_description: 'US role that should be filtered out.',
        ats_department: {
          name: 'Sales Global',
        },
        offices: [
          {
            location: 'United States',
            country: 'United States',
            remote: true,
          },
        ],
      },
    },
  ])

  const jobs = goodera.extractSearchResults(html)

  assert.deepEqual(jobs, [
    {
      title: 'AI Engineer',
      company: 'Goodera',
      department: 'Engineering',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: '40001',
      requisitionId: '40001',
      sourceUrl: 'https://careers.kula.ai/goodera/40001/?jobs=true',
      applyUrl: 'https://careers.kula.ai/goodera/40001/?jobs=true',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Build AI workflows for Goodera.',
      remoteStatus: 'On-site',
    },
    {
      title: 'Skill-Based Volunteering Associate',
      company: 'Goodera',
      department: 'New Initiatives',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: '32968',
      requisitionId: '32968',
      sourceUrl: 'https://careers.kula.ai/goodera/32968/?jobs=true',
      applyUrl: 'https://careers.kula.ai/goodera/32968/?jobs=true',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Design high-impact skills-based volunteering offerings.',
      remoteStatus: 'On-site',
    },
  ])
})

test('Goodera run validates the first-party contact handoff and decorates India roles from the public Kula board', async () => {
  const goodera = await loadModule()
  const requestedUrls = []

  const jobs = await goodera.createGooderaScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === goodera.ABOUT_US_URL) return ABOUT_HTML
      if (url === goodera.CAREERS_PAGE_URL) return CONTACT_HTML
      if (url === goodera.KULA_JOBS_URL) {
        return buildEscapedKulaHtml([
          {
            id: 40001,
            title: 'AI Engineer',
            listed: true,
            kind: 'external',
            ats_job: {
              employment_type: 'full_time',
              workplace: 'On-Site',
              ats_department: {
                name: 'Engineering',
              },
              offices: [
                {
                  location: 'Bengaluru, Karnataka, India',
                  country: 'India',
                  remote: false,
                },
              ],
            },
          },
          {
            id: 50001,
            title: 'Account Executive',
            listed: true,
            kind: 'external',
            ats_job: {
              employment_type: 'full_time',
              workplace: 'Remote',
              ats_department: {
                name: 'Sales Global',
              },
              offices: [
                {
                  location: 'United States',
                  country: 'United States',
                  remote: true,
                },
              ],
            },
          },
        ])
      }

      throw new Error(`Unexpected Goodera URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedUrls, [
    goodera.ABOUT_US_URL,
    goodera.CAREERS_PAGE_URL,
    goodera.KULA_JOBS_URL,
  ])
  assert.deepEqual(jobs, [
    {
      title: 'AI Engineer',
      company: 'Goodera',
      department: 'Engineering',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: '40001',
      requisitionId: '40001',
      sourceUrl: 'https://careers.kula.ai/goodera/40001/?jobs=true',
      applyUrl: 'https://careers.kula.ai/goodera/40001/?jobs=true',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
      source: 'goodera',
      sourceListingComplete: false,
      sourceDetailComplete: false,
      link: 'https://careers.kula.ai/goodera/40001/?jobs=true',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Goodera fails closed when the verified first-party handoff or Kula board contract drifts', async () => {
  const goodera = await loadModule()

  await assert.rejects(
    goodera.createGooderaScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified Goodera about page|verified Goodera contact page|verified Goodera Kula jobs board/i,
  )

  await assert.rejects(
    goodera.createGooderaScraper().run({
      fetchText: async (url) => {
        if (url === goodera.ABOUT_US_URL) return ABOUT_HTML
        if (url === goodera.CAREERS_PAGE_URL) {
          return CONTACT_HTML.replace('https://careers.kula.ai/goodera', 'https://careers.kula.ai/other')
        }
        throw new Error(`Unexpected Goodera URL: ${url}`)
      },
    }),
    /verified Goodera contact page no longer links to the expected Kula board/i,
  )

  await assert.rejects(
    goodera.createGooderaScraper().run({
      fetchText: async (url) => {
        if (url === goodera.ABOUT_US_URL) return ABOUT_HTML
        if (url === goodera.CAREERS_PAGE_URL) return CONTACT_HTML
        if (url === goodera.KULA_JOBS_URL) return buildEscapedKulaHtml([])
        throw new Error(`Unexpected Goodera URL: ${url}`)
      },
    }),
    /no longer exposes India roles|verified Goodera Kula jobs board/i,
  )
})
