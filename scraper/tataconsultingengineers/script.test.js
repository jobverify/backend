import assert from 'node:assert/strict'
import test from 'node:test'

const loadTceModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Tata Consulting Engineers scraper module at ./script.js')
  }
}

const searchPage1Html = `
<!doctype html>
<html>
  <body>
    <span id="tile-search-results-label">Showing 1 to 25 of 47 Jobs</span>
    <ul id="job-tile-list" data-per-page="25" data-record-returned="25">
      <li class="job-tile job-id-57744744" data-url="/ecofirst/job/Navi-Mumbai-Environment-Expert-C2-Environment-Design-Engineering-MH-400708/57744744/">
        <div class="tiletitle">
          <a class="jobTitle-link fontcolordce4d35b866e67be" href="/ecofirst/job/Navi-Mumbai-Environment-Expert-C2-Environment-Design-Engineering-MH-400708/57744744/">
            Environment Expert-C2-Environment-Design Engineering
          </a>
        </div>
        <div class="section-field location">
          <span class="section-label">Location</span>
          <div>Navi Mumbai, MH, IN, 400708</div>
        </div>
        <div class="section-field customfield1">
          <span class="section-label">Sector</span>
          <div>Common</div>
        </div>
        <div class="section-field dept">
          <span class="section-label">Department</span>
          <div>Environment</div>
        </div>
      </li>
      <li class="job-tile job-id-57523844" data-url="/job/Pune-Construction-Engineer-E4-Safety-Construction-Engineering-MH-411021/57523844/">
        <div class="tiletitle">
          <a class="jobTitle-link fontcolordce4d35b866e67be" href="/job/Pune-Construction-Engineer-E4-Safety-Construction-Engineering-MH-411021/57523844/">
            Construction Engineer-E4-Safety-Construction Engineering
          </a>
        </div>
        <div class="section-field location">
          <span class="section-label">Location</span>
          <div>Pune, MH, IN, 411021</div>
        </div>
        <div class="section-field customfield1">
          <span class="section-label">Sector</span>
          <div>Common</div>
        </div>
        <div class="section-field dept">
          <span class="section-label">Department</span>
          <div>Safety</div>
        </div>
      </li>
    </ul>
    <script>
      j2w.SearchResults.init({
        jobRecordsPerPage: parseInt("25"),
        jobRecordsFound: parseInt("47")
      });
    </script>
  </body>
</html>
`

const searchPage2Html = `
<!doctype html>
<html>
  <body>
    <span id="tile-search-results-label">Showing 26 to 47 of 47 Jobs</span>
    <ul id="job-tile-list" data-per-page="25" data-record-returned="22">
      <li class="job-tile job-id-57070944" data-url="/job/Pune-Site-Manager-Mechanical-MH-411021/57070944/">
        <div class="tiletitle">
          <a class="jobTitle-link fontcolordce4d35b866e67be" href="/job/Pune-Site-Manager-Mechanical-MH-411021/57070944/">
            Site Manager-Mechanical
          </a>
        </div>
        <div class="section-field location">
          <span class="section-label">Location</span>
          <div>Pune, MH, IN, 411021</div>
        </div>
        <div class="section-field customfield1">
          <span class="section-label">Sector</span>
          <div>Construction - West</div>
        </div>
        <div class="section-field dept">
          <span class="section-label">Department</span>
          <div>Mechanical</div>
        </div>
      </li>
    </ul>
    <script>
      j2w.SearchResults.init({
        jobRecordsPerPage: parseInt("25"),
        jobRecordsFound: parseInt("47")
      });
    </script>
  </body>
</html>
`

const detailPage1Html = `
<!doctype html>
<html>
  <body>
    <div class="jobDisplayShell" itemscope="itemscope" itemtype="http://schema.org/JobPosting">
      <meta itemprop="addressLocality" content="Pune" />
      <meta itemprop="datePosted" content="Thu Jul 02 00:00:00 UTC 2026" />
      <meta itemprop="validThrough" content="Fri Aug 14 18:30:00 UTC 2026" />
      <h1 id="job-title" itemprop="title">Construction Engineer-E4-Safety-Construction Engineering</h1>
      <div class="applylink pull-right">
        <a class="btn btn-primary btn-large btn-lg apply dialogApplyBtn " href="/talentcommunity/apply/57523844/?locale=en_GB">Apply now</a>
      </div>
      <p id="job-location">
        <span class="jobGeoLocation">Pune, MH, IN, 411021</span>
      </p>
      <span itemprop="description" class="jobdescription">
        <div>
          <div><h2>Purpose &amp; Scope of Position</h2></div>
          <div>The Construction Engineer is responsible for overseeing and coordinating project works contractors.</div>
        </div>
        <div>
          <div><h2>Experience</h2></div>
          <div>Minimum 5 - 10 years of onsite experience on major projects.</div>
        </div>
      </span>
    </div>
  </body>
</html>
`

const detailPage2Html = `
<!doctype html>
<html>
  <body>
    <div class="jobDisplayShell" itemscope="itemscope" itemtype="http://schema.org/JobPosting">
      <meta itemprop="addressLocality" content="Pune" />
      <meta itemprop="datePosted" content="Thu Jun 19 00:00:00 UTC 2026" />
      <h1 id="job-title" itemprop="title">Site Manager-Mechanical</h1>
      <div class="applylink pull-right">
        <a class="btn btn-primary btn-large btn-lg apply dialogApplyBtn " href="/talentcommunity/apply/57070944/?locale=en_GB">Apply now</a>
      </div>
      <p id="job-location">
        <span class="jobGeoLocation">Pune, MH, IN, 411021</span>
      </p>
      <span itemprop="description" class="jobdescription">
        <div>Lead site execution for mechanical packages.</div>
      </span>
    </div>
  </body>
</html>
`

test('buildSearchUrl keeps Tata Consulting Engineers on the official public SuccessFactors search route', async () => {
  const { buildSearchUrl } = await loadTceModule()

  assert.equal(
    buildSearchUrl(),
    'https://careers.tataconsultingengineers.com/search/?q=&sortColumn=referencedate&sortDirection=desc',
  )
  assert.equal(
    buildSearchUrl(25),
    'https://careers.tataconsultingengineers.com/search/?q=&sortColumn=referencedate&sortDirection=desc&startrow=25',
  )
})

test('extractSearchResults keeps Tata Consulting Engineers jobs and filters the separate EcoFirst route', async () => {
  const { extractSearchResults, hasOfficialSearchResultsSignal } = await loadTceModule()

  assert.equal(hasOfficialSearchResultsSignal(searchPage1Html), true)

  const jobs = extractSearchResults(searchPage1Html)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Construction Engineer-E4-Safety-Construction Engineering',
    department: 'Safety',
    sector: 'Common',
    location: 'Pune, MH, IN, 411021',
    city: 'Pune',
    jobId: '57523844',
    requisitionId: '57523844',
    sourceUrl: 'https://careers.tataconsultingengineers.com/job/Pune-Construction-Engineer-E4-Safety-Construction-Engineering-MH-411021/57523844/',
    postingDate: null,
  })
})

test('extractResultsSummary reads the Tata Consulting Engineers job count from the public search page', async () => {
  const { extractResultsSummary } = await loadTceModule()

  assert.deepEqual(extractResultsSummary(searchPage1Html), {
    totalResults: 47,
    pageSize: 25,
    startRow: 0,
    endRow: 25,
  })
  assert.deepEqual(extractResultsSummary(searchPage2Html), {
    totalResults: 47,
    pageSize: 25,
    startRow: 25,
    endRow: 47,
  })
})

test('extractJobDetail reads the public apply link and detail metadata from Tata Consulting Engineers job pages', async () => {
  const { extractJobDetail } = await loadTceModule()
  const detail = extractJobDetail(detailPage1Html, {
    title: 'Construction Engineer-E4-Safety-Construction Engineering',
    department: 'Safety',
    sector: 'Construction - West',
    location: 'Pune, MH, IN, 411021',
    city: 'Pune',
    jobId: '57523844',
    requisitionId: '57523844',
    sourceUrl: 'https://careers.tataconsultingengineers.com/job/Pune-Construction-Engineer-E4-Safety-Construction-Engineering-MH-411021/57523844/',
    postingDate: null,
  })

  assert.deepEqual(detail, {
    title: 'Construction Engineer-E4-Safety-Construction Engineering',
    department: 'Safety',
    sector: 'Construction - West',
    location: 'Pune, MH, IN, 411021',
    city: 'Pune',
    jobId: '57523844',
    requisitionId: '57523844',
    employmentType: null,
    experienceRequired: 'Minimum 5 - 10 years of onsite experience on major projects.',
    jobDescription: 'Purpose & Scope of Position The Construction Engineer is responsible for overseeing and coordinating project works contractors. Experience Minimum 5 - 10 years of onsite experience on major projects.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-02',
    closingDate: '2026-08-14',
    applyUrl: 'https://careers.tataconsultingengineers.com/talentcommunity/apply/57523844/?locale=en_GB',
    sourceUrl: 'https://careers.tataconsultingengineers.com/job/Pune-Construction-Engineer-E4-Safety-Construction-Engineering-MH-411021/57523844/',
  })
})

test('run paginates Tata Consulting Engineers official search results and excludes EcoFirst jobs from final output', async () => {
  const tce = await loadTceModule()
  const requestedUrls = []

  const jobs = await tce.createTceScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === tce.buildSearchUrl()) return searchPage1Html
      if (url === tce.buildSearchUrl(25)) return searchPage2Html
      if (url === 'https://careers.tataconsultingengineers.com/job/Pune-Construction-Engineer-E4-Safety-Construction-Engineering-MH-411021/57523844/') {
        return detailPage1Html
      }
      if (url === 'https://careers.tataconsultingengineers.com/job/Pune-Site-Manager-Mechanical-MH-411021/57070944/') {
        return detailPage2Html
      }

      throw new Error(`Unexpected Tata Consulting Engineers URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://careers.tataconsultingengineers.com/search/?q=&sortColumn=referencedate&sortDirection=desc',
    'https://careers.tataconsultingengineers.com/job/Pune-Construction-Engineer-E4-Safety-Construction-Engineering-MH-411021/57523844/',
    'https://careers.tataconsultingengineers.com/search/?q=&sortColumn=referencedate&sortDirection=desc&startrow=25',
    'https://careers.tataconsultingengineers.com/job/Pune-Site-Manager-Mechanical-MH-411021/57070944/',
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      jobId: job.jobId,
      requisitionId: job.requisitionId,
      title: job.title,
      company: job.company,
      department: job.department,
      location: job.location,
      city: job.city,
      source: job.source,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      link: job.link,
      postingDate: job.postingDate,
    })),
    [
      {
        jobId: '57523844',
        requisitionId: '57523844',
        title: 'Construction Engineer-E4-Safety-Construction Engineering',
        company: 'Tata Consulting Engineers Limited',
        department: 'Safety',
        location: 'Pune, MH, IN, 411021',
        city: 'Pune',
        source: 'tataconsultingengineers',
        sourceUrl: 'https://careers.tataconsultingengineers.com/job/Pune-Construction-Engineer-E4-Safety-Construction-Engineering-MH-411021/57523844/',
        applyUrl: 'https://careers.tataconsultingengineers.com/talentcommunity/apply/57523844/?locale=en_GB',
        link: 'https://careers.tataconsultingengineers.com/talentcommunity/apply/57523844/?locale=en_GB',
        postingDate: '2026-07-02',
      },
      {
        jobId: '57070944',
        requisitionId: '57070944',
        title: 'Site Manager-Mechanical',
        company: 'Tata Consulting Engineers Limited',
        department: 'Mechanical',
        location: 'Pune, MH, IN, 411021',
        city: 'Pune',
        source: 'tataconsultingengineers',
        sourceUrl: 'https://careers.tataconsultingengineers.com/job/Pune-Site-Manager-Mechanical-MH-411021/57070944/',
        applyUrl: 'https://careers.tataconsultingengineers.com/talentcommunity/apply/57070944/?locale=en_GB',
        link: 'https://careers.tataconsultingengineers.com/talentcommunity/apply/57070944/?locale=en_GB',
        postingDate: '2026-06-19',
      },
    ],
  )
  assert.match(jobs[0].scrapedAt, /\d{4}-\d{2}-\d{2}T/)
  assert.match(jobs[1].scrapedAt, /\d{4}-\d{2}-\d{2}T/)
})
