import {readFileSync} from 'node:fs'
import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {createCurrentReader,need} from './currentRead20261117.js'
const HOME='https://indiit.com/',PUBLISHER=HOME+'ai-development-app/',profile=JSON.parse(readFileSync(new URL('./reviewedCurrent20261117.json',import.meta.url))),holds=['no-current-recruitment-handoff-in-reviewed-publisher-or-seven-declared-programmes','Careers-footer-label-has-null-href-not-vacancy-inventory','employer-role-country-full-criteria-application-and-whole-company-scope-unknown']
export async function runCurrentIndiIt(options={}){
 const io=createCurrentReader(options,[[HOME,'html'],...profile.documents.map(p=>[p.url,p.kind])],{maxReads:18,redirects:{[HOME]:{status:302,target:PUBLISHER}}})
 try{
  const acquire=async()=>{
   const redirect=await io.read(HOME);need(redirect.status===302&&redirect.location===PUBLISHER&&redirect.sha256===profile.redirects[0].sha256,'exact current302 publisher handoff changed');const originals=[{url:HOME,status:redirect.status,location:redirect.location,body:redirect.text}]
   for(const [i,p]of profile.documents.entries()){
    const page=await io.read(p.url);need(page.sha256===p.sha256,'current complete native publisher/programme profile changed')
    if(i===0){const doc=readNativeDocument(page.text);need(isDeepStrictEqual(activeHead(page.text).titles,['Indi IT Solutions — AI Development Company'])&&!doc.nodes(n=>n.tag==='base').length,'current publisher identity/base changed');for(const program of profile.documents.slice(1))need(doc.nodes(n=>n.tag==='script'&&new URL(n.attrs.src??'',PUBLISHER).href===program.url).length===1,'current unique declared programme changed')}
    if(p.url.includes('/footer/'))need(/label:\s*"Careers",\s*href:\s*null/.test(page.text),'current footer Careers preference changed')
    originals.push({url:p.url,body:page.text})
   }
   return originals
  }
  const opening=await acquire(),closing=await acquire();need(isDeepStrictEqual(opening,closing),'whole native publisher/programme closing changed');io.check()
  const jobs=attachInventoryEvidence([],{status:'discovery-only',surface:PUBLISHER,firstParty:true,listingComplete:false,pagesFetched:io.stats().requests,reportedTotal:null,indiaFacetCount:null,lifecycleCleanupAllowed:false,verifiedAt:new Date().toISOString(),reason:holds.join('; ')})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{source:'indiitsolutions',sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,nativeFooterCareerPreference:{label:'Careers',href:null},fullNativeClosingEqual:true,originalModels:{opening,closing},holds,acquisition:io.stats()},configurable:true});return jobs
 }finally{io.close()}
}
