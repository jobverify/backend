import assert from 'node:assert/strict'
import test from 'node:test'

const officialPortalHtml = `
  <script>
    window.pageData = {"Jobs":[
      {"JobId":8482101,"JobTitle":"Scientist I","PublishedDate":"2026-07-02T12:42:13-05:00","HiringDepartment":"Research","JobLocation":{"City":"Vancouver","State":"BC","Country":"Canada"}},
      {"JobId":8482102,"JobTitle":"Clinical Data Associate","PublishedDate":"2026-07-09T10:00:00+05:30","HiringDepartment":"Clinical Operations","JobLocation":{"City":"Chennai","State":"Tamil Nadu","Country":"India"}}
    ]};
  </script>
`

const zeroJobsHtml = `
  <script>
    window.pageData = {"Jobs":[]};
  </script>
`

test('extractSearchResults keeps only India jobs from Arbutus official Paylocity data', async () => {
  let arbutus
  try {
    arbutus = await import('../../scraper/arbutus/script.js')
  } catch {
    assert.fail('Expected Arbutus scraper module at ../../scraper/scraper/arbutus/script.js')
  }

  assert.deepEqual(arbutus.extractSearchResults(officialPortalHtml), [
    {
      title: 'Clinical Data Associate',
      company: 'Arbutus Biopharma',
      department: 'Clinical Operations',
      location: 'Chennai, Tamil Nadu, India',
      city: 'Chennai',
      country: 'India',
      jobId: '8482102',
      requisitionId: '8482102',
      sourceUrl: arbutus.CAREER_PAGE_URL,
      applyUrl: 'https://recruiting.paylocity.com/Recruiting/Jobs/Details/8482102/f2fda2c7-bfc6-4840-90d0-83d242cada87',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-09T10:00:00+05:30',
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
      compensation: null,
    },
  ])
})

test('a bare historical Jobs array does not establish the current employer board or a verified zero', async () => {
  let arbutus
  try {
    arbutus = await import('../../scraper/arbutus/script.js')
  } catch {
    assert.fail('Expected Arbutus scraper module at ../../scraper/scraper/arbutus/script.js')
  }

  await assert.rejects(arbutus.createArbutusScraper().run({
    fetchText: async () => zeroJobsHtml,
  }), /corporate employer identity/)
})
