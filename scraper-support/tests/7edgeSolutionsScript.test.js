import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/7edgesolutions/script.js')
  } catch {
    assert.fail('Expected 7Edge Solutions scraper module at ../../scraper/7edgesolutions/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>7EDGE | Strategic Consulting for Digital Transformation</title>
  </head>
  <body>
    <li><a class="hvr-overline-from-left" target="_blank" href="https://7edge.keka.com/careers/">Careers</a></li>
    <h1>Strategic Consulting for Digital Transformation</h1>
    <div class="copyright-7edge">
      <p>&copy; Copyright 2021 7EDGE Private Limited. <br> <a href="/all-rights-reserved">All Rights Reserved</a></p>
    </div>
  </body>
</html>
`

const kekaShellHtml = `
<!DOCTYPE html>
<html>
  <head>
    <script>
      window.isCareersPage = true;
    </script>
  </head>
  <body>
    <div id="content-container"></div>
    <script>
      fetch('/ats/documents/47717352-59ee-46c3-9b43-ac709b076550/careerportal/72ba21369a224b3bae354e8dfc90e0e7.html')
        .then(response => response.text())
    </script>
  </body>
</html>
`

const embeddedCareersHtml = `
<!DOCTYPE html>
<html>
  <head>
    <script>
      window.khConfig = {
        identifier: '47717352-59ee-46c3-9b43-ac709b076550',
        domain: 'https://7edge.keka.com/careers/',
        targetContainer: '#khembedjobs'
      }
    </script>
    <script src="https://7edge.keka.com/careers/api/embedjobs/js/47717352-59ee-46c3-9b43-ac709b076550" defer></script>
  </head>
  <body>
    <h2>Open positions</h2>
    <div id="khembedjobs"></div>
  </body>
</html>
`

const portalInfo = {
  name: '7EDGE',
  shortName: '7EDGE',
  careersPortalDomain: '7edge.keka.com',
  companyWebsite: 'https://www.7edge.com',
}

test('7Edge Solutions validates the verified homepage handoff and pinned Keka configuration', async () => {
  const sevenEdge = await loadModule()

  assert.equal(sevenEdge.SOURCE, '7edgesolutions')
  assert.equal(sevenEdge.COMPANY, '7Edge Solutions')
  assert.equal(sevenEdge.HOMEPAGE_URL, 'https://7edge.com/')
  assert.equal(sevenEdge.EXTERNAL_HANDOFF_URL, 'https://7edge.keka.com/careers/')
  assert.equal(sevenEdge.EXPECTED_IDENTIFIER, '47717352-59ee-46c3-9b43-ac709b076550')
  assert.equal(sevenEdge.EXPECTED_KEKA_DOMAIN, 'https://7edge.keka.com/careers/')
  assert.equal(sevenEdge.EXPECTED_PORTAL_NAME, '7EDGE')
  assert.equal(sevenEdge.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(sevenEdge.extractExternalHandoffUrl(homepageHtml), sevenEdge.EXTERNAL_HANDOFF_URL)
  assert.equal(
    sevenEdge.extractEmbeddedCareersDocumentPath(kekaShellHtml),
    '/ats/documents/47717352-59ee-46c3-9b43-ac709b076550/careerportal/72ba21369a224b3bae354e8dfc90e0e7.html',
  )
  assert.deepEqual(sevenEdge.extractCareerConfig(embeddedCareersHtml), {
    identifier: '47717352-59ee-46c3-9b43-ac709b076550',
    domain: 'https://7edge.keka.com/careers/',
    portalName: 'default',
  })
  assert.equal(
    sevenEdge.buildCareerPortalInfoUrl(sevenEdge.extractCareerConfig(embeddedCareersHtml)),
    'https://7edge.keka.com/careers/api/organization/default/careerportalinfo',
  )
  assert.equal(
    sevenEdge.buildActiveJobsUrl(sevenEdge.extractCareerConfig(embeddedCareersHtml)),
    'https://7edge.keka.com/careers/api/embedjobs/default/active/47717352-59ee-46c3-9b43-ac709b076550',
  )
  assert.equal(sevenEdge.hasExpectedPortalIdentity(portalInfo), true)
})

test('7Edge Solutions keeps only India jobs from the verified Keka payload and maps them to the shared shape', async () => {
  const sevenEdge = await loadModule()

  const jobs = sevenEdge.extractSearchResults(
    [
      {
        id: 150332,
        title: 'Executive II, Marketing Operations',
        description: '<div>Build and execute intent-based outbound campaigns.</div>',
        departmentName: 'Marketing Operations',
        jobLocations: [
          {
            name: 'Bengaluru',
            city: 'Bengaluru',
            state: 'KA',
            countryCode: 'IN',
            countryName: 'India',
          },
        ],
        jobType: 2,
        experience: '3 - 5 years',
        publishedOn: '2026-07-09T09:04:16.743Z',
        skillNames: ['HubSpot', 'ABM'],
      },
      {
        id: 250001,
        title: 'US Sales Lead',
        description: '<div>Lead US demand generation.</div>',
        departmentName: 'Sales',
        jobLocations: [
          {
            name: 'Austin',
            city: 'Austin',
            state: 'TX',
            countryCode: 'US',
            countryName: 'United States',
          },
        ],
        jobType: 2,
      },
    ],
    {
      domain: 'https://7edge.keka.com/careers/',
    },
  )

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Executive II, Marketing Operations',
    company: '7Edge Solutions',
    department: 'Marketing Operations',
    location: 'Bengaluru, KA, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '150332',
    requisitionId: '150332',
    sourceUrl: 'https://7edge.keka.com/careers/jobdetails/150332',
    applyUrl: 'https://7edge.keka.com/careers/applyjob/150332',
    employmentType: 'Full Time',
    experienceRequired: '3 - 5 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['HubSpot', 'ABM'],
    postingDate: '2026-07-09',
    closingDate: null,
    jobDescription: 'Build and execute intent-based outbound campaigns.',
  })
})

test('7Edge Solutions run validates the official homepage handoff, pinned Keka surface, and decorates India jobs', async () => {
  const sevenEdge = await loadModule()
  const requestedTexts = []
  const requestedJson = []
  const scraper = sevenEdge.create7EdgeSolutionsScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === sevenEdge.HOMEPAGE_URL) return homepageHtml
      if (url === sevenEdge.EXTERNAL_HANDOFF_URL) return kekaShellHtml
      if (url === 'https://7edge.keka.com/ats/documents/47717352-59ee-46c3-9b43-ac709b076550/careerportal/72ba21369a224b3bae354e8dfc90e0e7.html') {
        return embeddedCareersHtml
      }
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      if (url === 'https://7edge.keka.com/careers/api/organization/default/careerportalinfo') {
        return portalInfo
      }
      if (url === 'https://7edge.keka.com/careers/api/embedjobs/default/active/47717352-59ee-46c3-9b43-ac709b076550') {
        return [
          {
            id: 150332,
            title: 'Executive II, Marketing Operations',
            description: '<div>Build and execute intent-based outbound campaigns.</div>',
            departmentName: 'Marketing Operations',
            jobLocations: [
              {
                name: 'Bengaluru',
                city: 'Bengaluru',
                state: 'KA',
                countryCode: 'IN',
                countryName: 'India',
              },
            ],
            jobType: 2,
            experience: '3 - 5 years',
            publishedOn: '2026-07-09T09:04:16.743Z',
            skillNames: ['HubSpot', 'ABM'],
          },
        ]
      }
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
    now: () => '2026-07-14T00:00:00.000Z',
  })

  assert.deepEqual(requestedTexts, [
    sevenEdge.HOMEPAGE_URL,
    sevenEdge.EXTERNAL_HANDOFF_URL,
    'https://7edge.keka.com/ats/documents/47717352-59ee-46c3-9b43-ac709b076550/careerportal/72ba21369a224b3bae354e8dfc90e0e7.html',
  ])
  assert.deepEqual(requestedJson, [
    'https://7edge.keka.com/careers/api/organization/default/careerportalinfo',
    'https://7edge.keka.com/careers/api/embedjobs/default/active/47717352-59ee-46c3-9b43-ac709b076550',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, '7edgesolutions')
  assert.equal(jobs[0].company, '7Edge Solutions')
  assert.equal(jobs[0].link, 'https://7edge.keka.com/careers/applyjob/150332')
  assert.equal(jobs[0].scrapedAt, '2026-07-14T00:00:00.000Z')
})

test('7Edge Solutions fails closed when the homepage handoff, embedded Keka config, or portal identity changes', async () => {
  const sevenEdge = await loadModule()

  await assert.rejects(
    sevenEdge.create7EdgeSolutionsScraper().run({
      fetchText: async (url) => {
        if (url === sevenEdge.HOMEPAGE_URL) {
          return homepageHtml.replace('https://7edge.keka.com/careers/', 'https://7edge.com/jobs')
        }
        return kekaShellHtml
      },
      fetchJson: async () => portalInfo,
    }),
    /verified official homepage no longer matches the trusted first-party careers handoff/i,
  )

  await assert.rejects(
    sevenEdge.create7EdgeSolutionsScraper().run({
      fetchText: async (url) => {
        if (url === sevenEdge.HOMEPAGE_URL) return homepageHtml
        if (url === sevenEdge.EXTERNAL_HANDOFF_URL) return kekaShellHtml
        return embeddedCareersHtml.replace(
          '47717352-59ee-46c3-9b43-ac709b076550',
          '11111111-2222-3333-4444-555555555555',
        )
      },
      fetchJson: async (url) => {
        if (url === 'https://7edge.keka.com/careers/api/organization/default/careerportalinfo') {
          return portalInfo
        }
        return []
      },
    }),
    /verified keka job surface changed materially/i,
  )

  await assert.rejects(
    sevenEdge.create7EdgeSolutionsScraper().run({
      fetchText: async (url) => {
        if (url === sevenEdge.HOMEPAGE_URL) return homepageHtml
        if (url === sevenEdge.EXTERNAL_HANDOFF_URL) return kekaShellHtml
        return embeddedCareersHtml
      },
      fetchJson: async (url) => {
        if (url === 'https://7edge.keka.com/careers/api/organization/default/careerportalinfo') {
          return { ...portalInfo, name: 'Different Company' }
        }
        return []
      },
    }),
    /exact company identity/i,
  )
})
