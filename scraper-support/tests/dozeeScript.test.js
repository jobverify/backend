import assert from 'node:assert/strict'
import test from 'node:test'

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Welcome to Dozee | India's 1st Contactless Vitals Monitor</title>
  </head>
  <body>
    <header>
      <nav>
        <a href="/careers">careers</a>
        <a href="/contactus">Contact Us</a>
      </nav>
    </header>
    <main>
      <h1>India's 1st Contactless Vitals Monitor</h1>
    </main>
  </body>
</html>
`

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Dozee</title>
  </head>
  <body>
    <main>
      <span>Careers @ Dozee</span>
      <h1>Shaping The Future Of Healthcare Together</h1>
      <a href="https://jobs.lever.co/dozee" target="_blank">job openings</a>
    </main>
  </body>
</html>
`

const officialLeverBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Dozee</title>
  </head>
  <body>
    <h1>Dozee</h1>
    <section>Location type</section>
    <section>Location</section>
    <section>Team</section>
    <section>Work type</section>
    <a href="https://jobs.lever.co/dozee/ccbcd4a2-0672-4139-b067-bb3905ff2738">Business Finance</a>
    <a href="https://jobs.lever.co/dozee/5255c181-b6e4-4383-9068-c7cf2949ea48">Area Sales Manager</a>
    <a href="https://jobs.lever.co/dozee/2ad42193-c533-4440-8fdf-f4a6e98b1d43">Biomedical Engineer - CSA</a>
    <a href="https://www.lever.co/job-seeker-support/" class="image-link">
      <span>Jobs powered by </span>
      <img alt="Lever logo" src="/img/lever-logo-full.svg" />
    </a>
  </body>
</html>
`

const sampleLeverJobs = [
  {
    id: 'ccbcd4a2-0672-4139-b067-bb3905ff2738',
    text: 'Business Finance',
    hostedUrl: 'https://jobs.lever.co/dozee/ccbcd4a2-0672-4139-b067-bb3905ff2738',
    applyUrl: 'https://jobs.lever.co/dozee/ccbcd4a2-0672-4139-b067-bb3905ff2738/apply',
    createdAt: 1_777_989_752_526,
    categories: {
      location: 'Bangalore',
      team: 'Business Finance & Investor Relations',
      department: 'Finance',
      commitment: 'Full Time',
      allLocations: ['Bangalore'],
    },
    country: 'IN',
    workplaceType: 'onsite',
    descriptionPlain: 'Own financial planning and business partnership for Dozee.',
  },
  {
    id: '2ad42193-c533-4440-8fdf-f4a6e98b1d43',
    text: 'Biomedical Engineer - CSA',
    hostedUrl: 'https://jobs.lever.co/dozee/2ad42193-c533-4440-8fdf-f4a6e98b1d43',
    applyUrl: 'https://jobs.lever.co/dozee/2ad42193-c533-4440-8fdf-f4a6e98b1d43/apply',
    createdAt: 1_783_426_647_060,
    categories: {
      location: 'Delhi',
      team: 'Customer Success - Field',
      department: 'Customer Success',
      commitment: 'Contract',
      allLocations: ['Delhi'],
    },
    country: 'IN',
    workplaceType: 'onsite',
    descriptionPlain: 'Support hospital deployments and patient monitoring at customer sites.',
  },
  {
    id: '2231ae59-5b0f-4ab7-a722-696033c4052a',
    text: 'Area Sales Manager',
    hostedUrl: 'https://jobs.lever.co/dozee/2231ae59-5b0f-4ab7-a722-696033c4052a',
    applyUrl: 'https://jobs.lever.co/dozee/2231ae59-5b0f-4ab7-a722-696033c4052a/apply',
    createdAt: 1_782_291_384_197,
    categories: {
      location: 'New Jersey',
      team: 'Sales',
      department: 'Sales US',
      commitment: 'Full Time',
      allLocations: ['New Jersey'],
    },
    country: 'US',
    workplaceType: 'onsite',
    descriptionPlain: 'US role that must be filtered out.',
  },
]

const loadModule = async () => {
  try {
    return await import('../../scraper/dozee/script.js')
  } catch {
    assert.fail('Expected Dozee scraper module at ../../scraper/dozee/script.js')
  }
}

test('Dozee scraper constants stay pinned to the verified first-party careers page and Lever board contract', async () => {
  const dozee = await loadModule()

  assert.equal(dozee.SOURCE, 'dozee')
  assert.equal(dozee.COMPANY, 'Dozee')
  assert.equal(dozee.HOMEPAGE_URL, 'https://www.dozeehealth.ai/')
  assert.equal(dozee.CAREERS_URL, 'https://www.dozeehealth.ai/careers')
  assert.equal(dozee.LEVER_BOARD_URL, 'https://jobs.lever.co/dozee')
  assert.equal(dozee.LEVER_API_URL, 'https://api.lever.co/v0/postings/dozee?mode=json')
  assert.equal(dozee.VERIFIED_INDIA_COUNTRY_CODE, 'IN')
  assert.equal(dozee.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(dozee.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(
    dozee.extractLeverBoardUrl(officialCareersHtml),
    'https://jobs.lever.co/dozee',
  )
  assert.equal(dozee.hasOfficialLeverBoardSignal(officialLeverBoardHtml), true)
  assert.equal(
    dozee.buildPublicJobUrl('ccbcd4a2-0672-4139-b067-bb3905ff2738'),
    'https://jobs.lever.co/dozee/ccbcd4a2-0672-4139-b067-bb3905ff2738',
  )
})

test('Dozee extracts only India roles from the Lever postings payload shape', async () => {
  const dozee = await loadModule()
  const jobs = dozee.extractIndiaLeverJobs(sampleLeverJobs)

  assert.deepEqual(jobs, [
    {
      title: 'Biomedical Engineer - CSA',
      company: 'Dozee',
      department: 'Customer Success - Field',
      location: 'Delhi, India',
      city: 'Delhi',
      country: 'India',
      jobId: '2ad42193-c533-4440-8fdf-f4a6e98b1d43',
      requisitionId: '2ad42193-c533-4440-8fdf-f4a6e98b1d43',
      sourceUrl: 'https://jobs.lever.co/dozee/2ad42193-c533-4440-8fdf-f4a6e98b1d43',
      applyUrl: 'https://jobs.lever.co/dozee/2ad42193-c533-4440-8fdf-f4a6e98b1d43/apply',
      employmentType: 'Contract',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-07T12:17:27.060Z',
      closingDate: null,
      jobDescription: 'Support hospital deployments and patient monitoring at customer sites.',
      remoteStatus: 'On-site',
    },
    {
      title: 'Business Finance',
      company: 'Dozee',
      department: 'Business Finance & Investor Relations',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: 'ccbcd4a2-0672-4139-b067-bb3905ff2738',
      requisitionId: 'ccbcd4a2-0672-4139-b067-bb3905ff2738',
      sourceUrl: 'https://jobs.lever.co/dozee/ccbcd4a2-0672-4139-b067-bb3905ff2738',
      applyUrl: 'https://jobs.lever.co/dozee/ccbcd4a2-0672-4139-b067-bb3905ff2738/apply',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-05-05T14:02:32.526Z',
      closingDate: null,
      jobDescription: 'Own financial planning and business partnership for Dozee.',
      remoteStatus: 'On-site',
    },
  ])
})

test('Dozee run validates the first-party careers handoff and returns only India jobs from the public Lever feed', async () => {
  const dozee = await loadModule()
  const pageRequests = []
  const jsonRequests = []

  const jobs = await dozee.createDozeeScraper({
    now: () => '2026-07-15T12:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      pageRequests.push(url)

      if (url === dozee.HOMEPAGE_URL) {
        return { status: 200, url, html: officialHomepageHtml }
      }

      if (url === dozee.CAREERS_URL) {
        return { status: 200, url, html: officialCareersHtml }
      }

      if (url === dozee.LEVER_BOARD_URL) {
        return { status: 200, url, html: officialLeverBoardHtml }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchJson: async (url) => {
      jsonRequests.push(url)

      if (url === dozee.LEVER_API_URL) {
        return sampleLeverJobs
      }

      throw new Error(`Unexpected json URL: ${url}`)
    },
  })

  assert.deepEqual(pageRequests, [
    dozee.HOMEPAGE_URL,
    dozee.CAREERS_URL,
    dozee.LEVER_BOARD_URL,
  ])
  assert.deepEqual(jsonRequests, [dozee.LEVER_API_URL])
  assert.deepEqual(jobs, [
    {
      title: 'Biomedical Engineer - CSA',
      company: 'Dozee',
      department: 'Customer Success - Field',
      location: 'Delhi, India',
      city: 'Delhi',
      country: 'India',
      jobId: '2ad42193-c533-4440-8fdf-f4a6e98b1d43',
      requisitionId: '2ad42193-c533-4440-8fdf-f4a6e98b1d43',
      sourceUrl: 'https://jobs.lever.co/dozee/2ad42193-c533-4440-8fdf-f4a6e98b1d43',
      applyUrl: 'https://jobs.lever.co/dozee/2ad42193-c533-4440-8fdf-f4a6e98b1d43/apply',
      employmentType: 'Contract',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-07T12:17:27.060Z',
      closingDate: null,
      jobDescription: 'Support hospital deployments and patient monitoring at customer sites.',
      remoteStatus: 'On-site',
      source: 'dozee',
      companyCareerPage: 'https://www.dozeehealth.ai/careers',
      companyDomain: 'dozeehealth.ai',
      atsPlatform: 'lever',
      link: 'https://jobs.lever.co/dozee/2ad42193-c533-4440-8fdf-f4a6e98b1d43/apply',
      scrapedAt: '2026-07-15T12:00:00.000Z',
    },
    {
      title: 'Business Finance',
      company: 'Dozee',
      department: 'Business Finance & Investor Relations',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: 'ccbcd4a2-0672-4139-b067-bb3905ff2738',
      requisitionId: 'ccbcd4a2-0672-4139-b067-bb3905ff2738',
      sourceUrl: 'https://jobs.lever.co/dozee/ccbcd4a2-0672-4139-b067-bb3905ff2738',
      applyUrl: 'https://jobs.lever.co/dozee/ccbcd4a2-0672-4139-b067-bb3905ff2738/apply',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-05-05T14:02:32.526Z',
      closingDate: null,
      jobDescription: 'Own financial planning and business partnership for Dozee.',
      remoteStatus: 'On-site',
      source: 'dozee',
      companyCareerPage: 'https://www.dozeehealth.ai/careers',
      companyDomain: 'dozeehealth.ai',
      atsPlatform: 'lever',
      link: 'https://jobs.lever.co/dozee/ccbcd4a2-0672-4139-b067-bb3905ff2738/apply',
      scrapedAt: '2026-07-15T12:00:00.000Z',
    },
  ])
})

test('Dozee fails closed when the verified homepage, careers handoff, or Lever board changes materially', async () => {
  const dozee = await loadModule()

  await assert.rejects(
    dozee.createDozeeScraper().run({
      fetchPage: async (url) => {
        if (url === dozee.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Home</title></head><body>placeholder</body></html>',
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => sampleLeverJobs,
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    dozee.createDozeeScraper().run({
      fetchPage: async (url) => {
        if (url === dozee.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === dozee.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: officialCareersHtml.replace('https://jobs.lever.co/dozee', 'https://jobs.lever.co/other-company'),
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => sampleLeverJobs,
    }),
    /verified public lever board/i,
  )

  await assert.rejects(
    dozee.createDozeeScraper().run({
      fetchPage: async (url) => {
        if (url === dozee.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === dozee.CAREERS_URL) {
          return { status: 200, url, html: officialCareersHtml }
        }

        if (url === dozee.LEVER_BOARD_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Dozee</title></head><body><h1>Dozee</h1></body></html>',
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => sampleLeverJobs,
    }),
    /verified public lever board/i,
  )
})
