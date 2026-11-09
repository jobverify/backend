import { identifyPublicAtsBoard } from './publicAtsIdentity.js'

// Greenhouse documents an explicit null internal_job_id as a prospect post.
// Missing and other falsy values do not establish that type.
// https://docs.greenhouse.io/job-board#list-jobs
export const isGreenhouseProspectPost = record => record != null
  && Object.hasOwn(record, 'internal_job_id') && record.internal_job_id === null

export const greenhouseProspectPostIds = (records, provider) => {
  const prospects = records.filter(isGreenhouseProspectPost)
  const ids = new Set(prospects.map(record => String(record.id)))
  for (const record of prospects) {
    const fail = () => { throw new Error(`[${provider.source}] Invalid Greenhouse prospect inventory identity`) }
    if (!Number.isSafeInteger(record.id) || record.id <= 0 || typeof record.title !== 'string' || !record.title.trim()) fail()
    let url
    try { url = new URL(record.absolute_url) } catch { fail() }
    if (url.protocol !== 'https:' || url.username || url.password || url.port) fail()
    const board = identifyPublicAtsBoard(url.href)
    const native = board?.atsPlatform === 'greenhouse' && board.boardToken === provider.boardToken
      && /^(?:job-boards|boards)(?:\.eu)?\.greenhouse\.io$/.test(url.hostname)
      && url.pathname.replace(/\/+$/, '') === `/${encodeURIComponent(provider.boardToken)}/jobs/${record.id}`
    let employerHosted = false
    try {
      employerHosted = url.hostname.replace(/^www\./, '') === new URL(provider.companyCareerPage).hostname.replace(/^www\./, '')
        && url.searchParams.getAll('gh_jid').length === 1 && url.searchParams.get('gh_jid') === String(record.id)
    } catch { /* An absent employer URL cannot establish a custom application URL. */ }
    if (!native && !employerHosted) fail()
  }
  // Filtering a prospect must not conceal its duplicate identity elsewhere in
  // the response. Ordinary duplicates still follow the existing engine guard.
  const seen = new Set()
  for (const record of records) {
    const id = String(record?.id)
    if (ids.has(id) && seen.has(id)) throw new Error(`[${provider.source}] Invalid Greenhouse inventory: repeated prospect identity`)
    seen.add(id)
  }
  return [...ids].sort()
}

// Keep every native record and the original envelope total in the mapper's
// inventory audit. Skip prospects only at vacancy mapping, after validation.
export const withGreenhousePostingKind = record => ({ ...record, sourceProspectPost: isGreenhouseProspectPost(record) })
export const excludeGreenhouseProspects = config => {
  config.config.recordFilter = { ...config.config.recordFilter,
    exclude: [...(config.config.recordFilter?.exclude || []), { field: 'sourceProspectPost', pattern: '^true$' }] }
}
export const greenhouseProspectReason = ids => ids.length ? `:native-prospect-posts-excluded:${ids.join(',')}` : ''
