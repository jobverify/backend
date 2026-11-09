import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T13:15:00.000Z'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Syncfusion Career</h1>
      <h2>Current Openings</h2>
      <h2>There are no current openings</h2>
      <p>Thanks for your interest! We don't have any current openings, but we're always excited to meet new talent.</p>
      <a href="#relevant-jobs">Relevant Jobs</a>
      <section id="relevant-jobs">
        <a href="https://www.syncfusion.com/careers/dotnet-developer-fresher/">
          .NET Developer (Fresher) Location: Chennai, India I'm Interested
        </a>
        <a href="https://www.syncfusion.com/careers/testing-engineer-experience/">
          Testing Engineer (Experienced) Location: Chennai, India I'm Interested
        </a>
      </section>
      <h2>Our recruitment process</h2>
    </main>
  </body>
</html>
`

const dotnetDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>.NET Developer (Fresher)</h1>
      <p>Experience: 0-1 Year</p>
      <p>Location: Chennai, India</p>
      <a href="/careers/dotnet-developer-fresher/apply/">I&#8217;m Interested</a>
      <h2>Job Description</h2>
      <p>Develop and maintain Syncfusion components for web, desktop, and mobile platforms.</p>
      <p>Support long-term product quality and continuous delivery.</p>
      <h2>Roles and Responsibilities</h2>
      <p>Collaborate with engineering and product teams.</p>
      <h2>Eligibility</h2>
      <h3>Academic Qualifications</h3>
      <p>BE/B.Tech, ME/M.Tech, M.Sc. (CS, IT), MCA.</p>
      <p>2023 graduates with a minimum of 65% in UG and PG (if applicable).</p>
      <h3>Experience</h3>
      <p>0-1 years in software engineering.</p>
      <h2>Skills Required</h2>
      <p>Knowledge in one or more of the following platforms or languages - C#, Java, C++, Python.</p>
      <p>Ability to collaborate effectively with large teams.</p>
      <p>Permanent work-from-home option after the probation period.</p>
      <h2>Share this Job Opening</h2>
    </main>
  </body>
</html>
`

const testingDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Testing Engineer (Experienced)</h1>
      <p>Experience: 1-3 Years</p>
      <p>Location: Chennai, India</p>
      <a href="/careers/testing-engineer-experience/apply/">I&#8217;m Interested</a>
      <h2>Job Description</h2>
      <p>Validate component quality through manual and automated testing workflows.</p>
      <p>Work with developers to resolve regressions quickly.</p>
      <h2>Roles and Responsibilities</h2>
      <p>Own repeatable quality checks for releases.</p>
      <h2>Eligibility</h2>
      <h3>Academic Qualifications</h3>
      <p>BE/B.Tech, MCA, or equivalent.</p>
      <p>Minimum of 65% in relevant academics.</p>
      <h3>Experience</h3>
      <p>1-3 years of testing experience.</p>
      <h2>Skills Required</h2>
      <p>Experience with manual and automated testing methodologies.</p>
      <p>Ability to document defects clearly and collaborate with teams.</p>
      <h2>Share this Job Opening</h2>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/syncfusion/script.js')
  } catch {
    assert.fail('Expected Syncfusion scraper module at ../../scraper/syncfusion/script.js')
  }
}

test('Syncfusion helpers stay pinned to the verified careers page and same-domain Relevant Jobs detail contract', async () => {
  const syncfusion = await loadModule()

  assert.equal(syncfusion.SOURCE, 'syncfusion')
  assert.equal(syncfusion.COMPANY, 'Syncfusion')
  assert.equal(syncfusion.OFFICIAL_BRAND_NAME, 'Syncfusion')
  assert.equal(syncfusion.CAREERS_URL, 'https://www.syncfusion.com/careers/')
  assert.equal(syncfusion.VERIFIED_ON, '2026-08-05')
  assert.deepEqual(syncfusion.VERIFIED_JOB_DETAIL_URLS, [
    'https://www.syncfusion.com/careers/dotnet-developer-fresher/',
    'https://www.syncfusion.com/careers/dotnet-developer-experience/',
    'https://www.syncfusion.com/careers/testing-engineer-fresher/',
  ])
  assert.equal(syncfusion.hasOfficialCareersSignal(careersPageHtml), true)
  assert.match(syncfusion.VERIFIED_SURFACE_SUMMARY, /Relevant Jobs/i)
  assert.deepEqual(syncfusion.extractRelevantJobCards(syncfusion.getRelevantJobsSectionHtml(careersPageHtml)), [
    {
      title: '.NET Developer (Fresher)',
      location: 'Chennai, India',
      detailUrl: 'https://www.syncfusion.com/careers/dotnet-developer-fresher/',
    },
    {
      title: 'Testing Engineer (Experienced)',
      location: 'Chennai, India',
      detailUrl: 'https://www.syncfusion.com/careers/testing-engineer-experience/',
    },
  ])
  assert.equal(syncfusion.hasOfficialJobDetailSignal(dotnetDetailHtml), true)
  assert.deepEqual(
    syncfusion.extractJobFromDetailHtml(
      dotnetDetailHtml,
      {
        title: '.NET Developer (Fresher)',
        detailUrl: 'https://www.syncfusion.com/careers/dotnet-developer-fresher/',
      },
      { scrapedAt: FIXED_SCRAPED_AT },
    ),
    {
      title: '.NET Developer (Fresher)',
      company: 'Syncfusion',
      department: null,
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      jobId: 'dotnet-developer-fresher',
      requisitionId: 'dotnet-developer-fresher',
      sourceUrl: 'https://www.syncfusion.com/careers/dotnet-developer-fresher/',
      applyUrl: 'https://www.syncfusion.com/careers/dotnet-developer-fresher/apply/',
      employmentType: null,
      experienceRequired: '0-1 Year',
      minimumQualification:
        'BE/B.Tech, ME/M.Tech, M.Sc. (CS, IT), MCA. 2023 graduates with a minimum of 65% in UG and PG (if applicable).',
      preferredQualification: null,
      requiredSkills: [
        'Knowledge in one or more of the following platforms or languages - C#, Java, C++, Python.',
        'Ability to collaborate effectively with large teams.',
        'Permanent work-from-home option after the probation period.',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'Develop and maintain Syncfusion components for web, desktop, and mobile platforms. Support long-term product quality and continuous delivery.',
      remoteStatus: 'Hybrid',
      source: 'syncfusion',
      link: 'https://www.syncfusion.com/careers/dotnet-developer-fresher/',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  )
})

test('Syncfusion run validates the careers page, follows same-domain Relevant Jobs detail links, and returns normalized jobs', async () => {
  const syncfusion = await loadModule()
  const requestedUrls = []

  const jobs = await syncfusion.createSyncfusionScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === syncfusion.CAREERS_URL) return careersPageHtml
      if (url === 'https://www.syncfusion.com/careers/dotnet-developer-fresher/') return dotnetDetailHtml
      if (url === 'https://www.syncfusion.com/careers/testing-engineer-experience/') return testingDetailHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    syncfusion.CAREERS_URL,
    'https://www.syncfusion.com/careers/dotnet-developer-fresher/',
    'https://www.syncfusion.com/careers/testing-engineer-experience/',
  ])
  assert.deepEqual(jobs, [
    {
      title: '.NET Developer (Fresher)',
      company: 'Syncfusion',
      department: null,
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      jobId: 'dotnet-developer-fresher',
      requisitionId: 'dotnet-developer-fresher',
      sourceUrl: 'https://www.syncfusion.com/careers/dotnet-developer-fresher/',
      applyUrl: 'https://www.syncfusion.com/careers/dotnet-developer-fresher/apply/',
      employmentType: null,
      experienceRequired: '0-1 Year',
      minimumQualification:
        'BE/B.Tech, ME/M.Tech, M.Sc. (CS, IT), MCA. 2023 graduates with a minimum of 65% in UG and PG (if applicable).',
      preferredQualification: null,
      requiredSkills: [
        'Knowledge in one or more of the following platforms or languages - C#, Java, C++, Python.',
        'Ability to collaborate effectively with large teams.',
        'Permanent work-from-home option after the probation period.',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'Develop and maintain Syncfusion components for web, desktop, and mobile platforms. Support long-term product quality and continuous delivery.',
      remoteStatus: 'Hybrid',
      source: 'syncfusion',
      link: 'https://www.syncfusion.com/careers/dotnet-developer-fresher/',
      scrapedAt: FIXED_SCRAPED_AT,
      companyCareerPage: 'https://www.syncfusion.com/careers/',
      companyDomain: 'syncfusion.com',
      atsPlatform: 'official-careers-page-relevant-job-details',
    },
    {
      title: 'Testing Engineer (Experienced)',
      company: 'Syncfusion',
      department: null,
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      jobId: 'testing-engineer-experience',
      requisitionId: 'testing-engineer-experience',
      sourceUrl: 'https://www.syncfusion.com/careers/testing-engineer-experience/',
      applyUrl: 'https://www.syncfusion.com/careers/testing-engineer-experience/apply/',
      employmentType: null,
      experienceRequired: '1-3 Years',
      minimumQualification: 'BE/B.Tech, MCA, or equivalent. Minimum of 65% in relevant academics.',
      preferredQualification: null,
      requiredSkills: [
        'Experience with manual and automated testing methodologies.',
        'Ability to document defects clearly and collaborate with teams.',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'Validate component quality through manual and automated testing workflows. Work with developers to resolve regressions quickly.',
      remoteStatus: 'On-site',
      source: 'syncfusion',
      link: 'https://www.syncfusion.com/careers/testing-engineer-experience/',
      scrapedAt: FIXED_SCRAPED_AT,
      companyCareerPage: 'https://www.syncfusion.com/careers/',
      companyDomain: 'syncfusion.com',
      atsPlatform: 'official-careers-page-relevant-job-details',
    },
  ])
})

test('Syncfusion fails closed when the verified careers page or Relevant Jobs detail pages drift materially', async () => {
  const syncfusion = await loadModule()

  await assert.rejects(
    syncfusion.createSyncfusionScraper().run({
      fetchText: async (url) => {
        if (url === syncfusion.CAREERS_URL) return '<html><body><h1>Careers</h1></body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified Syncfusion careers page/i,
  )

  await assert.rejects(
    syncfusion.createSyncfusionScraper().run({
      fetchText: async (url) => {
        if (url === syncfusion.CAREERS_URL) {
          return `
            <!doctype html>
            <html>
              <body>
                <h1>Syncfusion Career</h1>
                <h2>There are no current openings</h2>
                <p>Relevant Jobs</p>
                <p>.NET Developer (Fresher) Location: Chennai, India I'm Interested</p>
              </body>
            </html>
          `
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /Relevant Jobs detail links/i,
  )

  await assert.rejects(
    syncfusion.createSyncfusionScraper().run({
      fetchText: async (url) => {
        if (url === syncfusion.CAREERS_URL) return careersPageHtml
        if (url === 'https://www.syncfusion.com/careers/dotnet-developer-fresher/') {
          return '<html><body><h1>Unexpected</h1></body></html>'
        }
        if (url === 'https://www.syncfusion.com/careers/testing-engineer-experience/') {
          return testingDetailHtml
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified Syncfusion job detail page/i,
  )
})
