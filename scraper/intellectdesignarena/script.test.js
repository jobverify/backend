import assert from 'node:assert/strict'
import test from 'node:test'

const loadIntellectDesignArenaModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Intellect Design Arena scraper module at ./script.js')
  }
}

const officialHomepageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Enterprise Open Finance &amp; AI-First Banking Platform - Intellect Design Arena</title>
    <link rel="canonical" href="https://www.intellectdesign.com/" />
  </head>
  <body>
    <nav>
      <a href="https://www.intellectdesign.com/careers/">Careers</a>
    </nav>
    <p>eMACH.ai powers the next era of enterprise banking transformation.</p>
    <h1>Banking, Rebuilt from First Principles</h1>
  </body>
</html>
`

const officialCareersHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers - Intellect Design Arena</title>
    <link rel="canonical" href="https://www.intellectdesign.com/careers/" />
  </head>
  <body>
    <main>
      <h1>Work at the Heart of Change</h1>
      <p>Our customer-first approach drives us to deliver innovative solutions that are backed by the principles of design thinking.</p>
      <a href="https://cloud.myadrenalin.com/CandidateMAX/#/?CompanyID=INTELLECT">Apply Now</a>
    </main>
  </body>
</html>
`

const tenantConfig = {
  apiURL: 'https://cloud.myadrenalin.com',
  apiPath: '/CandidateMAX/',
  dateFormat: 'DD-MMM-YYYY',
  language: 'en',
  CompanyTitle: 'Candidate Portal',
}

const deniedVacancyResponse = {
  IsValid: false,
  ErrorMessage: 'E001171',
  ValidationMessages: [],
  Warning: [],
  Data: [],
  FormAccess: null,
  UIModelList: null,
}

const emptyVacancyResponse = {
  IsValid: true,
  ErrorMessage: null,
  ValidationMessages: [],
  Warning: [],
  Data: [
    {
      VacancyInformation: [],
      AppliedStatus: [
        {
          APPLY_STATUS: '1',
          JOB_CODE: null,
        },
      ],
    },
  ],
  FormAccess: null,
  UIModelList: null,
}

test('Intellect Design Arena scraper validates the verified first-party careers handoff and CandidateMAX denial sentinel', async () => {
  const intellect = await loadIntellectDesignArenaModule()

  assert.equal(intellect.SOURCE, 'intellectdesignarena')
  assert.equal(intellect.COMPANY, 'Intellect Design Arena')
  assert.equal(intellect.HOMEPAGE_URL, 'https://www.intellectdesign.com/')
  assert.equal(intellect.CAREERS_URL, 'https://www.intellectdesign.com/careers/')
  assert.equal(
    intellect.APPLY_URL,
    'https://cloud.myadrenalin.com/CandidateMAX/#/?CompanyID=INTELLECT',
  )
  assert.equal(
    intellect.TENANT_CONFIG_URL,
    'https://cloud.myadrenalin.com/CandidateMAX/assets/company/INTELLECT/config.json',
  )
  assert.equal(
    intellect.VACANCY_API_URL,
    'https://cloud.myadrenalin.com/CandidateMAX/CPVacancyDetails/GetVacancyInformationWithoutToken',
  )
  assert.equal(intellect.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(intellect.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(intellect.extractApplyUrl(officialCareersHtml), intellect.APPLY_URL)
  assert.equal(intellect.hasVerifiedTenantConfig(tenantConfig), true)
  assert.equal(intellect.isVerifiedPublicVacancyDenied(deniedVacancyResponse), true)
  assert.equal(intellect.isVerifiedPublicVacancyEmptyResponse(emptyVacancyResponse), true)
})

test('Intellect Design Arena accepts the current canonical careers title separator', async () => {
  const intellect = await loadIntellectDesignArenaModule()
  const currentCareersHtml = officialCareersHtml.replace(
    '<title>Careers - Intellect Design Arena</title>',
    '<title>Careers | Intellect Design Arena</title>',
  )

  assert.equal(intellect.hasOfficialCareersSignal(currentCareersHtml), true)
})

test('Intellect Design Arena scraper returns no jobs while the verified public CandidateMAX vacancy API is empty', async () => {
  const intellect = await loadIntellectDesignArenaModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await intellect.createIntellectDesignArenaScraper().run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === intellect.HOMEPAGE_URL) return officialHomepageHtml
      if (url === intellect.CAREERS_URL) return officialCareersHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requestedJsonUrls.push({
        url,
        method: options.method || 'GET',
        body: options.body ?? null,
      })

      if (url === intellect.TENANT_CONFIG_URL) {
        return tenantConfig
      }

      if (url === intellect.VACANCY_API_URL) {
        return emptyVacancyResponse
      }

      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTextUrls, [
    intellect.HOMEPAGE_URL,
    intellect.CAREERS_URL,
  ])
  assert.deepEqual(requestedJsonUrls, [
    {
      url: intellect.TENANT_CONFIG_URL,
      method: 'GET',
      body: null,
    },
    {
      url: intellect.VACANCY_API_URL,
      method: 'POST',
      body: JSON.stringify({
        CompanyID: intellect.TENANT_COMPANY_ID,
        Flag: intellect.TENANT_COMPANY_ID,
      }),
    },
  ])
  assert.deepEqual(jobs, [])
})

test('Intellect Design Arena scraper fails closed when the verified careers handoff or CandidateMAX denial state changes', async () => {
  const intellect = await loadIntellectDesignArenaModule()

  await assert.rejects(
    intellect.createIntellectDesignArenaScraper().run({
      fetchText: async (url) => {
        if (url === intellect.HOMEPAGE_URL) return officialHomepageHtml
        if (url === intellect.CAREERS_URL) {
          return officialCareersHtml.replace(
            'https://cloud.myadrenalin.com/CandidateMAX/#/?CompanyID=INTELLECT',
            'https://cloud.myadrenalin.com/CandidateMAX/#/?CompanyID=OTHER',
          )
        }

        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async () => tenantConfig,
    }),
    /verified CandidateMAX handoff/i,
  )

  await assert.rejects(
    intellect.createIntellectDesignArenaScraper().run({
      fetchText: async (url) => {
        if (url === intellect.HOMEPAGE_URL) return officialHomepageHtml
        if (url === intellect.CAREERS_URL) return officialCareersHtml
        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async (url) => {
        if (url === intellect.TENANT_CONFIG_URL) return tenantConfig
        if (url === intellect.VACANCY_API_URL) {
          return {
            IsValid: true,
            Data: [
              {
                VacancyInformation: [
                  {
                    JOB_REQUEST_CODE: 'JR-100',
                    FUNCTION_NAME: 'Senior Engineer',
                  },
                ],
              },
            ],
          }
        }

        throw new Error(`Unexpected JSON URL: ${url}`)
      },
    }),
    /public CandidateMAX vacancy API now exposes job records/i,
  )
})


test('Intellect denial is an unavailable snapshot rather than an empty vacancy inventory', async () => {
  const i = await loadIntellectDesignArenaModule()
  await assert.rejects(i.run({fetchText:async url=>url===i.HOMEPAGE_URL?officialHomepageHtml:officialCareersHtml,fetchJson:async url=>url===i.TENANT_CONFIG_URL?tenantConfig:{IsValid:false,ErrorMessage:'E001171',Data:[]}}), /denied|unavailable/i)
})


test('intellectdesignarena stops before fetching when the caller is cancelled',async()=>{
 const {run}=await import('./script.js');const reason=new Error('cancelled');
 await assert.rejects(run({signal:AbortSignal.abort(reason),fetchText:async()=>assert.fail('no fetch')}),error=>error===reason)
})
