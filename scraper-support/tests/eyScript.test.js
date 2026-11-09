import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadEyModule = async () => {
  try {
    return await import('../../scraper/ey/script.js')
  } catch {
    assert.fail('Expected EY scraper module at ../../scraper/scraper/ey/script.js')
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'ey',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('buildIndiaSearchUrl keeps EY listings on the official India search route', async () => {
  const { buildIndiaSearchUrl } = await loadEyModule()

  assert.equal(
    buildIndiaSearchUrl(),
    'https://careers.ey.com/ey/search/?createNewAlert=false&q=&locationsearch=India&optionsFacetsDD_country=&optionsFacetsDD_customfield1=&locale=en_US',
  )
  assert.equal(
    buildIndiaSearchUrl(25),
    'https://careers.ey.com/ey/search/?createNewAlert=false&q=&locationsearch=India&optionsFacetsDD_country=&optionsFacetsDD_customfield1=&locale=en_US&startrow=25',
  )
})

test('extractSearchResults parses EY India search rows into shared scraper fields', async () => {
  const { extractSearchResults } = await loadEyModule()
  const html = readFixture('india-search.html')
  const jobs = extractSearchResults(html)

  assert.equal(jobs.length, 25)
  assert.deepEqual(jobs[0], {
    title: 'FAAS-Senior-ECRA-Gaap Conversion',
    location: 'Kolkata, WB, IN, 700091',
    city: 'Kolkata',
    jobId: '1400220833',
    requisitionId: '1400220833',
    sourceUrl: 'https://careers.ey.com/ey/job/Kolkata-FAAS-Senior-ECRA-Gaap-Conversion-WB-700091/1400220833/',
    postingDate: null,
  })
  assert.equal(jobs[4].city, 'Bengaluru')
})

test('extractResultsSummary reads EY total result and page counts from the India listing chrome', async () => {
  const { extractResultsSummary } = await loadEyModule()
  const html = readFixture('india-search.html')

  assert.deepEqual(extractResultsSummary(html), {
    totalResults: 2839,
    currentPage: 1,
    totalPages: 114,
    pageSize: 25,
  })
})

test('extractJobDetail pulls EY apply URL, description, and schema dates from the detail page', async () => {
  const { extractJobDetail } = await loadEyModule()
  const html = readFixture('job-detail-1400220833.html')
  const detail = extractJobDetail(html, {
    sourceUrl: 'https://careers.ey.com/ey/job/Kolkata-FAAS-Senior-ECRA-Gaap-Conversion-WB-700091/1400220833/',
    title: 'FAAS-Senior-ECRA-Gaap Conversion',
    location: 'Kolkata, WB, IN, 700091',
    city: 'Kolkata',
    jobId: '1400220833',
    requisitionId: '1400220833',
  })

  assert.equal(detail.title, 'FAAS-Senior-ECRA-Gaap Conversion')
  assert.equal(detail.location, 'Kolkata, WB, IN, 700091')
  assert.equal(detail.city, 'Kolkata')
  assert.equal(detail.jobId, '1400220833')
  assert.equal(detail.requisitionId, '1400220833')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.postingDate, 'Wed Jun 03 00:00:00 UTC 2026')
  assert.equal(detail.closingDate, 'Tue Jun 30 18:30:00 UTC 2026')
  assert.equal(
    detail.applyUrl,
    'https://careers.ey.com/talentcommunity/apply/1400220833/?locale=en_US',
  )
  assert.match(detail.jobDescription, /shape your future with confidence/i)
  assert.match(detail.jobDescription, /Global Delivery Services/i)
  assert.ok(Array.isArray(detail.requiredSkills))
  assert.ok(detail.requiredSkills.includes('Manage quality of service delivery'))
})

test('extractJobDetail derives EY experienceRequired from official detail descriptions', async () => {
  const { extractJobDetail } = await loadEyModule()
  const html = `
    <html>
      <body>
        <span itemprop="title">Guidewire Digital-Staff</span>
        <span itemprop="description">
          <p>At EY, we're all in to shape your future with confidence.</p>
          <p>GW Experience - Minimum 3 years Experience in JUTRO framework (Mandatory)</p>
          <p>Non Guidewire Exp: Frontend technologies : ReactJs (Mandatory)</p>
        </span>
        <a class="btn btn-primary btn-large btn-lg apply dialogApplyBtn " href="/talentcommunity/apply/1401647333/?locale=en_US">Apply</a>
        <meta itemprop="datePosted" content="Fri Jul 31 00:00:00 UTC 2026" />
      </body>
    </html>
  `

  const detail = extractJobDetail(html, {
    sourceUrl: 'https://careers.ey.com/ey/job/Bengaluru-Guidewire-Digital-Staff-KA-560016/1401647333/',
    title: 'Guidewire Digital-Staff',
    location: 'Bengaluru, KA, IN, 560016',
    city: 'Bengaluru',
    jobId: '1401647333',
    requisitionId: '1401647333',
  })

  assert.equal(detail.experienceRequired, '3+ years')
})

test('extractJobDetail keeps the full EY nested jobdescription block instead of truncating at the first inner span', async () => {
  const { extractJobDetail } = await loadEyModule()
  const html = `
    <html>
      <body>
        <div class="joblayouttoken rtltextaligneligible displayDTM ">
          <div class="inner">
            <div class="row">
              <div class="col-xs-12 fontalign-left">
                <span xml:lang="en-US" lang="en-US" itemprop="description" data-careersite-propertyid="description" class="rtltextaligneligible">
                  <span class="jobdescription">
                    <p><span style="font-family:Arial"><span style="font-size:11px">At EY, you’ll have the chance to build a career as unique as you are.</span></span></p>
                    <p><strong><span style="font-family:arial;font-size:10pt">To qualify for the role, you must have</span></strong></p>
                    <ul>
                      <li><span style="font-family:arial;font-size:10pt">Experienced resource – preferably 3-6 years</span></li>
                      <li><span style="font-family:arial;font-size:10pt">Experience in actuarial reserving and modelling software</span></li>
                    </ul>
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
        <a class="btn btn-primary btn-large btn-lg apply dialogApplyBtn " href="/talentcommunity/apply/1417728833/?locale=en_US">Apply</a>
        <meta itemprop="datePosted" content="Fri Jul 31 00:00:00 UTC 2026" />
      </body>
    </html>
  `

  const detail = extractJobDetail(html, {
    sourceUrl: 'https://careers.ey.com/ey/job/Noida-FS-RC-Actuarial-Investments-Agenda-Senior-UP-201301/1417728833/',
    title: 'FS-RC-Actuarial-Investments Agenda-Senior',
    location: 'Noida, UP, IN, 201301',
    city: 'Noida',
    jobId: '1417728833',
    requisitionId: '1417728833',
  })

  assert.match(detail.jobDescription, /To qualify for the role, you must have/i)
  assert.equal(detail.experienceRequired, '3-6 years')
})

test('run keeps EY jobs on the public India search route and decorates shared runner fields', async () => {
  const {
    buildIndiaSearchUrl,
    createEyScraper,
  } = await loadEyModule()
  const scraper = createEyScraper()
  const listingHtml = readFixture('india-search.html')
  const detailHtml = readFixture('job-detail-1400220833.html')
  const requestedUrls = []

  const jobs = await scraper.run({
    maxPages: 1,
    maxJobs: 1,
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === buildIndiaSearchUrl()) return listingHtml
      if (url === 'https://careers.ey.com/ey/job/Kolkata-FAAS-Senior-ECRA-Gaap-Conversion-WB-700091/1400220833/') {
        return detailHtml
      }
      throw new Error(`Unexpected EY URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    buildIndiaSearchUrl(),
    'https://careers.ey.com/ey/job/Kolkata-FAAS-Senior-ECRA-Gaap-Conversion-WB-700091/1400220833/',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'EY')
  assert.equal(jobs[0].source, 'ey')
  assert.equal(
    jobs[0].applyUrl,
    'https://careers.ey.com/talentcommunity/apply/1400220833/?locale=en_US',
  )
  assert.equal(
    jobs[0].sourceUrl,
    'https://careers.ey.com/ey/job/Kolkata-FAAS-Senior-ECRA-Gaap-Conversion-WB-700091/1400220833/',
  )
})

test('run overlaps EY detail fetches so India batches do not time out sequentially', async () => {
  const {
    buildIndiaSearchUrl,
    createEyScraper,
    extractSearchResults,
  } = await loadEyModule()
  const scraper = createEyScraper()
  const listingHtml = readFixture('india-search.html')
  const baseDetailHtml = readFixture('job-detail-1400220833.html')
  const listings = extractSearchResults(listingHtml).slice(0, 2)
  const detailByUrl = new Map([
    [listings[0].sourceUrl, baseDetailHtml],
    [listings[1].sourceUrl, baseDetailHtml.replace(/1400220833/g, listings[1].jobId)],
  ])
  let activeDetails = 0
  let maxActiveDetails = 0

  const jobs = await scraper.run({
    maxPages: 1,
    maxJobs: 2,
    fetchText: async (url) => {
      if (url === buildIndiaSearchUrl()) return listingHtml
      if (detailByUrl.has(url)) {
        activeDetails += 1
        maxActiveDetails = Math.max(maxActiveDetails, activeDetails)
        await new Promise((resolve) => setTimeout(resolve, 20))
        activeDetails -= 1
        return detailByUrl.get(url)
      }
      throw new Error(`Unexpected EY URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 2)
  assert.ok(maxActiveDetails > 1, `expected overlapping detail fetches, saw max concurrency ${maxActiveDetails}`)
})
