import assert from 'node:assert/strict'
import test from 'node:test'

const loadLinkedInModule = async () => {
  try {
    return await import('../../scraper/linkedin/script.js')
  } catch {
    assert.fail('Expected LinkedIn scraper module at ../../scraper/linkedin/script.js')
  }
}

const searchResultsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>39 jobs in India</title>
    <meta name="description" content="Today's top 39 jobs in India.">
    <meta name="linkedin:pageTag" content="urlType=jserp_custom;emptyResult=false">
    <meta property="og:url" content="https://www.linkedin.com/jobs/search">
  </head>
  <body>
    <section class="jobs-search__results-list">
      <div class="base-card base-search-card job-search-card" data-entity-urn="urn:li:jobPosting:4419298054">
        <a class="base-card__full-link" href="https://in.linkedin.com/jobs/view/senior-sales-manager-linkedin-marketing-solutions-at-linkedin-4419298054?position=7&amp;pageNum=0"></a>
        <div class="base-search-card__info">
          <h3 class="base-search-card__title">Senior Sales Manager, LinkedIn Marketing Solutions</h3>
          <h4 class="base-search-card__subtitle">
            <a class="hidden-nested-link" href="https://www.linkedin.com/company/linkedin?trk=public_jobs_jserp-result_job-search-card-subtitle">LinkedIn</a>
          </h4>
          <div class="base-search-card__metadata">
            <span class="job-search-card__location">Bengaluru, Karnataka, India</span>
            <time class="job-search-card__listdate" datetime="2026-07-15">1 day ago</time>
          </div>
        </div>
      </div>
      <div class="base-card base-search-card job-search-card" data-entity-urn="urn:li:jobPosting:4425474450">
        <a class="base-card__full-link" href="https://in.linkedin.com/jobs/view/account-director-online-sales-growth-mid-market-at-linkedin-4425474450?position=4&amp;pageNum=0"></a>
        <div class="base-search-card__info">
          <h3 class="base-search-card__title">Account Director, Online Sales Growth - Mid-Market</h3>
          <h4 class="base-search-card__subtitle">
            <a class="hidden-nested-link" href="https://www.linkedin.com/company/linkedin?trk=public_jobs_jserp-result_job-search-card-subtitle">LinkedIn</a>
          </h4>
          <div class="base-search-card__metadata">
            <span class="job-search-card__location">Mumbai Metropolitan Region</span>
            <time class="job-search-card__listdate" datetime="2026-06-30">2 weeks ago</time>
          </div>
        </div>
      </div>
    </section>
  </body>
</html>
`

const zeroJobsSearchHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>0 jobs in India</title>
    <meta name="description" content="Today's top 0 jobs in India.">
    <meta name="linkedin:pageTag" content="urlType=jserp_custom;emptyResult=true">
    <meta property="og:url" content="https://www.linkedin.com/jobs/search">
  </head>
  <body>
    <section class="jobs-search__results-list">
      <div>LinkedIn</div>
      <p>No matching roles right now.</p>
    </section>
  </body>
</html>
`

const seniorSalesManagerDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>LinkedIn hiring Senior Sales Manager, LinkedIn Marketing Solutions in Bengaluru, Karnataka, India | LinkedIn</title>
    <script type="application/ld+json">
      {
        "@context": "http://schema.org",
        "@type": "JobPosting",
        "datePosted": "2026-07-15T10:03:53.000Z",
        "description": "&lt;p&gt;LinkedIn is the world's largest professional network.&lt;/p&gt;&lt;p&gt;&lt;strong&gt;Job Description&lt;/strong&gt;&lt;/p&gt;&lt;p&gt;&lt;strong&gt;Location: Bengaluru / Gurgaon&lt;/strong&gt;&lt;/p&gt;&lt;p&gt;The work location of this role is hybrid.&lt;/p&gt;&lt;p&gt;&lt;strong&gt;Suggested Skills&lt;/strong&gt;&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Sales Leadership&lt;/li&gt;&lt;li&gt;Solution Selling&lt;/li&gt;&lt;/ul&gt;&lt;strong&gt;Additional Information&lt;/strong&gt;",
        "employmentType": "FULL_TIME",
        "hiringOrganization": {
          "@type": "Organization",
          "name": "LinkedIn"
        },
        "jobLocation": {
          "@type": "Place",
          "address": {
            "@type": "PostalAddress",
            "addressCountry": "IN",
            "addressLocality": "Bengaluru",
            "addressRegion": "Karnataka"
          }
        },
        "title": "Senior Sales Manager, LinkedIn Marketing Solutions",
        "educationRequirements": {
          "@type": "EducationalOccupationalCredential",
          "credentialCategory": "bachelor degree"
        },
        "experienceRequirements": {
          "@type": "OccupationalExperienceRequirements",
          "monthsOfExperience": 144
        }
      }
    </script>
  </head>
  <body>
    <div class="description__text description__text--rich">
      <p>LinkedIn is the world's largest professional network.</p>
    </div>
    <li>
      <h3>Seniority level</h3>
      <span class="description__job-criteria-text description__job-criteria-text--criteria">Mid-Senior level</span>
    </li>
    <li>
      <h3>Employment type</h3>
      <span class="description__job-criteria-text description__job-criteria-text--criteria">Full-time</span>
    </li>
  </body>
</html>
`

const accountDirectorDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>LinkedIn hiring Account Director, Online Sales Growth - Mid-Market in Mumbai, Maharashtra, India | LinkedIn</title>
    <script type="application/ld+json">
      {
        "@context": "http://schema.org",
        "@type": "JobPosting",
        "datePosted": "2026-06-30T09:00:00.000Z",
        "description": "&lt;p&gt;Drive strategic growth for LinkedIn Marketing Solutions customers.&lt;/p&gt;&lt;p&gt;&lt;strong&gt;Suggested Skills&lt;/strong&gt;&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Digital Media Sales&lt;/li&gt;&lt;li&gt;Client Management&lt;/li&gt;&lt;/ul&gt;&lt;strong&gt;Additional Information&lt;/strong&gt;",
        "employmentType": "FULL_TIME",
        "hiringOrganization": {
          "@type": "Organization",
          "name": "LinkedIn"
        },
        "jobLocation": {
          "@type": "Place",
          "address": {
            "@type": "PostalAddress",
            "addressCountry": "IN",
            "addressLocality": "Mumbai",
            "addressRegion": "Maharashtra"
          }
        },
        "title": "Account Director, Online Sales Growth - Mid-Market",
        "educationRequirements": {
          "@type": "EducationalOccupationalCredential",
          "credentialCategory": "bachelor degree"
        },
        "experienceRequirements": {
          "@type": "OccupationalExperienceRequirements",
          "monthsOfExperience": 120
        }
      }
    </script>
  </head>
  <body>
    <div class="description__text description__text--rich">
      <p>Drive strategic growth for LinkedIn Marketing Solutions customers.</p>
    </div>
  </body>
</html>
`

const driftedSearchHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Unexpected</title>
  </head>
  <body>
    <p>No verified search shell.</p>
  </body>
</html>
`

const driftedDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Unexpected</title>
  </head>
  <body>
    <p>No JobPosting payload.</p>
  </body>
</html>
`

test('LinkedIn pins the verified public jobs search shell and extracts company-filtered cards plus JobPosting details', async () => {
  const linkedin = await loadLinkedInModule()

  assert.equal(linkedin.SOURCE, 'linkedin')
  assert.equal(linkedin.COMPANY, 'LinkedIn')
  assert.equal(linkedin.VERIFIED_ON, '2026-10-09')
  assert.equal(linkedin.HOMEPAGE_URL, 'https://www.linkedin.com/')
  assert.equal(
    linkedin.LINKEDIN_JOBS_URL,
    'https://www.linkedin.com/jobs/search/?f_C=1337&geoId=102713980',
  )
  assert.deepEqual(linkedin.VERIFIED_ROLE_URLS, [
    'https://in.linkedin.com/jobs/view/account-manager-linkedin-talent-solutions-at-linkedin-4422287519',
    'https://in.linkedin.com/jobs/view/senior-sales-manager-linkedin-marketing-solutions-at-linkedin-4419298054',
  ])

  assert.equal(linkedin.hasVerifiedJobsPageSignal(searchResultsHtml), true)
  assert.deepEqual(linkedin.extractSearchResults(searchResultsHtml), [
    {
      title: 'Senior Sales Manager, LinkedIn Marketing Solutions',
      company: 'LinkedIn',
      department: null,
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: '4419298054',
      requisitionId: '4419298054',
      sourceUrl: 'https://in.linkedin.com/jobs/view/senior-sales-manager-linkedin-marketing-solutions-at-linkedin-4419298054?position=7&pageNum=0',
      applyUrl: 'https://in.linkedin.com/jobs/view/senior-sales-manager-linkedin-marketing-solutions-at-linkedin-4419298054?position=7&pageNum=0',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-15',
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
    },
    {
      title: 'Account Director, Online Sales Growth - Mid-Market',
      company: 'LinkedIn',
      department: null,
      location: 'Mumbai Metropolitan Region',
      city: 'Mumbai Metropolitan Region',
      country: 'India',
      jobId: '4425474450',
      requisitionId: '4425474450',
      sourceUrl: 'https://in.linkedin.com/jobs/view/account-director-online-sales-growth-mid-market-at-linkedin-4425474450?position=4&pageNum=0',
      applyUrl: 'https://in.linkedin.com/jobs/view/account-director-online-sales-growth-mid-market-at-linkedin-4425474450?position=4&pageNum=0',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-30',
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
    },
  ])

  const detail = linkedin.extractJobDetail(
    seniorSalesManagerDetailHtml,
    {
      title: 'Senior Sales Manager, LinkedIn Marketing Solutions',
      sourceUrl: 'https://in.linkedin.com/jobs/view/senior-sales-manager-linkedin-marketing-solutions-at-linkedin-4419298054?position=7&pageNum=0',
    },
  )

  assert.equal(detail.title, 'Senior Sales Manager, LinkedIn Marketing Solutions')
  assert.equal(detail.company, 'LinkedIn')
  assert.equal(detail.location, 'Bengaluru, Karnataka, India')
  assert.equal(detail.city, 'Bengaluru')
  assert.equal(detail.country, 'India')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.experienceRequired, '12+ years')
  assert.equal(detail.minimumQualification, 'Bachelor degree')
  assert.equal(detail.postingDate, '2026-07-15')
  assert.equal(detail.remoteStatus, 'Hybrid')
  assert.deepEqual(detail.requiredSkills, [
    'Sales Leadership',
    'Solution Selling',
  ])
  assert.match(detail.jobDescription, /LinkedIn is the world's largest professional network\./)
})

test('LinkedIn scraper returns enriched India jobs from the verified public company-filtered jobs search and detail pages', async () => {
  const linkedin = await loadLinkedInModule()
  const requestedUrls = []

  const jobs = await linkedin.createLinkedInScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === linkedin.LINKEDIN_JOBS_URL) return searchResultsHtml
      if (url === 'https://in.linkedin.com/jobs/view/senior-sales-manager-linkedin-marketing-solutions-at-linkedin-4419298054?position=7&pageNum=0') {
        return seniorSalesManagerDetailHtml
      }

      if (url === 'https://in.linkedin.com/jobs/view/account-director-online-sales-growth-mid-market-at-linkedin-4425474450?position=4&pageNum=0') {
        return accountDirectorDetailHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-16T12:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    linkedin.LINKEDIN_JOBS_URL,
    'https://in.linkedin.com/jobs/view/senior-sales-manager-linkedin-marketing-solutions-at-linkedin-4419298054?position=7&pageNum=0',
    'https://in.linkedin.com/jobs/view/account-director-online-sales-growth-mid-market-at-linkedin-4425474450?position=4&pageNum=0',
  ])

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      country: job.country,
      employmentType: job.employmentType,
      experienceRequired: job.experienceRequired,
      minimumQualification: job.minimumQualification,
      requiredSkills: job.requiredSkills,
      remoteStatus: job.remoteStatus,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      source: job.source,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Senior Sales Manager, LinkedIn Marketing Solutions',
        location: 'Bengaluru, Karnataka, India',
        city: 'Bengaluru',
        country: 'India',
        employmentType: 'Full-time',
        experienceRequired: '12+ years',
        minimumQualification: 'Bachelor degree',
        requiredSkills: [
          'Sales Leadership',
          'Solution Selling',
        ],
        remoteStatus: 'Hybrid',
        sourceUrl: 'https://in.linkedin.com/jobs/view/senior-sales-manager-linkedin-marketing-solutions-at-linkedin-4419298054?position=7&pageNum=0',
        applyUrl: 'https://in.linkedin.com/jobs/view/senior-sales-manager-linkedin-marketing-solutions-at-linkedin-4419298054?position=7&pageNum=0',
        source: 'linkedin',
        scrapedAt: '2026-07-16T12:00:00.000Z',
      },
      {
        title: 'Account Director, Online Sales Growth - Mid-Market',
        location: 'Mumbai, Maharashtra, India',
        city: 'Mumbai',
        country: 'India',
        employmentType: 'Full-time',
        experienceRequired: '10+ years',
        minimumQualification: 'Bachelor degree',
        requiredSkills: [
          'Digital Media Sales',
          'Client Management',
        ],
        remoteStatus: null,
        sourceUrl: 'https://in.linkedin.com/jobs/view/account-director-online-sales-growth-mid-market-at-linkedin-4425474450?position=4&pageNum=0',
        applyUrl: 'https://in.linkedin.com/jobs/view/account-director-online-sales-growth-mid-market-at-linkedin-4425474450?position=4&pageNum=0',
        source: 'linkedin',
        scrapedAt: '2026-07-16T12:00:00.000Z',
      },
    ],
  )
})

test('LinkedIn scraper returns an empty list for a verified zero-results shell and fails closed on drifted pages', async () => {
  const linkedin = await loadLinkedInModule()

  const jobs = await linkedin.createLinkedInScraper().run({
    fetchText: async (url) => {
      if (url === linkedin.LINKEDIN_JOBS_URL) return zeroJobsSearchHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])

  await assert.rejects(
    linkedin.createLinkedInScraper().run({
      fetchText: async (url) => {
        if (url === linkedin.LINKEDIN_JOBS_URL) return driftedSearchHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /jobs search page/i,
  )

  await assert.rejects(
    linkedin.createLinkedInScraper().run({
      fetchText: async (url) => {
        if (url === linkedin.LINKEDIN_JOBS_URL) return searchResultsHtml
        return driftedDetailHtml
      },
    }),
    /detail page/i,
  )
})


test('LinkedIn validates the current India canonical alias with exact selected company scope', async () => {
  const linkedin = await loadLinkedInModule(), { readFile } = await import('node:fs/promises')
  const html = await readFile(new URL('./fixtures/linkedin/search-20261009.html', import.meta.url), 'utf8')
  assert.equal(linkedin.hasVerifiedJobsPageSignal(html), true)
  assert.equal(linkedin.hasVerifiedJobsPageSignal(html.replaceAll('f_C=1337', 'f_C=9999')), false)
  assert.equal(linkedin.hasVerifiedJobsPageSignal(html.replace('name="f_C" checked value="1337"', 'name="f_C" checked value="9999"')), false)
})
test('LinkedIn parses every current new-date card within an external timeout', async () => {
  const { execFile } = await import('node:child_process'), { promisify } = await import('node:util')
  const { fileURLToPath } = await import('node:url')
  const code = 'import fs from "node:fs/promises";import {extractSearchResults} from ' + JSON.stringify(new URL('../../scraper/linkedin/script.js', import.meta.url).href)
    + ';const jobs=extractSearchResults(await fs.readFile(' + JSON.stringify(fileURLToPath(new URL('./fixtures/linkedin/search-20261009.html', import.meta.url))) + ',"utf8"));console.log(JSON.stringify({count:jobs.length,ids:new Set(jobs.map(j=>j.jobId)).size,companies:[...new Set(jobs.map(j=>j.company))]}))'
  const { stdout } = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', code], { timeout: 3000, killSignal: 'SIGKILL', windowsHide: true })
  assert.deepEqual(JSON.parse(stdout), { count: 47, ids: 47, companies: ['LinkedIn'] })
})

test('LinkedIn listing geography does not assign India to Remote or a foreign city', async () => {
  const linkedin = await loadLinkedInModule(), { readFile } = await import('node:fs/promises')
  const html = await readFile(new URL('./fixtures/linkedin/search-20261009.html', import.meta.url), 'utf8')
  for (const place of ['Remote', 'Seattle, Washington, United States']) {
    const changed = html.replace('Coimbatore, Tamil Nadu, India', place)
    assert.notEqual(changed, html)
    assert.equal(linkedin.extractSearchResults(changed)[0].country, null)
  }
})

test('LinkedIn marks capped or count-mismatched inventories incomplete and rejects a missing positive inventory', async () => {
  const linkedin = await loadLinkedInModule()
  const fetchText = async url => url === linkedin.LINKEDIN_JOBS_URL ? searchResultsHtml : /4419298054/.test(url) ? seniorSalesManagerDetailHtml : accountDirectorDetailHtml
  const capped = await linkedin.createLinkedInScraper({ maxJobs: 1 }).run({ fetchText })
  assert.equal(capped.length, 1)
  assert.equal(capped[0].sourceListingComplete, false)
  const mismatched = await linkedin.createLinkedInScraper().run({ fetchText: async url => url === linkedin.LINKEDIN_JOBS_URL ? searchResultsHtml.replace('<body>', '<body><span class="results-context-header__job-count">47</span>') : fetchText(url) })
  assert.ok(mismatched.every(job => job.sourceListingComplete === false))
  await assert.rejects(linkedin.createLinkedInScraper().run({ fetchText: async () => zeroJobsSearchHtml.replace('<body>', '<body><span class="results-context-header__job-count">47</span>') }), /advertised job inventory/)
})
