import {decodeXML,decodeHTML} from 'entities'
import {readFileSync} from 'node:fs'
import {parseExpressionAt} from 'acorn'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {need,roleID,sha,HOME,CAREERS,BOARD} from './nativeTransport.js'

const normalized=value=>String(value??'').replace(/\s+/g,' ').trim()
const exactKeys=(object,keys)=>Object.keys(object).length===keys.length&&keys.every(key=>Object.hasOwn(object,key))
const xmlText=value=>{
 need(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)&&!/&(?!(?:amp|lt|gt|quot|apos);|#(?:\d+|x[0-9a-fA-F]+);)/.test(value),'Unknown XML entity or control character')
 for(const match of value.matchAll(/&#(x[0-9a-fA-F]+|\d+);/g)){
  const point=match[1][0]==='x'?parseInt(match[1].slice(1),16):Number(match[1])
  need(Number.isSafeInteger(point)&&point>0&&point<=0x10ffff&&!(point>=0xd800&&point<=0xdfff)&&![0xfffe,0xffff].includes(point)
   &&(point>=0x20||[9,10,13].includes(point)),'Invalid XML character reference')
 }
 return decodeXML(value)
}
// This finite RSS2 grammar has no DTD, external entities, namespaces, arbitrary
// processing instructions or executable markup. CDATA remains original text.
function readRSSXML(source){
 need(typeof source==='string'&&source.length<=4*1024*1024&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(source),'Invalid native RSS body')
 let index=0,count=0
 const declaration=source.match(/^<\?xml version="1\.0" encoding="UTF-8"\?>/)
 need(declaration,'Unexpected native XML declaration');index=declaration[0].length
 const space=()=>{while(/[\t\r\n ]/.test(source[index]??'\0'))index++}
 const element=(depth=0)=>{
  need(depth<=4&&++count<=512,'Native XML nesting/count exceeded')
  const start=source.slice(index).match(/^<([A-Za-z][A-Za-z0-9]*)([^<>]*)>/)
  need(start&&!start[2].endsWith('/'),'Unsupported native XML element')
  const name=start[1],attributes={},tail=start[2];let consumed=0
  while(consumed<tail.length){
   const rest=tail.slice(consumed);if(/^\s*$/.test(rest)){consumed=tail.length;break}
   const attribute=rest.match(/^\s+([A-Za-z][A-Za-z0-9]*)=(?:"([^"<>]*)"|'([^'<>]*)')/)
   need(attribute&&!Object.hasOwn(attributes,attribute[1]),'Ambiguous native XML attribute')
   attributes[attribute[1]]=xmlText(attribute[2]??attribute[3]);consumed+=attribute[0].length
  }
  index+=start[0].length;let value='';const children=[]
  for(;;){
   need(index<source.length,'Incomplete native XML')
   if(source.startsWith('</',index)){const close=`</${name}>`;need(source.startsWith(close,index),'Mismatched native XML close');index+=close.length;break}
   if(source.startsWith('<![CDATA[',index)){const end=source.indexOf(']]>',index+9);need(end>=0,'Incomplete native XML CDATA');value+=source.slice(index+9,end);index=end+3;continue}
   if(source[index]==='<'){children.push(element(depth+1));continue}
   const end=source.indexOf('<',index);need(end>=0,'Incomplete native XML text');value+=xmlText(source.slice(index,end));index=end
  }
  return {name,attributes,value,children}
 }
 space();const root=element();space();need(index===source.length,'Trailing native XML content');return root
}
const leaf=node=>{need(node.children.length===0&&Object.keys(node.attributes).length===0,'Unexpected nested native RSS field');return node.value}
const single=(nodes,name)=>{const found=nodes.filter(node=>node.name===name);need(found.length===1,'Missing or duplicate native RSS '+name);return found[0]}
const parseNativeDate=value=>{
 const parts=value.match(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat), (\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{2}):(\d{2}):(\d{2}) (EDT|EST)$/)
 need(parts,'Unknown publisher RSS date syntax')
 const[,weekday,day,month,year,hour,minute,second,zone]=parts,number=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(month)
 const date=new Date(Date.UTC(Number(year),number,Number(day),Number(hour),Number(minute),Number(second)))
 need(date.getUTCFullYear()===Number(year)&&date.getUTCMonth()===number&&date.getUTCDate()===Number(day)&&Number(hour)<24&&Number(minute)<60&&Number(second)<60
  &&['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getUTCDay()]===weekday,'Invalid publisher RSS calendar date')
 return {calendar:`${year}-${String(number+1).padStart(2,'0')}-${day}`,raw:value,timezone:zone}
}
export function readBiltRSS(source){
 const xml=readRSSXML(source)
 need(xml.name==='rss'&&exactKeys(xml.attributes,['version'])&&xml.attributes.version==='2.0'&&!normalized(xml.value)&&xml.children.length===1,'Unexpected native RSS root')
 const channel=xml.children[0],fields=['title','link','description','language','pubDate','lastBuildDate','generator'],rowFields=['title','link','guid','description','pubDate']
 need(channel.name==='channel'&&Object.keys(channel.attributes).length===0&&!normalized(channel.value)&&channel.children.every(child=>fields.includes(child.name)||child.name==='item'),'Unexpected native RSS channel')
 const metadata=Object.fromEntries(fields.map(name=>[name,leaf(single(channel.children,name))]))
 need(metadata.title==='BILT Inc. Jobs'&&['https://j.brt.mv/CompanyPortal.do?companyGK=46774&portalGK=37115','https://ejob.bz/CompanyPortal.do?companyGK=46774&portalGK=37115'].includes(metadata.link)
  &&metadata.description==='Job Postings available for application.'&&metadata.language==='en-us'&&metadata.generator==='BrightMove ATS','Native RSS employer/tenant declaration changed')
 parseNativeDate(metadata.pubDate);parseNativeDate(metadata.lastBuildDate)
 const items=channel.children.filter(child=>child.name==='item'),seen=new Set(),guids=new Set()
 need(items.length>0&&items.length<=20,'Native RSS is empty or exceeds full-detail budget')
 const rows=items.map(item=>{
  need(Object.keys(item.attributes).length===0&&!normalized(item.value)&&item.children.length===rowFields.length&&item.children.every(child=>rowFields.includes(child.name)),'Unhandled native RSS row fields')
  const row=Object.fromEntries(rowFields.map(name=>[name,leaf(single(item.children,name))])),id=roleID(row.link)
  need(id&&new URL(row.link).origin===new URL(metadata.link).origin&&!seen.has(id)&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(row.guid)&&!guids.has(row.guid),'Missing, duplicated or unbound native RSS identity')
  need(row.title===normalized(row.title)&&row.title.length>3&&row.description.length>=100,'Native RSS title/criteria unavailable')
  seen.add(id);guids.add(row.guid)
  return {...row,id,publication:parseNativeDate(row.pubDate)}
 })
 return {metadata,rows,originalXML:source,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null}
}

const profile=JSON.parse(readFileSync(new URL('./nativeProfile20261107.json',import.meta.url),'utf8'))
const all=node=>[node,...node.children.filter(value=>typeof value!=='string').flatMap(all)]
const one=(rows,label)=>{need(rows.length===1,'Missing or ambiguous '+label);return rows[0]}
const fieldsEqual=(left,right)=>JSON.stringify(left)===JSON.stringify(right)
const text=node=>node.inert||['script','style'].includes(node.tag)?'':normalized(node.children.map(child=>typeof child==='string'?decodeHTML(child):text(child)).join(' '))
// Hidden ordinary markup is still authored content. It cannot silently remove
// a qualification or a competing worksite from the retained native model.
const authoredText=node=>['script','style','iframe','noembed','noframes','xmp','plaintext'].includes(node.tag)?'':normalized(node.children.map(child=>typeof child==='string'?decodeHTML(child):authoredText(child)).join(' '))
const authorityName=value=>/country|address|employer|company|organization|organisation|hiring/i.test(value)
const structureAttributes=attributes=>Object.fromEntries(Object.entries(attributes).filter(([name,value])=>!(authorityName(name)&&value==='')))
const ownedStructure=(node,description)=>({tag:node.tag,attributes:structureAttributes(node.attrs),inert:node.inert,
 ...(node.raw===undefined?{}:{raw:node.raw}),children:node===description?['BOUND_NATIVE_CRITERIA']:node.children.map(child=>typeof child==='string'?(normalized(decodeHTML(child))?'TEXT_SLOT':''):ownedStructure(child,description))})
const noCompetingAuthority=node=>{
 for(const item of all(node))for(const [name,value]of Object.entries(item.attrs)){
  need(!(authorityName(name)&&value!=='')&&!(['name','property','itemprop','itemtype'].includes(name)&&authorityName(value)),'Unreviewed own-role country/address/employer carrier')
 }
}
const active=(node,label)=>{need(!node.inert,'Hidden or inert '+label);return node}
function pageTree(html,canonical,{native=false,nativeOrigin='https://j.brt.mv'}={}){
 const doc=readNativeDocument(html),root=one(doc.nodes(node=>node.tag==='root'),'retained document root'),nodes=all(root)
 const document=one(root.children.filter(node=>typeof node!=='string'&&node.tag==='html'),'outer native document')
 const head=one(document.children.filter(node=>typeof node!=='string'&&node.tag==='head'),'owned document head'),body=one(document.children.filter(node=>typeof node!=='string'&&node.tag==='body'),'owned document body')
 need(document.children.includes(head)&&document.children.includes(body)&&!head.inert&&!body.inert,'Native head/body ownership changed')
 let frame=null
 if(native){
  need(nodes.filter(node=>node.tag==='html').length===2&&nodes.filter(node=>node.tag==='head').length===2&&nodes.filter(node=>node.tag==='body').length===2,'Unreviewed publisher template document count')
  frame=active(one(nodes.filter(node=>['portalMain','portalViewRequirement'].includes(node.attrs.id)),'owned publisher template frame'),'publisher template frame')
  need(all(body).includes(frame),'Publisher template outside owned body')
  const fragment=one(frame.children.filter(node=>typeof node!=='string'&&node.tag==='html'),'publisher template fragment')
  const innerHead=one(fragment.children.filter(node=>typeof node!=='string'&&node.tag==='head'),'publisher fragment head'),innerBody=one(fragment.children.filter(node=>typeof node!=='string'&&node.tag==='body'),'publisher fragment body')
  need([fragment,innerHead,innerBody].every(node=>!node.inert&&Object.keys(node.attrs).length===0),'Publisher template fragment attributes changed')
  const children=innerHead.children.filter(node=>typeof node!=='string')
  need(children.length===2&&children[0].tag==='script'&&fieldsEqual(children[0].attrs,{src:'https://s7.addthis.com/js/300/addthis_widget.js#pubid=brightmove&async=1',type:'text/javascript'})
   &&children[1].tag==='style'&&sha(children[1].raw??'')===profile.inlineStyles[0].sha256,'Publisher fragment authority changed')
 }else need(nodes.filter(node=>node.tag==='html').length===1&&nodes.filter(node=>node.tag==='head').length===1&&nodes.filter(node=>node.tag==='body').length===1,'Unexpected corporate nested documents')
 const title=one(nodes.filter(node=>node.tag==='title'&&head.children.includes(node)),'owned head title')
 const link=one(nodes.filter(node=>node.tag==='link'&&node.attrs.rel==='canonical'),'retained canonical')
 need(head.children.includes(link)&&!link.inert&&link.attrs.href===canonical,'Native canonical changed')
 const bases=nodes.filter(node=>node.tag==='base')
 need(native?bases.length===1&&bases[0].attrs.href===nativeOrigin+':443/'&&head.children.includes(bases[0])&&!bases[0].inert:bases.length===0,'Unreviewed native base')
 return {doc,root,nodes,head,body,frame,title:decodeHTML(title.raw??'')}
}
export function readBiltCorporate(html,url){
 need(url===HOME||url===CAREERS,'Unbound configured corporate surface')
 const page=pageTree(html,url),links=page.nodes.filter(node=>node.tag==='a'&&!node.inert)
 if(url===HOME){
  need(page.title==='3D Work Instructions for Assembly, Service & Repair | BILT','Configured homepage identity changed')
  need(links.some(node=>node.attrs.href===CAREERS),'Own careers delegation unavailable')
  return {url,title:page.title,careerURL:CAREERS,configuredBrand:'BILT',legalEmployerVerified:false}
 }
 need(page.title==='Careers - BILT Inc.'&&page.doc.nodes(node=>node.tag==='h1').some(node=>text(node)==='Careers at BILT'),'Corporate careers identity changed')
 const handoff=one(links.filter(node=>node.attrs.href===BOARD&&text(node)==='View Jobs'),'corporate native handoff')
 need(all(page.body).includes(handoff),'Careers handoff outside own body')
 return {url,title:page.title,heading:'Careers at BILT',boardURL:BOARD,configuredBrand:'BILT',legalEmployerVerified:false}
}
export function readBiltBoard(html){
 const page=pageTree(html,'https://portal.brightmove.com/ax.do?portalGK=37115',{native:true})
 need(page.title==='BILT Inc. Jobs','Native board employer changed')
 const feedLinks=page.doc.nodes(node=>node.tag==='a'&&node.attrs.href==='JobRSS.do?companyGK=46774&portalGK=37115')
 need(feedLinks.length===1&&page.doc.nodes(node=>node.tag==='a'&&node.attrs.href==='https://biltapp.com/').length===1,'Native tenant/reciprocal brand delegation changed')
 const tables=page.doc.nodes(node=>node.tag==='table'&&page.doc.hasClass(node,'BMDataGrid')),table=one(tables,'native vacancy table')
 need(page.doc.nodes(node=>/^h[1-6]$/.test(node.tag)&&text(node)==='All Open Jobs').length===1,'Native open-vacancy label unavailable')
 const rows=page.doc.nodes(node=>node.tag==='tr'&&page.doc.hasClass(node,'BMData'),table).map(node=>{
  const anchor=one(page.doc.nodes(item=>item.tag==='a',node),'own native board role'),match=anchor.attrs.href?.match(/^PortalViewRequirement\.do\?reqGK=([1-9]\d{5,11})$/),id=match?.[1]
  need(id&&text(anchor)&&anchor.attrs.title===`All Open Jobs - ${text(anchor)} (${id})`,'Native board role identity unavailable')
  return {id,declaredURL:new URL(anchor.attrs.href,BOARD).href,title:text(anchor),rowText:text(node),rawAttributes:node.attrs}
 })
 need(rows.length>0&&rows.length<=20&&new Set(rows.map(row=>row.id)).size===rows.length,'Native board count/duplicate identity changed')
 return {rows,title:page.title,declaredCanonical:'https://portal.brightmove.com/ax.do?portalGK=37115',nativeBrand:'BILT Inc.',reciprocalBrandURL:'https://biltapp.com/',companyGlobalTotal:null,companyIndiaTotal:null}
}
const supplemental=html=>{
 const doc=readNativeDocument(html),root=one(doc.nodes(node=>node.tag==='root'),'supplemental content root')
 return all(root).filter(node=>node.nativeTagUnqualified||['a','img','object','iframe','embed','script','template','noscript'].includes(node.tag))
  .map(node=>({tag:node.tag,attributes:node.attrs,raw:node.raw??null,inert:node.inert}))
}
const fragmentText=html=>{const doc=readNativeDocument(html);return text(one(doc.nodes(node=>node.tag==='root'),'criteria root'))}
const treeChildren=children=>{
 const values=[...children]
 while(typeof values[0]==='string'&&!values[0].trim())values.shift()
 while(typeof values.at(-1)==='string'&&!values.at(-1).trim())values.pop()
 return projectChildren(values)
}
const projectChildren=children=>children.map(value=>typeof value==='string'?value:{tag:value.tag,attributes:value.attrs,inert:value.inert,
 ...(value.raw===undefined?{}:{raw:value.raw}),children:projectChildren(value.children)})
function jsonData(raw){
 const value=JSON.parse(raw),ast=parseExpressionAt(raw,0,{ecmaVersion:'latest'})
 need(raw.slice(ast.end).trim()==='','Trailing native JSON data')
 const visit=node=>{
  if(!node||typeof node!=='object')return
  if(node.type==='ObjectExpression'){
   const names=new Set()
   for(const property of node.properties){const key=property.key?.value;need(property.type==='Property'&&!property.computed&&typeof key==='string'&&!names.has(key),'Duplicate native JSON authority key');names.add(key)}
  }
  for(const child of Object.values(node))if(Array.isArray(child))child.forEach(visit);else if(child&&typeof child==='object')visit(child)
 };visit(ast);return value
}
function reviewedPrograms(page,row,schema){
 const scripts=page.nodes.filter(node=>node.tag==='script')
 need(fieldsEqual(scripts.map(node=>({attributes:node.attrs,inert:node.inert})),profile.scriptDeclarations),'Unreviewed native script declarations')
 for(const fixed of profile.inlineFixed)need(sha(scripts[fixed.index].raw??'')===fixed.sha256,'Unreviewed inline program')
 need([row.id,row.title,schema.title].every(value=>!/[\u0000-\u001f'\\\u2028\u2029]/.test(value)),'Unreviewed native literal serialization')
 const expectedID=profile.reqGKProgram.replace("'27786539'",`'${row.id}'`)
 const expectedShare=profile.shareProgram.replace('reqGK=27786539',`reqGK=${row.id}`)
  .replace("a2a_config.title = 'Principal Machine Learning Engineer'",`a2a_config.title = '${schema.title}'`)
  .replace("a2a_config.linknote = 'BILT Inc. - Principal Machine Learning Engineer - GRAPEVINE, TX'",`a2a_config.linknote = 'BILT Inc. - ${row.title}'`)
 need(scripts[13].raw===expectedID&&scripts[16].raw===expectedShare,'Native own-role program identity changed')
 need(fieldsEqual(page.nodes.filter(node=>node.tag==='style').map(node=>({attributes:node.attrs,sha256:sha(node.raw??'')})),profile.inlineStyles),'Unreviewed native inline style')
 return {inlineProgramsMatched:true,externalScriptDeclarations:scripts.filter(node=>node.attrs.src).map(node=>node.attrs.src),externalProgramBodiesReviewed:false,publisherProgramsExecuted:false}
}
export function readBiltRole(html,row){
 need(roleID(row.link)===row.id,'Unbound role detail')
 const canonical=`https://portal.brightmove.com/jb.do?reqGK=${row.id}&companyGK=46774&portalGK=37115`,page=pageTree(html,canonical,{native:true,nativeOrigin:new URL(row.link).origin})
 const carrier=one(page.nodes.filter(node=>node.tag==='script'&&node.attrs.type==='application/ld+json'),'retained native JobPosting')
 need(page.frame.children.includes(carrier)&&!carrier.inert,'Native schema authority changed')
 const schema=jsonData(carrier.raw),schemaKeys=['@context','@type','title','description','identifier','datePosted','employmentType','hiringOrganization','jobLocation','skills','industry']
 need(exactKeys(schema,schemaKeys)&&schema['@context']==='http://schema.org/'&&schema['@type']==='JobPosting','Unknown native JobPosting fields')
 need(normalized(page.title)===row.title,'Native head role identity changed')
 need(fieldsEqual(schema.identifier,{'@type':'PropertyValue',name:'BILT Inc.',value:row.id})
  &&fieldsEqual(schema.hiringOrganization,{'@type':'Organization',name:'BILT Inc.',sameAs:'https://biltapp.com'}),'Native own identity/employer changed')
 need(exactKeys(schema.jobLocation,['@type','address'])&&schema.jobLocation['@type']==='Place','Unreviewed native worksite')
 const address=schema.jobLocation.address
 need(exactKeys(address,['@type','addressLocality','addressRegion','postalCode','addressCountry'])&&address['@type']==='PostalAddress'
  &&Object.values(address).every(value=>typeof value==='string'&&value.trim()===value&&value.length>0),'Unknown native address fields')
 const country=nativeCountryName(address.addressCountry)
 need(country&&schema.title&&row.title===`${schema.title} - ${address.addressLocality}, ${address.addressRegion}`,'Native country/title/worksite disagrees')
 need(schema.datePosted===row.publication.calendar&&schema.employmentType==='FULL_TIME'&&typeof schema.skills==='string'&&typeof schema.industry==='string','Native publication/employment fields disagree')
 const container=active(one(page.nodes.filter(node=>node.attrs.id==='portal_container'),'retained own role container'),'own role container')
 need(page.doc.hasClass(container,'bmportalrequirementdetails')&&page.doc.nodes(node=>node.tag==='h2',container).length===1
  &&text(page.doc.nodes(node=>node.tag==='h2',container)[0])===schema.title,'Own role title changed')
 const fieldNodes=page.doc.nodes(node=>node.tag==='dl',container),generalInformation=[];let description
 for(const node of fieldNodes){
  const label=text(one(page.doc.nodes(child=>child.tag==='dt',node),'native field label')),value=one(page.doc.nodes(child=>child.tag==='dd',node),'native field value')
  need(!generalInformation.some(field=>field.label===label)&&['Job Title','Job ID','Work Hybrid','Location','Other Location','Description'].includes(label),'Unknown/duplicate own role field')
  if(label==='Description'){need(!description,'Duplicate native description');description=value}else generalInformation.push({label,value:text(value)})
 }
 const information=Object.fromEntries(generalInformation.map(field=>[field.label,field.value]))
 need(description&&information['Job Title']===schema.title&&information['Job ID']===row.id&&information['Other Location']===''
  &&(!Object.hasOwn(information,'Work Hybrid')||information['Work Hybrid']==='Yes'),'Native own role fields changed')
 const location=`${address.addressLocality}, ${address.addressRegion}, ${address.postalCode}`+(information['Work Hybrid']==='Yes'?' Hybrid':'')
 need(information.Location===location,'Native general/schema worksite disagreement')
 need(typeof schema.description==='string'&&schema.description.length>=100&&html.split(schema.description).length===2,'Native full criteria missing/ambiguous')
 const criteriaText=fragmentText(schema.description)
 need(criteriaText.length>=100&&text(description)===criteriaText&&fragmentText(row.description)===criteriaText,'Native full criteria carriers disagree')
 const descriptionRoot=one(readNativeDocument(schema.description).nodes(node=>node.tag==='root'),'full schema criteria root')
 const rssDescriptionRoot=one(readNativeDocument(row.description).nodes(node=>node.tag==='root'),'full RSS criteria root')
 need(authoredText(description)===criteriaText&&authoredText(descriptionRoot)===criteriaText&&authoredText(rssDescriptionRoot)===criteriaText,'Unreviewed hidden native criteria')
 need(fieldsEqual(treeChildren(description.children),treeChildren(descriptionRoot.children)),'Native criteria DOM tree/attributes disagree')
 need(profile.rssSupplementalCarriers.some(value=>fieldsEqual(value,supplemental(row.description)))
  &&profile.criteriaSupplementalCarriers.some(value=>fieldsEqual(value,supplemental(schema.description))),'Unknown native supplemental criteria carrier')
 const custom=one(page.nodes.filter(node=>node.attrs.id==='custom_content_req'),'native custom criteria carrier')
 need(!authoredText(custom),'Unreviewed nonempty native custom criteria')
 noCompetingAuthority(container);noCompetingAuthority(custom)
 const ownText=[schema.title,...fieldNodes.flatMap(node=>{
  const label=text(one(page.doc.nodes(child=>child.tag==='dt',node),'native field label'))
  return [label,label==='Description'?criteriaText:information[label]]
 })].join(' ')
 need(authoredText(container)===normalized(ownText),'Unreviewed additional own-role criteria')
 need(profile.roleOwnedStructures.some(value=>fieldsEqual(value,ownedStructure(container,description)))
  &&profile.customOwnedStructures.some(value=>fieldsEqual(value,ownedStructure(custom))),'Unreviewed own-role/custom criteria structure')
 const portal=active(one(page.nodes.filter(node=>node.attrs.id==='bm-portal'),'owned native portal'),'native portal')
 need(all(portal).includes(container),'Own role container outside native portal')
 const forms=page.nodes.filter(node=>node.tag==='form'&&['PortalApplyForm','LoginForm'].includes(node.attrs.name))
 need(forms.length===2,'Native public application declaration unavailable')
 for(const [name,path]of [['PortalApplyForm','PortalApply'],['LoginForm','PortalLogin']]){
  const form=one(forms.filter(node=>node.attrs.name===name),'bound public application declaration')
  need(!form.inert&&all(portal).includes(form),'Public application declaration outside native portal')
  need(form.attrs.method==='post'&&new RegExp(`^/${path}\\.do;jsessionid=[A-F0-9]{32}$`).test(form.attrs.action??''),'Unreviewed public application declaration')
  const hidden=page.doc.nodes(node=>node.tag==='input'&&node.attrs.type==='hidden',form)
  need(hidden.length===1&&hidden[0].attrs.name==='reqGK'&&hidden[0].attrs.value===row.id,'Public application role ID disagreement')
 }
 return {id:row.id,url:row.link,title:schema.title,country,countryLiteral:address.addressCountry,countryBasis:'own-role JobPosting PostalAddress.addressCountry',postingDate:schema.datePosted,publication:row.publication,
  city:address.addressLocality,state:address.addressRegion,postalCode:address.postalCode,employmentType:schema.employmentType,workplaceType:information['Work Hybrid']==='Yes'?'Hybrid':null,
  sourceNativeEmployer:schema.hiringOrganization,legalEmployerVerified:false,configuredSourceBrand:'BILT',generalInformation,schema,rssItem:row,
  fullCriteriaHTML:schema.description,fullCriteriaText:criteriaText,declaredCanonical:canonical,publicApplicationDeclarationRoleIDs:forms.map(()=>row.id),applicationAcceptanceVerified:false,
  serverPublishedModel:true,clientProof:reviewedPrograms(page,row,schema),sourceScopeComplete:false,lifecycleCleanupAllowed:false,complete:true}
}
