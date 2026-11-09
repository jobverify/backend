import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/urbanpiper/script.js')
  } catch {
    assert.fail('Expected UrbanPiper scraper module at ../../scraper/urbanpiper/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>UrbanPiper: POS Integrations To Manage Online Orders</title>
  </head>
  <body>
    <main>
      <h1>UrbanPiper: POS Integrations To Manage Online Orders</h1>
      <p>Orderline AI</p>
      <p>Manage all your food ordering channels from your existing POS</p>
      <p>Meraki</p>
      <nav>
        <a href="https://urbanpiper.keka.com/careers">Careers</a>
      </nav>
    </main>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>UrbanPiper | About Us</title>
  </head>
  <body>
    <main>
      <h1>UrbanPiper - Your Restaurant's Unfair Advantage</h1>
      <p>UrbanPiper provides restaurateurs with essential tools to build successful restaurants, empowering over 40,000 locations in 30+ countries.</p>
      <p>What began as a vision to simplify restaurant management has grown into a platform that integrates every aspect of operations, including billing, inventory, order processing, and customer engagement, into one seamless system.</p>
      <p>Our solutions-Hub, Prime, and Meraki-are crafted to make restaurant operations easier and more efficient at every stage.</p>
      <p>UrbanPiper started out as a modest 2 member team from a co-working space in Bengaluru.</p>
      <a href="https://urbanpiper.keka.com/careers">Careers</a>
    </main>
  </body>
</html>
`

const kekaShellHtml = `
<!doctype html>
<html lang="en">
  <body>
    <script>
      fetch('/ats/documents/896a0ed2-971f-4888-bc9b-d412677c6b9a/careerportal/6df1e3efa9b84016afc495a498d98599.html')
    </script>
  </body>
</html>
`

const embeddedCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <script>
      window.khConfig = {
        identifier: '896a0ed2-971f-4888-bc9b-d412677c6b9a',
        domain: 'https://urbanpiper.keka.com/careers/',
        targetContainer: '#khembedjobs'
      }
    </script>
    <script src="https://urbanpiper.keka.com/careers/api/embedjobs/js/896a0ed2-971f-4888-bc9b-d412677c6b9a" defer></script>
    <h2>Open positions</h2>
    <div id="khembedjobs"></div>
  </body>
</html>
`

const portalInfo = {
  name: 'UrbanPiper',
  shortName: 'UrbanPiper',
  careersPortalDomain: 'urbanpiper.keka.com',
  companyWebsite: 'https://www.urbanpiper.com/',
}

test('UrbanPiper constants and verified homepage-to-Keka contract match the live handoff', async () => {
  const urbanpiper = await loadModule()

  assert.equal(urbanpiper.SOURCE, 'urbanpiper')
  assert.equal(urbanpiper.COMPANY, 'UrbanPiper')
  assert.equal(urbanpiper.HOMEPAGE_URL, 'https://www.urbanpiper.com/')
  assert.equal(urbanpiper.ABOUT_URL, 'https://www.urbanpiper.com/about-us')
  assert.equal(urbanpiper.KEKA_BOARD_URL, 'https://urbanpiper.keka.com/careers')
  assert.equal(urbanpiper.EXPECTED_IDENTIFIER, '896a0ed2-971f-4888-bc9b-d412677c6b9a')
  assert.equal(urbanpiper.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(urbanpiper.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(urbanpiper.extractExternalHandoffUrl(homepageHtml), urbanpiper.KEKA_BOARD_URL)
  assert.equal(urbanpiper.extractExternalHandoffUrl(aboutHtml), urbanpiper.KEKA_BOARD_URL)
  assert.equal(
    urbanpiper.extractEmbeddedCareersDocumentPath(kekaShellHtml),
    '/ats/documents/896a0ed2-971f-4888-bc9b-d412677c6b9a/careerportal/6df1e3efa9b84016afc495a498d98599.html',
  )
  assert.deepEqual(urbanpiper.extractCareerConfig(embeddedCareersHtml), {
    identifier: '896a0ed2-971f-4888-bc9b-d412677c6b9a',
    domain: 'https://urbanpiper.keka.com/careers/',
    portalName: 'default',
  })
  assert.equal(
    urbanpiper.buildCareerPortalInfoUrl({
      domain: 'https://urbanpiper.keka.com/careers/',
      portalName: 'default',
    }),
    'https://urbanpiper.keka.com/careers/api/organization/default/careerportalinfo',
  )
  assert.equal(
    urbanpiper.buildActiveJobsUrl({
      domain: 'https://urbanpiper.keka.com/careers/',
      identifier: '896a0ed2-971f-4888-bc9b-d412677c6b9a',
      portalName: 'default',
    }),
    'https://urbanpiper.keka.com/careers/api/embedjobs/default/active/896a0ed2-971f-4888-bc9b-d412677c6b9a',
  )
  assert.equal(urbanpiper.hasExpectedPortalIdentity(portalInfo), true)
})

test('UrbanPiper maps India jobs from the trusted Keka payload and filters non-India roles', async () => {
  const urbanpiper = await loadModule()

  const jobs = urbanpiper.extractSearchResults(
    [
      {
        id: 112233,
        title: 'Senior Account Executive',
        description: '<div>Own restaurant growth across strategic accounts.</div>',
        departmentName: 'Sales',
        jobLocations: [
          {
            name: 'Bengaluru Office',
            city: 'Bengaluru',
            state: 'KA',
            countryCode: 'IN',
            countryName: 'India',
          },
        ],
        jobType: 2,
        experience: '5-8 years',
        publishedOn: '2026-07-30T07:00:00.000Z',
        skillNames: ['Sales', 'SaaS'],
      },
      {
        id: 998877,
        title: 'US Partnerships Lead',
        description: '<div>Should be filtered out.</div>',
        departmentName: 'Partnerships',
        jobLocations: [
          {
            name: 'Austin',
            city: 'Austin',
            state: 'TX',
            countryCode: 'US',
            countryName: 'United States',
          },
        ],
      },
    ],
    {
      domain: 'https://urbanpiper.keka.com/careers/',
    },
  )

  assert.deepEqual(jobs, [
    {
      title: 'Senior Account Executive',
      company: 'UrbanPiper',
      department: 'Sales',
      location: 'Bengaluru, KA, India',
      city: 'Bengaluru',
      state: 'KA',
      country: 'India',
      jobId: '112233',
      requisitionId: '112233',
      sourceUrl: 'https://urbanpiper.keka.com/careers/jobdetails/112233',
      applyUrl: 'https://urbanpiper.keka.com/careers/applyjob/112233',
      employmentType: 'Full Time',
      experienceRequired: '5-8 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Sales', 'SaaS'],
      postingDate: '2026-07-30',
      closingDate: null,
      jobDescription: 'Own restaurant growth across strategic accounts.',
    },
  ])
})

test('UrbanPiper run validates the official handoff, trusted Keka identity, and current zero-openings state', async () => {
  const urbanpiper = await loadModule()

  const requestedTexts = []
  const requestedJson = []
  const jobs = await urbanpiper.createUrbanPiperScraper().run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === urbanpiper.HOMEPAGE_URL) return homepageHtml
      if (url === urbanpiper.ABOUT_URL) return aboutHtml
      if (url === urbanpiper.KEKA_BOARD_URL) return kekaShellHtml
      if (url === 'https://urbanpiper.keka.com/ats/documents/896a0ed2-971f-4888-bc9b-d412677c6b9a/careerportal/6df1e3efa9b84016afc495a498d98599.html') {
        return embeddedCareersHtml
      }
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      if (url === 'https://urbanpiper.keka.com/careers/api/organization/default/careerportalinfo') {
        return portalInfo
      }
      if (url === 'https://urbanpiper.keka.com/careers/api/embedjobs/default/active/896a0ed2-971f-4888-bc9b-d412677c6b9a') {
        return []
      }
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTexts, [
    'https://www.urbanpiper.com/',
    'https://www.urbanpiper.com/about-us',
    'https://urbanpiper.keka.com/careers',
    'https://urbanpiper.keka.com/ats/documents/896a0ed2-971f-4888-bc9b-d412677c6b9a/careerportal/6df1e3efa9b84016afc495a498d98599.html',
  ])
  assert.deepEqual(requestedJson, [
    'https://urbanpiper.keka.com/careers/api/organization/default/careerportalinfo',
    'https://urbanpiper.keka.com/careers/api/embedjobs/default/active/896a0ed2-971f-4888-bc9b-d412677c6b9a',
  ])
  assert.deepEqual(jobs, [])
})

test('UrbanPiper fails closed when the official handoff disappears or the Keka identity drifts', async () => {
  const urbanpiper = await loadModule()

  await assert.rejects(
    urbanpiper.createUrbanPiperScraper().run({
      fetchText: async () => '<html><body>No trusted careers handoff</body></html>',
      fetchJson: async () => portalInfo,
    }),
    /trusted first-party surface/i,
  )

  await assert.rejects(
    urbanpiper.createUrbanPiperScraper().run({
      fetchText: async (url) => {
        if (url === urbanpiper.HOMEPAGE_URL) return homepageHtml
        if (url === urbanpiper.ABOUT_URL) return aboutHtml
        if (url === urbanpiper.KEKA_BOARD_URL) return kekaShellHtml
        return embeddedCareersHtml
      },
      fetchJson: async (url) => {
        if (url.includes('careerportalinfo')) {
          return { ...portalInfo, careersPortalDomain: 'different-company.keka.com' }
        }
        return []
      },
    }),
    /exact company identity/i,
  )
})
