import assert from 'node:assert/strict'
import test from 'node:test'

const loadZfModule = async () => {
  try {
    return await import('../../scraper/zf/script.js')
  } catch {
    assert.fail('Expected ZF scraper module at ../../scraper/zf/script.js')
  }
}

const listingHtml = `
  <html>
    <body>
      <span class="paginationLabel">1 - 1 of 1 jobs</span>
      <span class="srHelp">Page 1 of 1</span>
      <table>
        <tr class="data-row">
          <td class="colTitle">
            <a class="jobTitle-link" href="/job/Pune-Senior-Software-Engineer/123456789/">
              Senior Software Engineer
            </a>
          </td>
          <td class="colLocation">
            <span class="jobLocation">Pune, Maharashtra, India</span>
          </td>
        </tr>
      </table>
    </body>
  </html>
`

const detailHtml = `
  <html>
    <body>
      <h1 itemprop="title">Senior Software Engineer</h1>
      <span itemprop="description">
        <p>Build connected mobility software for ZF engineering teams.</p>
        <ul>
          <li>Node.js</li>
          <li>REST APIs</li>
        </ul>
      </span>
      <meta itemprop="datePosted" content="2026-07-01" />
      <meta itemprop="validThrough" content="2026-07-31" />
      <meta itemprop="addressLocality" content="Pune" />
      <a
        class="btn btn-primary btn-large btn-lg apply dialogApplyBtn "
        href="/talentcommunity/apply/123456789/?locale=en_US"
      >
        Apply
      </a>
    </body>
  </html>
`

test('ZF pins the scraper to the verified official careers and jobs hosts', async () => {
  const {
    CAREER_PAGE_URL,
    JOBS_URL,
    INDIA_SEARCH_URL,
    buildIndiaSearchUrl,
  } = await loadZfModule()

  assert.equal(CAREER_PAGE_URL, 'https://www.zf.com/mobile/en/careers/careers.html')
  assert.equal(JOBS_URL, 'https://jobs.zf.com')
  assert.equal(
    INDIA_SEARCH_URL,
    'https://jobs.zf.com/search/?createNewAlert=false&q=&locationsearch=India&locale=en_US',
  )
  assert.equal(buildIndiaSearchUrl(), INDIA_SEARCH_URL)
})

test('ZF parses official SuccessFactors India results and decorates shared scraper fields', async () => {
  const {
    buildIndiaSearchUrl,
    run,
  } = await loadZfModule()
  const requestedUrls = []

  const jobs = await run({
    maxPages: 1,
    maxJobs: 1,
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === buildIndiaSearchUrl()) return listingHtml
      if (url === 'https://jobs.zf.com/job/Pune-Senior-Software-Engineer/123456789/') {
        return detailHtml
      }
      throw new Error(`Unexpected ZF URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://jobs.zf.com/search/?createNewAlert=false&q=&locationsearch=India&locale=en_US',
    'https://jobs.zf.com/job/Pune-Senior-Software-Engineer/123456789/',
  ])
  assert.equal(jobs.length, 1)
  assert.deepEqual(
    {
      jobId: jobs[0].jobId,
      requisitionId: jobs[0].requisitionId,
      title: jobs[0].title,
      company: jobs[0].company,
      location: jobs[0].location,
      city: jobs[0].city,
      source: jobs[0].source,
      sourceUrl: jobs[0].sourceUrl,
      applyUrl: jobs[0].applyUrl,
      employmentType: jobs[0].employmentType,
      postingDate: jobs[0].postingDate,
      closingDate: jobs[0].closingDate,
      requiredSkills: jobs[0].requiredSkills,
    },
    {
      jobId: '123456789',
      requisitionId: '123456789',
      title: 'Senior Software Engineer',
      company: 'ZF Group',
      location: 'Pune, Maharashtra, India',
      city: 'Pune',
      source: 'zf',
      sourceUrl: 'https://jobs.zf.com/job/Pune-Senior-Software-Engineer/123456789/',
      applyUrl: 'https://jobs.zf.com/talentcommunity/apply/123456789/?locale=en_US',
      employmentType: 'Full-time',
      postingDate: '2026-07-01',
      closingDate: '2026-07-31',
      requiredSkills: ['Node.js', 'REST APIs'],
    },
  )
  assert.match(
    jobs[0].jobDescription,
    /build connected mobility software for zf engineering teams/i,
  )
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})
