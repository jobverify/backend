import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'pisemi'
export const COMPANY = 'PISemi'
export const HOMEPAGE_URL = 'https://www.pisemi.com/'
export const JOIN_US_URL = 'https://www.pisemi.com/joinus/'
export const CONTACT_URL = 'https://www.pisemi.com/contactus/'

export const EXPECTED_ROLE_CARDS = [
  {
    title: '模拟电路设计工程师_BMS/Optical',
    locationSummary: '2年以上工作经验，工作地点：上海/深圳。',
    detailUrl: 'https://www.pisemi.com/h-nd-51.html',
  },
  {
    title: '资深模拟电路设计工程师—BMS/Optical',
    locationSummary: '10年以上工作经验，工作地点：上海/深圳。',
    detailUrl: 'https://www.pisemi.com/h-nd-50.html',
  },
  {
    title: '现场应用工程师—BMS',
    locationSummary: '5年以上工作经验，工作地点：上海/深圳。',
    detailUrl: 'https://www.pisemi.com/h-nd-63.html',
  },
  {
    title: '产品管理高级经理—BMS',
    locationSummary: '8年以上工作经验，工作地点：上海/深圳。',
    detailUrl: 'https://www.pisemi.com/h-nd-62.html',
  },
  {
    title: '产品工程师',
    locationSummary: '2年以上工作经验，工作地点：上海。',
    detailUrl: 'https://www.pisemi.com/h-nd-61.html',
  },
  {
    title: 'DFT工程师',
    locationSummary: '5年以上工作经验，工作地点：上海/深圳。',
    detailUrl: 'https://www.pisemi.com/h-nd-60.html',
  },
  {
    title: 'P&R工程师',
    locationSummary: '5年以上工作经验，工作地点：上海/深圳。',
    detailUrl: 'https://www.pisemi.com/h-nd-59.html',
  },
  {
    title: '集成电路数字设计工程师',
    locationSummary: '5年以上工作经验，工作地点：上海/深圳。',
    detailUrl: 'https://www.pisemi.com/h-nd-58.html',
  },
  {
    title: '数字IC验证工程师',
    locationSummary: '5年以上工作经验，工作地点：上海/深圳。',
    detailUrl: 'https://www.pisemi.com/h-nd-57.html',
  },
  {
    title: '模拟电路应用工程师',
    locationSummary: '5年以上工作经验，工作地点：上海。',
    detailUrl: 'https://www.pisemi.com/h-nd-56.html',
  },
  {
    title: '测试工程师',
    locationSummary: '2年以上工作经验，工作地点：上海。',
    detailUrl: 'https://www.pisemi.com/h-nd-55.html',
  },
  {
    title: '芯片功能安全经理',
    locationSummary: '5年以上工作经验，工作地点：上海。',
    detailUrl: 'https://www.pisemi.com/h-nd-54.html',
  },
  {
    title: '模拟电路版图工程师',
    locationSummary: '2年以上工作经验，工作地点：上海。',
    detailUrl: 'https://www.pisemi.com/h-nd-53.html',
  },
  {
    title: '高级模拟电路版图工程师',
    locationSummary: '10年以上工作经验，工作地点：上海。',
    detailUrl: 'https://www.pisemi.com/h-nd-52.html',
  },
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&mdash;|&ndash;/gi, '-')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const toAbsoluteUrl = (value) => {
  try {
    return new URL(String(value ?? ''), HOMEPAGE_URL).toString()
  } catch {
    return null
  }
}

const extractPlainText = (html) => stripTags(
  String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = extractPlainText(page)

  return /<title>\s*精控集成半导体\s*-\s*PI Semi\s*\|\s*模拟和混合信号芯片开发\s*<\/title>/i.test(page)
    && text.includes('精控集成半导体成立于2020年5月')
    && text.includes('公司总部位于杭州，在上海、美国及印度均设有研发中心')
    && /href=["']\/joinus\/["']/i.test(page)
    && /info@pisemi\.com/i.test(page)
}

export const hasJoinUsSignal = (html) => {
  const page = String(html ?? '')
  const text = extractPlainText(page)

  return /<title>\s*精控集成半导体\s*-\s*PI Semi/i.test(page)
    && text.includes('RECRUITMENT 加入精控')
    && text.includes('JOB INFORMATION 岗位信息')
    && text.includes('更多岗位和招聘信息请扫描下方二维码')
    && text.includes('51JOB BOSS直聘 猎聘')
    && /info@pisemi\.com/i.test(page)
}

export const hasIndiaOfficeSignal = (html) => {
  const page = String(html ?? '')
  const text = extractPlainText(page)

  return text.includes('CONTACT US 联系我们')
    && text.includes('HANGZHOU SHANGHAI US INDIA UK')
    && /https:\/\/www\.linkedin\.com\/company\/pi-semiconductor/i.test(page)
    && /info@pisemi\.com/i.test(page)
}

const extractActualRoleCards = (html) => [...String(html ?? '').matchAll(
  /<a\b[^>]*href=["'](?<href>\/h-nd-\d+\.html)["'][^>]*class=["'][^"']*news_list_item_inner[^"']*["'][^>]*>(?<inner>[\s\S]*?)<\/a>/gi,
)]
  .map((match) => {
    const title = stripTags(
      match.groups.inner.match(/<h4\b[^>]*class=["'][^"']*news_list_item_title[^"']*["'][^>]*>([\s\S]*?)<\/h4>/i)?.[1],
    )
    const locationSummary = stripTags(
      match.groups.inner.match(/<div\b[^>]*class=["'][^"']*news_list_item_summery[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1],
    )
    const detailUrl = toAbsoluteUrl(match.groups.href)

    if (!title || !locationSummary || !detailUrl) return null

    return {
      title,
      locationSummary,
      detailUrl,
    }
  })
  .filter(Boolean)

const extractFallbackRoleCards = (html) => [...String(html ?? '').matchAll(
  /<article\b[^>]*>[\s\S]*?<a\b[^>]*href=["'](?<href>[^"']*h-nd-\d+\.html)["'][^>]*>(?<title>[\s\S]*?)<\/a>[\s\S]*?<p\b[^>]*>(?<summary>[\s\S]*?)<\/p>[\s\S]*?<\/article>/gi,
)]
  .map((match) => {
    const title = stripTags(match.groups.title)
    const locationSummary = stripTags(match.groups.summary)
    const detailUrl = toAbsoluteUrl(match.groups.href)

    if (!title || !locationSummary || !detailUrl) return null

    return {
      title,
      locationSummary,
      detailUrl,
    }
  })
  .filter(Boolean)

export const extractRoleCards = (html) => {
  const actualCards = extractActualRoleCards(html)
  if (actualCards.length > 0) {
    return actualCards
  }

  return extractFallbackRoleCards(html)
}

// The site renders only the first ten cards in HTML, while its own module data
// contains the full list. Read that list so an India opening on a later page
// cannot be mistaken for a zero-result board.
export const extractEmbeddedRoleCards = (html) => {
  const page = String(html ?? '')
  const moduleStart = page.indexOf('"module550":{')
  if (moduleStart < 0) return []

  const listStart = page.indexOf('"newsList":[', moduleStart)
  if (listStart < 0) throw new Error('PISemi careers module no longer exposes its full role list')
  const arrayStart = page.indexOf('[', listStart)
  let depth = 0
  let inString = false
  let escaped = false
  let arrayEnd = -1
  for (let index = arrayStart; index < page.length; index += 1) {
    const char = page[index]
    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
    } else if (char === '"') inString = true
    else if (char === '[') depth += 1
    else if (char === ']' && --depth === 0) {
      arrayEnd = index + 1
      break
    }
  }
  if (arrayEnd < 0) throw new Error('PISemi careers module role list is incomplete')

  const rows = JSON.parse(page.slice(arrayStart, arrayEnd))
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('PISemi careers module role list is empty')
  }
  return rows.map((row) => {
    const card = {
      title: normalizeWhitespace(row.title),
      locationSummary: normalizeWhitespace(row.summary),
      detailUrl: toAbsoluteUrl(row.url),
    }
    if (!Number.isInteger(row.id) || !card.title || !card.locationSummary
      || card.detailUrl !== `${HOMEPAGE_URL}h-nd-${row.id}.html`) {
      throw new Error('PISemi careers module role entry changed materially')
    }
    return card
  })
}

export const isIndiaJob = (job = {}) =>
  /india|印度|bangalore|bengaluru|班加罗尔/i.test(normalizeWhitespace(job.locationSummary))

export const isChinaOnlyJob = (job = {}) =>
  !isIndiaJob(job)
  && /上海|深圳/i.test(normalizeWhitespace(job.locationSummary))

const roleCardsMatchExpected = (cards = []) =>
  cards.length === EXPECTED_ROLE_CARDS.length
  && cards.every((card, index) => {
    const expected = EXPECTED_ROLE_CARDS[index]
    return expected
      && card.title === expected.title
      && card.locationSummary === expected.locationSummary
      && card.detailUrl === expected.detailUrl
  })

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createPisemiScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('PISemi homepage no longer matches the verified official company surface')
    }

    const joinUsHtml = await fetchText(JOIN_US_URL)
    if (!hasJoinUsSignal(joinUsHtml)) {
      throw new Error('PISemi joinus page no longer matches the verified first-party jobs surface')
    }

    const contactHtml = await fetchText(CONTACT_URL)
    if (!hasIndiaOfficeSignal(contactHtml)) {
      throw new Error('PISemi contact page no longer confirms the verified India office signal')
    }

    const visibleCards = extractRoleCards(joinUsHtml)
    const embeddedCards = extractEmbeddedRoleCards(joinUsHtml)
    const roleCards = embeddedCards.length > 0 ? embeddedCards : visibleCards
    if (roleCards.length === 0) {
      throw new Error('PISemi joinus page no longer exposes the verified public role cards')
    }
    if (embeddedCards.length > 0 && (visibleCards.length === 0 || visibleCards.length > embeddedCards.length
      || visibleCards.some((card, index) => JSON.stringify(card) !== JSON.stringify(embeddedCards[index])))) {
      throw new Error('PISemi visible careers cards no longer match the full module role list')
    }

    if (roleCards.some((job) => isIndiaJob(job))) {
      throw new Error('PISemi verified first-party board now exposes India jobs')
    }

    if (!roleCards.every((job) => isChinaOnlyJob(job))) {
      throw new Error('PISemi verified first-party board no longer exposes only China-based openings')
    }

    if (!roleCardsMatchExpected(roleCards)) {
      throw new Error('PISemi verified public role cards changed materially')
    }

    return []
  },
})

export const run = async (options = {}) => createPisemiScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
