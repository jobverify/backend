import assert from 'node:assert/strict'
import test from 'node:test'

const loadCorizoModule = async () => {
  try {
    return await import('../../scraper/corizo/script.js')
  } catch {
    return null
  }
}

const buildJob = ({
  id,
  dateGmt,
  title,
  slug,
  description = '',
  classList = [],
}) => ({
  id,
  date_gmt: dateGmt,
  link: `https://corizo.in/jobs/${slug}/`,
  title: { rendered: title },
  content: { rendered: description ? `<p>${description}</p>` : '' },
  class_list: classList,
})

test('buildSearchUrl and extractSearchResults map Corizo official WordPress jobs', async () => {
  const corizo = await loadCorizoModule()
  assert.ok(corizo)

  assert.equal(
    corizo.buildSearchUrl(1),
    'https://corizo.in/wp-json/wp/v2/awsm_job_openings?_fields=id%2Cdate_gmt%2Clink%2Ctitle%2Ccontent%2Cclass_list&per_page=100&page=1',
  )

  const jobs = corizo.extractSearchResults([
    buildJob({
      id: 2507,
      dateGmt: '2025-02-09T12:31:27',
      title: 'Marketing Executive (Lead Generation)',
      slug: 'marketing-executive-lead-generation',
      description: 'Generate top-of-funnel leads across student outreach channels.',
      classList: [
        'post-2507',
        'awsm_job_openings',
        'status-publish',
        'job-type-work-from-office',
        'job-location-bangalore',
      ],
    }),
    buildJob({
      id: 2514,
      dateGmt: '2025-02-10T09:15:00',
      title: 'Business Operations Associate',
      slug: 'business-operations-associate',
      classList: [
        'post-2514',
        'awsm_job_openings',
        'status-publish',
        'job-type-remote',
        'job-location-gurugram',
      ],
    }),
  ])

  assert.deepEqual(jobs[0], {
    title: 'Marketing Executive (Lead Generation)',
    company: 'Corizo',
    department: null,
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '2507',
    requisitionId: '2507',
    sourceUrl: 'https://corizo.in/jobs/marketing-executive-lead-generation/',
    applyUrl: 'https://corizo.in/jobs/marketing-executive-lead-generation/',
    employmentType: 'Work From Office',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2025-02-09T12:31:27.000Z',
    closingDate: null,
    jobDescription: 'Generate top-of-funnel leads across student outreach channels.',
    remoteStatus: 'On-site',
  })
  assert.equal(jobs[1].location, 'Gurugram, India')
  assert.equal(jobs[1].employmentType, 'Remote')
  assert.equal(jobs[1].remoteStatus, 'Remote')
})

test('run pages through the official Corizo WordPress jobs endpoint and decorates results', async () => {
  const corizo = await loadCorizoModule()
  assert.ok(corizo)

  const requestedUrls = []
  const scraper = corizo.createCorizoScraper()
  const firstPage = Array.from({ length: 100 }, (_, index) => buildJob({
    id: 2600 + index,
    dateGmt: '2025-02-09T12:31:27',
    title: `Role ${index + 1}`,
    slug: `role-${index + 1}`,
    description: `Role ${index + 1} description`,
    classList: [
      `post-${2600 + index}`,
      'awsm_job_openings',
      'status-publish',
      'job-type-work-from-office',
      'job-location-bangalore',
    ],
  }))
  const secondPage = [
    buildJob({
      id: 2701,
      dateGmt: '2025-02-10T09:15:00',
      title: 'Final Role',
      slug: 'final-role',
      classList: [
        'post-2701',
        'awsm_job_openings',
        'status-publish',
        'job-type-work-from-office',
        'job-location-bangalore',
      ],
    }),
  ]

  const jobs = await scraper.run({
    fetchJson: async (url) => {
      requestedUrls.push(url)
      if (url === corizo.buildSearchUrl(1)) return firstPage
      if (url === corizo.buildSearchUrl(2)) return secondPage
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    corizo.buildSearchUrl(1),
    corizo.buildSearchUrl(2),
  ])
  assert.equal(jobs.length, 101)
  assert.equal(jobs[0].source, 'corizo')
  assert.equal(jobs[0].link, 'https://corizo.in/jobs/role-1/')
  assert.equal(jobs[0].company, 'Corizo')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
