import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

const parsePublicPosting = (value, expectedCompany) => {
  let url
  try { url = new URL(value) } catch { throw new Error('SmartRecruiters detail: invalid public URL') }
  const match = url.pathname.match(/^\/([^/]+)\/(\d+)(?:-[^/]*)?\/?$/)
  if (url.protocol !== 'https:' || url.hostname !== 'jobs.smartrecruiters.com'
    || url.port || url.username || url.password || !match || !expectedCompany
    || match[1] !== expectedCompany) {
    throw new Error('SmartRecruiters detail: untrusted company or public URL')
  }
  return { company: match[1], id: match[2] }
}

// The employer listing must supply the exact public posting link. Do not infer a
// tenant from its name or accept another company's response at a matching URL.
export const fetchSmartRecruitersDetail = async ({ publicUrl, expectedCompany, expectedCountry, expectedLocation, fetchJson }) => {
  const reference = parsePublicPosting(publicUrl, expectedCompany)
  const normalizeScope = value => typeof value === 'string' ? value.trim().toLowerCase() : ''
  const scopeFailure = () => {
    const error = new Error('SmartRecruiters detail: native country/location must match the verified listing scope')
    error.name = 'SmartRecruitersDetailScopeError'
    error.incompleteScope = true
    return error
  }
  const country = normalizeScope(expectedCountry)
  const location = normalizeScope(expectedLocation)
  if (!/^[a-z]{2}$/.test(country) || !location) throw scopeFailure()
  const payload = await fetchJson(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(reference.company)}/postings/${reference.id}`)
  if (!payload || payload.success === false || payload.error
    || (Array.isArray(payload.errors) && payload.errors.length)
    || String(payload.id) !== reference.id || payload.company?.identifier !== reference.company) {
    throw new Error('SmartRecruiters detail: upstream error or company/job identity mismatch')
  }
  const returnedReference = parsePublicPosting(payload.postingUrl, expectedCompany)
  if (returnedReference.id !== reference.id) throw new Error('SmartRecruiters detail: posting URL identity mismatch')
  // Authoritative native geography must be checked even when role content is
  // absent. A listing label or provider default cannot override a native country.
  if (normalizeScope(payload.location?.country) !== country
    || normalizeScope(payload.location?.city) !== location) throw scopeFailure()
  const sections = payload.jobAd?.sections
  const roleDescription = sections?.jobDescription?.text
  if (typeof roleDescription !== 'string' || !hasSourceDescription({ jobDescription: roleDescription })) {
    throw new Error('SmartRecruiters detail: missing employer role description')
  }
  return {
    jobDescription: ['companyDescription', 'jobDescription', 'qualifications', 'additionalInformation']
      .map(key => sections?.[key]?.text)
      .filter(value => typeof value === 'string' && hasSourceDescription({ jobDescription: value }))
      .join('\n\n'),
    minimumQualification: typeof sections?.qualifications?.text === 'string'
      ? sections.qualifications.text : null,
  }
}
