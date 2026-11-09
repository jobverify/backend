import {createHash} from 'node:crypto'
import {activeHead,readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
export const HOME='https://www.talentica.com/job-openings/'
export const need=(ok,message)=>{if(!ok)throw Object.assign(Error('Talentica native: '+message),{code:'TALENTICA_NATIVE_CONTRACT',abortRetries:true})}
export const hash=value=>createHash('sha256').update(value).digest('hex')
export const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)
const clean=value=>String(value??'').replace(/\s+/g,' ').trim()
const titleKey=value=>clean(value).replace(/[–—]/g,'-')
const one=(rows,label)=>{need(rows.length===1,'one '+label+' required');return rows[0]}
const schemaNodes=html=>{
 const d=readNativeDocument(html)
 return d.nodes(n=>n.tag==='script'&&(n.attrs.type||'').trim().toLowerCase()==='application/ld+json').map(n=>{try{return JSON.parse(n.raw)}catch{need(false,'invalid native schema')}})
}
const walk=value=>{const queue=[value],out=[];while(queue.length){const v=queue.pop();if(!v||typeof v!=='object')continue;out.push(v);queue.push(...Object.values(v).filter(x=>x&&typeof x==='object'))}return out}
const pageIdentity=(d,html,url,title)=>{
 need(!d.nodes(n=>n.tag==='base').length,'active base URL unsupported')
 const head=activeHead(html),links=d.nodes(n=>n.tag==='link'&&(n.attrs.rel||'').toLowerCase()==='canonical').map(n=>n.attrs.href)
 need(head.titles.length===1&&head.titles[0]===title,'active page title changed')
 need(links.length>0&&links.every(value=>value===url),'native canonical identity changed')
 const og=head.metas.filter(m=>m.property==='og:url');need(og.length===1&&og[0].content===url,'native OG identity changed')
 return {titles:head.titles,canonicalDeclarations:links,metas:head.metas}
}
const ownURL=value=>{
 const url=new URL(value,HOME)
 need(url.origin==='https://www.talentica.com'&&!url.username&&!url.password&&!url.search&&!url.hash&&/^\/jobdescription\/[a-z0-9-]+\/$/.test(url.pathname),'unreviewed declared own-role URL')
 return url.href
}
export function readNativeIndex(html){
 const d=readNativeDocument(html),identity=pageIdentity(d,html,HOME,'Job Openings | Talentica.com')
 need(d.text(one(d.nodes(n=>n.tag==='h1'),'current openings heading'))==='Current Openings','active index heading changed')
 const grid=one(d.nodes(n=>n.tag==='section'&&d.hasClass(n,'link_card_16')),'native role grid')
 const cards=d.nodes(n=>d.hasClass(n,'job-card'),grid)
 need(cards.length>0&&cards.length===d.nodes(n=>d.hasClass(n,'job-card')).length,'active native card scope changed')
 const rows=cards.map(card=>{
  const heading=one(d.nodes(n=>n.tag==='h6'&&d.hasClass(n,'title'),card),'native card heading')
  const link=one(d.nodes(n=>n.tag==='a'&&d.hasClass(n,'anchor-absolute'),card),'native card link')
  const experience=one(d.nodes(n=>n.tag==='p'&&/^Experience:/.test(d.text(n)),card),'native experience label')
  const title=d.text(heading),sourceUrl=ownURL(link.attrs.href),native={attrs:structuredClone(card.attrs),title,experience:d.text(experience),
   link:structuredClone(link.attrs),text:d.text(card)}
  need(title&&native.experience.length>'Experience:'.length,'incomplete native listing')
  return {title,experience:native.experience.slice('Experience:'.length).trim(),sourceUrl,applyUrl:sourceUrl,location:null,
   jobId:'talentica-'+new URL(sourceUrl).pathname.split('/')[2],nativeListing:native}
 })
 return {identity,schemas:schemaNodes(html),rows}
}
export const hasOfficialCareersSignal=html=>{try{readNativeIndex(html);return true}catch{return false}}
export const extractJobCards=html=>readNativeIndex(html).rows
const nativeTree=(node,d,omit)=>{
 if(typeof node==='string')return clean(node)||null
 if(node.inert||['script','style','template'].includes(node.tag)||omit(node))return null
 return {tag:node.tag,attrs:structuredClone(node.attrs),children:node.children.map(n=>nativeTree(n,d,omit)).filter(n=>n!==null)}
}
const treeText=node=>typeof node==='string'?decodeNativeEntities(node):clean(node.children.map(treeText).join(' '))
export function readNativeRole(listing,html,clock){
 const d=readNativeDocument(html),section=one(d.nodes(n=>n.tag==='section'&&d.hasClass(n,'job-single')),'own role container')
 const heading=one(d.nodes(n=>n.tag==='h1',section),'own role heading'),title=d.text(heading)
 need(titleKey(title)===titleKey(listing.title),'own heading/listing mismatch')
 const identity=pageIdentity(d,html,listing.sourceUrl,title+' | Talentica.com')
 const application=one(d.nodes(n=>d.hasClass(n,'career_form'),section),'own application container')
 const form=one(d.nodes(n=>n.tag==='form'&&n.attrs.id==='job_form',application),'own application form')
 need(d.nodes(n=>n.tag==='form',application).length===1,'unexpected additional application-container form')
 const externalFormText=treeText(nativeTree(application,d,n=>n===form))
 need(externalFormText==='Apply Now','unexpected criteria outside application controls')
 const nativeFields=Object.fromEntries(['position_code','job_post'].map(name=>{
  const input=one(d.nodes(n=>n.tag==='input'&&n.attrs.name===name,form),'own '+name+' identity')
  need(input.attrs.type==='hidden'&&typeof input.attrs.value==='string','native application identity type changed')
  return [name,structuredClone(input.attrs)]
 }))
 need(nativeFields.job_post.value===title,'native application title mismatch')
 const criteriaTree=nativeTree(section,d,n=>n===application),description=treeText(criteriaTree),schemas=schemaNodes(html)
 need(!walk(schemas).some(n=>(Array.isArray(n['@type'])?n['@type']:[n['@type']]).includes('JobPosting')),'new own JobPosting requires explicit native field review')
 need(description.length>500&&/Talentica/.test(description),'whole native role content/employer unavailable')
 const nativeRecord={listing:structuredClone(listing.nativeListing),identity,title,criteriaTree,schemas,
  applicationForm:{attrs:structuredClone(form.attrs),fields:nativeFields}}
 return {source:'talenticasoftware',company:'Talentica Software',jobId:listing.jobId,title,sourceUrl:listing.sourceUrl,applyUrl:listing.applyUrl,link:listing.applyUrl,
  nativeCanonicalRoleURL:listing.sourceUrl,sourceNativeApplicationPositionCode:nativeFields.position_code.value,requisitionId:null,
  nativeListingTitle:listing.title,experience:listing.experience,experienceRequired:listing.experience,publicExperienceChecked:true,
  sourceNativeLocationEvidence:{field:null,value:null,url:listing.sourceUrl},country:null,city:null,state:null,location:null,locations:[],countryEvidence:null,
  sourceCountryScopeUnresolved:true,postingDate:null,postedAt:null,closingDate:null,firstEverPublication:null,legalEmployer:null,
  employmentType:null,remoteStatus:null,department:null,requiredSkills:[],sourceDescription:description,jobDescription:description,
  sourceNativeCriteriaContainerRetained:true,sourceDetailComplete:false,sourceDetailStatus:'partial',sourceDetailFailureKind:'native-country-unproven',
  sourceNativeProofGaps:['native-role-country-unproven','company-recruitment-scope-unverified'],nativeSourceRecord:nativeRecord,
  sourceRawNativeHTML:html,sourceRawNativeHTMLSHA256:hash(html),sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
  nativeRoleClosingReconciled:false,applicationVisited:false,activeApplyVerified:false,scrapedAt:clock}
}
