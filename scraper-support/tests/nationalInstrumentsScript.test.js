import assert from 'node:assert/strict'
import test from 'node:test'

const loadNationalInstrumentsModule = async () => {
  try {
    return await import('../../scraper/nationalinstruments/script.js')
  } catch {
    assert.fail('Expected National Instruments scraper module at ../../scraper/nationalinstruments/script.js')
  }
}

const emersonCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Your Career at Emerson Starts Here</title>
  </head>
  <body>
    <main>
      <a href="https://www.emerson.com/en/corporate/careers/career-opportunities">Explore All Opportunities</a>
      <a href="https://hdjq.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/jobs">Let's Find Your Role</a>
      <a href="https://hdjq.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1">Explore All Opportunities</a>
      <section>Life at Emerson</section>
    </main>
  </body>
</html>
`

const candidateExperienceHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Emerson Career Site</title>
    <base
      href="/hcmUI/CandidateExperience/en/sites/CX_1"
      data-apibaseurl="https://hdjq.fa.us2.oraclecloud.com:443"
      data-sitenumber="CX_1"
    />
  </head>
  <body>
    <div id="app">Emerson career shell</div>
  </body>
</html>
`

const searchPayloadPage0 = {
  items: [
    {
      Limit: 24,
      TotalJobsCount: 3,
      requisitionList: [
        {
          Id: '26006068',
          Title: 'Account Manager - Semiconductor',
          BusinessUnitId: '300012142648830',
          LegalEmployerId: '300012194279570',
          JobFunction: 'Field Sales',
          WorkplaceType: 'Hybrid',
          PrimaryLocation: 'BENGALURU, KARNATAKA, India',
          PrimaryLocationCountry: 'IN',
          ExternalPostedStartDate: '2026-06-08',
          ShortDescriptionStr:
            'At Emerson Test &amp; Measurement Business Group (Formerly known as National Instruments), we accelerate innovation.',
        },
        {
          Id: '26006077',
          Title: 'Field Application Engineer- Aerospace & Defense',
          BusinessUnitId: '300012142648830',
          LegalEmployerId: '300012194279570',
          JobFunction: 'Field Application Engineering',
          WorkplaceType: 'Remote',
          PrimaryLocation: 'HYDERABAD, TELANGANA, India',
          PrimaryLocationCountry: 'IN',
          ExternalPostedStartDate: '2026-06-25',
          ShortDescriptionStr:
            'At Emerson Test &amp; Measurement Business Group (Formerly known as National Instruments), we empower engineers.',
        },
        {
          Id: '26007491',
          Title: 'Graduate Engineer Trainee',
          BusinessUnitId: '300002898496573',
          LegalEmployerId: '300000089442271',
          JobFunction: 'Engineering',
          WorkplaceType: 'Hybrid',
          PrimaryLocation: 'PUNE, MAHARASHTRA, India',
          PrimaryLocationCountry: 'IN',
          ExternalPostedStartDate: '2026-06-01',
          ShortDescriptionStr: 'Generic Emerson metering role.',
        },
      ],
    },
  ],
}

const detailPayloadByJobId = {
  '26006068': {
    items: [
      {
        Id: '26006068',
        Title: 'Account Manager - Semiconductor',
        BusinessUnitId: '300012142648830',
        LegalEmployerId: '300012194279570',
        JobFunction: 'Field Sales',
        WorkplaceType: 'Hybrid',
        PrimaryLocation: 'BENGALURU, KARNATAKA, India',
        PrimaryLocationCountry: 'IN',
        ExternalPostedStartDate: '2026-06-08',
        ExternalDescriptionStr:
          'About Us At Emerson Test &amp; Measurement Business Group (Formerly known as National Instruments), we accelerate innovation through automated test and measurement solutions.',
        ExternalQualificationsStr: 'Bachelor degree in engineering',
        skills: [{ Skill: 'Semiconductor Sales' }, { Skill: 'Account Growth' }],
      },
    ],
  },
  '26006077': {
    items: [
      {
        Id: '26006077',
        Title: 'Field Application Engineer- Aerospace & Defense',
        BusinessUnitId: '300012142648830',
        LegalEmployerId: '300012194279570',
        JobFunction: 'Field Application Engineering',
        WorkplaceType: 'Remote',
        PrimaryLocation: 'HYDERABAD, TELANGANA, India',
        PrimaryLocationCountry: 'IN',
        ExternalPostedStartDate: '2026-06-25',
        ExternalDescriptionStr:
          'About Us At Emerson Test &amp; Measurement Business Group (Formerly known as National Instruments), we empower engineers and innovators.',
        ExternalQualificationsStr: 'Bachelor degree in electronics',
        skills: [{ Skill: 'Aerospace & Defense' }, { Skill: 'Test Systems' }],
      },
    ],
  },
}

test('National Instruments constants stay pinned to the verified Emerson Oracle handoff and NI company filter', async () => {
  const nationalInstruments = await loadNationalInstrumentsModule()

  assert.equal(nationalInstruments.SOURCE, 'nationalinstruments')
  assert.equal(nationalInstruments.COMPANY, 'National Instruments')
  assert.equal(nationalInstruments.OFFICIAL_BRAND_NAME, 'NI')
  assert.equal(nationalInstruments.VERIFIED_ON, '2026-08-03')
  assert.equal(nationalInstruments.HOMEPAGE_URL, 'https://www.ni.com/')
  assert.equal(nationalInstruments.CAREERS_URL, 'https://www.ni.com/en/about-ni/careers.html')
  assert.equal(nationalInstruments.EMERSON_CAREERS_URL, 'https://www.emerson.com/en/corporate/careers')
  assert.equal(
    nationalInstruments.ORACLE_CANDIDATE_EXPERIENCE_URL,
    'https://hdjq.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/jobs',
  )
  assert.equal(
    nationalInstruments.ORACLE_ROOT_URL,
    'https://hdjq.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1',
  )
  assert.equal(nationalInstruments.WORKSPACE_DOMAIN, 'hdjq.fa.us2.oraclecloud.com')
  assert.equal(
    nationalInstruments.LISTING_API_BASE_URL,
    'https://hdjq.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
  )
  assert.equal(
    nationalInstruments.DETAIL_API_BASE_URL,
    'https://hdjq.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails',
  )
  assert.equal(
    nationalInstruments.PUBLIC_JOBS_BASE_URL,
    'https://hdjq.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/',
  )
  assert.equal(nationalInstruments.SITE_NUMBER, 'CX_1')
  assert.equal(nationalInstruments.DEFAULT_LOCATION, 'India')
  assert.equal(nationalInstruments.TARGET_BUSINESS_UNIT_ID, '300012142648830')
  assert.equal(nationalInstruments.TARGET_LEGAL_EMPLOYER_ID, '300012194279570')

  assert.equal(nationalInstruments.hasOfficialEmersonCareersSignal(emersonCareersHtml), true)
  assert.equal(
    nationalInstruments.extractOracleCandidateExperienceUrl(emersonCareersHtml),
    nationalInstruments.ORACLE_CANDIDATE_EXPERIENCE_URL,
  )
  assert.equal(
    nationalInstruments.hasOfficialNationalInstrumentsRedirectSignal({
      status: 200,
      url: nationalInstruments.EMERSON_CAREERS_URL,
      html: emersonCareersHtml,
    }),
    true,
  )
  assert.equal(
    nationalInstruments.hasOfficialCandidateExperienceSignal(candidateExperienceHtml),
    true,
  )
  assert.equal(
    nationalInstruments.matchesNationalInstrumentsBusinessUnit({
      BusinessUnitId: '300012142648830',
      LegalEmployerId: '300012194279570',
    }),
    true,
  )
  assert.equal(
    nationalInstruments.matchesNationalInstrumentsBusinessUnit({
      BusinessUnitId: '300012142648830',
      LegalEmployerId: '300000089444245',
    }),
    false,
  )
  assert.equal(
    nationalInstruments.buildSearchUrl(),
    'https://hdjq.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_1,limit=24,offset=0,location=India',
  )
  assert.equal(
    nationalInstruments.buildSearchUrl({ page: 2, limit: 10 }),
    'https://hdjq.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_1,limit=10,offset=20,location=India',
  )
  assert.equal(
    nationalInstruments.buildJobDetailUrl('26006068'),
    'https://hdjq.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/26006068',
  )
  assert.equal(
    nationalInstruments.buildJobDetailApiUrl('26006068'),
    'https://hdjq.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id=%2226006068%22,siteNumber=CX_1',
  )

  const searchResults = nationalInstruments.extractSearchResults(searchPayloadPage0)
  assert.deepEqual(
    searchResults.map((job) => [job.jobId, job.title, job.location]),
    [
      ['26006068', 'Account Manager - Semiconductor', 'BENGALURU, KARNATAKA, India'],
      ['26006077', 'Field Application Engineer- Aerospace & Defense', 'HYDERABAD, TELANGANA, India'],
    ],
  )

  const detail = nationalInstruments.extractJobDetail(
    detailPayloadByJobId['26006068'],
    searchResults[0],
  )
  assert.equal(detail.company, 'National Instruments')
  assert.equal(detail.department, 'Field Sales')
  assert.equal(detail.minimumQualification, 'Bachelor degree in engineering')
  assert.deepEqual(detail.requiredSkills, ['Semiconductor Sales', 'Account Growth'])
  assert.match(detail.jobDescription, /Formerly known as National Instruments/i)
})

test('National Instruments scraper returns only NI Test & Measurement jobs from the Emerson Oracle feed', async () => {
  const nationalInstruments = await loadNationalInstrumentsModule()
  const requestedPages = []
  const requestedJsonUrls = []

  const jobs = await nationalInstruments.createNationalInstrumentsScraper({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === nationalInstruments.CAREERS_URL) {
        return {
          status: 200,
          url: nationalInstruments.EMERSON_CAREERS_URL,
          html: emersonCareersHtml,
        }
      }

      if (url === nationalInstruments.ORACLE_CANDIDATE_EXPERIENCE_URL) {
        return {
          status: 200,
          url,
          html: candidateExperienceHtml,
        }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)

      if (url === nationalInstruments.buildSearchUrl({ page: 0 })) {
        return searchPayloadPage0
      }

      const detailEntry = Object.entries(detailPayloadByJobId)
        .find(([jobId]) => url === nationalInstruments.buildJobDetailApiUrl(jobId))
      if (detailEntry) {
        return detailEntry[1]
      }

      throw new Error(`Unexpected JSON URL: ${url}`)
    },
    now: () => '2026-08-03T12:34:56.000Z',
  }).run()

  assert.deepEqual(requestedPages, [
    nationalInstruments.CAREERS_URL,
    nationalInstruments.ORACLE_CANDIDATE_EXPERIENCE_URL,
  ])
  assert.deepEqual(requestedJsonUrls, [
    nationalInstruments.buildSearchUrl({ page: 0 }),
    nationalInstruments.buildJobDetailApiUrl('26006068'),
    nationalInstruments.buildJobDetailApiUrl('26006077'),
  ])
  assert.deepEqual(
    jobs.map((job) => [job.jobId, job.title, job.location, job.remoteStatus]),
    [
      ['26006068', 'Account Manager - Semiconductor', 'BENGALURU, KARNATAKA, India', 'Hybrid'],
      ['26006077', 'Field Application Engineer- Aerospace & Defense', 'HYDERABAD, TELANGANA, India', 'Remote'],
    ],
  )
  assert.ok(jobs.every((job) => job.source === 'nationalinstruments'))
  assert.ok(jobs.every((job) => job.company === 'National Instruments'))
  assert.ok(jobs.every((job) => job.link === job.applyUrl))
  assert.ok(jobs.every((job) => job.scrapedAt === '2026-08-03T12:34:56.000Z'))
})

test('National Instruments scraper fails closed when the Emerson handoff or company filter drifts', async () => {
  const nationalInstruments = await loadNationalInstrumentsModule()

  await assert.rejects(
    nationalInstruments.createNationalInstrumentsScraper({
      fetchPage: async () => ({
        status: 200,
        url: nationalInstruments.CAREERS_URL,
        html: emersonCareersHtml,
      }),
    }).run(),
    /verified careers redirect no longer matches the pinned Emerson handoff/i,
  )

  await assert.rejects(
    nationalInstruments.createNationalInstrumentsScraper({
      fetchPage: async (url) => {
        if (url === nationalInstruments.CAREERS_URL) {
          return {
            status: 200,
            url: nationalInstruments.EMERSON_CAREERS_URL,
            html: emersonCareersHtml,
          }
        }

        if (url === nationalInstruments.ORACLE_CANDIDATE_EXPERIENCE_URL) {
          return {
            status: 200,
            url,
            html: candidateExperienceHtml.replace('data-sitenumber="CX_1"', 'data-sitenumber="CX_9"'),
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
    }).run(),
    /verified Emerson Oracle candidate experience shell changed materially/i,
  )

  await assert.rejects(
    nationalInstruments.createNationalInstrumentsScraper({
      fetchPage: async (url) => {
        if (url === nationalInstruments.CAREERS_URL) {
          return {
            status: 200,
            url: nationalInstruments.EMERSON_CAREERS_URL,
            html: emersonCareersHtml,
          }
        }

        if (url === nationalInstruments.ORACLE_CANDIDATE_EXPERIENCE_URL) {
          return {
            status: 200,
            url,
            html: candidateExperienceHtml,
          }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async (url) => {
        if (url === nationalInstruments.buildSearchUrl({ page: 0 })) {
          return searchPayloadPage0
        }

        if (url === nationalInstruments.buildJobDetailApiUrl('26006068')) {
          return {
            items: [
              {
                ...detailPayloadByJobId['26006068'].items[0],
                LegalEmployerId: '300000089444245',
              },
            ],
          }
        }

        if (url === nationalInstruments.buildJobDetailApiUrl('26006077')) {
          return detailPayloadByJobId['26006077']
        }

        throw new Error(`Unexpected JSON URL: ${url}`)
      },
    }).run(),
    /Oracle detail no longer matches the verified Test & Measurement business-unit filter/i,
  )
})
