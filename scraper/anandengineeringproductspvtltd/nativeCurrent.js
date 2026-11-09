import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {HOME,CAREERS,need,readHome,readListing,readRoleDeclaration} from './currentDeclarations.js'
import {readRole,reconcile,mapRole} from './currentModels.js'
import {transport,cap} from './currentTransport.js'
const ORIGINALS=Symbol.for('jobverify.verified-recruitment-observations')
export const readAnandOriginalResponses=jobs=>structuredClone(jobs?.[ORIGINALS]?.nativeOriginalResponses||[])
export async function runNativeAnand(options={}){
 const maxJobs=cap(options.maxJobs,'job cap'),maxPages=cap(options.maxPages,'page cap');for(const key of ['onAudit','onRecords'])if(options[key]!==undefined&&typeof options[key]!=='function')throw TypeError('Anand native invalid '+key)
 const io=transport(options),{control}=io;let observed=0,collection
 const finish=jobs=>{
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS,firstParty:io.originals.length>0,listingComplete:false,pagesFetched:io.originals.length,reportedTotal:null,indiaFacetCount:null,reason:maxJobs===0||maxPages===0?'caller-zero-cap-no-inventory-proof':'complete-authored-native-channel-with-unqualified-country-hiring-and-rendered-criteria'})
  attachSourceObservationEvidence(jobs,{source:'anandengineeringproductspvtltd',recordKind:'vacancy-rows',observedRecordCount:observed,observedVacancyCount:observed,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  if(collection)Object.defineProperty(jobs,'nativeCollectionEvidence',{value:structuredClone(collection),configurable:true})
  const originals=io.originals.map(p=>Object.freeze({...p,headers:Object.freeze({...p.headers}),requestHeaders:Object.freeze({...p.requestHeaders})}));Object.defineProperty(jobs,ORIGINALS,{value:Object.freeze({source:'anandengineeringproductspvtltd',nativeOriginalResponses:Object.freeze(originals),sourceScopeComplete:false,lifecycleCleanupAllowed:false})});return jobs
 }
 try{
  control.check();if(maxJobs===0||maxPages===0)return finish([])
  const clock=options.now===undefined?new Date():typeof options.now==='function'?options.now():options.now;control.check();const time=new Date(clock).getTime();need(Number.isFinite(time),'invalid observation clock');const at=new Date(time).toISOString()
  const declarations=async()=>{const home=readHome((await io.read(HOME)).text),pages=[],cards=[];let url=CAREERS,page=1,max
   io.allow(CAREERS);while(url){const model=readListing((await io.read(url)).text,url,page,home.organization);if(max===undefined)max=model.maxPage;need(max===model.maxPage,'native listing maximum changed');need(max<=maxPages,'caller page limit prevents full native closure');pages.push(model);cards.push(...model.cards);url=model.nextURL;if(url){io.allow(url);page++}}
   need(pages.length===max&&pages.at(-1).page===max&&pages.at(-1).nextURL===null,'declared native terminal pagination not reached');need(cards.length>0&&cards.length<=100&&new Set(cards.map(c=>c.postID)).size===cards.length&&new Set(cards.map(c=>c.url)).size===cards.length,'duplicate or excessive whole native cohort');return{home,pages,cards}
  }
  const details=async declaration=>{const models=Array(declaration.cards.length);let cursor=0
   const worker=async()=>{while(cursor<models.length){control.check();const i=cursor++,card=declaration.cards[i];try{io.allow(card.url);const html=(await io.read(card.url)).text,role=readRoleDeclaration(html,card,declaration.home.organization);io.allow(role.jsonURL);const json=(await io.read(role.jsonURL,'json')).text;models[i]=readRole(html,json,card,declaration.home.organization)}catch(e){throw control.fail(e)}}}
   const settled=await Promise.allSettled(Array.from({length:Math.min(2,models.length)},worker));control.check();for(const r of settled)if(r.status==='rejected')throw r.reason;return models
  }
  const openingDeclaration=await declarations(),opening=await details(openingDeclaration),closingDeclaration=await declarations();reconcile(openingDeclaration,closingDeclaration,'home, publisher, pagination and listing models');const closing=await details(closingDeclaration)
  for(let i=0;i<opening.length;i++)reconcile(opening[i],closing[i],'role, criteria and CMS models')
  const records=opening.map((model,i)=>mapRole(openingDeclaration.cards[i],model,closing[i],at));observed=records.length
  const heldRecords=records.map(j=>({jobId:j.jobId,title:j.title,url:j.sourceUrl,reason:j.sourceDetailFailureKind,country:null,model:j.nativeSourceRecord,closingModel:j.nativeClosingRecord,sourceDetailComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false})),audit={source:'anandengineeringproductspvtltd',records,heldRecords,openingDeclaration,closingDeclaration,originalResponses:io.originals,nativeObservedRecords:observed,qualifiedIndiaRecords:0,wholeNativeModelsClosingReconciled:true,sourceScopeComplete:false,companyInventoryComplete:false,lifecycleCleanupAllowed:false,publisherProgramsExecuted:false,applicationInteractions:0,verifiedAt:at}
  if(options.onAudit)await io.observe(()=>options.onAudit(structuredClone(audit)));if(options.onRecords)await io.observe(()=>options.onRecords(structuredClone(records)))
  control.check();collection={source:audit.source,records,heldRecords,nativeObservedRecords:observed,qualifiedIndiaRecords:0,wholeNativeModelsClosingReconciled:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false};return finish(records.slice(0,maxJobs))
 }catch(e){const reason=control.fail(e);io.attachFailure(reason);throw reason}finally{control.dispose()}
}
