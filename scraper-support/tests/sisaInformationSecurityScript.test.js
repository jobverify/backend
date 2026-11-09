import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('../../scraper/sisainformationsecurity/script.js')

const kekaBootstrapHtml = `
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
      fetch('/ats/documents/8740a3ea-613d-40db-9641-e5d4662a22cd/careerportal/0686efb13f784b75a01b949e2315d59d.html')
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
        identifier: '8740a3ea-613d-40db-9641-e5d4662a22cd',
        domain: 'https://sisainfosec.keka.com/careers/',
        targetContainer: '#khembedjobs'
      }
    </script>
    <script src="https://sisainfosec.keka.com/careers/api/embedjobs/js/8740a3ea-613d-40db-9641-e5d4662a22cd" defer></script>
  </head>
  <body>
    <h1>Build your future with SISA</h1>
    <div id="khembedjobs"></div>
  </body>
</html>
`

const portalInfo = {
  name: 'SISA Information Security Pvt Ltd',
  shortName: 'SISA Information Security Pvt Ltd',
  careersPortalDomain: 'sisainfosec.keka.com',
}

test('SISA Information Security resolves the verified Keka bootstrap, embedded config, and portal identity', async () => {
  const sisa = await loadModule()

  assert.equal(sisa.SOURCE, 'sisainformationsecurity')
  assert.equal(sisa.COMPANY, 'SISA Information Security')
  assert.equal(sisa.OFFICIAL_CAREERS_URL, 'https://www.sisa.ai/careers')
  assert.equal(sisa.KEKA_CAREER_PAGE_URL, 'https://sisainfosec.keka.com/careers/')
  assert.equal(sisa.EXPECTED_IDENTIFIER, '8740a3ea-613d-40db-9641-e5d4662a22cd')
  assert.equal(sisa.EXPECTED_KEKA_DOMAIN, 'https://sisainfosec.keka.com/careers/')
  assert.equal(sisa.EXPECTED_PORTAL_NAME, 'SISA Information Security Pvt Ltd')

  assert.equal(
    sisa.extractEmbeddedCareersDocumentPath(kekaBootstrapHtml),
    '/ats/documents/8740a3ea-613d-40db-9641-e5d4662a22cd/careerportal/0686efb13f784b75a01b949e2315d59d.html',
  )
  assert.deepEqual(sisa.extractCareerConfig(embeddedCareersHtml), {
    identifier: '8740a3ea-613d-40db-9641-e5d4662a22cd',
    domain: 'https://sisainfosec.keka.com/careers/',
    portalName: 'default',
  })
  assert.equal(
    sisa.buildCareerPortalInfoUrl(sisa.extractCareerConfig(embeddedCareersHtml)),
    'https://sisainfosec.keka.com/careers/api/organization/default/careerportalinfo',
  )
  assert.equal(
    sisa.buildActiveJobsUrl(sisa.extractCareerConfig(embeddedCareersHtml)),
    'https://sisainfosec.keka.com/careers/api/embedjobs/default/active/8740a3ea-613d-40db-9641-e5d4662a22cd',
  )
  assert.equal(sisa.hasExpectedPortalIdentity(portalInfo), true)
})

test('SISA Information Security maps only India jobs from the verified Keka payload into the shared contract', async () => {
  const sisa = await loadModule()

  const jobs = sisa.extractSearchResults(
    [
      {
        id: 150116,
        title: 'Network Security',
        description: '<div>Investigate and validate network security findings.</div>',
        departmentName: 'Net Sec',
        jobLocations: [
          {
            name: 'Bangalore',
            city: 'Bangalore',
            state: 'KA',
            countryCode: 'IN',
            countryName: 'India',
          },
        ],
        jobType: 2,
        experience: '1-3',
        publishedOn: '2026-07-08T06:42:56.05Z',
        skillNames: ['Vulnerability scanning', 'Network VAPT'],
      },
      {
        id: 150999,
        title: 'US Security Analyst',
        departmentName: 'SOC',
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
      domain: 'https://sisainfosec.keka.com/careers/',
    },
  )

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Network Security',
    company: 'SISA Information Security',
    department: 'Net Sec',
    location: 'Bangalore, KA, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '150116',
    requisitionId: '150116',
    sourceUrl: 'https://sisainfosec.keka.com/careers/jobdetails/150116',
    applyUrl: 'https://sisainfosec.keka.com/careers/applyjob/150116',
    employmentType: 'Full Time',
    experienceRequired: '1-3',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Vulnerability scanning', 'Network VAPT'],
    postingDate: '2026-07-08',
    closingDate: null,
    jobDescription: 'Investigate and validate network security findings.',
  })
})

test('SISA Information Security run validates the pinned Keka surface and decorates jobs', async () => {
  const sisa = await loadModule()

  const requestedTexts = []
  const requestedJson = []
  const scraper = sisa.createSisaInformationSecurityScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === sisa.KEKA_CAREER_PAGE_URL) return kekaBootstrapHtml
      if (url === 'https://sisainfosec.keka.com/ats/documents/8740a3ea-613d-40db-9641-e5d4662a22cd/careerportal/0686efb13f784b75a01b949e2315d59d.html') {
        return embeddedCareersHtml
      }
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      if (url === 'https://sisainfosec.keka.com/careers/api/organization/default/careerportalinfo') {
        return portalInfo
      }
      if (url === 'https://sisainfosec.keka.com/careers/api/embedjobs/default/active/8740a3ea-613d-40db-9641-e5d4662a22cd') {
        return [
          {
            id: 150115,
            title: '.Net Backend Developer',
            description: '<div>Build scalable backend services.</div>',
            departmentName: 'ProAct',
            jobLocations: [
              {
                name: 'Bangalore',
                city: 'Bangalore',
                state: 'KA',
                countryCode: 'IN',
                countryName: 'India',
              },
            ],
            jobType: 2,
            experience: '4-5',
            publishedOn: '2026-07-08T06:40:40.827Z',
            skillNames: ['AWS', '.Net'],
          },
        ]
      }
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTexts, [
    sisa.KEKA_CAREER_PAGE_URL,
    'https://sisainfosec.keka.com/ats/documents/8740a3ea-613d-40db-9641-e5d4662a22cd/careerportal/0686efb13f784b75a01b949e2315d59d.html',
  ])
  assert.deepEqual(requestedJson, [
    'https://sisainfosec.keka.com/careers/api/organization/default/careerportalinfo',
    'https://sisainfosec.keka.com/careers/api/embedjobs/default/active/8740a3ea-613d-40db-9641-e5d4662a22cd',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'sisainformationsecurity')
  assert.equal(jobs[0].company, 'SISA Information Security')
  assert.equal(jobs[0].link, 'https://sisainfosec.keka.com/careers/applyjob/150115')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('SISA Information Security fails closed when the verified Keka bootstrap, config, or portal identity changes', async () => {
  const sisa = await loadModule()

  await assert.rejects(
    sisa.createSisaInformationSecurityScraper().run({
      fetchText: async (url) => {
        if (url === sisa.KEKA_CAREER_PAGE_URL) return '<html><body>No embedded careers doc</body></html>'
        return embeddedCareersHtml
      },
      fetchJson: async () => portalInfo,
    }),
    /embedded careers document/i,
  )

  await assert.rejects(
    sisa.createSisaInformationSecurityScraper().run({
      fetchText: async (url) => {
        if (url === sisa.KEKA_CAREER_PAGE_URL) return kekaBootstrapHtml
        return embeddedCareersHtml.replace(
          '8740a3ea-613d-40db-9641-e5d4662a22cd',
          '11111111-2222-3333-4444-555555555555',
        )
      },
      fetchJson: async (url) => {
        if (url === 'https://sisainfosec.keka.com/careers/api/organization/default/careerportalinfo') {
          return portalInfo
        }
        return []
      },
    }),
    /verified Keka job surface changed materially/i,
  )

  await assert.rejects(
    sisa.createSisaInformationSecurityScraper().run({
      fetchText: async (url) => {
        if (url === sisa.KEKA_CAREER_PAGE_URL) return kekaBootstrapHtml
        return embeddedCareersHtml
      },
      fetchJson: async (url) => {
        if (url === 'https://sisainfosec.keka.com/careers/api/organization/default/careerportalinfo') {
          return { ...portalInfo, name: 'Different Company Pvt Ltd' }
        }
        return []
      },
    }),
    /exact company identity/i,
  )
})
