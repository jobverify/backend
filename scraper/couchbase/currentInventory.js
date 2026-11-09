import { createHash } from 'node:crypto'
import { publicAtsInventoryError } from '../../scraper-support/utils/publishingGapAts.js'

const fail = reason => { throw new Error('Couchbase native inventory: ' + reason) }
const plain = value => value && typeof value === 'object' && !Array.isArray(value)
  && Object.getPrototypeOf(value) === Object.prototype
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const definition = office => ({ id: office.id, name: office.name, location: office.location,
  parent_id: office.parent_id, child_ids: office.child_ids })
const validRoleUrl = record => {
  try {
    const url = new URL(record.absolute_url)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.search && !url.hash
      && url.hostname === 'job-boards.greenhouse.io' && url.pathname === `/couchbaseinc/jobs/${record.id}`
  } catch { return false }
}
const employer = record => record.company_name == null || typeof record.company_name === 'string'
  && ['couchbase', 'couchbaseinc'].includes(record.company_name.toLowerCase().replace(/[^a-z0-9]/g, ''))

export const validateCouchbaseNativeInventory = payload => {
  if (publicAtsInventoryError(payload) || payload?.hasMore === true || !Array.isArray(payload?.jobs)
    || !Number.isSafeInteger(payload.meta?.total) || payload.meta.total < 0
    || payload.meta.total !== payload.jobs.length) fail('failed, truncated or uncounted native feed')
  const ids = new Set()
  for (const record of payload.jobs) {
    if (!plain(record) || !Number.isSafeInteger(record.id) || record.id <= 0 || ids.has(record.id)
      || typeof record.title !== 'string' || !record.title.trim() || !validRoleUrl(record)) fail('invalid native role identity')
    ids.add(record.id)
    if (!employer(record)) fail('foreign declared employer')
    if (record.isListed === false || Object.hasOwn(record, 'isListed') && typeof record.isListed !== 'boolean') fail('unlisted or unknown active role')
  }
}

// This opt-in belongs only to Couchbase's observed Raleigh office. Its current
// country parent is an explicit native country label, not a city lookup.
export const withCurrentCouchbaseOfficeCountry = (payload, officePayload) => {
  if (publicAtsInventoryError(officePayload) || officePayload?.hasMore === true || !Array.isArray(officePayload?.offices)) {
    fail('failed or incomplete current office index')
  }
  const offices = new Map(), index = new Map(), native = new Map(payload.jobs.map(row => [row.id, row]))
  const geography = /country|countries|location|address|region|geograph|latitude|longitude|postal|territor|continent/i
  for (const office of officePayload.offices) {
    if (!plain(office) || !Number.isSafeInteger(office.id) || office.id < 0 || offices.has(office.id)
      || typeof office.name !== 'string' || !office.name.trim()
      || office.location != null && typeof office.location !== 'string'
      || !Array.isArray(office.child_ids) || !Array.isArray(office.departments)
      || Object.entries(office).some(([key, value]) => geography.test(key) && key !== 'location' && value != null)) {
      fail('malformed or repeated office identity/geography')
    }
    offices.set(office.id, office)
    const membership = new Set()
    index.set(office.id, membership)
    for (const department of office.departments) {
      if (!plain(department) || !Array.isArray(department.jobs)) fail('malformed office department inventory')
      const departmentIds = new Set()
      for (const job of department.jobs) {
        const original = native.get(job?.id)
        if (!plain(job) || !original || departmentIds.has(job.id) || !employer(job) || job.isListed === false
          || job.title !== original.title || job.absolute_url !== original.absolute_url
          || job.location?.name !== original.location?.name || !same(job.metadata ?? null, original.metadata ?? null)) {
          fail('office role index and native identity/scope disagree')
        }
        departmentIds.add(job.id)
        membership.add(job.id)
      }
    }
  }
  // The API also advertises transitive descendants. Every such child must
  // nevertheless lead back to this office through its explicit parent chain.
  for (const office of offices.values()) {
    if (office.parent_id !== null && (!Number.isSafeInteger(office.parent_id)
      || office.parent_id <= 0 || !offices.has(office.parent_id))) fail('unknown office parent')
    if (new Set(office.child_ids).size !== office.child_ids.length
      || office.child_ids.some(id => !Number.isSafeInteger(id) || id <= 0 || !offices.has(id))) fail('invalid office children')
    const ancestors = new Set([office.id])
    let parent = office.parent_id
    while (parent !== null) {
      if (ancestors.has(parent)) fail('cyclic office parents')
      ancestors.add(parent)
      parent = offices.get(parent)?.parent_id
      if (parent === undefined) fail('missing office ancestor')
    }
    if (office.parent_id !== null && !offices.get(office.parent_id).child_ids.includes(office.id)) fail('missing reciprocal office parent binding')
    for (const id of office.child_ids) {
      const visited = new Set([id])
      let ancestor = offices.get(id).parent_id
      while (ancestor !== null && ancestor !== office.id) {
        if (visited.has(ancestor)) fail('cyclic child ancestry')
        visited.add(ancestor)
        ancestor = offices.get(ancestor)?.parent_id
        if (ancestor === undefined) fail('missing child ancestor')
      }
      if (ancestor !== office.id) fail('foreign office branch declared as child')
    }
  }
  const indexIds = new Set([...index.values()].flatMap(values => [...values]))
  if (indexIds.size !== native.size || [...native.keys()].some(id => !indexIds.has(id))) fail('office/native role sets disagree')
  for (const record of payload.jobs) {
    if (!Array.isArray(record.offices) || !record.offices.length) fail('native office references unavailable')
    for (const reference of record.offices) {
      const observed = offices.get(reference?.id)
      if (!observed || !same(definition(reference), definition(observed)) || !index.get(reference.id).has(record.id)) {
        fail('native role/office membership or definition disagrees')
      }
    }
  }
  for (const [officeId, membership] of index) {
    for (const jobId of membership) {
      const declared = native.get(jobId).offices
      const bound = declared.some(reference => {
        let current = reference.id
        while (current !== null) {
          if (current === officeId) return true
          current = offices.get(current).parent_id
        }
        return false
      })
      if (!bound) fail('office role index references another office branch')
    }
  }
  const raleigh = offices.get(4018013006), country = offices.get(4006094006), region = offices.get(4006020006)
  if (payload.jobs.length && (!raleigh || !country || raleigh.name !== 'Raleigh, NC' || raleigh.location !== null
    || raleigh.parent_id !== country.id || raleigh.child_ids.length || country.name !== 'United States'
    || country.location !== null || !country.child_ids.includes(raleigh.id)
    || country.parent_id !== region?.id || region?.name !== 'AMR' || region.location !== null || region.parent_id !== null
    || !region.child_ids.includes(country.id) || !region.child_ids.includes(raleigh.id))) fail('observed Raleigh country parent is not bound')
  const interpretedIds = []
  const jobs = payload.jobs.map(record => {
    if (record.location?.name !== 'Raleigh, NC' || record.offices.length !== 1 || record.offices[0].id !== 4018013006) return record
    interpretedIds.push(String(record.id))
    return { ...record, location: { ...record.location, name: record.location.name + ', ' + country.name },
      offices: [{ ...record.offices[0], location: record.location.name + ', ' + country.name }] }
  })
  return { payload: { ...payload, jobs }, proof: { method: 'couchbase-current-office-index-and-country-parent',
    officeId: 4018013006, nativeOfficeName: raleigh?.name ?? null,
    parentOfficeId: 4006094006, nativeParentName: country?.name ?? null,
    nativeOffice: raleigh ? definition(raleigh) : null, nativeCountryParent: country ? definition(country) : null,
    jobIds: interpretedIds, indexJobIds: [...indexIds].map(String).sort(),
    nativeOfficeIndexModelSha256: createHash('sha256').update(JSON.stringify(officePayload)).digest('hex') } }
}
