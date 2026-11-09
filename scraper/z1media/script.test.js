import assert from 'node:assert/strict'
import test from 'node:test'

const loadZ1MediaModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Z1 Media scraper module at ./script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Z1 Tech - Inventing The Future | Z1 Tech</title>
    <meta property="og:site_name" content="VDO.AI" />
    <link rel="canonical" href="https://app.vdo.ai/" />
  </head>
  <body>
    <nav>
      <a href="/">Home</a>
      <a href="/careers">Careers</a>
      <a href="/contact-us">Contact Us</a>
    </nav>
    <main>
      <h1>Inventing the future of Digital Media and Advertising</h1>
      <p>We are a technology-first company aiming to revolutionize digital content consumption experiences.</p>
      <p>Discover our future-proof solutions and cutting-edge technology to make an everlasting impression.</p>
      <a href="/careers">Join Us</a>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Z1 Tech</title>
    <meta property="og:site_name" content="VDO.AI" />
    <link rel="canonical" href="https://app.vdo.ai/careers" />
  </head>
  <body>
    <nav>
      <a href="/">Home</a>
      <a href="/careers">Careers</a>
    </nav>
    <main>
      <h1>Invent today. Shape tomorrow.</h1>
      <p>If working on innovative technologies and creating a global impact excites you</p>
      <a href="https://jobs.lever.co/z1tech" target="_blank" rel="noreferrer">Join Us</a>
      <section>
        <h2>Life at Z1 Tech</h2>
        <p>We started our current journey back in 2015.</p>
        <p>From a single room in New Delhi to world-class offices and teams around the world.</p>
      </section>
    </main>
  </body>
</html>
`

const leverJobs = [
  {
    id: 'e0fd6fd7-3091-49a7-af24-4d4ec75d4722',
    text: 'Agency Lead',
    hostedUrl: 'https://jobs.lever.co/z1tech/e0fd6fd7-3091-49a7-af24-4d4ec75d4722',
    applyUrl: 'https://jobs.lever.co/z1tech/e0fd6fd7-3091-49a7-af24-4d4ec75d4722/apply',
    createdAt: 1782814615095,
    country: 'IN',
    workplaceType: 'onsite',
    descriptionPlain: 'Lead strategic agency relationships across India.',
    descriptionBodyPlain: 'Lead strategic agency relationships across India.',
    additionalPlain: 'Work closely with ad sales and publisher teams.',
    categories: {
      commitment: 'Full Time',
      department: 'Ad Sales',
      location: 'Gurgaon',
      team: 'Ad Sales',
      allLocations: ['Gurgaon'],
    },
    lists: [],
  },
  {
    id: '14d6470b-8cc7-4627-8d93-7b6f6a366c2c',
    text: 'Associate - Finance',
    hostedUrl: 'https://jobs.lever.co/z1tech/14d6470b-8cc7-4627-8d93-7b6f6a366c2c',
    applyUrl: 'https://jobs.lever.co/z1tech/14d6470b-8cc7-4627-8d93-7b6f6a366c2c/apply',
    createdAt: 1782728215095,
    country: 'IN',
    workplaceType: 'onsite',
    descriptionPlain: 'Assist with accounts payable, receivable, and ledger maintenance.',
    descriptionBodyPlain: 'Assist with accounts payable, receivable, and ledger maintenance.',
    additionalPlain: 'About our parent brand - Z1 Tech.',
    categories: {
      commitment: 'Full Time',
      department: 'Operations',
      location: 'Gurgaon',
      team: 'Finance',
      allLocations: ['Gurgaon'],
    },
    lists: [
      {
        text: 'Requirements:',
        content: "<li>Bachelor's degree in Finance</li><li>3 to 4 years of experience</li>",
      },
    ],
  },
  {
    id: '1d613552-0455-467d-bffb-05e972bea0ba',
    text: 'Account Executive',
    hostedUrl: 'https://jobs.lever.co/z1tech/1d613552-0455-467d-bffb-05e972bea0ba',
    applyUrl: 'https://jobs.lever.co/z1tech/1d613552-0455-467d-bffb-05e972bea0ba/apply',
    createdAt: 1782901015095,
    country: 'US',
    workplaceType: 'remote',
    descriptionPlain: 'Own advertiser relationships in the United States.',
    categories: {
      commitment: 'Full Time',
      department: 'Sales',
      location: 'United States',
      team: 'Z1 Tech',
      allLocations: ['United States'],
    },
    lists: [],
  },
]

test('Z1 Media scraper recognizes the verified official homepage, careers page, and Lever ATS handoff', async () => {
  const z1Media = await loadZ1MediaModule()

  assert.equal(z1Media.SOURCE, 'z1media')
  assert.equal(z1Media.COMPANY, 'Z1 Media')
  assert.equal(z1Media.LEGACY_HOMEPAGE_URL, 'https://www.z1media.com/')
  assert.equal(z1Media.HOMEPAGE_URL, 'https://www.z1tech.com/')
  assert.equal(z1Media.CAREERS_URL, 'https://www.z1tech.com/careers')
  assert.equal(z1Media.LEVER_JOBS_URL, 'https://jobs.lever.co/z1tech/')
  assert.equal(z1Media.LEVER_ENDPOINT, 'https://api.lever.co/v0/postings/z1tech?mode=json')
  assert.equal(z1Media.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(z1Media.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(z1Media.extractLeverJobs(leverJobs), [
    {
      title: 'Agency Lead',
      company: 'Z1 Media',
      department: 'Ad Sales',
      location: 'Gurgaon, India',
      city: 'Gurgaon',
      country: 'India',
      jobId: 'e0fd6fd7-3091-49a7-af24-4d4ec75d4722',
      requisitionId: 'e0fd6fd7-3091-49a7-af24-4d4ec75d4722',
      sourceUrl: 'https://jobs.lever.co/z1tech/e0fd6fd7-3091-49a7-af24-4d4ec75d4722',
      applyUrl: 'https://jobs.lever.co/z1tech/e0fd6fd7-3091-49a7-af24-4d4ec75d4722/apply',
      employmentType: 'Full Time',
      workplaceType: 'On-site',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-30T10:16:55.095Z',
      closingDate: null,
      jobDescription: 'Lead strategic agency relationships across India. Work closely with ad sales and publisher teams.',
    },
    {
      title: 'Associate - Finance',
      company: 'Z1 Media',
      department: 'Finance',
      location: 'Gurgaon, India',
      city: 'Gurgaon',
      country: 'India',
      jobId: '14d6470b-8cc7-4627-8d93-7b6f6a366c2c',
      requisitionId: '14d6470b-8cc7-4627-8d93-7b6f6a366c2c',
      sourceUrl: 'https://jobs.lever.co/z1tech/14d6470b-8cc7-4627-8d93-7b6f6a366c2c',
      applyUrl: 'https://jobs.lever.co/z1tech/14d6470b-8cc7-4627-8d93-7b6f6a366c2c/apply',
      employmentType: 'Full Time',
      workplaceType: 'On-site',
      experienceRequired: '3 to 4 years of experience',
      minimumQualification: "Bachelor's degree in Finance",
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-29T10:16:55.095Z',
      closingDate: null,
      jobDescription: 'Assist with accounts payable, receivable, and ledger maintenance. About our parent brand - Z1 Tech.',
    },
  ])
})

test('Z1 Media scraper validates the official first-party surfaces before returning India jobs from Lever', async () => {
  const z1Media = await loadZ1MediaModule()
  const requestedPageUrls = []
  const requestedJsonUrls = []

  const jobs = await z1Media.createZ1MediaScraper({
    now: () => '2026-07-13T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requestedPageUrls.push(url)

      if (url === z1Media.LEGACY_HOMEPAGE_URL) {
        return {
          status: 200,
          url: z1Media.HOMEPAGE_URL,
          html: homepageHtml,
        }
      }

      if (url === z1Media.CAREERS_URL) {
        return {
          status: 200,
          url: z1Media.CAREERS_URL,
          html: careersHtml,
        }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)

      if (url === z1Media.LEVER_ENDPOINT) {
        return leverJobs
      }

      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPageUrls, [
    z1Media.LEGACY_HOMEPAGE_URL,
    z1Media.CAREERS_URL,
  ])
  assert.deepEqual(requestedJsonUrls, [z1Media.LEVER_ENDPOINT])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'z1media')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].companyCareerPage, z1Media.CAREERS_URL)
  assert.equal(jobs[0].companyDomain, 'z1tech.com')
  assert.equal(jobs[0].atsPlatform, 'lever')
  assert.equal(jobs[0].scrapedAt, '2026-07-13T00:00:00.000Z')
  assert.equal(jobs.every((job) => job.country === 'India'), true)
})

test('Z1 Media scraper fails closed when the official surfaces or Lever handoff drift', async () => {
  const z1Media = await loadZ1MediaModule()

  await assert.rejects(
    z1Media.createZ1MediaScraper().run({
      fetchPage: async (url) => {
        if (url === z1Media.LEGACY_HOMEPAGE_URL) {
          return {
            status: 200,
            url: z1Media.HOMEPAGE_URL,
            html: '<html><body><h1>Unexpected</h1></body></html>',
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => leverJobs,
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    z1Media.createZ1MediaScraper().run({
      fetchPage: async (url) => {
        if (url === z1Media.LEGACY_HOMEPAGE_URL) {
          return {
            status: 200,
            url: z1Media.HOMEPAGE_URL,
            html: homepageHtml,
          }
        }

        if (url === z1Media.CAREERS_URL) {
          return {
            status: 200,
            url: z1Media.CAREERS_URL,
            html: careersHtml.replace('https://jobs.lever.co/z1tech', 'https://jobs.lever.co/other-company'),
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => leverJobs,
    }),
    /verified official careers|lever handoff/i,
  )

  await assert.rejects(
    z1Media.createZ1MediaScraper().run({
      fetchPage: async (url) => {
        if (url === z1Media.LEGACY_HOMEPAGE_URL) {
          return {
            status: 200,
            url: z1Media.HOMEPAGE_URL,
            html: homepageHtml,
          }
        }

        if (url === z1Media.CAREERS_URL) {
          return {
            status: 200,
            url: z1Media.CAREERS_URL,
            html: careersHtml,
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => [
        {
          ...leverJobs[0],
          hostedUrl: null,
        },
      ],
    }),
    /lever jobs payload changed/i,
  )
})
