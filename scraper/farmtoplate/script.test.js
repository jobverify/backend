import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  COMPANY,
  HOMEPAGE_URL,
  PAGE_SITEMAP_URL,
  SOURCE,
  createFarmToPlateScraper,
  extractOpeningCards,
  extractRoleDetail,
  hasOfficialCareersSignal,
  hasOfficialHomepageSignal,
  hasVerifiedPageSitemapSignal,
} from './script.js'

// Inspect the original native content separately from normalized JD qualification.
const nativeDetailEvidence = detail => ({ title: detail.title, requisitionId: detail.requisitionId,
  sourceUrl: detail.sourceUrl, applyUrl: detail.applyUrl, employmentType: detail.employmentType,
  experienceRequired: detail.experienceRequired, contentJobDescription: detail.rawNativeRoleEvidence.contentJobDescription })

const homepageHtml = `
  <html>
    <head>
      <title>Supply chain track and trace | Blockchain | Farm To Plate</title>
      <link rel="canonical" href="https://www.farmtoplate.io/" />
      <meta property="og:site_name" content="Farm to Plate" />
    </head>
    <body>
      <p>Build a transparent, tech-driven, food supply chain of tomorrow.</p>
      <a href="/about-us/careers-and-joining-the-team">Careers Join us; cultivate tomorrow's food solutions.</a>
    </body>
  </html>
`

const pageSitemapXml = `
  <urlset>
    <url><loc>https://www.farmtoplate.io/about-us/careers-and-joining-the-team/</loc></url>
    <url><loc>https://www.farmtoplate.io/data-engineer/</loc></url>
    <url><loc>https://www.farmtoplate.io/devops-engineer/</loc></url>
    <url><loc>https://www.farmtoplate.io/devops-engineer-associate/</loc></url>
  </urlset>
`

const careersHtml = `
  <html>
    <head>
      <title>Careers &amp; Joining the Team - Farm to Plate</title>
    </head>
    <body>
      <h1>Careers &amp; Joining the Team</h1>
      <h2>Ready to shape the future?</h2>
      <p>Discover our current openings and find your place in our dynamic team.</p>
      <a class="qwords-button qwords-button-flat" href="mailto:sushma.ganapathi@farmtoplate.io">
        <span class="text">Submit your CV here</span>
      </a>
      <p><b>Note: </b><b><i>The 2023 Applications are now closed. Stay tuned to </i></b><a href="http://www.farmtoplate.io"><b><i>Farm To Plate</i></b></a> <b><i>in 2024, as applications open next year.</i></b></p>
      <h2>Openings At Farm To Plate</h2>

      <section>
        <h2>Position: Data Engineer <br> Vacancy: 1</h2>
        <p>At Farm to Plate, we rely on powerfully insightful data to inform our systems and solutions.</p>
        <a href="/data-engineer"><span class="elementor-button-text">View Details</span></a>
      </section>

      <section>
        <h2><a href="/data-engineer" target="_blank">Position: Sr. Devops Engineer <br> Vacancy: 2</a></h2>
        <p>FarmtoPlate is setting up a blockchain product research and development team.</p>
        <a href="/devops-engineer/"><span class="elementor-button-text">View Details</span></a>
      </section>

      <section>
        <h2>Position: Jr Devops Engineer <br> Vacancy: 1</h2>
        <p>FarmtoPlate is setting up a blockchain product research and development team.</p>
        <a href="/devops-engineer-associate"><span class="elementor-button-text">View Details</span></a>
      </section>
    </body>
  </html>
`

const dataEngineerHtml = `
  <html>
    <head>
      <title>Data Engineer - Farm to Plate %</title>
      <link rel="canonical" href="https://www.farmtoplate.io/data-engineer/" />
      <meta property="og:url" content="https://www.farmtoplate.io/data-engineer/" />
      <meta property="og:site_name" content="Farm to Plate" />
    </head>
    <body>
      <a href="mailto:info@farmtoplate.io">info@farmtoplate.io</a>
      <h1>Data Engineer</h1><main><h1>Data engineer job description</h1>
      <p>At Farm to Plate, we rely on powerfully insightful data to inform our systems and solutions.</p>
      <h4>Objectives of this role</h4>
      <ul>
        <li>Work with data to solve business problems.</li>
      </ul>
      <h4>Required skills and qualifications</h4>
      <ul>
        <li>Three or more years of experience with Python, SQL, and data visualization/exploration tools</li>
      </ul>
      <a class="qwords-button qwords-button-flat" href="mailto:sakshi.verma@farmtoplate.io">
        <span class="text">Submit your CV here</span>
      </a>
      </main><a href="mailto:info@farmtoplate.io">info@farmtoplate.io</a>
      <p>Copyright 2025. Farm to Plate. All Rights Reserved.</p>
      <p>100% Subsidiary of Paramount Software Solutions</p>
    </body>
  </html>
`

const seniorDevopsHtml = `
  <html>
    <head>
      <title>DevOps Engineer - Farm to Plate %</title>
      <link rel="canonical" href="https://www.farmtoplate.io/devops-engineer/" />
      <meta property="og:url" content="https://www.farmtoplate.io/devops-engineer/" />
      <meta property="og:site_name" content="Farm to Plate" />
    </head>
    <body>
      <a href="mailto:info@farmtoplate.io">info@farmtoplate.io</a>
      <h1>DevOps Engineer</h1><main><h4>Job Title: DevOps Engineer - Associate</h4>
      <h4>Exp: 7+ Years</h4>
      <h2>Job Description</h2>
      <p>FarmtoPlate is setting up a blockchain product research and development team to deliver world-class enterprise grade Distributed Ledger Technology Networks for the food and beverage industry ecosystem.</p>
      <h4>Requirements:</h4>
      <ul>
        <li>Bachelor&apos;s degree in Computer Science, Engineering, or a related field.</li>
      </ul>
      <a class="qwords-button qwords-button-flat" href="mailto:sakshi.verma@farmtoplate.io">
        <span class="text">Submit your CV here</span>
      </a>
      </main><a href="mailto:info@farmtoplate.io">info@farmtoplate.io</a>
      <p>Copyright 2025. Farm to Plate. All Rights Reserved.</p>
    </body>
  </html>
`

const juniorDevopsHtml = `
  <html>
    <head>
      <title>DevOps Engineer - Associate - Farm to Plate %</title>
      <link rel="canonical" href="https://www.farmtoplate.io/devops-engineer-associate/" />
      <meta property="og:url" content="https://www.farmtoplate.io/devops-engineer-associate/" />
      <meta property="og:site_name" content="Farm to Plate" />
    </head>
    <body>
      <a href="mailto:info@farmtoplate.io">info@farmtoplate.io</a>
      <h1>DevOps Engineer - Associate</h1><main>
      <h4>Job Title: DevOps Engineer - Associate</h4>
      <h4>Exp: 2-3 Years</h4>
      <h2>Job Description</h2>
      <p>FarmtoPlate is setting up a blockchain product research and development team to deliver world-class enterprise grade Distributed Ledger Technology Networks for the food and beverage industry ecosystem.</p>
      <h4>Requirements:</h4>
      <ul>
        <li>2-3 years of experience in DevOps or a related field.</li>
      </ul>
      <a class="qwords-button qwords-button-flat" href="mailto:sakshi.verma@farmtoplate.io">
        <span class="text">Submit your CV here</span>
      </a>
      </main><a href="mailto:info@farmtoplate.io">info@farmtoplate.io</a>
      <p>Copyright 2025. Farm to Plate. All Rights Reserved.</p>
    </body>
  </html>
`

test('Farm To Plate scraper recognizes the verified homepage, sitemap, and careers surface', () => {
  assert.equal(SOURCE, 'farmtoplate')
  assert.equal(COMPANY, 'Farm To Plate')
  assert.equal(HOMEPAGE_URL, 'https://www.farmtoplate.io/')
  assert.equal(CAREERS_URL, 'https://www.farmtoplate.io/about-us/careers-and-joining-the-team/')
  assert.equal(PAGE_SITEMAP_URL, 'https://www.farmtoplate.io/page-sitemap.xml')
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasVerifiedPageSitemapSignal(pageSitemapXml), true)
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
})

test('Farm To Plate scraper extracts the current opening cards and role detail metadata', () => {
  const cards = extractOpeningCards(careersHtml)

  assert.deepEqual(cards, [
    {
      title: 'Data Engineer',
      vacancy: 1,
      detailUrl: 'https://www.farmtoplate.io/data-engineer/',
    },
    {
      title: 'Sr. Devops Engineer',
      vacancy: 2,
      detailUrl: 'https://www.farmtoplate.io/devops-engineer/',
    },
    {
      title: 'Jr Devops Engineer',
      vacancy: 1,
      detailUrl: 'https://www.farmtoplate.io/devops-engineer-associate/',
    },
  ])

  assert.deepEqual(
    nativeDetailEvidence(extractRoleDetail({
      title: 'Data Engineer',
      vacancy: 1,
      detailUrl: 'https://www.farmtoplate.io/data-engineer/',
      html: dataEngineerHtml,
    })),
    {
      title: 'Data Engineer',
      requisitionId: null,
      sourceUrl: 'https://www.farmtoplate.io/data-engineer/',
      applyUrl: 'mailto:sakshi.verma@farmtoplate.io',
      employmentType: null,
      experienceRequired: '3+ years',
      contentJobDescription: [
        'Data engineer job description',
        'At Farm to Plate, we rely on powerfully insightful data to inform our systems and solutions.',
        'Objectives of this role',
        'Work with data to solve business problems.',
        'Required skills and qualifications',
        'Three or more years of experience with Python, SQL, and data visualization/exploration tools',
      ].join('\n'),
    },
  )

  assert.deepEqual(
    nativeDetailEvidence(extractRoleDetail({
      title: 'Sr. Devops Engineer',
      vacancy: 2,
      detailUrl: 'https://www.farmtoplate.io/devops-engineer/',
      html: seniorDevopsHtml,
    })),
    {
      title: 'Sr. Devops Engineer',
      requisitionId: null,
      sourceUrl: 'https://www.farmtoplate.io/devops-engineer/',
      applyUrl: 'mailto:sakshi.verma@farmtoplate.io',
      employmentType: null,
      experienceRequired: null,
      contentJobDescription: [
        'Job Title: DevOps Engineer - Associate',
        'Exp: 7+ Years',
        'Job Description',
        'FarmtoPlate is setting up a blockchain product research and development team to deliver world-class enterprise grade Distributed Ledger Technology Networks for the food and beverage industry ecosystem.',
        'Requirements:',
        "Bachelor's degree in Computer Science, Engineering, or a related field.",
      ].join('\n'),
    },
  )

  assert.deepEqual(
    nativeDetailEvidence(extractRoleDetail({
      title: 'Jr Devops Engineer',
      vacancy: 1,
      detailUrl: 'https://www.farmtoplate.io/devops-engineer-associate/',
      html: juniorDevopsHtml,
    })),
    {
      title: 'Jr Devops Engineer',
      requisitionId: null,
      sourceUrl: 'https://www.farmtoplate.io/devops-engineer-associate/',
      applyUrl: 'mailto:sakshi.verma@farmtoplate.io',
      employmentType: null,
      experienceRequired: null,
      contentJobDescription: [
        'Job Title: DevOps Engineer - Associate',
        'Exp: 2-3 Years',
        'Job Description',
        'FarmtoPlate is setting up a blockchain product research and development team to deliver world-class enterprise grade Distributed Ledger Technology Networks for the food and beverage industry ecosystem.',
        'Requirements:',
        '2-3 years of experience in DevOps or a related field.',
      ].join('\n'),
    },
  )
})

test('Farm To Plate scraper runs end to end and fails closed on careers drift', async () => {
  const requestedUrls = []

  const jobs = await createFarmToPlateScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === PAGE_SITEMAP_URL) {
        return { status: 200, url, html: pageSitemapXml }
      }

      if (url === CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === 'https://www.farmtoplate.io/data-engineer/') {
        return { status: 200, url, html: dataEngineerHtml }
      }

      if (url === 'https://www.farmtoplate.io/devops-engineer/') {
        return { status: 200, url, html: seniorDevopsHtml }
      }

      if (url === 'https://www.farmtoplate.io/devops-engineer-associate/') {
        return { status: 200, url, html: juniorDevopsHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 3)
  assert.deepEqual(requestedUrls, [
    HOMEPAGE_URL,
    PAGE_SITEMAP_URL,
    CAREERS_URL,
    'https://www.farmtoplate.io/data-engineer/',
    'https://www.farmtoplate.io/devops-engineer/',
    'https://www.farmtoplate.io/devops-engineer-associate/',
  ])
  assert.deepEqual(jobs.map((job) => job.title), [
    'Data Engineer',
    'Sr. Devops Engineer',
    'Jr Devops Engineer',
  ])
  assert.deepEqual(jobs.map((job) => job.jobId), [
    'farmtoplate-data-engineer',
    'farmtoplate-devops-engineer',
    'farmtoplate-devops-engineer-associate',
  ])
  assert.deepEqual(jobs.map((job) => job.applyUrl), [
    'mailto:sakshi.verma@farmtoplate.io',
    'mailto:sakshi.verma@farmtoplate.io',
    'mailto:sakshi.verma@farmtoplate.io',
  ])
  assert.deepEqual(jobs.map((job) => job.sourceUrl), [
    'https://www.farmtoplate.io/data-engineer/',
    'https://www.farmtoplate.io/devops-engineer/',
    'https://www.farmtoplate.io/devops-engineer-associate/',
  ])
  assert.equal(jobs[1].experienceRequired, null)
  assert.equal(jobs[2].experienceRequired, null)
  assert.equal(jobs[1].sourceDetailComplete, false)
  assert.equal(jobs[2].jobDescription, null)
  assert.equal(jobs[0].company, 'Farm To Plate')
  assert.equal(jobs[0].source, 'farmtoplate')
  assert.equal(jobs[0].companyCareerPage, CAREERS_URL)
  assert.equal(jobs[0].companyDomain, 'farmtoplate.io')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.equal(jobs[0].link, 'mailto:sakshi.verma@farmtoplate.io')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)

  await assert.rejects(
    createFarmToPlateScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Placeholder</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    createFarmToPlateScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === PAGE_SITEMAP_URL) {
          return { status: 200, url, html: pageSitemapXml }
        }

        if (url === CAREERS_URL) {
          return {
            status: 200,
            url,
            html: `
              <html>
                <head>
                  <title>Careers &amp; Joining the Team - Farm to Plate</title>
                </head>
                <body>
                  <h1>Careers &amp; Joining the Team</h1>
                  <p>Discover our current openings and find your place in our dynamic team.</p>
                  <h2>Openings At Farm To Plate</h2>
                  <a href="mailto:sushma.ganapathi@farmtoplate.io">Submit your CV here</a>
                </body>
              </html>
            `,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /opening cards changed materially/i,
  )
})
