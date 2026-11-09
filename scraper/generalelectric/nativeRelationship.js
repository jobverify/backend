import { createHash } from 'node:crypto'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { createHTMLTransport } from '../../scraper-support/shared/firstPartyHtmlJobs.js'

export const FAQ_URL = 'https://www.ge.com/faq'
const unavailable = (message, cause) => Object.assign(Error('GE current recruiting relationship: ' + message, { cause }), {
  softFailure: true, failureKind: 'source_identity_unverified', abortRetries: true,
})
const requireRelationship = (condition, message) => { if (!condition) throw unavailable(message) }
const descendants = (node, predicate) => node.inert ? [] : [
  ...(predicate(node) ? [node] : []),
  ...node.children.filter(child => typeof child !== 'string').flatMap(child => descendants(child, predicate)),
]
const defaultFetchPage = async (url, { signal }) => {
  const read = createHTMLTransport({ validateURL(value) {
    requireRelationship(value === FAQ_URL, 'unqualified native FAQ URL')
  } }, { signal })
  const page = await read(url)
  return { ...page, body: new TextDecoder('utf-8', { fatal: true }).decode(page.body), capturedAt: page.completedAt }
}

export async function verifyGeRecruitmentRelationship({ fetchPage = defaultFetchPage, signal } = {}) {
  signal?.throwIfAborted()
  const deadline = signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000)
  let listener
  try {
    const page = await Promise.race([
      Promise.resolve().then(() => fetchPage(FAQ_URL, { signal: deadline })),
      new Promise((_, reject) => { listener = () => reject(deadline.reason); deadline.addEventListener('abort', listener, { once: true }) }),
    ])
    deadline.throwIfAborted()
    const contentType = page?.headers?.get?.('content-type') ?? page?.headers?.['content-type']
    requireRelationship(page?.status === 200 && (page.finalUrl ?? page.url) === FAQ_URL
      && typeof page.body === 'string' && Buffer.byteLength(page.body) <= 2 * 1024 * 1024
      && /^text\/html\b/i.test(contentType || ''), 'native HTTP status, final URL, body or HTML MIME unavailable')
    const doc = readNativeDocument(page.body)
    const canonical = doc.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical')
    requireRelationship(canonical.length === 1 && canonical[0].attrs.href === FAQ_URL
      && doc.nodes(node => node.tag === 'title').some(node => /GE Spinoff FAQs.*General Electric/.test(node.raw))
      && doc.nodes(node => node.tag === 'h1').some(node => doc.text(node) === 'Frequently asked questions and answers'),
    'current native FAQ company identity unavailable')
    const items = doc.nodes(node => node.tag === 'div' && doc.hasClass(node, 'wp-block-custom-ge-faq-item'))
    const answer = question => {
      const candidates = items.filter(node => node.children.some(child => typeof child !== 'string'
        && doc.hasClass(child, 'faqItem') && doc.text(child) === question))
      requireRelationship(candidates.length === 1, 'native FAQ question missing or conflicting')
      const bodies = descendants(candidates[0], node => node.tag === 'div' && doc.hasClass(node, 'body-2'))
      requireRelationship(bodies.length === 1, 'native FAQ answer missing or hidden')
      return { text: doc.text(bodies[0]), anchors: descendants(bodies[0], node => node.tag === 'a' && node.attrs.href && doc.text(node)) }
    }
    const identity = answer('What does "GE" stand for?')
    requireRelationship(/GE Aerospace, GE Vernova, and GE HealthCare as independent and publicly traded companies\b/.test(identity.text),
      'current independent-company relationship unavailable')
    const companies = answer('How can I learn more about the standalone public companies going forward?')
    const officialSites = ['https://www.geaerospace.com/', 'https://www.gevernova.com/', 'https://www.gehealthcare.com/']
    requireRelationship(companies.anchors.length === 3 && officialSites.every(url => companies.anchors.some(node => node.attrs.href === url)),
      'current independent company handoffs unavailable')
    const careers = answer('Where can I view jobs at GE?')
    const careerLinks = careers.anchors.map(node => node.attrs.href)
    requireRelationship(careers.text.startsWith('You can search all open positions on the Careers pages below:')
      && ['GE Aerospace Careers', 'GE Vernova Careers', 'GE HealthCare Careers'].every(label => careers.text.includes(label))
      && careerLinks.length === 3 && careerLinks.includes('https://jobs.gecareers.com/aviation/global/en/')
      && careerLinks.includes('https://jobs.gecareers.com/vernova/global/en/')
      && careerLinks.some(url => /^https?:\/\/careers\.gehealthcare\.com\/global\/en\/?$/.test(url)),
    'current independent-company career handoffs unavailable')
    deadline.throwIfAborted()
    const clock = typeof page.capturedAt === 'string' ? Date.parse(page.capturedAt) : NaN
    return { relationship: 'independent-public-companies-career-handoffs', legalEmployerAlias: false,
      companyScopeComplete: false, authoredCareerLinks: careerLinks,
      // Keep the authored HealthCare HTTP link as evidence only. The wrapper
      // invokes the existing child module and never follows/upgrades this URL.
      observation: Number.isFinite(clock) && clock > 0 && clock <= Date.now() ? {
        verifiedAt: new Date(clock).toISOString(), evidence: { method: 'official-independent-company-career-handoffs', url: FAQ_URL,
          responses: [{ url: FAQ_URL, finalUrl: page.finalUrl ?? page.url, status: page.status,
            sha256: createHash('sha256').update(page.body).digest('hex') }] },
      } : null }
  } catch (error) {
    signal?.throwIfAborted()
    deadline.throwIfAborted()
    if (error.failureKind === 'source_identity_unverified') throw error
    throw unavailable('native FAQ read failed', error)
  } finally {
    deadline.removeEventListener('abort', listener)
  }
}
