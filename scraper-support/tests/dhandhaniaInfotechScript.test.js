import assert from 'node:assert/strict'
import test from 'node:test'

const loadDhandhaniaModule = async () => {
  try {
    return await import('../../scraper/dhandhaniainfotech/script.js')
  } catch {
    assert.fail('Expected Dhandhania Infotech scraper module at ../../scraper/dhandhaniainfotech/script.js')
  }
}

const careersHtml = `
<!doctype html>
<html>
  <body>
    <div class="e-n-accordion">
      <details id="e-n-accordion-item-1402" class="e-n-accordion-item">
        <summary class="e-n-accordion-item-title">
          <span class='e-n-accordion-item-title-header'>
            <div class="e-n-accordion-item-title-text"> General Manager Operations </div>
          </span>
        </summary>
        <div role="region" aria-labelledby="e-n-accordion-item-1402">
          <table>
            <tr><td><p><b>Role Title </b></p></td><td><p><b>General Manager Operations</b></p></td></tr>
            <tr><td><p><b>Job Location </b></p></td><td><p><b>Nagpur</b></p></td></tr>
            <tr><td><p><b>Experience Required </b></p></td><td><p><b>15+ Years</b></p></td></tr>
          </table>
          <p><strong>Position Overview:</strong></p>
          <p>Lead end-to-end BPO delivery operations for US-based clients.</p>
        </div>
      </details>
      <details id="e-n-accordion-item-1403" class="e-n-accordion-item">
        <summary class="e-n-accordion-item-title">
          <span class='e-n-accordion-item-title-header'>
            <div class="e-n-accordion-item-title-text"> Senior Business Development Manager </div>
          </span>
        </summary>
        <div role="region" aria-labelledby="e-n-accordion-item-1403">
          <p><b>Job Title: Senior Business Development Manager </b></p>
          <p><b>Location: Nagpur, Maharashtra</b></p>
          <p>Drive end-to-end business development activities for US clients and international markets.</p>
          <p><b>Required Skills</b></p>
          <ul>
            <li>HubSpot CRM</li>
            <li>LinkedIn Sales Navigator</li>
          </ul>
        </div>
      </details>
      <details id="e-n-accordion-item-1404" class="e-n-accordion-item">
        <summary class="e-n-accordion-item-title">
          <span class='e-n-accordion-item-title-header'>
            <div class="e-n-accordion-item-title-text"> Quality Assistant Manager (AM) </div>
          </span>
        </summary>
        <div role="region" aria-labelledby="e-n-accordion-item-1404">
          <table>
            <tr><td><p><b>Role Title </b></p></td><td><p><b>Quality Assistant Manager (AM)</b></p></td></tr>
            <tr><td><p><b>Job Location </b></p></td><td><p><b>Nagpur</b></p></td></tr>
            <tr><td><p><b>Experience Required </b></p></td><td><p><b>6-10 Years</b></p></td></tr>
          </table>
          <ul>
            <li>Strong knowledge of Power BI and quality tools.</li>
          </ul>
        </div>
      </details>
      <details id="e-n-accordion-item-1405" class="e-n-accordion-item">
        <summary class="e-n-accordion-item-title">
          <span class='e-n-accordion-item-title-header'>
            <div class="e-n-accordion-item-title-text"> Accounts Payable/Accounts Receivable Executive (US Accounting) Night shift </div>
          </span>
        </summary>
        <div role="region" aria-labelledby="e-n-accordion-item-1405">
          <table>
            <tr><td><p><b>Role Title </b></p></td><td><p><span>AP/AR Executive</span></p></td></tr>
            <tr><td><p><b>Job Location </b></p></td><td><p><span>Nagpur</span></p></td></tr>
            <tr><td><p><b>Experience Required </b></p></td><td><p><span>2+ years</span></p></td></tr>
          </table>
          <p><b>Job Role:</b></p>
          <p>Manage end-to-end AP and AR functions with a strong understanding of U.S. GAAP.</p>
        </div>
      </details>
    </div>
  </body>
</html>
`

test('extractSearchResults maps the DhanInfo careers accordion into scraper jobs', async () => {
  const dhandhania = await loadDhandhaniaModule()

  const jobs = dhandhania.extractSearchResults(careersHtml)

  assert.equal(jobs.length, 4)
  assert.deepEqual(jobs[0], {
    title: 'General Manager Operations',
    company: 'Dhandhania Infotech',
    department: null,
    location: 'Nagpur, India',
    city: 'Nagpur',
    state: null,
    country: 'India',
    jobId: 'e-n-accordion-item-1402',
    requisitionId: 'e-n-accordion-item-1402',
    sourceUrl: 'https://dhaninfo.com/career/#e-n-accordion-item-1402',
    applyUrl: 'https://dhaninfo.com/career/#e-n-accordion-item-1402',
    employmentType: null,
    experienceRequired: '15+ Years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Position Overview: Lead end-to-end BPO delivery operations for US-based clients.',
    remoteStatus: 'On-site',
  })
  assert.equal(jobs[1].location, 'Nagpur, Maharashtra, India')
  assert.deepEqual(jobs[1].requiredSkills, ['HubSpot CRM', 'LinkedIn Sales Navigator'])
  assert.equal(jobs[2].experienceRequired, '6-10 Years')
  assert.match(jobs[3].jobDescription, /U\.S\. GAAP/i)
})

test('run fetches the DhanInfo careers page and decorates the verified openings', async () => {
  const dhandhania = await loadDhandhaniaModule()
  const requestedUrls = []

  const jobs = await dhandhania.createDhandhaniaInfotechScraper({ maxJobs: 2 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, ['https://dhaninfo.com/career/'])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'dhandhaniainfotech')
  assert.equal(jobs[0].link, 'https://dhaninfo.com/career/#e-n-accordion-item-1402')
  assert.equal(jobs[0].scrapedAt, '2026-07-18T00:00:00.000Z')
})
