import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { verifyPublicInventory, defaultFetchListings } from './publicInventory.js'
export const SOURCE = 'vimaan'
export const COMPANY = 'Vimaan'
export const HOMEPAGE_URL = 'https://vimaan.ai/'
export const ABOUT_URL = 'https://vimaan.ai/company/'
export const CONTACT_URL = 'https://vimaan.ai/contact-us/'
export const CAREERS_URL = 'https://vimaan.ai/careers/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/[’‘]/g, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  const current = /<title>AI for Inventory Visibility and Inventory Accuracy \| Vimaan<\/title>/i.test(html)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/vimaan\.ai\/["']/i.test(html)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']VIMAAN["']/i.test(html)
    && ['stortrack','palletscan','parcelscan','packview','computer vision','inventory accuracy','careers'].every(marker=>normalized.includes(marker))
  return current || normalized.includes('100% inventory accuracy & visibility')
    && normalized.includes('computer vision that brings real-world accuracy to your warehouse')
    && normalized.includes('dozens of warehouses use vimaan')
    && normalized.includes('careers')
}

export const hasOfficialAboutSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('about vimaan')
    && normalized.includes('at vimaan we have no limits')
    && normalized.includes('vimaan is a computer vision and ai solution company')
    && normalized.includes('based in the heart of silicon valley, vimaan was founded by kg ganapathi in 2017')
    && normalized.includes('roles include')
}

export const hasOfficialContactSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes("let's talk")
    && normalized.includes('our warehouse automation experts are available')
    && normalized.includes('we typically get back to queries within a single day')
    && normalized.includes('sales@vimaan.ai')
    && normalized.includes('2391 zanker rd, suite 360, san jose, ca 95131')
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('careers')
    && normalized.includes('big brains wanted')
    && normalized.includes('vimaan job openings')
    && normalized.includes("it's true, we only want you for your brain")
    && normalized.includes('the demand for vimaan solutions has never been greater')
    && normalized.includes('remote positions only')
    && normalized.includes('javascript must be enabled in order to view listings')
    && normalized.includes('load more listings')
}

export const hasRenderedPublicJobCards = (html) => {
  const page = String(html ?? '')

  return /class=["'][^"']*\bjob_listing\b[^"']*["']/i.test(page)
    || /class=["'][^"']*\btype-job_listing\b[^"']*["']/i.test(page)
    || /href=["'][^"']*\/jobs\/[^"']+["']/i.test(page)
    || /\bapply for job\b/i.test(page)
    || /\bview details\b/i.test(page)
}

export const createVimaanScraper = () => ({
  async run({ fetchPage = defaultFetchPage, fetchListings = defaultFetchListings } = {}) {
    const homepagePage = await fetchPage(HOMEPAGE_URL)
    if (homepagePage.status !== 200 || !hasOfficialHomepageSignal(homepagePage.html)) {
      throw new Error('Vimaan homepage changed materially or no longer matches the verified official site')
    }

    const aboutPage = await fetchPage(ABOUT_URL)
    if (aboutPage.status !== 200 || !hasOfficialAboutSignal(aboutPage.html)) {
      throw new Error('Vimaan about page changed materially or no longer matches the verified official site')
    }

    const contactPage = await fetchPage(CONTACT_URL)
    if (contactPage.status !== 200 || !hasOfficialContactSignal(contactPage.html)) {
      throw new Error('Vimaan contact page changed materially or no longer matches the verified official site')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Vimaan careers page changed materially or no longer matches the verified public shell')
    }

    if (hasRenderedPublicJobCards(careersPage.html)) {
      throw new Error('Vimaan careers page now appears to expose rendered public job cards')
    }

    if (/job_manager_ajax_filters/.test(careersPage.html)) {
      if (!careersPage.html.includes('/jm-ajax/%%endpoint%%/')) throw new Error('Vimaan jobs API handoff changed')
      return verifyPublicInventory(fetchListings)
    }
    return attachInventoryEvidence([], { status: 'discovery-only', surface: CAREERS_URL, firstParty: true, listingComplete: false, pagesFetched: 1, verifiedAt: new Date().toISOString(), reason: 'Verified careers shell without an enumerable jobs API handoff' })
  },
})

export const run = async (options = {}) => createVimaanScraper().run(options)
