import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_PAGE_URL,
  COMPANY,
  SOURCE,
  createPrismaScraper,
  extractIndiaJobs,
  hasOfficialCareersPageSignal,
  hasOfficialRipplingJobsSignal,
  RIPPLING_JOBS_URL,
} from './script.js'

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Careers | Prisma</title>
      <link rel="canonical" href="https://www.prisma.io/company/careers" />
    </head>
    <body>
      <main>
        <h1>Join Prisma</h1>
        <p>Help us empower developers to build data-driven applications.</p>
        <h2>Open roles</h2>
        <script>self.__next_f.push([1, "OpenRoles"])</script>
      </main>
    </body>
  </html>
`

const ripplingRecords = [
  {
    uuid: 'd3fc3569-7c92-456c-a752-8e90008e26d2',
    name: 'Software Engineer',
    department: { label: 'Engineering' },
    url: 'https://ats.rippling.com/prisma-careers/jobs/d3fc3569-7c92-456c-a752-8e90008e26d2',
    workLocation: { label: 'Bengaluru, India' },
  },
]

test('detects the verified Prisma careers and Rippling jobs surfaces', () => {
  assert.equal(SOURCE, 'prisma')
  assert.equal(COMPANY, 'Prisma')
  assert.equal(CAREERS_PAGE_URL, 'https://www.prisma.io/company/careers')
  assert.equal(hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(RIPPLING_JOBS_URL, 'https://api.rippling.com/platform/api/ats/v1/board/prisma-careers/jobs')
  assert.equal(hasOfficialRipplingJobsSignal(ripplingRecords), true)
  assert.equal(hasOfficialCareersPageSignal('<html><body>Placeholder</body></html>'), false)
  assert.equal(hasOfficialRipplingJobsSignal([{ name: 'Unverified role' }]), false)
})

test('extracts India jobs and ignores overseas jobs', () => {
  const jobs = extractIndiaJobs([
    ...ripplingRecords,
    { ...ripplingRecords[0], uuid: 'f055f01a-81c0-4d92-bbe1-6d6e7a8112df', workLocation: { label: 'Remote (Germany)' } },
  ])

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Software Engineer')
  assert.equal(jobs[0].location, 'Bengaluru, India')
})

test('run reads the public Rippling board after validating the official careers page', async () => {
  const requestedUrls = []
  const jobs = await createPrismaScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      return ripplingRecords
    },
    now: () => new Date('2026-09-03T00:00:00.000Z'),
  })

  assert.deepEqual(requestedUrls, [CAREERS_PAGE_URL, RIPPLING_JOBS_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, SOURCE)
  assert.equal(jobs[0].scrapedAt, '2026-09-03T00:00:00.000Z')
})

test('run fails closed when Prisma careers or jobs surfaces change', async () => {
  await assert.rejects(
    createPrismaScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /Prisma careers page no longer matches the verified first-party surface/i,
  )

  await assert.rejects(
    createPrismaScraper().run({
      fetchText: async () => careersHtml,
      fetchJson: async () => [{ name: 'Unverified role' }],
    }),
    /Prisma Rippling board no longer matches the verified public jobs surface/i,
  )
})
