import {decodeHTML} from 'entities'
import {activeHead,readNativeDocument,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {createCurrentPublicTransport} from '../uniqus/currentPublicTransport.js'

const source='loginext',company='LogiNext',corporate='https://www.loginextsolutions.com/job-roles',board='https://loginext.hire.trakstar.com/'
const clean=value=>String(value??'').replace(/\s+/g,' ').trim()
const cls=(node,name)=>(node.attrs.class||'').split(/\s+/).includes(name)
const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)
const text=(node,visible)=>{
 if(typeof node==='string')return decodeHTML(node)
 if(visible&&(!visible.has(node)||['script','style','template','noscript'].includes(node.tag)))return''
 return typeof node.raw==='string'?node.raw:node.children.map(child=>text(child,visible)).join(' ')
}
const document=html=>{
 const doc=readVisibleNativeDocument(html,{strict:true}),visible=new Set(doc.nodes(()=>true))
 const within=(node,predicate,result=[])=>{
  if(typeof node!=='string'&&visible.has(node)){
   if(predicate(node))result.push(node)
   for(const child of node.children)within(child,predicate,result)
  }
  return result
 }
 return{...doc,nodes:(predicate,subtree)=>subtree?within(subtree,predicate):doc.nodes(predicate),text:node=>clean(text(node,visible))}
}

// The current non-executable JSON-LD contains literal LF/CR/tab inside its
// quoted HTML description. Escape only those characters without removing any
// content. Standard JSON validation and duplicate-key rejection still apply.
function readCarrier(raw,fail){
 let encoded='',quoted=false,escaped=false
 for(const char of raw){
  if(quoted&&char.charCodeAt(0)<32){
   if(escaped||!['\n','\r','\t'].includes(char))throw fail('unreviewed native JSON string control')
   encoded+=char==='\n'?'\\n':char==='\r'?'\\r':'\\t';continue
  }
  encoded+=char;if(char==='"'&&!escaped)quoted=!quoted
  if(quoted&&char==='\\'&&!escaped)escaped=true;else escaped=false
 }
 let model
 try{model=JSON.parse(encoded)}catch{throw fail('malformed native JobPosting carrier')}
 const scopes=[]
 for(let index=0;index<encoded.length;index++){
  const char=encoded[index]
  if(char==='"'){
   let end=index+1;while(end<encoded.length){if(encoded[end]==='\\'){end+=2;continue}if(encoded[end]==='"')break;end++}
   let next=end+1;while(/\s/.test(encoded[next]||'')&&next<encoded.length)next++
   if(encoded[next]===':'){
    const key=JSON.parse(encoded.slice(index,end+1)),scope=scopes.at(-1)
    if(!scope||scope.has(key))throw fail('duplicate native JSON object key')
    scope.add(key)
   }
   index=end
  }else if(char==='{')scopes.push(new Set())
  else if(char==='[')scopes.push(null)
  else if(char==='}'||char===']')scopes.pop()
 }
 return model
}

export async function runCurrentLogiNext(options={}){
 const io=createCurrentPublicTransport(source,['https://www.loginextsolutions.com','https://loginext.hire.trakstar.com'],options)
 const maxJobs=options.maxJobs??0,checkedAt=new Date(options.now?.()??Date.now()).toISOString(),today=checkedAt.slice(0,10)
 if(!Number.isSafeInteger(maxJobs)||maxJobs<0)throw io.fail('invalid native output limit')
 const need=(condition,message)=>{if(!condition)throw io.fail(message)}
 const oneText=(doc,className,subtree)=>{const nodes=doc.nodes(n=>cls(n,className),subtree);need(nodes.length===1,'ambiguous or missing native '+className);return doc.text(nodes[0])}
 const corporateAt=async()=>{
  const page=await io.fetchPage(corporate),doc=document(page.html)
  need(activeHead(page.html).titles[0]==='LogiNext | Join Our Team | Job Opportunities'
   &&doc.nodes(n=>n.tag==='h1'&&doc.text(n)==='Build something you love').length===1,'current corporate employer identity changed')
  const anchors=doc.nodes(n=>n.tag==='a'&&n.attrs.href)
  need(anchors.some(n=>{try{return new URL(n.attrs.href,corporate).href===board&&doc.text(n).toLowerCase()==='find jobs'}catch{return false}}),'active exact employer native handoff unavailable')
  return{roleReferences:[...new Set(anchors.map(n=>n.attrs.href).filter(href=>/^https:\/\/loginext\.recruiterbox\.com\/jobs\/fk[a-z0-9]+\/?$/.test(href)))],
   additionalHandoffs:[...new Set(anchors.map(n=>n.attrs.href).filter(href=>/^https?:\/\/jobs\.loginextsolutions\.com\//.test(href)))]}
 }
 const boardAt=async()=>{
  const page=await io.fetchPage(board),doc=document(page.html)
  need(activeHead(page.html).titles[0]==='LogiNext jobs | LogiNext openings | LogiNext careers','native board employer identity changed')
  const anchors=doc.nodes(n=>n.tag==='a'&&/^\/jobs\/fk[a-z0-9]+\/$/.test(n.attrs.href||'')),ids=new Set()
  need(anchors.length>0&&anchors.length<=200,'native role inventory unavailable; empty is not proven')
  return anchors.map(node=>{
   const id=node.attrs.href.split('/')[2];need(!ids.has(id),'duplicate native role identity');ids.add(id)
   const departments=doc.nodes(n=>cls(n,'rb-text-4')&&!cls(n,'js-job-list-opening-meta'),node)
   need(departments.length===1,'native department identity changed')
   return{id,url:new URL(node.attrs.href,board).href,title:oneText(doc,'js-job-list-opening-name',node),
    city:oneText(doc,'meta-job-location-city',node),state:oneText(doc,'meta-job-location-state',node),country:oneText(doc,'meta-job-location-country',node),
    department:doc.text(departments[0]),employmentType:oneText(doc,'js-job-list-opening-meta',node),nativeLabel:doc.text(node)}
  })
 }
 const calendar=(value,field)=>{
  need(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value),'unsupported native '+field)
  const date=new Date(value+'T00:00:00.000Z');need(Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value,'impossible native '+field);return value
 }
 const roleAt=async row=>{
  const page=await io.fetchPage(row.url),raw=readNativeDocument(page.html),doc=document(page.html)
  const carriers=raw.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json')
  need(carriers.length===1,'ambiguous native full role carrier')
  const model=readCarrier(carriers[0].raw,io.fail),allowed=new Set(['@context','@type','title','description','jobLocation','datePosted','employmentType','identifier','hiringOrganization','validThrough'])
  need(model&&typeof model==='object'&&!Array.isArray(model)&&Object.keys(model).every(key=>allowed.has(key)),'unreviewed full native criteria fields')
  need(model['@context']==='http://schema.org/'&&model['@type']==='JobPosting'
   &&model.identifier?.['@type']==='PropertyValue'&&model.identifier.name===company&&model.identifier.value===row.id
   &&model.hiringOrganization?.['@type']==='Organization'&&model.hiringOrganization.name===company,'native role or employer identity changed')
  const title=oneText(doc,'js-job-title'),address=model.jobLocation?.address
  need(typeof model.title==='string'&&clean(decodeHTML(model.title))===title&&title===row.title
   &&activeHead(page.html).titles[0]===title+' at '+company,'native role title identity changed')
  need(model.jobLocation?.['@type']==='Place'&&address?.['@type']==='PostalAddress'
   &&address.addressCountry===row.country&&oneText(doc,'meta-job-location-country')===row.country&&clean(row.country),'native country changed or missing')
  need(address.addressLocality===row.city&&oneText(doc,'meta-job-location-city')===row.city
   &&address.addressRegion===row.state&&oneText(doc,'meta-job-location-state')===row.state,'native workplace changed')
  const header=oneText(doc,'opening-info').split('|').map(clean)
  need(header.length===3&&header[1]===row.department&&header[2]===row.employmentType
   &&model.employmentType==='FULL_TIME'&&row.employmentType==='Full-time','native employment or department changed')
  need(calendar(model.datePosted,'publication date')<=today,'future native publication date')
  if(model.validThrough!=null)need(calendar(model.validThrough,'closing date')>today,'native closing date expired or ambiguous today')
  need(typeof model.description==='string','native full description missing')
  const descriptionHTML=decodeHTML(model.description),description=readNativeDocument(descriptionHTML),root=description.nodes(n=>n.tag==='root')[0]
  const criteria=clean(text(root)),containers=doc.nodes(n=>cls(n,'jobdesciption'))
  need(extractActiveDescription(descriptionHTML)&&containers.length===1&&criteria===doc.text(containers[0]),'complete native description or visible criteria unavailable')
  const buttons=doc.nodes(n=>n.tag==='a'&&cls(n,'btn-apply'))
  need(buttons.length>0&&buttons.every(n=>new URL(n.attrs.href,row.url).href===row.url+'?apply=true'),'native active application identity unavailable')
  return{model,rawCarrier:carriers[0].raw,descriptionHTML,criteria,applyUrl:row.url+'?apply=true'}
 }
 const openingCorporate=await corporateAt(),rows=await boardAt(),nativeModels=[]
 for(const row of rows)nativeModels.push({row,role:await roleAt(row)})
 for(const{row,role}of nativeModels){const closing=await roleAt(row);need(stable(role.model)===stable(closing.model)&&role.criteria===closing.criteria,'closing full native role criteria changed')}
 const closingRows=await boardAt(),byId=values=>stable([...values].sort((a,b)=>a.id.localeCompare(b.id)))
 need(byId(rows)===byId(closingRows),'closing complete native board records changed')
 const closingCorporate=await corporateAt(),ids=new Set(rows.map(row=>row.id))
 const audit={source,nativeRecords:rows,nativeRoleModels:nativeModels.map(({row,role})=>({url:row.url,...role})),
  corporateRoleReferences:closingCorporate.roleReferences,
  unreconciledCorporateRoleReferences:closingCorporate.roleReferences.filter(url=>!ids.has(url.match(/\/jobs\/(fk[a-z0-9]+)/)[1])),
  additionalEmployerHandoffs:[...new Set([...openingCorporate.additionalHandoffs,...closingCorporate.additionalHandoffs])],
  countryUnqualifiedRecords:rows.filter(row=>row.country!=='India'),closingFullNativeCriteriaReconciled:true,receipts:io.receipts,
  sourceScopeComplete:false,lifecycleCleanupAllowed:false}
 const allJobs=nativeModels.filter(({row})=>row.country==='India').map(({row,role})=>({source,company,companyDomain:'loginextsolutions.com',atsPlatform:'trakstar',
  jobId:row.id,requisitionId:row.id,title:row.title,sourceUrl:row.url,applyUrl:role.applyUrl,link:role.applyUrl,
  location:[row.city,row.state,row.country].filter(Boolean).join(', '),city:row.city,state:row.state,country:row.country,
  department:row.department,employmentType:row.employmentType,postingDate:role.model.datePosted,closingDate:role.model.validThrough??null,
  jobDescription:role.criteria,sourceDescription:role.criteria,nativeDescriptionHTML:role.descriptionHTML,sourceNativeJobPosting:role.model,
  sourceNativeCountryEvidence:{board:row.country,postalAddress:role.model.jobLocation.address.addressCountry,visibleRole:row.country},
  nativePublicationDateProvenance:'native-JobPosting-datePosted',companyCareerPage:corporate,scrapedAt:checkedAt,
  sourceDetailComplete:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false}))
 const jobs=maxJobs?allJobs.slice(0,maxJobs):allJobs
 attachInventoryEvidence(jobs,{status:'discovery-only',surface:board,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null,
  pagesFetched:io.receipts.length,verifiedAt:checkedAt,reason:'current-exact-employer-native-model-visible-full-criteria-and-two-closing-reads;corporate-legacy-roles-and-additional-handoffs-remain-unqualified'})
 attachSourceObservationEvidence(jobs,{source,recordKind:'vacancy-rows',observedRecordCount:rows.length,observedVacancyCount:rows.length,sourceScopeComplete:false})
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true});if(jobs.length)jobs[0].nativeCollectionEvidence=audit
 options.onAudit?.(audit);return jobs
}
