import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import * as F from './currentFacts20261121.js'

export const HOME='https://www.bitwiseglobal.com/'
export const COMPANY='Bitwise Solutions',PUBLISHER='Bitwise'
export const key=value=>String(value).replace(/^data[-_:]/i,'').replace(/[-_\s]/g,'').toLowerCase()
export const text=node=>F.norm(F.authoredLines(node).join(' '))
const fields=new Set(['employer','employername','company','companyname','hiringorganization','legalemployer','legalemployername','country','countrycode','jobcountry','joblocationcountry','workcountry','worklocationcountry','workplacecountry','addresscountry','status','postingstatus','publicationstatus','jobstatus','active','isactive','published','ispublished','open','isopen','closed','isclosed','hidden','ishidden','expired','isexpired','dateposted','posteddate','postingdate','publicationdate','validthrough','expires','expirydate','expirationdate','dateexpires','closingdate','applicationdeadline','applyurl','applicationurl','applicationurls','jobapplicationurl','jobapplicationuri','applyuri','applicationuri','applicationlink','applylink','joburl','detailurl','jobid','postingid','location','joblocation','worklocation','workplace'])
const applicationFields=new Set(['applyurl','applicationurl','applicationurls','jobapplicationurl','jobapplicationuri','applyuri','applicationuri','applicationlink','applylink'])
const vacancyURLFields=new Set(['joburl','detailurl'])
const aliases=new Map([['worklocationcountry','country'],['joblocationcountry','country'],['legalemployername','employer'],['jobapplicationuri','applicationurl'],['hidden','closed'],['ishidden','closed']])
const owned=value=>{try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='www.bitwiseglobal.com'&&!url.port&&!url.username&&!url.password}catch{return false}}
const ownName=value=>typeof value==='string'&&F.norm(value)===PUBLISHER
const paths=(root,node,path=[])=>root===node?[...path,root]:root.children.filter(c=>typeof c!=='string').map(c=>paths(c,node,[...path,root])).find(Boolean)
export function control(p,node){for(const owner of paths(p.root,node)??[]){F.need(!owner.inert&&!owner.inactive&&!F.disabled(owner),'selected own carrier is hidden/inert/disabled');F.need(!/(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|content-visibility\s*:\s*hidden)/i.test(owner.attrs.style??''),'selected own carrier is style-hidden')}}
export function ownPage(html,url,{row}={}){
 const p=F.page(html,url,{canonical:false}),head=p.d.nodes(n=>n.tag==='meta'),titles=p.titles
 for(const canonical of p.d.nodes(n=>n.tag==='link'&&(n.attrs.rel??'').toLowerCase()==='canonical'))F.need(new URL(canonical.attrs.href,url).href===url,'current own canonical differs')
 for(const meta of head)if(meta.attrs.property==='og:site_name')F.need(ownName(meta.attrs.content),'current own named publisher differs')
 if(row)F.need(titles.every(title=>title.startsWith(row.title)),'role document title differs')
 else F.need(titles.every(title=>/\bBitwise\b/.test(title)),'current own title publisher differs')
 for(const model of F.schemas(p,{types:['Organization','WebSite','WebPage','AboutPage']})){
  const type=Array.isArray(model['@type'])?model['@type']:[model['@type']]
  if(type.some(value=>/(?:^|\/)Organization$|(?:^|\/)WebSite$/.test(value??''))){if(model.name!=null)F.need(ownName(model.name),'current own structured publisher differs');if(model.url!=null)F.need(owned(model.url),'own structured publisher URL differs')}
 }
 return p
}
export function declaredLink(p,base,kind){
 const pattern=kind==='careers'?/^Careers$/i:/^(?:View Open Positions|View Opportunities|Current Openings|Open Positions)$/i
 const candidates=F.all(p.root,n=>n.tag==='a'&&pattern.test(text(n))).map(node=>{let url=null;try{const target=new URL(node.attrs.href,base);if(target.protocol==='https:'&&!target.hash&&!target.search&&!target.username&&!target.password&&!target.port)url=target.href}catch{}return{node,url}}).filter(value=>value.url)
 F.need(candidates.length>0&&candidates.length<=16,'current own '+kind+' declaration missing/excessive')
 const urls=[...new Set(candidates.map(value=>value.url))],url=F.one(urls,'current own '+kind+' destination');F.need(owned(url),'current own handoff leaves publisher')
 const active=candidates.filter(value=>!value.node.inert&&!value.node.inactive);F.need(active.length>0,'current own handoff is inactive');for(const value of active)control(p,value.node)
 return{url,originalDeclarations:candidates.map(value=>({tag:value.node.tag,attributes:structuredClone(value.node.attrs),text:text(value.node),active:!value.node.inert&&!value.node.inactive})),originalHTML:p.html}
}
function flattened(properties,context){
 const output=[]
 const add=(name,value)=>{const normalized=key(name);if(!fields.has(normalized))return;F.need(value!=null&&value!=='','known authored role field is empty '+name);const values=Array.isArray(value)?value:[value];F.need(values.length>0&&values.length<=32,'known field alternatives malformed '+name);for(const candidate of values){F.need(['string','number','boolean'].includes(typeof candidate),'known role field unsupported '+name);if(applicationFields.has(normalized)){let target;try{target=new URL(candidate,context.url)}catch{F.need(false,'invalid application candidate')}F.need(target.href===context.application,'same-role application candidate conflicts')}if(vacancyURLFields.has(normalized))F.need(new URL(candidate,context.url).href===context.url,'role URL alias conflicts');if(['jobid','postingid'].includes(normalized))F.need(String(candidate)===context.id,'native public ID alias conflicts');output.push({key:aliases.get(normalized)??name,value:candidate})}}
 for(const property of properties)add(property.key,property.value)
 return output
}
function fullRecordFacts(model,context,path=[],depth=0){
 F.need(depth<=24,'finite native role model exceeded');if(Array.isArray(model)){F.need(model.length<=200,'native alternatives excessive');return model.flatMap(value=>fullRecordFacts(value,context,path,depth+1))}if(!model||typeof model!=='object')return[]
 const properties=[]
 for(const[name,value]of Object.entries(model)){
  if(name==='hiringOrganization'||name==='employer'||name==='company'){
   if(value&&typeof value==='object'){F.need(ownName(value.name),'same-role named employer differs');for(const uri of [value.url,...(Array.isArray(value.sameAs)?value.sameAs:value.sameAs==null?[]:[value.sameAs])])if(uri!=null)F.need(owned(uri),'same-role employer URI differs');continue}
  }
  const normalized=key(name)
  if(fields.has(normalized)&&(!value||typeof value!=='object'||Array.isArray(value)&&value.every(v=>v==null||typeof v!=='object')))properties.push({key:name,value})
  else if(value&&typeof value==='object'&&!['hiringOrganization','employer','company','address','identifier'].includes(name))properties.push(...fullRecordFacts(value,context,[...path,name],depth+1))
 }
 return flattened(properties,context)
}
function factsScope(root){
 const skip=new Set(['script','style','template','svg','nav','header','footer','aside','form'])
 const copy=node=>({tag:node.tag,attrs:structuredClone(node.attrs),children:node.children.filter(child=>typeof child==='string'||!skip.has(child.tag)).map(child=>typeof child==='string'?child:copy(child)),inert:false,inactive:false})
 return copy(root)
}
function roleConstraints(p,owner,row,application,at){
 const context={id:row.id,url:row.url,application},root=factsScope(owner),nodes=F.all(root,()=>true),semantic=F.semanticCriteria(root),properties=[]
 for(const node of nodes)for(const[name,value]of Object.entries(node.attrs))if(fields.has(key(name)))properties.push({key:name,value})
 properties.push(...F.props(nodes),...semantic.properties)
 const normalized=flattened(properties,context),blocks=[...F.authoredLines(root),...semantic.lines],dates=F.constraints(normalized,blocks,{employer:PUBLISHER,observedAt:at})
 for(const meta of p.d.nodes(node=>node.tag==='meta'))if(fields.has(key(meta.attrs.name??meta.attrs.property??'')))normalized.push(...flattened([{key:meta.attrs.name??meta.attrs.property,value:meta.attrs.content}],context))
 const metaDates=F.constraints(normalized,[],{employer:PUBLISHER,observedAt:at});dates.posted.push(...metaDates.posted);dates.expiry.push(...metaDates.expiry)
 for(const posting of F.schemas(p)){
  F.schemaIdentity(posting,row,PUBLISHER);if(posting.jobLocation!=null)F.need(F.schemaPlaces(posting).every(place=>place.country==='India'),'same-role structured workplace differs')
  const written=fullRecordFacts(posting,context),recognized=F.constraints(written,[],{employer:PUBLISHER,observedAt:at});dates.posted.push(...recognized.posted);dates.expiry.push(...recognized.expiry)
 }
 for(const block of blocks)for(const assertion of block.matchAll(/(?:^|[.!?]\s+)([A-Z][A-Za-z0-9 &'’.-]{1,90}?)\s+(?:is\s+(?:hiring|looking|seeking)|seeks)\b/g)){const subject=F.norm(assertion[1]);if(!['We','Our team'].includes(subject))F.need(ownName(subject),'role recruiting employer differs')}
 return{dates,originalProperties:properties,recognizedProperties:normalized,originalBlocks:blocks}
}
export function listingRows(source,contract,at){
 let model;try{model=readLiteralModel(source).value}catch{F.need(false,'complete200 listing JSON is malformed')}
 F.need(model&&typeof model==='object'&&!Array.isArray(model)&&Array.isArray(model.jobs)&&model.jobs.length<=40,'complete200 native jobs array missing/excessive')
 F.constraints(F.scalarFields(model).filter(value=>value.key!=='jobs'),[],{employer:PUBLISHER,observedAt:at})
 const rows=model.jobs.map((raw,index)=>{
  const row={index,id:null,jobId:null,title:null,slug:null,url:null,group:null,locations:[],experience:null,jobType:null,dates:{posted:[],expiry:[]},original:structuredClone(raw),error:null}
  try{
   F.need(raw&&typeof raw==='object'&&!Array.isArray(raw),'native row malformed');F.need(typeof raw.id==='string'&&/^\d+$/.test(raw.id)&&raw.jobId===raw.id,'native public ID/jobId differs');row.id=raw.id;row.jobId=raw.jobId
   F.need(typeof raw.title==='string'&&F.norm(raw.title),'native title missing');row.title=raw.title
   F.need(typeof raw.slug==='string'&&raw.slug.startsWith(raw.id+'-')&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw.slug),'native slug identity malformed');row.slug=raw.slug;row.url=new URL(contract.cardPrefix+raw.slug,HOME).href
   F.need(typeof raw.location==='string'&&F.norm(raw.location)&&typeof raw.experience==='string'&&typeof raw.jobType==='string','native listing criteria malformed');row.locations=[raw.location];row.experience=raw.experience;row.jobType=raw.jobType;row.group=raw.locationGroup
   F.need(typeof raw.locationGroup==='string'&&['india','us'].includes(raw.locationGroup),'native explicit country group unknown')
   if(row.group==='india'){const properties=fullRecordFacts(raw,{id:row.id,url:row.url,application:row.url+'/apply'});row.dates=F.constraints(properties,[],{employer:PUBLISHER,observedAt:at})}
  }catch(error){row.error=error.message}
  return row
 })
 return{rows,originalModel:model,originalJSON:source}
}
export function selectedRole(original,row,at){
 F.need(!row.error,row.error??'native listing identity unresolved');const p=ownPage(original,row.url,{row}),main=p.d.nodes(n=>n.tag==='main'),body=F.one(main.length?main:p.d.nodes(n=>n.tag==='body'),'actual full role scope')
 const headings=F.all(body,n=>n.tag==='h1'),heading=F.one(headings,'actual role heading');control(p,heading);F.need(text(heading)===row.title,'full/listed role title differs')
 const identifiers=F.all(body,n=>['p','span','div','dd','dt'].includes(n.tag)&&/^Job ID\s*-/.test(text(n)));F.need(identifiers.length>0&&identifiers.every(n=>text(n)==='Job ID - '+row.id),'full/listed native job ID differs');identifiers.forEach(n=>control(p,n))
 const descriptions=p.d.nodes(n=>n.tag==='meta'&&n.attrs.name==='description'),description=F.one(descriptions,'actual role metadata').attrs.content,prefix=row.title+' position at Bitwise. Location: ',suffix='. Experience: '+row.experience+'.'
 F.need(typeof description==='string'&&description.startsWith(prefix)&&description.endsWith(suffix),'role publisher/title/experience metadata differs');const primary=description.slice(prefix.length,-suffix.length)
 F.need(F.norm(primary)===F.norm(row.locations[0]),'full/listed whole workplace differs; raw alternatives retained')
 const summaryHeading=F.one(F.all(body,n=>n.tag==='h2'&&text(n)==='Job Description'),'actual native summary heading'),summaryOwner=(paths(p.root,summaryHeading)??[]).at(-2)
 F.need(summaryOwner,'native summary owner missing');const summaryParts=summaryOwner.children.filter(child=>typeof child!=='string'),summary=summaryParts[summaryParts.indexOf(summaryHeading)+1]
 F.need(summary&&!/^h[1-6]$/.test(summary.tag),'native summary field carrier missing');const summaryFields=summary.children.filter(child=>typeof child!=='string');F.need(summaryFields.length===4,'native title/place/contract/experience field tuple differs')
 for(const field of summaryFields)control(p,field)
 const summaryValues=summaryFields.map(field=>text(field));F.need(F.same(summaryValues,[row.title,primary,row.jobType,row.experience]),'full/listed title/workplace/contract/experience criteria differ')
 const candidates=F.all(body,n=>n.tag==='a'&&/^APPLY(?: NOW)?$/i.test(text(n)));F.need(candidates.length>0&&candidates.length<=16,'actual application controls missing/excessive')
 const urls=[];for(const node of candidates){control(p,node);let target;try{target=new URL(node.attrs.href,row.url)}catch{F.need(false,'invalid actual application URI')}F.need(target.href===row.url+'/apply'&&owned(target.href)&&!target.search&&!target.hash,'actual same-role application handoff differs');urls.push(target.href)}
 const application={url:F.one([...new Set(urls)],'same-role application handoff'),originalControls:candidates.map(n=>({tag:n.tag,attributes:structuredClone(n.attrs),text:text(n)})),visited:false,submitted:false,activationVerified:false,allControlsQualified:false}
 const recognized=roleConstraints(p,body,row,application.url,at),rawScope=p.raw.nodes(n=>n.tag===body.tag),rawHTML=rawScope.length===1?p.raw.outer(rawScope[0]):original,roleText=p.d.text(body)
 recognized.dates.posted.push(...row.dates.posted);recognized.dates.expiry.push(...row.dates.expiry)
 F.need(roleText.includes('Job Description')&&roleText.includes('Job Summary')&&roleText.includes('About Us')&&roleText.includes('Bitwise'),'full actual criteria or own publisher missing')
 const model={binding:{id:row.id,jobId:row.jobId,title:row.title,slug:row.slug,publicURL:row.url,applicationURL:application.url,countryGroup:row.group,location:primary,publisher:PUBLISHER,experience:row.experience,jobType:row.jobType},originalListing:structuredClone(row.original),originalHTML:original,originalFullRoleHTML:rawHTML,originalHead:p.titles,originalMetadata:description,originalSummary:{tag:summary.tag,attributes:structuredClone(summary.attrs),fields:summaryFields.map((field,index)=>({tag:field.tag,attributes:structuredClone(field.attrs),text:summaryValues[index]}))},originalCriteria:recognized,originalApplication:application,nativeCountryGroup:row.group,nativeCountry:null,nativeLegalEmployer:null,formalRequisition:null}
 return{model,description:roleText,rawDescription:rawHTML,application,dates:recognized.dates,primary}
}
