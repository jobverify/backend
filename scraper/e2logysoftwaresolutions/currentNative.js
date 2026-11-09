import {parse} from 'acorn'
import {createHash} from 'node:crypto'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {qualifiedFirstPartyHTML,clean,descendants,retained,nativeText,nativeLines,authoredNativeLines,comparable,exactlyOne,requireNative} from '../../scraper-support/native-sources/firstPartyNativeHtml.js'
import {nativeCountryName,nativeLocationCountryName,nativeDate} from '../../scraper-support/shared/nativeJobPosting.js'
export const CAREERS_URL='https://e2logy.com/careers',CANONICAL_URL='https://www.e2logy.com/careers'
const BRAND='E2logy Software Solutions Private Limited',TENANT='https://e2logy.zohorecruit.com'
const failure=message=>firstPartyFailure('e2logysoftwaresolutions',message),need=(ok,message)=>requireNative(ok,message,failure),one=(rows,label)=>exactlyOne(rows,label,failure)
export const isCurrentRoleURL=value=>{try{
 const url=new URL(value)
 return url.href===value&&url.origin===TENANT&&!url.username&&!url.password&&!url.hash&&/^\/jobs\/Careers\/\d{12,24}\/[A-Za-z0-9-]+$/.test(url.pathname)
  &&url.searchParams.getAll('source').length===1&&url.searchParams.get('source')==='CareerSite'&&[...url.searchParams.keys()].length===1
}catch{return false}}
export function extractCurrentListings(html){
 const page=qualifiedFirstPartyHTML(html,CANONICAL_URL,failure),doc=page.visible
 need(page.title==='Careers at E2logy | Join Our AI and Software Team','Current employer careers title changed')
 const scope=one(doc.nodes(node=>node.tag==='section'&&node.attrs.id==='positions'),'native current positions scope')
 need(retained(page.root,node=>node.attrs.id==='positions').length===1,'Retained positions scope is ambiguous')
 const cards=descendants(scope,node=>node.tag==='article')
 need(cards.length>0&&cards.length<=32,'Missing or excessive native vacancy cards')
 const urls=new Set()
 const result=cards.map(card=>{
  const title=clean(nativeText(one(descendants(card,node=>node.tag==='h3'),'native vacancy heading')))
  const link=one(descendants(card,node=>node.tag==='a'&&clean(nativeText(node))==='Apply now'),'native employer role link')
  const sourceUrl=link.attrs.href;need(isCurrentRoleURL(sourceUrl)&&!urls.has(sourceUrl),'Unbound or duplicate native employer role URL');urls.add(sourceUrl)
  const metadata=one(descendants(card,node=>node.tag==='div'&&node.children.filter(child=>typeof child!=='string'&&child.tag==='span').length===2),'native workplace/employment fields')
  const values=metadata.children.filter(child=>typeof child!=='string'&&child.tag==='span').map(node=>clean(nativeText(node)))
  need(values.length===2&&values.every(Boolean),'Native workplace/employment values missing')
  const department=card.children.find(node=>typeof node!=='string'&&node.tag==='span')
  need(department&&clean(nativeText(department)),'Native industry value unavailable')
  return {jobId:new URL(sourceUrl).pathname.split('/')[3],requisitionId:null,title,sourceUrl,applyUrl:sourceUrl,
   location:values[0],employmentType:values[1],country:nativeLocationCountryName(values[0]),department:clean(nativeText(department))}
 })
 const all=doc.nodes(node=>node.tag==='a'&&isCurrentRoleURL(node.attrs.href))
 need(all.length===cards.length&&all.every(node=>urls.has(node.attrs.href)),'Native employer role links outside the qualified card scope')
 return result
}
const literal=node=>{
 if(node?.type==='Literal'&&!node.regex&&typeof node.value!=='bigint')return node.value
 if(node?.type==='ArrayExpression'&&node.elements.every(Boolean))return node.elements.map(literal)
 if(node?.type==='ObjectExpression'){
  const names=new Set(),rows=[]
  for(const property of node.properties){
   need(property.type==='Property'&&!property.computed&&property.kind==='init'&&!property.method&&!property.shorthand,'Nonliteral native metadata property')
   const key=property.key.type==='Identifier'?property.key.name:property.key.value
   need(typeof key==='string'&&!names.has(key)&&!['__proto__','constructor','prototype'].includes(key),'Ambiguous native metadata key')
   names.add(key);rows.push([key,literal(property.value)])
  }return Object.fromEntries(rows)
 }throw failure('Nonliteral native metadata value')
}
const allNodes=node=>[node,...node.children.filter(child=>typeof child!=='string').flatMap(allNodes)]
const sha=value=>createHash('sha256').update(value).digest('hex')
// These five programs and the carrier structure were identical in both
// original roles and all four actual opening/closing role responses. A code
// change requires review; do not try to interpret arbitrary remote JavaScript.
const INLINE_PROGRAM_SHA256=[
 '9ca9fd935c85d2a1e5fd42d6bf83f0be088278a232d6d5d77c458ba096c1cecc',
 '21d75b390eafe069af969e64b88bb7625e3cf8edc1981b08434bc90dca5b05f7',
 'a564e2e9d8253aa6e08317f6ba6a9a6e9c8c687dc0010e769dbb4e3f28520195',
 '3d432e36401cc9bde326d9d3db94aa66fb5d67f6879885bf9a43a7ba844874e5',
 '487b16c46822cc2b7183244ba0a05c2794cce2873b9b4d2cbb8673ed0f4b226c'
]
function qualifiedZohoDataDocument(html){
 const raw=readNativeDocument(html),root=one(raw.nodes(node=>node.tag==='root'),'native document root')
 const elements=node=>node.children.filter(child=>typeof child!=='string')
 const document=one(elements(root).filter(node=>node.tag==='html'),'outer native HTML document')
 const head=one(elements(document).filter(node=>node.tag==='head'),'outer native head'),body=one(elements(document).filter(node=>node.tag==='body'),'outer native body')
 need(!head.inert&&!body.inert,'Native document is hidden or inert')
 // The exact original Zoho page embeds one old stylesheet document fragment
 // before its literal bootstrap. Chrome HTML5 parsing keeps one real head and
 // body. Its extra raw head contains only a UTF-8 declaration, no authority.
 const nested=one(elements(head).filter(node=>node.tag==='html'),'reviewed native stylesheet document fragment')
 const innerHead=one(elements(nested).filter(node=>node.tag==='head'),'stylesheet fragment head')
 const innerBody=one(elements(nested).filter(node=>node.tag==='body'),'stylesheet fragment body')
 need(!nested.inert&&!innerHead.inert&&!innerBody.inert&&[nested,innerHead,innerBody].every(node=>Object.keys(node.attrs).length===0),'Native stylesheet fragment attributes changed')
 const charset=one(elements(innerHead),'native fragment charset')
 need(charset.tag==='meta'&&JSON.stringify(charset.attrs)===JSON.stringify({charset:'UTF-8'}),'Alternate native fragment identity requires review')
 const fragmentElements=elements(innerBody)
 need(fragmentElements.length===2&&fragmentElements[0].tag==='script'&&fragmentElements[0].attrs.type==='text/javascript'
  &&fragmentElements[1].tag==='style','Native stylesheet fragment layout changed')
 const nodes=allNodes(root)
 need(nodes.filter(node=>node.tag==='html').length===2&&nodes.filter(node=>node.tag==='head').length===2&&nodes.filter(node=>node.tag==='body').length===2,'Additional native documents require review')
 need(!nodes.some(node=>node.tag==='base'),'Unreviewed document base')
 const title=one(nodes.filter(node=>node.tag==='title'),'retained native page title')
 const canonical=one(nodes.filter(node=>node.tag==='link'&&(node.attrs.rel??'').toLowerCase()==='canonical'),'retained native canonical')
 need(elements(head).includes(title)&&elements(head).includes(canonical),'Native title/canonical is outside the first owned head')
 const mount=one(nodes.filter(node=>node.attrs.id==='career-website-main'),'native career mount')
 need(mount.tag==='div'&&!mount.inert&&descendants(body,node=>node===mount).length===1,'Native career mount ownership changed')
 return {raw,root,head,body,title:clean(title.raw),canonical:canonical.attrs.href}
}
function originalNativeData(page){
 const declarations=allNodes(page.root).filter(node=>node.tag==='script')
 const declarationProfile=declarations.map(node=>({attrs:Object.fromEntries(Object.entries(node.attrs).sort(([a],[b])=>a.localeCompare(b))),inert:Boolean(node.inert)}))
 need(sha(JSON.stringify(declarationProfile))==='7ee717b715910c42f12efb0d5a77b17fa0201b74ba6f008089d155bbe037ef15','Native program declaration authority changed')
 // Count every inline script, including an unexpected MIME type or escaped
 // identifier. Hashes qualify authored bytes only; no program is executed.
 const scripts=declarations.filter(node=>!node.attrs.src)
 need(scripts.length===6&&INLINE_PROGRAM_SHA256.every((hash,index)=>sha(scripts[index].raw??'')===hash),'Unreviewed native inline program authority')
 const script=scripts[5]
 need(!script.inert&&page.head.children.includes(script),'Native data carrier is not active in the owned head')
 let ast;try{ast=parse(script.raw,{ecmaVersion:'latest',sourceType:'script'})}catch{throw failure('Unreviewed native data authority program syntax')}
 const declarator=(statement,index,name)=>{
  const row=ast.body[statement],node=row?.declarations?.[index]
  need(row?.type==='VariableDeclaration'&&row.kind==='var'&&node?.id.type==='Identifier'&&node.id.name===name,'Native data authority declaration structure changed')
  return node
 }
 const job=declarator(3,0,'jobs'),meta=declarator(8,0,'meta'),token=declarator(0,1,'csrfToken'),init=job.init
 need(init?.type==='CallExpression'&&!init.optional&&init.callee.type==='MemberExpression'&&!init.callee.computed
  &&init.callee.object.type==='Identifier'&&init.callee.object.name==='JSON'&&init.callee.property.type==='Identifier'&&init.callee.property.name==='parse'
  &&init.arguments.length===1&&init.arguments[0].type==='Literal'&&typeof init.arguments[0].value==='string','Native jobs is not one literal JSON data carrier')
 const employer=literal(meta.init)
 need(token.init?.type==='Literal'&&typeof token.init.value==='string','Native request token is not literal data')
 // Only three already-qualified literal initializers vary. Keep every other
 // name, operator, statement, property and literal in the reviewed AST. This
 // closes aliases, dynamic code and computed writes without simulating them.
 const masked=new Set([job,meta,token])
 const profile=JSON.stringify(ast,function(key,value){
  if(['start','end','raw'].includes(key))return undefined
  if(key==='init'&&masked.has(this))return {type:'ReviewedLiteralData',binding:this.id.name}
  return value
 })
 // The current anonymous response differs only in the form visitor-country
 // literal (GB -> IN), consumed by selectedCountry/mobileCountryCode. Keep
 // both exact reviewed programs; workplace country still comes from the role.
 const profileSHA=sha(profile)
 need(profileSHA==='1b0db916611d233b738e4cb4f29c5cf645da507a087a69eadc4392f04b0f2713'
  ||profileSHA==='8e95b677cf60159bc58ae60a7acaa052344f65d4a4dd8a145a9bcfeb2af8d9b7','Native data carrier authority structure changed')
 let jobs;try{jobs=JSON.parse(init.arguments[0].value)}catch{throw failure('Invalid native job JSON literal')}
 return {jobs,meta:employer}
}
export function extractCurrentDetail(html,listing){
 need(isCurrentRoleURL(listing.sourceUrl),'Unbound native employer role identity')
 const page=qualifiedZohoDataDocument(html),canonical=page.canonical
 let url;try{url=new URL(canonical)}catch{throw failure('Invalid native canonical declaration')}
 need(url.origin===TENANT&&url.pathname==='/recruit/ViewJob.na'&&!url.username&&!url.password&&!url.hash
  &&url.searchParams.getAll('digest').length===1&&url.searchParams.get('digest')&&url.searchParams.getAll('embedsource').length===1
  &&url.searchParams.get('embedsource')==='Google'&&[...url.searchParams.keys()].length===2,'Native canonical role shape changed')
 const {jobs,meta}=originalNativeData(page)
 need(Array.isArray(jobs)&&jobs.length===1,'Native role data cardinality changed')
 const record=jobs[0]
 need(record&&record.id===listing.jobId&&record.Posting_Title===listing.title,'Native job ID/title differs from corporate card')
 need(record.Publish===true&&record.Is_Locked===false,'Native role is unpublished or locked')
 need(meta.detail_url===listing.sourceUrl&&meta.list_url===TENANT+'/jobs/Careers'&&meta.page_name==='Careers'&&meta.source==='CareerSite'
  &&meta.employee_portal===false&&meta.portal_user?.is_loggedin===false,'Native role/board/public access binding changed')
 need(meta.org_info?.company_name===BRAND&&meta.org_info?.website==='https://e2logy.com'&&meta.org_info?.hide_company_name===false,'Native employer identity changed')
 need(page.title===BRAND+' - '+listing.title+' in '+record.City,'Native role document title differs from native job data')
 const country=nativeCountryName(record.Country),location=clean([record.City,record.Country].filter(Boolean).join(', '))
 need(location===listing.location&&country===listing.country&&record.Job_Type===listing.employmentType&&record.Industry===listing.department,'Native corporate/detail metadata conflict')
 need(country&&typeof record.Job_Description==='string'&&record.Job_Description.length>100,'Native country or full criteria unavailable')
 const descriptionRaw=readNativeDocument(record.Job_Description),rawRoot=one(descriptionRaw.nodes(node=>node.tag==='root'),'native original criteria root')
 need(!allNodes(rawRoot).some(node=>['script','style','template','iframe','object','embed','noscript'].includes(node.tag)),'Delegated or executable native criteria require review')
 const visible=readVisibleNativeDocument(record.Job_Description,{strict:true}),visibleRoot=one(visible.nodes(node=>node.tag==='root'),'native active criteria root')
 const lines=nativeLines(visibleRoot),authored=authoredNativeLines(rawRoot),description=lines.join('\n')
 need(comparable(description)===comparable(authored.join('\n')),'Native criteria content is hidden or incomplete')
 need(description.length>1000,'Native full description incomplete')
 const opened=nativeDate(record.Date_Opened,{required:true})
 return {jobId:record.id,requisitionId:null,title:record.Posting_Title,company:'E2logy Software Solutions',department:record.Industry,
  city:record.City,state:record.State??null,location,country,sourceCountryScopeUnresolved:false,sourceUrl:listing.sourceUrl,applyUrl:listing.sourceUrl,
  employmentType:record.Job_Type,workplaceType:null,experienceRequired:record.Work_Experience??null,minimumQualification:null,preferredQualification:null,requiredSkills:[],
  postingDate:null,closingDate:null,sourceClosingStatusVerified:false,firstEverPostedAt:null,nativeLegalEmployer:null,nativeDateOpened:opened.raw,
  jobDescription:description,sourceDescription:description,sourceDescriptionHTML:record.Job_Description,sourceDescriptionLines:lines,
  sourceNativeJobRecord:record,sourceNativeEmployerEvidence:{companyName:meta.org_info.company_name,website:meta.org_info.website,nativeOrganizationId:meta.org_info.id,
   nativeBoardURL:meta.list_url,nativeDetailURL:meta.detail_url,nativeCareerPageId:meta.page_id,nativeCanonicalURL:canonical,
   opaqueCanonicalRelationDecoded:false},
  sourceApplicationHandoff:{kind:'native-published-role-page',url:listing.sourceUrl,nativePostId:record.id,activationVerified:false},
  sourceCriteriaPresentation:'full-original-inline-native-job-record-as-data;rendered-application-activation-unverified',
  applicationVisited:false,sourceDetailComplete:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
}
