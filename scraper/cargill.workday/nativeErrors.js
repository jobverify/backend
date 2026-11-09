// Only fixed source guard messages/stages and these enumerated transport codes
// become reporting codes. Upstream text, URLs, headers and bodies never do.
const tagged = new WeakSet()
const stages = Object.freeze({home:'HOME',careers:'CAREERS',search:'SEARCH',client:'CLIENT',core:'CORE',listing:'LISTING',official:'OFFICIAL_ROLE',sap:'SAP',recheck:'RECHECK'})
const transportCodes = new Set(['ECONNRESET','ECONNREFUSED','ECONNABORTED','ETIMEDOUT','ENOTFOUND','EAI_AGAIN','CERT_HAS_EXPIRED','DEPTH_ZERO_SELF_SIGNED_CERT','SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT','UND_ERR_SOCKET'])

export function tagCargillError(error, code) {
  if (!error || (typeof error !== 'object' && typeof error !== 'function') || tagged.has(error)) return error
  // Preserve the worker's existing permission-failure classification.
  if (error.code === 'ERR_ACCESS_DENIED' || error.code === 'ERR_DLOPEN_DISABLED') return error
  if (!/^CARGILL_[A-Z_0-9]+$/.test(code) || code.length > 80) return error
  try {
    Object.defineProperty(error, 'code', {value:code, writable:true, configurable:true, enumerable:true})
    tagged.add(error)
  } catch {
    // An immutable thrown value must still reject as the original value.
  }
  return error
}

export function cargillGuardError(scope, message) {
  // Both scope and message come exclusively from fixed source-local callsites;
  // cardinality labels are also fixed literals, never native document content.
  const code = ('CARGILL_'+scope+'_'+message.toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_|_$/g,'')).slice(0,80)
  return tagCargillError(Error('Cargill native '+(scope==='RUN'?'run':'contract')+': '+message),code)
}

export function cargillHttpCode(stage, status) {
  return 'CARGILL_HTTP_'+(stages[stage]??'UNKNOWN')+'_'+(Number.isInteger(status)&&status>=100&&status<=599?status:'OTHER')
}

export function cargillTransportCode(operation, stage, error) {
  const name=operation==='body'?'BODY':'FETCH',candidate=transportCodes.has(error?.cause?.code)?error.cause.code:transportCodes.has(error?.code)?error.code:'FAILED'
  return 'CARGILL_'+name+'_'+(stages[stage]??'UNKNOWN')+'_'+candidate
}

export function parseCargillJson(value, stage) {
  try { return JSON.parse(value) }
  catch (error) {
    const label={listing:'LISTING',recheck:'RECHECK',official:'PUBLIC_ROLE'}[stage]??'UNKNOWN'
    throw tagCargillError(error,'CARGILL_'+label+'_JSON_INVALID')
  }
}

export function parseCargillAtStage(fn, stage) {
  try { return fn() }
  catch (error) {
    const label={bootstrap:'BOOTSTRAP',listing:'LISTING',recheck:'RECHECK',official:'OFFICIAL_ROLE',sap:'SAP'}[stage]??'UNKNOWN'
    throw tagCargillError(error,'CARGILL_'+label+'_PARSE_FAILED')
  }
}
