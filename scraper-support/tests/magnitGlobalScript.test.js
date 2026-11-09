import assert from 'node:assert/strict'
import test from 'node:test'

const officialCareersHtml = `
  <html>
    <head><title>Careers</title></head>
    <body>
      <h1>Career Opportunities</h1>
      <h2>India</h2>
      <a href="https://jobs.dayforcehcm.com/prounlimited/CANDIDATEPORTAL">Learn More</a>
    </body>
  </html>
`

const dayforceBoardHtml = `
  <html>
    <head><title>Job Board | Dayforce Jobs</title></head>
    <body>
      <script id="__NEXT_DATA__" type="application/json">
        {
          "props": {
            "pageProps": {
              "dehydratedState": {
                "queries": [
                  {
                    "state": {
                      "data": {
                        "clientNamespace": "prounlimited",
                        "jobBoardCode": "candidateportal",
                        "cultureCode": "en-US",
                        "jobBoardId": 1
                      }
                    }
                  }
                ]
              }
            }
          }
        }
      </script>
    </body>
  </html>
`

const searchPayload = {
  totalCount: 2,
  jobPostings: [
    {
      jobPostingId: 7167,
      jobReqId: 2759,
      jobTitle: 'Analyst, Accounts Payable',
      jobDescription: 'Position Summary',
      postingStartTimestampUTC: '2026-07-16T00:00:00+00:00',
      postingLocations: [
        {
          formattedAddress: 'Vadodara, Gujarat, India',
          isoCountryCode: 'IN',
          stateCode: 'GJ',
          cityName: 'Vadodara',
        },
      ],
    },
    {
      jobPostingId: 7170,
      jobReqId: 2738,
      jobTitle: 'Delivery Partner (EST)',
      jobDescription: 'Remote US role',
      postingStartTimestampUTC: '2026-07-15T00:00:00+00:00',
      postingLocations: [
        {
          formattedAddress: 'United States',
          isoCountryCode: 'US',
        },
      ],
    },
  ],
}

test('Magnit archived pure helpers retain their original response contract', async () => {
  const magnit = await import('../../scraper/magnitglobal/script.js')

  assert.equal(
    magnit.extractOfficialDayforceUrl(officialCareersHtml),
    'https://jobs.dayforcehcm.com/prounlimited/CANDIDATEPORTAL',
  )
  assert.equal(magnit.hasOfficialMagnitCareersSignals(officialCareersHtml), true)
  assert.deepEqual(magnit.extractDayforceSiteInfoFromBoardHtml(dayforceBoardHtml), {
    clientNamespace: 'prounlimited',
    jobBoardCode: 'candidateportal',
    cultureCode: 'en-US',
    jobBoardId: 1,
  })
  assert.equal(magnit.hasVerifiedDayforceSiteContext(
    magnit.extractDayforceSiteInfoFromBoardHtml(dayforceBoardHtml),
  ), true)
  assert.deepEqual(magnit.buildSearchRequestPayload(0), {
    clientNamespace: 'prounlimited',
    jobBoardCode: 'CANDIDATEPORTAL',
    cultureCode: 'en-US',
    distanceUnit: 0,
    paginationStart: 0,
    location: 'India',
  })
  assert.deepEqual(
    magnit.extractSearchPostings(searchPayload).map((posting) => magnit.normalizeSearchPosting(posting)).filter(Boolean),
    [
      {
        title: 'Analyst, Accounts Payable',
        company: 'Magnit Global',
        department: null,
        location: 'Vadodara, Gujarat, India',
        city: 'Vadodara',
        country: 'India',
        jobId: '7167',
        requisitionId: '2759',
        sourceUrl: 'https://jobs.dayforcehcm.com/prounlimited/CANDIDATEPORTAL/jobs/7167',
        applyUrl: 'https://jobs.dayforcehcm.com/prounlimited/CANDIDATEPORTAL/jobs/7167',
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: '2026-07-16T00:00:00+00:00',
        closingDate: null,
        jobDescription: 'Position Summary',
      },
    ],
  )
})

test('Magnit public script factory extracts full current India details from the verified native transport', async () => {
  const magnit = await import('../../scraper/magnitglobal/script.js')
  const { magnitNativeOptions, magnitDayforceIndiaRole } = await import('./fixtures/magnitNativeOptions.js')
  const jobs = await magnit.createMagnitGlobalScraper(magnitNativeOptions(magnitDayforceIndiaRole)).run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'magnitglobal')
  assert.equal(jobs[0].jobId, '7493')
  assert.ok(jobs[0].sourceDescription.length > 3000)
})

test('Magnit script delegates exported run through the current two-system native adapter', async () => {
  const magnit = await import('../../scraper/magnitglobal/script.js')
  const { magnitNativeOptions } = await import('./fixtures/magnitNativeOptions.js')
  const { readInventoryEvidence } = await import('../utils/inventoryEvidence.js')
  const jobs = await magnit.run(magnitNativeOptions())
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 9)
})

test('Magnit rejects obsolete runtime transport overrides before any implicit network request', async () => {
  const magnit = await import('../../scraper/magnitglobal/script.js')
  await assert.rejects(magnit.run({ fetchText: async () => officialCareersHtml, searchJobPostings: async () => searchPayload }),
    /current native transport requires fetchPage/)
})
