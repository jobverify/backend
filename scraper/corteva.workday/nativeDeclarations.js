import {createHash} from 'node:crypto'
import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {parseNativeJSON} from '../aecom.workday/nativeJSON.js'

export const CAREERS='https://careers.corteva.com/'
export const PORTAL='https://apply.corteva.com/'
export const BOARD=PORTAL+'careers'
export const CLIENT=PORTAL+'gen/js/pcsxPwa.6c903be3a68c07ae.js'
export const CLIENT_SHA256='c99cb7da4f4a8e6eef449602e15fea1c01ef90b31b4925947bd8ab54d0f1c111'
export const searchURL=start=>PORTAL+'api/pcsx/search?domain=corteva.com&query=&location=&start='+start+'&'
export const detailURL=id=>PORTAL+'api/pcsx/position_details?'+new URLSearchParams({position_id:String(id),domain:'corteva.com',hl:'en'})
export const roleURL=id=>PORTAL+'careers/job/'+id
const owned=new WeakSet()
export const failure=message=>{const error=new Error('Corteva native '+message);owned.add(error);return error}
export const isFailure=value=>value!==null&&typeof value==='object'&&owned.has(value)
export const need=(ok,message)=>{if(!ok)throw failure(message)}
export function json(text){try{return parseNativeJSON(text)}catch(error){throw failure('JSON '+error.message)}}
export function corporate(html){
 const doc=readVisibleNativeDocument(html,{strict:true})
 need(doc.nodes(n=>n.tag==='a'&&[PORTAL,PORTAL.slice(0,-1)].includes(n.attrs.href)).length>0,'missing active corporate recruitment handoff')
 return{careersURL:CAREERS,boardURL:BOARD,declaredPortal:PORTAL,employerBrand:'Corteva',legalEmployer:null}
}
// These hidden code elements are declared application data, not visible job
// criteria. Read only direct text from the exact known carrier in active HTML.
function carrier(html,id){
 const root=readNativeDocument(html).nodes(n=>n.tag==='root')[0],found=[]
 const visit=(node,parentInert=false)=>{
  if(typeof node==='string')return
  if(!parentInert&&node.tag==='code'&&node.attrs.id===id){
   need(node.children.every(c=>typeof c==='string'),'non-text tenant data carrier')
   need(Object.keys(node.attrs).every(k=>['id','style','data-nosnippet'].includes(k))&&/^display:\s*none;$/.test(node.attrs.style||''),'unreviewed data carrier attributes')
   found.push(json(decodeNativeEntities(node.children.join(''))));return
  }
  if(node.inert)return
  for(const child of node.children)visit(child,node.inert)
 }
 visit(root);need(found.length===1,'missing or ambiguous '+id+' carrier');return found[0]
}
export function board(html){
 const branding=carrier(html,'branding-data'),pcsx=carrier(html,'pcsx-data'),doc=readVisibleNativeDocument(html,{strict:true})
 need(branding.domain==='corteva.com'&&pcsx.domain==='corteva.com','tenant domain differs')
 need(doc.nodes(n=>n.tag==='script'&&n.attrs.src===new URL(CLIENT).pathname).length===1,'reviewed PCSX client missing')
 need(pcsx.configs?.pcsxConfig?.positionDetailsConfig?.efJdOverridesAtsPosting===false,'unreviewed description source override')
 return{tenantDomain:'corteva.com',boardURL:BOARD,clientURL:CLIENT,clientSHA256:CLIENT_SHA256,efJdOverridesAtsPosting:false,requestGeolocationUsed:false,programsExecuted:false}
}
export function client(bytes){need(createHash('sha256').update(bytes).digest('hex')===CLIENT_SHA256,'published client contract changed')}
export function canonical(html,id,role,now){
 const doc=readVisibleNativeDocument(html,{strict:true}),links=doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical')
 need(links.length===1&&links[0].attrs.href===roleURL(id),'canonical role page differs')
 board(html)
 const scripts=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json')
 need(scripts.length===1,'missing or ambiguous own structured role')
 const model=json(scripts[0].raw),keys=['@context','@type','datePosted','description','employmentType','hiringOrganization','inLanguage','jobLocation','title','url','validThrough']
 need(Object.keys(model).sort().join('|')===keys.sort().join('|'),'structured role fields changed')
 need(model['@context']==='http://schema.org'&&model['@type']==='JobPosting'&&model.url===roleURL(id)&&model.title===role.model.data.name,'structured native role identity differs')
 const employer=model.hiringOrganization,location=model.jobLocation,address=location?.address
 need(employer?.['@type']==='Organization'&&employer.name==='Corteva Agriscience'&&employer.sameAs==='corteva.com'&&Object.keys(employer).sort().join('|')==='@type|logo|name|sameAs','structured native employer differs')
 const place=role.model.data.standardizedLocations[0].split(', ')
 need(location?.['@type']==='Place'&&Object.keys(location).sort().join('|')==='@type|address'&&address?.['@type']==='PostalAddress'&&Object.keys(address).sort().join('|')==='@type|addressCountry|addressLocality|addressRegion','unreviewed structured placement')
 need(address.addressCountry?.['@type']==='Country'&&address.addressCountry.name==='IN'&&Object.keys(address.addressCountry).sort().join('|')==='@type|name'&&place.length===3&&address.addressLocality===place[0]&&address.addressRegion===place[1]+',IN','structured work-country or placement aliases conflict')
 need(model.employmentType==='FULL_TIME'&&model.inLanguage==='en-US','unreviewed structured role attributes')
 need(model.datePosted===new Date(role.model.data.postedTs*1000).toISOString().slice(0,19),'structured publication calendar differs')
 // The publisher supplies no timezone for validThrough. Hold dates close to
 // now instead of inventing an expiry instant from the scraper's timezone.
 need(typeof model.validThrough==='string'&&/^\d{4}-\d\d-\d\dT00:00:00$/.test(model.validThrough)&&Number.isFinite(Date.parse(model.validThrough+'Z'))&&new Date(model.validThrough+'Z').toISOString().slice(0,19)===model.validThrough&&model.validThrough.slice(0,10)>new Date(now+2*86400000).toISOString().slice(0,10),'expired, ambiguous or invalid structured validity calendar')
 need(typeof model.description==='string'&&model.description.replace(/\s+/g,' ').trim()===role.structuredDescription,'whole structured role criteria differ from native API')
 return{canonicalURL:links[0].attrs.href,tenantDomain:'corteva.com',publicRolePageRead:true,applicationInteractedWith:false,jobPosting:model,validThroughTimezone:null}
}
