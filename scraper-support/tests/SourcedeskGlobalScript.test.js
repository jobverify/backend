import assert from 'node:assert/strict'
import test from 'node:test'

const currentOpeningsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Find all Current Openings - Sourcedesk</title>
  </head>
  <body>
    <nav><a href="/current-openings">Apply for Jobs</a></nav>
    <h1>Find all Current Openings</h1>
    <a href="/current-openings/seo-executive">View Details</a>
    <a href="/current-openings/urgent-position-business-associate-online-bidder">View Details</a>
  </body>
</html>
`

const seoDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>SEO Executive</title>
  </head>
  <body>
    <p>Job Description We are seeking a results-driven SEO Executive to join our Digital Marketing team. Job Information Date Opened 30 Jul 2026 Job Type Work From Office Employment Type Full Time Work Experience 2-4 years City Kolkata Country India Department Digital Marketing Share this job SEO Executive</p>
  </body>
</html>
`

const bidderDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Urgent Position: Business Associate (Online Bidder)</title>
  </head>
  <body>
    <p>Job Description Sourcedesk Global is seeking a skilled Online bidder to become a part of our sales and marketing team. Job Information Date Opened 30 Jul 2026 Job Type Work From Office Employment Type Full Time Work Experience 1-3 Years City Kolkata Country India Department Web Development Share this job Urgent Position: Business Associate (Online Bidder)</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/sourcedeskglobal/script.js')
  } catch {
    assert.fail('Expected Sourcedesk Global scraper module at ../../scraper/sourcedeskglobal/script.js')
  }
}

test('Sourcedesk Global validates the first-party current-openings page and extracts live detail URLs', async () => {
  const sourcedesk = await loadModule()

  assert.equal(sourcedesk.SOURCE, 'sourcedeskglobal')
  assert.equal(sourcedesk.COMPANY, 'Sourcedesk Global')
  assert.equal(sourcedesk.CAREERS_URL, 'https://www.sourcedesk.io/current-openings')
  assert.equal(sourcedesk.VERIFIED_ON, '2026-08-04')
  assert.equal(sourcedesk.hasOfficialCurrentOpeningsSignal(currentOpeningsHtml), true)
  assert.deepEqual(sourcedesk.extractListingUrls(currentOpeningsHtml), [
    'https://www.sourcedesk.io/current-openings/seo-executive',
    'https://www.sourcedesk.io/current-openings/urgent-position-business-associate-online-bidder',
  ])
})

test('Sourcedesk Global extracts normalized India jobs from first-party detail pages', async () => {
  const sourcedesk = await loadModule()

  assert.deepEqual(
    sourcedesk.extractJobDetail(seoDetailHtml, 'https://www.sourcedesk.io/current-openings/seo-executive'),
    {
      title: 'SEO Executive',
      company: 'Sourcedesk Global',
      department: 'Digital Marketing',
      location: 'Kolkata, India',
      city: 'Kolkata',
      country: 'India',
      jobId: 'seo-executive',
      requisitionId: 'seo-executive',
      sourceUrl: 'https://www.sourcedesk.io/current-openings/seo-executive',
      applyUrl: 'https://www.sourcedesk.io/current-openings/seo-executive',
      employmentType: 'Full Time',
      experienceRequired: '2-4 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '30 Jul 2026',
      closingDate: null,
      jobDescription: 'We are seeking a results-driven SEO Executive to join our Digital Marketing team.',
      remoteStatus: 'On-site',
    },
  )
})

test('Sourcedesk Global run maps first-party detail pages into normalized jobs', async () => {
  const sourcedesk = await loadModule()
  const requestedUrls = []

  const jobs = await sourcedesk.createSourcedeskGlobalScraper({
    now: () => '2026-08-04T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === sourcedesk.CAREERS_URL) return currentOpeningsHtml
      if (url === 'https://www.sourcedesk.io/current-openings/seo-executive') {
        return seoDetailHtml
      }
      if (url === 'https://www.sourcedesk.io/current-openings/urgent-position-business-associate-online-bidder') {
        return bidderDetailHtml
      }
      throw new Error(`Unexpected Sourcedesk URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    sourcedesk.CAREERS_URL,
    'https://www.sourcedesk.io/current-openings/seo-executive',
    'https://www.sourcedesk.io/current-openings/urgent-position-business-associate-online-bidder',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].location, 'Kolkata, India')
  assert.equal(jobs[0].applyUrl, 'https://www.sourcedesk.io/current-openings/seo-executive')
  assert.equal(jobs[1].title, 'Urgent Position: Business Associate (Online Bidder)')
  assert.equal(jobs[0].scrapedAt, '2026-08-04T00:00:00.000Z')
})

test('Sourcedesk Global fails closed when the current-openings or first-party detail contract drifts', async () => {
  const sourcedesk = await loadModule()

  await assert.rejects(
    sourcedesk.createSourcedeskGlobalScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified first-party current-openings page/i,
  )
})
