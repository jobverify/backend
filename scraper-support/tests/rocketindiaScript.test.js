import assert from 'node:assert/strict'
import test from 'node:test'

const loadRocketIndiaModule = async () => {
  try {
    return await import('../../scraper/rocketindia/script.js')
  } catch {
    return null
  }
}

const searchResultsHtml = `
  <!doctype html>
  <html lang="en" class="external en_us desktop">
    <head>
      <title>Rocket Careers | Search Results</title>
      <script type="text/javascript">
        var phApp = phApp || {"widgetApiEndpoint":"https://careers.rocket.com/widgets","country":"us","deviceType":"desktop","locale":"en_us","absUrl":true,"refNum":"RCARCAUS","cdnUrl":"https://cdn.phenompeople.com/CareerConnectResources","baseUrl":"https://careers.rocket.com/us/en/","baseDomain":"https://careers.rocket.com","phenomTrackURL":"careers.rocket.com/us/en/phenomtrack.min.js","pageName":"search-results","siteType":"external","rootDomain":"https://careers.rocket.com","pageId":"page34"};
        phApp.ddo = {"eagerLoadRefineSearch":{"totalHits":2,"hits":2,"data":{"jobs":[{"reqId":"R-082857","jobId":"R-082857","title":"Real Estate Associate Agent (1099) - Tulsa","cityStateCountry":"Oklahoma City, Oklahoma, United States of America","country":"United States of America","category":"Associate Agent - Independent Contractor","type":"Full time","postedDate":"2026-05-05T00:00:00.000+0000","descriptionTeaser":"Show homes, host open houses, attend inspections.","applyUrl":"https://quickenloans.wd5.myworkdayjobs.com/rocket_careers/job/Oklahoma---2000-North-Classen-Blvd/Real-Estate-Associate-Agent--1099----Tulsa_R-082857/apply","ml_skills":["real estate","sales"]},{"reqId":"R-082336","jobId":"R-082336","title":"Executive Loan Officer (Savannah, GA)","cityStateCountry":"Remote, Georgia, United States of America","country":"United States of America","category":"Sales","type":"Full time","postedDate":"2026-04-28T00:00:00.000+0000","descriptionTeaser":"As an Executive Loan Officer, you’ll be the face of Rocket Mortgage to clients in your local community.","applyUrl":"https://quickenloans.wd5.myworkdayjobs.com/rocket_careers/job/Remote---Georgia/Executive-Loan-Officer--Savannah--GA-_R-082336/apply","ml_skills":["mortgage","client service"]}],"aggregations":[]}}};
      </script>
    </head>
    <body></body>
  </html>
`

test('buildSearchResultsPageUrl keeps Rocket listings on the official Phenom search route', async () => {
  const rocketIndia = await loadRocketIndiaModule()
  assert.ok(rocketIndia)

  assert.equal(
    rocketIndia.buildSearchResultsPageUrl(),
    'https://careers.rocket.com/in/en/search-results',
  )
  assert.equal(
    rocketIndia.buildSearchResultsPageUrl(10),
    'https://careers.rocket.com/in/en/search-results?from=10',
  )
})

test('extractSearchPayload reads Rocket embedded Phenom search payloads', async () => {
  const rocketIndia = await loadRocketIndiaModule()
  assert.ok(rocketIndia)

  const payload = rocketIndia.extractSearchPayload(searchResultsHtml)

  assert.equal(payload.widgetApiEndpoint, 'https://careers.rocket.com/widgets')
  assert.equal(payload.totalHits, 2)
  assert.equal(payload.hits, 2)
  assert.equal(payload.jobs.length, 2)
  assert.equal(payload.jobs[0].reqId, 'R-082857')
})

test('run returns no jobs when Rocket public listings do not include India', async () => {
  const rocketIndia = await loadRocketIndiaModule()
  assert.ok(rocketIndia)

  const requestedUrls = []
  const jobs = await rocketIndia.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return searchResultsHtml
    },
  })

  assert.deepEqual(requestedUrls, ['https://careers.rocket.com/in/en/search-results'])
  assert.deepEqual(jobs, [])
})
