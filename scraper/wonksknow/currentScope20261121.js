import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {nativeCountryName,nativeDate} from '../../scraper-support/shared/nativeJobPosting.js'
import {findExplicitNativeClosure} from '../../scraper-support/utils/sourceAvailability.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'

export const HOME='https://www.wonksknow.com/',BOARD='https://vinterview.ai/wonksknowindia/overview'
export const need=(condition,message)=>{if(!condition)throw Object.assign(Error('Wonksknow current public DOM: '+message),{abortRetries:true,nativeContradiction:true,softFailure:true,failureKind:'parser_or_contract_error'})}
export const one=(values,label)=>{need(values.length===1,'missing/ambiguous '+label);return values[0]}
export const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
export const key=value=>norm(value).replace(/^data[-_:]/i,'').replace(/[-_\s]/g,'').toLowerCase()
export const cls=(node,name)=>(node.attrs.class??'').split(/\s+/).includes(name)
export const all=(node,predicate)=>[...(predicate(node)?[node]:[]),...node.children.filter(child=>typeof child!=='string').flatMap(child=>all(child,predicate))]
export const authored=node=>typeof node==='string'?decodeNativeEntities(node):['script','style'].includes(node.tag)?'':node.raw??node.children.map(authored).join(' ')
const blocks=new Set(['address','article','aside','blockquote','dd','details','dialog','div','dl','dt','fieldset','figcaption','figure','footer','form','h1','h2','h3','h4','h5','h6','header','hgroup','li','main','menu','nav','ol','p','pre','section','summary','table','tbody','td','tfoot','th','thead','tr','ul','root'])
export function lines(node){
 const walk=current=>{if(typeof current==='string')return decodeNativeEntities(current);if(['script','style'].includes(current.tag))return '';if(current.tag==='br')return '\n';const text=current.raw??current.children.map(walk).join('');return blocks.has(current.tag)?'\n'+text+'\n':text}
 return walk(node).split(/\n+/).map(norm).filter(Boolean)
}
export function page(html,url,{publisher=false}={}){
 need(typeof html==='string'&&html.length>0,'original HTML missing')
 const raw=readNativeDocument(html,{sourceRanges:true}),root=one(raw.nodes(node=>node.tag==='root'),'original document root'),visible=readVisibleNativeDocument(html,{strict:true}),visibleRoot=one(visible.nodes(node=>node.tag==='root'),'visible document root'),parents=new Map(),visibleNodes=new WeakMap()
 const pair=(left,right)=>{need(left.tag===right.tag,'shared native reader trees differ');visibleNodes.set(left,right);const a=left.children.filter(child=>typeof child!=='string'),b=right.children.filter(child=>typeof child!=='string');need(a.length===b.length,'native tree correspondence differs');a.forEach((child,index)=>{parents.set(child,left);pair(child,b[index])})};pair(root,visibleRoot)
 const active=node=>!!visibleNodes.get(node)&&!visibleNodes.get(node).inert&&(node.sourceNamespace==null||node.sourceNamespace==='html')
 const outer=node=>{need(Number.isInteger(node.sourceStart)&&Number.isInteger(node.sourceEnd),'unclosed original scoped carrier');return html.slice(node.sourceStart,node.sourceEnd)}
 const ancestors=node=>{const result=[];for(let at=node;at;at=parents.get(at))result.unshift(at);return result}
 const headNodes=all(root,node=>ancestors(node).some(parent=>parent.tag==='head')&&node.sourceNamespace==='html')
 need(!all(root,node=>active(node)&&(node.tag==='base'||node.tag==='meta'&&/refresh/i.test(node.attrs['http-equiv']??''))).length,'base or refresh changes the declared public identity')
 const titles=headNodes.filter(node=>node.tag==='title'&&active(node));const title=norm(one(titles,'actual head title').raw??'')
 need(publisher?/\bWonksknow\b/i.test(title):/^(?:work with us|careers?|jobs?|job opportunities|job openings|join (?:our|the) team)(?:\s*[-|:]\s*Wonksknow)?$/i.test(title)||/\bWonksknow\b/i.test(title),'current publisher/head title unqualified')
 for(const canonical of headNodes.filter(node=>node.tag==='link'&&active(node)&&(node.attrs.rel??'').toLowerCase().split(/\s+/).includes('canonical'))){const value=new URL(canonical.attrs.href,url);need(publisher?ownedWebsite(value.href):value.href===url,'canonical publisher or role identity differs')}
 return{html,url,raw,root,visible,parents,visibleNodes,active,outer,ancestors,headNodes,title,text:node=>norm(visible.text(visibleNodes.get(node)??node))}
}
export function ownedWebsite(value){try{const url=new URL(value);return['https:','http:'].includes(url.protocol)&&['www.wonksknow.com','wonksknow.com'].includes(url.hostname)&&url.pathname==='/'&&!url.search&&!url.hash&&!url.username&&!url.password&&!url.port}catch{return false}}
export function ownIssuer(value){return typeof value==='string'&&/^(?:wonksknow|wonksknow llc|wonksknow india|wonksknow robotics|wonksknow technologies india private (?:limited|ltd\.?)|wonksknow india technologies private (?:limited|ltd\.?))$/i.test(norm(value))}
export function control(p,node){need(p.active(node),'required carrier hidden/inert/CSS-excluded');for(const owner of p.ancestors(node))need(!Object.hasOwn(owner.attrs,'disabled')&&owner.attrs['aria-disabled']?.toLowerCase()!=='true'&&!cls(owner,'disabled'),'required carrier or ancestor disabled');need(node.attrs.onclick==null,'opaque current native navigation callback is unqualified')}
export function publicRoleURL(value,base=BOARD){const url=new URL(value,base);need(url.protocol==='https:'&&url.origin==='https://vinterview.ai'&&url.pathname==='/wonksknowindia/view_job_description'&&!url.hash&&!url.username&&!url.password&&!url.port,'public role leaves the declared India account');need(url.searchParams.getAll('job_id').length===1&&[...url.searchParams.keys()].every(name=>name==='job_id'),'role query identity differs');const id=url.searchParams.get('job_id');need(id&&id.length<=128&&!/[\u0000-\u0020\u007f]/.test(id),'native role ID malformed');return{url:url.href,id}}

const positive=new Set(['active','isactive','published','ispublished','posted','isposted','open','isopen','canapply','allowapplications','acceptingapplications'])
const negative=new Set(['closed','isclosed','expired','isexpired','archived','isarchived','disabled','isdisabled','removed','isremoved','deleted','isdeleted'])
const statuses=new Set(['status','jobstatus','postingstatus','publicationstatus','availability','availabilitystatus','requisitionstatus'])
const employers=new Set(['employer','employername','company','companyname','hiringorganization','legalemployer','publisher','issuer','organization','organizationname'])
const countries=new Set(['country','countries','nativecountry','countrycode','jobcountry','workcountry','workplacecountry','worklocationcountry','addresscountry','addresscountrycode','applicantcountry','eligiblecountry','eligiblecountries'])
const posted=new Set(['dateposted','posteddate','postingdate','publicationdate','postedon','publishedon','publisheddate'])
const expiry=new Set(['expires','validthrough','validtill','closingdate','applicationdeadline','dateexpires','expirydate','expirationdate','applicationsclose'])
const places=new Set(['location','locations','joblocation','joblocations','worklocation','worklocations','workplace','workplaces','secondarylocation','secondarylocations','secondaryworklocation','secondaryworklocations'])
const application=/^(?:apply|application|jobapplication)(?:urls?|uris?|links?)$/
const roleURLs=/^(?:job|detail|source)(?:urls?|uris?|links?)$/
const recognized=name=>positive.has(name)||negative.has(name)||statuses.has(name)||employers.has(name)||countries.has(name)||posted.has(name)||expiry.has(name)||places.has(name)||application.test(name)||roleURLs.test(name)||['applicantlocationrequirements','eligibleregion','title','jobtitle','jobpostingtitle','jobid','nativepublicjobid','workfromhome','employmenttype'].includes(name)
const values=value=>{const result=Array.isArray(value)?value:[value];need(result.length>0&&result.length<=64,'known fact alternatives missing/excessive');return result}
const country=value=>value==='USA'?'United States':nativeCountryName(value)
function writtenCountries(value){const words=norm(value).replace(/[^\p{L}\p{N}\s]/gu,' ').split(/\s+/),found=[];for(let at=0;at<words.length;at++)for(let count=Math.min(6,words.length-at);count>0;count--){const text=words.slice(at,at+count).join(' '),name=text.length>2?country(text):null;if(name){found.push(name);at+=count-1;break}}return [...new Set(found)]}
function semantic(root){
 const result=[],explicit=new Set(['label','dt','th']),leaf=node=>node.children.every(child=>typeof child==='string'||!blocks.has(child.tag)&&!['script','style','template','iframe','object','noscript'].includes(child.tag)&&leaf(child))
 for(const owner of all(root,node=>blocks.has(node.tag))){
  if(owner.children.some(child=>typeof child==='string'&&norm(decodeNativeEntities(child))))continue
  const children=owner.children.filter(child=>typeof child!=='string'&&!['script','style'].includes(child.tag))
  for(let index=0;index+1<children.length;index++){
   const label=children[index],value=children[index+1],name=norm(authored(label)).replace(/\s*:\s*$/,'')
   if(!recognized(key(name))||!explicit.has(label.tag)&&!(children.length===2&&leaf(label))||explicit.has(value.tag))continue
   const content=value.attrs.content??value.attrs.datetime??(application.test(key(name))&&value.tag==='a'?value.attrs.href:null)??norm(authored(value));need(typeof content==='string'&&content,'known semantic value missing');result.push({key:name,value:content,carrier:'adjacent-semantic-criteria'});index++
  }
 }
 return result
}
export function scopeFacts(p,root,context,{attributesOnly=false,includeHead=false,publisherOnly=false}={}){
 const facts={properties:[],originalStructuredModels:[],posted:[],expiry:[],countries:[],issuer:[],applications:[],locations:[],workplaceModes:[],status:[],unknownNativeFieldsPreserved:true},at=new Date(context.at);need(Number.isFinite(+at),'observation clock invalid');let visited=0,descriptionDepth=0
 const readDate=(value,kind,field)=>{if(value==null||value==='')return;for(const item of values(value)){const parsed=nativeDate(item,{required:true});need(kind==='posted'?(parsed.exact?Date.parse(parsed.iso)<=+at:parsed.iso.slice(0,10)<=at.toISOString().slice(0,10)):(parsed.exact?Date.parse(parsed.iso)>+at:parsed.iso.slice(0,10)>=at.toISOString().slice(0,10)),'authored publication date future or expired');facts[kind].push({field,...parsed})}}
 const identityURL=(value,allowed,label)=>{for(const item of values(value)){need(typeof item==='string'&&norm(item),'known '+label+' value malformed');need(allowed.includes(new URL(item,context.url).href),'same-role '+label+' alias differs')}}
 const workplace=value=>{for(const item of values(value)){
  if(typeof item==='string'){
   // This actual authored Work Location value is an occupational mode. It
   // supplies no country and does not replace the separate native header.
   if(/^field\s+sales$/i.test(norm(item))){facts.workplaceModes.push(item);continue}
   need(!/\b(?:worldwide|global|anywhere|apac|emea|europe|north america)\b/i.test(item),'broader/unknown workplace conflicts with own India channel');const written=writtenCountries(item);need(written.every(name=>name==='India'),'foreign authored workplace');need(written.length>0||norm(item).toLowerCase()===norm(context.location).toLowerCase()||norm(context.location).split(/,|\s+or\s+/i).some(part=>norm(part).toLowerCase()===norm(item).toLowerCase()),'unknown or conflicting workplace alternative');facts.locations.push(item)
  }else{need(item&&typeof item==='object'&&!Array.isArray(item)&&Object.keys(item).some(name=>countries.has(key(name))||['address','name','addressLocality','addressRegion'].includes(name)),'typed workplace unresolved');walkModel(item)}
 }}
 const employer=value=>{for(const item of values(value)){if(typeof item==='string'){need(ownIssuer(item),'scoped issuer/employer differs');facts.issuer.push(item)}else{need(item&&typeof item==='object'&&!Array.isArray(item)&&ownIssuer(item.name),'typed issuer/employer differs');if(item['@type']!=null)need(values(item['@type']).every(type=>['Organization','https://schema.org/Organization','http://schema.org/Organization'].includes(type)),'typed issuer context differs');for(const field of['url','sameAs','website','publicWebsite'])if(item[field]!=null)for(const uri of values(item[field]))need(ownedWebsite(uri)||uri===BOARD,'issuer URL differs');facts.issuer.push(structuredClone(item));walkModel(item)}}}
 const property=(name,value,carrier='known-native-field')=>{
  const normalized=key(name);if(!recognized(normalized))return
  facts.properties.push({key:name,value:structuredClone(value),carrier})
  if(positive.has(normalized))for(const item of values(value))need(item===true||typeof item==='string'&&item.toLowerCase()==='true','publication explicitly unavailable')
  if(negative.has(normalized))for(const item of values(value))need(item===false||typeof item==='string'&&item.toLowerCase()==='false','publication explicitly closed')
  if(statuses.has(normalized))for(const item of values(value)){need(typeof item==='string'&&/^(?:open|active|published|available|approved|posted|accepting applications)$/i.test(norm(item)),'publication status unknown/closed');facts.status.push(item)}
  if(employers.has(normalized))employer(value)
  if(publisherOnly)return
  if(countries.has(normalized))for(const item of values(value)){const label=typeof item==='object'&&item?item.name:item;need(country(label)==='India','native country unknown/foreign');facts.countries.push({field:name,original:structuredClone(item),country:'India'})}
  if(posted.has(normalized))readDate(value,'posted',name)
  if(expiry.has(normalized))readDate(value,'expiry',name)
  if(application.test(normalized)){identityURL(value,[context.applyURL], 'application');facts.applications.push({field:name,value:structuredClone(value)})}
  if(roleURLs.test(normalized))identityURL(value,[context.url],'public-role URL')
  if(places.has(normalized))workplace(value)
  if(['applicantlocationrequirements','eligibleregion'].includes(normalized))for(const item of values(value)){const label=typeof item==='string'?item:item?.name;need(country(label)==='India','applicant geographic scope unknown/foreign')}
  if(['title','jobtitle','jobpostingtitle'].includes(normalized))need(typeof value==='string'&&norm(value).toLowerCase()===norm(context.title).toLowerCase(),'same-role title differs')
  if(['jobid','nativepublicjobid'].includes(normalized))need(typeof value==='string'&&value===context.id,'same-role identifier differs')
  if(normalized==='workfromhome')need(typeof value==='string'&&['YES','NO'].includes(value.toUpperCase())&&(!context.workFromHome||value.toUpperCase()===context.workFromHome),'work-from-home facts conflict')
  if(normalized==='employmenttype')need(typeof value==='string'&&norm(value).replace(/[-\s]/g,'').toLowerCase()===norm(context.contract).replace(/[-\s]/g,'').toLowerCase(),'employment-type facts conflict')
 }
 const readDOM=(domRoot,{onlyAttrs=false}={})=>{
  const nodes=onlyAttrs?[domRoot]:all(domRoot,()=>true)
  for(const node of nodes){
   for(const[name,value]of Object.entries(node.attrs))if(name.startsWith('data-'))property(name,value,'native-attribute')
   if(node.attrs.itemprop)for(const name of node.attrs.itemprop.split(/\s+/).filter(Boolean))property(name,node.attrs.content??node.attrs.datetime??norm(authored(node)),'native-itemprop')
  }
  if(onlyAttrs)return
  const scopedLines=lines(domRoot);need(!findExplicitNativeClosure(scopedLines),'authored role/application closure')
  for(const line of scopedLines){const match=/^([^:]{1,55})\s*:\s*(.*)$/.exec(line);if(match&&recognized(key(match[1])))property(match[1],norm(match[2]),'authored-labeled-criteria')}
  for(const pair of semantic(domRoot))property(pair.key,pair.value,pair.carrier)
 }
 const walkModel=(model,depth=0)=>{
  need(depth<=24&&++visited<=10000,'finite structured facts bound reached')
  if(Array.isArray(model)){model.forEach(item=>walkModel(item,depth+1));return}
  if(!model||typeof model!=='object')return
  if(Object.hasOwn(model,'@context'))need(typeof model['@context']==='string'&&/^https?:\/\/schema\.org\/?$/.test(model['@context']),'structured role context unqualified')
  for(const[name,value]of Object.entries(model)){
   if(name==='@context'||name==='@type')continue
   const normalized=key(name)
   property(name,value,'native-structured-model')
   if(name==='url'&&!publisherOnly&&context.id)identityURL(value,[context.url],'structured role URL')
   if(name==='description'&&typeof value==='string'&&/[<>]/.test(value)){
    need(++descriptionDepth<=16&&value.length<=1000000,'finite structured description bound reached');const fragment=readNativeDocument(value,{sourceRanges:true}),fragmentRoot=one(fragment.nodes(node=>node.tag==='root'),'structured description root');readDOM(fragmentRoot);descriptionDepth--
   }
   if(value&&typeof value==='object'&&!employers.has(normalized)&&!places.has(normalized))walkModel(value,depth+1)
  }
 }
 readDOM(root,{onlyAttrs:attributesOnly})
 const scripts=attributesOnly?[]:all(root,node=>node.tag==='script'&&!node.attrs.src&&/^application\/ld\+json(?:\s*;|$)/i.test(norm(node.attrs.type)))
 if(includeHead)for(const node of p.headNodes){if(node.tag==='meta'&&node.attrs.content!=null){const name=node.attrs.itemprop??node.attrs.name??node.attrs.property;if(name&&recognized(key(name)))property(name,node.attrs.content,'actual-head-metadata')}if(node.tag==='script'&&!node.attrs.src&&/^application\/ld\+json(?:\s*;|$)/i.test(norm(node.attrs.type)))scripts.push(node)}
 for(const script of [...new Set(scripts)]){const model=readLiteralModel(script.raw??'').value;need(model&&typeof model==='object','structured facts malformed');facts.originalStructuredModels.push(structuredClone(model));walkModel(model)}
 for(const list of[facts.posted,facts.expiry])list.sort((a,b)=>a.iso.localeCompare(b.iso)||Number(b.exact)-Number(a.exact))
 return facts
}

export function qualifyIssuerProse(description,divisionContext=[],visibleDescription=null){
 const result={recruitingAssertions:[],programmes:[],employerRelationshipUnresolved:false}
 if(!description)return result
 const text=norm(description).replace(/^Job description\s*/i,'').replace(/^Role\s*&\s*responsibilities\s*/i,'')
 need(/\bWonksknow\b|\bWonsksknow\b/i.test(text.slice(0,400)),'selected criteria lacks an own issuer/product declaration')
 const assertions=text.matchAll(/(?:^|[.!?]\s+)([^.!?]{1,150}?)\s+(?:is\s+(?:looking|seeking|hiring|a wholly owned subsidiary)|seeks)\b/gi)
 for(const assertion of assertions){
  // The actual subsidiary clause identifies the parent; its USA office is not
  // the hiring employer name or the vacancy's country. Keep the raw prose.
  const name=norm(assertion[1]).replace(/^Role Overview\s*/i,'').replace(/,\s*a (?:wholly owned )?subsidiary of Wonksknow LLC(?:\s+USA)?\s*,?$/i,'')
  const original={rawAssertion:assertion[0],rawSubject:assertion[1],normalizedSubject:name}
  if(ownIssuer(name)||/^Wonsksknow$/i.test(name)){result.recruitingAssertions.push({...original,relationship:'configured-publisher-assertion'});continue}
  const declarations=divisionContext.filter(division=>norm(division.name).toLowerCase()===name.toLowerCase()&&division.publisher==='WONKSKNOW LLC'&&division.originalDivisionDeclaration.active===true)
  need(declarations.length>0,'selected criteria declares a different recruiting employer')
  const literal=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),classification=new RegExp('(?:^|[.!?]\\s+)'+literal+'\\s+is\\s+(?:a|an)\\s+([^.!?]{0,96}?)\\bprogram(?:me)?\\b','i').exec(norm(visibleDescription))
  need(classification&&!/\b(?:of|for|with|to|as|that|which|from|not|no|former|formerly|client|customer|provider|supplier|sponsor|partner)\b/i.test(classification[1]),'declared division lacks selected active programme classification')
  const programme={...original,name,relationship:'own-declared-division-selected-programme',selectedProgrammeClassification:classification[0].replace(/^[.!?]\s+/,''),originalDivisionDeclaration:structuredClone(declarations[0].originalDivisionDeclaration)}
  result.programmes.push(programme);result.recruitingAssertions.push(structuredClone(programme));result.employerRelationshipUnresolved=true
 }
 return result
}
