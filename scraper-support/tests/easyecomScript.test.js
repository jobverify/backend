import assert from 'node:assert/strict'
import test from 'node:test'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

test.before(() => { globalThis.fetch = () => { throw new Error('Unexpected network access in archive tests') } })

const loadEasyEcomModule = async () => {
  try {
    return await import('../../scraper/easyecom/script.js')
  } catch {
    return null
  }
}

const listingHtml = `
  <div role="listitem" class="career-item w-dyn-item">
    <div class="w-layout-grid grid-3-columns career-item-grid">
      <div class="inner-container _484px center width-100 _100---mbl">
        <h3 class="heading-h3-size mg-bottom-10px">Business Analyst</h3>
        <div class="career-item-details">
          <div class="text-200 medium color-neutral-800">Bengaluru</div>
          <div class="divider-details"></div>
        </div>
      </div>
      <div class="career-item-button">
        <div class="buttons-row">
          <a href="/career/business-analyst" class="btn-primary width-100---mbl w-button">Apply now</a>
        </div>
      </div>
    </div>
  </div>
  <div role="listitem" class="career-item w-dyn-item">
    <div class="w-layout-grid grid-3-columns career-item-grid">
      <div class="inner-container _484px center width-100 _100---mbl">
        <h3 class="heading-h3-size mg-bottom-10px">Key Account Manager</h3>
        <div class="career-item-details">
          <div class="text-200 medium color-neutral-800">Mumbai/Bengaluru/Hybrid/Remote</div>
          <div class="divider-details"></div>
        </div>
      </div>
      <div class="career-item-button">
        <div class="buttons-row">
          <a href="/career/key-account-manager" class="btn-primary width-100---mbl w-button">Apply now</a>
        </div>
      </div>
    </div>
  </div>
`

const detailHtml = `
  <html>
    <head><title>Business Analyst - EasyEcom</title></head>
    <body>
      <div class="flex-horizontal justify-center align-center children-wrap">
        <div class="text-200 medium color-neutral-100">Bengaluru</div>
        <div class="divider-details light"></div>
        <div class="text-200 medium color-neutral-100">Full time</div>
      </div>
      <h1 class="display-1 color-neutral-100 mg-bottom-8px">Business Analyst</h1>
      <div class="tabs-content w-tab-content">
        <div data-w-tab="Tab 1" class="w-tab-pane w--tab-active">
          <div class="card career-page-content">
            <div class="rich-text-v2 w-richtext">
              <h2>About the Position</h2>
              <p>We are on the lookout for a business analyst to join our project team.</p>
            </div>
            <div class="buttons-row"><a href="mailto:sapna@easyecom.io" class="btn-primary w-button">Apply now</a></div>
          </div>
        </div>
        <div data-w-tab="Tab 2" class="w-tab-pane">
          <div class="card career-page-content">
            <div class="rich-text-v2 w-richtext">
              <h3>Responsibilities:</h3>
              <p>● Performing requirements analysis.</p>
              <p>● Defining problem scope and finding solutions.</p>
            </div>
          </div>
        </div>
        <div data-w-tab="Tab 3" class="w-tab-pane">
          <div class="card career-page-content">
            <div class="rich-text-v2 w-richtext">
              <h3>Requirements:</h3>
              <p>● 1+ years of experience as a Business Analyst.</p>
              <p>● Excellent communication skills.</p>
            </div>
          </div>
        </div>
      </div>
    </body>
  </html>
`

test('extractSearchResults parses EasyEcom careers cards into India job listings', async () => {
  const easyecom = await loadEasyEcomModule()
  assert.ok(easyecom)

  const jobs = easyecom.extractSearchResults(listingHtml)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Business Analyst',
    company: 'EasyEcom',
    department: null,
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: 'business-analyst',
    requisitionId: 'business-analyst',
    sourceUrl: 'https://easyecom.io/career/business-analyst',
    applyUrl: 'https://easyecom.io/career/business-analyst',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: 'On-site',
  })

  assert.deepEqual(jobs[1], {
    title: 'Key Account Manager',
    company: 'EasyEcom',
    department: null,
    location: 'Mumbai/Bengaluru/Hybrid/Remote, India',
    city: 'Mumbai/Bengaluru/Hybrid/Remote',
    country: 'India',
    jobId: 'key-account-manager',
    requisitionId: 'key-account-manager',
    sourceUrl: 'https://easyecom.io/career/key-account-manager',
    applyUrl: 'https://easyecom.io/career/key-account-manager',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: 'Hybrid',
  })
})

test('extractJobDetail pulls EasyEcom detail fields, mailto apply URL, and description sections', async () => {
  const easyecom = await loadEasyEcomModule()
  assert.ok(easyecom)

  const job = easyecom.extractJobDetail(detailHtml, {
    title: 'Business Analyst',
    company: 'EasyEcom',
    department: null,
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: 'business-analyst',
    requisitionId: 'business-analyst',
    sourceUrl: 'https://easyecom.io/career/business-analyst',
    applyUrl: 'https://easyecom.io/career/business-analyst',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: 'On-site',
  })

  assert.equal(job.title, 'Business Analyst')
  assert.equal(job.location, 'Bengaluru, India')
  assert.equal(job.city, 'Bengaluru')
  assert.equal(job.employmentType, 'Full-time')
  assert.equal(job.applyUrl, 'mailto:sapna@easyecom.io')
  assert.equal(job.sourceUrl, 'https://easyecom.io/career/business-analyst')
  assert.match(job.jobDescription, /About the Position/i)
  assert.match(job.jobDescription, /business analyst to join our project team/i)
  assert.match(job.minimumQualification, /1\+ years of experience/i)
  assert.match(job.preferredQualification, /Excellent communication skills/i)
  assert.deepEqual(job.requiredSkills.slice(0, 2), [
    'Performing requirements analysis.',
    'Defining problem scope and finding solutions.',
  ])
})

test('current run rejects archived Webflow cards rather than inferring healthy India jobs', async () => {
  const easyecom = await loadEasyEcomModule()
  assert.ok(easyecom)

  const requested = []
  const scraper = easyecom.createEasyEcomScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requested.push(url)
      if (url === 'https://www.easyecom.io/careers') return listingHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requested, [
    'https://www.easyecom.io/careers',
  ])
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
