import assert from 'node:assert/strict'
import test from 'node:test'

const corporateCareersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Careers | JPMorganChase</title>
      <link rel="canonical" href="https://www.jpmorganchase.com/careers" />
    </head>
    <body>
      <a href="https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/requisitions" target="_blank">
        Join our team
      </a>
      <a href="/careers/explore-opportunities">Explore opportunities</a>
      <p>JPMorgan Chase &amp; Co. is an Equal Opportunity Employer, including Disability/Veterans.</p>
    </body>
  </html>
`

const candidateExperienceHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>JPMC Candidate Experience page</title>
      <base
        href="/hcmUI/CandidateExperience/en/sites/CX_1001"
        data-apibaseurl="https://jpmc.fa.oraclecloud.com:443"
        data-sitenumber="CX_1001"
      />
    </head>
    <body>
      <a href="https://www.careersatchase.com/content/index">Careers at Chase</a>
      <a href="https://careers.jpmorgan.com">GLOBAL</a>
      <p>JPMorgan Chase &amp; Co. is an equal opportunity employer and affirmative action employer Disability/Veteran.</p>
    </body>
  </html>
`

const listingPayload = {
  items: [{
    Limit: 24,
    TotalJobsCount: 1,
    requisitionList: [
      {
        Id: '210730346',
        Title: 'Applied AI/ML Lead',
        PostedDate: '2026-07-13',
        PostingEndDate: null,
        PrimaryLocationCountry: 'IN',
        PrimaryLocation: 'Bengaluru, Karnataka, India',
        JobFamily: 'Predictive Science',
        JobFunction: 'Data & Analytics',
        WorkplaceType: '',
        ShortDescriptionStr: 'Contribute to a transformative journey and make a substantial impact ',
        secondaryLocations: [],
      },
    ],
  }],
}

const detailPayload = {
  items: [{
    Id: '210730346',
    Title: 'Applied AI/ML Lead',
    Category: 'Predictive Science',
    RequisitionType: 'Professional',
    ExternalPostedStartDate: '2026-07-13T16:31:16+00:00',
    JobSchedule: 'Full time',
    StudyLevel: null,
    ExternalPostedEndDate: '2026-07-31T04:00:00+00:00',
    ExternalDescriptionStr: `
      <p>We have an exciting and rewarding opportunity for you to take your software engineering career to the next level.</p>
      <p>As an Applied AI/ML Vice President within Asset &amp; Wealth Management, you will utilize your quantitative, data science, and analytical skills to tackle complex problems.</p>
      <p><strong>Required qualifications, capabilities and skills:</strong></p>
      <ul>
        <li>Formal training or certification on software engineering concepts and 5+ years applied experience.</li>
        <li>Strong experience in natural language processing (NLP).</li>
      </ul>
      <p><strong>Preferred Qualifications, capabilities and skills:</strong></p>
      <ul>
        <li>Financial service background.</li>
      </ul>
    `,
    CorporateDescriptionStr: `
      <p>JPMorganChase, one of the oldest financial institutions, offers innovative financial solutions under the J.P. Morgan and Chase brands.</p>
    `,
    OrganizationDescriptionStr: `
      <p>Asset &amp; Wealth Management delivers industry-leading investment management and private banking solutions.</p>
    `,
    ShortDescriptionStr: 'Contribute to a transformative journey and make a substantial impact ',
    PrimaryLocation: 'Bengaluru, Karnataka, India',
    PrimaryLocationCountry: 'IN',
    ExternalQualificationsStr: 'Formal training or certification on software engineering concepts and 5+ years applied experience.',
    ExternalResponsibilitiesStr: '',
    BusinessUnit: 'Asset & Wealth Management',
    Department: null,
    JobFunction: 'Data & Analytics',
    secondaryLocations: [],
    skills: [
      { Skill: 'Python' },
      { Skill: 'Machine Learning' },
    ],
  }],
}

const loadJPMorganChaseModule = async () => {
  try {
    return await import('../../scraper/jpmorganchase/script.js')
  } catch {
    assert.fail('Expected JPMorgan Chase scraper module at ../../scraper/jpmorganchase/script.js')
  }
}

test('JPMorgan Chase exports a stable exact-name wrapper over the verified Chase India Oracle Cloud contract', async () => {
  const jpmorganChase = await loadJPMorganChaseModule()

  assert.equal(jpmorganChase.SOURCE, 'jpmorganchase')
  assert.equal(jpmorganChase.COMPANY, 'JPMorgan Chase')
  assert.equal(jpmorganChase.OFFICIAL_BRAND_NAME, 'Chase India')
  assert.equal(jpmorganChase.CAREERS_URL, 'https://www.jpmorganchase.com/careers')
  assert.equal(jpmorganChase.COMPANY_DOMAIN, 'jpmorganchase.com')
  assert.equal(jpmorganChase.ATS_PLATFORM, 'oracle-cloud')
  assert.equal(jpmorganChase.COUNTRY_FILTER, 'India')
  assert.equal(jpmorganChase.PAGINATION_STRATEGY, 'offset-query')
  assert.equal(jpmorganChase.WORKSPACE_DOMAIN, 'jpmc.fa.oraclecloud.com')
  assert.equal(jpmorganChase.VERIFIED_ON, '2026-07-15')
  assert.match(jpmorganChase.VERIFIED_SURFACE_SUMMARY, /Careers \| JPMorganChase/i)
  assert.equal(jpmorganChase.hasVerifiedJPMorganChaseCareersSignal(corporateCareersHtml), true)
  assert.deepEqual(
    jpmorganChase.decorateJPMorganChaseJob(
      {
        title: 'Applied AI/ML Lead',
        company: 'Chase India',
        source: 'chaseindia',
        jobId: '210730346',
        link: 'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/210730346',
        applyUrl: 'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/210730346',
        sourceUrl: 'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/210730346',
      },
      '2026-07-15T20:00:00.000Z',
    ),
    {
      title: 'Applied AI/ML Lead',
      company: 'JPMorgan Chase',
      source: 'jpmorganchase',
      jobId: '210730346',
      link: 'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/210730346',
      applyUrl: 'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/210730346',
      sourceUrl: 'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/210730346',
      companyCareerPage: 'https://www.jpmorganchase.com/careers',
      companyDomain: 'jpmorganchase.com',
      atsPlatform: 'oracle-cloud',
      scrapedAt: '2026-07-15T20:00:00.000Z',
    },
  )
})

test('JPMorgan Chase run validates the careers page and decorates jobs from the existing Chase India scraper', async () => {
  const jpmorganChase = await loadJPMorganChaseModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await jpmorganChase.createJPMorganChaseScraper({
    maxPages: 1,
    maxJobs: 1,
    now: () => '2026-07-15T20:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === jpmorganChase.CAREERS_URL) return corporateCareersHtml
      if (url === jpmorganChase.CANDIDATE_EXPERIENCE_URL) return candidateExperienceHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === jpmorganChase.buildSearchUrl()) return listingPayload
      if (url === jpmorganChase.buildJobDetailApiUrl('210730346')) return detailPayload
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTextUrls, [
    jpmorganChase.CAREERS_URL,
    jpmorganChase.CANDIDATE_EXPERIENCE_URL,
  ])
  assert.deepEqual(requestedJsonUrls, [
    jpmorganChase.buildSearchUrl(),
    jpmorganChase.buildJobDetailApiUrl('210730346'),
    jpmorganChase.buildSearchUrl(),
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'jpmorganchase')
  assert.equal(jobs[0].company, 'JPMorgan Chase')
  assert.equal(jobs[0].companyCareerPage, jpmorganChase.CAREERS_URL)
  assert.equal(jobs[0].companyDomain, 'jpmorganchase.com')
  assert.equal(jobs[0].atsPlatform, 'oracle-cloud')
  assert.equal(jobs[0].scrapedAt, '2026-07-15T20:00:00.000Z')
})

test('JPMorgan Chase fails closed when the verified careers page drifts materially', async () => {
  const jpmorganChase = await loadJPMorganChaseModule()

  await assert.rejects(
    jpmorganChase.createJPMorganChaseScraper().run({
      fetchText: async (url) => {
        if (url === jpmorganChase.CAREERS_URL) {
          return corporateCareersHtml.replace('Join our team', 'Work here')
        }
        return candidateExperienceHtml
      },
      fetchJson: async () => listingPayload,
    }),
    /verified JPMorgan Chase careers page/i,
  )
})

const wrapperTransport = (total = 1, { onText = () => {}, onDetail = () => {} } = {}) => {
  const rows = Array.from({ length: total }, (_, i) => ({ ...listingPayload.items[0].requisitionList[0], Id: String(210730346 + i), Title: `Applied AI/ML Lead ${i}` }))
  return {
    fetchText: async (url, options) => {
      onText(url, options)
      if (url === 'https://www.jpmorganchase.com/careers') return corporateCareersHtml
      return candidateExperienceHtml
    },
    fetchJson: async (url, options) => {
      const offset = /,offset=(\d+),/.exec(url)
      if (offset) return { items: [{ SiteNumber: 'CX_1001', Limit: 24, Offset: Number(offset[1]), TotalJobsCount: total, requisitionList: rows.slice(Number(offset[1]), Number(offset[1]) + 24) }] }
      const id = /Id=%22(\d+)%22/.exec(url)?.[1], row = rows.find(row => row.Id === id)
      assert.ok(row, `Unexpected detail URL: ${url}`)
      onDetail(url, options)
      return { items: [{ ...detailPayload.items[0], ...row }] }
    },
  }
}

test('JPMorgan Chase wrapper retains the child complete inventory after company decoration', async () => {
  const { readInventoryEvidence } = await import('../utils/inventoryEvidence.js')
  const wrapper = await loadJPMorganChaseModule(), jobs = await wrapper.createJPMorganChaseScraper().run(wrapperTransport())
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, true)
  assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, 1)
  assert.equal(readInventoryEvidence(jobs)?.pagesFetched, 2)
  assert.equal(jobs[0].source, 'jpmorganchase')
  assert.equal(jobs[0].company, 'JPMorgan Chase')
})

for (const [name, options, total, count] of [
  ['page limit', { maxPages: 1 }, 25, 24], ['job limit', { maxJobs: 1 }, 2, 1],
]) test('JPMorgan Chase wrapper retains incomplete child inventory for explicit ' + name, async () => {
  const { readInventoryEvidence } = await import('../utils/inventoryEvidence.js')
  const wrapper = await loadJPMorganChaseModule(), jobs = await wrapper.createJPMorganChaseScraper(options).run(wrapperTransport(total))
  assert.equal(jobs.length, count)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, null)
  assert.ok(jobs.every(job => job.sourceScopeComplete === false && job.lifecycleCleanupAllowed === false))
})

test('JPMorgan Chase wrapper honors opaque preabort on its factory and run interfaces', async () => {
  const wrapper = await loadJPMorganChaseModule(), controller = new AbortController(), reason = Object.freeze({ caller: 'wrapper' })
  controller.abort(reason)
  const transport = { fetchText: async () => assert.fail('preabort must not request a corporate page') }
  await assert.rejects(wrapper.createJPMorganChaseScraper({ signal: controller.signal }).run(transport), e => e === reason)
  await assert.rejects(wrapper.createJPMorganChaseScraper().run({ ...transport, signal: controller.signal }), e => e === reason)
})

test('JPMorgan Chase wrapper forwards caller cancellation through the corporate and child detail requests', async () => {
  const wrapper = await loadJPMorganChaseModule()
  for (const phase of ['corporate', 'detail']) {
    const controller = new AbortController(), reason = Object.freeze({ phase })
    const transport = wrapperTransport(1, {
      onText(url, options) {
        assert.equal(options?.signal, controller.signal)
        if (phase === 'corporate') controller.abort(reason)
      },
      onDetail(_url, options) { assert.equal(options?.signal, controller.signal); controller.abort(reason) },
    })
    await assert.rejects(wrapper.run({ ...transport, signal: controller.signal }), e => e === reason)
  }
})
