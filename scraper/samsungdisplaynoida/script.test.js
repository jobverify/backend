import assert from 'node:assert/strict'
import test from 'node:test'

const SOURCE = 'samsungdisplaynoida'
const COMPANY = 'Samsung Display Noida Pvt. Ltd.'
const COMPANY_CODE = 'C90'
const HOMEPAGE_URL = 'https://www.samsungdisplay.com/eng/index.jsp'
const LOCATION_PAGE_URL = 'https://www.samsungdisplay.com/eng/intro/loc-country.jsp'
const RECRUIT_PAGE_URL = 'https://www.samsungdisplay.com/eng/career-info/recruit/junior-step.jsp'
const COMPANY_PAGE_URL = 'https://www.samsungcareers.com/subsid/detail/C90'
const LIST_URL = 'https://www.samsungcareers.com/hr/list.data'
const DETAIL_URL = 'https://www.samsungcareers.com/recruit/detail.data'
const SOURCE_URL = 'https://www.samsungcareers.com/hr/?no=33001'
const APPLY_URL = 'https://www.samsungcareers.com/resume/create?comp=C90&no=21001'

const loadSamsungDisplayNoidaModule = async () => import('./script.js')

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Samsung Display</title>
  </head>
  <body>
    <header>
      <a href="/eng/index.jsp">Samsung Display</a>
      <a href="/eng/career-info/recruit/junior-step.jsp">Careers</a>
    </header>
    <main>
      <h1>Samsung Display</h1>
      <p>OLED Technology and Innovation</p>
      <p>Change the world with advanced display technology</p>
    </main>
  </body>
</html>
`

const LIVEISH_HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Samsung Display</title>
  </head>
  <body>
    <nav>
      <a href="#">Careers</a>
      <a href="/eng/career-info/recruit/junior-step.jsp" title="Go to Hiring Process page">Hiring Process</a>
    </nav>
    <main>
      <p>OLED Finder</p>
      <h2>A Window to the<br class="m_only"> Digital World</h2>
      <p>Display technology offers unique daily life and value through its infinite scability.</p>
    </main>
  </body>
</html>
`

const LOCATION_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Locations | Samsung Display</title>
  </head>
  <body>
    <main>
      <h2>Samsung Display Noida (SDN)</h2>
      <p>A-5, Sector-81, Noida, Uttar Pradesh, India</p>
      <p>Tel +91-120-000-0000</p>
      <p>Global Network</p>
    </main>
  </body>
</html>
`

const RECRUIT_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Junior Recruitment Process | Samsung Display</title>
  </head>
  <body>
    <main>
      <h2>Junior Recruitment Process</h2>
      <p>Application</p>
      <p>Interview</p>
      <p>Health Check</p>
      <p>Final Acceptance</p>
    </main>
  </body>
</html>
`

const LIVEISH_RECRUIT_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Samsung Display | Careers - Hiring Process (Entry-level)</title>
  </head>
  <body>
    <main>
      <h2>Hiring Process (Entry-level)</h2>
      <ol>
        <li>STEP 01 Submit Application</li>
        <li>STEP 02 Review Application</li>
        <li>STEP 03 Samsung Aptitude Test</li>
        <li>STEP 04 Interview</li>
        <li>STEP 05 Medical Test</li>
      </ol>
    </main>
  </body>
</html>
`

const COMPANY_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Samsung Display | SAMSUNG CAREERS</title>
  </head>
  <body>
    <main class="companyDetail">
      <h2>Samsung Display</h2>
      <button id="subScrap" class="btnScrap" value="false" data-target="0" data-index="C90"></button>
      <p class="text">Samsung Display operates its India manufacturing base in Noida.</p>
      <span>https://www.samsungdisplay.com</span>
      <dd>
        Recruitment Inquiries
        <span class="dd">sdn.recruit@samsung.com</span>
      </dd>
      <button class="btnJobDetail btn btn500 h4 ico" name="btnJobDetail" data-code="ENG01" data-bookmarkYn="N">
        Open Role
      </button>
      <button class="btnJobDetail btn btn500 h4 ico" name="btnJobDetail" data-code="OPS02" data-bookmarkYn="N">
        Open Role
      </button>
    </main>
  </body>
</html>
`

const LIST_HTML = `
<input type="hidden" class="divCnt" data-value="1" data-max="1">
<li>
  <div>
    <div>
      <div class="btnWrap">
        <button type="button" class="btnShare" data-value="33,001">
          <i>Share</i>
        </button>
        <button type="button" value="" class="btnScrap" data-value="21,001">
          <i>Save</i>
        </button>
      </div>
      <a href="/#none" data-value="33,001">
        <p class="company">Samsung Display</p>
        <h3 class="title">Engineer Hiring</h3>
        <p class="info">
          <span>Experienced</span>
          <span class="period">2026.07.01 ~ 2026.07.31</span>
        </p>
      </a>
    </div>
    <div class="flagWrap">
      <span class="flag blue">D-10</span>
      <span class="flag grey">Engineering</span>
      <span class="flag grey">Operations</span>
    </div>
  </div>
</li>
`

const EMPTY_LIST_HTML = `
<input type="hidden" class="divCnt" data-value="0" data-max="0">
<div class="noData">
  <i></i>
  <p class="text1">현재 채용중인 공고가 없습니다.</p>
  <p class="text2">검색어 또는 검색 조건을 확인해주시기 바랍니다.</p>
</div>
`

const DETAIL_PAYLOAD = {
  success: true,
  data: {
    result: {
      seq: 33001,
      seqno: 21001,
      title: 'Engineer Hiring',
      startdate: '202607010900',
      enddate: '202607311700',
      compCd: 'C90',
      email: 'sdn.recruit@samsung.com',
      siteUrl: 'https://www.samsungdisplay.com',
      cmpNameEn: 'Samsung Display',
    },
    items: [
      {
        taskCode: 'ENG01',
        titleEn: 'Display Process Engineer',
        taskEn: '- Yield improvement for OLED module production\\n- Cross-functional process validation',
        qlfctEn: '- Those with 4+ years of relevant display manufacturing experience',
        favorEn: '- Experience in OLED or mobile display manufacturing',
        memoEn: '- Employment Type : Regular (Full-time)',
        workPlaceEn: '- Noida, Uttar Pradesh, India',
        sort: 0,
      },
      {
        taskCode: 'OPS02',
        titleEn: 'Manufacturing Operations Specialist',
        taskEn: '- Line balancing and production support\\n- Support quality audits',
        qlfctEn: '- Those with 3+ years of manufacturing operations experience',
        favorEn: '- Experience with electronics manufacturing systems',
        memoEn: '- Employment Type : Regular (Full-time)',
        workPlaceEn: '- Noida, India',
        sort: 1,
      },
      {
        taskCode: 'KR03',
        titleEn: 'Korea-only Role',
        taskEn: '- Support HQ operations',
        qlfctEn: '- Those with 5+ years of HQ support experience',
        favorEn: '- Korean language fluency',
        memoEn: '- Employment Type : Regular (Full-time)',
        workPlaceEn: '- Asan, Chungcheongnam-do, South Korea',
        sort: 2,
      },
    ],
  },
}

test('Samsung Display Noida validates the official Samsung Display and Samsung Careers route contract', async () => {
  const sdn = await loadSamsungDisplayNoidaModule()

  assert.equal(sdn.SOURCE, SOURCE)
  assert.equal(sdn.COMPANY, COMPANY)
  assert.equal(sdn.COMPANY_CODE, COMPANY_CODE)
  assert.equal(sdn.HOMEPAGE_URL, HOMEPAGE_URL)
  assert.equal(sdn.LOCATION_PAGE_URL, LOCATION_PAGE_URL)
  assert.equal(sdn.RECRUIT_PAGE_URL, RECRUIT_PAGE_URL)
  assert.equal(sdn.COMPANY_PAGE_URL, COMPANY_PAGE_URL)
  assert.equal(sdn.LIST_URL, LIST_URL)
  assert.equal(sdn.DETAIL_URL, DETAIL_URL)
  assert.equal(sdn.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(sdn.hasOfficialHomepageSignal(LIVEISH_HOMEPAGE_HTML), true)
  assert.equal(sdn.hasOfficialLocationPageSignal(LOCATION_PAGE_HTML), true)
  assert.equal(sdn.hasOfficialRecruitPageSignal(RECRUIT_PAGE_HTML), true)
  assert.equal(sdn.hasOfficialRecruitPageSignal(LIVEISH_RECRUIT_PAGE_HTML), true)
  assert.equal(sdn.hasExactCompanyPageSignal(COMPANY_PAGE_HTML), true)
  assert.deepEqual(sdn.extractRoleCodesFromCompanyPage(COMPANY_PAGE_HTML), ['ENG01', 'OPS02'])
})

test('Samsung Display Noida parses the exact-company public listing HTML and filters detail payload jobs to India', async () => {
  const sdn = await loadSamsungDisplayNoidaModule()
  const cards = sdn.extractListingCards(LIST_HTML)

  assert.deepEqual(cards, [
    {
      seq: 33001,
      seqno: 21001,
      company: 'Samsung Display',
      title: 'Engineer Hiring',
      recruitType: 'Experienced',
      postingDate: '2026-07-01',
      closingDate: '2026-07-31',
      sourceUrl: SOURCE_URL,
      applyUrl: APPLY_URL,
      flags: ['Engineering', 'Operations'],
    },
  ])

  const jobs = sdn.extractJobsFromDetailPayload({
    payload: DETAIL_PAYLOAD,
    listingCard: cards[0],
    scrapedAt: '2026-07-12T00:00:00.000Z',
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Display Process Engineer',
    company: COMPANY,
    location: 'Noida, Uttar Pradesh, India',
    city: 'Noida',
    state: 'Uttar Pradesh',
    country: 'India',
    jobId: '33001-ENG01',
    requisitionId: '33001-ENG01',
    sourceUrl: SOURCE_URL,
    applyUrl: APPLY_URL,
    employmentType: 'Full-time',
    experienceRequired: '4+ years',
    minimumQualification: 'Those with 4+ years of relevant display manufacturing experience',
    preferredQualification: 'Experience in OLED or mobile display manufacturing',
    requiredSkills: [
      'Yield improvement for OLED module production',
      'Cross-functional process validation',
    ],
    postingDate: new Date('2026-07-01T00:00:00.000Z'),
    closingDate: new Date('2026-07-31T00:00:00.000Z'),
    jobDescription: [
      'Posting: Engineer Hiring',
      'Responsibilities:',
      'Yield improvement for OLED module production',
      'Cross-functional process validation',
      'Qualifications:',
      'Those with 4+ years of relevant display manufacturing experience',
      'Preferences:',
      'Experience in OLED or mobile display manufacturing',
      'Notes:',
      'Employment Type : Regular (Full-time)',
    ].join('\n'),
    remoteStatus: 'On-site',
    department: 'Engineer Hiring',
    source: SOURCE,
    link: APPLY_URL,
    companyCareerPage: COMPANY_PAGE_URL,
    companyDomain: 'samsungcareers.com',
    atsPlatform: 'samsung-careers',
    scrapedTimestamp: new Date('2026-07-12T00:00:00.000Z'),
  })
  assert.equal(jobs[1].title, 'Manufacturing Operations Specialist')
  assert.equal(jobs[1].city, 'Noida')
  assert.equal(jobs[1].country, 'India')
})

test('Samsung Display Noida accepts the current official Korean company label for the exact C90-filtered listing', async () => {
  const sdn = await loadSamsungDisplayNoidaModule()

  const koreanListingHtml = LIST_HTML
    .replace('Samsung Display', '삼성디스플레이')
    .replace('Engineer Hiring', 'R&D분야 외국인 경력사원 채용')

  const cards = sdn.extractListingCards(koreanListingHtml)
  assert.equal(cards.length, 1)
  assert.equal(cards[0].company, '삼성디스플레이')
})

test('Samsung Display Noida run() validates the route chain, posts the exact company filter, and returns only India jobs', async () => {
  const sdn = await loadSamsungDisplayNoidaModule()
  const requestedText = []
  const requestedJson = []

  const jobs = await sdn.createSamsungDisplayNoidaScraper({
    now: () => '2026-07-12T00:00:00.000Z',
  }).run({
    fetchText: async (url, options = {}) => {
      requestedText.push({
        url,
        method: options.method || 'GET',
        body: options.body ? options.body.toString() : null,
      })

      if (url === HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === LOCATION_PAGE_URL) return LOCATION_PAGE_HTML
      if (url === RECRUIT_PAGE_URL) return RECRUIT_PAGE_HTML
      if (url === COMPANY_PAGE_URL) return COMPANY_PAGE_HTML
      if (url === LIST_URL && (options.method || 'GET') === 'POST') return LIST_HTML

      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      if (url === `${DETAIL_URL}?seqno=33001&strCode=`) return DETAIL_PAYLOAD
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedText, [
    { url: HOMEPAGE_URL, method: 'GET', body: null },
    { url: LOCATION_PAGE_URL, method: 'GET', body: null },
    { url: RECRUIT_PAGE_URL, method: 'GET', body: null },
    { url: COMPANY_PAGE_URL, method: 'GET', body: null },
    {
      url: LIST_URL,
      method: 'POST',
      body: 'currentPageNo=1&intNo=0&strVal=&strTxt=&strKey=&strCompany=C90&strType=&strOrderBy=&strEntity=',
    },
  ])
  assert.deepEqual(requestedJson, [`${DETAIL_URL}?seqno=33001&strCode=`])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, SOURCE)
  assert.equal(jobs[0].company, COMPANY)
  assert.equal(jobs[0].companyCareerPage, COMPANY_PAGE_URL)
  assert.equal(jobs[0].companyDomain, 'samsungcareers.com')
  assert.equal(jobs[0].atsPlatform, 'samsung-careers')
  assert.equal(jobs.every((job) => job.country === 'India'), true)
})

test('Samsung Display Noida returns an empty set when the official C90 listings endpoint reports no current postings', async () => {
  const sdn = await loadSamsungDisplayNoidaModule()

  const jobs = await sdn.createSamsungDisplayNoidaScraper().run({
    fetchText: async (url, options = {}) => {
      if (url === HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === LOCATION_PAGE_URL) return LOCATION_PAGE_HTML
      if (url === RECRUIT_PAGE_URL) return RECRUIT_PAGE_HTML
      if (url === COMPANY_PAGE_URL) return COMPANY_PAGE_HTML
      if (url === LIST_URL && (options.method || 'GET') === 'POST') return EMPTY_LIST_HTML
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async () => {
      throw new Error('No detail payload should be requested when the official list endpoint is empty')
    },
  })

  assert.deepEqual(jobs, [])
  assert.equal(sdn.hasNoCurrentPostingsSignal(EMPTY_LIST_HTML), true)
})

test('Samsung Display Noida fails closed when exact company identity or role locations cannot be verified', async () => {
  const sdn = await loadSamsungDisplayNoidaModule()

  await assert.rejects(
    sdn.createSamsungDisplayNoidaScraper().run({
      fetchText: async (url, options = {}) => {
        if (url === HOMEPAGE_URL) return HOMEPAGE_HTML
        if (url === LOCATION_PAGE_URL) return LOCATION_PAGE_HTML
        if (url === RECRUIT_PAGE_URL) return RECRUIT_PAGE_HTML
        if (url === COMPANY_PAGE_URL) {
          return COMPANY_PAGE_HTML.replace('https://www.samsungdisplay.com', 'https://example.com')
        }
        if (url === LIST_URL && (options.method || 'GET') === 'POST') return LIST_HTML
        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async () => DETAIL_PAYLOAD,
    }),
    /exact-company samsung careers page/i,
  )

  await assert.rejects(
    sdn.createSamsungDisplayNoidaScraper().run({
      fetchText: async (url, options = {}) => {
        if (url === HOMEPAGE_URL) return HOMEPAGE_HTML
        if (url === LOCATION_PAGE_URL) return LOCATION_PAGE_HTML
        if (url === RECRUIT_PAGE_URL) return RECRUIT_PAGE_HTML
        if (url === COMPANY_PAGE_URL) return COMPANY_PAGE_HTML
        if (url === LIST_URL && (options.method || 'GET') === 'POST') {
          return LIST_HTML.replace('Samsung Display', 'Samsung Display HQ')
        }
        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async () => DETAIL_PAYLOAD,
    }),
    /listing html/i,
  )

  const nonIndiaJobs = await sdn.createSamsungDisplayNoidaScraper().run({
    fetchText: async (url, options = {}) => {
      if (url === HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === LOCATION_PAGE_URL) return LOCATION_PAGE_HTML
      if (url === RECRUIT_PAGE_URL) return RECRUIT_PAGE_HTML
      if (url === COMPANY_PAGE_URL) return COMPANY_PAGE_HTML
      if (url === LIST_URL && (options.method || 'GET') === 'POST') return LIST_HTML
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async () => ({
      ...DETAIL_PAYLOAD,
      data: {
        ...DETAIL_PAYLOAD.data,
        items: DETAIL_PAYLOAD.data.items.filter((item) => !/india/i.test(item.workPlaceEn)),
      },
    }),
  })
  assert.deepEqual(nonIndiaJobs, [])

  assert.throws(
    () => sdn.extractJobsFromDetailPayload({
      payload: {
        ...DETAIL_PAYLOAD,
        data: {
          ...DETAIL_PAYLOAD.data,
          items: [{ ...DETAIL_PAYLOAD.data.items[0], workPlaceEn: '', workPlaceKr: '' }],
        },
      },
      listingCard: sdn.extractListingCards(LIST_HTML)[0],
      scrapedAt: '2026-09-13T00:00:00.000Z',
    }),
    /location could not be verified/i,
  )
})
