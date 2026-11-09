import assert from 'node:assert/strict'
import test from 'node:test'

const loadCutShortModule = async () => {
  try {
    return await import('../../scraper/cutshort/script.js')
  } catch {
    assert.fail('Expected CutShort scraper module at ../../scraper/cutshort/script.js')
  }
}

const homepageHtml = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <title>Cutshort: Making Top Professionals More Successful.</title>
      <meta
        name="description"
        content="Use the power of Artificial Intelligence to find jobs, hire people, meet other top professionals or otherwise succeed in your career."
      />
      <script type="application/ld+json">
        {
          "@context":"https://schema.org",
          "@type":"Organization",
          "name":"Cutshort",
          "legalName":"AppyHappy Software Pvt. Ltd.",
          "url":"https://cutshort.io/",
          "sameAs":["https://www.linkedin.com/company/cutshort"]
        }
      </script>
    </head>
    <body>
      <main>
        <h1>Cutshort: Making Top Professionals More Successful.</h1>
        <p>
          Use the power of Artificial Intelligence to find jobs, hire people, meet other top
          professionals or otherwise succeed in your career.
        </p>
      </main>
    </body>
  </html>
`

const aboutHtml = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <title>About | Cutshort</title>
      <meta
        name="description"
        content="We are a small team of ambitious individuals that come from different backgrounds."
      />
      <script type="application/ld+json">
        {
          "@context":"https://schema.org",
          "@type":"Organization",
          "name":"Cutshort",
          "description":"Cutshort is a hiring platform for technology companies in India that uses AI to deliver shortlist-ready candidates who fit your roles."
        }
      </script>
    </head>
    <body>
      <main>
        <h1>About Cutshort</h1>
        <p>
          Cutshort is a hiring platform for technology companies in India that uses AI to deliver
          shortlist-ready candidates who fit your roles.
        </p>
      </main>
      <footer>
        <a href="https://cutshort.io/company/cutshort-zFdWQxlN">Career</a>
      </footer>
    </body>
  </html>
`

const companyPagePayload = {
  seoData: {
    allowRobots: true,
    title: 'Cutshort careers | 2 Cutshort Jobs in India | Cutshort',
    seoDescription: 'Apply to 2 jobs at Cutshort. Apply for new Cutshort job vacancies online at Cutshort.',
    canonical: 'https://cutshort.io/company/cutshort-zFdWQxlN',
  },
  pageContext: {
    optimizeForRole: 'candidate',
  },
  pageData: {
    company: {
      _id: '5745c54e8323796f651e0e2e',
      name: 'Cutshort',
      alias: 'cutshort-zFdWQxlN',
      founded: 2015,
      totalJobsOfCompany: 2,
      links: {
        website: 'https://cutshort.io',
        about: 'https://cutshort.io/about',
        blog: 'https://cutshort.io/blog',
        linkedin: 'https://linkedin.com/company/3836388',
      },
    },
    companyJobs: {
      jobs: [
        {
          _id: '6a186987b394d9b5f191e7ad',
          publicUrl: 'https://cutshort.io/job/Business-Growth-Analyst-Bengaluru-Bangalore-Cutshort-WgJBErFK',
          headline: 'Business Growth Analyst',
          allSkills: [
            'Sales',
            'Communication Skills',
            'Business Development',
            'Revenue growth',
            'Product Marketing',
            'Business operations',
          ],
          locations: ['Bengaluru (Bangalore)'],
          locationsText: 'Bengaluru (Bangalore)',
          expRange: {
            min: 0,
            maxInternal: 3,
            max: 3,
            minVanity: 0,
            maxVanity: 3,
          },
          sanitizedComment: `
            <p><strong>About Cutshort:</strong></p>
            <p>Build pipeline and create opportunities.</p>
            <ul>
              <li>Reach out to companies in our ICP through calls.</li>
              <li>Generate qualified meetings and demos for the sales team.</li>
            </ul>
          `,
          roleTypes: ['full_time'],
          remoteType: 'remote_not_okay',
          hiringIntentShownOn: '2026-07-08T17:08:57.243Z',
          authApplyUrl: 'https://cutshort.io/profile/view/j/6a186987b394d9b5f191e7ad',
          salaryRangeText: 'â‚¹5L - â‚¹9L / yr',
        },
        {
          _id: '69e9f060b6fa7eb334d52649',
          publicUrl: 'https://cutshort.io/job/Associate-Account-Executive-Bengaluru-Bangalore-Cutshort-icmK1bd6',
          headline: 'Associate Account Executive',
          allSkills: ['Sales', 'Business Development', 'Communication Skills'],
          locations: ['Bengaluru (Bangalore)'],
          locationsText: 'Bengaluru (Bangalore)',
          expRange: {
            min: 1,
            maxInternal: 3,
            max: 3,
            minVanity: 1,
            maxVanity: 3,
          },
          sanitizedComment: `
            <p><strong>The role</strong></p>
            <p>You will start by building your own pipeline through outbound efforts.</p>
          `,
          roleTypes: ['full_time'],
          remoteType: 'remote_not_okay',
          hiringIntentShownOn: '2026-07-06T13:18:59.854Z',
          authApplyUrl: 'https://cutshort.io/profile/view/j/69e9f060b6fa7eb334d52649',
          salaryRangeText: 'â‚¹6L - â‚¹10L / yr (ESOP available)',
        },
      ],
      page: 1,
      totalPages: 1,
    },
    breadcrumbs: [
      { label: 'Home', href: '/' },
      { label: 'Company', href: '/company' },
      { label: 'Cutshort' },
    ],
  },
}

const companyPageHtml = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <title>Cutshort careers | 2 Cutshort Jobs in India | Cutshort</title>
      <meta
        name="description"
        content="Apply to 2 jobs at Cutshort. Apply for new Cutshort job vacancies online at Cutshort."
      />
      <link rel="canonical" href="https://cutshort.io/company/cutshort-zFdWQxlN" />
    </head>
    <body>
      <main>
        <h1>Cutshort</h1>
        <a href="https://cutshort.io">https://cutshort.io</a>
        <a href="https://cutshort.io/about">About</a>
        <h2>Jobs at Cutshort</h2>
      </main>
      <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
        props: {
          pageProps: {
            dehydratedState: {
              queries: [
                {
                  queryKey: ['companyPageData', 'cutshort-zFdWQxlN'],
                  state: {
                    data: {
                      success: true,
                      data: companyPagePayload,
                      status: 200,
                    },
                  },
                },
              ],
            },
          },
        },
        page: '/company/[slug]',
        query: {
          slug: 'cutshort-zFdWQxlN',
        },
      })}</script>
    </body>
  </html>
`

test('CutShort verified homepage, about page, and company-page payload stay anchored to the current first-party public careers surface', async () => {
  const cutShort = await loadCutShortModule()

  assert.equal(cutShort.SOURCE, 'cutshort')
  assert.equal(cutShort.COMPANY, 'CutShort')
  assert.equal(cutShort.HOME_URL, 'https://cutshort.io/')
  assert.equal(cutShort.ABOUT_URL, 'https://cutshort.io/about')
  assert.equal(cutShort.BLOG_URL, 'https://cutshort.io/blog')
  assert.equal(cutShort.COMPANY_PAGE_URL, 'https://cutshort.io/company/cutshort-zFdWQxlN')

  assert.equal(cutShort.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(cutShort.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(cutShort.hasOfficialCompanyPageSignal(companyPageHtml), true)
  assert.deepEqual(cutShort.extractCompanyPageData(companyPageHtml), {
    seoData: companyPagePayload.seoData,
    companyDetails: companyPagePayload.pageData.company,
    companyJobs: companyPagePayload.pageData.companyJobs,
    breadcrumbs: companyPagePayload.pageData.breadcrumbs,
  })
})

test('run returns normalized India jobs from the official CutShort company page', async () => {
  const cutShort = await loadCutShortModule()
  const requestedUrls = []

  const jobs = await cutShort.createCutShortScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === cutShort.HOME_URL) return homepageHtml
      if (url === cutShort.ABOUT_URL) return aboutHtml
      if (url === cutShort.COMPANY_PAGE_URL) return companyPageHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-14T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    cutShort.HOME_URL,
    cutShort.ABOUT_URL,
    cutShort.COMPANY_PAGE_URL,
  ])

  assert.deepEqual(jobs, [
    {
      title: 'Business Growth Analyst',
      company: 'CutShort',
      location: 'Bengaluru (Bangalore), India',
      city: 'Bengaluru (Bangalore)',
      country: 'India',
      jobId: '6a186987b394d9b5f191e7ad',
      requisitionId: '6a186987b394d9b5f191e7ad',
      sourceUrl: 'https://cutshort.io/job/Business-Growth-Analyst-Bengaluru-Bangalore-Cutshort-WgJBErFK',
      applyUrl: 'https://cutshort.io/profile/view/j/6a186987b394d9b5f191e7ad',
      employmentType: 'Full-time',
      department: null,
      experienceRequired: '0 - 3 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        'Sales',
        'Communication Skills',
        'Business Development',
        'Revenue growth',
        'Product Marketing',
        'Business operations',
      ],
      postingDate: '2026-07-08T17:08:57.243Z',
      closingDate: null,
      jobDescription: 'About Cutshort: Build pipeline and create opportunities. Reach out to companies in our ICP through calls. Generate qualified meetings and demos for the sales team.',
      source: 'cutshort',
      link: 'https://cutshort.io/job/Business-Growth-Analyst-Bengaluru-Bangalore-Cutshort-WgJBErFK',
      scrapedAt: '2026-07-14T00:00:00.000Z',
    },
    {
      title: 'Associate Account Executive',
      company: 'CutShort',
      location: 'Bengaluru (Bangalore), India',
      city: 'Bengaluru (Bangalore)',
      country: 'India',
      jobId: '69e9f060b6fa7eb334d52649',
      requisitionId: '69e9f060b6fa7eb334d52649',
      sourceUrl: 'https://cutshort.io/job/Associate-Account-Executive-Bengaluru-Bangalore-Cutshort-icmK1bd6',
      applyUrl: 'https://cutshort.io/profile/view/j/69e9f060b6fa7eb334d52649',
      employmentType: 'Full-time',
      department: null,
      experienceRequired: '1 - 3 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Sales', 'Business Development', 'Communication Skills'],
      postingDate: '2026-07-06T13:18:59.854Z',
      closingDate: null,
      jobDescription: 'The role You will start by building your own pipeline through outbound efforts.',
      source: 'cutshort',
      link: 'https://cutshort.io/job/Associate-Account-Executive-Bengaluru-Bangalore-Cutshort-icmK1bd6',
      scrapedAt: '2026-07-14T00:00:00.000Z',
    },
  ])
})

test('run fails closed when the verified homepage, about page, or company-page identity drifts', async () => {
  const cutShort = await loadCutShortModule()

  await assert.rejects(
    cutShort.createCutShortScraper().run({
      fetchText: async (url) => {
        if (url === cutShort.HOME_URL) return '<html><body><h1>Unexpected homepage</h1></body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified homepage/i,
  )

  await assert.rejects(
    cutShort.createCutShortScraper().run({
      fetchText: async (url) => {
        if (url === cutShort.HOME_URL) return homepageHtml
        if (url === cutShort.ABOUT_URL) return '<html><body><h1>About</h1></body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified about page/i,
  )

  await assert.rejects(
    cutShort.createCutShortScraper().run({
      fetchText: async (url) => {
        if (url === cutShort.HOME_URL) return homepageHtml
        if (url === cutShort.ABOUT_URL) return aboutHtml
        if (url === cutShort.COMPANY_PAGE_URL) {
          return companyPageHtml.replace('"alias":"cutshort-zFdWQxlN"', '"alias":"different-company"')
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official company page no longer exposes the verified company identity/i,
  )
})
