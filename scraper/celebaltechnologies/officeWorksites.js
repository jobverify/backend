import { createHash } from 'node:crypto'
import { activeHead, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

export const OFFICE_LOCATIONS_URL = 'https://celebaltech.com/about-us/office-locations'
export const isAllCtOffices = location => /^All CT office\s*\/\s*Onsite\s*\(\s*CT office\s*\)$/i.test(String(location || '').trim())
const descendants = (node, predicate) => node?.inert ? [] : [...(node && predicate(node) ? [node] : []), ...(node?.children || []).filter(child => typeof child !== 'string').flatMap(child => descendants(child, predicate))]
const check = (ok, message) => { if (!ok) throw new Error(`Celebal native offices: ${message}`) }

export const hasPublishedOfficeHandoff = html => {
  const document = readNativeDocument(html)
  return document.nodes(node => node.tag === 'a' && node.attrs.href).some(node => {
    try { return new URL(node.attrs.href, 'https://celebaltech.com').href === OFFICE_LOCATIONS_URL && /Office Worldwide Locations/i.test(document.text(node)) } catch { return false }
  })
}

export const readIndiaOfficeWorksites = html => {
  check(activeHead(html).titles.some(title => /^Global Office Locations\s*\|\s*Celebal Tech$/i.test(title)), 'first-party office page identity changed')
  const document = readNativeDocument(html)
  const groups = document.nodes(node => (node.children || []).some(child => typeof child !== 'string' && child.tag === 'h2' && document.text(child) === 'India'))
  check(groups.length === 1, 'one active India office country section is required')
  const addresses = descendants(groups[0], node => node.tag === 'a' && node.attrs.href)
    .filter(node => descendants(node, child => child.tag === 'h3').length === 1)
    .map(node => document.text(node))
  check(addresses.length > 0 && addresses.every(address => address.length > 40)
    && addresses.some(address => /\b\d{6}\b/.test(address)), 'complete native India office address cards are missing')
  return { officePageURL: OFFICE_LOCATIONS_URL, indiaOfficeAddresses: addresses,
    model: JSON.stringify([...addresses].sort()), bodySHA256: createHash('sha256').update(html).digest('hex') }
}
