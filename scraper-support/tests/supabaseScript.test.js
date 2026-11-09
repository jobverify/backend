import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-25T00:00:00.000Z'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Supabase</title>
  </head>
  <body>
    <main>
      <h1>We're on a mission to build the best developer platform</h1>
      <p>Explore remote opportunities and join our team to help us achieve it.</p>
      <section>
        <h2>Open positions</h2>
        <article>
          <h3>Product Manager - Marketplace</h3>
          <p>Remote</p>
          <a href="https://jobs.ashbyhq.com/supabase/23c9ce7e-6b7b-4316-8f00-8f318e902441">Apply for position</a>
        </article>
        <article>
          <h3>Customer Solution Architect (AMER)</h3>
          <p>AMER</p>
          <a href="https://jobs.ashbyhq.com/supabase/d3f6bb95-8679-43cc-8a48-827efac070f4">Apply for position</a>
        </article>
        <article>
          <h3>Support Engineer (APAC)</h3>
          <p>Remote</p>
          <a href="https://jobs.ashbyhq.com/supabase/142135ae-a15f-4ec7-90bb-cb4e7968bc09">Apply for position</a>
        </article>
      </section>
    </main>
  </body>
</html>
`

const ASHBY_PAYLOAD = {
  jobs: [
    {
      id: 'india-solutions-architect',
      title: 'Solutions Architect',
      department: 'Growth',
      team: 'Success',
      employmentType: 'FullTime',
      location: 'Remote',
      secondaryLocations: [
        {
          location: 'India (Remote)',
          address: {
            postalAddress: {
              addressCountry: 'India',
              addressLocality: 'Bengaluru',
              addressRegion: 'Karnataka',
            },
          },
        },
      ],
      publishedAt: '2026-07-24T10:49:09.045+00:00',
      isListed: true,
      isRemote: true,
      workplaceType: 'Remote',
      address: {
        postalAddress: {
          addressCountry: 'Remote',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/supabase/india-solutions-architect',
      applyUrl: 'https://jobs.ashbyhq.com/supabase/india-solutions-architect/application',
      descriptionPlain: 'Help customers design production systems on Supabase.',
    },
    {
      id: 'support-engineer-apac',
      title: 'Support Engineer (APAC)',
      department: 'Growth',
      team: 'Support',
      employmentType: 'FullTime',
      location: 'Remote',
      secondaryLocations: [],
      publishedAt: '2025-03-20T18:51:09.252+00:00',
      isListed: true,
      isRemote: true,
      workplaceType: 'Remote',
      address: {
        postalAddress: {
          addressCountry: '',
          addressLocality: '',
          addressRegion: '',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/supabase/support-engineer-apac',
      applyUrl: 'https://jobs.ashbyhq.com/supabase/support-engineer-apac/application',
      descriptionPlain: 'Support APAC customers on complex database issues.',
    },
    {
      id: 'ignore-me',
      title: 'Hidden India Role',
      department: 'Engineering',
      employmentType: 'FullTime',
      location: 'India',
      secondaryLocations: [],
      publishedAt: '2026-07-20T09:30:00.000+00:00',
      isListed: false,
      isRemote: false,
      workplaceType: 'OnSite',
      address: {
        postalAddress: {
          addressCountry: 'India',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/supabase/ignore-me',
      applyUrl: 'https://jobs.ashbyhq.com/supabase/ignore-me/application',
      descriptionPlain: 'Should not surface publicly.',
    },
  ],
}

const NON_INDIA_PAYLOAD = {
  jobs: ASHBY_PAYLOAD.jobs.filter((job) => job.id !== 'india-solutions-architect'),
}

const loadModule = async () => {
  try {
    return await import('../../scraper/supabase/script.js')
  } catch {
    assert.fail('Expected Supabase scraper module at ../../scraper/supabase/script.js')
  }
}

test('Supabase pins the verified first-party careers and Ashby endpoints', async () => {
  const supabase = await loadModule()

  assert.equal(supabase.SOURCE, 'supabase')
  assert.equal(supabase.COMPANY, 'Supabase')
  assert.equal(supabase.CAREERS_PAGE_URL, 'https://supabase.com/careers')
  assert.equal(supabase.ASHBY_PUBLIC_BOARD_URL, 'https://jobs.ashbyhq.com/supabase')
  assert.equal(
    supabase.ASHBY_JOB_BOARD_URL,
    'https://api.ashbyhq.com/posting-api/job-board/supabase',
  )
  assert.equal(supabase.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.equal(
    supabase.extractVerifiedAshbyPublicBoardUrl(CAREERS_HTML),
    'https://jobs.ashbyhq.com/supabase',
  )
  assert.equal(
    supabase.buildAshbyJobBoardUrl('https://jobs.ashbyhq.com/supabase'),
    'https://api.ashbyhq.com/posting-api/job-board/supabase',
  )
})

test('Supabase extracts only listed India jobs from the verified Ashby payload', async () => {
  const supabase = await loadModule()
  const jobs = supabase.extractAshbyJobs(ASHBY_PAYLOAD)

  assert.deepEqual(jobs, [
    {
      title: 'Solutions Architect',
      company: 'Supabase',
      department: 'Growth',
      location: 'India (Remote)',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      jobId: 'india-solutions-architect',
      requisitionId: 'india-solutions-architect',
      sourceUrl: 'https://jobs.ashbyhq.com/supabase/india-solutions-architect',
      applyUrl: 'https://jobs.ashbyhq.com/supabase/india-solutions-architect/application',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-24T10:49:09.045+00:00',
      closingDate: null,
      jobDescription: 'Help customers design production systems on Supabase.',
      remoteStatus: 'Remote',
    },
  ])
})

test('Supabase run validates the first-party handoff and returns an empty result when no India roles remain', async () => {
  const supabase = await loadModule()
  const requestedTexts = []
  const requestedJson = []

  const jobs = await supabase.createSupabaseScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === supabase.CAREERS_PAGE_URL) return CAREERS_HTML
      throw new Error(`Unexpected Supabase text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      return NON_INDIA_PAYLOAD
    },
  })

  assert.deepEqual(requestedTexts, [supabase.CAREERS_PAGE_URL])
  assert.deepEqual(requestedJson, [supabase.ASHBY_JOB_BOARD_URL])
  assert.deepEqual(jobs, [])
})

test('Supabase fails closed when the verified careers page, Ashby handoff, or payload drift', async () => {
  const supabase = await loadModule()

  await assert.rejects(
    supabase.createSupabaseScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
      fetchJson: async () => ASHBY_PAYLOAD,
    }),
    /verified supabase official careers page/i,
  )

  await assert.rejects(
    supabase.createSupabaseScraper().run({
      fetchText: async () =>
        CAREERS_HTML.replaceAll('jobs.ashbyhq.com/supabase', 'jobs.ashbyhq.com/not-supabase'),
      fetchJson: async () => ASHBY_PAYLOAD,
    }),
    /verified ashby public board handoff/i,
  )

  await assert.rejects(
    supabase.createSupabaseScraper().run({
      fetchText: async () => CAREERS_HTML,
      fetchJson: async () => ({ postings: [] }),
    }),
    /verified ashby payload/i,
  )
})
