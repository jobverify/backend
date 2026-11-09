import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Aeries Technology</title>
  </head>
  <body>
    <h1>Careers</h1>
    <p>View Current Openings</p>
    <a href="https://aeriestechnology.talentrecruit.com/Search/">View Current Openings</a>
  </body>
</html>
`

const boardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Aeries Technology</title>
  </head>
  <body>
    <h1>Job By Location</h1>
    <script src="../AngularJS/app.controller-search-job.js?version=20201208"></script>
  </body>
</html>
`

const servicePayload = {
  d: JSON.stringify({
    Jobs: [
      {
        REF_REQ_ID: '3330',
        JOB_TITLE: 'Senior Executive/Assistant Manager - Billing and Cash Application',
        FULL_JOB_LOCATION: 'Maharashtra',
        FunctionalArea: 'Finance',
        'Job Experience': '5 - 8 Years',
        KeySkills: 'Billing, Cash Application',
        JOB_DESCRIPTION: '<p>Lead billing and collections operations.</p>',
      },
      {
        REF_REQ_ID: '3314',
        JOB_TITLE: 'Senior Cybersecurity Analyst',
        FULL_JOB_LOCATION: 'Telangana Hyderabad',
        FunctionalArea: 'Security',
        'Years of Experience': '4 - 7 Years',
        KeySkills: 'SIEM, Threat Hunting',
        JOB_DESCRIPTION: '<p>Protect enterprise systems.</p>',
      },
      {
        REF_REQ_ID: '3300',
        JOB_TITLE: 'US Account Manager',
        FULL_JOB_LOCATION: 'Dallas, United States',
        FunctionalArea: 'Sales',
        'Job Experience': '6 - 9 Years',
        KeySkills: 'Client Management',
        JOB_DESCRIPTION: '<p>Foreign listing should be filtered out.</p>',
      },
    ],
    JobSuggestion: [],
  }),
}

const loadModule = async () => {
  try {
    return await import('../../scraper/aeriestechnology/script.js')
  } catch {
    assert.fail('Expected Aeries Technology scraper module at ../../scraper/aeriestechnology/script.js')
  }
}

test('Aeries Technology validates the verified TalentRecruit surface and keeps India listings', async () => {
  const aeries = await loadModule()

  assert.equal(aeries.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(aeries.extractJobsBoardUrl(careersHtml), aeries.JOBS_BOARD_URL)
  assert.equal(aeries.hasJobsBoardSignal(boardHtml), true)
  assert.deepEqual(aeries.buildBoardRequestBody(), {
    parameters: '{"intFunctionalArea":0,"intPageIndex":1,"searchKeyword":"","strLocation":"","jobSearch":"","queryString":"","FilterDataSource":null}',
  })
  assert.deepEqual(aeries.extractListingCards(servicePayload), [
    {
      title: 'Senior Executive/Assistant Manager - Billing and Cash Application',
      department: 'Finance',
      location: 'Maharashtra, India',
      city: 'Maharashtra',
      jobId: '3330',
      requisitionId: '3330',
      sourceUrl: 'https://aeriestechnology.talentrecruit.com/Search/Jobs/?3330-senior-executive-assistant-manager-billing-and-cash-application',
      applyUrl: 'https://aeriestechnology.talentrecruit.com/Search/Jobs/?3330-senior-executive-assistant-manager-billing-and-cash-application',
      experienceRequired: '5 - 8 Years',
      requiredSkills: ['Billing', 'Cash Application'],
      jobDescription: 'Lead billing and collections operations.',
    },
    {
      title: 'Senior Cybersecurity Analyst',
      department: 'Security',
      location: 'Telangana Hyderabad, India',
      city: 'Telangana Hyderabad',
      jobId: '3314',
      requisitionId: '3314',
      sourceUrl: 'https://aeriestechnology.talentrecruit.com/Search/Jobs/?3314-senior-cybersecurity-analyst',
      applyUrl: 'https://aeriestechnology.talentrecruit.com/Search/Jobs/?3314-senior-cybersecurity-analyst',
      experienceRequired: '4 - 7 Years',
      requiredSkills: ['SIEM', 'Threat Hunting'],
      jobDescription: 'Protect enterprise systems.',
    },
  ])

  const jobs = await aeries.createAeriesTechnologyScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      if (url === aeries.CAREERS_URL) return careersHtml
      if (url === aeries.JOBS_BOARD_URL) return boardHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchJson: async (url, body) => {
      assert.equal(url, aeries.SEARCH_JOBS_SERVICE_URL)
      assert.deepEqual(body, aeries.buildBoardRequestBody())
      return servicePayload
    },
  })

  assert.deepEqual(jobs, [
    {
      title: 'Senior Executive/Assistant Manager - Billing and Cash Application',
      company: 'Aeries Technology',
      department: 'Finance',
      location: 'Maharashtra, India',
      city: 'Maharashtra',
      country: 'India',
      jobId: '3330',
      requisitionId: '3330',
      sourceUrl: 'https://aeriestechnology.talentrecruit.com/Search/Jobs/?3330-senior-executive-assistant-manager-billing-and-cash-application',
      applyUrl: 'https://aeriestechnology.talentrecruit.com/Search/Jobs/?3330-senior-executive-assistant-manager-billing-and-cash-application',
      employmentType: null,
      experienceRequired: '5 - 8 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Billing', 'Cash Application'],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      source: 'aeriestechnology',
      companyCareerPage: 'https://aeriestechnology.com/careers/',
      companyDomain: 'aeriestechnology.com',
      atsPlatform: 'talentrecruit',
      link: 'https://aeriestechnology.talentrecruit.com/Search/Jobs/?3330-senior-executive-assistant-manager-billing-and-cash-application',
      scrapedAt: FIXED_SCRAPED_AT,
      sourceListingComplete: false,
      sourceDetailComplete: false,
    },
    {
      title: 'Senior Cybersecurity Analyst',
      company: 'Aeries Technology',
      department: 'Security',
      location: 'Telangana Hyderabad, India',
      city: 'Telangana Hyderabad',
      country: 'India',
      jobId: '3314',
      requisitionId: '3314',
      sourceUrl: 'https://aeriestechnology.talentrecruit.com/Search/Jobs/?3314-senior-cybersecurity-analyst',
      applyUrl: 'https://aeriestechnology.talentrecruit.com/Search/Jobs/?3314-senior-cybersecurity-analyst',
      employmentType: null,
      experienceRequired: '4 - 7 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['SIEM', 'Threat Hunting'],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      source: 'aeriestechnology',
      companyCareerPage: 'https://aeriestechnology.com/careers/',
      companyDomain: 'aeriestechnology.com',
      atsPlatform: 'talentrecruit',
      link: 'https://aeriestechnology.talentrecruit.com/Search/Jobs/?3314-senior-cybersecurity-analyst',
      scrapedAt: FIXED_SCRAPED_AT,
      sourceListingComplete: false,
      sourceDetailComplete: false,
    },
  ])
})

test('Aeries Technology fails closed when the trusted public board changes materially', async () => {
  const aeries = await loadModule()

  await assert.rejects(
    aeries.createAeriesTechnologyScraper().run({
      fetchText: async (url) => {
        if (url === aeries.CAREERS_URL) return careersHtml
        return '<html><body>No job rows here</body></html>'
      },
      fetchJson: async () => servicePayload,
    }),
    /trusted public jobs surface/i,
  )
})
