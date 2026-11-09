import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const officialCareersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title data-rh="true">EV Careers in India | Join Raptee.HV's High-Voltage Electric Vehicle Team</title>
      <script type="application/ld+json">
      {
        "@graph": [
          {
            "@type": "SiteNavigationElement",
            "hasPart": [
              {
                "name": "Careers",
                "url": "https://www.rapteehv.com/careers"
              }
            ]
          }
        ]
      }
      </script>
    </head>
    <body>
      <script src='https://raptee.keka.com/careers/api/embedjobs/js/3d03878f-6bf4-4fe3-9090-2989304de3b4' defer></script>
    </body>
  </html>
`

const kekaCareersHtml = `
  <!doctype html>
  <html>
    <body>
      <h1>Be a part of building something great</h1>
      <p>Browse all jobs</p>
      <h2>Join the Cult!</h2>
      <div id="khembedjobs"></div>
      <script>
        window.khConfig = {
          identifier: '3d03878f-6bf4-4fe3-9090-2989304de3b4',
          domain: 'https://raptee.keka.com/careers/',
          targetContainer: '#khembedjobs'
        };
      </script>
    </body>
  </html>
`

const kekaWrapperHtml = `
  <!doctype html>
  <html>
    <body>
      <script>
        fetch('/ats/documents/3d03878f-6bf4-4fe3-9090-2989304de3b4/careerportal/d9f7462140404de596d1d74272c07aa6.html')
          .then(response => response.text())
      </script>
    </body>
  </html>
`

test('RAPTEE HV validates the verified first-party handoff and Keka config', async () => {
  const raptee = await loadModule()
  assert.ok(raptee, 'RAPTEE HV scraper module should load')

  const careerConfig = raptee.extractCareerConfig(kekaCareersHtml)

  assert.equal(raptee.SOURCE, 'rapteehv')
  assert.equal(raptee.COMPANY, 'RAPTEE HV')
  assert.equal(raptee.CAREERS_URL, 'https://www.rapteehv.com/careers')
  assert.equal(raptee.EXTERNAL_HANDOFF_URL, 'https://raptee.keka.com/careers/')
  assert.equal(raptee.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(raptee.extractExternalHandoffUrl(officialCareersHtml), raptee.EXTERNAL_HANDOFF_URL)
  assert.equal(
    raptee.extractPortalDocumentUrl(kekaWrapperHtml),
    'https://raptee.keka.com/ats/documents/3d03878f-6bf4-4fe3-9090-2989304de3b4/careerportal/d9f7462140404de596d1d74272c07aa6.html',
  )
  assert.equal(raptee.hasKekaCareersSignal(kekaCareersHtml), true)
  assert.deepEqual(careerConfig, {
    identifier: '3d03878f-6bf4-4fe3-9090-2989304de3b4',
    domain: 'https://raptee.keka.com/careers/',
    portalName: 'default',
  })
  assert.equal(
    raptee.buildActiveJobsUrl(careerConfig),
    'https://raptee.keka.com/careers/api/embedjobs/default/active/3d03878f-6bf4-4fe3-9090-2989304de3b4',
  )
})

test('RAPTEE HV maps the Keka jobs payload into the shared contract', async () => {
  const raptee = await loadModule()
  assert.ok(raptee, 'RAPTEE HV scraper module should load')

  assert.deepEqual(
    raptee.extractSearchResults([
      {
        id: 149468,
        title: 'EV Engineering - Fellowship',
        description: '<div>Work across vehicle design, manufacturing, and validation.</div>',
        departmentName: 'Product Development & Validation',
        jobType: 2,
        experience: '0 - 1',
        publishedOn: '2026-07-09T10:04:57.420Z',
        skillNames: ['CAD', 'SolidWorks'],
        jobLocations: [
          {
            id: 14300,
            name: 'Raptee Energy HQ',
            city: 'Chennai',
            state: 'TN',
            countryCode: 'IN',
            countryName: 'India',
          },
        ],
      },
      {
        id: 150348,
        title: 'Industrial IoT Developer Intern',
        description: '<div>No public location listed.</div>',
        departmentName: 'Maintenance',
        jobType: 2,
        publishedOn: '2026-07-09T10:04:57.420Z',
        skillNames: [],
        jobLocations: [],
      },
    ], { domain: 'https://raptee.keka.com/careers/' }),
    [
      {
        title: 'EV Engineering - Fellowship',
        company: 'RAPTEE HV',
        department: 'Product Development & Validation',
        location: 'Chennai, TN, India',
        city: 'Chennai',
        country: 'India',
        jobId: '149468',
        requisitionId: '149468',
        sourceUrl: 'https://raptee.keka.com/careers/jobdetails/149468',
        applyUrl: 'https://raptee.keka.com/careers/applyjob/149468',
        employmentType: 'Full Time',
        experienceRequired: '0 - 1',
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: ['CAD', 'SolidWorks'],
        postingDate: '2026-07-09',
        closingDate: null,
        jobDescription: 'Work across vehicle design, manufacturing, and validation.',
        publicExperienceChecked: true,
      },
      {
        title: 'Industrial IoT Developer Intern',
        company: 'RAPTEE HV',
        department: 'Maintenance',
        location: 'India',
        city: null,
        country: 'India',
        jobId: '150348',
        requisitionId: '150348',
        sourceUrl: 'https://raptee.keka.com/careers/jobdetails/150348',
        applyUrl: 'https://raptee.keka.com/careers/applyjob/150348',
        employmentType: 'Full Time',
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: '2026-07-09',
        closingDate: null,
        jobDescription: 'No public location listed.',
        publicExperienceChecked: true,
      },
    ],
  )
})

test('RAPTEE HV run follows the verified handoff and decorates jobs', async () => {
  const raptee = await loadModule()
  assert.ok(raptee, 'RAPTEE HV scraper module should load')

  const requestedUrls = []
  const jobs = await raptee.createRapteeHvScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === raptee.CAREERS_URL) return officialCareersHtml
      if (url === raptee.EXTERNAL_HANDOFF_URL) return kekaWrapperHtml
      if (url === 'https://raptee.keka.com/ats/documents/3d03878f-6bf4-4fe3-9090-2989304de3b4/careerportal/d9f7462140404de596d1d74272c07aa6.html') {
        return kekaCareersHtml
      }
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      assert.equal(
        url,
        'https://raptee.keka.com/careers/api/embedjobs/default/active/3d03878f-6bf4-4fe3-9090-2989304de3b4',
      )
      return [
        {
          id: 149468,
          title: 'EV Engineering - Fellowship',
          description: '<div>Work across vehicle design, manufacturing, and validation.</div>',
          departmentName: 'Product Development & Validation',
          jobType: 2,
          experience: '0 - 1',
          publishedOn: '2026-07-09T10:04:57.420Z',
          skillNames: ['CAD'],
          jobLocations: [
            {
              city: 'Chennai',
              state: 'TN',
              countryCode: 'IN',
              countryName: 'India',
            },
          ],
        },
      ]
    },
    now: () => '2026-07-11T05:30:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    raptee.CAREERS_URL,
    raptee.EXTERNAL_HANDOFF_URL,
    'https://raptee.keka.com/ats/documents/3d03878f-6bf4-4fe3-9090-2989304de3b4/careerportal/d9f7462140404de596d1d74272c07aa6.html',
    'https://raptee.keka.com/careers/api/embedjobs/default/active/3d03878f-6bf4-4fe3-9090-2989304de3b4',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'rapteehv')
  assert.equal(jobs[0].company, 'RAPTEE HV')
  assert.equal(jobs[0].link, 'https://raptee.keka.com/careers/applyjob/149468')
  assert.equal(jobs[0].scrapedAt, '2026-07-11T05:30:00.000Z')
})

test('RAPTEE HV can recover with browser-backed handoff and Keka jobs when direct requests time out', async () => {
  const raptee = await loadModule()
  assert.ok(raptee, 'RAPTEE HV scraper module should load')

  const browserTextUrls = []
  const browserJsonUrls = []
  const portalDocumentUrl =
    'https://raptee.keka.com/ats/documents/3d03878f-6bf4-4fe3-9090-2989304de3b4/careerportal/d9f7462140404de596d1d74272c07aa6.html'
  const activeJobsUrl =
    'https://raptee.keka.com/careers/api/embedjobs/default/active/3d03878f-6bf4-4fe3-9090-2989304de3b4'

  const jobs = await raptee.createRapteeHvScraper({ maxJobs: 1 }).run({
    fetchText: async () => {
      throw new Error('fetch failed | Connect Timeout Error (attempted address: www.rapteehv.com:443, timeout: 10000ms)')
    },
    fetchJson: async () => {
      throw new Error('fetch failed | Connect Timeout Error (attempted address: raptee.keka.com:443, timeout: 10000ms)')
    },
    fetchBrowserText: async (url) => {
      browserTextUrls.push(url)
      if (url === raptee.CAREERS_URL) return officialCareersHtml
      if (url === raptee.EXTERNAL_HANDOFF_URL) return kekaWrapperHtml
      if (url === portalDocumentUrl) return kekaCareersHtml
      throw new Error(`Unexpected browser text URL: ${url}`)
    },
    fetchBrowserJson: async (url) => {
      browserJsonUrls.push(url)
      if (url === activeJobsUrl) {
        return [
          {
            id: 149468,
            title: 'EV Engineering - Fellowship',
            description: '<div>Work across vehicle design, manufacturing, and validation.</div>',
            departmentName: 'Product Development & Validation',
            jobType: 2,
            experience: '0 - 1',
            publishedOn: '2026-07-09T10:04:57.420Z',
            skillNames: ['CAD'],
            jobLocations: [
              {
                city: 'Chennai',
                state: 'TN',
                countryCode: 'IN',
                countryName: 'India',
              },
            ],
          },
        ]
      }

      throw new Error(`Unexpected browser JSON URL: ${url}`)
    },
    now: () => '2026-08-02T00:00:00.000Z',
  })

  assert.deepEqual(browserTextUrls, [
    raptee.CAREERS_URL,
    raptee.EXTERNAL_HANDOFF_URL,
    portalDocumentUrl,
  ])
  assert.deepEqual(browserJsonUrls, [activeJobsUrl])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'rapteehv')
  assert.equal(jobs[0].scrapedAt, '2026-08-02T00:00:00.000Z')
})

test('RAPTEE HV can use the direct rendered Keka board when the handoff already resolves to the final page', async () => {
  const raptee = await loadModule()
  assert.ok(raptee, 'RAPTEE HV scraper module should load')

  const jobs = await raptee.createRapteeHvScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      if (url === raptee.CAREERS_URL) return officialCareersHtml
      if (url === raptee.EXTERNAL_HANDOFF_URL) return kekaCareersHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      assert.equal(
        url,
        'https://raptee.keka.com/careers/api/embedjobs/default/active/3d03878f-6bf4-4fe3-9090-2989304de3b4',
      )
      return [
        {
          id: 149468,
          title: 'EV Engineering - Fellowship',
          description: '<div>Work across vehicle design, manufacturing, and validation.</div>',
          departmentName: 'Product Development & Validation',
          jobType: 2,
          experience: '0 - 1',
          publishedOn: '2026-07-09T10:04:57.420Z',
          skillNames: ['CAD'],
          jobLocations: [
            {
              city: 'Chennai',
              state: 'TN',
              countryCode: 'IN',
              countryName: 'India',
            },
          ],
        },
      ]
    },
    now: () => '2026-08-02T00:00:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'rapteehv')
  assert.equal(jobs[0].scrapedAt, '2026-08-02T00:00:00.000Z')
})

test('RAPTEE HV fails closed when the verified handoff or Keka surface changes', async () => {
  const raptee = await loadModule()
  assert.ok(raptee, 'RAPTEE HV scraper module should load')

  await assert.rejects(
    raptee.createRapteeHvScraper().run({
      fetchText: async () => officialCareersHtml.replace(
        'https://raptee.keka.com/careers/api/embedjobs/js/3d03878f-6bf4-4fe3-9090-2989304de3b4',
        'https://example.com/jobs.js',
      ),
      fetchBrowserText: async () => officialCareersHtml.replace(
        'https://raptee.keka.com/careers/api/embedjobs/js/3d03878f-6bf4-4fe3-9090-2989304de3b4',
        'https://example.com/jobs.js',
      ),
    }),
    /verified first-party careers handoff changed materially/i,
  )

  await assert.rejects(
    raptee.createRapteeHvScraper().run({
      fetchText: async (url) => {
        if (url === raptee.CAREERS_URL) return officialCareersHtml
        if (url === raptee.EXTERNAL_HANDOFF_URL) return kekaWrapperHtml
        if (url === 'https://raptee.keka.com/ats/documents/3d03878f-6bf4-4fe3-9090-2989304de3b4/careerportal/d9f7462140404de596d1d74272c07aa6.html') {
          return kekaCareersHtml.replace(
            '3d03878f-6bf4-4fe3-9090-2989304de3b4',
            'changed-identifier',
          )
        }
        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchBrowserText: async (url) => {
        if (url === raptee.CAREERS_URL) return officialCareersHtml
        if (url === raptee.EXTERNAL_HANDOFF_URL) return kekaWrapperHtml
        if (url === 'https://raptee.keka.com/ats/documents/3d03878f-6bf4-4fe3-9090-2989304de3b4/careerportal/d9f7462140404de596d1d74272c07aa6.html') {
          return kekaCareersHtml.replace(
            '3d03878f-6bf4-4fe3-9090-2989304de3b4',
            'changed-identifier',
          )
        }
        throw new Error(`Unexpected browser text URL: ${url}`)
      },
    }),
    /verified Keka careers surface changed materially|Unable to resolve RAPTEE HV Keka embed configuration/i,
  )
})
