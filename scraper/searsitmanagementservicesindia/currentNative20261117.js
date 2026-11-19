import{readFileSync}from'node:fs'
import{isDeepStrictEqual as equal}from'node:util'
import{parse}from'acorn'
import{createHash}from'node:crypto'
import{readNativeDocument,activeHead}from'../../scraper-support/utils/activeNativeHtml.js'
import{clientScriptDeclarations,hasClientDocumentBase}from'../../scraper-support/utils/reviewedClientProgram.js'
import{currentTransport}from'./currentTransport20261117.js'
import{wholeHeldModel,check,unavailable}from'./currentModels20261117.js'
const p=JSON.parse(readFileSync(new URL('./currentProfile20261117.json',import.meta.url),'utf8')),sha=s=>createHash('sha256').update(s).digest('hex')
function reviewedDeclarations(declarations){
 const signatures=declarations.map(n=>({attrs:n.attrs,sha256:sha(n.raw??'')}))
 // The one additional complete GoDaddy telemetry carrier changes only its
 // server identifier and options-byte count; the openings client is identical.
 const profiles=[p.executableDeclarations,p.executableDeclarations.map((n,index)=>index===10?p.trackingDeclaration20261118:n)]
 return profiles.some(profile=>equal(signatures,profile))
}
export async function runCurrentSears(options={}){
 options.signal?.throwIfAborted();check(options.fetchImpl||!options.fetchText&&!options.fetchPage,'current acquisition requires metadata-aware fetchImpl; body-only callbacks are unqualified');const io=currentTransport({...options,label:'Sears India',allowedURL:u=>[p.root,p.careers,p.api].includes(u)});let opening
 try{const home=await io.read(p.root),doc=readNativeDocument(home.text);check(!hasClientDocumentBase(home.text)&&equal(activeHead(home.text).titles,p.rootTitles)&&doc.nodes(n=>n.tag==='a'&&new URL(n.attrs.href??'',home.url).href===p.careers).length>0,'actual own current Sears employer/careers declaration');const careers=await io.read(p.careers);check(!hasClientDocumentBase(careers.text)&&equal(activeHead(careers.text).titles,p.careersTitles),'current own careers publisher');const declarations=clientScriptDeclarations(careers.text),client=declarations.filter(n=>equal(n.attrs,p.client.attrs)&&Buffer.byteLength(n.raw??'')===p.client.bytes&&sha(n.raw??'')===p.client.sha256);check(reviewedDeclarations(declarations)&&client.length===1,'complete current finite careers executable declaration context');const fullNativeClientAST=parse(client[0].raw,{ecmaVersion:'latest',sourceType:'script'});check(sha(JSON.stringify(fullNativeClientAST))===p.client.wholeASTSHA256,'whole current openings initialisation AST');opening={corporate:wholeHeldModel(home),careers:wholeHeldModel(careers),nativeClient:{attrs:client[0].attrs,raw:client[0].raw,fullAST:fullNativeClientAST},nativeDeclaredOpeningEndpoint:p.api,notAnEmployerWideEmptyInventory:true};io.checkpoint();const api=await io.read(p.api,'json');opening.fullNativeAPIModel=api.value;const error=unavailable('searsitmanagementservicesindia','Current declared Sears openings client requires an independently qualified native inventory; raw response retained without treating empty data as employer-wide zero.',io,opening,null,{closingReconciliationComplete:false,pagesFetched:io.receipts.length});io.checkpoint();throw error
 }catch(error){options.signal?.throwIfAborted();if(!error||typeof error!=='object')throw error;if(error.httpStatus===404&&error.responseUrl===p.api)Object.assign(error,{failureKind:'source_inventory_unavailable',softFailure:true,upstreamOutage:false,abortRetries:true});Object.defineProperty(error,'nativeCollectionEvidence',{configurable:true,value:{source:'searsitmanagementservicesindia',nativeOpeningModel:opening,nativeClosingModel:null,failedNativeRequest:{url:p.api,httpStatus:error.httpStatus,requestedUrl:error.requestedUrl,responseUrl:error.responseUrl,contentType:error.contentType},retainedResponses:io.receipts,pagesFetched:io.receipts.length+(Number.isInteger(error.httpStatus)?1:0),closingReconciliationComplete:false,observedVacancyCount:null,companyIndiaTotal:null,companyGlobalTotal:null,sourceScopeComplete:false,browserEquivalenceComplete:false,lifecycleCleanupAllowed:false,verifiedEmpty:false,applicationSubmitted:false}});options.signal?.throwIfAborted();if(!Number.isInteger(error.httpStatus))io.checkpoint();throw error
 }finally{io.close();options.signal?.throwIfAborted()}
}
