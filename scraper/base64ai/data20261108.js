import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument,decodeNativeEntities} from './html20261108.js'
import {failure} from './runtime20261108.js'

export const PRIMARY='https://base64.ai/careers/'
const norm=value=>String(value??'').replace(/\s+/gu,' ').trim()
const need=(ok,message)=>{if(!ok)throw failure('Base64.ai native: '+message,'BASE64AI_NATIVE_PROOF')}
const cls=(node,name)=>(node.attrs.class??'').split(/\s+/).includes(name)

export function parsePage(source,url=PRIMARY){
 const document=readNativeDocument(source),nodes=document.nodes(()=>true),parents=new WeakMap()
 for(const node of nodes)for(const child of node.children??[])if(child&&typeof child==='object')parents.set(child,node)
 const foreign=node=>{for(let at=node;at;at=parents.get(at))if(['svg','math','template','noscript','object'].includes(at.tag))return true;return false}
 const active=nodes.filter(node=>!foreign(node)),live=new Set(active)
 const under=(node,parent)=>{for(let at=node;at;at=parents.get(at))if(at===parent)return true;return false}
 const heads=active.filter(node=>parents.get(node)?.tag==='head')
 const head={titles:heads.filter(node=>node.tag==='title').map(node=>norm(decodeNativeEntities(node.raw??''))),canonicals:heads.filter(node=>node.tag==='link'&&(node.attrs.rel??'').split(/\s+/).includes('canonical')).map(node=>node.attrs.href??null),metas:heads.filter(node=>node.tag==='meta').map(node=>node.attrs)}
 const sections=active.filter(node=>node.tag==='section'&&cls(node,'careers-simple')),roles=[]
 for(const node of active.filter(node=>cls(node,'job-item'))){
  const children=(node.children??[]).filter(child=>typeof child!=='string'&&live.has(child)),summaries=children.filter(child=>child.tag==='summary'),contents=children.filter(child=>cls(child,'job-content')),content=contents.length===1?contents[0]:null
  const metadata=content?(content.children??[]).filter(child=>typeof child!=='string'&&live.has(child)&&child.tag==='div'&&cls(child,'meta')):[]
  const fields=metadata.length===1?(metadata[0].children??[]).filter(child=>typeof child!=='string'&&live.has(child)&&child.tag==='p'):[]
  const types=fields.map(child=>/^Type:\s*(.+)$/u.exec(document.text(child))?.[1]).filter(value=>value!==undefined),locations=fields.map(child=>/^Location:\s*(.+)$/u.exec(document.text(child))?.[1]).filter(value=>value!==undefined)
  const ordinal=sections.findIndex(section=>under(node,section))
  roles.push({nativeTag:node.tag,nativeAttributes:node.attrs,nativeRoleHTML:document.outerHTML(node),nativeSectionOrdinal:ordinal<0?null:ordinal,
   nativeSummaries:summaries.map(child=>({attrs:child.attrs,text:document.text(child),nativeHTML:document.outerHTML(child)})),nativeContentCount:contents.length,nativeContentAttributes:content?.attrs??null,nativeContentHTML:content?document.innerHTML(content):null,nativeContentText:content?document.text(content):null,
   nativeMetadataCarriers:metadata.map(child=>({attrs:child.attrs,text:document.text(child),nativeHTML:document.outerHTML(child)})),nativeEmploymentType:types.length===1?types[0]:null,nativeLocation:locations.length===1?locations[0]:null,
   nativeApplications:active.filter(child=>content&&under(child,content)&&child.tag==='a'&&cls(child,'apply-link')).map(child=>({attrs:child.attrs,text:document.text(child),nativeHTML:document.outerHTML(child)}))})
 }
 return{sourcePage:url,nativeDocumentHTML:source,head,nativeBases:heads.filter(node=>node.tag==='base').map(node=>node.attrs),nativeH1:active.filter(node=>node.tag==='h1').map(node=>document.text(node)),nativeSections:sections.map(node=>({attrs:node.attrs,nativeHTML:document.outerHTML(node),headings:active.filter(child=>child.tag==='h2'&&under(child,node)).map(child=>document.text(child))})),
  nativeRecruitmentLinks:active.filter(node=>node.tag==='a'&&(document.text(node)==='Careers'||/\/(?:careers|jobs)(?:\/|$)/.test(node.attrs.href??''))).map(node=>({attrs:node.attrs,text:document.text(node),url:new URL(node.attrs.href??'',url).href})),nativeRoles:roles}
}

const ownURL=value=>{try{const url=new URL(value,PRIMARY);return url.origin==='https://base64.ai'&&!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname.replace(/\/$/,'')==='/careers'}catch{return false}}
export function validatePage(value){
 need(value.head.titles.length===1&&value.head.titles[0]==='Careers | Base64.ai: AI-Powered Document Intelligence'&&value.head.canonicals.length===1&&ownURL(value.head.canonicals[0]),'Own active careers head/canonical unavailable')
 const og=value.head.metas.filter(item=>item.property==='og:url'),names=value.head.metas.filter(item=>item.property==='og:site_name')
 need(og.every(item=>ownURL(item.content))&&names.length===1&&names[0].content==='Base64.ai: AI-Powered Document Intelligence','Contradictory active publisher identity')
 need(value.nativeBases.every(item=>ownURL(item.href))&&value.nativeH1.length===1&&value.nativeH1[0]==='Careers'&&value.nativeSections.length===1&&value.nativeSections[0].headings.length===1&&value.nativeSections[0].headings[0]==='Open Roles'&&value.nativeSections[0].nativeHTML!==null,'Own native Open Roles region unavailable')
 need(value.nativeRecruitmentLinks.length>0&&value.nativeRecruitmentLinks.every(item=>ownURL(item.url)),'Unreviewed additional recruitment route')
 need(value.nativeRoles.length<=500,'Native role bound exceeded')
}

export function facts(role){
 const title=role.nativeSummaries.length===1?role.nativeSummaries[0].text:null,applications=role.nativeApplications
 let subject=null,mailbox=null
 if(applications.length===1){try{const url=new URL(applications[0].attrs.href),keys=[...url.searchParams.keys()];if(url.protocol==='mailto:'&&!url.host&&!url.hash&&url.pathname==='careers@base64.ai'&&keys.every(key=>['subject','body'].includes(key))&&url.searchParams.getAll('subject').length===1&&url.searchParams.getAll('body').length<=1){mailbox=url.pathname;subject=url.searchParams.get('subject')}}catch{}}
 const identity=role.nativeTag==='details'&&role.nativeSectionOrdinal===0&&Boolean(title)&&subject==='Application for '+title&&mailbox==='careers@base64.ai'&&(role.nativeContentText??'').includes('Base64.ai')
 const raw=role.nativeLocation,plain=typeof raw==='string'?raw.replace(/\s+\(Remote\)$/u,''):null,country=new Map([['Türkiye','Turkey'],['Turkey','Turkey'],['United States of America','United States'],['United States','United States'],['India','India']]).get(plain)??null
 const criteria=typeof role.nativeRoleHTML==='string'&&role.nativeContentCount===1&&typeof role.nativeContentHTML==='string'&&(role.nativeContentText?.length??0)>=100
 const publication=!Object.keys(role.nativeAttributes).some(key=>/(?:^|[-_])(?:status|expiry|expires|expiration|deadline|posted|validthrough|valid-through|date|closed|archived)(?:$|[-_])/i.test(key))&&!role.nativeMetadataCarriers.some(item=>/(?:^|\s)(?:Status|Expiry|Expires|Deadline|Posted(?: on)?|Valid through|Closing date):/i.test(item.text))
 const key=createHash('sha256').update(JSON.stringify([PRIMARY,title,subject])).digest('hex').slice(0,24)
 return{title,subject,mailbox,identity:Boolean(identity),country,criteria:Boolean(criteria),publication,adapterKey:'base64ai-'+key}
}

export function closingModelsMatch(opening,closing){
 const profile=value=>Object.fromEntries(Object.entries(value).filter(([key])=>key!=='nativeDocumentHTML'))
 const left=structuredClone(profile(opening)),right=structuredClone(profile(closing))
 if(isDeepStrictEqual(left,right))return true
 const a=left.head.metas.filter(item=>item.name==='generator'),b=right.head.metas.filter(item=>item.name==='generator'),allowed=new Set(['WordPress 7.1.3','WordPress 7.1.4'])
 if(a.length!==1||b.length!==1||!allowed.has(a[0].content)||!allowed.has(b[0].content))return false
 a[0].content=b[0].content='<observed-generator-version>'
 return isDeepStrictEqual(left,right)
}
