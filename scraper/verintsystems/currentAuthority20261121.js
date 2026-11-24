import {createHash} from 'node:crypto'
import {activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {all,one,need,norm,props,scalarFields,authoredLines,semanticCriteria,writtenPlaceCountries} from './currentFacts20261120.js'
import {constraints} from './currentDates20261121.js'
import {qualifyCurrentProperties,qualifyCurrentScope} from './currentScopeFacts20261121.js'
import {currentNativeModel} from './currentModel20261120.js'

export const HOME='https://www.verint.com/careers/',FEED='https://api.ashbyhq.com/posting-api/job-board/verint',NATIVE='https://jobs.ashbyhq.com'
export const C={source:'verintsystems',company:'Verint Systems',publisher:'Verint',employer:'Verint'}
export const UUID=/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i
export const key=value=>String(value).replace(/^data[-_:]/i,'').replace(/[-_\s]/g,'').toLowerCase()
const brand=/\bVerint\b/i,applications=/^(?:apply|application|jobapplication|job|detail)(?:url|uri|link)s?$/
const countryKeys=new Set(['country','countrycode','addresscountry','workcountry','workplacecountry','worklocationcountry','jobcountry','joblocationcountry','locationcountry'])
export const digest=text=>createHash('sha256').update(text).digest('hex')
export function properties(value,{office=false}={}){
 return scalarFields(value).filter(p=>!office||!countryKeys.has(key(p.key))).map(p=>{
  const k=key(p.key)
  return{...p,key:['publishedat','publishedon','createddate','createdat','postingdate','dateposted'].includes(k)?'datePosted':['worklocationcountry','joblocationcountry','locationcountry'].includes(k)?'workcountry':p.key}
 })
}
export function issuerURL(value,{page=false,social=false}={}){
 need(typeof value==='string'&&value===value.trim()&&value.length>0,'published issuer URI malformed')
 const u=new URL(value,HOME);need(u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.search,'published issuer URI authority differs');u.hash=''
 const own=['www.verint.com','verint.com'].includes(u.hostname)
 if(own){need(page?u.pathname==='/careers/':['/','/careers/'].includes(u.pathname),'published issuer page differs');return}
 const profileHosts=new Set(['www.facebook.com','facebook.com','x.com','twitter.com','www.instagram.com','instagram.com','www.linkedin.com','linkedin.com','www.youtube.com','youtube.com','en.wikipedia.org'])
 need(social&&profileHosts.has(u.hostname)&&/(?:^|\/)(?:verint|verintsystems|verinttv|verint_systems)(?:\/|$)/i.test(u.pathname),'published named issuer URI differs')
}
export function applicationProperties(value,urls){
 for(const[name,entry]of Object.entries(value))if(applications.test(key(name))&&entry!=null){
  const candidates=Array.isArray(entry)?entry:[entry];need(candidates.length>0&&candidates.length<=256,'finite same-role application alias candidates required')
  // Every published candidate is evidence. Validate before any projection or
  // deduplication so an invalid/foreign candidate cannot hide behind a good one.
  for(const candidate of candidates)need(typeof candidate==='string'&&candidate.length>0&&candidate===candidate.trim()&&urls.includes(new URL(candidate,urls[0]).href),'same-role application alias differs')
 }
}
function ancestry(d,node){const visit=(at,path=[])=>{if(at===node)return[...path,at];for(const child of at.children.filter(c=>typeof c!=='string')){const result=visit(child,[...path,at]);if(result)return result}return null};return visit(d.root)}
function withdrawn(n){return n.inert||n.inactive||['hidden','inert','disabled'].some(k=>Object.hasOwn(n.attrs,k))||n.attrs['aria-hidden']==='true'||n.attrs['aria-disabled']==='true'||/(?:^|\s)(?:hidden|disabled|d-none)(?:\s|$)/.test(n.attrs.class??'')||/(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(n.attrs.style??'')}
export function carrier(d,node,at,urls,countries=['India']){
 const path=ancestry(d,node);need(path,'actual native carrier ancestry missing')
 for(const n of path)need(!withdrawn(n===node&&n.tag==='title'?{...n,inactive:false}:n),'actual published carrier or owner withdrawn')
 qualifyCurrentProperties(props(path.map(n=>n===node&&n.tag==='title'?{...n,inactive:false}:n)),{at,urls,countryAlternatives:countries})
}
export function scope(root,at,urls,countries=['India']){
 qualifyCurrentScope(root,{at,urls,countryAlternatives:countries})
 const clone=n=>({...n,inactive:false,inert:false,children:n.children.map(c=>typeof c==='string'?c:clone(c))}),view=clone(root),semantic=semanticCriteria(view)
 const p=[...props(all(view,()=>true)),...semantic.properties].map(p=>['worklocationcountry','joblocationcountry','locationcountry'].includes(key(p.key))?{...p,key:'workcountry'}:p)
 const lines=[...authoredLines(view),...semantic.lines]
 need(!lines.some(line=>/\bapplications?\s+(?:for\s+(?:this|the)\s+(?:job|position|role)\s+)?(?:are|is|have\s+been|has\s+been)\s+(?:now\s+)?(?:closed|no\s+longer\s+(?:accepted|being\s+accepted))\b/i.test(line)),'same-role applications explicitly closed')
 for(const line of lines){const match=/(?:\b(?:this|the)\s+(?:role|position|job)\s+is\s+(?:based|located)|\bapplicants?\s+must\s+(?:reside|live|be\s+(?:based|located)))\s+in\s+([^.!?\n]{1,160})/i.exec(line);if(match)need(writtenPlaceCountries(match[1]).every(country=>countries.includes(country)),'explicit same-role workplace prose conflicts')}
 for(const node of all(view,n=>n.tag==='a'&&/^(?:apply|apply now|apply for (?:this )?(?:job|role|position))$/i.test(norm(authoredLines(n).join(' '))))){need(!withdrawn(node),'same-role Apply control withdrawn');if(node.attrs.href!=null)need(urls.includes(new URL(node.attrs.href,urls[0]).href),'same-role Apply link differs')}
 for(const form of all(view,n=>n.tag==='form'))if(form.attrs.action)need(urls.includes(new URL(form.attrs.action,urls[0]).href),'same-role form handoff differs')
 return constraints(p,lines,{employer:'Verint',observedAt:at,countryAlternatives:countries})
}
function structuredPublisher(value,{own=false,at,urls},relationship=null,depth=0){
 need(depth<32,'finite publisher relationship scope')
 if(Array.isArray(value)){need(value.length<=256,'finite publisher relationship array');value.forEach(v=>structuredPublisher(v,{own,at,urls},relationship,depth+1));return}
 if(typeof value==='string'&&relationship){if(/^(?:https?:|\/|#)/.test(value))issuerURL(value,{page:relationship==='page'});else need(value==='Verint','named published issuer differs');return}
 if(!value||typeof value!=='object')return
 if(value['@context']!=null)need(typeof value['@context']==='string'&&/^https?:\/\/schema\.org\/?$/.test(value['@context']),'publisher structured context differs')
 const types=(Array.isArray(value['@type'])?value['@type']:[value['@type']]).map(t=>typeof t==='string'?t.replace(/^https?:\/\/schema\.org\//,''):t)
 const employer=relationship==='employer'||types.includes('Organization')||types.includes('Corporation'),page=relationship==='page'||types.some(t=>['WebPage','AboutPage','Article'].includes(t)),website=types.includes('WebSite')
 if(employer||page||website){
  for(const field of['name','legalName','alternateName'])if(value[field]!=null){const names=Array.isArray(value[field])?value[field]:[value[field]];need(names.length>0&&names.every(n=>typeof n==='string'&&(page||website?brand.test(n):n==='Verint')),'published publisher name differs')}
  for(const field of['url','@id','sameAs'])if(value[field]!=null){const values=Array.isArray(value[field])?value[field]:[value[field]];need(values.length>0&&values.length<=128,'published issuer URI array malformed');for(const uri of values)issuerURL(uri,{page:page&&own,social:employer&&field==='sameAs'})}
  constraints(properties(value,{office:employer}),[],{employer:'Verint',observedAt:at,countryAlternatives:['India']})
 }
 applicationProperties(value,urls)
 for(const[name,entry]of Object.entries(value)){
  if(name==='@context')continue
  if(['publisher','employer','hiringOrganization','company','parentOrganization'].includes(name)&&entry!=null)structuredPublisher(entry,{own,at,urls},'employer',depth+1)
  else if(name==='mainEntityOfPage'&&entry!=null)structuredPublisher(entry,{own,at,urls},'page',depth+1)
  else if(entry&&typeof entry==='object')structuredPublisher(entry,{own,at,urls},null,depth+1)
 }
}
function head(d,html,at,url,{row=null}={}){
 const titles=activeHead(html).titles;need(titles.length===1&&brand.test(titles[0])&&(!row||titles[0].includes(row.title)),'actual head publisher/role title differs')
 const titleNodes=[];const visit=(n,path=[])=>{if(n.tag==='title'&&path.some(p=>p.tag==='head')&&!path.some(p=>p.tag==='svg'))titleNodes.push(n);for(const c of n.children)if(typeof c!=='string')visit(c,[...path,n])};visit(d.root)
 carrier(d,one(titleNodes,'actual head title'),at,[url,url+'/application'])
 need(!all(d.root,n=>n.tag==='base'||n.tag==='meta'&&/refresh/i.test(n.attrs['http-equiv']??'')).length,'native base/refresh authority differs')
 const pageIdentity=value=>{const current=new URL(value,url).href;return current===url||!row&&new URL(url).origin===NATIVE&&current===NATIVE+'/verint'}
 for(const n of all(d.root,n=>n.tag==='link'&&(n.attrs.rel??'').toLowerCase()==='canonical')){need(pageIdentity(n.attrs.href),'published canonical differs');carrier(d,n,at,[url,url+'/application'])}
 for(const n of all(d.root,n=>n.tag==='meta'&&['og:url','og:title','og:site_name'].includes(n.attrs.property))){const property=n.attrs.property,value=n.attrs.content??'';need(property==='og:url'?pageIdentity(value):property==='og:title'&&row?[row.title,norm(titles[0])].includes(norm(value)):brand.test(value),'native OG identity differs');carrier(d,n,at,[url,url+'/application'])}
}
export function ownAuthority(html,at){
 const d=document(html);head(d,html,at,HOME)
 const anchors=all(d.root,n=>n.tag==='a'&&norm(d.text(n))==='Join Our Global Team').filter(n=>!ancestry(d,n).some(withdrawn))
 need(anchors.length>0,'active declared Join Our Global Team handoff missing')
 const boards=[...new Set(anchors.map(n=>new URL(n.attrs.href,HOME).href))];need(boards.length===1,'current own native handoff ambiguous')
 const board=boards[0],u=new URL(board),token=u.pathname.slice(1)
 need(u.origin===NATIVE&&!u.search&&!u.hash&&!u.username&&!u.password&&!u.port&&(token==='verint'||UUID.test(token)),'current own native account declaration differs')
 for(const anchor of anchors)carrier(d,anchor,at,[HOME,board,FEED])
 for(const h of all(d.root,n=>n.tag==='h1'&&!n.inert&&!n.inactive)){need(brand.test(d.text(h))||/^(?:careers|jobs|join our team)$/i.test(norm(d.text(h))),'own current recruitment heading names another publisher');carrier(d,h,at,[HOME,board,FEED])}
 for(const script of all(d.root,n=>n.tag==='script'&&(n.attrs.type??'').toLowerCase()==='application/ld+json')){carrier(d,script,at,[HOME,board,FEED]);structuredPublisher(readLiteralModel(script.raw??'').value,{own:true,at,urls:[HOME,board,FEED]})}
 return{publisher:'Verint',home:HOME,board,feed:FEED,originalOwnHTML:html,originalAnchors:anchors.map(n=>({...n.attrs})),legalEmployer:null,nativeProgramsExecuted:false,rendererOrUIActivationVerified:false,backendApplicationActivationVerified:false}
}
export function nativePacket(html,url,at,{board,row=null,organizationBinding=null}={}){
 const d=document(html);head(d,html,at,url,{row});const state=currentNativeModel(d),model=state.originalModel
 need(model.environment==='production'&&model.maintenanceMode===false&&model.schedulingMaintenanceMode===false,'native production publication unavailable')
 const org=model.organization
 need(org&&org.__typename==='Organization'&&UUID.test(org.organizationId)&&org.name==='Verint'&&org.hostedJobsPageSlug==='verint'&&org.isDemoOrg===false,'current native publisher/account differs')
 issuerURL(org.publicWebsite);if(org.customJobsPageUrl!=null)issuerURL(org.customJobsPageUrl,{page:true})
 for(const field of['url','@id','sameAs'])if(org[field]!=null)for(const uri of Array.isArray(org[field])?org[field]:[org[field]])issuerURL(uri,{social:field==='sameAs'})
 const binding={organizationId:org.organizationId,name:org.name,hostedJobsPageSlug:org.hostedJobsPageSlug,publicWebsite:org.publicWebsite,customJobsPageUrl:org.customJobsPageUrl}
 if(organizationBinding)need(JSON.stringify(binding)===JSON.stringify(organizationBinding),'same-role native publisher/account binding differs')
 constraints(properties(org,{office:true}),[],{employer:'Verint',observedAt:at,countryAlternatives:['India']});applicationProperties(org,[HOME,board,FEED,url,url+'/application']);qualifyNamedIssuer(org,at,[HOME,board,FEED,url,url+'/application'])
 const root=one(all(d.root,n=>n.attrs.id==='root'),'native current root'),script=one(all(d.root,n=>n.tag==='script'&&n.attrs===state.originalScriptAttributes),'original active native state carrier')
 carrier(d,root,at,[url,url+'/application']);carrier(d,script,at,[url,url+'/application']);const dates=scope(root,at,[url,url+'/application'])
 const common=[]
 need(org.theme&&typeof org.theme==='object','published native common theme missing')
 for(const field of['jobBoardTopDescriptionHtml','jobBoardBottomDescriptionHtml'])if(org.theme[field]!=null){need(typeof org.theme[field]==='string','native common published prose malformed');const fragment=document(org.theme[field]),current=scope(fragment.root,at,[url,url+'/application',HOME,board]);dates.posted.push(...current.posted);dates.expiry.push(...current.expiry);common.push({field,originalHTML:org.theme[field],recognizedDates:current})}
 if(!row)need(model.jobBoard&&model.jobBoard.stealthAccess===false&&Array.isArray(model.jobBoard.jobPostings),'native board public collection unavailable')
 else need(model.posting&&model.jobBoard==null,'native role state unavailable')
 return{d,state,model,organizationBinding:binding,commonProse:common,dates,originalHTML:html}
}
export function qualifyNamedIssuer(value,at,urls){structuredPublisher(value,{own:false,at,urls})}
