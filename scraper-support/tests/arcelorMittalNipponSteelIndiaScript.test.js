import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>AM/NS India - AM/NS India</title>
  </head>
  <body>
    <header>
      <nav>
        <a href="https://www.amns.in/about-us">About Us</a>
        <a href="https://ace.amns.in/CANDMICROSITE/">Careers</a>
        <a href="https://www.amns.in/sustainability">Sustainability</a>
      </nav>
    </header>
    <main>
      <h1>AM/NS India</h1>
      <p>Building the future of steel.</p>
    </main>
  </body>
</html>
`

const micrositeHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Candidate Microsite</title>
  </head>
  <body>
    <app-root></app-root>
    <script src="main-H2LDX7BJ.js"></script>
    <script src="assets/js/AdrV.js"></script>
    <script src="assets/js/AdrX.js"></script>
  </body>
</html>
`

const companyLookupPayload = {
  IsValid: true,
  Data: ['AMNS', 'defaultOU'],
  ErrorMessage: null,
}

const vacancyPayload = {
  IsValid: true,
  Data: [
    {
      VacancyInformation: [
        {
          IMG: 'TABLEBODY',
          FUNCTION_ID: '4b0c3302271b451b',
          FUNCTION_NAME: 'Shift Incharge - Mechanical Maintenance',
          CITY: 'Sanand',
          CITYID: '36D1BD0ED6C744AD',
          LOCATION_ID: '6AA4307EA3E54721',
          'CAND_VACY_lblLoc~D': 'Sanand',
          'CAND_VACY_lblExp~D': '1 - 10  Year(s)',
          'CAND_VACY_lblPos~D': '08-Jul-2026',
          'CAND_VACY_lblKew~D': '00065459-Mechanical Service Centre - Sanand',
          EXPERIENCE: '1 - 10  Year(s)',
          POSTED_ON: '2026-07-08T14:00:52.783',
          FUNCTIONAL_AREA: '00065459-Mechanical Service Centre - Sanand',
          FUNCTION_DESC: '72103008- Plant Maintenance',
          NUMBER_OF_POST: 1,
          FUNCTION_RESPONSIBILITY: '72103008- Plant Maintenance',
          JOB_REQUEST_CODE: '184d3fdbbd494ede',
          Status: '0',
          AppliedStatus: 'Not Applied',
          SavedOrNotSaved: '0',
          VAC_EMP_CATG_CODE: 'U09',
          LOCATION_NAME: 'Sanand',
          POSITION_ID: 'F7DC443EFBC64A27',
          PSM_PREAPPLY_TEMPLATE: '                ',
          APPLY_END_DATE: '2026-09-30T00:00:00',
        },
        {
          IMG: 'TABLEBODY',
          FUNCTION_ID: '588b8a294675421b',
          FUNCTION_NAME: 'Section Incharge - Crane & utilities',
          CITY: 'Bahadurgarh',
          CITYID: '428C10C53A5D4C25',
          LOCATION_ID: 'A74CA25B27564F03',
          'CAND_VACY_lblLoc~D': 'Bahadurgarh',
          'CAND_VACY_lblExp~D': '1 - 10  Year(s)',
          'CAND_VACY_lblPos~D': '08-Jul-2026',
          'CAND_VACY_lblKew~D': '00065459-Mechanical Service Centre - Sanand',
          EXPERIENCE: '1 - 10  Year(s)',
          POSTED_ON: '2026-07-08T14:00:54.043',
          FUNCTIONAL_AREA: '00065459-Mechanical Service Centre - Sanand',
          FUNCTION_DESC: '72103008- Plant Maintenance',
          NUMBER_OF_POST: 1,
          FUNCTION_RESPONSIBILITY: '72103008- Plant Maintenance',
          JOB_REQUEST_CODE: '04c8cd4bf94a43c4',
          Status: '0',
          AppliedStatus: 'Not Applied',
          SavedOrNotSaved: '0',
          VAC_EMP_CATG_CODE: 'U09',
          LOCATION_NAME: 'Bahadurgarh',
          POSITION_ID: 'A97931A6642E4DA4',
          PSM_PREAPPLY_TEMPLATE: '                ',
          APPLY_END_DATE: '2026-09-30T00:00:00',
        },
      ],
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/arcelormittalnipponsteelindia/script.js')
  } catch {
    assert.fail(
      'Expected ArcelorMittal Nippon Steel India scraper module at ../../scraper/arcelormittalnipponsteelindia/script.js',
    )
  }
}

test('ArcelorMittal Nippon Steel India scraper constants stay pinned to the verified first-party careers microsite and vacancy API', async () => {
  const arcelorMittal = await loadModule()

  assert.equal(arcelorMittal.SOURCE, 'arcelormittalnipponsteelindia')
  assert.equal(arcelorMittal.COMPANY, 'ArcelorMittal Nippon Steel India')
  assert.equal(arcelorMittal.OFFICIAL_BRAND_NAME, 'AM/NS India')
  assert.equal(arcelorMittal.VERIFIED_AT, '2026-07-15')
  assert.equal(arcelorMittal.HOMEPAGE_URL, 'https://www.amns.in/')
  assert.equal(arcelorMittal.CAREERS_ENTRY_URL, 'https://www.amns.in/careers')
  assert.equal(arcelorMittal.MICROSITE_URL, 'https://ace.amns.in/CANDMICROSITE/')
  assert.equal(
    arcelorMittal.PUBLIC_APPLY_URL,
    'https://ace.amns.in/CANDMICROSITE/#/?CompanyID=AMNS&GroupId=defaultOU',
  )
  assert.equal(
    arcelorMittal.COMPANY_LOOKUP_URL,
    'https://ace.amns.in/CANDMICROSITE/CMLandingpage/GetCompanyIDAndOUID',
  )
  assert.equal(
    arcelorMittal.VACANCY_API_URL,
    'https://ace.amns.in/CANDMICROSITE/CPVacancyDetails/GetVacancyInformationWithoutToken',
  )
  assert.equal(arcelorMittal.PUBLIC_COMPANY_ID, 'AMNS')
  assert.equal(arcelorMittal.PUBLIC_GROUP_ID, 'defaultOU')
  assert.equal(arcelorMittal.ENCODED_COMPANY_ID, 'y6k5iZIHLBMb25yRD9bK0A==')
  assert.equal(arcelorMittal.ENCODED_GROUP_ID, 'vrr0nzxsgCyo6GkEF0XU1g==')
  assert.equal(arcelorMittal.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(arcelorMittal.hasOfficialMicrositeSignal(micrositeHtml), true)
  assert.equal(
    arcelorMittal.hasVerifiedCompanyLookupPayload(companyLookupPayload),
    true,
  )
  assert.deepEqual(arcelorMittal.buildVacancyRequestBody(), {
    CompanyID: 'y6k5iZIHLBMb25yRD9bK0A==',
    Flag: 'OP',
    OU_ID: 'vrr0nzxsgCyo6GkEF0XU1g==',
    JOBID: '',
  })
  assert.equal(arcelorMittal.extractVacancyRecords(vacancyPayload).length, 2)
  assert.deepEqual(
    arcelorMittal.mapVacancyRecordToJob(vacancyPayload.Data[0].VacancyInformation[0], {
      scrapedAt: '2026-07-15T10:30:00.000Z',
    }),
    {
      title: 'Shift Incharge - Mechanical Maintenance',
      company: 'ArcelorMittal Nippon Steel India',
      department: '72103008- Plant Maintenance',
      location: 'Sanand, India',
      city: 'Sanand',
      country: 'India',
      sourceUrl: 'https://ace.amns.in/CANDMICROSITE/#/?CompanyID=AMNS&GroupId=defaultOU',
      applyUrl: 'https://ace.amns.in/CANDMICROSITE/#/?CompanyID=AMNS&GroupId=defaultOU',
      jobId: '184d3fdbbd494ede',
      requisitionId: '184d3fdbbd494ede',
      employmentType: null,
      workplaceType: null,
      experienceRequired: '1 - 10 Year(s)',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      compensation: null,
      postingDate: '2026-07-08T14:00:52.783',
      closingDate: '2026-09-30T00:00:00',
      jobDescription: [
        'Functional area: 00065459-Mechanical Service Centre - Sanand',
        'Function: 72103008- Plant Maintenance',
        'Responsibility: 72103008- Plant Maintenance',
        'Open positions: 1',
      ].join('\n'),
      source: 'arcelormittalnipponsteelindia',
      companyCareerPage: 'https://www.amns.in/careers',
      companyDomain: 'amns.in',
      atsPlatform: 'first-party-adrenalin-candidate-microsite-api',
      link: 'https://ace.amns.in/CANDMICROSITE/#/?CompanyID=AMNS&GroupId=defaultOU',
      scrapedAt: '2026-07-15T10:30:00.000Z',
    },
  )
})

test('ArcelorMittal Nippon Steel India run validates the first-party careers handoff and returns normalized vacancy API jobs', async () => {
  const arcelorMittal = await loadModule()
  const pageRequests = []
  const jsonRequests = []

  const jobs = await arcelorMittal.createArcelorMittalNipponSteelIndiaScraper({
    now: () => '2026-07-15T12:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      pageRequests.push(url)

      if (url === arcelorMittal.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === arcelorMittal.CAREERS_ENTRY_URL) {
        return { status: 200, url: arcelorMittal.MICROSITE_URL, html: micrositeHtml }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      jsonRequests.push({
        url,
        method: options.method || 'GET',
        body: options.body ?? null,
      })

      if (url === arcelorMittal.COMPANY_LOOKUP_URL) {
        return companyLookupPayload
      }

      if (url === arcelorMittal.VACANCY_API_URL) {
        return vacancyPayload
      }

      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(pageRequests, [
    arcelorMittal.HOMEPAGE_URL,
    arcelorMittal.CAREERS_ENTRY_URL,
  ])
  assert.deepEqual(jsonRequests, [
    {
      url: arcelorMittal.COMPANY_LOOKUP_URL,
      method: 'POST',
      body: '{}',
    },
    {
      url: arcelorMittal.VACANCY_API_URL,
      method: 'POST',
      body: JSON.stringify({
        CompanyID: arcelorMittal.ENCODED_COMPANY_ID,
        Flag: 'OP',
        OU_ID: arcelorMittal.ENCODED_GROUP_ID,
        JOBID: '',
      }),
    },
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'arcelormittalnipponsteelindia')
  assert.equal(jobs[0].company, 'ArcelorMittal Nippon Steel India')
  assert.equal(jobs[0].link, arcelorMittal.PUBLIC_APPLY_URL)
  assert.equal(jobs[0].scrapedAt, '2026-07-15T12:00:00.000Z')
  assert.equal(jobs[1].title, 'Section Incharge - Crane & utilities')
  assert.equal(jobs[1].city, 'Bahadurgarh')
  assert.equal(jobs[1].closingDate, '2026-09-30T00:00:00')
})

test('ArcelorMittal Nippon Steel India fails closed when the verified careers handoff, company lookup, or vacancy contract drifts', async () => {
  const arcelorMittal = await loadModule()

  await assert.rejects(
    arcelorMittal.createArcelorMittalNipponSteelIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === arcelorMittal.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><head><title>Unexpected</title></head><body>Placeholder</body></html>' }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => {
        throw new Error('JSON should not be requested when the homepage drifted')
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    arcelorMittal.createArcelorMittalNipponSteelIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === arcelorMittal.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === arcelorMittal.CAREERS_ENTRY_URL) {
          return { status: 200, url: arcelorMittal.MICROSITE_URL, html: '<html><body><h1>Microsite</h1></body></html>' }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => companyLookupPayload,
    }),
    /verified careers microsite/i,
  )

  await assert.rejects(
    arcelorMittal.createArcelorMittalNipponSteelIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === arcelorMittal.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === arcelorMittal.CAREERS_ENTRY_URL) {
          return { status: 200, url: arcelorMittal.MICROSITE_URL, html: micrositeHtml }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async (url) => {
        if (url === arcelorMittal.COMPANY_LOOKUP_URL) {
          return { IsValid: true, Data: ['OTHER', 'tenant'] }
        }

        return vacancyPayload
      },
    }),
    /verified company lookup/i,
  )

  await assert.rejects(
    arcelorMittal.createArcelorMittalNipponSteelIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === arcelorMittal.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === arcelorMittal.CAREERS_ENTRY_URL) {
          return { status: 200, url: arcelorMittal.MICROSITE_URL, html: micrositeHtml }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async (url) => {
        if (url === arcelorMittal.COMPANY_LOOKUP_URL) {
          return companyLookupPayload
        }

        return {
          IsValid: true,
          Data: [
            {
              VacancyInformation: [
                {
                  FUNCTION_NAME: 'Broken vacancy',
                  JOB_REQUEST_CODE: '',
                },
              ],
            },
          ],
        }
      },
    }),
    /verified vacancy api/i,
  )
})
