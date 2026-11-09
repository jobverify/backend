import { attachSourceObservationEvidence } from './sourceObservationEvidence.js'

const text = value => typeof value === 'string' ? value.trim() : ''
const identifier = value => typeof value === 'string' && value.trim() && value.length <= 1024 ? value.trim()
  : Number.isSafeInteger(value) && value >= 0 ? String(value) : null
const roleURL = value => {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
    url.hash = ''; url.pathname = url.pathname.replace(/\/+$/, '') || '/'
    url.searchParams.sort()
    return url.href
  } catch { return null }
}
const pageRepresentation = scope => /^(?:(?:schema|microdata|visible)(?::|$)|native-page:)/.test(scope)
// These are identifiable intake records, not a declared number of vacancies.
const intake = /^(?:(?:join|register for)\s+(?:our|the)\s+)?(?:talent\s+(?:community|network|pool)|(?:general|open|speculative|spontaneous|unsolicited)\s+applications?|future\s+(?:opportunities|openings))(?:\s*[-:|]\s+.+)?$/i
export const isRecruitmentIntakeTitle = title => intake.test(text(title))

// Only called with native vacancy/intake representations recognized by the
// recruitment readers. No published total or legacy counter enters this ledger.
// Counts describe the identified observations within the bounded attempt;
// unidentified rows remain unresolved and never erase known positive evidence.
export function createRecruitmentObservationAccounting(source) {
  const entries = new Set(), identities = new Map(), byURL = new Map()
  const merge = (target, other) => {
    if (target === other) return
    if (other.kind === 'hiring-signals') target.kind = other.kind
    for (const key of other.keys) { identities.set(key, target); target.keys.add(key) }
    for (const url of other.urls) { byURL.get(url).delete(other); byURL.get(url).add(target); target.urls.add(url) }
    for (const id of other.ids) target.ids.add(id)
    for (const scope of other.nativeScopes) target.nativeScopes.add(scope)
    entries.delete(other)
  }
  return {
    observe({ scope, id, url, title, nonVacancy = false }) {
      const nativeId = identifier(id), nativeURL = roleURL(url)
      if (!text(scope) || !text(title) || (!nativeId && !nativeURL)) return false
      const keys = nativeId ? [JSON.stringify(['id', scope, nativeId])] : []
      const matches = new Set(keys.map(key => identities.get(key)).filter(Boolean))
      const atURL = nativeURL ? byURL.get(nativeURL) : null
      const compatible = [...atURL || []].filter(entry =>
        (!nativeId || !entry.ids.size || entry.ids.has(nativeId))
        && (pageRepresentation(scope) || !entry.nativeScopes.size || entry.nativeScopes.has(scope)))
      // A page representation may join one native account. It must not bridge
      // two independent accounts, even when their IDs and claimed URLs collide.
      if ((!nativeId && compatible.length > 1)
        || pageRepresentation(scope) && new Set([...matches, ...compatible]
          .flatMap(entry => [...entry.nativeScopes])).size > 1) return false
      for (const entry of compatible) matches.add(entry)
      let entry = matches.values().next().value
      if (!entry) { entry = { kind: 'vacancy-rows', keys: new Set(), urls: new Set(), ids: new Set(), nativeScopes: new Set() }; entries.add(entry) }
      for (const other of matches) merge(entry, other)
      if (nonVacancy || isRecruitmentIntakeTitle(title)) entry.kind = 'hiring-signals'
      for (const key of keys) { identities.set(key, entry); entry.keys.add(key) }
      if (nativeId) entry.ids.add(nativeId)
      if (!pageRepresentation(scope)) entry.nativeScopes.add(scope)
      if (nativeURL) {
        if (!byURL.has(nativeURL)) byURL.set(nativeURL, new Set())
        byURL.get(nativeURL).add(entry); entry.urls.add(nativeURL)
      }
      return true
    },
    attach(jobs) {
      if (!entries.size) return jobs
      const vacancies = [...entries].filter(entry => entry.kind === 'vacancy-rows').length
      return attachSourceObservationEvidence(jobs, { source,
        recordKind: vacancies === entries.size ? 'vacancy-rows' : vacancies ? 'mixed' : 'hiring-signals',
        observedRecordCount: entries.size, observedVacancyCount: vacancies,
        sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null })
    },
  }
}
