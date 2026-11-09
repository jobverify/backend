import assert from 'node:assert/strict'
import test from 'node:test'

const foreignOnlyCareersHtml = `
  <main>
    <h1>Careers</h1>
    <h2>Come Work With Us!</h2>
    <p>CIMCON is an expert in end to end AI, EUC and Model Risk management. We build software that has helped hundreds of organizations around the world gain error-free EUCs and models and dramatically reduce their risks through automation.</p>
    <h3>Current Openings</h3>
    <p><strong>Software Developer, Systems Software</strong> (work in Westford, MA) to research, design, develop &amp; test s/w: Requires Bachelor+12 months relevant experience. Required experience must include 12 months using Oracle. Will accept foreign educational equivalent of required degree.</p>
    <p>Send resume to: CIMCON Software, L.L.C., 234 Littleton Rd, Ste 2H, Westford, MA 01886</p>
    <p><a href="https://cimcon.com/referrals/">See our Employee Referral Incentive Program</a></p>
  </main>
`

const indiaOpeningCareersHtml = `
  <main>
    <h1>Careers</h1>
    <h2>Come Work With Us!</h2>
    <p>CIMCON is an expert in end to end AI, EUC and Model Risk management. We build software that has helped hundreds of organizations around the world gain error-free EUCs and models and dramatically reduce their risks through automation.</p>
    <h3>Current Openings</h3>
    <p><strong>Software Developer, Systems Software</strong> (work in Ahmedabad, India) to research, design, develop &amp; test s/w using Oracle.</p>
    <p>Send resume to: CIMCON Software India Pvt. Ltd., Ahmedabad, India</p>
  </main>
`

test('CIMCON verifies the current official careers page and recognizes the live foreign-only opening', async () => {
  const cimcon = await import('../../scraper/cimcon/script.js')
  const requests = []

  assert.equal(cimcon.CAREERS_PAGE_URL, 'https://cimcon.com/about-us/careers/')
  assert.equal(cimcon.hasOfficialCareersSignal(foreignOnlyCareersHtml), true)
  assert.deepEqual(cimcon.extractCurrentOpenings(foreignOnlyCareersHtml), [
    {
      title: 'Software Developer, Systems Software',
      location: 'Westford, MA',
      description: 'Software Developer, Systems Software (work in Westford, MA) to research, design, develop & test s/w: Requires Bachelor+12 months relevant experience. Required experience must include 12 months using Oracle. Will accept foreign educational equivalent of required degree.',
    },
  ])

  const jobs = await cimcon.createCimconScraper().run({
    fetchText: async (url) => {
      requests.push(url)
      return foreignOnlyCareersHtml
    },
  })

  assert.deepEqual(requests, [cimcon.CAREERS_PAGE_URL])
  assert.deepEqual(jobs, [])
})

test('CIMCON returns a structured India job when the verified openings section exposes one', async () => {
  const cimcon = await import('../../scraper/cimcon/script.js')

  const jobs = await cimcon.createCimconScraper().run({
    fetchText: async () => indiaOpeningCareersHtml,
    now: () => '2026-08-14T00:00:00.000Z',
  })

  assert.deepEqual(jobs, [
    {
      title: 'Software Developer, Systems Software',
      company: 'CIMCON Software India Pvt. Ltd.',
      location: 'Ahmedabad, India',
      city: 'Ahmedabad',
      country: 'India',
      link: 'https://cimcon.com/about-us/careers/',
      applyUrl: 'https://cimcon.com/about-us/careers/',
      sourceUrl: 'https://cimcon.com/about-us/careers/',
      source: 'cimcon',
      jobId: 'software-developer-systems-software-ahmedabad-india',
      requisitionId: 'software-developer-systems-software-ahmedabad-india',
      department: null,
      employmentType: null,
      experienceRequired: null,
      postingDate: null,
      closingDate: null,
      jobDescription: 'Software Developer, Systems Software (work in Ahmedabad, India) to research, design, develop & test s/w using Oracle.',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      remoteStatus: 'On-site',
      scrapedAt: '2026-08-14T00:00:00.000Z',
    },
  ])
})

test('CIMCON fails closed when the verified current openings surface changes materially', async () => {
  const cimcon = await import('../../scraper/cimcon/script.js')

  await assert.rejects(
    cimcon.createCimconScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified official careers page/i,
  )
})
