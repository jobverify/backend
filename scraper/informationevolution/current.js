import { readNativeDocument, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

export const CURRENT_CAREERS_URL = 'https://informationevolution.com/about'
export const CURRENT_ROLES_URL = 'https://informationevolution.com/api/roles'
const requireCurrent = (condition, message) => { if (!condition) throw Error('Information Evolution current careers: ' + message) }
const hasClass = (node, name) => (node.attrs.class || '').split(/\s+/).includes(name)
const compact = value => String(value || '').replace(/\s+/g, '')

export async function runCurrentInformationEvolution({ fetchText, signal, now = () => new Date(), aboutHtml } = {}) {
 signal?.throwIfAborted()
 const get = async url => {
  signal?.throwIfAborted()
  const value = await fetchText(url, { signal })
  signal?.throwIfAborted()
  return value
 }
 const about = aboutHtml ?? await get(CURRENT_CAREERS_URL)
 requireCurrent(/<title[^>]*>Who We Are (?:—|&mdash;) Information Evolution<\/title>/.test(about)
  && /<section[^>]*id="careers"/.test(about) && /Join our team/.test(about), 'official careers handoff changed')
 let rows
 try { rows = JSON.parse(await get(CURRENT_ROLES_URL)) } catch (error) { throw Error('Information Evolution current careers: roles feed unavailable', { cause: error }) }
 requireCurrent(Array.isArray(rows) && rows.length <= 200, 'roles feed malformed or over bound')
 const jobs = [], ids = new Set(), urls = new Set()
 const checkedAt = new Date(now()).toISOString()
 for (const row of rows) {
  requireCurrent(Number.isInteger(row.id) && row.id > 0 && !ids.has(row.id) && typeof row.title === 'string'
   && row.title.trim() && typeof row.location === 'string' && typeof row.apply_url === 'string', 'role identity missing or duplicate')
  const url = new URL(row.apply_url, CURRENT_CAREERS_URL)
  requireCurrent(url.origin === 'https://informationevolution.com' && /^\/careers\/[a-z0-9-]+$/.test(url.pathname)
   && !url.search && !url.hash && !urls.has(url.href), 'role URL changed or duplicate')
  ids.add(row.id); urls.add(url.href)
  const city = getValidIndiaCityForJob({ location: row.location })
  if (!city) continue
  requireCurrent(/,\s*India$/i.test(row.location), 'explicit India country missing')
  const html = await get(url.href), doc = readNativeDocument(html)
  const schemas = doc.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json')
   .map(node => { try { return JSON.parse(node.raw) } catch { return null } }).filter(value => value?.['@type'] === 'JobPosting')
  requireCurrent(schemas.length === 1, 'job schema missing or ambiguous')
  const schema = schemas[0]
  requireCurrent(schema.title === row.title && schema.hiringOrganization?.name === 'Information Evolution'
   && schema.jobLocation?.address?.addressLocality === row.location, 'job title, employer or geography conflict')
  requireCurrent(doc.nodes(node => node.tag === 'h1').some(node => doc.text(node) === row.title), 'rendered role title conflict')
  requireCurrent(doc.nodes(node => hasClass(node, 'jd-meta-value')).some(node => doc.text(node) === row.location), 'rendered role geography conflict')
  const bodies = doc.nodes(node => hasClass(node, 'jd-body'))
  requireCurrent(bodies.length === 1, 'full role description missing')
  const description = doc.text(bodies[0]), schemaDescription = extractActiveDescription(schema.description)
  requireCurrent(description.length >= 100 && compact(description) === compact(schemaDescription), 'role description incomplete or contradictory')
  requireCurrent(doc.nodes(node => node.tag === 'form' && hasClass(node, 'jd-apply-form')).length === 1
   && ['ja-first', 'ja-last', 'ja-email', 'ja-resume'].every(id => doc.nodes(node => node.tag === 'input' && node.attrs.id === id).length === 1)
   && doc.nodes(node => node.tag === 'button' && node.attrs.type === 'submit' && hasClass(node, 'jd-apply-submit') && !Object.hasOwn(node.attrs, 'disabled')).length === 1,
  'active native application form missing')
  const postingDate = schema.datePosted == null ? null : new Date(schema.datePosted).toISOString()
  const closingDate = schema.validThrough == null ? null : new Date(schema.validThrough).toISOString()
  requireCurrent(!postingDate || postingDate <= checkedAt, 'publication date is in the future')
  if (closingDate && closingDate <= checkedAt) continue
  jobs.push({ source: 'informationevolution', company: 'Information Evolution', title: row.title,
   jobId: 'informationevolution-' + row.id, requisitionId: String(row.id), location: row.location, city, country: 'India',
   sourceUrl: url.href, applyUrl: url.href, link: url.href, jobDescription: description, sourceDescription: description,
   postingDate, postedAt: postingDate, closingDate, employmentType: schema.employmentType || null,
   sourceDetailComplete: true, sourceListingComplete: false, sourceScopeComplete: false,
   applicationSubmitted: false, nativeJobPosting: schema, nativeListingRecord: row, scrapedAt: checkedAt })
 }
 return attachInventoryEvidence(jobs, { status: 'coverage-gap', firstParty: true, listingComplete: false,
  surface: CURRENT_ROLES_URL, pagesFetched: 1, reportedTotal: rows.length, indiaFacetCount: jobs.length,
  verifiedAt: checkedAt, reason: 'current-employer-advertised-feed-and-full-native-role-pages-validated-company-scope-unproven' })
}
