import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/mresultservices/script.js')
  } catch {
    assert.fail('Expected scraper module at ../../scraper/mresultservices/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Transform Complexity Into Competitive Advantage</h1>
    <p>Business value begins with a single data point.</p>
    <p>MResult is a leading Data, Analytics &amp; Digital Solutions partner that helps global clients unlock value at every stage of the data and product development lifecycle.</p>
    <p>The average MResulter spends 7+ years here, working on cutting edge projects for some of the biggest companies in the world.</p>
    <a href="/careers/">Careers</a>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>A Place Where Good Work Meets Great People</h1>
    <p>The function of leadership is to produce more leaders, not more followers.</p>
    <h2>An Open Culture Where People Thrive</h2>
    <p>At MResult, we believe great ideas can come from anyone, anywhere.</p>
    <p>With flexible work models and an environment built on mutual respect, we give every MResulter the space to do meaningful work in a way that fits their goals and lifestyle.</p>
    <p>View Current Job Openings</p>
    <h2>A Work Environment That Values Growth</h2>
    <p>Many of our employees have built long-term careers, growing from basic roles to senior leadership.</p>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Let’s Collaborate.</h1>
    <p>Every successful project starts with a conversation.</p>
    <h2>Bangalore</h2>
    <p>9th Floor, Nalapad Brigade Centre, Mahadevapura, Whitefield Main Rd, Bengaluru 560048</p>
    <p>Phone: (+91) 80 40810100</p>
    <h2>Mangalore</h2>
    <p>Rama Bhavan Complex, Kodialbail, Mangalore 575003</p>
  </body>
</html>
`

const publicJobsInventoryHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>A Place Where Good Work Meets Great People</h1>
    <h2>An Open Culture Where People Thrive</h2>
    <p>View Current Job Openings</p>
    <h2>A Work Environment That Values Growth</h2>
    <p>Many of our employees have built long-term careers, growing from basic roles to senior leadership.</p>
    <h3>Current Openings</h3>
    <a href="https://boards.greenhouse.io/mresult/jobs/12345">Senior Data Engineer</a>
    <a href="https://boards.greenhouse.io/mresult/jobs/67890">QA Engineer</a>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Senior Data Engineer"}
    </script>
  </body>
</html>
`

test('MResult Services sentinel exposes the verified first-party contract helpers', async () => {
  const mresult = await loadModule()

  assert.equal(mresult.PROVIDER_METADATA.source, 'mresultservices')
  assert.equal(mresult.HOMEPAGE_URL, 'https://mresult.com/')
  assert.equal(mresult.CAREERS_URL, 'https://mresult.com/careers/')
  assert.equal(mresult.CONTACT_URL, 'https://mresult.com/contact-us/')
  assert.equal(mresult.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(mresult.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(mresult.hasOfficialContactSignal(contactHtml), true)
  assert.equal(mresult.hasTrustworthyPublicJobsInventorySignal(careersHtml), false)
  assert.equal(mresult.hasTrustworthyPublicJobsInventorySignal(publicJobsInventoryHtml), true)
})

test('MResult Services sentinel validates the verified first-party pages before returning []', async () => {
  const mresult = await loadModule()
  const requestedUrls = []

  const jobs = await mresult.createMResultServicesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === mresult.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === mresult.CAREERS_URL) return { status: 200, url, html: careersHtml }
      if (url === mresult.CONTACT_URL) return { status: 200, url, html: contactHtml }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    mresult.HOMEPAGE_URL,
    mresult.CAREERS_URL,
    mresult.CONTACT_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('MResult Services sentinel fails closed when the verified first-party contract drifts', async () => {
  const mresult = await loadModule()

  await assert.rejects(
    mresult.createMResultServicesScraper().run({
      fetchPage: async (url) => {
        if (url === mresult.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Other Company</h1></body></html>' }
        }
        return { status: 200, url, html: careersHtml }
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    mresult.createMResultServicesScraper().run({
      fetchPage: async (url) => {
        if (url === mresult.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === mresult.CAREERS_URL) return { status: 200, url, html: publicJobsInventoryHtml }
        if (url === mresult.CONTACT_URL) return { status: 200, url, html: contactHtml }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public jobs inventory/i,
  )

  await assert.rejects(
    mresult.createMResultServicesScraper().run({
      fetchPage: async (url) => {
        if (url === mresult.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === mresult.CAREERS_URL) return { status: 200, url, html: careersHtml }
        if (url === mresult.CONTACT_URL) {
          return { status: 200, url, html: '<html><body><h1>Contact</h1></body></html>' }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /contact page/i,
  )
})
