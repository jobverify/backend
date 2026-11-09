import assert from 'node:assert/strict'
import test from 'node:test'

const loadAvayaIndiaModule = async () => {
  try {
    return await import('../../scraper/avayaindia/script.js')
  } catch {
    assert.fail('Expected Avaya India scraper module at ../../scraper/avayaindia/script.js')
  }
}

const searchPageHtml = `
<!doctype html>
<html>
  <body>
    <h1>Avaya Jobs</h1>
    <div class="pagination-label-row">
      <span class="paginationLabel">Results <b>1 - 1</b> of <b>1</b></span>
      <span class="srHelp">Page 1 of 1</span>
    </div>
    <table id="searchresults">
      <tbody>
        <tr class="data-row">
          <td class="colTitle">
            <a href="/job/Pune-Sales-Enablement-Specialist-MH/1392094633/" class="jobTitle-link">Sales Enablement Specialist</a>
          </td>
          <td class="colLocation">
            <span class="jobLocation"><span>Pune, IN</span></span>
          </td>
          <td class="colDate">
            <span class="jobDate">14 Jul 2026</span>
          </td>
        </tr>
      </tbody>
    </table>
    <p>Avaya careers</p>
  </body>
</html>
`

const detailPageHtml = `
<!doctype html>
<html>
  <body>
    <div class="jobDisplayShell" itemscope="itemscope" itemtype="http://schema.org/JobPosting">
      <meta itemprop="datePosted" content="Tue Jul 14 16:00:00 UTC 2026" />
      <div class="applylink">
        <a class="dialogApplyBtn" href="/talentcommunity/apply/1392094633/?locale=en_US">Apply</a>
      </div>
      <h1>
        <span itemprop="title">Sales Enablement Specialist</span>
      </h1>
      <span class="jobGeoLocation">Pune, IN</span>
      <span itemprop="description">
        <span class="jobdescription">
          <p>Help enable the India sales organization.</p>
          <ul>
            <li>Coordinate programs</li>
            <li>Support stakeholders</li>
          </ul>
        </span>
      </span>
    </div>
  </body>
</html>
`

test('buildSearchUrl stays pinned to the verified public Avaya SuccessFactors search route', async () => {
  const avayaIndia = await loadAvayaIndiaModule()

  assert.equal(
    avayaIndia.SEARCH_PAGE_URL,
    'https://careers.avaya.com/search/?createNewAlert=false&optionsFacetsDD_department=&optionsFacetsDD_location=&optionsFacetsDD_title=&q=',
  )
  assert.equal(
    avayaIndia.buildSearchUrl(),
    'https://careers.avaya.com/search/?createNewAlert=false&optionsFacetsDD_department=&optionsFacetsDD_location=&optionsFacetsDD_title=&q=',
  )
  assert.equal(
    avayaIndia.buildApplyUrl('1392094633'),
    'https://careers.avaya.com/talentcommunity/apply/1392094633/?locale=en_US',
  )
})

test('run validates the official Avaya search page and decorates parsed India jobs', async () => {
  const avayaIndia = await loadAvayaIndiaModule()
  const requests = []

  const jobs = await avayaIndia.createAvayaIndiaScraper().run({
    maxPages: 1,
    fetchText: async (url) => {
      requests.push(url)
      if (url === avayaIndia.SEARCH_PAGE_URL) return searchPageHtml
      if (url === 'https://careers.avaya.com/job/Pune-Sales-Enablement-Specialist-MH/1392094633/') {
        return detailPageHtml
      }

      throw new Error(`Unexpected Avaya URL: ${url}`)
    },
    now: () => '2026-07-14T00:00:00.000Z',
  })

  assert.deepEqual(requests, [
    avayaIndia.SEARCH_PAGE_URL,
    'https://careers.avaya.com/job/Pune-Sales-Enablement-Specialist-MH/1392094633/',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Avaya India')
  assert.equal(jobs[0].source, 'avayaindia')
  assert.equal(jobs[0].jobId, '1392094633')
  assert.equal(
    jobs[0].applyUrl,
    'https://careers.avaya.com/talentcommunity/apply/1392094633/?locale=en_US',
  )
  assert.equal(jobs[0].scrapedAt, '2026-07-14T00:00:00.000Z')
})

test('run fails closed when the verified public Avaya search signal disappears', async () => {
  const avayaIndia = await loadAvayaIndiaModule()

  await assert.rejects(
    avayaIndia.createAvayaIndiaScraper().run({
      fetchText: async () => '<html><body>Unexpected page</body></html>',
    }),
    /official Avaya jobs page/i,
  )
})
