import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-26T12:00:00.000Z'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Explore Exciting Careers and Growth Opportunities | Sciative</title>
    <link rel="canonical" href="https://sciative.com/careers">
    <meta
      name="description"
      content="Advance Your Career with the Global Leader in Dynamic Pricing and AI-Driven Pricing Intelligence Software."
    >
  </head>
  <body>
    <main id="root"></main>
  </body>
</html>
`

const careersApiPayload = [
  {
    id: 36,
    title: 'Business Manager: Hospitality (RMS & Dynamic Pricing)',
    location: 'vashi, Navi Mumbai',
    experience: '4 to 6 years',
    introduction: 'Lead the charge in displacing outdated pricing models.',
    subsections: [
      {
        id: 1,
        heading: 'Key Responsibilities:',
        content: '<p>Lead high-level discovery.</p>',
      },
    ],
    learningUrl: '',
    isLive: true,
    sequence: 1,
    maxSubsectionId: 1,
    created: '2026-03-31 15:52:08',
    modified: '2026-03-31 15:52:08',
    contentName: 'career',
    is_deleted: false,
  },
  {
    id: 29,
    title: 'Apprentice - Junior Associate',
    location: '',
    experience: '',
    introduction: 'Monitor pricing performance and revenues.',
    subsections: [
      {
        id: 1,
        heading: 'Qualifications',
        content: '<p>Any Graduation from a reputed institute.</p>',
      },
    ],
    learningUrl: '',
    isLive: true,
    sequence: 34,
    maxSubsectionId: 1,
    created: '2025-05-05 17:19:27',
    modified: '2025-12-29 11:49:40',
    contentName: 'career',
    is_deleted: false,
  },
]

const publicJobsDriftPayload = [
  {
    id: 'bad-id',
    title: '',
    subsections: 'unexpected',
    contentName: 'not-career',
  },
]

const loadModule = async () => {
  try {
    return await import('../../scraper/sciative/script.js')
  } catch {
    assert.fail('Expected Sciative Solutions scraper module at ../../scraper/sciative/script.js')
  }
}

test('Sciative Solutions helpers stay pinned to the verified first-party careers page and public careers API from Sunday, July 26, 2026', async () => {
  const sciative = await loadModule()

  assert.equal(sciative.SOURCE, 'sciative')
  assert.equal(sciative.COMPANY, 'Sciative Solutions')
  assert.equal(sciative.OFFICIAL_BRAND_NAME, 'Sciative')
  assert.equal(sciative.VERIFIED_ON, '2026-07-26')
  assert.equal(sciative.HOMEPAGE_URL, 'https://sciative.com/')
  assert.equal(sciative.CAREERS_URL, 'https://sciative.com/careers')
  assert.equal(sciative.CAREERS_API_URL, 'https://sciative.com/backend/get_career_item/1')
  assert.equal(sciative.hasOfficialCareersPageSignal(careersPageHtml), true)
  assert.equal(sciative.hasOfficialCareersApiSignal(careersApiPayload), true)
  assert.equal(sciative.hasOfficialCareersApiSignal(publicJobsDriftPayload), false)
  assert.deepEqual(sciative.extractJobsFromApiPayload(careersApiPayload), [
    {
      title: 'Business Manager: Hospitality (RMS & Dynamic Pricing)',
      company: 'Sciative Solutions',
      department: null,
      location: 'Vashi, Navi Mumbai, India',
      city: 'Navi Mumbai',
      state: null,
      country: 'India',
      jobId: '36',
      requisitionId: '36',
      sourceUrl: 'https://sciative.com/careers#36_0',
      applyUrl: 'https://sciative.com/careers#36_0',
      employmentType: null,
      experienceRequired: '4 to 6 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-03-31',
      closingDate: null,
      jobDescription: '<p>Lead the charge in displacing outdated pricing models.</p><h3>Key Responsibilities:</h3><p>Lead high-level discovery.</p>',
    },
    {
      title: 'Apprentice - Junior Associate',
      company: 'Sciative Solutions',
      department: null,
      location: 'India',
      city: null,
      state: null,
      country: 'India',
      jobId: '29',
      requisitionId: '29',
      sourceUrl: 'https://sciative.com/careers#29_1',
      applyUrl: 'https://sciative.com/careers#29_1',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2025-05-05',
      closingDate: null,
      jobDescription: '<p>Monitor pricing performance and revenues.</p><h3>Qualifications</h3><p>Any Graduation from a reputed institute.</p>',
    },
  ])
})

test('Sciative Solutions returns jobs from the verified first-party careers API', async () => {
  const sciative = await loadModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await sciative.createSciativeSolutionsScraper().run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      return careersPageHtml
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      return careersApiPayload
    },
  })

  assert.deepEqual(requestedTextUrls, [sciative.CAREERS_URL])
  assert.deepEqual(requestedJsonUrls, [sciative.CAREERS_API_URL])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    {
      ...jobs[0],
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'Business Manager: Hospitality (RMS & Dynamic Pricing)',
      company: 'Sciative Solutions',
      department: null,
      location: 'Vashi, Navi Mumbai, India',
      city: 'Navi Mumbai',
      state: null,
      country: 'India',
      jobId: '36',
      requisitionId: '36',
      sourceUrl: 'https://sciative.com/careers#36_0',
      applyUrl: 'https://sciative.com/careers#36_0',
      employmentType: null,
      experienceRequired: '4 to 6 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-03-31',
      closingDate: null,
      jobDescription: '<p>Lead the charge in displacing outdated pricing models.</p><h3>Key Responsibilities:</h3><p>Lead high-level discovery.</p>',
      source: 'sciative',
      link: 'https://sciative.com/careers#36_0',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  )
})

test('Sciative Solutions fails closed when the verified careers page or careers API drifts', async () => {
  const sciative = await loadModule()

  await assert.rejects(
    sciative.createSciativeSolutionsScraper().run({
      fetchText: async () => '<html><body>Unexpected</body></html>',
      fetchJson: async () => careersApiPayload,
    }),
    /careers page/i,
  )

  await assert.rejects(
    sciative.createSciativeSolutionsScraper().run({
      fetchText: async () => careersPageHtml,
      fetchJson: async () => publicJobsDriftPayload,
    }),
    /careers api/i,
  )
})
