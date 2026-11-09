import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>ArisInfra - The Future of Construction Materials</title>
  </head>
  <body>
    <a href="./pages/about-us">About Us</a>
    <a href="./pages/careers">Careers</a>
    <a href="./pages/investor-relations">Investors</a>
    <p>One Network</p>
    <p>Simplifying Construction</p>
    <a href="https://delivery.arisinfra.com/privacy-policy">Privacy Policy</a>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>ArisInfra - Simplifying Construction</title>
  </head>
  <body>
    <a href="./careers#jobview">Explore roles</a>
    <section id="jobview">
      <h1>Pioneer the Future of Construction</h1>
      <p>Join a motivated and innovative team. We are looking for passionate and talented people from all walks of life who are eager to transform the way the construction industry operates.</p>
    </section>
    <script>
      window.khConfig = {
        identifier: 'cb2bd48a-dacd-45a9-9b06-df3dc4065912',
        domain: 'https://arisinfra.keka.com/careers/',
        targetContainer: '#khembedjobs'
      }
    </script>
    <script src="https://arisinfra.keka.com/careers/api/embedjobs/js/cb2bd48a-dacd-45a9-9b06-df3dc4065912" defer></script>
  </body>
</html>
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://arisinfra.com/</loc></url>
  <url><loc>https://arisinfra.com/pages/about-us</loc></url>
  <url><loc>https://arisinfra.com/pages/careers</loc></url>
  <url><loc>https://arisinfra.com/pages/contact</loc></url>
</urlset>
`

const careerPortalInfo = {
  name: 'Aris',
  shortName: 'Aris',
  careersPortalDomain: 'arisinfra.keka.com',
  companyWebsite: 'https://aris.in',
  jobListingSetting: {
    groupBy: 'location',
    jobFields: ['location', 'experience', 'jobType', 'dateOfPosting'],
  },
}

const activeJobsPayload = [
  {
    id: 78566,
    title: 'Senior Technical Recruiter',
    description: '<div><strong>About the Role:</strong></div><div>Own end-to-end tech hiring for Product and Engineering.</div>',
    excerpt: 'Own end-to-end tech hiring for Product and Engineering.',
    departmentName: 'Human Resource',
    experience: '3-5',
    jobNumber: 'AI1070',
    skillNames: ['Hiring', 'Stakeholder Management'],
    jobType: 2,
    publishedOn: '2026-07-07T10:07:45.010Z',
    jobLocations: [
      {
        city: 'Bangalore',
        state: 'KA',
        countryCode: 'IN',
        countryName: 'India',
        name: 'Bangalore',
      },
    ],
  },
  {
    id: 99901,
    title: 'US Partnerships Manager',
    description: '<div>Grow US channel relationships.</div>',
    excerpt: 'Grow US channel relationships.',
    departmentName: 'Growth',
    experience: '5-7',
    jobNumber: 'AI9999',
    skillNames: ['Partnerships'],
    jobType: 2,
    publishedOn: '2026-07-10T09:00:00.000Z',
    jobLocations: [
      {
        city: 'New York',
        state: 'NY',
        countryCode: 'US',
        countryName: 'United States',
        name: 'New York',
      },
    ],
  },
]

const loadArisInfraModule = async () => {
  try {
    return await import('../../scraper/arisinfra/script.js')
  } catch {
    assert.fail('Expected ArisInfra scraper module at ../../scraper/arisinfra/script.js')
  }
}

test('ArisInfra helpers stay pinned to the verified first-party careers page and embedded Keka config', async () => {
  const arisInfra = await loadArisInfraModule()

  assert.equal(arisInfra.SOURCE, 'arisinfra')
  assert.equal(arisInfra.COMPANY, 'ArisInfra')
  assert.equal(arisInfra.OFFICIAL_BRAND_NAME, 'Arisinfra Solutions Limited')
  assert.equal(arisInfra.VERIFIED_ON, '2026-07-15')
  assert.equal(arisInfra.HOMEPAGE_URL, 'https://aris.in/')
  assert.equal(arisInfra.CAREERS_URL, 'https://aris.in/pages/careers')
  assert.equal(arisInfra.SITEMAP_URL, 'https://arisinfra.com/sitemap.xml')
  assert.equal(
    arisInfra.CAREER_PORTAL_INFO_URL,
    'https://arisinfra.keka.com/careers/api/organization/default/careerportalinfo',
  )
  assert.equal(arisInfra.EXPECTED_IDENTIFIER, 'cb2bd48a-dacd-45a9-9b06-df3dc4065912')
  assert.equal(arisInfra.EXPECTED_KEKA_DOMAIN, 'https://arisinfra.keka.com/careers/')
  assert.equal(arisInfra.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(arisInfra.hasVerifiedCareersPageSignal(careersHtml), true)
  assert.equal(arisInfra.hasSitemapCareersSignal(sitemapXml), true)
  assert.deepEqual(arisInfra.extractCareerConfig(careersHtml), {
    identifier: 'cb2bd48a-dacd-45a9-9b06-df3dc4065912',
    domain: 'https://arisinfra.keka.com/careers/',
    portalName: 'default',
  })
  assert.equal(
    arisInfra.buildCareerPortalInfoUrl(arisInfra.extractCareerConfig(careersHtml)),
    'https://arisinfra.keka.com/careers/api/organization/default/careerportalinfo',
  )
  assert.equal(
    arisInfra.buildActiveJobsUrl(arisInfra.extractCareerConfig(careersHtml)),
    'https://arisinfra.keka.com/careers/api/embedjobs/default/active/cb2bd48a-dacd-45a9-9b06-df3dc4065912',
  )
  assert.deepEqual(
    arisInfra.extractSearchResults(activeJobsPayload, {
      domain: 'https://arisinfra.keka.com/careers/',
    }),
    [
      {
        title: 'Senior Technical Recruiter',
        company: 'ArisInfra',
        department: 'Human Resource',
        location: 'Bangalore, KA, India',
        city: 'Bangalore',
        country: 'India',
        jobId: '78566',
        requisitionId: 'AI1070',
        sourceUrl: 'https://arisinfra.keka.com/careers/jobdetails/78566',
        applyUrl: 'https://arisinfra.keka.com/careers/applyjob/78566',
        employmentType: 'Full Time',
        experienceRequired: '3-5',
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: ['Hiring', 'Stakeholder Management'],
        postingDate: '2026-07-07',
        closingDate: null,
        jobDescription: 'About the Role: Own end-to-end tech hiring for Product and Engineering.',
      },
    ],
  )
})

test('ArisInfra run returns India jobs from the verified first-party careers page and embedded Keka APIs', async () => {
  const arisInfra = await loadArisInfraModule()
  const requestedPageUrls = []
  const requestedJsonUrls = []

  const jobs = await arisInfra.createArisInfraScraper({
    now: () => '2026-07-15T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requestedPageUrls.push(url)

      if (url === arisInfra.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === arisInfra.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === arisInfra.SITEMAP_URL) {
        return { status: 200, url, html: sitemapXml }
      }

      throw new Error(`Unexpected ArisInfra page URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)

      if (url === arisInfra.CAREER_PORTAL_INFO_URL) {
        return { status: 200, url, json: careerPortalInfo }
      }

      if (url === 'https://arisinfra.keka.com/careers/api/embedjobs/default/active/cb2bd48a-dacd-45a9-9b06-df3dc4065912') {
        return { status: 200, url, json: activeJobsPayload }
      }

      throw new Error(`Unexpected ArisInfra JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPageUrls, [
    arisInfra.HOMEPAGE_URL,
    arisInfra.CAREERS_URL,
    arisInfra.SITEMAP_URL,
  ])
  assert.deepEqual(requestedJsonUrls, [
    arisInfra.CAREER_PORTAL_INFO_URL,
    'https://arisinfra.keka.com/careers/api/embedjobs/default/active/cb2bd48a-dacd-45a9-9b06-df3dc4065912',
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Senior Technical Recruiter',
      company: 'ArisInfra',
      department: 'Human Resource',
      location: 'Bangalore, KA, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '78566',
      requisitionId: 'AI1070',
      sourceUrl: 'https://arisinfra.keka.com/careers/jobdetails/78566',
      applyUrl: 'https://arisinfra.keka.com/careers/applyjob/78566',
      employmentType: 'Full Time',
      experienceRequired: '3-5',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Hiring', 'Stakeholder Management'],
      postingDate: '2026-07-07',
      closingDate: null,
      jobDescription: 'About the Role: Own end-to-end tech hiring for Product and Engineering.',
      source: 'arisinfra',
      link: 'https://arisinfra.keka.com/careers/applyjob/78566',
      scrapedAt: '2026-07-15T00:00:00.000Z',
    },
  ])
})

test('ArisInfra fails closed when the homepage, careers page, Keka config, portal info, or jobs feed drifts', async () => {
  const arisInfra = await loadArisInfraModule()

  await assert.rejects(
    arisInfra.createArisInfraScraper().run({
      fetchPage: async (url) => {
        if (url === arisInfra.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><head><title>Unexpected</title></head><body></body></html>' }
        }

        throw new Error(`Unexpected ArisInfra page URL: ${url}`)
      },
      fetchJson: async () => ({ status: 200, url: arisInfra.CAREER_PORTAL_INFO_URL, json: careerPortalInfo }),
    }),
    /official homepage/i,
  )

  await assert.rejects(
    arisInfra.createArisInfraScraper().run({
      fetchPage: async (url) => {
        if (url === arisInfra.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === arisInfra.CAREERS_URL) {
          return { status: 200, url, html: careersHtml.replace('window.khConfig', 'window.changedConfig') }
        }

        throw new Error(`Unexpected ArisInfra page URL: ${url}`)
      },
      fetchJson: async () => ({ status: 200, url: arisInfra.CAREER_PORTAL_INFO_URL, json: careerPortalInfo }),
    }),
    /careers page/i,
  )

  await assert.rejects(
    arisInfra.createArisInfraScraper().run({
      fetchPage: async (url) => {
        if (url === arisInfra.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === arisInfra.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: careersHtml.replace(
              'cb2bd48a-dacd-45a9-9b06-df3dc4065912',
              'changed-identifier',
            ),
          }
        }

        if (url === arisInfra.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        throw new Error(`Unexpected ArisInfra page URL: ${url}`)
      },
      fetchJson: async () => ({ status: 200, url: arisInfra.CAREER_PORTAL_INFO_URL, json: careerPortalInfo }),
    }),
    /keka job surface changed materially/i,
  )

  await assert.rejects(
    arisInfra.createArisInfraScraper().run({
      fetchPage: async (url) => {
        if (url === arisInfra.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === arisInfra.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === arisInfra.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        throw new Error(`Unexpected ArisInfra page URL: ${url}`)
      },
      fetchJson: async (url) => {
        if (url === arisInfra.CAREER_PORTAL_INFO_URL) {
          return {
            status: 200,
            url,
            json: { ...careerPortalInfo, careersPortalDomain: 'changed.keka.com' },
          }
        }

        throw new Error(`Unexpected ArisInfra JSON URL: ${url}`)
      },
    }),
    /career portal info/i,
  )

  await assert.rejects(
    arisInfra.createArisInfraScraper().run({
      fetchPage: async (url) => {
        if (url === arisInfra.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === arisInfra.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === arisInfra.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        throw new Error(`Unexpected ArisInfra page URL: ${url}`)
      },
      fetchJson: async (url) => {
        if (url === arisInfra.CAREER_PORTAL_INFO_URL) {
          return { status: 200, url, json: careerPortalInfo }
        }

        if (url === 'https://arisinfra.keka.com/careers/api/embedjobs/default/active/cb2bd48a-dacd-45a9-9b06-df3dc4065912') {
          return { status: 200, url, json: { broken: true } }
        }

        throw new Error(`Unexpected ArisInfra JSON URL: ${url}`)
      },
    }),
    /active jobs/i,
  )
})


test('ArisInfra recognizes the current official Connect privacy link without accepting an unbranded page', async () => {
  const aris = await loadArisInfraModule()
  const currentHomepage = homepageHtml.replace('https://delivery.arisinfra.com/privacy-policy', 'https://connect.aris.in/privacy-policy')
  assert.equal(aris.hasOfficialHomepageSignal(currentHomepage), true)
  assert.equal(aris.hasOfficialHomepageSignal('<html><title>Other company</title><a href="https://connect.aris.in/privacy-policy">Privacy</a></html>'), false)
})
