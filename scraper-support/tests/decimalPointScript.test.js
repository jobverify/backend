import assert from 'node:assert/strict'
import test from 'node:test'

const loadDecimalPointModule = async () => {
  try {
    return await import('../../scraper/decimalpoint/script.js')
  } catch {
    return null
  }
}

const listingPayload = {
  status: 200,
  message: 'RFR List',
  data: [
    {
      id: 42,
      rfr_id: 'DPA_RFR_42',
      roleDetails: { ROLE_NAME: 'Data Analyst' },
      functmast_details: { FUNCT_NAME: 'Analytics' },
      worklocmast_details: { WLOC_NAME: 'Mumbai' },
      dsgmast_designation_details: { DSG_NAME: 'Associate' },
      minimum_experience: '1-0',
      maximum_experience: '3-0',
      qualification: [{ Qual_Name: 'Bachelor of Engineering' }],
      skills_List: [{ Name: 'SQL' }],
      other_skills: ['Python'],
      published_date: '2026-07-01T00:00:00.000Z',
      job_description: JSON.stringify({
        blocks: [{ text: 'Analyze financial data for client projects.' }],
      }),
    },
  ],
}

test('Decimal Point keeps its scraper on official careers and Hono API URLs', async () => {
  const decimalPoint = await loadDecimalPointModule()
  assert.ok(decimalPoint)

  assert.equal(decimalPoint.CAREER_PAGE_URL, 'https://decimalpointanalytics.com/careers/current-openings')
  assert.equal(decimalPoint.JOBS_API_URL, 'https://dpa.hono.ai/nodejs/getRFRListOnCandidatePortal')
  assert.equal(
    decimalPoint.buildJobDetailUrl('DPA_RFR_42'),
    'https://decimalpointanalytics.com/careers/current-openings/opening-details?rfr=DPA_RFR_42',
  )
})

test('extractJobs normalizes Decimal Point official Hono openings', async () => {
  const decimalPoint = await loadDecimalPointModule()
  assert.ok(decimalPoint)

  assert.deepEqual(decimalPoint.extractJobs(listingPayload), [{
    title: 'Data Analyst',
    company: 'Decimal Point Analytics',
    department: 'Analytics',
    location: 'Mumbai',
    city: 'Mumbai',
    jobId: 'DPA_RFR_42',
    requisitionId: '42',
    sourceUrl: 'https://decimalpointanalytics.com/careers/current-openings/opening-details?rfr=DPA_RFR_42',
    applyUrl: 'https://decimalpointanalytics.com/careers/current-openings/opening-details?rfr=DPA_RFR_42',
    employmentType: 'Associate',
    experienceRequired: '1-3 years',
    minimumQualification: 'Bachelor of Engineering',
    preferredQualification: null,
    requiredSkills: ['SQL', 'Python'],
    postingDate: '2026-07-01',
    closingDate: null,
    jobDescription: 'Analyze financial data for client projects.',
  }])
})

test('Decimal Point scraper requests its first-party Hono endpoint with the required tenant header', async () => {
  const decimalPoint = await loadDecimalPointModule()
  assert.ok(decimalPoint)

  const requested = []
  const jobs = await decimalPoint.createDecimalPointScraper({
    fetchJson: async (url, options) => {
      requested.push({ url, options })
      return listingPayload
    },
  }).run()

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'decimalpoint')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(typeof jobs[0].scrapedAt, 'string')
  assert.deepEqual(requested, [{
    url: decimalPoint.JOBS_API_URL,
    options: {
      headers: {
        Accept: 'application/json, text/plain, */*',
        domainurl: 'dpa.hono.ai',
      },
    },
  }])
})
