import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T18:00:00.000Z'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>India Careers - Seneca Global</title>
  </head>
  <body>
    <h1>India-Based Career Opportunities</h1>
    <h2>Open positions</h2>
    <div class="fl-post-feed-post career-item">
      <h2 class="h3 career-title">
        <a href="https://www.senecaglobal.com/india-careers/senior-qa-lead/" title="Senior QA Lead">Senior QA Lead</a>
      </h2>
    </div>
    <div class="fl-post-feed-post career-item">
      <h2 class="h3 career-title">
        <a href="https://www.senecaglobal.com/india-careers/senior-web-publisher/" title="Senior Web Publisher">Senior Web Publisher</a>
      </h2>
    </div>
  </body>
</html>
`

const seniorQaLeadDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Senior QA Lead - SenecaGlobal</title>
    <link rel="canonical" href="https://www.senecaglobal.com/india-careers/senior-qa-lead/" />
    <meta
      property="og:description"
      content="Own QA strategy, planning, execution, reporting, and process improvement across multiple products and release cycles."
    />
  </head>
  <body></body>
</html>
`

const seniorWebPublisherDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Senior Web Publisher - SenecaGlobal</title>
    <link rel="canonical" href="https://www.senecaglobal.com/india-careers/senior-web-publisher/" />
    <meta
      property="og:description"
      content="Manage day-to-day publishing in AEM, translations, approvals, and publishing across global geo and localization sites."
    />
  </head>
  <body></body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/senecaglobalitservices/script.js')
  } catch {
    assert.fail('Expected Seneca Global IT Services scraper module at ../../scraper/senecaglobalitservices/script.js')
  }
}

test('Seneca Global IT Services helpers stay pinned to the verified India careers list and detail page contract', async () => {
  const seneca = await loadModule()

  assert.equal(seneca.SOURCE, 'senecaglobalitservices')
  assert.equal(seneca.COMPANY, 'Seneca Global IT Services')
  assert.equal(
    seneca.CAREERS_URL,
    'https://www.senecaglobal.com/careers/india-careers/',
  )
  assert.equal(seneca.VERIFIED_ON, '2026-08-04')
  assert.equal(seneca.hasOfficialCareersSignal(careersPageHtml), true)
  assert.deepEqual(seneca.extractJobCards(careersPageHtml), [
    {
      title: 'Senior QA Lead',
      detailUrl: 'https://www.senecaglobal.com/india-careers/senior-qa-lead/',
    },
    {
      title: 'Senior Web Publisher',
      detailUrl: 'https://www.senecaglobal.com/india-careers/senior-web-publisher/',
    },
  ])
  assert.equal(seneca.hasOfficialJobDetailSignal(seniorQaLeadDetailHtml), true)
  assert.deepEqual(
    seneca.extractJobFromDetailHtml(
      seniorQaLeadDetailHtml,
      {
        title: 'Senior QA Lead',
        detailUrl: 'https://www.senecaglobal.com/india-careers/senior-qa-lead/',
      },
      { scrapedAt: FIXED_SCRAPED_AT },
    ),
    {
      jobId: 'senior-qa-lead',
      title: 'Senior QA Lead',
      company: 'Seneca Global IT Services',
      department: null,
      location: 'India',
      city: null,
      country: 'India',
      sourceUrl: 'https://www.senecaglobal.com/india-careers/senior-qa-lead/',
      applyUrl: 'https://www.senecaglobal.com/india-careers/senior-qa-lead/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'Own QA strategy, planning, execution, reporting, and process improvement across multiple products and release cycles.',
      publicExperienceChecked: true,
      requisitionId: 'senior-qa-lead',
      source: 'senecaglobalitservices',
      link: 'https://www.senecaglobal.com/india-careers/senior-qa-lead/',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  )
})

test('Seneca Global IT Services run validates the verified India careers page and same-domain detail pages', async () => {
  const seneca = await loadModule()
  const requestedUrls = []

  const jobs = await seneca.createSenecaGlobalITServicesScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === seneca.CAREERS_URL) return careersPageHtml
      if (url === 'https://www.senecaglobal.com/india-careers/senior-qa-lead/') {
        return seniorQaLeadDetailHtml
      }
      if (url === 'https://www.senecaglobal.com/india-careers/senior-web-publisher/') {
        return seniorWebPublisherDetailHtml
      }

      throw new Error(`Unexpected Seneca Global IT Services URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    seneca.CAREERS_URL,
    'https://www.senecaglobal.com/india-careers/senior-qa-lead/',
    'https://www.senecaglobal.com/india-careers/senior-web-publisher/',
  ])
  assert.deepEqual(jobs, [
    {
      jobId: 'senior-qa-lead',
      title: 'Senior QA Lead',
      company: 'Seneca Global IT Services',
      department: null,
      location: 'India',
      city: null,
      country: 'India',
      sourceUrl: 'https://www.senecaglobal.com/india-careers/senior-qa-lead/',
      applyUrl: 'https://www.senecaglobal.com/india-careers/senior-qa-lead/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'Own QA strategy, planning, execution, reporting, and process improvement across multiple products and release cycles.',
      publicExperienceChecked: true,
      requisitionId: 'senior-qa-lead',
      source: 'senecaglobalitservices',
      link: 'https://www.senecaglobal.com/india-careers/senior-qa-lead/',
      scrapedAt: FIXED_SCRAPED_AT,
      companyCareerPage: 'https://www.senecaglobal.com/careers/india-careers/',
      companyDomain: 'senecaglobal.com',
      atsPlatform: 'official-company-careers',
    },
    {
      jobId: 'senior-web-publisher',
      title: 'Senior Web Publisher',
      company: 'Seneca Global IT Services',
      department: null,
      location: 'India',
      city: null,
      country: 'India',
      sourceUrl: 'https://www.senecaglobal.com/india-careers/senior-web-publisher/',
      applyUrl: 'https://www.senecaglobal.com/india-careers/senior-web-publisher/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'Manage day-to-day publishing in AEM, translations, approvals, and publishing across global geo and localization sites.',
      publicExperienceChecked: true,
      requisitionId: 'senior-web-publisher',
      source: 'senecaglobalitservices',
      link: 'https://www.senecaglobal.com/india-careers/senior-web-publisher/',
      scrapedAt: FIXED_SCRAPED_AT,
      companyCareerPage: 'https://www.senecaglobal.com/careers/india-careers/',
      companyDomain: 'senecaglobal.com',
      atsPlatform: 'official-company-careers',
    },
  ])
  assert.ok(jobs.every((job) => job.publicExperienceChecked === true))
})

test('Seneca Global IT Services fails closed when the verified India careers list or detail pages drift materially', async () => {
  const seneca = await loadModule()

  await assert.rejects(
    seneca.createSenecaGlobalITServicesScraper().run({
      fetchText: async (url) => {
        if (url === seneca.CAREERS_URL) return '<html><body><h1>Careers</h1></body></html>'
        throw new Error(`Unexpected Seneca URL: ${url}`)
      },
    }),
    /verified Seneca Global IT Services careers page/i,
  )

  await assert.rejects(
    seneca.createSenecaGlobalITServicesScraper().run({
      fetchText: async (url) => {
        if (url === seneca.CAREERS_URL) return careersPageHtml
        if (url === 'https://www.senecaglobal.com/india-careers/senior-qa-lead/') {
          return '<html><body><h1>Unexpected</h1></body></html>'
        }
        if (url === 'https://www.senecaglobal.com/india-careers/senior-web-publisher/') {
          return seniorWebPublisherDetailHtml
        }
        throw new Error(`Unexpected Seneca URL: ${url}`)
      },
    }),
    /verified Seneca Global IT Services detail page/i,
  )
})
