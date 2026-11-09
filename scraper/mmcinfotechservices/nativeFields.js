import {createHash} from 'node:crypto'
import {decodeHTML} from 'entities'
import {activeHead,readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
export const CAREERS='https://www.mmcinfotech.com/career.php'
export const need=(v,m)=>{if(!v)throw Object.assign(Error('MMC native: '+m),{code:'MMC_NATIVE_CONTRACT',abortRetries:true})}
export const hash=v=>createHash('sha256').update(v).digest('hex')
const cls=(n,c)=>(n.attrs.class||'').split(/\s+/).includes(c)
const all=(n,p)=>typeof n==='string'?[]:[...(p(n)?[n]:[]),...n.children.flatMap(c=>all(c,p))]
const tree=n=>typeof n==='string'?n:{tag:n.tag,attrs:structuredClone(n.attrs),children:n.children.map(tree),...(n.raw===undefined?{}:{raw:n.raw})}
const excluded=new Set(['script','style','template','noscript','svg'])
const text=(n,omit=new Set(),visible=false)=>typeof n==='string'?decodeHTML(n):omit.has(n)||excluded.has(n.tag)||visible&&n.inert?'':n.children.map(c=>text(c,omit,visible)).join(' ')
const clean=(n,omit,visible)=>text(n,omit,visible).replace(/\s+/g,' ').trim()
const one=(a,label)=>{need(a.length===1,'one '+label+' required');return a[0]}
export function readMmcPage(html){
 const d=readNativeDocument(html),root=one(d.nodes(n=>n.tag==='root'),'document'),identity=activeHead(html)
 need(identity.titles.length===1&&identity.titles[0]==='MMC Infotech Services','current first-party publisher identity changed')
 const heading=one(d.nodes(n=>n.tag==='h2'&&clean(n)==='Join Our Family'),'native careers heading')
 need(!all(root,n=>n.tag==='base').length,'unreviewed publisher base')
 need(!all(root,n=>n.tag==='script'&&(n.attrs.type||'').trim().toLowerCase()==='application/ld+json').length,'new structured job fields require review')
 const cards=all(root,n=>cls(n,'products-details-tab')),visible=readVisibleNativeDocument(html,{strict:true})
 const visibleRoot=one(visible.nodes(n=>n.tag==='root'),'visible document'),visibleCards=all(visibleRoot,n=>cls(n,'products-details-tab'))
 need(cards.length>0&&cards.length<=100&&visibleCards.length===cards.length,'native role-panel inventory missing or unreviewed')
 const rows=cards.map((card,ordinal)=>{
  const control=one(all(card,n=>n.tag==='ul'&&cls(n,'tabs')),'whole native role label'),title=clean(control)
  const panel=one(all(card,n=>cls(n,'products-details-tab-content')),'complete native description panel')
  const link=one(all(card,n=>n.tag==='a'&&clean(n)==='Apply Now'),'declared application handoff')
  let url;try{url=new URL(link.attrs.href,CAREERS)}catch{need(false,'invalid application handoff')}
  need(url.origin==='https://www.mmcinfotech.com'&&url.pathname==='/form.php'&&!url.hash&&[...url.searchParams.keys()].length===1
   &&url.searchParams.get('job_posting')===title,'unreviewed application publisher or native role-label handoff')
  need(!all(card,n=>['iframe','object','embed','form'].includes(n.tag)).length,'delegated or unreviewed native criteria')
  const vc=visibleCards[ordinal],vcontrol=one(all(vc,n=>n.tag==='ul'&&cls(n,'tabs')),'visible native control'),vlink=one(all(vc,n=>n.tag==='a'&&clean(n)==='Apply Now'),'visible application declaration')
  need(clean(vcontrol,new Set(),true)===title&&clean(vlink,new Set(),true)==='Apply Now','hidden or unreviewed native public role/application declaration')
  const description=clean(card,new Set([control,link]))
  need(description===clean(vc,new Set([vcontrol,vlink]),true),'hidden or unreviewed native eligibility')
  need(title&&description.length>=100&&all(panel,n=>n.tag==='h3'&&clean(n)==='Job Description').length===1,'native role label or full description missing')
  return {title,company:'MMC Infotech Services',source:'mmcinfotechservices',country:null,location:null,city:null,state:null,nativeLocation:null,
   jobId:null,requisitionId:null,nativeCanonicalRoleURL:null,nativeJobPostingLabel:url.searchParams.get('job_posting'),nativePanelOrdinal:ordinal,
   sourceUrl:CAREERS,applyUrl:url.href,link:url.href,applicationUrlIsGeneric:true,applicationVisited:false,applicationFormSubmitted:false,activeApplyVerified:false,
   department:null,legalEmployer:null,employmentType:null,experienceRequired:null,publicExperienceChecked:false,minimumQualification:null,preferredQualification:null,requiredSkills:[],
   postingDate:null,postedAt:null,closingDate:null,firstEverPublication:null,publicationTimezone:null,
   jobDescription:description,sourceDescription:description,nativeSourceRecord:{publisher:{identity,heading:tree(heading)},control:tree(control),panel:tree(panel),card:tree(card),applicationDeclaration:tree(link)},
   sourceNativeCriteriaContainerRetained:true,sourceCountryScopeUnresolved:true,sourceDetailComplete:false,sourceDetailStatus:'partial',sourceDetailFailureKind:'native-country-and-posting-identity-unproven',
   nativeRoleClosingReconciled:false,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false}
 })
 need(all(root,n=>cls(n,'products-details-tab-content')).length===rows.length,'unassigned native job-description panel')
 return {identity,heading:tree(heading),rows}
}
