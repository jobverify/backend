import { reconcileCurrentWorkdayRoleDetail } from './workdayCurrentSourceScope.js'
import { hasRecognizedWorkdayCountry, explicitWorkdayCountryScope } from '../myworkday/countryInventoryProof.js'

const formatters = ['long', 'short'].map(style => new Intl.DisplayNames(['en'], { type: 'region', style }))
const countryCodes = new Map()
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b), names = formatters.map(formatter => formatter.of(code)).filter(name => name && name !== code)
  if (!names.length || ['ZZ', 'EU', 'UN', 'XA', 'XB', 'QO'].includes(code)) continue
  const canonical = new Intl.Locale('und-' + code).region
  for (const label of [code, ...names]) countryCodes.set(label.toLowerCase(), canonical)
}
for (const [label, code] of Object.entries({ IND: 'IN', USA: 'US', 'United States of America': 'US', 'Russian Federation': 'RU', UK: 'GB', UAE: 'AE' })) countryCodes.set(label.toLowerCase(), code)
const codeFor = country => hasRecognizedWorkdayCountry(country)
  ? countryCodes.get(String(typeof country === 'string' ? country : country.alpha2Code || country.descriptor).trim().toLowerCase()) : null
const locationKey = value => String(value || '').replace(/\b(?:India|IND|IN)\b/gi, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase()
const dateKey = value => value == null ? null : typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) ? value.slice(0, 10) : false
const normalizedUrl = value => { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash
  ? url.origin + url.pathname.replace(/^\/[a-z]{2}-[A-Z]{2}\//, '/') : null } catch { return null } }

const agrees = (job, snapshot) => {
  if (!snapshot) return false
  const info = snapshot.info, countries = [info.country, info.jobRequisitionLocation?.country].filter(value => value != null)
  const codes = countries.map(codeFor)
  if (!codes.length || codes.some(code => !code) || new Set(codes).size !== 1 || job.country !== 'India') return false
  if (codes[0] === 'IN' && countries.some(country => typeof country === 'object' && country.id != null
    && String(country.id).trim().toLowerCase() !== 'c4f78be1a8f14da0ab49ce1162348a5e')) return false
  const locations = job.locations || [job.location]
  const matches = label => typeof label === 'string' && locations.some(value => locationKey(value) === locationKey(label))
  if (codes[0] === 'IN') {
    if (!matches(info.location) || info.jobRequisitionLocation?.descriptor && !matches(info.jobRequisitionLocation.descriptor)) return false
  } else if (!Array.isArray(info.additionalLocations) || !info.additionalLocations.some(label => typeof label === 'string'
    && explicitWorkdayCountryScope(label) === 'india' && matches(label))) return false
  return info.title === job.title && info.jobReqId === job.requisitionId && info.canApply === true && info.posted === true
    && normalizedUrl(info.externalUrl) === normalizedUrl(job.sourceUrl)
    && snapshot.hiringOrganization?.name?.trim() === job.nativeEmployer
    && dateKey(job.postedAt) === dateKey(info.startDate) && dateKey(job.closingDate) === dateKey(info.endDate)
    && info.jobPostingId === new URL(info.externalUrl).pathname.split('/').at(-1)
    && job.nativeBoardProvenance?.some(row => row.nativePostingUid === info.id && row.site === info.jobPostingSiteId)
}

// Criteria and exported metadata must describe the same closed native role.
// Raw country conflicts cannot be overruled by an India result from other reads.
export function reconcileRetainedWorkdayRoleProof(job, opening, closing) {
  const checked = reconcileCurrentWorkdayRoleDetail(job, opening, closing)
  const original = opening.roleSnapshots.find(row => row.jobId === job.requisitionId)
  const final = closing.roleSnapshots.find(row => row.jobId === job.requisitionId)
  const complete = checked.sourceDetailComplete === true && agrees(job, original) && agrees(job, final)
  return { ...checked, sourceDetailComplete: Boolean(complete), ...(!complete ? {
    sourceDetailStatus: 'native-role-criteria-or-metadata-not-reconciled',
    sourceUnreviewedNativeRole: { opening: original || null, closing: final || null },
  } : {}) }
}
