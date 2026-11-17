import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {createCurrentReader,need} from './currentRead20261117.js'
const SOURCE='pletratechnologiesindiapvtltd',HOME='https://pletratech.com/',CAREERS=HOME+'careers-pletra-technologies/',API=HOME+'wp-json/wp/v2/pages/50',holds=['published-native-accordion-observations-not-qualified-India-vacancies-or-complete-company-inventory','bare-city-and-unpublished-role-location-country-unqualified','shared-CF7-form-requires-unpublished-role-code-no-row-application-binding','legal-employer-rendering-programme-dependency-and-company-scope-unqualified']
const one=(rows,label)=>{need(rows.length===1,'expected unique '+label);return rows[0]}
const rawNodes=(node,predicate)=>[...(predicate(node)?[node]:[]),...node.children.filter(child=>typeof child!=='string').flatMap(child=>rawNodes(child,predicate))]
export function parseCurrentPletraRows(html){
 const doc=readNativeDocument(html),rows=doc.nodes(n=>doc.hasClass(n,'elementor-accordion-item')),ids=new Set()
 need(rows.length>0&&rows.length<=40&&!doc.nodes(n=>n.tag==='base').length,'native accordion bounds/base changed')
 return rows.map(row=>{
  const titleNode=one(doc.nodes(n=>doc.hasClass(n,'elementor-tab-title'),row),'native title carrier'),region=one(doc.nodes(n=>doc.hasClass(n,'elementor-tab-content'),row),'native criteria carrier'),title=doc.text(one(doc.nodes(n=>n.tag==='a'&&doc.hasClass(n,'elementor-accordion-title'),titleNode),'native authored role title')),id=titleNode.attrs.id
  need(/^elementor-tab-title-\d+$/.test(id)&&!ids.has(id)&&titleNode.attrs.role==='button'&&titleNode.attrs['aria-controls']===region.attrs.id&&region.attrs.role==='region'&&region.attrs['aria-labelledby']===id&&titleNode.attrs['data-tab']===region.attrs['data-tab'],'native role/criteria identity binding differs');ids.add(id)
  const sourceDescription=doc.text(region);need(title.length>0&&title.length<=300&&sourceDescription.length>=100&&sourceDescription.length<=100000,'native title/full authored criteria changed')
  const locationMatch=title.match(/^(.*?)\s*-\s*Location\s*-\s*(.+)$/i)??title.match(/^(.*?)\s*-\s*(Belgium)$/i),literalLocation=locationMatch?.[2]??null,country=literalLocation==='Belgium'?'Belgium':literalLocation==='India'?'India':null
  return{nativeId:id,nativeIdKind:'publisher-dom-accordion-title-id',jobId:null,requisitionId:null,title,sourceUrl:CAREERS+'#'+id,literalLocation,location:null,city:null,country,sourceDescription,sourceDetailComplete:false,sourceEmployerQualified:false,sourceApplicationQualified:false,postingDate:null,originalModel:structuredClone(row),holds:['shared-form-role-code-unpublished','application-and-employer-unqualified',...(country?[]:['native-role-country-unqualified'])]}
 })
}
export async function runCurrentPletra(options={}){
 const io=createCurrentReader(options,[[HOME,'html'],[CAREERS,'html'],[API,'json']],{maxReads:6})
 try{
  const acquire=async()=>{
   const home=await io.read(HOME),hd=readNativeDocument(home.text);need(isDeepStrictEqual(activeHead(home.text).titles,['Salesforce Implementation Partner | Revenue, CPQ & Agentforce Experts'])&&hd.nodes(n=>n.tag==='meta'&&n.attrs.property==='og:site_name'&&n.attrs.content==='PletraTech').length===1&&!hd.nodes(n=>n.tag==='base').length,'current corporate publisher identity changed');const careerLinks=hd.nodes(n=>n.tag==='a'&&/^Careers$/i.test(hd.text(n)));need(careerLinks.length>0&&careerLinks.every(n=>new URL(n.attrs.href,HOME).href===CAREERS),'current corporate careers declaration changed')
   const page=await io.read(CAREERS),doc=readNativeDocument(page.text);need(isDeepStrictEqual(activeHead(page.text).titles,['Careers at PletraTech | Salesforce Jobs in Pune & Belgium'])&&one(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'native canonical').attrs.href===CAREERS&&one(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='alternate'&&n.attrs.type==='application/json'),'declared native page API').attrs.href===API,'current careers/native API identity changed')
   const native=await io.read(API),model=JSON.parse(native.text);need(model.id===50&&model.slug==='careers-pletra-technologies'&&model.status==='publish'&&model.type==='page'&&model.link===CAREERS&&model.title?.rendered==='Careers'&&model.content?.protected===false&&typeof model.content.rendered==='string','current public native page50 changed')
   const records=parseCurrentPletraRows(page.text),apiRecords=parseCurrentPletraRows(model.content.rendered);need(isDeepStrictEqual(records,apiRecords),'complete HTML/API native role criteria models differ')
   const form=one(doc.nodes(n=>n.tag==='form'&&doc.hasClass(n,'wpcf7-form')),'current shared CF7 application form'),controls=rawNodes(form,n=>['input','textarea','select'].includes(n.tag))
   need(form.attrs.action==='/careers-pletra-technologies/#wpcf7-f1526-p50-o1'&&form.attrs.method==='post'&&form.attrs.enctype==='multipart/form-data'&&controls.some(n=>n.attrs.name==='your-role'&&n.attrs.placeholder==='Job Role Code*'&&n.attrs['aria-required']==='true')&&controls.some(n=>n.attrs.name==='your-city'&&n.attrs.placeholder==='City*'),'current shared required-role-code application carrier changed')
   return{home:{url:HOME,body:home.text},page:{url:CAREERS,body:page.text},api:{url:API,body:native.text,model},records,originalApplicationForm:structuredClone(form)}
  }
  const opening=await acquire(),closing=await acquire();need(isDeepStrictEqual(opening.records,closing.records)&&isDeepStrictEqual(opening.api,closing.api),'whole native criteria/page50 closing changed');io.check()
  const equal=isDeepStrictEqual(opening,closing),formEqual=isDeepStrictEqual(opening.originalApplicationForm,closing.originalApplicationForm),currentHolds=[...holds,...(equal?[]:['whole-raw-publisher-opening-closing-differs-no-completeness-promotion']),...(formEqual?[]:['whole-raw-shared-application-form-closing-differs-no-application-promotion'])],counts={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:opening.records.length,observedVacancyCount:opening.records.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null}
  const jobs=attachInventoryEvidence([],{status:'discovery-only',surface:CAREERS,firstParty:true,listingComplete:false,pagesFetched:io.stats().requests,reportedTotal:null,indiaFacetCount:null,lifecycleCleanupAllowed:false,verifiedAt:new Date().toISOString(),reason:currentHolds.join('; ')})
  attachSourceObservationEvidence(jobs,counts);Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{...counts,lifecycleCleanupAllowed:false,fullNativeClosingEqual:equal,fullNativeCriteriaClosingEqual:true,fullNativeApplicationFormClosingEqual:formEqual,records:opening.records,originalModels:{opening,closing},holds:currentHolds,acquisition:io.stats()},configurable:true});io.check();return jobs
 }finally{io.close()}
}
