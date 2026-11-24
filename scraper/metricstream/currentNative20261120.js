import {createHash} from 'node:crypto'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
const SOURCE='metricstream',HOME='https://www.metricstream.com/',CAREERS='https://www.metricstream.com/about-us/careers.htm'
const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex')
const fail=(message,fields)=>firstPartyFailure(SOURCE,message,{failureKind:'surface_drift_or_fail_closed',sourceScopeComplete:false,...fields})
const one=(nodes,label)=>{if(nodes.length!==1)throw fail('Expected one active '+label);return nodes[0]}
const country=location=>/(?:^|,\s*)India$/i.test(location)?'India':location==='United States'?'United States':location==='London (UK)'?'United Kingdom':null
const cls=(node,name)=>(node.attrs.class??'').split(/\s+/).includes(name)
const model=node=>typeof node==='string'?node:{tag:node.tag,attrs:node.attrs,children:node.children.map(model),...(node.raw!==undefined?{raw:node.raw}:{}),inert:node.inert===true}
const tree=d=>model(d.nodes(n=>n.tag==='root')[0])
function document(html,url){
 const d=readNativeDocument(html)
 if(d.nodes(n=>n.tag==='base').length)throw fail('Unexpected active base URL')
 const canonical=one(d.nodes(n=>n.tag==='link'&&(n.attrs.rel??'').split(/\s+/).includes('canonical')),'canonical')
 if(canonical.attrs.href!==url)throw fail('Canonical native identity changed')
 return d
}
export function readCurrentMetricListings(html){
 const d=document(html,CAREERS),titles=activeHead(html).titles
 if(titles.length!==1||titles[0]!=='Careers & Job Opportunities - MetricStream')throw fail('Current careers title changed')
 const panel=one(d.nodes(n=>n.tag==='ul'&&cls(n,'msp__panel')),'published jobs panel')
 const cards=d.nodes(n=>n.tag==='details'&&cls(n,'msp__job'),panel)
 if(!cards.length||cards.length>64)throw fail('Unreviewed empty or excessive current role panel')
 const records=cards.map((card,index)=>{
  const title=d.text(one(d.nodes(n=>cls(n,'msp__jobname'),card),'role title')),department=d.text(one(d.nodes(n=>cls(n,'msp__tag'),card),'role department'))
  const facts=d.nodes(n=>cls(n,'msp__fact'),card).map(n=>d.text(n)),link=one(d.nodes(n=>n.tag==='a'&&cls(n,'msp__cta'),card),'native role link'),sourceUrl=link.attrs.href
  if(!title||!department||facts.length!==2||!facts.every(Boolean)||d.text(link)!=='Apply Now'||!/^https:\/\/www\.metricstream\.com\/careers\/[a-z0-9-]+\.html$/.test(sourceUrl))throw fail('Unbound or incomplete current role card')
  const date=facts[1].match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if(!date)throw fail('Unknown published role date')
  const postingDate=date[3]+'-'+date[1]+'-'+date[2]
  if(!Number.isFinite(Date.parse(postingDate))||new Date(postingDate).toISOString().slice(0,10)!==postingDate)throw fail('Invalid published date')
  return {ordinal:index+1,title,department,location:facts[0],nativeCountry:country(facts[0]),postingDate,nativePostingDate:facts[1],sourceUrl,fullModel:model(card)}
 })
 return {records,fullModel:tree(d)}
}
export function readCurrentMetricDetail(html,url){
 const d=document(html,url),title=d.text(one(d.nodes(n=>n.tag==='h1'&&cls(n,'ms-jd__title')),'detail title')),location=d.text(one(d.nodes(n=>cls(n,'ms-jd__chip')),'detail location'))
 const main=one(d.nodes(n=>n.tag==='main'&&cls(n,'ms-jd__content')),'complete native criteria'),form=one(d.nodes(n=>n.tag==='form'&&n.attrs.id==='ms-vp-apply-form'),'native application form')
 const text=d.text(main),fields=d.nodes(n=>['input','select','textarea','button'].includes(n.tag),form).map(n=>({tag:n.tag,attrs:n.attrs,text:d.text(n)}))
 if(!title||!location||!text.includes('About MetricStream')||text.length<300)throw fail('Incomplete own-authored detail')
 const roleField=fields.filter(n=>n.tag==='input'&&n.attrs.name==='page_url')
 const nativeFormActive=form.attrs.method==='post'&&form.attrs.action==='https://www.metricstream.com/careers/submit.php'&&form.attrs.enctype==='multipart/form-data'&&roleField.length===1
 return {title,location,nativeCountry:country(location),sourceUrl:url,criteriaText:text,criteria:model(main),form:model(form),fields,nativeFormActive,formRole:roleField[0]?.attrs.value??null,fullModel:tree(d)}
}
export async function runCurrentMetricStream(options={},homepageGate){
 const io=createCurrentNativeReader(options,{source:SOURCE,admitted:[[HOME,'html'],[CAREERS,'html']],learnedURL:(url,kind)=>kind==='html'&&/^https:\/\/www\.metricstream\.com\/careers\/[a-z0-9-]+\.html$/.test(url)})
 const audit={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:0,observedVacancyCount:0,companyGlobalTotal:null,companyIndiaTotal:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,closingReconciled:false,indiaJobs:0,eligibleJobs:0,records:[],documents:[],unvisitedLinkedIn:true}
 const read=async url=>{const r=await io.read(url);audit.documents.push({url:r.url,sha256:r.sha256,body:r.body});return r.body}
 try{
  const home=await read(HOME),hd=readNativeDocument(home)
  if(typeof homepageGate!=='function'||!homepageGate(home)||hd.nodes(n=>n.tag==='base').length||!hd.nodes(n=>n.tag==='a'&&new URL(n.attrs.href??'',HOME).href===CAREERS).length)throw fail('Current own homepage careers handoff changed')
  const opening=readCurrentMetricListings(await read(CAREERS)),details=new Map()
  audit.records=structuredClone(opening.records);audit.observedRecordCount=audit.observedVacancyCount=opening.records.length
  for(const record of opening.records)if(!details.has(record.sourceUrl)){io.allow(record.sourceUrl,'html');details.set(record.sourceUrl,readCurrentMetricDetail(await read(record.sourceUrl),record.sourceUrl))}
  for(const r of audit.records){
   const detail=details.get(r.sourceUrl);r.detail=detail;r.country=detail.nativeCountry===r.nativeCountry?detail.nativeCountry:null
   r.hold=r.title!==detail.title?'listing_detail_title_conflict':r.nativeCountry!==detail.nativeCountry?'listing_detail_country_conflict':r.country!=='India'?'explicit_non_india_or_unknown_country':'current_native_role_not_qualified'
  }
  // Current rows have no consistent India candidate. A genuinely new candidate
  // stays held pending a current complete identity/criteria/application review.
  audit.indiaJobs=audit.records.filter(r=>r.country==='India').length
  audit.indiaListingObservations=audit.records.filter(r=>r.nativeCountry==='India').length
  const closeHome=await read(HOME),closing=readCurrentMetricListings(await read(CAREERS)),closedDetails=new Map()
  for(const url of details.keys())closedDetails.set(url,readCurrentMetricDetail(await read(url),url))
  audit.openingModelSHA256=hash(opening);audit.closingModelSHA256=hash(closing)
  const fullModelsEqual=hash(home)===hash(closeHome)&&hash(opening)===hash(closing)&&[...details].every(([url,detail])=>hash(detail)===hash(closedDetails.get(url)))
  audit.closingModels={listing:closing,details:[...closedDetails].map(([url,detail])=>({url,detail}))}
  const half=audit.documents.length/2
  audit.rawGlobalEqual=Number.isInteger(half)&&audit.documents.slice(0,half).every((r,i)=>r.url===audit.documents[i+half].url&&r.sha256===audit.documents[i+half].sha256)
  audit.closingReconciled=fullModelsEqual
  io.check()
  throw fail(audit.closingReconciled?'Current own roles retained; country/title conflicts and non-India roles cannot establish an eligible or complete company inventory':'Current native opening/closing models differ')
 }catch(error){
  options.signal?.throwIfAborted()
  if(error&&typeof error==='object'&&Object.isExtensible(error)){audit.transport=io.stats();Object.assign(error,{abortRetries:true,nativeCollectionEvidence:audit,lifecycleCleanupAllowed:false,sourceScopeComplete:false})}
  if(!Number.isInteger(error?.status)&&!Number.isInteger(error?.httpStatus))io.check()
  options.signal?.throwIfAborted();throw error
 }finally{io.close();options.signal?.throwIfAborted()}
}
