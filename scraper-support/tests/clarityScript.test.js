import assert from 'node:assert/strict'
import test from 'node:test'

const officialPortalHtml = `
  <script>
    window.pageData = {"Jobs":[
      {"JobId":2645090,"JobTitle":"Participant Services Representative","LocationName":"AZ - Office 5 Days","PublishedDate":"2025-05-13T12:42:13-05:00","HiringDepartment":"Participant Services","JobLocation":{"City":"Mesa","State":"AZ","Country":"USA"}},
      {"JobId":3000001,"JobTitle":"Software Engineer","LocationName":"Hyderabad - Office","PublishedDate":"2026-07-01T10:00:00+05:30","HiringDepartment":"Information Technology","JobLocation":{"City":"Hyderabad","State":"Telangana","Country":"India"}}
    ]};
  </script>
`

test('extractSearchResults keeps only India jobs from Clarity Benefit Solutions official Paylocity data', async () => {
  let clarity
  try {
    clarity = await import('../../scraper/clarity/script.js')
  } catch {
    assert.fail('Expected Clarity scraper module at ../../scraper/scraper/clarity/script.js')
  }

  assert.deepEqual(clarity.extractSearchResults(officialPortalHtml), [
    {
      title: 'Software Engineer',
      company: 'Clarity Benefit Solutions',
      department: 'Information Technology',
      location: 'Hyderabad, Telangana, India',
      city: 'Hyderabad',
      country: 'India',
      jobId: '3000001',
      requisitionId: '3000001',
      sourceUrl: clarity.CAREER_PAGE_URL,
      applyUrl: 'https://recruiting.paylocity.com/Recruiting/Jobs/Details/3000001/2ae5a3ce-3398-4774-8bea-215d1adff90f',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-01T10:00:00+05:30',
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
      compensation: null,
    },
  ])
})
