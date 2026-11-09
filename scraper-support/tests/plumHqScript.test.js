import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>The new standard of health benefits, starts within — starts with you</h1>
      <p>Welcome home.</p>
      <p>Check out our open roles</p>
      <iframe id='kula_embed' src='https://careers.kula.ai/plumhq?jobs=true'></iframe>
    </main>
  </body>
</html>
`

const kulaJobDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Account Manager, Enterprise - Plum Benefits Private Limited</title>
  </head>
  <body>
    <main>
      <p>Account Manager, Enterprise</p>
      <p>Job type: Full Time · Department: Account Management · Work type: On-Site</p>
      <p>Bengaluru, Karnataka, India</p>
      <div class="job-details">
        <h4><strong>Role Requirement</strong></h4>
        <ul>
          <li>1-3 years of experience in a customer facing role.</li>
          <li>Very strong written and verbal communication.</li>
        </ul>
      </div>
    </main>
  </body>
</html>
`

const buildEscapedKulaHtml = (jobs) => {
  const escapedJobs = JSON.stringify(jobs).replace(/"/g, '\\"')
  return `before \\"accountName\\":\\"plumhq\\",\\"jobs\\":${escapedJobs},\\"departments\\":[] after`
}

const loadModule = async () => {
  try {
    return await import('../../scraper/plumhq/script.js')
  } catch {
    assert.fail('Expected Plum HQ scraper module at ../../scraper/plumhq/script.js')
  }
}

test('Plum HQ constants stay pinned to the verified first-party careers page and embedded Kula board', async () => {
  const plumHq = await loadModule()

  assert.equal(plumHq.COMPANY_NAME, 'Plum HQ')
  assert.equal(plumHq.SOURCE, 'plumhq')
  assert.equal(plumHq.COUNTRY_FILTER, 'India')
  assert.equal(plumHq.CAREERS_URL, 'https://www.plumhq.com/careers')
  assert.equal(plumHq.KULA_COMPANY_URL, 'https://careers.kula.ai/plumhq')
  assert.equal(plumHq.KULA_JOBS_URL, 'https://careers.kula.ai/plumhq?jobs=true')
  assert.equal(plumHq.VERIFIED_ON, '2026-07-17')
  assert.equal(plumHq.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(
    plumHq.extractEmbeddedKulaJobsUrl(careersHtml),
    'https://careers.kula.ai/plumhq?jobs=true',
  )
  assert.equal(plumHq.buildSearchUrl(), plumHq.KULA_JOBS_URL)
})

test('extractSearchResults parses embedded Kula jobs and keeps only India roles for Plum HQ', async () => {
  const plumHq = await loadModule()
  const html = buildEscapedKulaHtml([
    {
      id: 81001,
      title: 'Junior Brand Designer',
      listed: true,
      kind: 'external',
      ats_job: {
        employment_type: 'full_time',
        job_description: 'Create visual assets across employer branding touchpoints.',
        ats_department: {
          name: 'Design',
        },
        offices: [
          {
            location: 'Bengaluru, Karnataka, India',
            country: 'India',
            remote: false,
          },
        ],
      },
    },
    {
      id: 81002,
      title: 'Lead, Account-Based Marketing',
      listed: true,
      kind: 'external',
      ats_job: {
        employment_type: 'full_time',
        job_description: '$37',
        ats_department: {
          name: 'Marketing',
        },
        offices: [
          {
            location: 'Remote',
            country: 'India',
            remote: true,
          },
          {
            location: 'Bengaluru, Karnataka, India',
            country: 'India',
            remote: false,
          },
        ],
      },
    },
    {
      id: 81003,
      title: 'Product Designer',
      listed: true,
      kind: 'external',
      ats_job: {
        employment_type: 'full_time',
        ats_department: {
          name: 'Design',
        },
        offices: [
          {
            location: 'London, United Kingdom',
            country: 'United Kingdom',
            remote: false,
          },
        ],
      },
    },
  ])

  const jobs = plumHq.extractSearchResults(html)

  assert.deepEqual(jobs, [
    {
      title: 'Junior Brand Designer',
      company: 'Plum HQ',
      department: 'Design',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: '81001',
      requisitionId: '81001',
      sourceUrl: 'https://careers.kula.ai/plumhq/81001/?jobs=true',
      applyUrl: 'https://careers.kula.ai/plumhq/81001/?jobs=true',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Create visual assets across employer branding touchpoints.',
      remoteStatus: 'On-site',
    },
    {
      title: 'Lead, Account-Based Marketing',
      company: 'Plum HQ',
      department: 'Marketing',
      location: 'Remote; Bengaluru, Karnataka, India',
      city: 'Remote',
      country: 'India',
      jobId: '81002',
      requisitionId: '81002',
      sourceUrl: 'https://careers.kula.ai/plumhq/81002/?jobs=true',
      applyUrl: 'https://careers.kula.ai/plumhq/81002/?jobs=true',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'Remote',
    },
  ])
})

test('Plum HQ extracts experience from the official Kula detail page', async () => {
  const plumHq = await loadModule()
  const listing = plumHq.extractSearchResults(buildEscapedKulaHtml([
    {
      id: 34037,
      title: 'Account Manager, Enterprise',
      listed: true,
      kind: 'external',
      ats_job: {
        employment_type: 'full_time',
        ats_department: {
          name: 'Account Management',
        },
        offices: [
          {
            location: 'Bengaluru, Karnataka, India',
            country: 'India',
            remote: false,
          },
        ],
      },
    },
  ]))[0]

  assert.equal(plumHq.hasOfficialKulaJobDetailSignal(kulaJobDetailHtml), true)
  assert.deepEqual(plumHq.extractKulaJobDetail(kulaJobDetailHtml, listing), {
    ...listing,
    experienceRequired: '1 - 3 years',
  })
})

test('run validates the official careers handoff and decorates Plum HQ jobs from the embedded Kula board', async () => {
  const plumHq = await loadModule()
  const requestedUrls = []

  const jobs = await plumHq.createPlumHqScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === plumHq.CAREERS_URL) return careersHtml
      if (url === plumHq.KULA_JOBS_URL) {
        return buildEscapedKulaHtml([
          {
            id: 34037,
            title: 'Account Manager, Enterprise',
            listed: true,
            kind: 'external',
            ats_job: {
              employment_type: 'full_time',
              ats_department: {
                name: 'Account Management',
              },
              offices: [
                {
                  location: 'Bengaluru, Karnataka, India',
                  country: 'India',
                  remote: false,
                },
              ],
            },
          },
          {
            id: 81003,
            title: 'Product Designer',
            listed: true,
            kind: 'external',
            ats_job: {
              employment_type: 'full_time',
              ats_department: {
                name: 'Design',
              },
              offices: [
                {
                  location: 'London, United Kingdom',
                  country: 'United Kingdom',
                  remote: false,
                },
              ],
            },
          },
        ])
      }
      if (url === 'https://careers.kula.ai/plumhq/34037/?jobs=true') return kulaJobDetailHtml

      throw new Error(`Unexpected Plum HQ fixture URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedUrls, [
    plumHq.CAREERS_URL,
    plumHq.KULA_JOBS_URL,
    'https://careers.kula.ai/plumhq/34037/?jobs=true',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'plumhq')
  assert.equal(jobs[0].company, 'Plum HQ')
  assert.equal(jobs[0].link, 'https://careers.kula.ai/plumhq/34037/?jobs=true')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[0].experienceRequired, '1 - 3 years')
})

test('Plum HQ scraper fails closed when the verified careers page signal or embedded Kula handoff drifts', async () => {
  const plumHq = await loadModule()

  await assert.rejects(
    plumHq.createPlumHqScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified Plum HQ careers page/i,
  )

  await assert.rejects(
    plumHq.createPlumHqScraper().run({
      fetchText: async (url) => {
        if (url === plumHq.CAREERS_URL) {
          return careersHtml.replace(
            'https://careers.kula.ai/plumhq?jobs=true',
            'https://careers.kula.ai/other-company?jobs=true',
          )
        }

        throw new Error(`Unexpected Plum HQ fixture URL: ${url}`)
      },
    }),
    /verified Plum HQ careers page no longer embeds the expected Kula board/i,
  )
})
