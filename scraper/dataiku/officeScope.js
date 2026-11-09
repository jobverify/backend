import { countryName } from '../../scraper-support/native-sources/jobPostingData.js'
import { hasUnhandledGreenhouseGeography } from '../../scraper-support/utils/greenhouseLocations.js'

const normalize = value => String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase()
const names = new Map()
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const name = countryName(String.fromCharCode(a, b))
  if (name) names.set(normalize(name), name)
}
for (const [label, name] of Object.entries({ USA: 'United States', 'United States of America': 'United States',
  UK: 'United Kingdom', GBR: 'United Kingdom', UAE: 'United Arab Emirates', IND: 'India' })) names.set(normalize(label), name)
const numberId = value => Number.isSafeInteger(value) && value >= 0
const object = value => value && typeof value === 'object' && !Array.isArray(value)
const stable = value => Array.isArray(value) ? value.map(stable) : object(value)
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value
const same = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b))
const idSet = values => Array.isArray(values) && values.every(numberId) && new Set(values).size === values.length
const sameIds = (a, b) => idSet(a) && idSet(b) && same([...a].sort((x, y) => x - y), [...b].sort((x, y) => x - y))
const officeFields = ['id', 'name', 'location', 'parent_id', 'child_ids', 'departments']
const departmentFields = ['id', 'name', 'parent_id', 'child_ids', 'jobs']
const briefFields = ['absolute_url', 'data_compliance', 'internal_job_id', 'location', 'metadata', 'id', 'updated_at',
  'requisition_id', 'title', 'company_name', 'first_published', 'language', 'application_deadline']
const officeReference = office => object(office) ? { id: office.id, name: office.name, location: office.location,
  parent_id: office.parent_id, child_ids: Array.isArray(office.child_ids) ? [...office.child_ids].sort((a, b) => a - b) : office.child_ids } : null

// Written country names are native evidence. An untyped city, state abbreviation
// or generic Remote is not converted to a country by a geographic dictionary.
function writtenCountries(label) {
  if (typeof label !== 'string' || !label.trim()) return { known: false, countries: [], indiaLabel: null }
  const countries = new Set(), unknown = [], conflicts = []
  let indiaLabel = null
  for (const segment of label.split(';').map(value => value.trim()).filter(Boolean)) {
    const found = [...new Set(segment.split(',').map(part => names.get(normalize(part))).filter(Boolean))]
    if (found.length !== 1) { (found.length ? conflicts : unknown).push(segment); continue }
    countries.add(found[0])
    if (found[0] === 'India') indiaLabel ||= segment
  }
  return { known: unknown.length === 0 && conflicts.length === 0 && countries.size > 0,
    countries: [...countries], indiaLabel, conflicts, unknown }
}

export function reconcileOfficeScope(payload, officePayload) {
  const reasons = new Set(), fail = reason => reasons.add(reason), roles = []
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : []
  const offices = Array.isArray(officePayload?.offices) ? officePayload.offices : []
  const byJob = new Map(), byOffice = new Map(), memberships = new Map(), invalidOffices = new Set()
  const unreviewedOfficeIds = new Set(), unreviewedOfficeRoleIds = new Set()
  if (!object(payload) || !Array.isArray(payload.jobs) || Object.keys(payload).some(key => !['jobs', 'meta'].includes(key))
    || !object(payload.meta) || Object.keys(payload.meta).some(key => key !== 'total')
    || payload.meta.total !== jobs.length || !Number.isSafeInteger(payload.meta.total)) fail('unreviewed-or-incomplete-native-job-envelope')
  if (!object(officePayload) || Object.keys(officePayload).some(key => key !== 'offices')
    || !Array.isArray(officePayload.offices) || offices.length > 1000 || jobs.length > 2000) fail('unreviewed-native-office-envelope')
  for (const row of jobs) {
    if (!object(row) || !numberId(row.id) || row.id === 0 || byJob.has(row.id)) { fail('invalid-or-duplicate-native-role'); continue }
    byJob.set(row.id, row)
    try {
      const url = new URL(row.absolute_url)
      if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash
        || !['job-boards.greenhouse.io', 'boards.greenhouse.io'].includes(url.hostname)
        || url.pathname !== `/dataiku/jobs/${row.id}` || row.company_name !== 'Dataiku' || typeof row.title !== 'string' || !row.title.trim()) fail('native-role-employer-or-url-unqualified')
    } catch { fail('native-role-employer-or-url-unqualified') }
  }
  for (const office of offices) {
    if (object(office) && numberId(office.id) && Object.keys(office).some(key => !officeFields.includes(key))) unreviewedOfficeIds.add(office.id)
    if (!object(office) || !numberId(office.id) || byOffice.has(office.id)) { fail('invalid-or-duplicate-office-id'); continue }
    byOffice.set(office.id, office)
    if (Object.keys(office).some(key => !officeFields.includes(key)) || typeof office.name !== 'string' || !office.name.trim()
      || !(office.location === null || typeof office.location === 'string')
      || !(office.parent_id === null || numberId(office.parent_id)) || !idSet(office.child_ids)
      || !Array.isArray(office.departments) || office.departments.length > 256) {
      invalidOffices.add(office.id); fail(`unreviewed-office-definition:${office.id}`)
    }
  }
  for (const office of byOffice.values()) {
    const parent = byOffice.get(office.parent_id)
    if (office.parent_id != null && (!parent || !Array.isArray(parent.child_ids) || !parent.child_ids.includes(office.id))) {
      invalidOffices.add(office.id); fail(`office-parent-membership-unreconciled:${office.id}`)
    }
    for (const child of Array.isArray(office.child_ids) ? office.child_ids : []) if (!byOffice.has(child) || byOffice.get(child).parent_id !== office.id) {
      invalidOffices.add(office.id); fail(`office-child-membership-unreconciled:${office.id}`)
    }
  }
  let references = 0
  for (const office of byOffice.values()) for (const department of Array.isArray(office.departments) ? office.departments : []) {
    if (!object(department) || Object.keys(department).some(key => !departmentFields.includes(key))
      || !numberId(department.id) || !Array.isArray(department.jobs)) {
      unreviewedOfficeIds.add(office.id); fail('unreviewed-office-department-model'); continue
    }
    for (const brief of department.jobs) {
      if (++references > 100000) { fail('office-role-reference-bound'); break }
      if (!object(brief) || !numberId(brief.id)) { fail('invalid-office-role-reference'); continue }
      if (Object.keys(brief).some(key => !briefFields.includes(key))) unreviewedOfficeRoleIds.add(String(brief.id))
      const row = byJob.get(brief.id)
      if (!row || Object.keys(brief).some(key => !briefFields.includes(key))
        || Object.keys(brief).some(key => !same(brief[key], row[key]))) fail(`office-role-payload-unreconciled:${brief.id}`)
      if (!memberships.has(brief.id)) memberships.set(brief.id, new Set())
      memberships.get(brief.id).add(office.id)
    }
  }
  const resolved = new Map(), active = new Set()
  const unreviewedAncestor = id => {
    const seen = new Set()
    while (byOffice.has(id) && !seen.has(id) && seen.size <= 64) {
      if (unreviewedOfficeIds.has(id)) return true
      seen.add(id); id = byOffice.get(id).parent_id
    }
    return false
  }
  const countriesForOffice = (id, depth = 0) => {
    if (resolved.has(id)) return resolved.get(id)
    if (depth > 64 || active.has(id) || !byOffice.has(id) || invalidOffices.has(id)) return null
    active.add(id)
    const office = byOffice.get(id)
    const own = writtenCountries(office.name), address = office.location ? writtenCountries(office.location) : null
    let countries
    if (office.child_ids.length) {
      countries = new Set()
      for (const child of office.child_ids) {
        const value = countriesForOffice(child, depth + 1)
        if (!value || !value.size) { countries = null; break }
        for (const name of value) countries.add(name)
      }
      if (countries && own.known && [...countries].some(name => !own.countries.includes(name))) countries = null
    } else if (office.id === 0 && office.name === 'No Office' && office.location === null) countries = new Set()
    else if (own.known && own.countries.length === 1 && (!address || address.known && same([...address.countries].sort(), [...own.countries].sort()))) countries = new Set(own.countries)
    else if (!own.known && address?.known && address.countries.length === 1) countries = new Set(address.countries)
    else countries = null
    active.delete(id); resolved.set(id, countries)
    return countries
  }
  for (const row of byJob.values()) {
    const primary = writtenCountries(row.location?.name), officeCountries = [], knownIndia = []
    let unknown = !primary.known
    if (primary.indiaLabel) knownIndia.push(primary.indiaLabel)
    if (hasUnhandledGreenhouseGeography(row)) { unknown = true; fail(`unreviewed-native-role-geography:${row.id}`) }
    const refs = Array.isArray(row.offices) ? row.offices : []
    if (!Array.isArray(row.offices) || new Set(refs.map(office => office?.id)).size !== refs.length) { unknown = true; fail(`native-office-references-unqualified:${row.id}`) }
    const assigned = [...(memberships.get(row.id) || [])]
    if (!sameIds(assigned, refs.map(office => office?.id))) { unknown = true; fail(`native-office-role-assignments-unreconciled:${row.id}`) }
    for (const reference of refs) {
      if (unreviewedAncestor(reference?.id)) unreviewedOfficeRoleIds.add(String(row.id))
      const office = byOffice.get(reference?.id)
      if (!office || !same(officeReference(reference), officeReference(office))) {
        unknown = true; fail(`embedded-office-definition-unreconciled:${row.id}`); continue
      }
      const countrySet = countriesForOffice(office.id)
      officeCountries.push({ officeId: office.id, nativeName: office.name, countries: countrySet ? [...countrySet].sort() : null })
      if (!countrySet) unknown = true
      else if (countrySet.has('India')) {
        const direct = !office.child_ids.length && countrySet.size === 1 ? writtenCountries(office.location || office.name) : null
        if (direct?.indiaLabel) knownIndia.push(direct.indiaLabel)
        else if (!primary.indiaLabel) unknown = true
      }
    }
    const india = knownIndia.length > 0
    // A proven India worksite keeps this distinct role in the India inventory;
    // other unresolved roles must never disappear into a verified zero.
    if (!india && unknown) fail(`native-role-india-scope-unresolved:${row.id}`)
    roles.push({ jobId: String(row.id), india, nativeIndiaLabels: [...new Set(knownIndia)], primary, officeCountries,
      physicalCountryUnknown: unknown, indiaEligibilityQualified: india || !unknown })
  }
  for (const id of memberships.keys()) if (!byJob.has(id)) fail(`office-role-missing-from-full-inventory:${id}`)
  return { complete: reasons.size === 0, reasons: [...reasons], indiaRoleIds: roles.filter(role => role.india).map(role => role.jobId),
    observedNativeRoles: jobs.length, observedOfficeRows: offices.length, officePublishedRoleIds: [...memberships.keys()].map(String).sort(),
    unreviewedOfficeRoleIds: [...unreviewedOfficeRoleIds].sort(), roles }
}
