import { registerCurrentRecruitmentContract } from './helpers/currentRecruitmentContract.js'
import assert from 'node:assert/strict'
import test from 'node:test'

import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const VERIFIED_CAREERS_HTML = `
  <html>
    <body>
      <main>
        <h1>Foray Into The</h1>
        <h1>Future.</h1>
        <h2>Join ForaySoft.</h2>
        <p>Become a contributing member of a team of highly skilled professionals, create an impact on the future.</p>
        <h2>Do What</h2>
        <h2>you love.</h2>
        <p>We are looking for passionate individuals who are driven and have a growth mindset.</p>
        <h2>Top Jobs</h2>
        <a href="https://www.foraysoft.com/jobs/c-java-with-fullstack">Java With fullstack View Jobs</a>
        <a href="https://www.foraysoft.com/jobs/c-data-and-analytics-big-data">Data And Analytics (Big Data) View Jobs</a>
        <a href="https://www.foraysoft.com/jobs/c-salesforce">Salesforce View Jobs</a>
        <h3>Hiring talent instead?</h3>
      </main>
    </body>
  </html>
`

const VERIFIED_JOBS_HTML = `
  <html>
    <body>
      <main>
        <h1>Jobs</h1>
        <section>
          <h3><a href="https://www.foraysoft.com/jobs/salesforce-support-engineer-bezons">Salesforce Support Engineer - Bezons</a></h3>
          <p>Apply</p>
          <h3><a href="https://www.foraysoft.com/jobs/tech-java-bezons">Tech Java - Bezons</a></h3>
          <p>Apply</p>
          <h3><a href="https://www.foraysoft.com/jobs/tech-java-developer-atos">Tech Java Developer - Atos</a></h3>
          <p>Apply</p>
          <h3><a href="https://www.foraysoft.com/jobs/senior-qa-automation-tester-atos-syntel">Senior QA Automation Tester - Atos|Syntel</a></h3>
        </section>
        <section>
          <h2><a href="https://www.foraysoft.com/jobs/salesforce-support-engineer-bezons">Salesforce Support Engineer - Bezons</a></h2>
          <p>Posted on 18th Oct 2021 11:26:55 in <a href="https://www.foraysoft.com/jobs/c-salesforce">Salesforce</a></p>
          <p>Read More</p>
          <h2><a href="https://www.foraysoft.com/jobs/tech-java-bezons">Tech Java - Bezons</a></h2>
          <p>Posted on 18th Oct 2021 11:16:09 in <a href="https://www.foraysoft.com/jobs/c-java-with-fullstack">Java With fullstack</a></p>
          <p>Read More</p>
          <h2><a href="https://www.foraysoft.com/jobs/tech-java-developer-atos">Tech Java Developer - Atos</a></h2>
          <p>Posted on 27th Sep 2021 16:37:52 in <a href="https://www.foraysoft.com/jobs/c-java-with-fullstack">Java With fullstack</a></p>
          <p>Read More</p>
        </section>
      </main>
    </body>
  </html>
`

const VERIFIED_JOBS_PAGE_TWO_HTML = `
  <html>
    <body>
      <main>
        <h1>Jobs</h1>
        <section>
          <h3><a href="https://www.foraysoft.com/jobs/java-full-stack-developer-xebia">Java Full Stack Developer - Xebia</a></h3>
          <h3><a href="https://www.foraysoft.com/jobs/big-data-engineer-xebia">Big Data Engineer - Xebia</a></h3>
          <h3><a href="https://www.foraysoft.com/jobs/senior-developer-xebia">Senior Developer - Xebia</a></h3>
          <h3><a href="https://www.foraysoft.com/jobs/java-microservices-backend-developer-xebia">Java + Microservices Backend Developer- Xebia</a></h3>
          <h3><a href="https://www.foraysoft.com/jobs/sap-consultant-kpmg">SAP Consultant- KPMG</a></h3>
          <h3><a href="https://www.foraysoft.com/jobs/d365-f-and-o-technical-robert-bosch">D365, F&amp;O Technical - Robert Bosch</a></h3>
        </section>
        <section>
          <h2><a href="https://www.foraysoft.com/jobs/java-full-stack-developer-xebia">Java Full Stack Developer - Xebia</a></h2>
          <p>Posted on 21st Sep 2021 17:36:12 in <a href="https://www.foraysoft.com/jobs/c-java-with-fullstack">Java With fullstack</a></p>
          <p>Read More</p>
          <h2><a href="https://www.foraysoft.com/jobs/big-data-engineer-xebia">Big Data Engineer - Xebia</a></h2>
          <p>Posted on 21st Sep 2021 14:56:26 in <a href="https://www.foraysoft.com/jobs/c-data-and-analytics-big-data">Data And Analytics (Big Data)</a></p>
          <p>Read More</p>
          <h2><a href="https://www.foraysoft.com/jobs/senior-developer-xebia">Senior Developer - Xebia</a></h2>
          <p>Posted on 16th Sep 2021 10:41:44 in <a href="https://www.foraysoft.com/jobs/c-cloud">Cloud, Python</a></p>
          <p>Read More</p>
        </section>
      </main>
    </body>
  </html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/foraysoft/script.js')
  } catch {
    assert.fail('Expected ForaySoft scraper module at ../../scraper/foraysoft/script.js')
  }
}

const createFetchText = () => {
  const responses = new Map([
    ['https://www.foraysoft.com/careers.html', VERIFIED_CAREERS_HTML],
    ['https://www.foraysoft.com/jobs/', VERIFIED_JOBS_HTML],
    ['https://www.foraysoft.com/jobs/?p=2', VERIFIED_JOBS_PAGE_TWO_HTML],
  ])
  const requests = []

  return {
    requests,
    fetchText: async (url) => {
      requests.push(url)

      if (!responses.has(url)) {
        throw new Error(`Unexpected URL ${url}`)
      }

      return responses.get(url)
    },
  }
}

test('ForaySoft retains historical archive parsing helpers while current inventory remains unverified', async () => {
  const foraysoft = await loadModule()

  assert.equal(foraysoft.SOURCE, 'foraysoft')
  assert.equal(foraysoft.COMPANY, 'ForaySoft')
  assert.equal(foraysoft.OFFICIAL_BRAND, 'ForaySoft')
  assert.equal(foraysoft.VERIFIED_ON, null)
  assert.equal(foraysoft.CAREERS_URL, 'https://www.foraysoft.com/careers.html')
  assert.equal(foraysoft.JOBS_URL, 'https://www.foraysoft.com/jobs/')
  assert.equal(foraysoft.JOBS_PAGE_TWO_URL, 'https://www.foraysoft.com/jobs/?p=2')
  assert.equal(
    foraysoft.DISPOSITION,
    'runtime-verified-recruitment',
  )
  assert.match(foraysoft.VERIFIED_SURFACE_SUMMARY, /inventories remain unverified/i)

  foraysoft.assertVerifiedCareersSurface(VERIFIED_CAREERS_HTML)
  foraysoft.assertVerifiedJobsArchiveSurface(VERIFIED_JOBS_HTML, foraysoft.JOBS_URL)
  foraysoft.assertVerifiedJobsArchiveSurface(
    VERIFIED_JOBS_PAGE_TWO_HTML,
    foraysoft.JOBS_PAGE_TWO_URL,
  )
  foraysoft.assertVerifiedThirdPartyPlacementArchive(VERIFIED_JOBS_HTML, foraysoft.JOBS_URL)
  foraysoft.assertVerifiedStaleArchiveDates(VERIFIED_JOBS_HTML, VERIFIED_JOBS_PAGE_TWO_HTML)

  assert.deepEqual(foraysoft.extractArchivePostingDates(VERIFIED_JOBS_HTML), [
    '18th Oct 2021 11:26:55',
    '18th Oct 2021 11:16:09',
    '27th Sep 2021 16:37:52',
  ])
  assert.deepEqual(foraysoft.extractArchivePostingDates(VERIFIED_JOBS_PAGE_TWO_HTML), [
    '21st Sep 2021 17:36:12',
    '21st Sep 2021 14:56:26',
    '16th Sep 2021 10:41:44',
  ])
  assert.equal(foraysoft.pageShowsThirdPartyPlacementArchive(VERIFIED_JOBS_HTML), true)
  assert.equal(foraysoft.pageShowsThirdPartyPlacementArchive(VERIFIED_JOBS_PAGE_TWO_HTML), true)
})











// Production extraction supersedes the former unconditional-empty contract.
registerCurrentRecruitmentContract('foraysoft', 'workbookBatch06ForaySoft.test.js')

test('the historical ForaySoft third-party archive cannot certify current India inventory', async () => {
  const module = await loadModule()
  await assert.rejects(module.run({ fetchPage: async url => ({ status: 200, url,
    html: url === module.JOBS_URL ? VERIFIED_JOBS_HTML : url === module.JOBS_PAGE_TWO_URL ? VERIFIED_JOBS_PAGE_TWO_HTML : VERIFIED_CAREERS_HTML }) }),
  error => error.failureKind === 'coverage_gap' && error.recruitmentObservations.sourceScopeComplete === false)
})

test('ForaySoft transport failure stays unknown instead of becoming an empty inventory', async () => {
  const module = await loadModule()
  await assert.rejects(module.run({ fetchPage: async () => { throw new Error('getaddrinfo ENOTFOUND www.foraysoft.com') } }), error => {
    assert.equal(error.failureKind, 'network_or_timeout')
    assert.equal(error.upstreamOutage, true)
    assert.equal(error.abortRetries, true)
    assert.equal(error.recruitmentObservations.sourceScopeComplete, false)
    assert.equal(error.recruitmentObservations.lifecycleCleanupAllowed, false)
    assert.equal(error.recruitmentObservations.receipts.length, 0)
    assert.match(error.message, /ENOTFOUND/)
    assert.ok(error.recruitmentObservations.failures.every(row => /ENOTFOUND/.test(row.message)))
    return true
  })
})
