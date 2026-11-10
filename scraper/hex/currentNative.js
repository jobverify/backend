import {createFirstPartyDocumentReader,firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {activeHead,extractActiveDescription,readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const SOURCE='hex',CAREERS='https://hex.tech/careers/'
const fail=message=>{throw firstPartyFailure(SOURCE,message)}
const requireProof=(ok,message)=>{if(!ok)fail(message)}
const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
const hasClassPrefix=(node,prefix)=>(node.attrs.class||'').split(/\s+/).some(name=>name.startsWith(prefix))
const ownFields=(value,fields)=>value&&typeof value==='object'&&!Array.isArray(value)
 &&Object.keys(value).every(key=>fields.includes(key))
const exactFields=(value,fields)=>ownFields(value,fields)&&fields.every(key=>Object.hasOwn(value,key))

export const hasCurrentHexPublisher=html=>{
 try{
  const head=activeHead(html),expected={'og:title':'Hex Careers - Join the Team','og:site_name':'Hex','og:url':CAREERS}
  return head.titles.length===1&&head.titles[0]==='Hex Careers - Join the Team | Hex'
   &&Object.entries(expected).every(([property,content])=>{
    const metas=head.metas.filter(meta=>meta.property===property)
    return metas.length===1&&metas[0].content===content
   })
 }catch{return false}
}

export const isHexRoleURL=value=>{
 try{
  const url=new URL(value)
  return url.origin==='https://hex.tech'&&!url.username&&!url.password&&!url.search&&!url.hash
   &&/^\/careers\/[a-z0-9_()-]+\/$/.test(url.pathname)&&url.href===value
 }catch{return false}
}
const usOnly=value=>Boolean(value)&&value.replace(/\bRemote\s*-\s*US(?:\s*\((?:EST|CST|PST)\))?/gi,'')
 .replace(/\b(?:San Francisco|New York|SF|NYC)\b/gi,'').replace(/\b(?:or)\b|[,\s]/gi,'').length===0

export const readCurrentHexInventory=html=>{
 requireProof(hasCurrentHexPublisher(html),'Current careers publisher identity changed')
 const doc=readNativeDocument(html),root=doc.nodes(node=>node.tag==='root')[0]
 requireProof(!doc.nodes(node=>node.tag==='base').length,'Unexpected native base URL')
 const headings=doc.nodes(node=>node.tag==='h1').map(node=>doc.text(node))
 requireProof(headings.length===1&&headings[0]==='Make everyone a data person'
  &&doc.text(root).includes("We're hiring in San Francisco, New York, and remote."),'Current careers declaration changed')
 const totals=doc.nodes(node=>hasClassPrefix(node,'OpenRolesSidebar__TotalRoleCount'))
 const count=totals.length===1?doc.text(totals[0]).match(/^\[\s*(\d+)\s*\]$/):null
 const total=count?Number(count[1]):null
 requireProof(Number.isSafeInteger(total)&&total>0&&total<=40,'Missing or unbounded native role total')
 const cards=doc.nodes(node=>node.tag==='a'&&hasClassPrefix(node,'OpenRole__Wrapper')).map(node=>{
  const titles=doc.nodes(child=>child.tag==='p'&&hasClassPrefix(child,'OpenRole__TitleText'),node)
  const locations=doc.nodes(child=>child.tag==='p'&&hasClassPrefix(child,'OpenRole__LocationText'),node)
  let url;try{url=new URL(node.attrs.href,CAREERS).href}catch{}
  requireProof(titles.length===1&&locations.length===1&&isHexRoleURL(url),'Unbound or incomplete active native role card')
  const title=doc.text(titles[0]),location=doc.text(locations[0])
  requireProof(title&&usOnly(location),'Native card country is outside reviewed US-only scope')
  return{url,title,location}
 }).sort((a,b)=>a.url.localeCompare(b.url))
 const links=doc.nodes(node=>node.tag==='a'&&node.attrs.href).flatMap(node=>{
  try{const url=new URL(node.attrs.href,CAREERS);return url.origin==='https://hex.tech'&&/^\/careers\/[^/]+\/$/.test(url.pathname)?[url.href]:[]}catch{return[]}
 })
 requireProof(cards.length===total&&new Set(cards.map(card=>card.url)).size===total&&links.length===total
  &&links.every(url=>cards.some(card=>card.url===url)),'Active native cards and advertised inventory disagree')
 return{total,cards}
}

const schemaFields=['@context','@type','@id','title','description','datePosted','employmentType','url','hiringOrganization','jobLocation','industry']
const addressFields=['@type','addressCountry','addressLocality','addressRegion','streetAddress','postalCode']
// These complete native tuples were observed on every current public role.
// An explicit country cannot override a conflicting or newly unreviewed city.
const reviewedAddresses=[
 {'@type':'PostalAddress',addressCountry:'US'},
 {'@type':'PostalAddress',addressCountry:'US',addressLocality:'New York',addressRegion:'New York',postalCode:'10177'},
 {'@type':'PostalAddress',addressCountry:'US',addressLocality:'San Francisco',addressRegion:'California',postalCode:'94104'},
]
const reviewedAddress=address=>reviewedAddresses.some(expected=>Object.keys(address).length===Object.keys(expected).length
 &&Object.entries(expected).every(([key,value])=>address[key]===value))
const validPublication=value=>{
 const parts=typeof value==='string'&&value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-](\d{2}):(\d{2}))$/)
 if(!parts)return false
 const[,year,month,day,hour,minute,second,offsetHour='00',offsetMinute='00']=parts
 return +year>=1000&&+month>=1&&+month<=12&&+day>=1&&+day<=new Date(Date.UTC(+year,+month,0)).getUTCDate()
  &&+hour<24&&+minute<60&&+second<60&&+offsetHour<24&&+offsetMinute<60
  &&Number.isFinite(Date.parse(value))&&Date.parse(value)<=Date.now()+86400000
}
export const inspectCurrentHexRole=(html,row)=>{
 requireProof(isHexRoleURL(row?.url)&&typeof row.title==='string','Unbound own native role')
 const doc=readNativeDocument(html),root=doc.nodes(node=>node.tag==='root')[0]
 requireProof(!doc.nodes(node=>node.tag==='base').length,'Unexpected native role base URL')
 const models=doc.nodes(node=>node.tag==='script'&&!node.attrs.src&&node.attrs.type==='application/ld+json').flatMap(node=>{
  let model;try{model=JSON.parse(node.raw)}catch{fail('Malformed active native JSON-LD')}
  return Array.isArray(model)?model:Array.isArray(model?.['@graph'])?model['@graph']:[model]
 }).filter(model=>model?.['@type']==='JobPosting')
 requireProof(models.length===1,'Expected one active own native JobPosting')
 const model=models[0],headings=doc.nodes(node=>node.tag==='h1').map(node=>doc.text(node))
 requireProof(exactFields(model,schemaFields)&&model['@context']==='https://schema.org'&&model.url===row.url
  &&model['@id']===row.url+'#jobposting'&&norm(model.title)===row.title
  &&headings.length===1&&headings[0]===row.title,'Own complete native model conflicts with collection')
 const org=model.hiringOrganization
 requireProof(exactFields(org,['@type','@id','name','url'])&&org['@type']==='Organization'
  &&org['@id']==='https://hex.tech/#organization'&&org.name==='Hex'&&org.url==='https://hex.tech/','Native employer identity changed')
 const description=extractActiveDescription(model.description)
 requireProof(description&&description.length>=100&&doc.text(root).includes(description),'Full native criteria absent from active own role page')
 requireProof(validPublication(model.datePosted)&&['FULL_TIME','INTERN','PART_TIME','CONTRACTOR'].includes(model.employmentType)
  &&typeof model.industry==='string'&&model.industry.trim(),'Unreviewed native date or employment criteria')
 requireProof(Array.isArray(model.jobLocation)&&model.jobLocation.length>0&&model.jobLocation.length<=10,'Missing native worksite country')
 for(const location of model.jobLocation){
  requireProof(exactFields(location,['@type','address'])&&location['@type']==='Place'
   &&ownFields(location.address,addressFields)&&location.address['@type']==='PostalAddress'
   &&location.address.addressCountry==='US'&&Object.values(location.address).every(value=>typeof value==='string')
   &&reviewedAddress(location.address),'Unknown, foreign, conflicting, or unhandled native worksite criteria')
 }
 return{url:row.url,title:row.title,country:'United States',nativeJobPosting:model}
}

export async function runCurrentHex(options={}){
 const reader=createFirstPartyDocumentReader({sourceTimeoutMs:180000,requestTimeoutMs:30000,...options},
  {source:SOURCE,urls:[CAREERS],roleURL:isHexRoleURL,requestTimeoutCeilingMs:30000})
 try{
  const opening=readCurrentHexInventory((await reader.read(CAREERS)).body),proofs=[]
  for(const row of opening.cards){reader.allowRole(row.url);proofs.push(inspectCurrentHexRole((await reader.read(row.url)).body,row))}
  for(const [index,row]of opening.cards.entries()){
   const closing=inspectCurrentHexRole((await reader.read(row.url)).body,row)
   requireProof(JSON.stringify(proofs[index].nativeJobPosting)===JSON.stringify(closing.nativeJobPosting),'Native criteria changed during closing read')
  }
  const closing=readCurrentHexInventory((await reader.read(CAREERS)).body)
  requireProof(JSON.stringify(opening)===JSON.stringify(closing),'Native advertised inventory changed during closing read')
  reader.check()
  const audit={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:opening.total,observedVacancyCount:opening.total,
   sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,configuredBoardComplete:true,
   lifecycleCleanupAllowed:false,opening,closing,roleProofs:proofs,requests:reader.stats()}
  const jobs=attachSourceObservationEvidence([],{...audit})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  return attachInventoryEvidence(jobs,{status:'complete-inventory',surface:CAREERS,firstParty:true,listingComplete:true,
   pagesFetched:audit.requests.requests,reportedTotal:opening.total,indiaFacetCount:0,verifiedAt:new Date().toISOString(),
   lifecycleCleanupAllowed:false,reason:'complete-current-configured-public-board;all-native-worksites-US;company-scope-unverified;cleanup-forbidden'})
 }finally{reader.close()}
}
