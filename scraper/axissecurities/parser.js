import { document, norm } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { nativeCountryName, nativeLocationCountryName, nativeDate } from '../../scraper-support/shared/nativeJobPosting.js'
import { extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'

export const requireProof = (ok, message) => { if (!ok) throw Error('Axis Securities: ' + message) }
export const validateCompany = company => requireProof(company?.companyMstrSeq === '296' && company.companyCd === 'AXISSL'
  && company.companyName === 'Axis Securities Limited' && company.domainName === 'axissecurities.ripplehire.com', 'native employer identity mismatch')
export const validateListing = row => {
  requireProof(row && typeof row.jobSeq === 'string' && /^\d+$/.test(row.jobSeq) && row.jobId === row.jobSeq
    && norm(row.jobTitle) && norm(row.locations) && row.allowCareerSite === 'Y', 'invalid native listing identity or status')
  validateGeographicFields(row)
  for (const [key,value] of Object.entries(row)) if (value != null && /expir|validThrough|closingDate|endDate/i.test(key))
    requireProof(false, 'unreviewed native expiry/temporal field')
}
const validateGeographicFields = row => {
  const known = new Set(['jobLocation','locations','jobLocationList','locationCount','countryMstNewSeq'])
  for (const [key,value] of Object.entries(row)) if (value != null && /location|country|state|city|address/i.test(key))
    requireProof(known.has(key), 'unreviewed native primary/secondary geography')
  requireProof(row.jobLocationList == null && row.countryMstNewSeq == null && (row.locationCount == null || row.locationCount === 0), 'unreviewed native secondary locations or country identifier')
  for (const label of [row.jobLocation,row.locations]) if (label != null)
    {
      requireProof(typeof label === 'string' && !/[;|/]|\b(?:worldwide|global|multiple locations|anywhere)\b/i.test(label), 'unknown native multiple-location scope')
      const country = nativeLocationCountryName(label)
      if (country) requireProof(label.split(',').slice(0,-1).every(part => !nativeCountryName(part.trim()) || nativeCountryName(part.trim()) === country), 'contradictory native geographic country/state labels')
    }
}
const activeText = html => {
  const doc = document(html)
  const prune = (node, inherited = false) => {
    node.inactive ||= inherited || /(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test(node.attrs?.style || '')
    node.children.filter(child => typeof child !== 'string').forEach(child => prune(child,node.inactive))
  }
  prune(doc.root)
  return extractActiveDescription(html) ? extractActiveDescription(doc.text(doc.root)) : null
}
export const descriptionContent = (html, title) => {
  if (typeof html !== 'string') return null
  const content = activeText(html)
  const body = activeText(html.replace(/<(h[1-6]|strong|b)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ''))
  const key = value => norm(value).toLowerCase().replace(/[^\p{L}\p{N}]/gu,'')
  if (!content || !body || key(content) === key(title)
    || /^(?:please update the job description|refer to the job description|test job description|job description|responsibilities|requirements)[\s.!:]*$/i.test(body)
    || body.length < 100) return null
  return content
}
const originalPostingDate = value => {
  if (value == null || value === '') return null
  const match = /^(\d{2})-([A-Z][a-z]{2})-(\d{4})$/.exec(value)
  requireProof(match, 'unsupported native jobPostingDate')
  const month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(match[2]) + 1
  requireProof(month > 0, 'invalid native posting month')
  return nativeDate(`${match[3]}-${String(month).padStart(2,'0')}-${match[1]}`, { required: true }).raw
}
const publicationEvidence = row => {
  const candidates = []
  const original = originalPostingDate(row.jobPostingDate)
  if (original) candidates.push({ value: original, source: 'native-jobPostingDate' })
  if (row.publishDetails?.CAREER_SITE != null) candidates.push({ value: nativeDate(row.publishDetails.CAREER_SITE, { required: true }).iso, source: 'native-publishDetails.CAREER_SITE' })
  return candidates.sort((a,b) => Date.parse(a.value) - Date.parse(b.value))[0] || { value: null, source: null }
}
export const postingDate = row => publicationEvidence(row).value
export const readDetail = (payload, listing, total) => {
  validateCompany(payload?.companyVO)
  const row = payload.jobVO
  validateListing(row)
  requireProof(payload.jobSeq === listing.jobSeq && payload.companyMstrSeq === '296' && row.companySeq === '296'
    && row.jobSeq === listing.jobSeq && row.jobTitle === listing.jobTitle && row.jobCode === listing.jobCode
    && norm(row.locations) === norm(listing.locations) && norm(row.jobLocation) === norm(row.locations), 'detail/listing identity or primary location mismatch')
  requireProof(payload.jobCount === total && payload.linkDeactivated === false && payload.nonErLinkDeactivated === false
    && payload.enableLink === 'Y' && row.jobStatus === 'ACTIVE', 'detail inactive or native inventory count changed')
  const country = nativeLocationCountryName(row.jobLocation)
  const publication = publicationEvidence(row)
  return { listing, row, country, description: descriptionContent(row.jobDesc,row.jobTitle), publicationDate: publication.value,
    publicationSource: publication.source }
}
