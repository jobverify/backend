import { createHash } from 'node:crypto'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

const check = (ok, message) => { if (!ok) throw new Error(`Brillio native application country: ${message}`) }
const normalized = value => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase()
const sha = value => createHash('sha256').update(value).digest('hex')
const children = (node, predicate) => node?.inert ? [] : [...(node && predicate(node) ? [node] : []), ...(node?.children || []).filter(child => typeof child !== 'string').flatMap(child => children(child, predicate))]

export const resolveNativeApplicationCountry = async (listing, detail, get) => {
  check(detail.sourceDetailComplete === true && detail.title === listing.title, 'full role identity is unqualified')
  const privacy = new URL(detail.applyUrl)
  check(privacy.origin === 'https://careers.brillio.com' && privacy.pathname === '/privacy-notice'
    && privacy.searchParams.get('job-id') === listing.jobId, 'role-owned first-party application handoff is unbound')
  const privacyHTML = await get(privacy.href)
  const document = readNativeDocument(privacyHTML)
  const heading = document.nodes(node => node.tag === 'h2' && document.hasClass(node, 'privacy-speak-single-name'))
  const titles = heading.flatMap(node => children(node, child => child.tag === 'span' && document.hasClass(child, 'subhead-font-bold')))
  check(titles.length === 1 && normalized(document.text(titles[0])) === normalized(listing.title), 'first-party application title identity changed')
  const proceed = document.nodes(node => node.tag === 'a' && document.text(node) === 'Proceed' && node.attrs.href)
  check(proceed.length === 1, 'unique published employer handoff is missing')
  const application = new URL(proceed[0].attrs.href)
  const path = /^\/brillio-2\/([a-f0-9-]{36})\/apply$/.exec(application.pathname)
  check(application.origin === 'https://jobs.lever.co' && !application.search && !application.hash && path, 'published employer handoff binding changed')
  const nativeURL = `https://api.lever.co/v0/postings/brillio-2/${path[1]}`
  const raw = await get(nativeURL)
  const native = JSON.parse(raw)
  check(native.id === path[1] && normalized(native.text) === normalized(listing.title)
    && native.hostedUrl === application.href.replace(/\/apply$/, '') && native.applyUrl === application.href, 'native employer/post identity or title is not bound to its published application')
  const locations = native.categories?.allLocations
  check(typeof native.categories?.location === 'string'
    && normalized(native.categories.location.split(',')[0]) === normalized(listing.location)
    && Array.isArray(locations) && locations.length > 0
    && locations.every(location => location === native.categories.location), 'native worksite alternatives do not bind to the unresolved listing')
  check(['US', 'IN'].includes(native.country), 'explicit qualified native country is missing')
  return { jobId: listing.jobId, country: native.country === 'US' ? 'United States' : 'India',
    method: 'role-owned-published-application-native-country', nativeCountryCode: native.country,
    nativePostingId: native.id, nativeLocation: native.categories.location,
    sourceURL: listing.detailUrl, handoffURL: privacy.href, applicationURL: application.href, nativeURL,
    handoffSHA256: sha(privacyHTML), nativeSHA256: sha(raw) }
}
