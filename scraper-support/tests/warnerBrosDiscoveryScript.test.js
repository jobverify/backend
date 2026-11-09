import assert from 'node:assert/strict'
import test from 'node:test'

const loadWbdModule = async () => {
  try {
    return await import('../../scraper/warnerbrosdiscovery/script.js')
  } catch {
    assert.fail('Expected Warner Bros. Discovery scraper module at ../../scraper/warnerbrosdiscovery/script.js')
  }
}

const searchHtml = `<html><body><script>phApp.ddo = ${JSON.stringify({
  siteConfig: { data: { widgetApiEndpoint: 'https://careers.wbd.com/widgets' } },
  eagerLoadRefineSearch: {
    totalHits: 2,
    hits: 2,
    data: {
      jobs: [
        {
          reqId: 'R000104134',
          jobId: 'R000104134',
          title: 'Data Platform Administrator',
          cityStateCountry: 'Hyderabad, Telangana, India',
          city: 'Hyderabad',
          country: 'India',
          category: 'Technology',
          type: 'Full time',
          postedDate: '2026-07-09',
          descriptionTeaser: 'Support the enterprise data platform.',
        },
        {
          reqId: 'R000104999',
          jobId: 'R000104999',
          title: 'Finance Systems Analyst',
          cityStateCountry: 'Atlanta, Georgia, United States',
          city: 'Atlanta',
          country: 'United States',
          category: 'Finance',
          type: 'Full time',
          postedDate: '2026-07-08',
          descriptionTeaser: 'Support US finance systems.',
        },
      ],
      aggregations: [
        { field: 'country', value: { India: 55, 'United States': 320 } },
      ],
    },
  },
})};</script></body></html>`

const detailHtml = `<html><head><script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'JobPosting',
  title: 'Data Platform Administrator',
  description: '<p>Lead platform administration for WBD data systems.</p><p><strong>Required Skills</strong></p><ul><li>Snowflake administration</li><li>Data platform operations</li></ul>',
  datePosted: '2026-07-09',
  employmentType: 'FULL_TIME',
  jobLocation: {
    '@type': 'Place',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Hyderabad',
      addressRegion: 'Telangana',
      addressCountry: 'India',
    },
  },
})}</script></head><body><script>phApp.ddo = ${JSON.stringify({
  jobDetail: {
    data: {
      job: {
        jobId: 'R000104134',
        reqId: 'R000104134',
        title: 'Data Platform Administrator',
        category: 'Technology',
        ml_country: 'India',
        applyUrl: 'https://warnerbros.wd5.myworkdayjobs.com/global/job/Hyderabad-Office-Level-3--4-Block-A---East-Wing/Data-Platform-Administrator_R000104134/apply',
      },
    },
  },
})};</script></body></html>`

test('buildSearchResultsPageUrl keeps Warner Bros. Discovery listings on the official Phenom search route', async () => {
  const { buildSearchResultsPageUrl } = await loadWbdModule()

  assert.equal(
    buildSearchResultsPageUrl(),
    'https://careers.wbd.com/global/en/search-results',
  )
  assert.equal(
    buildSearchResultsPageUrl(10),
    'https://careers.wbd.com/global/en/search-results?from=10',
  )
})

test('run keeps Warner Bros. Discovery jobs on the official Phenom route and filters to India listings', async () => {
  const {
    buildSearchResultsPageUrl,
    run,
  } = await loadWbdModule()
  const requestedUrls = []

  const jobs = await run({
    maxPages: 1,
    maxJobs: 1,
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === buildSearchResultsPageUrl()) return searchHtml
      if (url === 'https://careers.wbd.com/global/en/job/R000104134/Data-Platform-Administrator') {
        return detailHtml
      }
      throw new Error(`Unexpected WBD fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    buildSearchResultsPageUrl(),
    'https://careers.wbd.com/global/en/job/R000104134/Data-Platform-Administrator',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Warner Bros. Discovery')
  assert.equal(jobs[0].source, 'warnerbrosdiscovery')
  assert.equal(jobs[0].jobId, 'R000104134')
  assert.equal(jobs[0].city, 'Hyderabad')
  assert.equal(
    jobs[0].applyUrl,
    'https://careers.wbd.com/global/en/job/R000104134/Data-Platform-Administrator',
  )
  assert.equal(jobs[0].sourceUrl, 'https://careers.wbd.com/global/en/job/R000104134/Data-Platform-Administrator')
  assert.equal(jobs[0].link, jobs[0].sourceUrl)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDetailFailureKind, 'identity-mismatch')
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(jobs[0].postingDate, '2026-07-09')
})

test('synthetic WBD agreement model retains only the existing fixture application URL', async () => {
  const { buildSearchResultsPageUrl, run } = await loadWbdModule()
  // This adds model corroboration; it is not an observed current employer/native response.
  const marker = 'phApp.ddo = ', start = detailHtml.indexOf(marker) + marker.length
  const nativeJob = JSON.parse(detailHtml.slice(start, detailHtml.indexOf(';</script>', start))).jobDetail.data.job
  const idMarker = '"reqId":' + JSON.stringify(nativeJob.reqId)
  assert.equal(searchHtml.split(idMarker).length, 2)
  const agreedSearch = searchHtml.replace(idMarker, idMarker + ',"applyUrl":' + JSON.stringify(nativeJob.applyUrl))
  const requestedUrls = []
  const jobs = await run({ maxPages: 1, maxJobs: 1, fetchText: async url => {
    requestedUrls.push(url)
    if (url === buildSearchResultsPageUrl()) return agreedSearch
    if (url === 'https://careers.wbd.com/global/en/job/R000104134/Data-Platform-Administrator') return detailHtml
    assert.fail('Unexpected synthetic WBD URL: ' + url)
  } })
  assert.deepEqual(requestedUrls, [buildSearchResultsPageUrl(), 'https://careers.wbd.com/global/en/job/R000104134/Data-Platform-Administrator'])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Warner Bros. Discovery')
  assert.equal(jobs[0].source, 'warnerbrosdiscovery')
  assert.equal(jobs[0].jobId, 'R000104134')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].city, 'Hyderabad')
  assert.equal(jobs[0].applyUrl, nativeJob.applyUrl)
  assert.equal(jobs[0].applyUrl, 'https://warnerbros.wd5.myworkdayjobs.com/global/job/Hyderabad-Office-Level-3--4-Block-A---East-Wing/Data-Platform-Administrator_R000104134/apply')
  assert.equal(jobs[0].link, nativeJob.applyUrl)
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.match(jobs[0].jobDescription, /Lead platform administration for WBD data systems/)
  assert.equal(jobs[0].postingDate, '2026-07-09')
  assert.ok(jobs[0].nativeEmployer == null)
})
