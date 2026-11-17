import {readFileSync} from 'node:fs'
import {isDeepStrictEqual as equal} from 'node:util'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {hasClientDocumentBase} from '../../scraper-support/utils/reviewedClientProgram.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {currentTransport} from './currentTransport20261117.js'
import {wholeHeldModel,readHeldProgramme,check} from './currentModels20261117.js'
const SOURCE='tecnicsintegrationtechnologies',p=JSON.parse(readFileSync(new URL('./currentProfile20261117.json',import.meta.url),'utf8')),holds=['current-business-identity-security-publisher-and-commercial-contact-form-are-not-vacancy-inventory','client-navigation-and-complete-acquired-programmes-do-not-prove-unreviewed-dependency-or-company-inventory-closure','office-country-contact-job-title-preferences-and-service-workforce-language-are-not-native-job-country-or-requisitions']
export async function runCurrentTecnics(options={}){
 options.signal?.throwIfAborted();check(!['fetchText','fetchPage','fetchJson','probeUrl','fetchBrowserText','fetchProtocolTolerantText'].some(k=>options[k]),'current acquisition requires metadata-aware fetchImpl; legacy callbacks unqualified')
 const io=currentTransport({...options,label:'Tecnics',allowedURL:u=>[...p.documents,...p.programmes].some(d=>d.url===u)})
 try{
  const acquire=async()=>{const documents=[],pages=new Map();for(const d of p.documents){if(documents.length){const parent=d.url.endsWith('/company/about')?pages.get('https://tecnics.com/company'):pages.get('https://tecnics.com/'),doc=readNativeDocument(parent.text);check(doc.nodes(n=>n.tag==='a'&&n.attrs.href&&new URL(n.attrs.href,parent.url).href===d.url).length>0,'actual own corporate context handoff')}
   const page=await io.read(d.url);check(!hasClientDocumentBase(page.text)&&page.bodySHA256===d.sha256&&page.bodyBytes===d.bytes&&equal(activeHead(page.text).titles,d.titles),'whole current own corporate publisher profile changed');pages.set(d.url,page);documents.push(wholeHeldModel(page))}
   const programmes=[];for(const binding of p.programmes)programmes.push(await readHeldProgramme(io,pages.get(binding.parent),binding));io.checkpoint();return{documents,programmes,commercialInquiryNotEmploymentApplication:true,browserEquivalenceComplete:false,companyInventoryClosure:false}}
  const opening=await acquire(),closing=await acquire();check(equal(opening,closing),'whole raw corporate/form/programme closing changed');const jobs=attachInventoryEvidence([],{status:'discovery-only',surface:p.documents[0].url,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:io.receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:holds.join('; ')});Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{source:SOURCE,nativeOpeningModel:opening,nativeClosingModel:closing,closingFullNativeModelsMatch:true,observedVacancyCount:null,companyGlobalTotal:null,companyIndiaTotal:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,applicationSubmitted:false,browserEquivalenceComplete:false,holds,retainedResponses:io.receipts},configurable:true});io.checkpoint();return jobs
 }finally{io.close();options.signal?.throwIfAborted()}
}
