import assert from 'node:assert/strict'
import test from 'node:test'

const SOURCE = 'pisemi'
const COMPANY = 'PISemi'
const HOMEPAGE_URL = 'https://www.pisemi.com/'
const JOIN_US_URL = 'https://www.pisemi.com/joinus/'
const CONTACT_URL = 'https://www.pisemi.com/contactus/'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="zh-CN">
  <head>
    <title>精控集成半导体 - PI Semi | 模拟和混合信号芯片开发</title>
    <link rel="canonical" href="https://www.pisemi.com/" />
  </head>
  <body>
    <h1>芯技术驱动智慧科技 - 精控集成</h1>
    <p>精控集成半导体成立于2020年5月，专注于中高端模拟芯片的设计研发。</p>
    <p>公司总部位于杭州，在上海、美国及印度均设有研发中心。</p>
    <a href="/joinus/">JOIN US</a>
    <a href="mailto:info@pisemi.com">info@pisemi.com</a>
  </body>
</html>
`

const JOIN_US_HTML = `
<!doctype html>
<html lang="zh-CN">
  <head>
    <title>精控集成半导体 - PI Semi | 模拟和混合信号芯片开发 - 专注模拟和混合信号产品研发</title>
    <link rel="canonical" href="https://www.pisemi.com/joinus/" />
  </head>
  <body>
    <h1>RECRUITMENT 加入精控</h1>
    <p>我们非常欢迎与我们拥有共同价值观并致力于与我们共同成长的人才加入。</p>
    <section>
      <h2>JOB INFORMATION 岗位信息</h2>
      <article>
        <a href="/h-nd-51.html">模拟电路设计工程师_BMS/Optical</a>
        <time>2023-05-06</time>
        <p>2年以上工作经验，工作地点：上海/深圳。</p>
      </article>
      <article>
        <a href="/h-nd-50.html">资深模拟电路设计工程师—BMS/Optical</a>
        <time>2023-05-06</time>
        <p>10年以上工作经验，工作地点：上海/深圳。</p>
      </article>
      <article>
        <a href="/h-nd-63.html">现场应用工程师—BMS</a>
        <time>2023-05-06</time>
        <p>5年以上工作经验，工作地点：上海/深圳。</p>
      </article>
      <article>
        <a href="/h-nd-62.html">产品管理高级经理—BMS</a>
        <time>2023-05-06</time>
        <p>8年以上工作经验，工作地点：上海/深圳。</p>
      </article>
      <article>
        <a href="/h-nd-61.html">产品工程师</a>
        <time>2023-05-06</time>
        <p>2年以上工作经验，工作地点：上海。</p>
      </article>
      <article>
        <a href="/h-nd-60.html">DFT工程师</a>
        <time>2023-05-06</time>
        <p>5年以上工作经验，工作地点：上海/深圳。</p>
      </article>
      <article>
        <a href="/h-nd-59.html">P&amp;R工程师</a>
        <time>2023-05-06</time>
        <p>5年以上工作经验，工作地点：上海/深圳。</p>
      </article>
      <article>
        <a href="/h-nd-58.html">集成电路数字设计工程师</a>
        <time>2023-05-06</time>
        <p>5年以上工作经验，工作地点：上海/深圳。</p>
      </article>
      <article>
        <a href="/h-nd-57.html">数字IC验证工程师</a>
        <time>2023-05-06</time>
        <p>5年以上工作经验，工作地点：上海/深圳。</p>
      </article>
      <article>
        <a href="/h-nd-56.html">模拟电路应用工程师</a>
        <time>2023-05-06</time>
        <p>5年以上工作经验，工作地点：上海。</p>
      </article>
      <article>
        <a href="/h-nd-55.html">测试工程师</a>
        <time>2023-05-06</time>
        <p>2年以上工作经验，工作地点：上海。</p>
      </article>
      <article>
        <a href="/h-nd-54.html">芯片功能安全经理</a>
        <time>2023-05-06</time>
        <p>5年以上工作经验，工作地点：上海。</p>
      </article>
      <article>
        <a href="/h-nd-53.html">模拟电路版图工程师</a>
        <time>2023-05-06</time>
        <p>2年以上工作经验，工作地点：上海。</p>
      </article>
      <article>
        <a href="/h-nd-52.html">高级模拟电路版图工程师</a>
        <time>2023-05-06</time>
        <p>10年以上工作经验，工作地点：上海。</p>
      </article>
    </section>
    <section>
      <h2>MORE JOBS</h2>
      <p>更多岗位和招聘信息请扫描下方二维码</p>
      <p>51JOB BOSS直聘 猎聘</p>
    </section>
    <a href="mailto:info@pisemi.com">info@pisemi.com</a>
  </body>
</html>
`

const CONTACT_HTML = `
<!doctype html>
<html lang="zh-CN">
  <head>
    <title>精控集成半导体 - PI Semi | 模拟和混合信号芯片开发 - 专注模拟和混合信号产品研发</title>
  </head>
  <body>
    <h1>CONTACT US 联系我们</h1>
    <p>联系我们： info@pisemi.com</p>
    <p>HANGZHOU SHANGHAI US INDIA UK</p>
    <a href="https://www.linkedin.com/company/pi-semiconductor">LinkedIn</a>
  </body>
</html>
`

const JOIN_US_WITH_INDIA_JOB_HTML = JOIN_US_HTML.replace(
  '2年以上工作经验，工作地点：上海/深圳。',
  '2年以上工作经验，工作地点：班加罗尔，印度。',
)

const loadPisemiModule = async () => import('./script.js')

test('PISemi scraper recognizes the verified official homepage, joinus page, and India office contact signal', async () => {
  const pisemi = await loadPisemiModule()

  assert.equal(pisemi.SOURCE, SOURCE)
  assert.equal(pisemi.COMPANY, COMPANY)
  assert.equal(pisemi.HOMEPAGE_URL, HOMEPAGE_URL)
  assert.equal(pisemi.JOIN_US_URL, JOIN_US_URL)
  assert.equal(pisemi.CONTACT_URL, CONTACT_URL)
  assert.equal(pisemi.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(pisemi.hasJoinUsSignal(JOIN_US_HTML), true)
  assert.equal(pisemi.hasIndiaOfficeSignal(CONTACT_HTML), true)
})

test('PISemi scraper extracts the verified public role cards and confirms they are all China-only', async () => {
  const pisemi = await loadPisemiModule()

  const jobs = pisemi.extractRoleCards(JOIN_US_HTML)

  assert.deepEqual(
    jobs.map((job) => [job.title, job.locationSummary, job.detailUrl]),
    [
      ['模拟电路设计工程师_BMS/Optical', '2年以上工作经验，工作地点：上海/深圳。', 'https://www.pisemi.com/h-nd-51.html'],
      ['资深模拟电路设计工程师—BMS/Optical', '10年以上工作经验，工作地点：上海/深圳。', 'https://www.pisemi.com/h-nd-50.html'],
      ['现场应用工程师—BMS', '5年以上工作经验，工作地点：上海/深圳。', 'https://www.pisemi.com/h-nd-63.html'],
      ['产品管理高级经理—BMS', '8年以上工作经验，工作地点：上海/深圳。', 'https://www.pisemi.com/h-nd-62.html'],
      ['产品工程师', '2年以上工作经验，工作地点：上海。', 'https://www.pisemi.com/h-nd-61.html'],
      ['DFT工程师', '5年以上工作经验，工作地点：上海/深圳。', 'https://www.pisemi.com/h-nd-60.html'],
      ['P&R工程师', '5年以上工作经验，工作地点：上海/深圳。', 'https://www.pisemi.com/h-nd-59.html'],
      ['集成电路数字设计工程师', '5年以上工作经验，工作地点：上海/深圳。', 'https://www.pisemi.com/h-nd-58.html'],
      ['数字IC验证工程师', '5年以上工作经验，工作地点：上海/深圳。', 'https://www.pisemi.com/h-nd-57.html'],
      ['模拟电路应用工程师', '5年以上工作经验，工作地点：上海。', 'https://www.pisemi.com/h-nd-56.html'],
      ['测试工程师', '2年以上工作经验，工作地点：上海。', 'https://www.pisemi.com/h-nd-55.html'],
      ['芯片功能安全经理', '5年以上工作经验，工作地点：上海。', 'https://www.pisemi.com/h-nd-54.html'],
      ['模拟电路版图工程师', '2年以上工作经验，工作地点：上海。', 'https://www.pisemi.com/h-nd-53.html'],
      ['高级模拟电路版图工程师', '10年以上工作经验，工作地点：上海。', 'https://www.pisemi.com/h-nd-52.html'],
    ],
  )

  assert.equal(jobs.every((job) => pisemi.isChinaOnlyJob(job)), true)
  assert.equal(jobs.some((job) => pisemi.isIndiaJob(job)), false)
})

test('PISemi scraper run() validates the verified first-party surface and returns an empty set while no India jobs are published', async () => {
  const pisemi = await loadPisemiModule()
  const fetchText = async (url) => {
    if (url === HOMEPAGE_URL) return HOMEPAGE_HTML
    if (url === JOIN_US_URL) return JOIN_US_HTML
    if (url === CONTACT_URL) return CONTACT_HTML
    throw new Error(`Unexpected URL ${url}`)
  }

  const jobs = await pisemi.createPisemiScraper().run({ fetchText })

  assert.deepEqual(jobs, [])
})

test('PISemi checks the complete embedded role list when only ten cards are rendered', async () => {
  const pisemi = await loadPisemiModule()
  let visibleCount = 0
  const visibleHtml = JOIN_US_HTML.replace(/<article>[\s\S]*?<\/article>/g, (article) => {
    visibleCount += 1
    return visibleCount <= 10 ? article : ''
  })
  const rows = pisemi.EXPECTED_ROLE_CARDS.map((card) => ({
    id: Number(card.detailUrl.match(/h-nd-(\d+)/)[1]),
    title: card.title,
    summary: card.locationSummary,
    url: new URL(card.detailUrl).pathname,
  }))
  const withModule = (items) => `${visibleHtml}<script>"module550":{"newsList":${JSON.stringify(items)}}</script>`
  const fetchText = async (url) => {
    if (url === HOMEPAGE_URL) return HOMEPAGE_HTML
    if (url === JOIN_US_URL) return withModule(rows)
    if (url === CONTACT_URL) return CONTACT_HTML
    throw new Error(`Unexpected URL ${url}`)
  }

  assert.equal(pisemi.extractRoleCards(withModule(rows)).length, 10)
  assert.deepEqual(pisemi.extractEmbeddedRoleCards(withModule(rows)), pisemi.EXPECTED_ROLE_CARDS)
  assert.deepEqual(await pisemi.createPisemiScraper().run({ fetchText }), [])

  const indiaRows = [...rows, { id: 999, title: 'Engineer', summary: 'Bangalore, India', url: '/h-nd-999.html' }]
  await assert.rejects(
    pisemi.createPisemiScraper().run({
      fetchText: async (url) => url === JOIN_US_URL ? withModule(indiaRows) : fetchText(url),
    }),
    /now exposes India jobs/i,
  )
})

test('PISemi scraper fails closed when the verified first-party board starts exposing India jobs', async () => {
  const pisemi = await loadPisemiModule()
  const fetchText = async (url) => {
    if (url === HOMEPAGE_URL) return HOMEPAGE_HTML
    if (url === JOIN_US_URL) return JOIN_US_WITH_INDIA_JOB_HTML
    if (url === CONTACT_URL) return CONTACT_HTML
    throw new Error(`Unexpected URL ${url}`)
  }

  await assert.rejects(
    pisemi.createPisemiScraper().run({ fetchText }),
    /now exposes India jobs/i,
  )
})
