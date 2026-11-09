import assert from 'node:assert/strict'
import test from 'node:test'

const careersShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>FinBox</title>
    <link rel="canonical" href="https://www.finbox.in/careers">
    <meta name="description" content="Powering modern credit with a suite of infrastructure, risk intelligence and orchestration solutions.">
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Organization","name":"FinBox"}
    </script>
  </head>
  <body>
    <main>
      <h1>Careers at FinBox</h1>
      <a href="https://jobs.reczee.com/finbox/job-embed">View open roles</a>
    </main>
  </body>
</html>
`

const jobsBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta name="title" content="Jobs at FinBox">
    <meta name="description" content="Come join our awesome team at FinBox!">
  </head>
  <body></body>
</html>
`

const companyDetailsPayload = {
  data: {
    company: {
      name: 'FinBox',
      slug: 'finbox',
      website_url: 'https://finbox.in/',
      careers_page_active: true,
      logo_url: '/react-static/companies/finbox/jobs-page-logo.svg',
    },
  },
}

const requisitionsPayload = {
  data: {
    company: 'FinBox',
    requisitions: [
      {
        id: 2904,
        company: {
          name: 'FinBox',
        },
        department: {
          title: 'Data Science',
        },
        title: 'Senior Data Scientist ',
        designation: 'Senior Data Scientist',
        slug: 'IGCBY',
        experience_range: [3, 4],
        job_type_display: 'Full-time',
        job_description: '<p>Build credit intelligence for next-gen lending.</p>',
        locations: [
          {
            city: 'Bengaluru',
            country: 'India',
            country_code: 'IN',
          },
        ],
        posted_on: '2026-07-13T07:02:01.000Z',
        open_for_careers_page: true,
      },
      {
        id: 2877,
        company: {
          name: 'FinBox',
        },
        department: {
          title: 'Implementation',
        },
        title: 'Credit Implementation Manager',
        designation: 'Credit Implementation Manager',
        slug: 'bBYf8',
        experience_range: [3, 6],
        job_type_display: 'Full-time',
        job_description: '<p>Own end-to-end implementation of credit products.</p>',
        locations: [
          {
            city: 'Mumbai',
            country: 'India',
            country_code: 'IN',
          },
        ],
        posted_on: '2026-07-06T04:46:41.000Z',
        open_for_careers_page: true,
      },
    ],
  },
}

const loadFinBoxModule = async () => {
  try {
    return await import('../../scraper/finbox/script.js')
  } catch {
    assert.fail('Expected FinBox scraper module at ../../scraper/finbox/script.js')
  }
}

test('FinBox helpers stay pinned to the verified first-party careers shell and public Reczee job routes', async () => {
  const finBox = await loadFinBoxModule()

  assert.equal(finBox.SOURCE, 'finbox')
  assert.equal(finBox.COMPANY, 'FinBox')
  assert.equal(finBox.OFFICIAL_BRAND_NAME, 'FinBox')
  assert.equal(finBox.VERIFIED_ON, '2026-07-15')
  assert.equal(finBox.HOMEPAGE_URL, 'https://www.finbox.in/')
  assert.equal(finBox.CAREERS_PAGE_URL, 'https://www.finbox.in/careers')
  assert.equal(finBox.JOBS_EMBED_URL, 'https://jobs.reczee.com/finbox/job-embed')
  assert.equal(
    finBox.COMPANY_DETAILS_API_URL,
    'https://app.reczee.com/api/v1/company/get-careers-page-details?company_slug=finbox',
  )
  assert.equal(
    finBox.REQUISITIONS_API_URL,
    'https://app.reczee.com/api/v1/requisitions/get-open-requisitions?company_slug=finbox',
  )
  assert.equal(finBox.buildJobDetailUrl('IGCBY'), 'https://jobs.reczee.com/finbox/IGCBY')
  assert.equal(
    finBox.buildJobApplyUrl('IGCBY'),
    'https://jobs.reczee.com/finbox/IGCBY/apply',
  )
  assert.equal(finBox.hasVerifiedCareersShell(careersShellHtml), true)
  assert.equal(finBox.hasVerifiedJobsEmbedShell(jobsBoardHtml), true)
  assert.equal(
    finBox.extractJobsEmbedUrl(careersShellHtml),
    'https://jobs.reczee.com/finbox/job-embed',
  )
  assert.equal(finBox.isVerifiedCompanyDetailsPayload(companyDetailsPayload), true)
})

test('normalizeRequisition maps the public FinBox Reczee requisition fields into scraper jobs', async () => {
  const finBox = await loadFinBoxModule()
  const jobs = finBox.extractRequisitions(requisitionsPayload).map(finBox.normalizeRequisition)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Senior Data Scientist',
    company: 'FinBox',
    department: 'Data Science',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '2904',
    requisitionId: 'IGCBY',
    sourceUrl: 'https://jobs.reczee.com/finbox/IGCBY',
    applyUrl: 'https://jobs.reczee.com/finbox/IGCBY/apply',
    employmentType: 'Full-time',
    experienceRequired: '3-4 years',
    postingDate: '2026-07-13T07:02:01.000Z',
    jobDescription: 'Build credit intelligence for next-gen lending.',
  })
})

test('run verifies the FinBox first-party careers handoff and returns public FinBox Reczee requisitions', async () => {
  const finBox = await loadFinBoxModule()
  const textRequests = []
  const jsonRequests = []

  const jobs = await finBox.createFinBoxScraper().run({
    fetchText: async (url) => {
      textRequests.push(url)
      if (url === finBox.CAREERS_PAGE_URL) {
        return careersShellHtml
      }
      if (url === finBox.JOBS_BOARD_URL) {
        return jobsBoardHtml
      }

      throw new Error(`Unexpected FinBox text URL: ${url}`)
    },
    fetchJson: async (url) => {
      jsonRequests.push(url)

      if (url === finBox.COMPANY_DETAILS_API_URL) {
        return companyDetailsPayload
      }

      if (url === finBox.REQUISITIONS_API_URL) {
        return requisitionsPayload
      }

      throw new Error(`Unexpected FinBox JSON URL: ${url}`)
    },
  })

  assert.deepEqual(textRequests, [
    finBox.CAREERS_PAGE_URL,
    finBox.JOBS_BOARD_URL,
  ])
  assert.deepEqual(jsonRequests, [
    finBox.COMPANY_DETAILS_API_URL,
    finBox.REQUISITIONS_API_URL,
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'finbox')
  assert.equal(jobs[0].link, 'https://jobs.reczee.com/finbox/IGCBY/apply')
  assert.equal(jobs[1].title, 'Credit Implementation Manager')
})

test('FinBox fails closed when the first-party careers handoff or Reczee company contract drifts', async () => {
  const finBox = await loadFinBoxModule()

  await assert.rejects(
    finBox.createFinBoxScraper().run({
      fetchText: async () => careersShellHtml.replace(
        'FinBox',
        'FinBox Careers',
      ),
      fetchJson: async () => companyDetailsPayload,
    }),
    /verified first-party careers handoff/i,
  )

  await assert.rejects(
    finBox.createFinBoxScraper().run({
      fetchText: async (url) => {
        if (url === finBox.CAREERS_PAGE_URL) {
          return careersShellHtml
        }
        if (url === finBox.JOBS_BOARD_URL) {
          return jobsBoardHtml
        }

        throw new Error(`Unexpected FinBox text URL: ${url}`)
      },
      fetchJson: async (url) => {
        if (url === finBox.COMPANY_DETAILS_API_URL) {
          return {
            data: {
              company: {
                ...companyDetailsPayload.data.company,
                careers_page_active: false,
              },
            },
          }
        }

        return requisitionsPayload
      },
    }),
    /verified reczee company details/i,
  )
})
