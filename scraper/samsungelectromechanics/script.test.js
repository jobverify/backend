import assert from 'node:assert/strict'
import test from 'node:test'

const SOURCE = 'samsungelectromechanics'
const COMPANY = 'Samsung Electro-Mechanics'
const COMPANY_CODE = 'C40'
const HOMEPAGE_URL = 'https://www.samsungsem.com/kr/index.do'
const COMPANY_PAGE_URL = 'https://www.samsungcareers.com/subsid/detail/C40'
const LIST_URL = 'https://www.samsungcareers.com/hr/list.data'
const DETAIL_URL = 'https://www.samsungcareers.com/recruit/detail.data'
const SOURCE_URL = 'https://www.samsungcareers.com/hr/?no=22584'
const APPLY_URL = 'https://www.samsungcareers.com/resume/create?comp=C40&no=18456'

const loadSamsungElectroMechanicsModule = async () => import('./script.js')

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="ko">
  <head>
    <title>삼성전기</title>
    <meta property="og:title" content="삼성전기">
  </head>
  <body>
    <a href="/kr/index.do" class="logo_link">
      SAMSUNG ELECTRO-MECHANICS
      <span class="logo"></span>
    </a>
    <a href="/kr/careers/job-description.do" class="tit">인재채용</a>
    <a href="https://www.samsungcareers.com/" target="_blank" title="새 창으로 바로가기" class="btn1">
      <strong>삼성 통합 인재채용</strong>
    </a>
    <small>Copyright. SAMSUNG ELECTRO-MECHANICS All rights reserved.</small>
  </body>
</html>
`

const COMPANY_PAGE_HTML = `
<!doctype html>
<html lang="ko">
  <head>
    <title>삼성전기 | SAMSUNG CAREERS</title>
  </head>
  <body>
    <main class="companyDetail">
      <h2>삼성전기</h2>
      <button id="subScrap" class="btnScrap" value="false" data-target="0" data-index="C40"></button>
      <p class="text">
        삼성전기는 Electro(전자)와 Mechanics(기계)를 아우르는 글로벌 리딩 부품 회사로,
        첨단 IT전자기기, 전장용 핵심 부품을 개발 및 생산하고 있습니다.
      </p>
      <span>https://www.samsungsem.com</span>
      <dd>
        채용 문의
        <span class="dd">sem.recruit@samsung.com</span>
      </dd>
      <ul class="col3List job mSlideWrap">
        <li>
          <div>
            <div>
              <div class="btnWrap">
                <button type="button" class="btnShare" data-value="22,584">
                  <i>공유</i>
                </button>
              </div>
              <a href="#none" name="btnRecruit" data-value="22584">
                <p class="company">삼성전기</p>
                <h3 class="title">경력사원 채용(패키지 부문)</h3>
                <p class="info">
                  <span>경력</span>
                  <span class="period">2026.06.26 ~ 2026.07.13</span>
                </p>
              </a>
            </div>
            <div class="flagWrap">
              <span class="flag blue">D-2</span>
              <span class="flag grey">제품개발</span>
              <span class="flag grey">공정개발</span>
              <span class="flag grey">품질</span>
              <span class="flag grey">구매</span>
              <span class="flag grey">마케팅</span>
              <span class="flag grey">영업</span>
            </div>
          </div>
        </li>
      </ul>
      <button class="btnJobDetail btn btn500 h4 ico" name="btnJobDetail" data-code="G12022" data-bookmarkYn="N">
        현재 채용 중
      </button>
      <button class="btnJobDetail btn btn500 h4 ico" name="btnJobDetail" data-code="G12021" data-bookmarkYn="N">
        현재 채용 중
      </button>
      <button class="btnJobDetail btn btn500 h4 ico" name="btnJobDetail" data-code="G12025" data-bookmarkYn="N">
        현재 채용 중
      </button>
      <button class="btnJobDetail btn btn500 h4 ico" name="btnJobDetail" data-code="G4010" data-bookmarkYn="N">
        현재 채용 중
      </button>
      <button class="btnJobDetail btn btn500 h4 ico" name="btnJobDetail" data-code="G121042" data-bookmarkYn="N">
        현재 채용 중
      </button>
      <button class="btnJobDetail btn btn500 h4 ico" name="btnJobDetail" data-code="G121003" data-bookmarkYn="N">
        현재 채용 중
      </button>
    </main>
  </body>
</html>
`

const LIVEISH_COMPANY_PAGE_HTML = `
<!doctype html>
<html lang="ko">
  <head>
    <title>삼성전기 | SAMSUNG CAREERS</title>
  </head>
  <body>
    <main class="companyDetail">
      <button id="subScrap" class="btnScrap" value="false" data-target="0" data-index="C40"></button>
      <h1>삼성전기</h1>
      <p>삼성전기는 Electro(전자)와 Mechanics(기계)를 아우르는 글로벌 리딩 부품 회사입니다.</p>
      <span>https://www.samsungsem.com</span>
      <dd>
        채용 문의
        <span class="dd">sem.recruit@samsung.com</span>
      </dd>
      <section>
        <h2>삼성전기 직무 알아보기</h2>
        <p>연구/개발 공정개발</p>
      </section>
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
        <button type="button" class="btnShare" data-value="22,584">
          <i>공유</i>
          <span class="tooltip">채용 공고를 공유할 수 있습니다.</span>
        </button>
        <button type="button" value="" class="btnScrap" data-value="18,456">
          <i>스크랩</i>
        </button>
      </div>
      <a href="/#none" data-value="22,584">
        <p class="company">삼성전기</p>
        <h3 class="title">경력사원 채용(패키지 부문)</h3>
        <p class="info">
          <span>경력</span>
          <span class="period">2026.06.26 ~ 2026.07.13</span>
        </p>
      </a>
    </div>
    <div class="flagWrap">
      <span class="flag blue">D-2</span>
      <span class="flag grey">제품개발</span>
      <span class="flag grey">공정개발</span>
      <span class="flag grey">품질</span>
      <span class="flag grey">구매</span>
      <span class="flag grey">마케팅</span>
      <span class="flag grey">영업</span>
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
      seq: 22584,
      seqno: 18456,
      title: '경력사원 채용(패키지 부문)',
      startdate: '202606260900',
      enddate: '202607131700',
      compCd: 'C40',
      email: 'sem.recruit@samsung.com',
      introEn: 'Samsung Electro-Mechanics will expand its business portfolio through continuous development of new products.',
      mainTel: '031-210-5114',
      siteUrl: 'https://www.samsungsem.com',
      cmpNameKr: '삼성전기',
      cmpNameEn: 'Samsung Electro-Mechanics',
      qlfctEn: "Those with 2+ years of relevant experience after obtaining a bachelor's degree",
      dd: '2',
    },
    items: [
      {
        taskCode: 'G12022',
        titleEn: 'Product Development',
        taskEn: '- Optimal process design and new process development for FCBGA substrates\\n- Design optimization support for high-performance server/AI products',
        qlfctEn: '- Those with 3+ years of relevant experience in semiconductor/substrate product development',
        favorEn: '- PH.D degree in a related major\\n- Proficient in design programs such as AutoCAD',
        memoEn: '- Employment Type : Regular (Full-time)',
        workPlaceEn: '- Busan',
        sort: 0,
      },
      {
        taskCode: 'G12021',
        titleEn: 'Process Development',
        taskEn: '- Acquisition of processing technology for new package products and process improvement\\n- Development of plating technology',
        qlfctEn: '- Those with 3+ years of relevant experience in semiconductor/substrate Process Development/Equipment Development',
        favorEn: '- PH.D degree in a related major\\n- Those with experience in plating/surface treatment',
        memoEn: '- Employment Type : Regular (Full-time)',
        workPlaceEn: '- Busan',
        sort: 1,
      },
      {
        taskCode: 'G12025',
        titleEn: 'Quality Assurance',
        taskEn: '- Reliability test design and evaluation\\n- Defect analysis and failure mechanism identification',
        qlfctEn: '- Those with 3+ years of relevant experience in quality or technical work in PCB-related industry (packaging)',
        favorEn: "- Bachelor's degree or above in a related major\\n- Those with experience in failure analysis and reliability evaluation (ALT)",
        memoEn: '- Employment Type : Regular (Full-time)',
        workPlaceEn: '- Busan',
        sort: 2,
      },
      {
        taskCode: 'G4010',
        titleEn: 'Procurement',
        taskEn: '- Development procurement of raw materials for packages\\n- Establishment of raw material operation strategy',
        qlfctEn: '- Those with 5+ years of relevant experience in Japan-related business or package-related work',
        favorEn: "- Bachelor's degree or above in a related major\\n- Those with advanced Japanese conversation skills",
        memoEn: '- Employment Type : Regular (Full-time)',
        workPlaceEn: '- Busan',
        sort: 3,
      },
      {
        taskCode: 'G121042',
        titleEn: 'Marketing',
        taskEn: '- Discovery of customer B/O and execution of Design In activities\\n- Market sensing for package substrates',
        qlfctEn: '- Those with 3+ years of relevant experience in FCBGA product development or customer engagement',
        favorEn: '- Those with intermediate or higher English conversation skills\\n- Those with experience in engaging with Americas Big Tech customers',
        memoEn: '- Employment Type : Regular (Full-time)',
        workPlaceEn: '- Suwon, Gyeonggi-do',
        sort: 4,
      },
      {
        taskCode: 'G121003',
        titleEn: 'Sales',
        taskEn: '- Dedicated management of Americas package substrate customers\\n- Global SCM and supply risk management',
        qlfctEn: '- Those with 4+ years of relevant experience in the semiconductor, substrate, or OSAT industry',
        favorEn: '- Those with intermediate or higher English conversation skills\\n- Those with experience in engaging with Big Tech customers',
        memoEn: '- Employment Type : Regular (Full-time)',
        workPlaceEn: '- Suwon, Gyeonggi-do',
        sort: 5,
      },
    ],
  },
}

test('Samsung Electro-Mechanics validates the official homepage and exact-company Samsung Careers page contract', async () => {
  const sem = await loadSamsungElectroMechanicsModule()

  assert.equal(sem.SOURCE, SOURCE)
  assert.equal(sem.COMPANY, COMPANY)
  assert.equal(sem.COMPANY_CODE, COMPANY_CODE)
  assert.equal(sem.HOMEPAGE_URL, HOMEPAGE_URL)
  assert.equal(sem.COMPANY_PAGE_URL, COMPANY_PAGE_URL)
  assert.equal(sem.LIST_URL, LIST_URL)
  assert.equal(sem.DETAIL_URL, DETAIL_URL)
  assert.equal(sem.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(sem.hasExactCompanyPageSignal(COMPANY_PAGE_HTML), true)
  assert.equal(sem.hasExactCompanyPageSignal(LIVEISH_COMPANY_PAGE_HTML), true)
  assert.equal(sem.hasNoCurrentPostingsSignal(EMPTY_LIST_HTML), true)
  assert.deepEqual(
    sem.extractRoleCodesFromCompanyPage(COMPANY_PAGE_HTML),
    ['G12022', 'G12021', 'G12025', 'G4010', 'G121042', 'G121003'],
  )
})

test('Samsung Electro-Mechanics parses the exact-company public listing HTML and detail payload into job rows', async () => {
  const sem = await loadSamsungElectroMechanicsModule()
  const cards = sem.extractListingCards(LIST_HTML)

  assert.deepEqual(cards, [
    {
      seq: 22584,
      seqno: 18456,
      companyKr: '삼성전기',
      title: '경력사원 채용(패키지 부문)',
      recruitType: '경력',
      postingDate: '2026-06-26',
      closingDate: '2026-07-13',
      sourceUrl: SOURCE_URL,
      applyUrl: APPLY_URL,
      flags: ['제품개발', '공정개발', '품질', '구매', '마케팅', '영업'],
    },
  ])

  const jobs = sem.extractJobsFromDetailPayload({
    payload: DETAIL_PAYLOAD,
    listingCard: cards[0],
    scrapedAt: '2026-07-11T00:00:00.000Z',
  })

  assert.equal(jobs.length, 6)
  assert.deepEqual(jobs[0], {
    title: 'Product Development',
    company: COMPANY,
    location: 'Busan, South Korea',
    city: 'Busan',
    state: null,
    country: 'South Korea',
    jobId: '22584-G12022',
    requisitionId: '22584-G12022',
    sourceUrl: SOURCE_URL,
    applyUrl: APPLY_URL,
    employmentType: 'Full-time',
    experienceRequired: '3+ years',
    minimumQualification: 'Those with 3+ years of relevant experience in semiconductor/substrate product development',
    preferredQualification: 'PH.D degree in a related major\nProficient in design programs such as AutoCAD',
    requiredSkills: [
      'Optimal process design and new process development for FCBGA substrates',
      'Design optimization support for high-performance server/AI products',
    ],
    postingDate: new Date('2026-06-26T00:00:00.000Z'),
    closingDate: new Date('2026-07-13T00:00:00.000Z'),
    jobDescription: [
      'Posting: 경력사원 채용(패키지 부문)',
      'Responsibilities:',
      'Optimal process design and new process development for FCBGA substrates',
      'Design optimization support for high-performance server/AI products',
      'Qualifications:',
      'Those with 3+ years of relevant experience in semiconductor/substrate product development',
      'Preferences:',
      'PH.D degree in a related major',
      'Proficient in design programs such as AutoCAD',
      'Notes:',
      'Employment Type : Regular (Full-time)',
    ].join('\n'),
    remoteStatus: 'On-site',
    department: '경력사원 채용(패키지 부문)',
    source: SOURCE,
    link: APPLY_URL,
    companyCareerPage: COMPANY_PAGE_URL,
    companyDomain: 'samsungcareers.com',
    atsPlatform: 'samsung-careers',
    scrapedTimestamp: new Date('2026-07-11T00:00:00.000Z'),
  })
  assert.equal(jobs[4].title, 'Marketing')
  assert.equal(jobs[4].city, 'Suwon')
  assert.equal(jobs[4].state, 'Gyeonggi-do')
  assert.equal(jobs[5].title, 'Sales')
  assert.equal(jobs[5].experienceRequired, '4+ years')
})

test('Samsung Electro-Mechanics run() validates the route chain, posts the exact company filter, and returns public jobs from detail payloads', async () => {
  const sem = await loadSamsungElectroMechanicsModule()
  const requestedText = []
  const requestedJson = []

  const jobs = await sem.createSamsungElectroMechanicsScraper({
    now: () => '2026-07-11T00:00:00.000Z',
  }).run({
    fetchText: async (url, options = {}) => {
      requestedText.push({
        url,
        method: options.method || 'GET',
        body: options.body ? options.body.toString() : null,
      })

      if (url === HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === COMPANY_PAGE_URL) return COMPANY_PAGE_HTML
      if (url === LIST_URL && (options.method || 'GET') === 'POST') return LIST_HTML

      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      if (url === `${DETAIL_URL}?seqno=22584&strCode=`) return DETAIL_PAYLOAD
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedText, [
    { url: HOMEPAGE_URL, method: 'GET', body: null },
    { url: COMPANY_PAGE_URL, method: 'GET', body: null },
    {
      url: LIST_URL,
      method: 'POST',
      body: 'currentPageNo=1&intNo=0&strVal=&strTxt=&strKey=&strCompany=C40&strType=&strOrderBy=&strEntity=',
    },
  ])
  assert.deepEqual(requestedJson, [`${DETAIL_URL}?seqno=22584&strCode=`])
  assert.equal(jobs.length, 6)
  assert.equal(jobs[0].source, SOURCE)
  assert.equal(jobs[0].company, COMPANY)
  assert.equal(jobs[0].applyUrl, APPLY_URL)
  assert.equal(jobs[0].companyCareerPage, COMPANY_PAGE_URL)
  assert.equal(jobs[0].companyDomain, 'samsungcareers.com')
  assert.equal(jobs[0].atsPlatform, 'samsung-careers')
})

test('Samsung Electro-Mechanics returns an empty set when the official C40 listings endpoint reports no current postings', async () => {
  const sem = await loadSamsungElectroMechanicsModule()
  const requestedJson = []

  const jobs = await sem.createSamsungElectroMechanicsScraper().run({
    fetchText: async (url, options = {}) => {
      if (url === HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === COMPANY_PAGE_URL) return LIVEISH_COMPANY_PAGE_HTML
      if (url === LIST_URL && (options.method || 'GET') === 'POST') return EMPTY_LIST_HTML
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      return DETAIL_PAYLOAD
    },
  })

  assert.deepEqual(jobs, [])
  assert.deepEqual(requestedJson, [])
})

test('Samsung Electro-Mechanics fails closed when the exact company identity drifts or the listing mixes companies', async () => {
  const sem = await loadSamsungElectroMechanicsModule()

  await assert.rejects(
    sem.createSamsungElectroMechanicsScraper().run({
      fetchText: async (url, options = {}) => {
        if (url === HOMEPAGE_URL) return HOMEPAGE_HTML
        if (url === COMPANY_PAGE_URL) {
          return COMPANY_PAGE_HTML.replace('data-index="C40"', 'data-index="C31"')
        }
        if (url === LIST_URL && (options.method || 'GET') === 'POST') return LIST_HTML
        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async () => DETAIL_PAYLOAD,
    }),
    /exact-company samsung careers page/i,
  )

  await assert.rejects(
    sem.createSamsungElectroMechanicsScraper().run({
      fetchText: async (url, options = {}) => {
        if (url === HOMEPAGE_URL) return HOMEPAGE_HTML
        if (url === COMPANY_PAGE_URL) return COMPANY_PAGE_HTML
        if (url === LIST_URL && (options.method || 'GET') === 'POST') {
          return LIST_HTML.replace('<p class="company">삼성전기</p>', '<p class="company">삼성SDI</p>')
        }
        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async () => DETAIL_PAYLOAD,
    }),
    /listing html/i,
  )

  assert.throws(
    () => sem.extractJobsFromDetailPayload({
      payload: {
        ...DETAIL_PAYLOAD,
        data: {
          ...DETAIL_PAYLOAD.data,
          result: {
            ...DETAIL_PAYLOAD.data.result,
            cmpNameEn: 'Samsung SDI',
          },
        },
      },
      listingCard: sem.extractListingCards(LIST_HTML)[0],
      scrapedAt: '2026-07-11T00:00:00.000Z',
    }),
    /exact company/i,
  )
})
