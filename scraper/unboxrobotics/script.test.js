import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const careerPageHtml = `
  <html>
    <head><title>Unbox Robotics Careers</title></head>
    <body>
      <h1>Be a part of building something great</h1>
      <script>
        window.khConfig = {
          identifier: '12345678-90ab-cdef-1234-567890abcdef',
          domain: 'https://unboxrobotics.keka.com/careers/'
        };
      </script>
    </body>
  </html>
`

const documentBackedCareerShellHtml = `
  <html>
    <body>
      <div id="content-container"></div>
      <script>
        fetch('/ats/documents/f8616305-d714-4d95-a354-66b7b0ebf6d0/careerportal/a57057209f464ae39f387fe6c61221f4.html')
          .then((response) => response.text())
          .then((html) => { document.getElementById('content-container').innerHTML = html; });
      </script>
    </body>
  </html>
`

test('Unbox Robotics Keka scraper resolves the official embed config and active jobs URL', async () => {
  const unbox = await loadModule()
  assert.ok(unbox, 'Unbox Robotics scraper module should load')

  const careerConfig = unbox.extractCareerConfig(careerPageHtml)

  assert.equal(unbox.CAREER_PAGE_URL, 'https://unboxrobotics.keka.com/careers')
  assert.deepEqual(careerConfig, {
    identifier: '12345678-90ab-cdef-1234-567890abcdef',
    domain: 'https://unboxrobotics.keka.com/careers/',
    portalName: 'default',
  })
  assert.equal(
    unbox.buildActiveJobsUrl(careerConfig),
    'https://unboxrobotics.keka.com/careers/api/embedjobs/default/active/12345678-90ab-cdef-1234-567890abcdef',
  )
})

test('Unbox Robotics Keka scraper keeps India roles and rejects unrelated locations', async () => {
  const unbox = await loadModule()
  assert.ok(unbox, 'Unbox Robotics scraper module should load')

  assert.deepEqual(
    unbox.extractSearchResults(
      [
        {
          id: 77123,
          title: 'Robotics Software Engineer',
          description: '<div>Build autonomy features for warehouse robots.</div>',
          departmentName: 'Engineering',
          jobType: 2,
          experience: '3 to 6 years',
          publishedOn: '2026-07-09T10:30:00.000Z',
          skillNames: ['ROS', 'C++'],
          jobLocations: [
            {
              city: 'Pune',
              state: 'Maharashtra',
              countryCode: 'IN',
              countryName: 'India',
            },
          ],
        },
        {
          id: 77124,
          title: 'Field Applications Engineer',
          jobType: 2,
          jobLocations: [
            {
              city: 'Camden',
              state: 'Delaware',
              countryCode: 'US',
              countryName: 'United States',
            },
          ],
        },
      ],
      { domain: 'https://unboxrobotics.keka.com/careers/' },
    ),
    [
      {
        title: 'Robotics Software Engineer',
        company: 'Unbox Robotics',
        department: 'Engineering',
        location: 'Pune, Maharashtra, India',
        city: 'Pune',
        country: 'India',
        jobId: '77123',
        requisitionId: '77123',
        sourceUrl: 'https://unboxrobotics.keka.com/careers/jobdetails/77123',
        applyUrl: 'https://unboxrobotics.keka.com/careers/jobdetails/77123',
        employmentType: 'Full Time',
        experienceRequired: '3 to 6 years',
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: ['ROS', 'C++'],
        postingDate: '2026-07-09',
        closingDate: null,
        jobDescription: 'Build autonomy features for warehouse robots.',
      },
    ],
  )
})

test('Unbox Robotics Keka scraper run decorates jobs from the derived active jobs feed', async () => {
  const unbox = await loadModule()
  assert.ok(unbox, 'Unbox Robotics scraper module should load')

  const requestedUrls = []
  const jobs = await unbox.createUnboxRoboticsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, unbox.CAREER_PAGE_URL)
      return careerPageHtml
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      assert.equal(
        url,
        'https://unboxrobotics.keka.com/careers/api/embedjobs/default/active/12345678-90ab-cdef-1234-567890abcdef',
      )

      return [
        {
          id: 77123,
          title: 'Robotics Software Engineer',
          description: '<div>Build autonomy features for warehouse robots.</div>',
          departmentName: 'Engineering',
          jobType: 2,
          experience: '3 to 6 years',
          publishedOn: '2026-07-09T10:30:00.000Z',
          skillNames: ['ROS', 'C++'],
          jobLocations: [
            {
              city: 'Pune',
              state: 'Maharashtra',
              countryCode: 'IN',
              countryName: 'India',
            },
          ],
        },
      ]
    },
  })

  assert.deepEqual(requestedUrls, [
    unbox.CAREER_PAGE_URL,
    'https://unboxrobotics.keka.com/careers/api/embedjobs/default/active/12345678-90ab-cdef-1234-567890abcdef',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'unboxrobotics')
  assert.equal(jobs[0].company, 'Unbox Robotics')
  assert.equal(jobs[0].link, 'https://unboxrobotics.keka.com/careers/jobdetails/77123')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('Unbox Robotics Keka scraper follows the current document-backed careers shell', async () => {
  const unbox = await loadModule()
  assert.ok(unbox, 'Unbox Robotics scraper module should load')

  const documentUrl =
    'https://unboxrobotics.keka.com/ats/documents/f8616305-d714-4d95-a354-66b7b0ebf6d0/careerportal/a57057209f464ae39f387fe6c61221f4.html'
  const requestedUrls = []

  assert.equal(
    unbox.extractCareerDocumentUrl(documentBackedCareerShellHtml, unbox.CAREER_PAGE_URL),
    documentUrl,
  )

  const jobs = await unbox.createUnboxRoboticsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === unbox.CAREER_PAGE_URL) return documentBackedCareerShellHtml
      if (url === documentUrl) return careerPageHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      assert.equal(
        url,
        'https://unboxrobotics.keka.com/careers/api/embedjobs/default/active/12345678-90ab-cdef-1234-567890abcdef',
      )
      return [
        {
          id: 134466,
          title: 'Director - Sales (India & APAC)',
          departmentName: 'Sales',
          jobType: 2,
          publishedOn: '2026-07-10T10:55:28.777Z',
          jobLocations: [{ city: 'Pune', state: 'MH', countryCode: 'IN', countryName: 'India' }],
        },
      ]
    },
  })

  assert.deepEqual(requestedUrls, [
    unbox.CAREER_PAGE_URL,
    documentUrl,
    'https://unboxrobotics.keka.com/careers/api/embedjobs/default/active/12345678-90ab-cdef-1234-567890abcdef',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Director - Sales (India & APAC)')
})

test('Unbox Robotics Keka scraper fails closed when the verified careers markup changes', async () => {
  const unbox = await loadModule()
  assert.ok(unbox, 'Unbox Robotics scraper module should load')

  await assert.rejects(
    unbox.createUnboxRoboticsScraper().run({
      fetchText: async () => '<html><body>Missing public Keka config</body></html>',
    }),
    /Unable to resolve Unbox Robotics Keka embed configuration/,
  )
})
