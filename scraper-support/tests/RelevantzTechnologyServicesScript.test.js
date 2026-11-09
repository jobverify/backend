import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-04T00:00:00.000Z'

const VERIFIED_CAREERS_PAYLOAD = [
  {
    id: 1378,
    slug: 'careers',
    title: {
      rendered: 'Join us page',
    },
    acf: {
      ju_hiring_heading_bold: 'Hiring!',
      ju_hiring_subtitle: 'Find the perfect job for you',
      ju_location_tabs: [
        { label: 'US' },
        { label: 'India' },
        { label: 'Canada' },
      ],
      ju_job_listings: [
        {
          job_title: 'Solution Engineer',
          job_type: 'Full-time',
          job_location: 'Alpharetta, GA',
          job_location_tab: 'US',
          job_description: '<p>US role.</p>',
          job_link: '',
        },
        {
          job_title: 'Java Full stack Developer',
          job_type: 'Full-time | Experience: 5+ Years',
          job_location: 'Chennai, Tamilnadu / Pune',
          job_location_tab: 'India',
          job_description: `
            <p><strong>Skillsets Required : Core Java, Spring boot, Microservices, Angular</strong></p>
            <ul>
              <li>Developer with Java Full Stack skills with Angular Development.</li>
              <li>Experience using Java 8 or higher versions, Angular 8, Spring Boot, RESTful web services.</li>
            </ul>
          `,
          job_link: '',
        },
        {
          job_title: 'Data Architect',
          job_type: 'Full-time',
          job_location: 'Chennai, Tamilnadu | Experience: 13+ Years',
          job_location_tab: 'India',
          job_description: `
            <p><strong>Skills Required: Data Architecture, AWS/GCP/Azure, Data Lake, ETL, SQL, Snowflake.</strong></p>
            <p>We are seeking an experienced Data Architect to design, develop, and optimize our enterprise data architecture.</p>
          `,
          job_link: '',
        },
      ],
    },
  },
]

const loadModule = async () => {
  try {
    return await import('../../scraper/relevantztechnologyservices/script.js')
  } catch {
    assert.fail('Expected Relevantz Technology Services scraper module at ../../scraper/relevantztechnologyservices/script.js')
  }
}

test('Relevantz Technology Services extracts India openings from the verified WordPress careers payload', async () => {
  const relevantz = await loadModule()

  assert.equal(relevantz.SOURCE, 'relevantztechnologyservices')
  assert.equal(relevantz.COMPANY, 'Relevantz Technology Services')
  assert.equal(relevantz.CAREERS_URL, 'https://www.relevantz.com/careers/')
  assert.equal(relevantz.WORDPRESS_ORIGIN, 'https://rzwp.relevantz.com')
  assert.equal(relevantz.CAREERS_PAGE_SLUG, 'careers')
  assert.equal(
    relevantz.CAREERS_PAGE_API_URL,
    'https://rzwp.relevantz.com/wp-json/wp/v2/pages?slug=careers&acf_format=standard&_fields=id,slug,title,acf',
  )
  assert.equal(relevantz.hasOfficialCareersSignal(VERIFIED_CAREERS_PAYLOAD), true)

  const jobs = relevantz.extractIndiaJobs(VERIFIED_CAREERS_PAYLOAD)
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      employmentType: job.employmentType,
      experienceRequired: job.experienceRequired,
      applyUrl: job.applyUrl,
    })),
    [
      {
        title: 'Java Full stack Developer',
        location: 'Chennai, Tamilnadu / Pune',
        city: 'Chennai',
        employmentType: 'Full-time',
        experienceRequired: '5+ Years',
        applyUrl:
          'mailto:careers-india@relevantz.com?subject=Application%3A%20Java%20Full%20stack%20Developer&body=Hi%2C%0A%0AI%20would%20like%20to%20apply%20for%20the%20position%3A%20Java%20Full%20stack%20Developer%0ALocation%3A%20Chennai%2C%20Tamilnadu%20%2F%20Pune%0A%0APlease%20find%20my%20details%20below%3A%0A%0A',
      },
      {
        title: 'Data Architect',
        location: 'Chennai, Tamilnadu',
        city: 'Chennai',
        employmentType: 'Full-time',
        experienceRequired: '13+ Years',
        applyUrl:
          'mailto:careers-india@relevantz.com?subject=Application%3A%20Data%20Architect&body=Hi%2C%0A%0AI%20would%20like%20to%20apply%20for%20the%20position%3A%20Data%20Architect%0ALocation%3A%20Chennai%2C%20Tamilnadu%0A%0APlease%20find%20my%20details%20below%3A%0A%0A',
      },
    ],
  )
  assert.ok(jobs[0].requiredSkills.includes('Core Java'))
  assert.match(jobs[0].jobDescription, /Angular Development/i)
  assert.match(jobs[1].jobDescription, /enterprise data architecture/i)
})

test('Relevantz Technology Services run returns India openings in the shared job shape from the WordPress API payload', async () => {
  const relevantz = await loadModule()
  const jobs = await relevantz.createRelevantzTechnologyServicesScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchJson: async (url) => {
      assert.equal(url, relevantz.CAREERS_PAGE_API_URL)
      return VERIFIED_CAREERS_PAYLOAD
    },
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'relevantztechnologyservices')
  assert.equal(jobs[0].company, 'Relevantz Technology Services')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].companyCareerPage, relevantz.CAREERS_URL)
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('Relevantz Technology Services fails closed on payload drift but returns an empty list for a valid zero-India-jobs state', async () => {
  const relevantz = await loadModule()

  await assert.rejects(
    relevantz.createRelevantzTechnologyServicesScraper().run({
      fetchJson: async () => [{ slug: 'unexpected', title: { rendered: 'Unexpected' }, acf: {} }],
    }),
    /verified Relevantz Technology Services careers payload/i,
  )

  const noIndiaJobs = await relevantz.createRelevantzTechnologyServicesScraper().run({
    fetchJson: async () => [
      {
        ...VERIFIED_CAREERS_PAYLOAD[0],
        acf: {
          ...VERIFIED_CAREERS_PAYLOAD[0].acf,
          ju_job_listings: VERIFIED_CAREERS_PAYLOAD[0].acf.ju_job_listings.filter(
            (job) => job.job_location_tab !== 'India',
          ),
        },
      },
    ],
  })

  assert.deepEqual(noIndiaJobs, [])
})
