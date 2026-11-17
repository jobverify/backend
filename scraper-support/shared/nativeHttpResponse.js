import {buildHttpError,isHttpAccessChallenge} from '../utils/fetch.js'
import {disposeResponseBody} from './responseBodyDisposal.js'

// An unavailable HTTP response is not a changed employer or an empty board.
// Keep URL identity failures hard even when the response also has an error status.
// signal bounds response cleanup. Pass callerSignal separately when signal
// includes a local deadline; legacy callers keep their exact abort semantics.
export async function requireNativeHttpResponse(response,requestedUrl,{context='Native HTTP response',signal,callerSignal=signal}={}){
 callerSignal?.throwIfAborted()
 const status=response.status,responseUrl=response.url
 const challenge=isHttpAccessChallenge(response)
 if(status===200&&responseUrl===requestedUrl&&!challenge)return
 const identityMismatch=responseUrl!==requestedUrl
 const blocked=challenge||[401,402,403,406,407,429,451].includes(status)
 const unavailable=blocked||status===202||status>=500&&status<=599
 const error=buildHttpError(response,requestedUrl)
 error.message=context+': '+error.message+'; observed response URL '+String(responseUrl)
 Object.assign(error,{httpStatus:status,requestedUrl,responseUrl,contentType:response.headers?.get?.('content-type')??null,...(challenge?{accessChallenge:true}:{}),
  softFailure:!identityMismatch&&unavailable,upstreamOutage:!identityMismatch&&unavailable,
  failureKind:identityMismatch||!unavailable?'parser_or_contract_error':blocked?'blocked_or_access_denied':status===202?'upstream_response_pending':'network_or_timeout',
  lifecycleCleanupAllowed:false,sourceScopeComplete:false,
 })
 if(identityMismatch||blocked)error.abortRetries=true
 if(response.body&&!response.bodyUsed){try{await disposeResponseBody(response,{signal,bestEffort:true})}catch{}}
 callerSignal?.throwIfAborted()
 throw error
}
