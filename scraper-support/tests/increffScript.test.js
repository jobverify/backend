import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-09T00:00:00.000Z'

const loadIncreffModule = async () => {
  try {
    return await import('../../scraper/increff/script.js')
  } catch {
    assert.fail('Expected Increff scraper module at ../../scraper/increff/script.js')
  }
}

const samplePayload = {
  data: [
    {
      id: '4000000001234567',
      Posting_Title: 'Software Development Engineer I',
      Job_Opening_Name: 'Software Development Engineer I',
      Department: 'Engineering',
      City: 'Bengaluru',
      State: 'Karnataka',
      Country: 'India',
      Job_Type: 'Full time',
      Work_Experience: '1-3 years',
      Date_Opened: '2026-07-08',
      Job_Description: 'Build warehouse and retail automation products.',
    },
    {
      id: '4000000001234999',
      Posting_Title: 'Account Executive - US',
      City: 'New York',
      Country: 'United States',
      Job_Type: 'Full time',
    },
  ],
}

test('Increff scraper stays pinned to the verified public Zoho Recruit surface and keeps only India jobs', async () => {
  const {
    CAREERS_PAGE_URL,
    PUBLIC_BOARD_URL,
    API_URL,
    buildApiUrl,
    buildJobUrl,
    extractSearchResults,
    createIncreffScraper,
  } = await loadIncreffModule()

  assert.equal(CAREERS_PAGE_URL, 'https://www.increff.com/careers')
  assert.equal(PUBLIC_BOARD_URL, 'https://increff.zohorecruit.com/jobs/Careers')
  assert.equal(
    API_URL,
    'https://increff.zohorecruit.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(buildApiUrl(), API_URL)
  assert.equal(
    buildJobUrl('4000000001234567', 'Software Development Engineer I'),
    'https://increff.zohorecruit.com/jobs/Careers/4000000001234567/Software-Development-Engineer-I?source=CareerSite',
  )

  assert.deepEqual(extractSearchResults(samplePayload), [
    {
      title: 'Software Development Engineer I',
      company: 'Increff',
      department: 'Engineering',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      jobId: '4000000001234567',
      requisitionId: '4000000001234567',
      sourceUrl: 'https://increff.zohorecruit.com/jobs/Careers/4000000001234567/Software-Development-Engineer-I?source=CareerSite',
      applyUrl: 'https://increff.zohorecruit.com/jobs/Careers/4000000001234567/Software-Development-Engineer-I?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: '1-3 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-08',
      closingDate: null,
      jobDescription: 'Build warehouse and retail automation products.',
    },
  ])

  const requests = []
  const scraper = createIncreffScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  const jobs = await scraper.run({
    fetchJson: async (url) => {
      requests.push(url)
      return samplePayload
    },
  })

  assert.deepEqual(requests, [API_URL])
  assert.deepEqual(jobs, [
    {
      title: 'Software Development Engineer I',
      company: 'Increff',
      department: 'Engineering',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      jobId: '4000000001234567',
      requisitionId: '4000000001234567',
      sourceUrl: 'https://increff.zohorecruit.com/jobs/Careers/4000000001234567/Software-Development-Engineer-I?source=CareerSite',
      applyUrl: 'https://increff.zohorecruit.com/jobs/Careers/4000000001234567/Software-Development-Engineer-I?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: '1-3 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-08',
      closingDate: null,
      jobDescription: 'Build warehouse and retail automation products.',
      source: 'increff',
      link: 'https://increff.zohorecruit.com/jobs/Careers/4000000001234567/Software-Development-Engineer-I?source=CareerSite',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})
