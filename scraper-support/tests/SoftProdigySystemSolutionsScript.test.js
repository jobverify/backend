import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/softprodigysystemsolutions/script.js')
  } catch {
    assert.fail('Expected SoftProdigy System Solutions scraper module at ../../scraper/softprodigysystemsolutions/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>SoftProdigy | AI &amp; Software Development Services</title>
  </head>
  <body>
    <p>Agentic AI Consulting that Simplifies Smart Decisions</p>
    <a href="https://softprodigy.com/contact-us/">Get in Touch</a>
    <p>Start Your AI Strategy Session</p>
    <p>Digital Transformation , Engineered for Impact</p>
    <p>Become a Smarter Business</p>
    <a href="https://softprodigy.keka.com/careers/">Careers</a>
  </body>
</html>
`

const kekaBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>SoftProdigy Careers</title>
  </head>
  <body>
    <h1>Be a part of building something great</h1>
    <p>Browse all jobs</p>
    <footer>
      SoftProdigy System Solutions Pvt. Ltd. &copy; 2026 Keka Hire. Powered by
      <a href="https://www.keka.com" target="_blank">Keka</a>
    </footer>
  </body>
</html>
`

const kekaActiveJobsPayload = [
  {
    id: 133656,
    title: 'Software Developer',
    jobLocations: [
      {
        name: 'Sahibzada Ajit Singh Nagar',
        city: 'Sahibzada Ajit Singh Nagar',
        countryName: 'India',
      },
    ],
    jobType: 2,
  },
  {
    id: 129380,
    title: 'Internship cum Job Opportunity - Hiring Interns (2025 & 2026 Batch)',
    jobLocations: [],
    jobType: 2,
  },
  {
    id: 118126,
    title: 'PPC Analyst',
    jobLocations: [
      {
        name: 'Mohali',
        city: 'Mohali',
        countryName: 'India',
      },
    ],
    jobType: 2,
  },
]

test('SoftProdigy System Solutions validates the verified homepage handoff and extracts jobs from the live Keka active-jobs payload', async () => {
  const softProdigy = await loadModule()

  assert.equal(softProdigy.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(
    softProdigy.extractKekaBoardUrl(homepageHtml),
    'https://softprodigy.keka.com/careers/',
  )
  assert.equal(softProdigy.hasKekaBoardSignal(kekaBoardHtml), true)
  assert.deepEqual(softProdigy.extractJobCards(kekaActiveJobsPayload), [
    {
      title: 'Software Developer',
      location: 'Sahibzada Ajit Singh Nagar, India',
      city: 'Sahibzada Ajit Singh Nagar',
      employmentType: 'Full-Time',
      sourceUrl: 'https://softprodigy.keka.com/careers/jobdetails/133656',
      applyUrl: 'https://softprodigy.keka.com/careers/jobdetails/133656',
      jobId: 133656,
    },
    {
      title: 'Internship cum Job Opportunity - Hiring Interns (2025 & 2026 Batch)',
      location: 'India',
      city: null,
      employmentType: 'Full-Time',
      sourceUrl: 'https://softprodigy.keka.com/careers/jobdetails/129380',
      applyUrl: 'https://softprodigy.keka.com/careers/jobdetails/129380',
      jobId: 129380,
    },
    {
      title: 'PPC Analyst',
      location: 'Mohali, India',
      city: 'Mohali',
      employmentType: 'Full-Time',
      sourceUrl: 'https://softprodigy.keka.com/careers/jobdetails/118126',
      applyUrl: 'https://softprodigy.keka.com/careers/jobdetails/118126',
      jobId: 118126,
    },
  ])
})

test('SoftProdigy System Solutions run returns normalized jobs from the verified Keka board and public active-jobs API', async () => {
  const softProdigy = await loadModule()
  const requestedUrls = []

  const jobs = await softProdigy.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === softProdigy.HOMEPAGE_URL) return homepageHtml
      if (url === softProdigy.KEKA_BOARD_URL) return kekaBoardHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, softProdigy.KEKA_ACTIVE_JOBS_API_URL)
      return kekaActiveJobsPayload
    },
    now: () => '2026-07-27T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    softProdigy.HOMEPAGE_URL,
    softProdigy.KEKA_BOARD_URL,
    softProdigy.KEKA_ACTIVE_JOBS_API_URL,
  ])
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      link: job.link,
      source: job.source,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Software Developer',
        location: 'Sahibzada Ajit Singh Nagar, India',
        link: 'https://softprodigy.keka.com/careers/jobdetails/133656',
        source: 'softprodigysystemsolutions',
        scrapedAt: '2026-07-27T00:00:00.000Z',
      },
      {
        title: 'Internship cum Job Opportunity - Hiring Interns (2025 & 2026 Batch)',
        location: 'India',
        link: 'https://softprodigy.keka.com/careers/jobdetails/129380',
        source: 'softprodigysystemsolutions',
        scrapedAt: '2026-07-27T00:00:00.000Z',
      },
      {
        title: 'PPC Analyst',
        location: 'Mohali, India',
        link: 'https://softprodigy.keka.com/careers/jobdetails/118126',
        source: 'softprodigysystemsolutions',
        scrapedAt: '2026-07-27T00:00:00.000Z',
      },
    ],
  )
})

test('SoftProdigy System Solutions fails closed when the homepage handoff or Keka board shell changes', async () => {
  const softProdigy = await loadModule()

  await assert.rejects(
    softProdigy.run({
      fetchText: async (url) => {
        if (url === softProdigy.HOMEPAGE_URL) {
          return '<html><body><a href="/career/">Careers</a></body></html>'
        }
        return kekaBoardHtml
      },
    }),
    /verified homepage careers handoff/i,
  )

  await assert.rejects(
    softProdigy.run({
      fetchText: async (url) => {
        if (url === softProdigy.HOMEPAGE_URL) return homepageHtml
        return '<html><body><h1>Contact us</h1></body></html>'
      },
    }),
    /verified keka board shell/i,
  )
})
