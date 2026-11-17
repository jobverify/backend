import{readFileSync}from'node:fs'
import{createHash}from'node:crypto'
import{isDeepStrictEqual as equal}from'node:util'
import{readNativeDocument,activeHead}from'../../scraper-support/utils/activeNativeHtml.js'
import{clientScriptDeclarations,hasClientDocumentBase}from'../../scraper-support/utils/reviewedClientProgram.js'
import{currentTransport}from'./currentTransport20261117.js'
const p=JSON.parse(readFileSync(new URL('./currentProfile20261117.json',import.meta.url),'utf8')),sha=s=>createHash('sha256').update(s).digest('hex'),tree=n=>typeof n==='string'?n:{tag:n.tag,attrs:n.attrs,...(n.raw===undefined?{}:{raw:n.raw}),children:n.children.map(tree)}
const check=(ok,message)=>{if(!ok)throw Object.assign(Error('Polymed current native contract: '+message),{abortRetries:true,failureKind:'parser_or_contract_error',sourceScopeComplete:false,lifecycleCleanupAllowed:false})}
export async function runCurrentPolymed(options={}){
 options.signal?.throwIfAborted();const io=currentTransport({...options,label:'Polymed',allowedURL:url=>[p.careers,p.schema,...p.clients.map(c=>c.url)].includes(url)})
 try{const acquire=async()=>{
   const page=await io.read(p.careers),doc=readNativeDocument(page.text)
   check(!hasClientDocumentBase(page.text),'unreviewed document base')
   const head=activeHead(page.text),canonical=doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),og=head.metas.filter(n=>n.property==='og:title')
   check(canonical.length===1&&canonical[0].attrs.href===p.canonical&&og.length===1&&og[0].content===p.ogTitle,'active current corporate canonical/metadata')
   check(doc.nodes(n=>/^h[1-6]$/.test(n.tag)&&doc.text(n)==='Careers At Polymed').length>0,'active current careers heading')
   const forms=doc.nodes(n=>n.tag==='form'&&n.attrs.class?.split(/\s+/).includes('wpcf7-form'));check(forms.length===1&&equal(tree(forms[0]),p.form),'whole current generic application form')
   const programs=clientScriptDeclarations(page.text).map(n=>({attrs:n.attrs,...(n.attrs.src?{}:{sha256:sha(n.raw??'')})})),clients=[]
   for(const client of p.clients){check(programs.filter(n=>n.attrs.src===client.url).length===1,'unique active declared current form program');const r=await io.read(client.url,'js');check(r.bodySHA256===client.sha256&&r.bodyBytes===client.bytes,'whole reviewed form program');clients.push({...client,body:r.text})}
   const inline=clientScriptDeclarations(page.text).filter(n=>n.attrs.id==='contact-form-7-js-before'),reviewed=p.programs.filter(n=>n.attrs.id==='contact-form-7-js-before');check(inline.length===1&&reviewed.length===1&&sha(inline[0].raw??'')===reviewed[0].sha256,'exact active current form API initialization')
   const schema=await io.read(p.schema,'json');check(schema.value&&Array.isArray(schema.value.rules),'whole native public application rule model');io.checkpoint()
   return{url:page.url,fullNativeHTML:page.text,programs,form:tree(forms[0]),nativeFormClientPrograms:clients,fullApplicationSchema:schema.value,fullApplicationSchemaText:schema.text,displayedResumeLabel:doc.nodes(n=>n.tag==='label'&&doc.text(n).includes('Upload Resume')).map(doc.text),nativeResumeFileRules:schema.value.rules.filter(n=>n.field==='resume')}
  },opening=await acquire(),closing=await acquire();io.checkpoint()
  throw Object.assign(Error('Polymed current own careers surface publishes a general resume application with conflicting displayed and native upload limits; a vacancy inventory, role country and complete job criteria are not established'),{name:'PolymedNativeInventoryUnavailableError',abortRetries:true,softFailure:true,failureKind:'source_inventory_unavailable',sourceScopeComplete:false,lifecycleCleanupAllowed:false,nativeCollectionEvidence:{source:'polymed',nativeOpeningModel:opening,nativeClosingModel:closing,closingFullNativeModelMatches:equal(opening,closing),closingApplicationModelsMatch:equal(opening.form,closing.form)&&equal(opening.fullApplicationSchema,closing.fullApplicationSchema),unreviewedPageExecutableContextHeld:true,pageExecutableGraphMatchesReviewedCapture:equal(opening.programs,p.programs)&&equal(closing.programs,p.programs),observedVacancyCount:null,companyIndiaTotal:null,companyGlobalTotal:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,verifiedEmpty:false,applicationSubmitted:false,publicEligibility:null,browserEquivalenceComplete:false,retainedResponses:io.receipts}})
 }finally{io.close()}
}
