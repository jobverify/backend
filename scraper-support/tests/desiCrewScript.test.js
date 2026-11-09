import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-01T12:00:00.000Z'

const homepagePage = {
  status: 200,
  url: 'https://www.desicrew.in/',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>DesiCrew - Intelligence. Orchestrated for you.</title>
        <link rel="canonical" href="https://www.desicrew.in/" />
      </head>
      <body>
        <p>Deployed Intelligence</p>
        <h1>Intelligence.Orchestrated for you.</h1>
        <a href="/careers/">Careers</a>
      </body>
    </html>
  `,
}

const careersPage = {
  status: 200,
  url: 'https://www.desicrew.in/careers/',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>Careers at DesiCrew | Build a career with purpose.</title>
        <link rel="canonical" href="https://www.desicrew.in/careers/" />
      </head>
      <body>
        <a href="#apply" class="dc-mh-cta">Apply now</a>
        <section id="roles">
          <h2>Open roles</h2>
          <a href="/careers/delivery-center-manager/">
            <p class="text-h6 font-main">Delivery Center Manager</p>
            <p class="text-body-small text-text-tertiary">Operations · Chennai</p>
          </a>
          <a href="/careers/finance-accounting-process-manager/">
            <p class="text-h6 font-main">Finance &amp; Accounting Process Manager</p>
            <p class="text-body-small text-text-tertiary">Accelerating Enterprise · Chennai</p>
          </a>
          <a href="/careers/qa-automation-engineer/">
            <p class="text-h6 font-main">QA Automation Engineer</p>
            <p class="text-body-small text-text-tertiary">Accelerating Enterprise · Chennai</p>
          </a>
          <a href="/careers/rlhf-quality-analyst/">
            <p class="text-h6 font-main">RLHF Quality Analyst</p>
            <p class="text-body-small text-text-tertiary">Enabling AI · Chennai</p>
          </a>
          <a href="/careers/senior-annotation-lead/">
            <p class="text-h6 font-main">Senior Annotation Lead</p>
            <p class="text-body-small text-text-tertiary">Enabling AI · Chennai</p>
          </a>
        </section>
        <form id="apply-form" action="https://usebasin.com/f/691ecb2b732f">
          <label>What are you applying for?</label>
        </form>
      </body>
    </html>
  `,
}

const buildDetailPage = ({
  slug,
  title,
  summary,
  department,
  description,
  location = 'Chennai',
  state = 'Tamil Nadu',
  datePosted = '2026-07-29T00:00:00Z',
  employmentType = 'FULL_TIME',
}) => ({
  status: 200,
  url: `https://www.desicrew.in/careers/${slug}/`,
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>${title} | DesiCrew</title>
        <link rel="canonical" href="https://www.desicrew.in/careers/${slug}/" />
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "JobPosting",
                "title": "${title}",
                "description": ${JSON.stringify(description)},
                "datePosted": "${datePosted}",
                "employmentType": "${employmentType}",
                "url": "https://www.desicrew.in/careers/${slug}/",
                "jobLocation": {
                  "@type": "Place",
                  "address": {
                    "@type": "PostalAddress",
                    "addressLocality": "${location}",
                    "addressRegion": "${state}",
                    "addressCountry": "IN"
                  }
                }
              }
            ]
          }
        </script>
      </head>
      <body>
        <p class="dc-legal-kicker">${department} · ${location}, ${state}</p>
        <h1>${title}</h1>
        <p>${summary}</p>
        <dl>
          <dt>Location</dt><dd>${location}, ${state}</dd>
          <dt>Type</dt><dd>Full time</dd>
          <dt>Posted</dt><dd>29 July 2026</dd>
        </dl>
        <div class="dc-legal">${description}</div>
        <a href="/careers/#apply">Apply for this role</a>
      </body>
    </html>
  `,
})

const detailPages = {
  'https://www.desicrew.in/careers/delivery-center-manager/': buildDetailPage({
    slug: 'delivery-center-manager',
    title: 'Delivery Center Manager',
    summary: 'Run a DesiCrew delivery centre end to end.',
    department: 'Operations',
    description: `
      <h3>About the role</h3>
      <p>Run a DesiCrew delivery centre end to end.</p>
      <h3>What you will do</h3>
      <ul>
        <li>Own delivery across every client programme running from the centre.</li>
        <li>Lead the leadership team at the centre.</li>
      </ul>
      <h3>What you will bring</h3>
      <ul>
        <li>Substantial experience in operations or delivery management.</li>
      </ul>
    `,
  }),
  'https://www.desicrew.in/careers/finance-accounting-process-manager/': buildDetailPage({
    slug: 'finance-accounting-process-manager',
    title: 'Finance & Accounting Process Manager',
    summary: 'Lead finance and accounting delivery for enterprise programmes.',
    department: 'Accelerating Enterprise',
    description: `
      <h3>About the role</h3>
      <p>Lead finance and accounting delivery for enterprise programmes.</p>
      <h3>What you will do</h3>
      <ul>
        <li>Run finance and accounting operations to committed service levels.</li>
        <li>Coach teams through quality and productivity improvements.</li>
      </ul>
      <h3>What you will bring</h3>
      <ul>
        <li>8+ years in finance operations or related delivery roles.</li>
      </ul>
    `,
  }),
  'https://www.desicrew.in/careers/qa-automation-engineer/': buildDetailPage({
    slug: 'qa-automation-engineer',
    title: 'QA Automation Engineer',
    summary: 'Build and maintain the automated regression suites behind release cycles.',
    department: 'Accelerating Enterprise',
    description: `
      <h3>About the role</h3>
      <p>Build and maintain the automated regression suites behind release cycles.</p>
      <h3>What you will do</h3>
      <ul>
        <li>Write and maintain automated functional and regression tests.</li>
        <li>Integrate test runs into CI so results reach the team on every build.</li>
      </ul>
      <h3>What you will bring</h3>
      <ul>
        <li>Hands-on experience with Playwright, Selenium, Cypress or similar.</li>
        <li>4+ years in test automation for web applications.</li>
      </ul>
    `,
  }),
  'https://www.desicrew.in/careers/rlhf-quality-analyst/': buildDetailPage({
    slug: 'rlhf-quality-analyst',
    title: 'RLHF Quality Analyst',
    summary: 'Review model outputs and raise the quality bar for RLHF programmes.',
    department: 'Enabling AI',
    description: `
      <h3>About the role</h3>
      <p>Review model outputs and raise the quality bar for RLHF programmes.</p>
      <h3>What you will do</h3>
      <ul>
        <li>Audit prompt-response pairs for policy, safety and quality.</li>
        <li>Coach reviewers using clear calibration feedback.</li>
      </ul>
      <h3>What you will bring</h3>
      <ul>
        <li>Strong written English and analytical judgement.</li>
      </ul>
    `,
  }),
  'https://www.desicrew.in/careers/senior-annotation-lead/': buildDetailPage({
    slug: 'senior-annotation-lead',
    title: 'Senior Annotation Lead',
    summary: 'Lead annotation teams delivering high-volume, high-accuracy datasets.',
    department: 'Enabling AI',
    description: `
      <h3>About the role</h3>
      <p>Lead annotation teams delivering high-volume, high-accuracy datasets.</p>
      <h3>What you will do</h3>
      <ul>
        <li>Plan throughput, quality checks and reviewer staffing.</li>
        <li>Own escalation handling for complex annotation queues.</li>
      </ul>
      <h3>What you will bring</h3>
      <ul>
        <li>5+ years in annotation operations or quality leadership.</li>
      </ul>
    `,
  }),
}

const loadModule = async () => {
  try {
    return await import('../../scraper/desicrew/script.js')
  } catch {
    assert.fail('Expected Desi Crew scraper module at ../../scraper/desicrew/script.js')
  }
}

test('Desi Crew constants and extractors stay pinned to the August 15, 2026 first-party careers surface', async () => {
  const desiCrew = await loadModule()

  assert.equal(desiCrew.COMPANY_NAME, 'Desi Crew')
  assert.equal(desiCrew.SOURCE, 'desicrew')
  assert.equal(desiCrew.COUNTRY_FILTER, 'India')
  assert.equal(desiCrew.HOMEPAGE_URL, 'https://www.desicrew.in/')
  assert.equal(desiCrew.CAREERS_PAGE_URL, 'https://www.desicrew.in/careers/')
  assert.equal(desiCrew.JOBS_ARCHIVE_URL, 'https://www.desicrew.in/careers/')
  assert.equal(desiCrew.JOBS_API_URL, null)
  assert.equal(desiCrew.SAMPLE_JOB_URL, 'https://www.desicrew.in/careers/qa-automation-engineer/')
  assert.equal(desiCrew.VERIFIED_ON, '2026-08-15')
  assert.equal(desiCrew.hasOfficialHomepageSignal(homepagePage), true)
  assert.equal(desiCrew.hasOfficialCareersPageSignal(careersPage), true)
  assert.equal(desiCrew.hasOfficialJobsArchiveSignal(careersPage), true)
  assert.equal(desiCrew.hasOfficialJobsApiSignal(null), true)
  assert.equal(
    desiCrew.hasOfficialJobDetailSignal(
      detailPages['https://www.desicrew.in/careers/qa-automation-engineer/'],
      'https://www.desicrew.in/careers/qa-automation-engineer/',
    ),
    true,
  )

  const listings = desiCrew.extractArchiveListings(careersPage.html)
  assert.deepEqual(listings, [
    {
      jobId: 'delivery-center-manager',
      title: 'Delivery Center Manager',
      department: 'Operations',
      sourceUrl: 'https://www.desicrew.in/careers/delivery-center-manager/',
      summaryLocation: 'Chennai',
    },
    {
      jobId: 'finance-accounting-process-manager',
      title: 'Finance & Accounting Process Manager',
      department: 'Accelerating Enterprise',
      sourceUrl: 'https://www.desicrew.in/careers/finance-accounting-process-manager/',
      summaryLocation: 'Chennai',
    },
    {
      jobId: 'qa-automation-engineer',
      title: 'QA Automation Engineer',
      department: 'Accelerating Enterprise',
      sourceUrl: 'https://www.desicrew.in/careers/qa-automation-engineer/',
      summaryLocation: 'Chennai',
    },
    {
      jobId: 'rlhf-quality-analyst',
      title: 'RLHF Quality Analyst',
      department: 'Enabling AI',
      sourceUrl: 'https://www.desicrew.in/careers/rlhf-quality-analyst/',
      summaryLocation: 'Chennai',
    },
    {
      jobId: 'senior-annotation-lead',
      title: 'Senior Annotation Lead',
      department: 'Enabling AI',
      sourceUrl: 'https://www.desicrew.in/careers/senior-annotation-lead/',
      summaryLocation: 'Chennai',
    },
  ])

  const qaPage = detailPages['https://www.desicrew.in/careers/qa-automation-engineer/']
  const qaPosting = JSON.parse(
    qaPage.html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/i)[1],
  )['@graph'][0]
  const qaJob = desiCrew.buildJobFromListingAndApiRecord(listings[2], qaPosting)

  assert.deepEqual(
    {
      title: qaJob.title,
      company: qaJob.company,
      department: qaJob.department,
      location: qaJob.location,
      city: qaJob.city,
      state: qaJob.state,
      country: qaJob.country,
      jobId: qaJob.jobId,
      requisitionId: qaJob.requisitionId,
      sourceUrl: qaJob.sourceUrl,
      applyUrl: qaJob.applyUrl,
      employmentType: qaJob.employmentType,
      experienceRequired: qaJob.experienceRequired,
      postingDate: qaJob.postingDate,
      closingDate: qaJob.closingDate,
    },
    {
      title: 'QA Automation Engineer',
      company: 'Desi Crew',
      department: 'Accelerating Enterprise',
      location: 'Chennai, Tamil Nadu',
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
      jobId: 'qa-automation-engineer',
      requisitionId: 'qa-automation-engineer',
      sourceUrl: 'https://www.desicrew.in/careers/qa-automation-engineer/',
      applyUrl: 'https://www.desicrew.in/careers/#apply',
      employmentType: 'Full-time',
      experienceRequired: '4+ years',
      postingDate: '2026-07-29',
      closingDate: null,
    },
  )
  assert.ok(qaJob.requiredSkills.includes('Write and maintain automated functional and regression tests.'))
  assert.match(qaJob.jobDescription, /Build and maintain the automated regression suites/i)
})

test('run validates the August 15, 2026 Desi Crew careers surfaces and returns the five live first-party openings', async () => {
  const desiCrew = await loadModule()
  const requestedUrls = []

  const jobs = await desiCrew.createDesiCrewScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === desiCrew.HOMEPAGE_URL) return homepagePage
      if (url === desiCrew.CAREERS_PAGE_URL) return careersPage
      if (detailPages[url]) return detailPages[url]

      throw new Error(`Unexpected Desi Crew page URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedUrls, [
    desiCrew.HOMEPAGE_URL,
    desiCrew.CAREERS_PAGE_URL,
    'https://www.desicrew.in/careers/delivery-center-manager/',
    'https://www.desicrew.in/careers/finance-accounting-process-manager/',
    'https://www.desicrew.in/careers/qa-automation-engineer/',
    'https://www.desicrew.in/careers/rlhf-quality-analyst/',
    'https://www.desicrew.in/careers/senior-annotation-lead/',
  ])

  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      department: job.department,
      jobId: job.jobId,
      location: job.location,
      postingDate: job.postingDate,
      source: job.source,
      link: job.link,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Delivery Center Manager',
        department: 'Operations',
        jobId: 'delivery-center-manager',
        location: 'Chennai, Tamil Nadu',
        postingDate: '2026-07-29',
        source: 'desicrew',
        link: 'https://www.desicrew.in/careers/#apply',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Finance & Accounting Process Manager',
        department: 'Accelerating Enterprise',
        jobId: 'finance-accounting-process-manager',
        location: 'Chennai, Tamil Nadu',
        postingDate: '2026-07-29',
        source: 'desicrew',
        link: 'https://www.desicrew.in/careers/#apply',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'QA Automation Engineer',
        department: 'Accelerating Enterprise',
        jobId: 'qa-automation-engineer',
        location: 'Chennai, Tamil Nadu',
        postingDate: '2026-07-29',
        source: 'desicrew',
        link: 'https://www.desicrew.in/careers/#apply',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'RLHF Quality Analyst',
        department: 'Enabling AI',
        jobId: 'rlhf-quality-analyst',
        location: 'Chennai, Tamil Nadu',
        postingDate: '2026-07-29',
        source: 'desicrew',
        link: 'https://www.desicrew.in/careers/#apply',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Senior Annotation Lead',
        department: 'Enabling AI',
        jobId: 'senior-annotation-lead',
        location: 'Chennai, Tamil Nadu',
        postingDate: '2026-07-29',
        source: 'desicrew',
        link: 'https://www.desicrew.in/careers/#apply',
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )

  assert.equal(jobs[1].experienceRequired, '8+ years')
  assert.equal(jobs[2].employmentType, 'Full-time')
  assert.equal(jobs[3].experienceRequired, null)
})

test('Desi Crew accepts the current inline first-party apply form without the legacy Basin action', async () => {
  const desiCrew = await loadModule()

  const currentCareersPage = {
    ...careersPage,
    html: `
      <!doctype html>
      <html lang="en">
        <head>
          <title>Careers at DesiCrew | Build a career with purpose.</title>
          <link rel="canonical" href="https://www.desicrew.in/careers/" />
        </head>
        <body>
          <a href="#apply" class="dc-mh-cta">Apply now</a>
          <section id="roles">
            <h2>Open roles</h2>
            <a href="/careers/delivery-center-manager/">
              <p class="text-h6 font-main">Delivery Center Manager</p>
              <p class="text-body-small text-text-tertiary">Operations Â· Chennai</p>
            </a>
          </section>
          <form id="apply-form">
            <label>What are you applying for?</label>
            <button type="submit">Send application</button>
          </form>
        </body>
      </html>
    `,
  }

  assert.equal(desiCrew.hasOfficialCareersPageSignal(currentCareersPage), true)
})

test('Desi Crew scraper fails closed when the verified August 15, 2026 public-surface checkpoints drift', async () => {
  const desiCrew = await loadModule()

  await assert.rejects(
    desiCrew.createDesiCrewScraper().run({
      fetchPage: async (url) => {
        if (url === desiCrew.HOMEPAGE_URL) {
          return {
            ...homepagePage,
            html: homepagePage.html.replace('/careers/', '/contact/'),
          }
        }

        throw new Error(`Unexpected Desi Crew page URL: ${url}`)
      },
    }),
    /verified homepage/i,
  )

  await assert.rejects(
    desiCrew.createDesiCrewScraper().run({
      fetchPage: async (url) => {
        if (url === desiCrew.HOMEPAGE_URL) return homepagePage
        if (url === desiCrew.CAREERS_PAGE_URL) {
          return {
            ...careersPage,
            html: careersPage.html.replace('id="apply-form"', 'id="join-form"'),
          }
        }

        throw new Error(`Unexpected Desi Crew page URL: ${url}`)
      },
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    desiCrew.createDesiCrewScraper().run({
      fetchPage: async (url) => {
        if (url === desiCrew.HOMEPAGE_URL) return homepagePage
        if (url === desiCrew.CAREERS_PAGE_URL) {
          return {
            ...careersPage,
            html: `
              <!doctype html>
              <html lang="en">
                <head>
                  <title>Careers at DesiCrew | Build a career with purpose.</title>
                  <link rel="canonical" href="https://www.desicrew.in/careers/" />
                </head>
                <body>
                  <a href="#apply" class="dc-mh-cta">Apply now</a>
                  <section id="roles">
                    <h2>Open roles</h2>
                    <a href="/careers/placeholder-role/">Placeholder role</a>
                  </section>
                  <form id="apply-form" action="https://usebasin.com/f/691ecb2b732f"></form>
                </body>
              </html>
            `,
          }
        }

        throw new Error(`Unexpected Desi Crew page URL: ${url}`)
      },
    }),
    /verified careers listing/i,
  )

  await assert.rejects(
    desiCrew.createDesiCrewScraper().run({
      fetchPage: async (url) => {
        if (url === desiCrew.HOMEPAGE_URL) return homepagePage
        if (url === desiCrew.CAREERS_PAGE_URL) return careersPage
        if (url === 'https://www.desicrew.in/careers/qa-automation-engineer/') {
          return {
            ...detailPages[url],
            html: detailPages[url].html.replace('Apply for this role', 'Learn more'),
          }
        }
        if (detailPages[url]) return detailPages[url]

        throw new Error(`Unexpected Desi Crew page URL: ${url}`)
      },
    }),
    /verified detail page/i,
  )
})
