import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-21T00:00:00.000Z'
const BUSINESS_URL = 'https://www.tatvasoft.com/career/business-development-executive'
const JAVA_URL = 'https://www.tatvasoft.com/career/java-developer'

const CAREERS_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers at TatvaSoft | Join Our Global Software Development Team</title>
  </head>
  <body>
    <h1>Technology Evolves, Challenges Grow</h1>
    <p>Official emails are sent only from @tatvasoft.com.</p>
    <h2>Current Openings</h2>
    <p>Explore exciting career opportunities and grow with our talented team.</p>
    <h3><a href="${BUSINESS_URL}">Business Development Executive</a></h3>
    <p>Position: BDE/BDM Experience: 1+ Years</p>
    <h3><a href="${JAVA_URL}">Java Developer</a></h3>
    <p>Position: ASE/SE/SSE/TL Experience: 2 - 5 Years</p>
  </body>
</html>
`

const BUSINESS_DETAIL_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers at TatvaSoft | Join Our Global Software Development Team</title>
  </head>
  <body>
    <h1>Business Development Executive</h1>
    <p>Qualification: MBA</p>
    <p>Required Experience: 1+ Years</p>
    <p>Strong communication and customer engagement skills.</p>
    <p>To apply for this position mail your updated Resume on career@tatvasoft.com</p>
  </body>
</html>
`

const JAVA_DETAIL_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers at TatvaSoft | Join Our Global Software Development Team</title>
  </head>
  <body>
    <h1>Java Developer</h1>
    <p>Qualification: B.E. / B.Tech</p>
    <p>Required Experience: 2 - 5 Years</p>
    <p>Required specifications and qualifications</p>
    <p>To apply for this position mail your updated Resume on career@tatvasoft.com</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/tatvasoft/script.js')
  } catch {
    assert.fail('Expected TatvaSoft scraper module at ../../scraper/tatvasoft/script.js')
  }
}

test('TatvaSoft accepts the live August 21, 2026 careers title while preserving the verified openings and detail pages', async () => {
  const tatvasoft = await loadModule()

  assert.equal(tatvasoft.hasOfficialCareersPageSignal(CAREERS_HTML), true)
  assert.deepEqual(tatvasoft.extractOpeningLinks(CAREERS_HTML), [
    { title: 'Business Development Executive', url: BUSINESS_URL },
    { title: 'Java Developer', url: JAVA_URL },
  ])
  assert.equal(tatvasoft.hasOfficialDetailSignal(BUSINESS_DETAIL_HTML), true)
  assert.equal(tatvasoft.hasOfficialDetailSignal(JAVA_DETAIL_HTML), true)
})

test('TatvaSoft run still returns the verified two first-party openings on the live page shape', async () => {
  const tatvasoft = await loadModule()
  const requestedUrls = []

  const jobs = await tatvasoft.createTatvaSoftScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === tatvasoft.CAREERS_URL) return { status: 200, url, html: CAREERS_HTML }
      if (url === BUSINESS_URL) return { status: 200, url, html: BUSINESS_DETAIL_HTML }
      if (url === JAVA_URL) return { status: 200, url, html: JAVA_DETAIL_HTML }
      throw new Error(`Unexpected TatvaSoft URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    tatvasoft.CAREERS_URL,
    BUSINESS_URL,
    JAVA_URL,
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'tatvasoft')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[1].title, 'Java Developer')
})
