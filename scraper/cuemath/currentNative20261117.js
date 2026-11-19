import{readFileSync}from'node:fs'
import{createHash}from'node:crypto'
import{isDeepStrictEqual as equal}from'node:util'
import{readNativeDocument,activeHead}from'../../scraper-support/utils/activeNativeHtml.js'
import{clientScriptDeclarations,hasClientDocumentBase}from'../../scraper-support/utils/reviewedClientProgram.js'
import{currentTransport}from'./currentTransport20261117.js'
const profile=JSON.parse(readFileSync(new URL('./currentProfile20261117.json',import.meta.url),'utf8')),sha=s=>createHash('sha256').update(s).digest('hex')
const check=(ok,reason)=>{if(!ok)throw Object.assign(Error('Cuemath current native contract: '+reason),{abortRetries:true,failureKind:'parser_or_contract_error',sourceScopeComplete:false,lifecycleCleanupAllowed:false})}
export async function runCurrentCuemath(options={}){
 options.signal?.throwIfAborted();const io=currentTransport({...options,label:'Cuemath',allowedURL:url=>[profile.root,profile.apply,profile.client.url].includes(url)})
 try{const acquire=async()=>{
   const redirect=await io.read(profile.root,'html',{status:307,location:'/apply'});check(redirect.status===307&&redirect.location==='/apply','literal owned current redirect')
   const page=await io.read(profile.apply),doc=readNativeDocument(page.text)
   check(!hasClientDocumentBase(page.text)&&equal(activeHead(page.text).titles,['Teach with Cuemath · Apply']),'effective current application identity')
   check(equal(clientScriptDeclarations(page.text).map(n=>({attrs:n.attrs,...(n.attrs.src?{}:{sha256:sha(n.raw??'')})})),profile.programs),'whole current executable declaration graph')
   const config=doc.nodes(n=>n.tag==='script'&&n.attrs.id==='apply-config'&&n.attrs.type==='application/json');check(config.length===1,'active whole application config')
   const applicationConfig=JSON.parse(config[0].raw);check(applicationConfig.mode==='landing'&&applicationConfig.dev===false&&Array.isArray(applicationConfig.openRegions)&&Array.isArray(applicationConfig.degrees),'current native public screening config model')
   const client=await io.read(profile.client.url,'js');check([profile.client,...(profile.reviewedClientVersions||[])].some(version=>client.bodySHA256===version.sha256&&client.bodyBytes===version.bytes),'whole reviewed current screening program')
   io.checkpoint();return{redirect:{url:redirect.url,status:redirect.status,location:redirect.location,html:redirect.text},url:page.url,fullNativeHTML:page.text,programs:profile.programs,applicationConfig,wholeClientSHA256:client.bodySHA256}
  },opening=await acquire(),closing=await acquire(),applicationModel=model=>({...model,redirect:{url:model.redirect.url,status:model.redirect.status,location:model.redirect.location}})
  check(equal(applicationModel(opening),applicationModel(closing)),'full native application/config/program/passive intake context changed at closing');io.checkpoint()
  throw Object.assign(Error('Cuemath current declared tutor screening publishes applicant eligibility/intake rather than a reviewed vacancy inventory; employer-wide vacancy totals remain unknown'),{name:'CuemathNativeInventoryUnavailableError',abortRetries:true,softFailure:true,failureKind:'source_inventory_unavailable',sourceScopeComplete:false,lifecycleCleanupAllowed:false,nativeCollectionEvidence:{source:'cuemath',nativeOpeningModel:opening,nativeClosingModel:closing,closingFullCurrentIntakeMatch:equal(opening,closing),closingNativeApplicationModelMatches:true,closingRedirectResponseHTMLMatches:opening.redirect.html===closing.redirect.html,unexecutedRedirectContextHeld:true,closingVacancyInventoryMatches:false,observedVacancyCount:null,companyGlobalTotal:null,companyIndiaTotal:null,genericTutorHiringSignals:1,sourceScopeComplete:false,lifecycleCleanupAllowed:false,applicationSubmitted:false,publicEligibility:null,applicantFeeOrAuthenticationPerformed:false,browserEquivalenceComplete:false,verifiedEmpty:false,retainedResponses:io.receipts}})
 }finally{io.close()}
}
