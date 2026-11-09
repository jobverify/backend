import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {nativeLocationCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {failure} from './runtime20261107.js'
export const CAREERS_PAGE_URL='https://careers.chingari.io/career/'
export const CAREERS_CATEGORY_API_URL='https://careers.chingari.io/wp-json/wp/v2/categories?per_page=100&_fields=id,name,slug,count'
export const CAREERS_POSTS_API_URL='https://careers.chingari.io/wp-json/wp/v2/posts?per_page=100&_fields=id,date,date_gmt,link,slug,title,content,categories'
const ORIGIN=new URL(CAREERS_PAGE_URL).origin
const requireProof=(condition,message)=>{if(!condition)throw failure('Chingari native '+message,'CHINGARI_NATIVE_PROOF')}
const scalar=value=>typeof value==='string'?value.trim():null
const descendants=(node,predicate,includeInert=false)=>!node||typeof node==='string'||node.inert&&!includeInert?[]:[...(predicate(node)?[node]:[]),...(node.children??[]).flatMap(child=>descendants(child,predicate,includeInert))]
const hasClass=(node,name)=>(node.attrs.class??'').split(/\s+/).includes(name)
function nativeURL(value,{detail=false,base=CAREERS_PAGE_URL,fragment=false}={}){
 requireProof(typeof value==='string'&&value.trim()===value&&value.length>0,'URL scalar unavailable')
 let url;try{url=new URL(value,base)}catch{requireProof(false,'URL malformed')}
 requireProof(url.origin===ORIGIN&&url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&!url.search&&(!url.hash||fragment),'URL origin or scope mismatch')
 if(detail)requireProof(/^\/career\/[a-z0-9-]+\/[a-z0-9-]+\/$/.test(url.pathname),'detail URL scope mismatch')
 return url.href
}
function visible(html){requireProof(typeof html==='string'&&html.length>0,'HTML unavailable');return readVisibleNativeDocument(html,{strict:true})}
const visibleText=html=>{const d=visible(html),root=d.nodes(n=>n.tag==='root')[0];return root?d.text(root):''}
export function readChingariListing(html){
 const d=visible(html),roots=d.nodes(n=>hasClass(n,'e-loop-item'))
 const api=d.nodes(n=>n.tag==='link'&&n.attrs.rel==='https://api.w.org/'&&n.attrs.href===ORIGIN+'/wp-json/')
 const text=d.text(d.nodes(n=>n.tag==='root')[0])
 requireProof(api.length===1&&/Chingari/i.test(text)&&roots.length>0,'current careers identity or listing unavailable')
 const seen=new Set(),records=roots.map(root=>{
  const ids=(root.attrs.class??'').split(/\s+/).filter(x=>/^post-\d+$/.test(x));requireProof(ids.length===1&&hasClass(root,'status-publish'),'listing post identity unavailable')
  const id=ids[0].slice(5),headings=descendants(root,n=>n.tag==='h1');requireProof(headings.length===1,'listing title unavailable')
  const links=descendants(headings[0],n=>n.tag==='a');requireProof(links.length===1,'listing role link unavailable')
  const url=nativeURL(links[0].attrs.href,{detail:true}),title=d.text(headings[0]);requireProof(title&&!seen.has(id),'listing duplicate identity');seen.add(id)
  return{id,url,title}
 })
 return{records,paginationReconciled:false,apiRoot:ORIGIN+'/wp-json/'}
}
export const hasOfficialCareersSignal=html=>{try{return readChingariListing(html).records.length>0}catch{return false}}
function application(d,root,sourceUrl,id){
 const forms=descendants(root,n=>n.tag==='form'),accepted=[],parents=new Map()
 const index=node=>{for(const c of node.children??[])if(typeof c!=='string'){parents.set(c,node);index(c)}}
 for(const documentRoot of d.nodes(n=>n.tag==='root'))index(documentRoot)
 const within=(scope,node)=>!!scope&&descendants(scope,n=>n===node,true).length>0
 const disabled=node=>{
  if(Object.hasOwn(node.attrs,'disabled'))return true
  for(let p=parents.get(node);p;p=parents.get(p))if(p.tag==='fieldset'&&Object.hasOwn(p.attrs,'disabled')){
   const legend=p.children.find(c=>typeof c!=='string'&&c.tag==='legend')
   if(!within(legend,node))return true
  }
  return false
 }
 const inertMetadata=node=>{
  for(let p=node;p;p=parents.get(p))if(['template','script','style','noscript','object','iframe','noembed','noframes','plaintext','xmp'].includes(p.tag)||Object.hasOwn(p.attrs,'inert'))return true
  return false
 }
 const belongs=(node,form)=>{
  if(Object.hasOwn(node.attrs,'form')){
   const owner=node.attrs.form
   if(!owner||owner!==form.attrs.id)return false
   const targets=d.nodes(n=>n.attrs.id===owner)
   return targets.length===1&&targets[0]===form
  }
  for(let p=parents.get(node);p;p=parents.get(p))if(p.tag==='form')return p===form
  return false
 }
 for(const form of forms){
  if(form.attrs.method?.toLowerCase()!=='post'||form.attrs.enctype?.toLowerCase()!=='multipart/form-data'||form.attrs.target&&form.attrs.target!=='_self')continue
  const successful=node=>!disabled(node)&&!inertMetadata(node)&&belongs(node,form)&&typeof node.attrs.name==='string'&&node.attrs.name.trim()!==''
  const all=descendants(form,()=>true,true),controls=descendants(form,n=>['input','button'].includes(n.tag))
  const fields=name=>all.filter(n=>n.tag==='input'&&n.attrs.type?.toLowerCase()==='hidden'&&n.attrs.name===name&&successful(n))
  const bound=fields('_wpcf7_container_post'),tags=fields('_wpcf7_unit_tag'),ids=fields('_wpcf7')
  if(bound.length!==1||bound[0].attrs.value!==id||tags.length!==1||ids.length!==1)continue
  const unit=tags[0].attrs.value,match=new RegExp('^wpcf7-f([1-9][0-9]*)-p'+id+'-o[1-9][0-9]*$').exec(unit??'')
  if(!match||ids[0].attrs.value!==match[1])continue
  let action;try{action=nativeURL(form.attrs.action,{base:sourceUrl,fragment:true})}catch{continue}
  if(action!==sourceUrl+'#'+unit)continue
  const usable=controls.filter(n=>!n.inert&&!disabled(n)&&!inertMetadata(n)&&belongs(n,form))
  const submit=usable.filter(n=>(n.tag==='input'&&n.attrs.type?.toLowerCase()==='submit'||n.tag==='button'&&(!n.attrs.type||n.attrs.type.toLowerCase()==='submit'))&&/submit application/i.test(n.attrs.value??d.text(n)))
  if(submit.length!==1||['formaction','formmethod','formenctype','formtarget'].some(k=>Object.hasOwn(submit[0].attrs,k)))continue
  if(!usable.some(n=>n.tag==='input'&&n.attrs.type?.toLowerCase()==='file'&&successful(n))||!usable.some(n=>n.tag==='input'&&n.attrs.type?.toLowerCase()==='email'&&successful(n)))continue
  accepted.push({url:action,method:'post',containerPostId:id,unitTag:unit,formId:match[1],submissionPerformed:false})
 }
 return accepted.length===1?accepted[0]:null
}
export function validateChingariPost(record){
 requireProof(record&&Number.isSafeInteger(record.id)&&record.id>0&&typeof record.title?.rendered==='string'&&typeof record.content?.rendered==='string'&&record.content.protected!==true&&Array.isArray(record.categories)&&record.categories.every(c=>Number.isSafeInteger(c)&&c>0),'post inventory shape unavailable')
 const sourceUrl=nativeURL(record.link,{detail:true}),id=String(record.id)
 requireProof(typeof record.slug==='string'&&sourceUrl.split('/').at(-2)===record.slug,'post slug identity mismatch')
 const title=visibleText(record.title.rendered),description=visibleText(record.content.rendered)
 requireProof(title&&description.length>80,'post title or full content unavailable')
 return{sourceUrl,id,title,description}
}
export function extractCareerPosts(records=[],{categoryMap=new Map(),detailPages=new Map()}={}){
 requireProof(Array.isArray(records),'post inventory is not an array')
 return records.map(record=>{
  const {sourceUrl,id,title,description}=validateChingariPost(record)
  const html=detailPages.get(sourceUrl),d=visible(html),roots=d.nodes(n=>n.attrs['data-elementor-type']==='single-post')
  requireProof(roots.length===1&&hasClass(roots[0],'post-'+id)&&hasClass(roots[0],'status-publish'),'detail post identity or publication mismatch')
  const body=d.nodes(n=>n.tag==='body');requireProof(body.length===1&&hasClass(body[0],'postid-'+id),'body post identity mismatch')
  const canonical=d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),api=d.nodes(n=>n.tag==='link'&&n.attrs.rel==='alternate'&&n.attrs.type==='application/json')
  requireProof(canonical.length===1&&nativeURL(canonical[0].attrs.href,{detail:true})===sourceUrl&&api.length===1&&api[0].attrs.href===ORIGIN+'/wp-json/wp/v2/posts/'+id,'canonical or native post identity mismatch')
  const root=roots[0],h1=descendants(root,n=>n.tag==='h1')
  requireProof(h1.length===1&&title&&d.text(h1[0])===title,'detail title identity mismatch')
  const content=descendants(root,n=>hasClass(n,'elementor-widget-theme-post-content'))
  requireProof(content.length===1&&description.length>80&&d.text(content[0])===description,'full visible description and API content mismatch')
  const headings=descendants(root,n=>n.tag==='h2').slice(0,3).map(n=>d.text(n)),locations=headings.filter(t=>/^\|\s*\S/.test(t)).map(t=>t.replace(/^\|\s*/,''))
  requireProof(locations.length===1,'role location unavailable or ambiguous')
  const location=locations[0],country=nativeLocationCountryName(location),nativeApplicationEvidence=application(d,root,sourceUrl,id)
  const department=record.categories.map(c=>categoryMap.get(c)).find(v=>typeof v==='string'&&v.trim())??null
  return{title,company:'Chingari',department,location,city:/^(?:remote|hybrid)$/i.test(location)?null:location.split(',')[0].trim(),country,jobId:id,requisitionId:null,sourceUrl,applyUrl:nativeApplicationEvidence?.url??null,employmentType:null,experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],postingDate:null,closingDate:null,jobDescription:description,remoteStatus:/\bremote\b/i.test(location)?'Remote':/\bhybrid\b/i.test(location)?'Hybrid':null,nativeCountryEvidence:country?{nativeLocation:location,country,method:'explicit-location-country'}:null,nativeSourceRecord:structuredClone(record),nativeApplicationEvidence,nativePublicationEvidence:{wordpressPostId:id,status:'publish',canonicalUrl:sourceUrl,vacancyDateVerified:false},sourceDetailComplete:false,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
 })
}
