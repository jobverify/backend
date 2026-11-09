import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | JCB</title>
  </head>
  <body>
    <h1>Welcome to JCB Careers</h1>
    <p>At JCB India we believe that people are our biggest asset.</p>
    <a href="https://career-in.jcb.com/">Apply now</a>
  </body>
</html>
`

const SEARCH_PAGE_ONE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Search results for ""</title>
  </head>
  <body>
    <h1>Search results for ""</h1>
    <p>Results 1 – 2 of 3 Page 1 of 2</p>
    <table id="searchresults">
      <tbody>
        <tr>
          <td><a href="/job/Engineer/1362485666/">Engineer</a></td>
          <td>IN</td>
          <td>8 Jun 2026</td>
        </tr>
        <tr>
          <td><a href="/job/Assistant-Manager/1362392266/">Assistant Manager</a></td>
          <td>IN</td>
          <td>4 Jun 2026</td>
        </tr>
      </tbody>
    </table>
    <a href="/search/?pg=2">2</a>
  </body>
</html>
`

const SEARCH_PAGE_TWO_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Search results for ""</title>
  </head>
  <body>
    <h1>Search results for ""</h1>
    <p>Results 3 – 3 of 3 Page 2 of 2</p>
    <table id="searchresults">
      <tbody>
        <tr>
          <td><a href="/job/Senior-Engineer-MEP/1362485000/">Senior Engineer - MEP</a></td>
          <td>IN</td>
          <td>1 Jun 2026</td>
        </tr>
      </tbody>
    </table>
  </body>
</html>
`

const ENGINEER_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Engineer</title>
  </head>
  <body>
    <h1>Engineer</h1>
    <span class="job-date">Date: 8 Jun 2026</span>
    <span class="job-location">Location: IN</span>
    <p>Responsible for hydraulic systems support, welding process improvements, and technical troubleshooting.</p>
    <p>Job Segment: Hydraulics, MIG Welding, Technical Support, Engineer, Manufacturing, Technology, Engineering</p>
    <a href="/job/Engineer/1362485666/apply">Apply now »</a>
  </body>
</html>
`

const LIVE_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Deputy Manager</title>
  </head>
  <body>
    <h1><span>Deputy Manager</span></h1>
    <p>Location: Jaipur, IN</p>
    <p>Department: Manufacturing</p>
    <p>Support production planning, vendor coordination, and manufacturing process improvements.</p>
    <p>Job Segment: Manufacturing, Production Planning, Vendor Management</p>
    <button type="button">Apply now »</button>
  </body>
</html>
`

const ASSISTANT_MANAGER_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Assistant Manager</title>
  </head>
  <body>
    <h1>Assistant Manager</h1>
    <span class="job-date">Date: 4 Jun 2026</span>
    <span class="job-location">Location: IN</span>
    <p>Support material planning and SAP-backed production coordination for JCB India operations.</p>
    <p>Job Segment: Material Planner, Assistant Manager, ERP, SAP, Supply, Management, Operations, Technology</p>
    <a href="/job/Assistant-Manager/1362392266/apply">Apply now »</a>
  </body>
</html>
`

const SENIOR_ENGINEER_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Senior Engineer - MEP</title>
  </head>
  <body>
    <h1>Senior Engineer - MEP</h1>
    <span class="job-date">Date: 1 Jun 2026</span>
    <span class="job-location">Location: IN</span>
    <p>Lead MEP planning activities across India manufacturing sites.</p>
    <p>Job Segment: Mechanical Engineering, Project Controls, Manufacturing</p>
    <a href="/job/Senior-Engineer-MEP/1362485000/apply">Apply now »</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/jcbindia/script.js')
  } catch {
    assert.fail('Expected JCB India scraper module at ../../scraper/jcbindia/script.js')
  }
}

test('JCB India helpers stay pinned to the verified first-party careers and search surfaces', async () => {
  const jcbIndia = await loadModule()

  assert.equal(jcbIndia.SOURCE, 'jcbindia')
  assert.equal(jcbIndia.COMPANY, 'JCB India')
  assert.equal(
    jcbIndia.CAREERS_PAGE_URL,
    'https://www.jcb.com/en-IN/explore/engage/careers/',
  )
  assert.equal(jcbIndia.JOBS_BOARD_URL, 'https://career-in.jcb.com/')
  assert.equal(jcbIndia.SEARCH_PAGE_URL, 'https://career-in.jcb.com/search/')
  assert.equal(jcbIndia.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.equal(jcbIndia.hasSearchResultsSignal(SEARCH_PAGE_ONE_HTML), true)
  assert.deepEqual(jcbIndia.extractSearchPageUrls(SEARCH_PAGE_ONE_HTML), [
    'https://career-in.jcb.com/search/',
    'https://career-in.jcb.com/search/?pg=2',
  ])
})

test('JCB India extracts first-party search cards and enriches them from detail pages', async () => {
  const jcbIndia = await loadModule()
  const cards = jcbIndia.extractJobCards(SEARCH_PAGE_ONE_HTML)
  const engineer = jcbIndia.extractJobDetail(ENGINEER_DETAIL_HTML, cards[0])

  assert.deepEqual(
    cards.map((card) => ({
      title: card.title,
      detailUrl: card.detailUrl,
      postingDate: card.postingDate,
      country: card.country,
      jobId: card.jobId,
    })),
    [
      {
        title: 'Engineer',
        detailUrl: 'https://career-in.jcb.com/job/Engineer/1362485666/',
        postingDate: '2026-06-08',
        country: 'India',
        jobId: '1362485666',
      },
      {
        title: 'Assistant Manager',
        detailUrl: 'https://career-in.jcb.com/job/Assistant-Manager/1362392266/',
        postingDate: '2026-06-04',
        country: 'India',
        jobId: '1362392266',
      },
    ],
  )

  assert.equal(engineer.title, 'Engineer')
  assert.equal(engineer.company, 'JCB India')
  assert.equal(engineer.location, 'India')
  assert.equal(engineer.country, 'India')
  assert.equal(engineer.jobId, '1362485666')
  assert.equal(engineer.requisitionId, '1362485666')
  assert.equal(engineer.sourceUrl, 'https://career-in.jcb.com/job/Engineer/1362485666/')
  assert.equal(engineer.applyUrl, 'https://career-in.jcb.com/job/Engineer/1362485666/apply')
  assert.match(engineer.jobDescription, /hydraulic systems support/i)
  assert.deepEqual(engineer.requiredSkills, [
    'Hydraulics',
    'MIG Welding',
    'Technical Support',
    'Engineer',
    'Manufacturing',
    'Technology',
    'Engineering',
  ])
})

test('JCB India normalizes live listing locations and falls back to the detail URL when no explicit apply link is present', async () => {
  const jcbIndia = await loadModule()

  const [card] = jcbIndia.extractJobCards(`
    <!doctype html>
    <html lang="en">
      <body>
        <h1>Search results for ""</h1>
        <table id="searchresults">
          <tbody>
            <tr>
              <td><a href="/job/Jaipur-Deputy-Manager-Jaip/1365157066/">Deputy Manager</a></td>
              <td>Jaipur, IN</td>
              <td>31 Jul 2026</td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  `)
  const detail = jcbIndia.extractJobDetail(LIVE_DETAIL_HTML, card)

  assert.equal(card.location, 'Jaipur, India')
  assert.equal(card.country, 'India')
  assert.equal(detail.location, 'Jaipur, India')
  assert.equal(detail.country, 'India')
  assert.equal(detail.applyUrl, 'https://career-in.jcb.com/job/Jaipur-Deputy-Manager-Jaip/1365157066/')
  assert.equal(detail.sourceUrl, 'https://career-in.jcb.com/job/Jaipur-Deputy-Manager-Jaip/1365157066/')
})

test('JCB India run verifies the trusted careers surface before scraping paginated search results and detail pages', async () => {
  const jcbIndia = await loadModule()
  const requestedUrls = []

  const jobs = await jcbIndia.createJcbIndiaScraper({ maxJobs: 3 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === jcbIndia.CAREERS_PAGE_URL) return CAREERS_HTML
      if (url === jcbIndia.SEARCH_PAGE_URL) return SEARCH_PAGE_ONE_HTML
      if (url === 'https://career-in.jcb.com/search/?pg=2') return SEARCH_PAGE_TWO_HTML
      if (url === 'https://career-in.jcb.com/job/Engineer/1362485666/') return ENGINEER_DETAIL_HTML
      if (url === 'https://career-in.jcb.com/job/Assistant-Manager/1362392266/') {
        return ASSISTANT_MANAGER_DETAIL_HTML
      }
      if (url === 'https://career-in.jcb.com/job/Senior-Engineer-MEP/1362485000/') {
        return SENIOR_ENGINEER_DETAIL_HTML
      }

      throw new Error(`Unexpected JCB India URL: ${url}`)
    },
    now: () => '2026-07-16T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    'https://www.jcb.com/en-IN/explore/engage/careers/',
    'https://career-in.jcb.com/search/',
    'https://career-in.jcb.com/search/?pg=2',
    'https://career-in.jcb.com/job/Assistant-Manager/1362392266/',
    'https://career-in.jcb.com/job/Engineer/1362485666/',
    'https://career-in.jcb.com/job/Senior-Engineer-MEP/1362485000/',
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'jcbindia')
  assert.equal(jobs[0].scrapedAt, '2026-07-16T00:00:00.000Z')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.deepEqual(
    jobs.map((job) => job.title),
    ['Assistant Manager', 'Engineer', 'Senior Engineer - MEP'],
  )
})

test('JCB India fails closed when the verified search results surface drifts materially', async () => {
  const jcbIndia = await loadModule()

  await assert.rejects(
    jcbIndia.createJcbIndiaScraper().run({
      fetchText: async (url) => {
        if (url === jcbIndia.CAREERS_PAGE_URL) return CAREERS_HTML
        if (url === jcbIndia.SEARCH_PAGE_URL) {
          return '<html><body><h1>Search</h1><p>No results available.</p></body></html>'
        }
        throw new Error(`Unexpected JCB India URL: ${url}`)
      },
    }),
    /verified JCB India search results page/i,
  )
})
