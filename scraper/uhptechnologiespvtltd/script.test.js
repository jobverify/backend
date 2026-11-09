import assert from 'node:assert/strict'
import test from 'node:test'

import {
  COMPANY_DETAILS_URL,
  JOBS_API_URL,
  KAS_CAREERS_URL,
  UHP_CAREERS_URL,
  createUhpTechnologiesScraper,
  hasKasGroupHandoffSignal,
  hasUhpCareersSignal,
} from './script.js'

const uhpCareersHtml = `
  <html>
    <head>
      <title>Careers - Uhp Tech</title>
    </head>
    <body>
      <p>UHP Technologies Pvt. Ltd , No.1256, KAS Tower, 3rd Floor,1st Stage, 9th C Cross ,4th block</p>
      <a href="https://www.kasgroup.in/careers/">Apply Now !</a>
      <p>Explore Careers at UHP Tech.</p>
    </body>
  </html>
`

const kasCareersHtml = `
  <html>
    <head>
      <title>Careers - KAS Group</title>
    </head>
    <body>
      <p>KAS Group is a dynamic conglomerate of UHP Technologies Pvt Ltd., KASTECH Equipments Pvt Ltd., and KASFAB Tools Private Ltd.</p>
      <a href="https://uhptechnologies.greythr.com/hire/jobs/">Apply Now</a>
      <a href="https://www.cognitoforms.com/UHPTechnologiesPvtLtd/GET2026ApplicationForm">Apply Now</a>
    </body>
  </html>
`

const companyDetails = {
  company_name: 'M/S UHP TECHNOLOGIES Pvt Ltd',
  other_details: {
    website: 'www.kasgroup.in',
    social: {
      in: 'https://in.linkedin.com/company/uhp-technologies-pte-ltd',
    },
  },
}

const jobsPayload = {
  data: [
    {
      id: 'job-1',
      req_id: '1050',
      slug: 'accounts-executive',
      title: 'Accounts Executive',
      description: `
        <p><strong>Job Location:</strong> HBR Layout Bangalore</p>
        <p><strong>Qualification</strong></p>
        <p>B.Com / M.Com / MBA Finance or equivalent</p>
      `,
      job_type: 'Full-time',
      min_exp: 24,
      max_exp: 72,
      is_remote: false,
      apply_url: 'https://uhptechnologies.greythr.com/hire/jobs/accounts-executive',
      published_on_career_page: '2026-05-27T10:06:14.916277Z',
      added_by_email: 'resume@uhptech.com',
    },
    {
      id: 'job-2',
      req_id: '1010',
      slug: 'jd-instrumentation-engineer-sr-engineer-am',
      title: 'Instrumentation Engineer/ Sr. Engineer/ AM/ Manager : Project Sites',
      description: `
        <p>Position needs continuous travel to customer site.</p>
        <p>Candidate must stay at customer location anywhere in India.</p>
        <p>Work Location: PAN India</p>
      `,
      job_type: 'Full-time',
      min_exp: 60,
      max_exp: 180,
      is_remote: true,
      apply_url: 'https://uhptechnologies.greythr.com/hire/jobs/jd-instrumentation-engineer-sr-engineer-am',
      published_on_career_page: '2026-06-05T10:27:44.683219Z',
      added_by_email: 'resume@uhptech.com',
    },
  ],
}

test('official signal helpers validate the UHP careers page and KAS Group handoff', () => {
  assert.equal(UHP_CAREERS_URL, 'https://uhptech.com/careers/')
  assert.equal(KAS_CAREERS_URL, 'https://kasgroup.in/careers/')
  assert.equal(COMPANY_DETAILS_URL, 'https://uhptechnologies.greythr.com/hire/api/career/get_company_details/')
  assert.equal(JOBS_API_URL, 'https://uhptechnologies.greythr.com/hire/api/career/published_jobs/')
  assert.equal(hasUhpCareersSignal(uhpCareersHtml), true)
  assert.equal(hasKasGroupHandoffSignal(kasCareersHtml), true)
})

test('run verifies the official handoff chain and returns mapped GreytHR jobs', async () => {
  const requests = []
  const scraper = createUhpTechnologiesScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requests.push({ type: 'text', url })

      if (url === UHP_CAREERS_URL) return uhpCareersHtml
      if (url === KAS_CAREERS_URL) return kasCareersHtml

      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requests.push({ type: 'json', url, options })

      if (url === COMPANY_DETAILS_URL) return companyDetails
      if (url === JOBS_API_URL) return jobsPayload

      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    { type: 'text', url: UHP_CAREERS_URL },
    { type: 'text', url: KAS_CAREERS_URL },
    { type: 'json', url: COMPANY_DETAILS_URL, options: { method: 'GET' } },
    { type: 'json', url: JOBS_API_URL, options: { method: 'POST', body: {} } },
  ])

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Accounts Executive')
  assert.equal(jobs[0].company, 'UHP Technologies Pvt Ltd')
  assert.equal(jobs[0].location, 'HBR Layout Bangalore')
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.equal(jobs[0].experienceRequired, '2-6 years')
  assert.equal(jobs[0].minimumQualification, 'B.Com / M.Com / MBA Finance or equivalent')
  assert.equal(jobs[0].source, 'uhptechnologiespvtltd')
  assert.equal(jobs[0].link, 'https://uhptechnologies.greythr.com/hire/jobs/accounts-executive')
  assert.equal(jobs[0].requisitionId, '1050')
  assert.match(jobs[0].scrapedAt, /\d{4}-\d{2}-\d{2}T/)

  assert.equal(jobs[1].title, 'Instrumentation Engineer/ Sr. Engineer/ AM/ Manager : Project Sites')
  assert.equal(jobs[1].location, 'PAN India')
  assert.equal(jobs[1].remoteStatus, 'On-site')
  assert.equal(jobs[1].experienceRequired, '5-15 years')
})

test('run fails closed when the UHP careers page no longer links to the verified KAS Group handoff', async () => {
  const scraper = createUhpTechnologiesScraper()

  await assert.rejects(
    scraper.run({
      fetchText: async (url) => {
        if (url === UHP_CAREERS_URL) {
          return '<html><title>Careers - Uhp Tech</title><body><p>Explore Careers at UHP Tech.</p></body></html>'
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchJson: async () => {
        throw new Error('Should not fetch JSON when the official surface has drifted')
      },
    }),
    /official UHP Technologies careers surface changed/i,
  )
})
