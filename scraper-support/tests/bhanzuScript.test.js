import assert from 'node:assert/strict'
import test from 'node:test'

const loadBhanzuModule = async () => {
  try {
    return await import('../../scraper/bhanzu/script.js')
  } catch {
    return null
  }
}

const careerPageHtml = `
<!doctype html>
<html>
  <body>
    <script>
      window.khConfig = {
        identifier: '3f2a7356-33fc-4103-a523-cfd2808fe2d6',
        domain: 'https://exploringinfinities.keka.com/careers/',
        targetContainer: '#khembedjobs'
      };
    </script>
    <div id="khembedjobs"></div>
  </body>
</html>
`

test('extractCareerConfig reads the public Keka embed config from the Bhanzu careers page', async () => {
  const bhanzu = await loadBhanzuModule()
  assert.ok(bhanzu)

  assert.deepEqual(
    bhanzu.extractCareerConfig(careerPageHtml),
    {
      identifier: '3f2a7356-33fc-4103-a523-cfd2808fe2d6',
      domain: 'https://exploringinfinities.keka.com/careers/',
      portalName: 'default',
    },
  )

  assert.equal(
    bhanzu.buildActiveJobsUrl(bhanzu.extractCareerConfig(careerPageHtml)),
    'https://exploringinfinities.keka.com/careers/api/embedjobs/default/active/3f2a7356-33fc-4103-a523-cfd2808fe2d6',
  )
})

test('extractSearchResults maps public Keka jobs into the shared scraper contract and keeps India roles', async () => {
  const bhanzu = await loadBhanzuModule()
  assert.ok(bhanzu)

  const jobs = bhanzu.extractSearchResults(
    [
      {
        id: 74026,
        title: 'Full Stack Engineer',
        description: '<div>Build student tools with React and Python.</div>',
        departmentName: 'Engineering',
        jobLocations: [
          {
            id: 407,
            name: 'Bengaluru',
            city: 'Bengaluru',
            state: 'KA',
            countryCode: 'IN',
            countryName: 'India',
          },
        ],
        jobType: 2,
        experience: '2 to 4 years',
        salaryRangeFormat: 'INR 15,00,000.00 - 20,00,000.00',
        publishedOn: '2026-06-19T06:46:32.277Z',
        skillNames: ['react', 'python', 'typescript'],
      },
      {
        id: 501,
        title: 'Business Development Associate - Row',
        description: '<p>Own outbound sales for international learners.</p>',
        departmentName: 'SALES',
        jobLocations: [
          {
            id: 406,
            name: 'Remote',
            city: 'Hyderabad',
            locationIdentifier: '84f67883-964c-4798-b561-f14b6daced47',
          },
        ],
        jobType: 2,
        experience: '0.6',
        salaryRangeFormat: 'INR 3,00,000.00 - 3,50,000.00',
        publishedOn: '2025-07-07T10:44:07.177Z',
        skillNames: [],
      },
      {
        id: 99999,
        title: 'Customer Success Lead',
        description: '<p>Support customers in North America.</p>',
        departmentName: 'OPERATIONS',
        jobLocations: [
          {
            id: 999,
            name: 'San Francisco',
            city: 'San Francisco',
            state: 'CA',
            countryCode: 'US',
            countryName: 'United States',
          },
        ],
        jobType: 1,
        experience: '5+ years',
        salaryRangeFormat: '',
        publishedOn: '2026-06-01T08:00:00.000Z',
        skillNames: ['support'],
      },
    ],
    {
      kekaDomain: 'https://exploringinfinities.keka.com/careers/',
    },
  )

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Full Stack Engineer',
    company: 'Bhanzu',
    department: 'Engineering',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '74026',
    requisitionId: '74026',
    sourceUrl: 'https://exploringinfinities.keka.com/careers/jobdetails/74026',
    applyUrl: 'https://exploringinfinities.keka.com/careers/jobdetails/74026',
    employmentType: 'Full Time',
    experienceRequired: '2 to 4 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['react', 'python', 'typescript'],
    postingDate: '2026-06-19',
    closingDate: null,
    jobDescription: 'Build student tools with React and Python.',
    remoteStatus: 'On-site',
    compensation: 'INR 15,00,000.00 - 20,00,000.00',
  })
  assert.equal(jobs[1].title, 'Business Development Associate - Row')
  assert.equal(jobs[1].location, 'Remote, Hyderabad, India')
  assert.equal(jobs[1].city, 'Hyderabad')
  assert.equal(jobs[1].country, 'India')
  assert.equal(jobs[1].employmentType, 'Full Time')
  assert.equal(jobs[1].remoteStatus, 'Remote')
})

test('run fetches the Bhanzu careers page, resolves the public Keka config, and decorates Bhanzu jobs', async () => {
  const bhanzu = await loadBhanzuModule()
  assert.ok(bhanzu)

  const requestedTexts = []
  const requestedJson = []
  const scraper = bhanzu.createBhanzuScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === bhanzu.CAREER_PAGE_URL) return careerPageHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      if (url === 'https://exploringinfinities.keka.com/careers/api/embedjobs/default/active/3f2a7356-33fc-4103-a523-cfd2808fe2d6') {
        return [
          {
            id: 76501,
            title: 'Senior Learning Experience Specialist',
            description: '<div>Mentor teachers and improve classroom quality.</div>',
            departmentName: 'Learning Experience',
            jobLocations: [
              {
                id: 407,
                name: 'Bengaluru',
                city: 'Bengaluru',
                state: 'KA',
                countryCode: 'IN',
                countryName: 'India',
              },
            ],
            jobType: 2,
            experience: '4 to 6 years',
            salaryRangeFormat: 'INR 5,00,000.00 - 8,00,000.00',
            publishedOn: '2026-06-19T06:46:32.277Z',
            skillNames: ['teacher training', 'english'],
          },
        ]
      }

      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTexts, [bhanzu.CAREER_PAGE_URL])
  assert.deepEqual(requestedJson, [
    'https://exploringinfinities.keka.com/careers/api/embedjobs/default/active/3f2a7356-33fc-4103-a523-cfd2808fe2d6',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'bhanzu')
  assert.equal(jobs[0].link, 'https://exploringinfinities.keka.com/careers/jobdetails/76501')
  assert.equal(jobs[0].company, 'Bhanzu')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
