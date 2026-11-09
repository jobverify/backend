import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-16T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers</title>
    <link href="https://www.kaleidofin.com/careers" rel="canonical" />
  </head>
  <body>
    <section>
      <h1>Careers</h1>
      <p>Step into the world of opportunities at Kaleidofin.</p>
    </section>
    <div class="div-block-16">
      <h2>Technology</h2>
      <div role="listitem" class="collection-item-careers">
        <a href="/careers/software-development-manager" class="link-block-3">
          <div>
            <h3 class="heading-16">Software Development Manager</h3>
            <p>8+ Years | 1 Opening</p>
            <p>Bangalore</p>
          </div>
        </a>
      </div>
      <div role="listitem" class="collection-item-careers">
        <a href="/careers/product-integration-engineer" class="link-block-3">
          <div>
            <h3 class="heading-16">Product Integration Engineer</h3>
            <p>4-5 years | 1 Opening</p>
            <p>Bangalore</p>
          </div>
        </a>
      </div>
    </div>
    <div class="div-block-16">
      <h2>Data Science</h2>
      <div role="listitem" class="collection-item-careers">
        <a href="/careers/senior-data-scientist" class="link-block-3">
          <div>
            <h3 class="heading-16">Senior Data Scientist</h3>
            <p>4+ years I 2 Openings</p>
            <p>Chennai/Bangalore</p>
          </div>
        </a>
      </div>
    </div>
    <div class="div-block-16">
      <h3>See AnythingYou Like?</h3>
      <h5>If you think you fit the bill, email us your resume at <a href="mailto:careers@kaleidofin.com">careers@kaleidofin.com</a></h5>
      <a href="https://www.linkedin.com/jobs/search/?keywords=Kaleidofin%20Private%20Limited">Apply with Linkedin</a>
      <a href="https://www.instahyre.com/jobs-at-kaleidofin/">Apply with instahyre</a>
    </div>
  </body>
</html>
`

const softwareDevelopmentManagerHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Kaleidofin</title>
    <link href="https://www.kaleidofin.com/careers/software-development-manager" rel="canonical" />
  </head>
  <body>
    <div class="dark-blue-bg">
      <h5>Technology</h5>
      <h1>Software Development Manager</h1>
      <div><h3>8+ Years | 1 Opening</h3></div>
      <div><h5>Bangalore</h5></div>
    </div>
    <div class="full-width-white">
      <h3>Who we are?</h3>
      <p>Kaleidofin is a fintech platform building a digital ecosystem to ensure finance for everyone, everywhere.</p>
      <h3>What you’ll do?</h3>
      <div class="w-richtext">
        <p>Own the engineering roadmap, architecture, scalability, and quality of products.</p>
      </div>
      <h3>Who you need to be?</h3>
      <div class="w-richtext">
        <p>8+ years of experience in end-to-end cloud software development.</p>
      </div>
      <p>If you fit the bill, write to us at <a href="mailto:careers@kaleidofin.com">careers@kaleidofin.com</a></p>
      <h3>Job location</h3>
      <p class="paragraph-11">Bangalore</p>
    </div>
  </body>
</html>
`

const productIntegrationEngineerHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Kaleidofin</title>
    <link href="https://www.kaleidofin.com/careers/product-integration-engineer" rel="canonical" />
  </head>
  <body>
    <div class="dark-blue-bg">
      <h5>Technology</h5>
      <h1>Product Integration Engineer</h1>
      <div><h3>4-5 years | 1 Opening</h3></div>
      <div><h5>Bangalore</h5></div>
    </div>
    <div class="full-width-white">
      <h3>Who we are?</h3>
      <p>Kaleidofin is a fintech platform building a digital ecosystem to ensure finance for everyone, everywhere.</p>
      <h3>What you’ll do?</h3>
      <div class="w-richtext">
        <p>Collaborate with external partners for product integrations.</p>
      </div>
      <h3>Who you need to be?</h3>
      <div class="w-richtext">
        <p>4-5 years of experience across product integrations.</p>
      </div>
      <p>If you fit the bill, write to us at <a href="mailto:careers@kaleidofin.com">careers@kaleidofin.com</a></p>
      <h3>Job location</h3>
      <p class="paragraph-11">Bangalore</p>
    </div>
  </body>
</html>
`

const seniorDataScientistHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Kaleidofin</title>
    <link href="https://www.kaleidofin.com/careers/senior-data-scientist" rel="canonical" />
  </head>
  <body>
    <div class="dark-blue-bg">
      <h5>Data Science</h5>
      <h1>Senior Data Scientist</h1>
      <div><h3>4+ years I 2 Openings</h3></div>
      <div><h5>Chennai/Bangalore</h5></div>
    </div>
    <div class="full-width-white">
      <h3>Who we are?</h3>
      <p>Kaleidofin is a fintech platform building a digital ecosystem to ensure finance for everyone, everywhere.</p>
      <h3>What you’ll do?</h3>
      <div class="w-richtext">
        <p>Build and deploy data science models for inclusive finance.</p>
      </div>
      <h3>Who you need to be?</h3>
      <div class="w-richtext">
        <p>4+ years of experience in applied data science.</p>
      </div>
      <p>If you fit the bill, write to us at <a href="mailto:careers@kaleidofin.com">careers@kaleidofin.com</a></p>
      <h3>Job location</h3>
      <p class="paragraph-11">Chennai/Bangalore</p>
    </div>
  </body>
</html>
`

const driftedCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Kaleidofin</title>
  </head>
  <body>
    <h1>Company</h1>
  </body>
</html>
`

const loadKaleidofinModule = async () => {
  try {
    return await import('../../scraper/kaleidofin/script.js')
  } catch {
    assert.fail('Expected Kaleidofin scraper module at ../../scraper/kaleidofin/script.js')
  }
}

test('Kaleidofin pins the verified careers page and linked role-page contracts', async () => {
  const kaleidofin = await loadKaleidofinModule()

  assert.equal(kaleidofin.SOURCE, 'kaleidofin')
  assert.equal(kaleidofin.COMPANY_NAME, 'Kaleidofin')
  assert.equal(kaleidofin.OFFICIAL_BRAND_NAME, 'Kaleidofin')
  assert.equal(kaleidofin.CAREERS_URL, 'https://www.kaleidofin.com/careers')
  assert.equal(
    kaleidofin.VERIFIED_SAMPLE_JOB_URL,
    'https://www.kaleidofin.com/careers/software-development-manager',
  )
  assert.equal(kaleidofin.VERIFIED_PUBLIC_JOB_COUNT, 8)
  assert.equal(kaleidofin.VERIFIED_ON, '2026-07-16')
  assert.equal(kaleidofin.hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(kaleidofin.hasOfficialCareersPageSignal(driftedCareersHtml), false)
  assert.deepEqual(kaleidofin.extractRoleCards(careersHtml), [
    {
      department: 'Technology',
      title: 'Software Development Manager',
      experienceSummary: '8+ Years | 1 Opening',
      location: 'Bangalore',
      sourceUrl: 'https://www.kaleidofin.com/careers/software-development-manager',
      jobId: 'software-development-manager',
    },
    {
      department: 'Technology',
      title: 'Product Integration Engineer',
      experienceSummary: '4-5 years | 1 Opening',
      location: 'Bangalore',
      sourceUrl: 'https://www.kaleidofin.com/careers/product-integration-engineer',
      jobId: 'product-integration-engineer',
    },
    {
      department: 'Data Science',
      title: 'Senior Data Scientist',
      experienceSummary: '4+ years I 2 Openings',
      location: 'Chennai/Bangalore',
      sourceUrl: 'https://www.kaleidofin.com/careers/senior-data-scientist',
      jobId: 'senior-data-scientist',
    },
  ])
  assert.equal(
    kaleidofin.hasOfficialRoleDetailSignal(
      softwareDevelopmentManagerHtml,
      'https://www.kaleidofin.com/careers/software-development-manager',
    ),
    true,
  )
})

test('Kaleidofin returns normalized first-party jobs from the verified careers and role pages', async () => {
  const kaleidofin = await loadKaleidofinModule()
  const requestedUrls = []

  const jobs = await kaleidofin.createKaleidofinScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === kaleidofin.CAREERS_URL) return careersHtml
      if (url === 'https://www.kaleidofin.com/careers/software-development-manager') {
        return softwareDevelopmentManagerHtml
      }
      if (url === 'https://www.kaleidofin.com/careers/product-integration-engineer') {
        return productIntegrationEngineerHtml
      }
      if (url === 'https://www.kaleidofin.com/careers/senior-data-scientist') {
        return seniorDataScientistHtml
      }

      throw new Error(`Unexpected Kaleidofin URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.kaleidofin.com/careers',
    'https://www.kaleidofin.com/careers/software-development-manager',
    'https://www.kaleidofin.com/careers/product-integration-engineer',
    'https://www.kaleidofin.com/careers/senior-data-scientist',
  ])

  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      company: job.company,
      department: job.department,
      location: job.location,
      city: job.city,
      country: job.country,
      jobId: job.jobId,
      requisitionId: job.requisitionId,
      experienceRequired: job.experienceRequired,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      source: job.source,
      link: job.link,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Software Development Manager',
        company: 'Kaleidofin',
        department: 'Technology',
        location: 'Bangalore',
        city: 'Bangalore',
        country: 'India',
        jobId: 'software-development-manager',
        requisitionId: 'software-development-manager',
        experienceRequired: '8+ Years',
        sourceUrl: 'https://www.kaleidofin.com/careers/software-development-manager',
        applyUrl: 'https://www.kaleidofin.com/careers/software-development-manager',
        source: 'kaleidofin',
        link: 'https://www.kaleidofin.com/careers/software-development-manager',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Product Integration Engineer',
        company: 'Kaleidofin',
        department: 'Technology',
        location: 'Bangalore',
        city: 'Bangalore',
        country: 'India',
        jobId: 'product-integration-engineer',
        requisitionId: 'product-integration-engineer',
        experienceRequired: '4-5 years',
        sourceUrl: 'https://www.kaleidofin.com/careers/product-integration-engineer',
        applyUrl: 'https://www.kaleidofin.com/careers/product-integration-engineer',
        source: 'kaleidofin',
        link: 'https://www.kaleidofin.com/careers/product-integration-engineer',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Senior Data Scientist',
        company: 'Kaleidofin',
        department: 'Data Science',
        location: 'Chennai/Bangalore',
        city: null,
        country: 'India',
        jobId: 'senior-data-scientist',
        requisitionId: 'senior-data-scientist',
        experienceRequired: '4+ years',
        sourceUrl: 'https://www.kaleidofin.com/careers/senior-data-scientist',
        applyUrl: 'https://www.kaleidofin.com/careers/senior-data-scientist',
        source: 'kaleidofin',
        link: 'https://www.kaleidofin.com/careers/senior-data-scientist',
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )

  assert.match(jobs[0].jobDescription ?? '', /engineering roadmap/i)
  assert.match(jobs[2].jobDescription ?? '', /inclusive finance/i)
})

test('Kaleidofin fails closed when the careers page or a linked role page drifts away from the verified public shape', async () => {
  const kaleidofin = await loadKaleidofinModule()

  await assert.rejects(
    kaleidofin.createKaleidofinScraper().run({
      fetchText: async (url) => {
        if (url === kaleidofin.CAREERS_URL) return driftedCareersHtml
        throw new Error(`Unexpected Kaleidofin URL: ${url}`)
      },
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    kaleidofin.createKaleidofinScraper().run({
      fetchText: async (url) => {
        if (url === kaleidofin.CAREERS_URL) return careersHtml
        if (url === 'https://www.kaleidofin.com/careers/software-development-manager') {
          return '<html><body><h1>Software Development Manager</h1></body></html>'
        }
        if (url === 'https://www.kaleidofin.com/careers/product-integration-engineer') {
          return productIntegrationEngineerHtml
        }
        if (url === 'https://www.kaleidofin.com/careers/senior-data-scientist') {
          return seniorDataScientistHtml
        }
        throw new Error(`Unexpected Kaleidofin URL: ${url}`)
      },
    }),
    /role detail page no longer matches/i,
  )
})
