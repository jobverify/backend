// These are observations made by a source, never authoritative company totals.
export const SOURCE_OBSERVATION_EVIDENCE = Symbol.for('jobverify.source-observation-evidence')
const snapshots = new WeakMap()
const kinds = new Set(['vacancy-rows','departments','role-areas','categories','hiring-signals','mixed'])
const nonVacancyKinds = new Set(['departments','role-areas','categories','hiring-signals'])
const data = (value,key) => {
  if (!value || typeof value !== 'object') return undefined
  try { return Object.getOwnPropertyDescriptor(value,key)?.value } catch { return undefined }
}
const count = value => Number.isSafeInteger(value) && value >= 0 && value <= 1000000
const normalize = (value,returnedRows) => {
  const source=data(value,'source'), recordKind=data(value,'recordKind')
  const observedRecordCount=data(value,'observedRecordCount'), observedVacancyCount=data(value,'observedVacancyCount')
  if (typeof source !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,159}$/.test(source)
    || !kinds.has(recordKind) || data(value,'sourceScopeComplete') !== false
    || !count(observedRecordCount) || !count(observedVacancyCount)
    || observedVacancyCount > observedRecordCount || observedVacancyCount < returnedRows
    || recordKind === 'vacancy-rows' && observedVacancyCount !== observedRecordCount
    || nonVacancyKinds.has(recordKind) && observedVacancyCount !== 0
    || ![undefined,null].includes(data(value,'companyGlobalTotal'))
    || ![undefined,null].includes(data(value,'companyIndiaTotal'))) return null
  return Object.freeze({source,recordKind,observedRecordCount,observedVacancyCount,
    sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
}

export const attachSourceObservationEvidence = (jobs,evidence) => {
  if (!Array.isArray(jobs)) return jobs
  const snapshot=normalize(evidence,jobs.length)
  if (!snapshot) return jobs
  snapshots.set(jobs,snapshot)
  if (Object.isExtensible(jobs)) {
    const marker=Object.getOwnPropertyDescriptor(jobs,SOURCE_OBSERVATION_EVIDENCE)
    if (!marker || marker.configurable) Object.defineProperty(jobs,SOURCE_OBSERVATION_EVIDENCE,{value:snapshot,configurable:true})
    const existing=Object.getOwnPropertyDescriptor(jobs,'nativeCollectionEvidence')
    if (!existing || existing.configurable) Object.defineProperty(jobs,'nativeCollectionEvidence',{value:snapshot,configurable:true})
  }
  return jobs
}

export const readSourceObservationEvidence = (jobs,expectedSource) => {
  if (!Array.isArray(jobs) || typeof expectedSource !== 'string' || !expectedSource) return null
  const snapshot=normalize(snapshots.get(jobs) || data(jobs,SOURCE_OBSERVATION_EVIDENCE)
    || data(jobs,'nativeCollectionEvidence'),jobs.length)
  return snapshot?.source === expectedSource ? snapshot : null
}
