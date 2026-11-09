import assert from 'node:assert/strict'
import test from 'node:test'

const careersPage = {
  status: 200,
  url: 'https://hoonartek.com/company/career/',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>Career - Hoonartek</title>
      </head>
      <body>
        <main>
          <h1>Grow with us</h1>
          <h2>Current Openings</h2>
          <p>Please get in touch to explore our current vacancies.</p>
        </main>
        <script type="text/javascript">
          jQuery(function () {
            var listings = "";
            jQuery.getJSON("https://hoonartek.sensehq.com/careers/api/postings", function (data) {
              jQuery.each(data.content, function (e, v) {
                listings += '<a target="blank" href="'+(v.link)+'"><span class="tagline">Experience- '+(v.experience_start)+' to '+(v.experience_end)+' Years</span></a>';
              });
            });
          });
        </script>
      </body>
    </html>
  `,
}

const listPayload = {
  content: [
    {
      id: 55244,
      title: 'Azure Data Engineer',
      location: 'Pune',
      job_status: 'OPEN',
      updated_on: 1783414311803,
      department: 'ACEP',
      code: 'ACE01629',
      experience_start: 5,
      experience_end: 8,
      job_type: 'FULLTIME',
      link: 'https://hoonartek.sensehq.com/careers/jobs/55244',
      office: {
        city: 'Pune',
        country: 'India',
        location: 'Pune',
        name: 'Pune Office',
        state: 'Maharastra',
        pin_code: '411028',
      },
      customFields: [],
    },
    {
      id: 55229,
      title: 'Partner Sales Manager',
      location: 'USA',
      job_status: 'OPEN',
      updated_on: 1784050163216,
      department: 'Sales and Marketing',
      code: 'SAL01614',
      experience_start: 3,
      experience_end: 8,
      job_type: 'FULLTIME',
      link: 'https://hoonartek.sensehq.com/careers/jobs/55229',
      office: {
        city: 'Hybrid',
        country: 'Hybtid',
        location: 'Hybrid',
        name: 'Hybrid',
        state: 'Hybrid',
        pin_code: '.',
      },
      customFields: [],
    },
  ],
  total: 58,
}

const detailPayload = {
  id: 55244,
  title: 'Azure Data Engineer',
  location: 'Pune',
  department: 'ACEP',
  code: 'ACE01629',
  experience_start: 5,
  experience_end: 8,
  job_type: 'FULLTIME',
  updated_on: '2026-07-07T08:51:51.803Z',
  office: {
    city: 'Pune',
    country: 'India',
    location: 'Pune',
    name: 'Pune Office',
    state: 'Maharastra',
    pin_code: '411028',
  },
  description_external: `
    <div>We are seeking a skilled <b>Data Engineer</b> with strong expertise in <b>Azure Synapse Analytics</b>.</div>
    <h3><b>Key Responsibilities</b></h3>
    <ul>
      <li>Design, develop, and maintain scalable ETL/ELT pipelines using Azure Data Factory and SQL.</li>
      <li>Implement incremental loading using CDC and timestamp-based approaches.</li>
    </ul>
  `,
}

const loadHoonartekModule = async () => {
  try {
    return await import('../../scraper/hoonartek/script.js')
  } catch {
    assert.fail('Expected Hoonartek scraper module at ../../scraper/hoonartek/script.js')
  }
}

test('Hoonartek helpers stay pinned to the verified first-party careers page and SenseHQ contract from July 16, 2026', async () => {
  const hoonartek = await loadHoonartekModule()

  assert.equal(hoonartek.SOURCE, 'hoonartek')
  assert.equal(hoonartek.COMPANY, 'Hoonartek')
  assert.equal(hoonartek.OFFICIAL_BRAND_NAME, 'Hoonartek')
  assert.equal(hoonartek.CAREERS_URL, 'https://hoonartek.com/company/career/')
  assert.equal(hoonartek.JOBS_API_URL, 'https://hoonartek.sensehq.com/careers/api/postings')
  assert.equal(hoonartek.JOB_DETAIL_BASE_URL, 'https://hoonartek.sensehq.com/careers/jobs/')
  assert.equal(hoonartek.JOB_DETAIL_API_BASE_URL, 'https://hoonartek.sensehq.com/careers/api/postings/')
  assert.equal(hoonartek.VERIFIED_ON, '2026-07-16')
  assert.match(hoonartek.VERIFIED_SURFACE_SUMMARY, /Azure Data Engineer/i)
  assert.equal(hoonartek.hasOfficialCareersSignal(careersPage), true)
  assert.equal(hoonartek.hasValidListingPayload(listPayload), true)
  assert.equal(hoonartek.buildJobDetailUrl(55244), 'https://hoonartek.sensehq.com/careers/jobs/55244')
  assert.equal(hoonartek.buildJobDetailApiUrl(55244), 'https://hoonartek.sensehq.com/careers/api/postings/55244')
})

test('Hoonartek extracts only India SenseHQ stubs and maps detail payloads into shared job fields', async () => {
  const hoonartek = await loadHoonartekModule()
  const stubs = hoonartek.extractIndiaListingStubs(listPayload)

  assert.deepEqual(stubs, [
    {
      jobId: '55244',
      title: 'Azure Data Engineer',
      location: 'Pune',
      department: 'ACEP',
      requisitionId: 'ACE01629',
      experienceRequired: '5 to 8 years',
      sourceUrl: 'https://hoonartek.sensehq.com/careers/jobs/55244',
    },
  ])

  const job = hoonartek.buildJobFromDetail(stubs[0], detailPayload)

  assert.deepEqual(job, {
    title: 'Azure Data Engineer',
    company: 'Hoonartek',
    department: 'ACEP',
    location: 'Pune, India',
    city: 'Pune',
    country: 'India',
    jobId: '55244',
    requisitionId: 'ACE01629',
    sourceUrl: 'https://hoonartek.sensehq.com/careers/jobs/55244',
    applyUrl: 'https://hoonartek.sensehq.com/careers/jobs/55244',
    employmentType: 'Full-time',
    experienceRequired: '5 to 8 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-07T08:51:51.803Z',
    closingDate: null,
    jobDescription:
      'We are seeking a skilled Data Engineer with strong expertise in Azure Synapse Analytics. Key Responsibilities Design, develop, and maintain scalable ETL/ELT pipelines using Azure Data Factory and SQL. Implement incremental loading using CDC and timestamp-based approaches.',
    remoteStatus: null,
  })
})

test('Hoonartek run validates the first-party page, list API, and detail API before returning India jobs', async () => {
  const hoonartek = await loadHoonartekModule()
  const requestedPages = []
  const requestedJsonUrls = []

  const jobs = await hoonartek.createHoonartekScraper({
    maxJobs: 1,
    now: () => '2026-07-16T18:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requestedPages.push(url)
      if (url === hoonartek.CAREERS_URL) return careersPage
      throw new Error(`Unexpected Hoonartek page URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === hoonartek.JOBS_API_URL) return listPayload
      if (url === hoonartek.buildJobDetailApiUrl(55244)) return detailPayload
      throw new Error(`Unexpected Hoonartek JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPages, [hoonartek.CAREERS_URL])
  assert.deepEqual(requestedJsonUrls, [
    hoonartek.JOBS_API_URL,
    hoonartek.buildJobDetailApiUrl(55244),
  ])
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      link: job.link,
      source: job.source,
      companyCareerPage: job.companyCareerPage,
      companyDomain: job.companyDomain,
      atsPlatform: job.atsPlatform,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Azure Data Engineer',
        link: 'https://hoonartek.sensehq.com/careers/jobs/55244',
        source: 'hoonartek',
        companyCareerPage: 'https://hoonartek.com/company/career/',
        companyDomain: 'hoonartek.com',
        atsPlatform: 'sensehq',
        scrapedAt: '2026-07-16T18:00:00.000Z',
      },
    ],
  )
})

test('Hoonartek fails closed when the careers page or SenseHQ payloads drift materially', async () => {
  const hoonartek = await loadHoonartekModule()

  await assert.rejects(
    hoonartek.createHoonartekScraper().run({
      fetchPage: async () => ({
        status: 200,
        url: hoonartek.CAREERS_URL,
        html: '<html><body><h1>Unexpected</h1></body></html>',
      }),
    }),
    /verified Hoonartek careers page/i,
  )

  await assert.rejects(
    hoonartek.createHoonartekScraper().run({
      fetchPage: async () => careersPage,
      fetchJson: async () => ({ content: [{ title: 'Broken' }], total: 1 }),
    }),
    /SenseHQ postings payload/i,
  )

  await assert.rejects(
    hoonartek.createHoonartekScraper().run({
      fetchPage: async () => careersPage,
      fetchJson: async (url) => {
        if (url === hoonartek.JOBS_API_URL) return listPayload
        return { ...detailPayload, title: null }
      },
    }),
    /SenseHQ job detail payload/i,
  )
})
