import { document, norm } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { nativeCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { isIndiaJob } from '../../scraper-support/utils/indiaLocationFilter.js'
import { extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'

const fail = message => { throw new Error('Skan native inventory: ' + message) }
const one = (nodes, name) => { if (nodes.length !== 1) fail('missing or ambiguous ' + name); return nodes[0] }
export const readPage = html => {
  if (typeof html !== 'string' || html.length > 4 * 1024 * 1024) fail('unavailable or oversized HTML')
  const doc = document(html)
  for (const tag of ['html', 'body']) doc.outer(one(doc.nodes(node => node.tag === tag), tag + ' envelope'))
  return doc
}

// The current Keka feed presents independent comma-separated location labels.
// Unknown city-only labels remain unresolved; they cannot prove a zero-India facet.
export const classifyLocations = value => {
  if (typeof value !== 'string' || !norm(value)) fail('missing native geography')
  const labels = norm(value).split(',').map(norm)
  if (labels.some(label => !label)) fail('malformed native geography')
  const country = label => label === 'USA' ? 'United States' : nativeCountryName(label)
  const countries = labels.map(country).filter(Boolean)
  const indianCities = labels.filter(label => !country(label) && !/^(?:remote|global|worldwide|anywhere)$/i.test(label) && isIndiaJob({ location: label }))
  if (indianCities.length && countries.some(value => value !== 'India') && !countries.includes('India')) fail('contradictory native geography')
  return { india: [...new Set([...labels.filter(label => country(label) === 'India'), ...indianCities.map(label => `${label}, India`)])],
    complete: labels.every(label => country(label) || indianCities.includes(label)) }
}

const nativeJobs = doc => {
  const chunks = []
  for (const script of doc.nodes(node => node.tag === 'script' && !node.attrs.src)) {
    const raw = script.raw.trim()
    if (!raw.startsWith('self.__next_f.push(') || !raw.endsWith(')')) continue
    let args
    try { args = JSON.parse(raw.slice('self.__next_f.push('.length, -1)) } catch { fail('malformed native flight chunk') }
    if (Array.isArray(args) && args[0] === 1 && typeof args[1] === 'string') chunks.push(args[1])
  }
  const candidates = []
  const walk = (node, inBoard = false, depth = 0) => {
    if (!Array.isArray(node) || depth > 40) return
    if (node[0] !== '$') { for (const child of node) walk(child, inBoard, depth + 1); return }
    const props = node[3]
    if (!props || typeof props !== 'object' || Array.isArray(props)) return
    const scoped = inBoard || node[1] === 'section' && props.id === 'open-roles'
    if (scoped && typeof node[1] === 'string' && /^\$L[\da-f]+$/i.test(node[1]) && Object.hasOwn(props, 'jobs')) candidates.push(props)
    walk(props.children, scoped, depth + 1)
  }
  for (const line of chunks.join('').split('\n')) {
    const match = /^[a-f\d]+:(\[.*)$/i.exec(line)
    if (!match || !line.includes('"jobs":')) continue
    let data
    try { data = JSON.parse(match[1]) } catch { fail('malformed native job payload') }
    if (data?.[0] === '$' && data[3] && Object.hasOwn(data[3], 'jobs')) candidates.push(data[3])
    else walk(data)
  }
  const props = one(candidates, 'complete native job payload')
  if (Object.keys(props).some(key => !['intro', 'jobs', 'buttonLabel', 'emptyMessage'].includes(key))) fail('unreviewed native payload fields')
  if (!Array.isArray(props.jobs) || !props.jobs.length || props.jobs.length > 500 || props.buttonLabel !== 'Show all') fail('unknown empty or changed native listing contract')
  for (const field of ['error', 'errors', 'failed', 'hasError']) if (props[field]) fail('native failure envelope')
  for (const field of ['ok', 'success']) if (props[field] === false) fail('native failure envelope')
  for (const field of ['next', 'nextPage', 'nextCursor', 'hasMore']) if (props[field]) fail('unverified native pagination')
  return props.jobs
}

export const parseNativeListing = html => {
  const doc = readPage(html)
  if (!/<title>Careers at Skan AI \| Skan AI<\/title>/.test(html)) fail('official careers identity changed')
  const board = one(doc.nodes(node => node.tag === 'section' && node.attrs.id === 'open-roles'), 'active careers board')
  doc.outer(board)
  if (doc.text(one(doc.nodes(node => node.tag === 'h2', board), 'board title')) !== 'Find your seat') fail('native board title changed')
  if (doc.nodes(node => node.attrs.rel === 'next' || /pagination|load-more/i.test(node.attrs.class || ''), board).length) fail('unverified listing pagination')
  const rows = nativeJobs(doc), ids = new Set(), groups = new Map()
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Object.keys(row).some(key => !['id', 'title', 'department', 'location', 'href'].includes(key)) || !/^\d+$/.test(row.id) || ids.has(row.id)
      || !['title', 'department', 'location'].every(key => typeof row[key] === 'string' && norm(row[key]))
      || row.href !== `https://skanai.keka.com/careers/jobdetails/${row.id}`) fail('invalid, duplicate or foreign native role identity')
    ids.add(row.id)
    classifyLocations(row.location)
    const members = groups.get(norm(row.department)) || []
    members.push(row); groups.set(norm(row.department), members)
  }
  const sections = doc.nodes(node => node.tag === 'section' && node.attrs['aria-labelledby']?.startsWith('job-board-dept-'), board)
  if (sections.length !== groups.size) fail('department inventory counts disagree')
  const seen = new Set()
  let visibleCount = 0
  for (const section of sections) {
    doc.outer(section)
    const heading = one(doc.nodes(node => node.tag === 'h3', section), 'department heading')
    const match = /^(.*?) \((\d+)\)$/.exec(doc.text(heading))
    const members = match && groups.get(match[1])
    if (!members || seen.has(match[1]) || Number(match[2]) !== members.length) fail('native department counts disagree')
    seen.add(match[1])
    const links = doc.nodes(node => node.tag === 'a', section)
    visibleCount += links.length
    if (links.length !== Math.min(5, members.length)) fail('visible card inventory incomplete')
    const visibleIds = new Set()
    for (const link of links) {
      doc.outer(link)
      const row = members.find(row => row.href === link.attrs.href)
      if (!row || visibleIds.has(row.id)) fail('foreign or duplicate visible card identity')
      visibleIds.add(row.id)
      if (doc.text(link) !== norm(`${row.title} ${row.department} ${row.location}`)) fail('visible card/payload title or location mismatch')
    }
  }
  if (doc.nodes(node => node.tag === 'a', board).length !== visibleCount) fail('unverified additional openings handoff')
  return rows
}

export const reconcileActiveJobs = (text, rows, { now = new Date() } = {}) => {
  let active
  try { active = JSON.parse(text) } catch { fail('malformed active API response') }
  if (!Array.isArray(active) || !active.length || active.length > 500) fail('unknown empty or changed active API contract')
  const allowed = ['id', 'title', 'description', 'departmentIdentifier', 'departmentName', 'excerpt', 'jobLocations', 'jobType', 'experience', 'salaryRange', 'salaryRangeFormat', 'publishedOn', 'publishedSinceDays', 'skillNames']
  const matched = new Map()
  for (const job of active) {
    if (!job || typeof job !== 'object' || Object.keys(job).some(key => !allowed.includes(key))
      || !Number.isSafeInteger(job.id) || matched.has(String(job.id))) fail('invalid, duplicate or unreviewed active API role')
    const row = rows.find(row => row.id === String(job.id))
    // Corporate pages can lag the native active feed. Keep the unadvertised
    // identity in the reconciliation count, but never fetch or publish it from
    // API evidence alone. The caller must retain incomplete inventory scope.
    if (!row) { matched.set(String(job.id), { unlisted: true }); continue }
    if (norm(job.title) !== norm(row.title) || norm(job.departmentName) !== norm(row.department)
      || !Array.isArray(job.jobLocations) || !job.jobLocations.length) fail('active API/listing identity mismatch')
    for (const location of job.jobLocations) {
      if (!location || typeof location !== 'object' || Object.keys(location).some(key => !['id', 'name', 'city', 'state', 'countryCode', 'countryName'].includes(key))
        || !Number.isSafeInteger(location.id) || !['name', 'city', 'state', 'countryCode', 'countryName'].every(key => typeof location[key] === 'string')) fail('unreviewed active API geography')
      if (classifyLocations(location.name || location.city).india.length
        && (nativeCountryName(location.countryCode) !== 'India' || nativeCountryName(location.countryName) !== 'India')) fail('contradictory native India country fields')
    }
    if (norm(job.jobLocations.map(location => location.name || location.city).join(', ')) !== norm(row.location)) fail('active API/listing geography mismatch')
    if (job.publishedOn != null && (typeof job.publishedOn !== 'string'
      || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(job.publishedOn)
      || !Number.isFinite(Date.parse(job.publishedOn)) || new Date(job.publishedOn).toISOString().slice(0, 19) !== job.publishedOn.slice(0, 19))) fail('invalid native publication date')
    if (!Number.isSafeInteger(job.publishedSinceDays) || job.publishedSinceDays < 0) fail('invalid native publication age')
    if (job.publishedOn != null && Date.parse(job.publishedOn) > new Date(now).getTime()) fail('native publication date is in the future')
    // The public client renders publishedSinceDays as dateofposting. Whole-day
    // rounding may differ from elapsed UTC days by one, but cannot refresh age.
    if (job.publishedOn != null && Math.abs((new Date(now).getTime() - Date.parse(job.publishedOn)) / 86400000 - job.publishedSinceDays) > 1) fail('native publication date/age disagreement')
    const nativeCountryConflict = job.jobLocations.some(location => {
      const code = nativeCountryName(location.countryCode), name = nativeCountryName(location.countryName)
      const label = location.name === 'USA' ? 'United States' : nativeCountryName(location.name)
      return !code || !name || code !== name || Boolean(label && label !== code)
    })
    matched.set(row.id, { ...job, nativeCountryConflict })
  }
  return matched
}

const prose = node => !node || node.inactive || /^(?:h[1-6]|strong|b|script|style)$/.test(node.tag) ? ''
  : node.children.map(child => typeof child === 'string' ? child : prose(child)).join(' ')
export const parseNativeDetail = (html, row) => {
  const doc = readPage(html)
  const home = one(doc.nodes(node => node.tag === 'a' && node.attrs.id === 'home'), 'tenant identity')
  if (doc.text(home) !== 'SkanAI') fail('native employer identity mismatch')
  const banner = one(doc.nodes(node => node.tag === 'div' && doc.hasClass(node, 'banner')), 'native role banner')
  doc.outer(banner)
  const title = doc.text(one(doc.nodes(node => node.tag === 'h1', banner), 'native title'))
  const identity = one(doc.nodes(node => doc.hasClass(node, 'social-links')), 'selected role identity')
  if (title !== norm(row.title) || identity.attrs.selectedjobid !== row.id || norm(identity.attrs.selectedjobtitle) !== title
    || doc.nodes(node => node.attrs.selectedjobid !== undefined).some(node => node.attrs.selectedjobid !== row.id)) fail('detail/listing identity mismatch')
  const bodyText = doc.text(one(doc.nodes(node => node.tag === 'body'), 'role body'))
  if (/\b(?:this (?:job|position|requisition) is no longer (?:available|active)|(?:this )?position (?:has been|is) filled)\b/i.test(bodyText)) fail('native role visibly closed')
  const apply = one(doc.nodes(node => node.tag === 'button' && node.attrs.id === 'apply-job'), 'native apply action')
  if (Object.hasOwn(apply.attrs, 'disabled') || apply.attrs['aria-disabled'] === 'true' || doc.text(apply) !== 'Apply for this job') fail('native application unavailable')
  const field = icon => {
    const holders = doc.nodes(node => node.tag === 'div' && node.children.some(child => typeof child === 'object' && doc.hasClass(child, icon)), banner)
    if (!holders.length) return null
    return doc.text(one(holders, icon + ' field'))
  }
  const location = field('ki-location')
  if (location !== norm(row.location)) fail('native detail/listing geography mismatch')
  const scope = classifyLocations(location)
  const containers = doc.nodes(node => doc.hasClass(node, 'job-description-container'))
  if (containers.length > 1) fail('ambiguous native description')
  const node = containers[0]
  const description = node && extractActiveDescription(prose(node)) ? extractActiveDescription(doc.inner(node)) : null
  return { title, company: 'Skan', source: 'skan', jobId: row.id, requisitionId: row.id,
    sourceUrl: row.href, applyUrl: row.href, link: row.href, department: norm(row.department),
    country: scope.india.length ? 'India' : null, locations: scope.india, location: scope.india.join('; '), city: null,
    postingDate: null, closingDate: null, employmentType: field('ki-briefcase'), experienceRequired: field('ki-user-tie'), remoteStatus: null,
    jobDescription: description, sourceDescription: description, requiredSkills: [], sourceDetailComplete: Boolean(description),
    sourceListingComplete: Boolean(description), scopeComplete: scope.complete }
}
