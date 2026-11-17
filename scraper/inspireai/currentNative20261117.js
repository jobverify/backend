import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {createCurrentReader,need} from './currentRead20261117.js'
const HOME='https://inspireai.com/careers/',API='https://inspireai.com/wp-json/wp/v2/pages/8033',holds=['native-accordion-observations-only-not-proven-complete-company-inventory','no-current-native-role-has-qualified-India-country-and-application-evidence','external-application-contracts-legal-employer-and-programme-dependency-closure-unqualified']
const one=(rows,label)=>{need(rows.length===1,'expected unique '+label);return rows[0]}
const safeURL=value=>{try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null}catch{return null}}
export function parseCurrentAccordions(html){
 const doc=readNativeDocument(html),rows=doc.nodes(n=>n.tag==='details'),ids=new Set(),titles=new Set()
 need(rows.length>0&&rows.length<=60&&!doc.nodes(n=>n.tag==='base').length,'current native accordion bounds/base changed')
 return rows.map(row=>{
  const id=row.attrs.id;need(doc.hasClass(row,'e-n-accordion-item')&&/^e-n-accordion-item-\d+$/.test(id)&&!ids.has(id),'native accordion identity differs or duplicates');ids.add(id)
  const summary=one(doc.nodes(n=>n.tag==='summary',row),'accordion summary'),titleNode=one(doc.nodes(n=>doc.hasClass(n,'e-n-accordion-item-title-text'),summary),'native title'),title=doc.text(titleNode),region=one(doc.nodes(n=>n.attrs.role==='region',row),'native role region')
  need(title.length>0&&title.length<=300&&!titles.has(title)&&region.attrs['aria-labelledby']===id,'native title/region binding changed');titles.add(title)
  const sourceDescription=doc.text(region),links=doc.nodes(n=>n.tag==='a',region),apply=one(links.filter(n=>doc.hasClass(n,'elementor-button-link')&&['PLAY NOW','APPLY HERE'].includes(doc.text(n))),'native apply declaration'),applyUrl=safeURL(apply.attrs.href)
  need(sourceDescription.length>=200&&sourceDescription.length<=100000&&applyUrl,'native complete description/apply carrier changed')
  const recordKind=title==='Future Opportunities'?'hiring-signal':'vacancy-row'
  if(recordKind==='hiring-signal')need(sourceDescription.includes('keep your details on file')&&sourceDescription.includes('if a suitable opportunity comes up'),'future-intake semantics changed')
  const paragraphs=doc.nodes(n=>n.tag==='p'||n.tag==='li',region).map(doc.text),locationParagraphs=paragraphs.filter(text=>/^Location:\s*/.test(text)),literalLocation=locationParagraphs.length===1?locationParagraphs[0]:null
  let country=null
  if(literalLocation&&/^Location: South Africa Based [–-] Fully Remote with an annual European offsite\./.test(literalLocation))country='South Africa'
  if(sourceDescription.includes('full-time, remote role based in the UK, with occasional travel'))country='United Kingdom'
  if(sourceDescription.includes('essentieel dat de juiste kandidaat in Nederland gevestigd is om klantbezoeken uit te voeren.'))country='Netherlands'
  return {nativeId:id,title,recordKind,sourceUrl:HOME+'#'+id,sourceDescription,literalLocation,country,city:null,location:null,applyUrl,sourceApplicationQualified:false,sourceEmployerQualified:false,sourceDetailComplete:false,postingDate:null,originalModel:structuredClone(row),holds:['application-not-validated','whole-company-scope-unqualified',...(country?[]:['role-country-unqualified'])]}
 })
}
export async function runCurrentInspire(options={}){
 const io=createCurrentReader(options,[[HOME,'html'],[API,'json']],{maxReads:4})
 try{
  const acquire=async()=>{
   const page=await io.read(HOME),doc=readNativeDocument(page.text)
   need(isDeepStrictEqual(activeHead(page.text).titles,['Careers – InspireAi'])&&doc.text(one(doc.nodes(n=>n.tag==='h1'),'careers heading'))==='Careers','current publisher careers identity changed')
   need(one(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'canonical').attrs.href===HOME&&one(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='alternate'&&n.attrs.type==='application/json'),'declared native API').attrs.href===API,'current publisher native API binding changed')
   const native=await io.read(API),model=JSON.parse(native.text)
   need(model&&model.id===8033&&model.status==='publish'&&model.slug==='careers'&&model.type==='page'&&model.link===HOME&&model.title?.rendered==='Careers'&&model.content?.protected===false&&typeof model.content.rendered==='string','published native page8033 contract changed')
   const records=parseCurrentAccordions(page.text),apiRecords=parseCurrentAccordions(model.content.rendered)
   need(isDeepStrictEqual(records,apiRecords),'complete native HTML/API accordion models differ')
   return {page:{url:HOME,body:page.text},api:{url:API,body:native.text,model},records}
  }
  const opening=await acquire(),closing=await acquire();need(isDeepStrictEqual(opening,closing),'whole raw current publisher/native page closing changed');io.check()
  const counts={source:'inspireai',recordKind:'mixed',observedRecordCount:opening.records.length,observedVacancyCount:opening.records.filter(r=>r.recordKind==='vacancy-row').length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null}
  const jobs=attachInventoryEvidence([],{status:'discovery-only',surface:HOME,firstParty:true,listingComplete:false,pagesFetched:io.stats().requests,reportedTotal:null,indiaFacetCount:null,lifecycleCleanupAllowed:false,verifiedAt:new Date().toISOString(),reason:holds.join('; ')})
  attachSourceObservationEvidence(jobs,counts)
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{...counts,lifecycleCleanupAllowed:false,fullNativeClosingEqual:true,fullNativeHTMLAPIAccordionModelsEqual:true,records:opening.records,originalModels:{opening,closing},holds,acquisition:io.stats()},configurable:true});io.check();return jobs
 }finally{io.close()}
}
