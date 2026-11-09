import {parse} from 'acorn'
import {decodeNativeEntities,readNativeDocument} from './activeNativeHtml.js'
import {literalRecruitmentPageData} from './recruitmentPageData.js'
import {recruitmentMicrodataPostings} from './recruitmentMicrodata.js'
import {nativeCountryName} from '../shared/nativeJobPosting.js'
import {isNativeBareCityInPublicScope} from '../shared/nativeCityScope.js'

const need=(ok,message)=>{if(!ok)throw Error('SAP unified recruitment: '+message)}
const classes=(node,name)=>(node.attrs.class||'').split(/\s+/).includes(name)
const member=(node,object,property)=>node?.type==='MemberExpression'&&!node.computed
  && node.object?.type==='Identifier'&&node.object.name===object&&node.property?.name===property
const visit=(node,callback,depth=0)=>{
 need(depth<100,'native client nesting bound')
 if(!node||typeof node!=='object')return
 callback(node)
 for(const [key,value]of Object.entries(node))if(!['start','end'].includes(key)){
  if(Array.isArray(value))for(const child of value)visit(child,callback,depth+1)
  else if(value&&typeof value==='object')visit(value,callback,depth+1)
 }
}
const nativeClient=(script,name)=>{
 need(script.length<=200000,'oversized native public client')
 const program=parse(script,{ecmaVersion:'latest'}),matches=[]
 for(const statement of program.body){
  const exp=statement.type==='ExpressionStatement'?statement.expression:null
  if(exp?.type==='AssignmentExpression'&&exp.operator==='='&&member(exp.left,'j2w',name)
    &&exp.right?.type==='CallExpression'&&exp.right.callee?.type==='FunctionExpression')matches.push(exp.right.callee.body)
 }
 need(matches.length===1,'missing or ambiguous active native client')
 return matches[0]
}

// This contract is advertised by the current active RMK search page. Its
// literal locale and loaded public JS must both agree before a search POST.
export function successFactorsUnifiedSearch(document,pageURL){
 if(!document.nodes(n=>/^jobSearch_[a-z\d_]+$/i.test(n.attrs.id||'')).length)return null
 const config=literalRecruitmentPageData(document,'resultStyles')?.config
 if(!config)return null
 need(/^[a-z\d_-]{1,120}$/i.test(config.companyId||'')&&/^[a-z]{2}_[A-Z]{2}$/.test(config.currentLocale||''),'invalid native account or locale')
 const page=new URL(pageURL)
 const client=name=>{
  const urls=document.nodes(n=>n.tag==='script'&&n.attrs.src&&/^(?:|(?:application|text)\/(?:java|ecma)script)$/i.test(n.attrs.type||''))
   .map(n=>new URL(n.attrs.src,page)).filter(u=>u.protocol==='https:'&&u.origin===page.origin&&!u.username&&!u.password&&!u.port&&!u.hash
    &&u.pathname==='/platform/js/j2w/min/j2w.'+name+'.min.js')
  need(urls.length===1,'missing or ambiguous declared '+name+' client')
  return urls[0].href
 }
 return {pageURL,origin:page.origin,locale:config.currentLocale,companyId:config.companyId,
  managerURL:client('searchManager'),rendererURL:client('searchResultsUnify')}
}

export async function readSuccessFactorsUnifiedSearch(search,io){
 const manager=await io.readRenderer(search.managerURL),renderer=await io.readRenderer(search.rendererURL)
 const controller=nativeClient(manager.html,'SearchManager'),view=nativeClient(renderer.html,'SearchResultsUnify')
 const routes=[];let roleRoute=false,roleLocale=false
 visit(controller,node=>{
  if(node.type!=='CallExpression'||!['jQuery','$'].some(name=>member(node.callee,name,'ajax')))return
  const options=node.arguments[0]
  if(options?.type!=='ObjectExpression')return
  const values=new Map(options.properties.filter(p=>p.type==='Property'&&!p.computed&&p.kind==='init').map(p=>[p.key.name??p.key.value,p.value]))
  if(values.get('type')?.value==='POST'&&values.get('url')?.value==='/services/recruiting/v1/jobs')routes.push(values.get('url').value)
 })
 visit(view,node=>{if(node.type==='Literal'&&node.value==='/job/')roleRoute=true;if(member(node,'resultStyles','currentLocale'))roleLocale=true})
 need(routes.length===1&&roleRoute&&roleLocale,'native read-only search or role route changed')
 const endpoint=new URL(routes[0],search.origin).href
 io.permit(endpoint,['POST'])
 // The location query chooses candidates only. Every public role is still
 // inspected for its own explicit country, title, requisition and full JD.
 const response=await io.readJson(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({keywords:'',locale:search.locale,location:'India',pageNumber:0,sortBy:'recent'})})
 const payload=response?.totalJobs===0&&Object.keys(response).length===1?{...response,jobSearchResult:[]}:response
 need(payload&&Array.isArray(payload.jobSearchResult)&&Number.isSafeInteger(payload.totalJobs)&&payload.totalJobs>=0
  &&payload.jobSearchResult.length<=payload.totalJobs&&!payload.error,'invalid native public search envelope')
 io.inventoryRead({kind:'successfactors-unified',surface:search.pageURL,companyId:search.companyId,
  candidateSearch:'India',reportedTotal:payload.totalJobs,observedCandidates:payload.jobSearchResult.length})
 const seen=new Set(),candidates=[]
 for(const item of payload.jobSearchResult){
  const row=item?.response
  need(row&&/^[1-9]\d{2,19}$/.test(row.id||'')&&typeof row.unifiedStandardTitle==='string'&&row.unifiedStandardTitle.trim()
   &&Array.isArray(row.supportedLocales)&&row.supportedLocales.includes(search.locale)&&!seen.has(row.id),'native search role identity changed')
  seen.add(row.id)
  const slug=decodeNativeEntities(row.unifiedUrlTitle||'')
  need(slug&&!/[/?#]/.test(slug),'missing native public role slug')
  candidates.push({url:search.origin+'/job/'+encodeURIComponent(slug)+'/'+row.id+'-'+search.locale,
   id:row.id,title:decodeNativeEntities(row.unifiedStandardTitle),record:row})
 }
 return candidates
}

// Unified RMK lays out several own description fragments and labelled role
// fields instead of data-careersite-propertyid values. A country must be the
// value next to the active Job Country label in this exact role's own shell.
export function successFactorsUnifiedPostings(document,pageURL,{listing=null}={}){
 const page=new URL(pageURL),route=/^\/(?:[a-z\d_-]+\/)?job\/[^/]+\/([1-9]\d{2,19})-([a-z]{2}_[A-Z]{2})\/?$/i
 const match=page.pathname.match(route)
 if(!match)return []
 const shells=document.nodes(n=>classes(n,'jobDisplayShell')&&Object.hasOwn(n.attrs,'itemscope')
  &&/^https?:\/\/schema\.org\/JobPosting\/?$/.test(n.attrs.itemtype||''))
 if(shells.length!==1)return []
 const fields=new Map(),titles=new Set(),descriptions=[],issues=[]
 const blocked=new Set(['blockquote','q','pre','code','aside','script','style','template','object','iframe','noscript'])
 const own=[]
 const walk=parent=>{
  for(const child of parent.children){
   if(typeof child==='string'||child.inert||blocked.has(child.tag)||Object.hasOwn(child.attrs,'itemscope'))continue
   own.push(child);walk(child)
  }
 }
 walk(shells[0])
 for(const node of own){
  const properties=(node.attrs.itemprop||'').split(/\s+/)
  if(properties.includes('title'))titles.add(document.text(node))
  if(properties.includes('description')&&!['meta','link'].includes(node.tag)&&document.text(node))descriptions.push(document.text(node))
  if(!classes(node,'joblayouttoken'))continue
  const inToken=new Set()
  const descendants=parent=>parent.children.filter(c=>typeof c!=='string'&&!c.inert&&!blocked.has(c.tag)&&!Object.hasOwn(c.attrs,'itemscope')).flatMap(c=>[c,...descendants(c)])
  for(const parent of [node,...descendants(node)]){
   const children=parent.children.filter(c=>typeof c!=='string'&&!c.inert&&!blocked.has(c.tag)&&!Object.hasOwn(c.attrs,'itemscope'))
   const labels=children.filter(c=>classes(c,'joblayouttoken-label'))
   if(labels.length!==1)continue
   const values=children.filter(c=>c!==labels[0]&&classes(c,'rtltextaligneligible'))
   if(values.length!==1)continue
   const label=document.text(labels[0]).replace(/\s*:\s*$/,'').trim(),value=document.text(values[0])
   if(!inToken.has(label)&&value){inToken.add(label);if(!fields.has(label))fields.set(label,new Set());fields.get(label).add(value)}
  }
 }
 const scalar=key=>{const values=[...(fields.get(key)||[])];if(values.length>1)issues.push('ambiguous-native-rmk-'+key);return values.length===1?values[0]:null}
 if(titles.size!==1||!descriptions.length)return []
 const requisition=scalar('Requisition ID')
 if(fields.has('Requisition ID')&&requisition!==match[1])return []
 if(!requisition){
  const canonical=document.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical').map(n=>n.attrs.href)
  if(canonical.length!==1)return []
  let declared;try{declared=new URL(canonical[0],page)}catch{return []}
  if(declared.protocol!=='https:'||declared.origin!==page.origin||declared.username||declared.password||declared.port||declared.search||declared.hash
    ||declared.pathname.replace(/\/$/,'')!==page.pathname.replace(/\/$/,''))return []
 }
 const listingLocations=[]
 if(listing?.id===match[1]&&decodeNativeEntities(listing.unifiedStandardTitle||'')===[...titles][0]){
  for(const raw of Array.isArray(listing.jobLocationShort)?listing.jobLocationShort:[]){
   if(typeof raw!=='string')continue
   const locationDocument=readNativeDocument(raw),label=locationDocument.text(locationDocument.nodes(n=>n.tag==='root')[0])
   const parts=label.split(',').map(s=>s.trim()),tail=parts.at(-1),countryLabel=/^[1-9]\d{5}$/.test(tail)?parts.at(-2):tail
   if(parts.length>=2&&isNativeBareCityInPublicScope(parts[0])&&(countryLabel==='IND'||countryLabel?.length>2&&nativeCountryName(countryLabel)==='India')){
    listingLocations.push({field:'jobSearchResult.response.jobLocationShort',rawValue:raw,country:'India',city:parts[0]})
   }
  }
 }
 if(!fields.has('Job Country')&&!listingLocations.length)return []
 const structured=recruitmentMicrodataPostings(document,pageURL,{scope:shells[0]})[0]
 issues.push(...structured.nativeMicrodataIssues.filter(issue=>issue!=='ambiguous-native-microdata-description'))
 const roleCountry=fields.has('Job Country')?scalar('Job Country'):'India'
 const structuredCountries=structured.jobLocation.map(place=>place.address?.addressCountry).filter(value=>value!=null)
 if(structuredCountries.some(value=>!nativeCountryName(value)||nativeCountryName(value)!==nativeCountryName(roleCountry)))issues.push('native-unified-country-conflict')
 let employer=structured.hiringOrganization
 if(listing&&Object.hasOwn(listing,'legalEntity_obj')){
  const names=Array.isArray(listing.legalEntity_obj)?[...new Set(listing.legalEntity_obj.filter(value=>typeof value==='string'&&value.trim()).map(value=>value.trim()))]:[]
  if(names.length!==1)issues.push('ambiguous-native-listing-employer')
  else if(employer?.name&&employer.name!==names[0])issues.push('native-listing-detail-employer-conflict')
  else employer={name:names[0]}
 }
 return [{'@type':'JobPosting',nativeRepresentation:'successfactors-unified-visible-role',nativeMicrodataIssues:issues,
  nativeVisibleTitleConfirmed:true,identifier:{value:match[1]},url:pageURL,title:[...titles][0],description:descriptions.join('\n'),
  jobLocation:[{address:{addressCountry:roleCountry,addressLocality:scalar('Posting City')||listingLocations[0]?.city}}],hiringOrganization:employer,
  ...(listingLocations.length?{nativeListingLocationEvidence:listingLocations}:{} )}]
}
