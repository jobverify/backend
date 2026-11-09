import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import https from 'node:https'
import {syncBuiltinESMExports} from 'node:module'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'

const loadTataElectronicsModule = async () => {
  try {
    return await import('../../scraper/tataelectronics/script.js')
  } catch {
    assert.fail('Expected Tata Electronics scraper module at ../../scraper/tataelectronics/script.js')
  }
}

const searchPage1Html = `
<!doctype html>
<html>
  <body>
    <div class="pagination-label-row">
      <span class="paginationLabel" aria-label="Results 1 to 25">Results <b>1 to 25</b> of <b>27</b></span>
      <span class="srHelp">Page 1 of 2</span>
    </div>
    <table id="searchresults">
      <tbody>
        <tr class="data-row">
          <td class="colTitle">
            <span class="jobTitle hidden-phone">
              <a href="/job/Bengaluru-DB-Admin-KA/7038894/" class="jobTitle-link">DB Admin</a>
            </span>
            <span class="jobTitle visible-phone">
              <a href="/job/Bengaluru-DB-Admin-KA/7038894/" class="jobTitle-link">DB Admin</a>
            </span>
          </td>
          <td class="colDepartment"><span class="jobDepartment">Manufacturing IT</span></td>
          <td class="colLocation"><span class="jobLocation">Bengaluru, Karnataka, India</span></td>
          <td class="colDate"><span class="jobDate">Jul 8, 2026</span></td>
        </tr>
      </tbody>
    </table>
  </body>
</html>
`

const searchPage2Html = `
<!doctype html>
<html>
  <body>
    <div class="pagination-label-row">
      <span class="paginationLabel">Results</span>
      <span class="srHelp">Page 2 of 2</span>
    </div>
    <table id="searchresults">
      <tbody>
        <tr class="data-row">
          <td class="colTitle">
            <span class="jobTitle hidden-phone">
              <a href="/job/Hosur-Process-Engineer-TN/7039901/" class="jobTitle-link">Process Engineer</a>
            </span>
          </td>
          <td class="colDepartment"><span class="jobDepartment">Operations</span></td>
          <td class="colLocation"><span class="jobLocation">Hosur, Tamil Nadu, India</span></td>
          <td class="colDate"><span class="jobDate">Jul 7, 2026</span></td>
        </tr>
      </tbody>
    </table>
  </body>
</html>
`

const detailPage1Html = `
<!doctype html>
<html>
  <body>
    <div class="jobDisplayShell" itemscope="itemscope" itemtype="http://schema.org/JobPosting">
      <p id="job-location"><span class="jobGeoLocation">Bengaluru, Karnataka, India</span></p>
      <meta itemprop="datePosted" content="2026-07-08" />
      <meta itemprop="validThrough" content="2026-07-31" />
      <div class="applylink pull-right">
        <a class="btn btn-primary btn-large btn-lg apply dialogApplyBtn " href="/talentcommunity/apply/7038894/?locale=en_GB">Apply now</a>
      </div>
      <div class="joblayouttoken">
        <div class="inner">
          <div class="row">
            <div class="col-xs-12 fontalign-left">
              <h1>
                <span itemprop="title" data-careersite-propertyid="title">DB Admin</span>
              </h1>
            </div>
          </div>
        </div>
      </div>
      <span data-careersite-propertyid="department">Manufacturing IT</span>
      <span data-careersite-propertyid="shifttype">Full-time</span>
      <span itemprop="description" data-careersite-propertyid="description">
        <span class="jobdescription">
          <p>Manage production databases for Tata Electronics plants.</p>
          <ul>
            <li>PostgreSQL administration</li>
            <li>Disaster recovery planning</li>
          </ul>
        </span>
      </span>
    </div>
  </body>
</html>
`

test('buildSearchUrl keeps Tata Electronics listings on the official public jobs2web route', async () => {
  const { buildSearchUrl } = await loadTataElectronicsModule()

  assert.equal(
    buildSearchUrl(),
    'https://careers.tataelectronics.com/search',
  )
  assert.equal(
    buildSearchUrl(25),
    'https://careers.tataelectronics.com/tile-search-results/?q=&sortColumn=referencedate&sortDirection=desc&startrow=25',
  )
})

test('extractSearchResults collapses duplicate Tata Electronics title links into one listing row', async () => {
  const { extractSearchResults } = await loadTataElectronicsModule()
  const jobs = extractSearchResults(searchPage1Html)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'DB Admin',
    department: 'Manufacturing IT',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    jobId: '7038894',
    requisitionId: null,
    sourceUrl: 'https://careers.tataelectronics.com/job/Bengaluru-DB-Admin-KA/7038894/',
    postingDate: 'Jul 8, 2026',
  })
})

test('extractResultsSummary tolerates malformed Tata Electronics page-two summary text', async () => {
  const { extractResultsSummary } = await loadTataElectronicsModule()

  assert.deepEqual(extractResultsSummary(searchPage1Html), {
    totalResults: 27,
    currentPage: 1,
    totalPages: 2,
    pageSize: 25,
  })
  assert.deepEqual(extractResultsSummary(searchPage2Html), {
    totalResults: null,
    currentPage: 2,
    totalPages: 2,
    pageSize: null,
  })
})

test('extractJobDetail reads Tata Electronics apply locale from the detail page instead of synthesizing it', async () => {
  const { extractJobDetail } = await loadTataElectronicsModule()
  const detail = extractJobDetail(detailPage1Html, {
    title: 'DB Admin',
    department: 'Manufacturing IT',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    jobId: '7038894',
    requisitionId: null,
    sourceUrl: 'https://careers.tataelectronics.com/job/Bengaluru-DB-Admin-KA/7038894/',
    postingDate: 'Jul 8, 2026',
  })

  assert.deepEqual(detail, {
    title: 'DB Admin',
    department: 'Manufacturing IT',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    jobId: '7038894',
    requisitionId: null,
    employmentType: 'Full-time',
    experienceRequired: null,
    jobDescription: 'Manage production databases for Tata Electronics plants. - PostgreSQL administration - Disaster recovery planning',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'PostgreSQL administration',
      'Disaster recovery planning',
    ],
    postingDate: '2026-07-08',
    closingDate: '2026-07-31',
    applyUrl: 'https://careers.tataelectronics.com/talentcommunity/apply/7038894/?locale=en_GB',
    sourceUrl: 'https://careers.tataelectronics.com/job/Bengaluru-DB-Admin-KA/7038894/',
  })
})

test('run replays the current Tata Electronics public native GETs before applying the requested cap', async () => {
  const tataElectronics = await loadTataElectronicsModule()
  const capture = JSON.parse(gunzipSync(readFileSync(new URL(
    './fixtures/cariad-tataelectronics-native-20261101.json.gz', import.meta.url,
  ))))
  const entities = new Map(capture.entities.map(entity => [entity.url, entity]))
  const requestedUrls = [], records = [], audits = []
  const observedAt = '2026-11-01T16:45:00.000Z'
  const previous = {fetch: globalThis.fetch, get: https.get, request: https.request}
  const refuse = () => { throw new Error('Tata Electronics replay forbids live HTTP') }
  globalThis.fetch = refuse; https.get = refuse; https.request = refuse
  syncBuiltinESMExports()
  let jobs
  try {
    jobs = await tataElectronics.createTataElectronicsScraper().run({
      maxJobs: 2,
      now: () => observedAt,
      fetchPage: async url => {
        requestedUrls.push(url)
        const entity = entities.get(url)
        assert.ok(entity, 'Unrecorded Tata Electronics public URL: ' + url)
        return {url, status: entity.status, headers: structuredClone(entity.headers), bodyBase64: entity.bodyBase64}
      },
      onRecords: async rows => records.push(rows),
      onAudit: async audit => audits.push(audit),
    })
  } finally {
    globalThis.fetch = previous.fetch; https.get = previous.get; https.request = previous.request
    syncBuiltinESMExports()
  }

  assert.equal(records.length, 1)
  assert.equal(records[0].length, 112, 'the cap must not truncate native own-model observations')
  assert.equal(requestedUrls.filter(url => new URL(url).pathname.startsWith('/job/')).length, 112)
  assert.equal(requestedUrls.filter(url => url === 'https://www.tataelectronics.com/work-with-us').length, 2)
  assert.equal(requestedUrls.filter(url => url === tataElectronics.buildSearchUrl()).length, 2)
  assert.equal(requestedUrls.some(url => url.includes('.stage.jobs2web.com')), false)
  assert.equal(jobs.length, 2)
  for (const job of jobs) {
    assert.equal(job.source, 'tataelectronics')
    assert.equal(job.company, 'TATA Electronics Private Limited')
    assert.equal(job.country, 'India')
    assert.equal(job.requisitionId, null)
    assert.match(job.internalJobId, /^[0-9]+$/)
    assert.ok(job.jobDescription.length > 100)
    assert.equal(new URL(job.sourceUrl).origin, 'https://careers.tataelectronics.com')
    assert.equal(new URL(job.applyUrl).searchParams.get('locale'), 'en_GB')
    assert.equal(new URL(job.applyUrl).pathname, '/talentcommunity/apply/' + job.jobId + '/')
    assert.equal(job.link, job.applyUrl)
    assert.equal(job.scrapedAt, observedAt)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
  }
  assert.equal(jobs[0].jobId, '55450944')
  assert.equal(jobs[0].postingDate, '2026-11-01T02:00:00.000Z')
  assert.equal(jobs[0].closingDate, '2026-12-10T18:30:00.000Z')
  assert.equal(jobs[0].applyUrl, 'https://careers.tataelectronics.com/talentcommunity/apply/55450944/?locale=en_GB')
  assert.equal(audits.length, 1)
  assert.equal(audits[0].opening.rows.length, 112)
  assert.equal(audits[0].closing.rows.length, 112)
  assert.equal(audits[0].ownModelStabilityQualified, false)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
})
