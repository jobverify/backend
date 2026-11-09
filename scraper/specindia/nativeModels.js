import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {readNativeDocument,activeHead,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'

export const SOURCE='specindia',COMPANY='SPEC INDIA'
export const ENTRY='https://www.spec-india.com/career/',PRIMARY='https://www.spec-india.com/about/career',BOARD='https://www.spec-india.com/current-opening',AJAX='https://www.spec-india.com/wp-admin/admin-ajax.php'
export const sha=value=>createHash('sha256').update(value).digest('hex')
export const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
export const need=(value,message)=>{if(!value)throw Object.assign(Error('SPEC native: '+message),{abortRetries:true})}
const has=(n,c)=>(n.attrs.class||'').split(/\s+/).includes(c)
const walk=n=>[n,...n.children.filter(c=>typeof c!=='string').flatMap(walk)]
const one=(values,label)=>{need(values.length===1,'one '+label+' required');return values[0]}
const rawText=n=>typeof n==='string'?decodeNativeEntities(n):n.children.map(rawText).join(' ')
export const whole=n=>typeof n==='string'?n:{tag:n.tag,attrs:{...n.attrs},children:n.children.map(whole),...(n.raw===undefined?{}:{raw:n.raw})}
const parentsOf=root=>{const map=new Map();for(const n of walk(root))for(const c of n.children.filter(c=>typeof c!=='string'))map.set(c,n);return map}
const ancestors=(n,parents)=>{const result=[];for(let p=parents.get(n);p;p=parents.get(p))result.push(p);return result}
const geo=nodes=>nodes.flatMap(n=>Object.entries(n.attrs).filter(([k,v])=>/^(?:data-)?(?:country|work-country|job-country|address-country|location|work-location|workplace|city|address-locality|address-region|region)$/i.test(k)||['itemprop','property','name'].includes(k)&&/(?:^|[:/#\s])(?:addressCountry|jobLocation|workLocation|country|workplace)(?:$|\s)/i.test(v)).map(([attribute,value])=>({tag:n.tag,attribute,value})))
const employers=(nodes,d)=>nodes.flatMap(n=>Object.entries(n.attrs).flatMap(([attribute,value])=>/^(?:data-)?(?:employer|hiring-organization|company-name)$/i.test(attribute)?[{tag:n.tag,attribute,value}]:['itemprop','property','name'].includes(attribute)&&/(?:^|[:/#\s])(?:hiringOrganization|employer)(?:$|\s)/i.test(value)?[{tag:n.tag,attribute,value:n.attrs.content??n.attrs.value??d.text(n)}]:[]))
const declarations=(nodes,d)=>nodes.flatMap(n=>{const value=d.text(n),m=/^(Country|Work Country|Job Country|Country of Employment|Work assignment|Workplace assignment|Mandatory work assignment|Mandatory assignment|Employer|Hiring Organization|Company)\s*(?::|[-\u2013\u2014])\s*(.+)$/i.exec(value);return m?[{label:m[1],value:m[2]}]:[]})
const protectedEmail=hex=>{need(/^(?:[a-f0-9]{2}){3,321}$/i.test(hex),'unreviewed protected email');const b=Buffer.from(hex,'hex'),decoded=Buffer.from(b.subarray(1).map(v=>v^b[0]));need(/^[^\s@]+@[a-z0-9.-]+$/i.test(new TextDecoder('utf-8',{fatal:true}).decode(decoded)),'invalid protected email');return sha(decoded)}
export const comparable=model=>{if(model===null||typeof model!=='object')return model;if(Array.isArray(model))return model.map(comparable);if(typeof model.tag!=='string'||!model.attrs||!Array.isArray(model.children))return Object.fromEntries(Object.entries(model).map(([k,v])=>[k,comparable(v)]));const attrs={...model.attrs};if(attrs['data-cfemail']!==undefined)attrs['data-cfemail']='decoded-byte-sha256:'+protectedEmail(attrs['data-cfemail']);if(model.tag==='a'&&attrs.href?.startsWith('/cdn-cgi/l/email-protection#'))attrs.href='protected-email-byte-sha256:'+protectedEmail(attrs.href.slice('/cdn-cgi/l/email-protection#'.length));return{...model,attrs,children:model.children.map(comparable)}}
export const roleURL=value=>{let u;try{u=new URL(value)}catch{}need(u?.origin==='https://www.spec-india.com'&&!u.username&&!u.password&&!u.search&&!u.hash&&/^\/current-opening\/[a-z0-9-]+$/.test(u.pathname),'unreviewed own role URL');return u.href}
const officeIcon=n=>n.tag==='img'&&['call','mail'].some(kind=>n.attrs.src==='https://www.spec-india.com/wp-content/themes/specindia-child/assets/images/'+kind+'_icon.svg'&&n.attrs.alt===kind+' icon')
const officeFallback=n=>{if(n.tag!=='noscript'||typeof n.raw!=='string')return false;const parsed=readNativeDocument(n.raw),roots=parsed.nodes(n=>n.tag==='root');if(roots.length!==1)return false;const children=roots[0].children.filter(c=>typeof c!=='string'||c.trim());return children.length===1&&typeof children[0]!=='string'&&officeIcon(children[0])&&Object.keys(children[0].attrs).sort().join(',')==='alt,src'}
const readable=(d,v,node,label,{officeIcons=false}={})=>{const visible=v.nodes(n=>n.tag===node.tag&&JSON.stringify(n.attrs)===JSON.stringify(node.attrs)).filter(n=>v.text(n)===d.text(node));need(visible.length>0&&norm(rawText(node))===d.text(node),'unreadable or hidden '+label);need(!walk(node).some(n=>['script','style','iframe','object','embed','img','form','input','textarea','template','noscript'].includes(n.tag)&&!(officeIcons&&(officeIcon(n)||officeFallback(n)))),'delegated or unreadable '+label)}
function document(html){need(typeof html==='string'&&Buffer.byteLength(html)<=4000000,'bounded whole HTML required');const d=readNativeDocument(html),v=readVisibleNativeDocument(html,{strict:true}),root=one(d.nodes(n=>n.tag==='root'),'native root');return{d,v,root,parents:parentsOf(root),head:activeHead(html)}}

function officeContext(context){
 const{d,v,root,parents}=context,containers=d.nodes(n=>n.tag==='div'&&has(n,'get-in-touch-right')),container=one(containers,'whole own office context'),cards=walk(container).filter(n=>n.tag==='div'&&has(n,'footer_addres'))
 need(cards.length===2,'native own office inventory changed')
 const india=one(cards.filter(n=>walk(n).some(c=>c.tag==='h3'&&d.text(c)==='India')),'explicit own India office')
 readable(d,v,india,'own office country card',{officeIcons:true})
 const address=one(india.children.filter(n=>typeof n!=='string'&&n.tag==='p'),'whole own office address'),text=d.text(address),match=/^SPEC House, Parth Complex, Near Swastik Cross Roads, Navarangpura, ([^,]+?)\s+(\d{6}), INDIA\.$/.exec(text)
 need(match&&match[1]==='Ahmedabad','own explicit India office/address changed')
 const nativeGeographyMetadata=geo([...walk(india),...ancestors(india,parents)]),labels=declarations(walk(india),d)
 need(!nativeGeographyMetadata.length&&labels.every(l=>/country/i.test(l.label)&&l.value==='India'),'unreviewed or contradictory office country/assignment metadata')
 const model=whole(container)
 return{countryHeading:'India',country:'India',cityLabel:match[1],postalLabel:match[2],address:text,wholeCard:whole(india),wholeContext:model,reconciledWholeContext:comparable(model),nativeGeographyMetadata,nativeCountryLabels:labels,cityDictionaryUsed:false,exactCampusEstablished:false}
}
function nativeSchema(context){
 const models=context.d.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>{let model,ast;try{model=JSON.parse(n.raw);ast=parse('('+n.raw+')',{ecmaVersion:'latest'})}catch{need(false,'malformed or duplicate native structured metadata')};astWalk(ast,node=>{if(node.type==='ObjectExpression'){const keys=node.properties.map(p=>String(p.key.name??p.key.value));need(new Set(keys).size===keys.length,'duplicate native structured metadata key')}});const check=value=>{if(!value||typeof value!=='object')return;const types=Array.isArray(value['@type'])?value['@type']:[value['@type']];need(!types.some(type=>typeof type==='string'&&/(?:^|[:/#])JobPosting$/i.test(type)),'unreviewed parallel native JobPosting');for(const item of Object.values(value))if(Array.isArray(item))item.forEach(check);else check(item)};check(model);return{attrs:{...n.attrs},raw:n.raw,model}})
 return models
}
export function readPublisher(html,kind){
 const context=document(html),{d,head}=context,expected=kind==='primary'?'Join Our Team | SPEC INDIA':'Current Opening | SPEC INDIA'
 need(head.titles.length===1&&head.titles[0]===expected,'publisher head identity changed')
 const office=officeContext(context),schemas=nativeSchema(context),links=d.nodes(n=>n.tag==='a'&&n.attrs.href),featured=[...new Set(links.map(n=>n.attrs.href).filter(u=>/^https:\/\/www\.spec-india\.com\/current-opening\/[a-z0-9-]+$/.test(u)))]
 if(kind==='primary')need(links.some(n=>n.attrs.href===BOARD),'current primary must declare its exact own inventory')
 return{...context,office,schemas,featured,originalHTML:html,bodySHA256:sha(html)}
}

const astWalk=(n,visit)=>{if(!n||typeof n!=='object')return;visit(n);for(const v of Object.values(n))if(Array.isArray(v))v.forEach(c=>astWalk(c,visit));else if(v&&typeof v==='object')astWalk(v,visit)}
const properties=n=>{need(n?.type==='ObjectExpression','literal native request object required');const result={};for(const p of n.properties){need(p.type==='Property'&&!p.computed&&p.kind==='init','literal native request property required');const key=p.key.name??p.key.value;need(typeof key==='string'&&!Object.hasOwn(result,key),'duplicate native request property');result[key]=p.value}return result}
const literal=n=>{need(n?.type==='Literal'&&typeof n.value==='string','literal native request string required');return n.value}
export function readInventoryContract(board){
 const programs=board.d.nodes(n=>n.tag==='script'&&n.attrs.type==='text/rocketlazyloadscript'&&n.raw.includes("'task': 'ready_co'")),program=one(programs,'native loading program'),calls=[];let ast
 try{ast=parse(program.raw,{ecmaVersion:'latest'})}catch{need(false,'unreadable native loading program')}
 astWalk(ast,n=>{if(n.type==='CallExpression'&&n.callee?.type==='MemberExpression'&&n.callee.object?.name==='jQuery'&&n.callee.property?.name==='ajax')calls.push(n)})
 need(calls.length===4,'native loading/search program changed')
 const requests=calls.map(n=>properties(n.arguments[0]))
 for(const request of requests)need(literal(request.type)==='POST'&&literal(request.url)===AJAX&&literal(request.dataType)==='html','native loading request route changed')
 const opening=Object.fromEntries(Object.entries(properties(requests[0].data)).map(([k,v])=>[k,literal(v)])),next=properties(requests[1].data)
 need(JSON.stringify(opening)===JSON.stringify({action:'get_ajax_posts',post_type:'current-opening',task:'ready_co'}),'unreviewed initial native read-only inventory fields')
 need(Object.keys(next).sort().join(',')==='action,copage,post_type,task'&&literal(next.action)==='get_ajax_posts'&&literal(next.post_type)==='current-opening'&&literal(next.task)==='ready_co'&&next.copage.type==='Identifier'&&next.copage.name==='rcopage','unreviewed native next-page request')
 // Keep the complete authored program as data. A changed renderer is held
 // rather than executing or approximating arbitrary publisher programs.
 const supportedSHA='32b878f124e38058582433f8505893efc0f59e7a5c4b768496d3dd9983709028'
 need(sha(program.raw)===supportedSHA,'native loading/rendering program changed; review before reading')
 return{url:AJAX,method:'POST',opening,nextPageStart:2,wholeNativeProgram:program.raw,programSHA256:sha(program.raw),supportedSHA,publisherProgramsExecuted:false,initialSSRInventoryClaimed:false,terminalPageSize:6}
}
export function inventoryBody(page=1){need(Number.isSafeInteger(page)&&page>=1&&page<=8,'bounded native inventory page required');return new URLSearchParams(page===1?{action:'get_ajax_posts',post_type:'current-opening',task:'ready_co'}:{action:'get_ajax_posts',post_type:'current-opening',copage:String(page),task:'ready_co'}).toString()}
export function readInventory(html,page){
 const context=document(html),{d,v,root,parents}=context,cards=walk(root).filter(n=>n.tag==='div'&&has(n,'loadMoreRepeat')),counter=one(walk(root).filter(n=>n.tag==='span'&&has(n,page===1?'cor_count':'cor_count'+page)),'native page counter'),count=Number(counter.attrs['data-id'])
 need(/^(?:0|[1-6])$/.test(counter.attrs['data-id']||'')&&count===cards.length,'native page count/whole card mismatch')
 const seen=new Set(),rows=cards.map(card=>{readable(d,v,card,'native inventory row');const title=d.text(one(walk(card).filter(n=>n.tag==='h4'),'native inventory title')),links=d.nodes(n=>n.tag==='a'&&n.attrs.href,card),urls=[...new Set(links.map(n=>roleURL(n.attrs.href)))];need(title&&urls.length===1&&!seen.has(urls[0]),'duplicate or ambiguous native inventory role');seen.add(urls[0]);const fields={};for(const p of walk(card).filter(n=>n.tag==='p')){const label=d.text(one(p.children.filter(n=>typeof n!=='string'&&n.tag==='strong'),'native listing field label')).replace(/:$/,'');need(!Object.hasOwn(fields,label),'duplicate native listing field');fields[label]=norm(d.text(p).slice(label.length+1))}need(Object.keys(fields).sort().join('|')==='Experience|Skills'&&fields.Experience&&fields.Skills,'native listing criterion fields changed');return{url:urls[0],title,fields,model:whole(card),nativeGeographyMetadata:geo([...walk(card),...ancestors(card,parents)]),nativeEmployerMetadata:employers([...walk(card),...ancestors(card,parents)],d),nativeDeclarations:declarations(walk(card),d)}})
 const notFound=walk(root).filter(n=>has(n,'co_not_found')),onlySix=walk(root).filter(n=>has(n,'only_six'))
 need(notFound.length<=1&&onlySix.length<=1,'duplicate native terminal metadata')
 const terminal=count<6||notFound[0]?.attrs['data-id']==='0'||page===1&&onlySix[0]?.attrs['data-id']==='6'
 return{rows,count,page,terminal,model:whole(root),originalHTML:html,bodySHA256:sha(html)}
}
const identity=s=>norm(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'')
const titleMatches=(listing,full)=>{if(identity(listing)===identity(full))return true;const m=/^(.*?)\s*\(([A-Z]{2,6})\)$/.exec(listing);if(!m)return false;const prefix=norm(m[1]),expanded=norm(full);if(!expanded.toLowerCase().startsWith(prefix.toLowerCase()))return false;const remainder=expanded.slice(prefix.length).replace(/^\s*[-\u2013\u2014]\s*/,'');return remainder.split(/\s+/).map(w=>w[0]).join('')===m[2]}
const years=value=>(String(value).match(/\d+/g)||[]).map(Number).join('-')
export function readDetail(html,listing){
 const context=document(html),{d,v,root,parents,head}=context,url=roleURL(listing.url),canonical=d.nodes(n=>n.tag==='link'&&(n.attrs.rel||'').split(/\s+/).includes('canonical')),og=d.nodes(n=>n.tag==='meta'&&n.attrs.property==='og:url'),site=d.nodes(n=>n.tag==='meta'&&n.attrs.property==='og:site_name'),body=one(d.nodes(n=>n.tag==='body'),'own role body')
 need(canonical.length<=1&&canonical.every(n=>n.attrs.href===url)&&og.length===1&&og[0].attrs.content===url&&site.length===1&&site[0].attrs.content===COMPANY&&head.titles.length===1&&head.titles[0].includes(COMPANY)&&has(body,'single-current-opening'),'own role publisher/canonical identity changed')
 const header=one(d.nodes(n=>has(n,'curen_head')),'whole role header'),criteria=one(d.nodes(n=>has(n,'roal_respo_main')),'whole role criterion container')
 readable(d,v,header,'role header');readable(d,v,criteria,'whole role criteria')
 const title=d.text(one(d.nodes(n=>n.tag==='h1'&&n.attrs.id==='job-title',header),'own role title')),fields={}
 for(const box of d.nodes(n=>has(n,'cure_req_bx'),header)){const label=d.text(one(d.nodes(n=>n.tag==='h6',box),'native role field label')),value=d.text(one(d.nodes(n=>n.tag==='p',box),'native role field value'));need(!Object.hasOwn(fields,label)&&value,'duplicate/empty native role field');fields[label]=value}
 need(Object.keys(fields).sort().join('|')==='Experience|Functional Area / Technologies|Job Location|No. of Openings','native role header contract changed')
 need(titleMatches(listing.title,title)&&years(fields.Experience)===years(listing.fields.Experience),'listing/detail title or experience conflict')
 need(/^\d+$/.test(fields['No. of Openings'])&&Number(fields['No. of Openings'])>0,'native openings label changed')
 const cms=(body.attrs.class||'').split(/\s+/).filter(c=>/^postid-\d+$/.test(c)),office=officeContext(context),schemas=nativeSchema(context)
 need(cms.length===1,'one native CMS content ID required')
 const roleNodes=[...walk(header),...walk(criteria)],metadataNodes=[...walk(one(d.nodes(n=>n.tag==='head'),'native role head')),...roleNodes,...ancestors(header,parents),...ancestors(criteria,parents)],nativeGeographyMetadata=[...listing.nativeGeographyMetadata,...geo(metadataNodes)],nativeEmployerMetadata=[...listing.nativeEmployerMetadata,...employers(metadataNodes,d)],labels=[...listing.nativeDeclarations,...declarations(roleNodes,d)],foreignEmployer=labels.some(l=>/employer|company|organization/i.test(l.label)&&identity(l.value)!==identity(COMPANY))||nativeEmployerMetadata.some(m=>identity(m.value)!==identity(COMPANY))
 const location=fields['Job Location'],parts=location.split(',').map(norm),explicitCountries=parts.filter(p=>p.length>3||p==='USA').map(nativeCountryName).filter(Boolean),labelConflict=labels.some(l=>/country/i.test(l.label)?l.value!=='India':/assignment/i.test(l.label)?![location,office.cityLabel,'India'].includes(l.value):false)
 const addressParts=new Set(office.address.split(',').map(identity)),prefix=parts.slice(0,-1),street=part=>/^[\p{L}\p{N}.' -]+\s+(?:Road|Rd\.?|Street|St\.?|Avenue|Ave\.?|Lane|Marg)$/iu.test(part)
 const singleOwnedWorkplace=prefix.every(part=>addressParts.has(identity(part))||street(part))&&(!prefix.length||prefix.some(part=>addressParts.has(identity(part))))&&!/\b(?:worldwide|global|anywhere|remote|multiple locations|APAC|EMEA)\b/i.test(location)
 const country=parts.at(-1)===office.cityLabel&&singleOwnedWorkplace&&!nativeGeographyMetadata.length&&!foreignEmployer&&!labelConflict&&explicitCountries.every(c=>c==='India')?'India':null
 const roleModel={header:whole(header),criteria:whole(criteria),containingContext:[...ancestors(header,parents),...ancestors(criteria,parents)].map(n=>({tag:n.tag,attrs:{...n.attrs}})),head:{titles:head.titles,canonical:canonical.map(whole),openGraph:og.map(whole),siteName:site.map(whole),allNativeMeta:d.nodes(n=>n.tag==='meta').map(whole)},nativeGeographyMetadata,nativeEmployerMetadata,nonJobStructuredMetadata:schemas}
 const ownText=d.text(criteria),description=[listing.fields.Skills,Object.entries(fields).map(([k,v])=>k+': '+v).join('\n'),ownText].join('\n\n'),closed=/\b(?:(?:this|the) (?:job|position|role) is no longer (?:available|active|accepting applications)|(?:this|the) (?:job|position|role) (?:has been|is) filled|no longer accepting applications)\b/i.test(d.text(body))
 need(ownText.length>=150,'whole native role criteria missing')
 const proof={countryHeading:office.countryHeading,officeCityLabel:office.cityLabel,officeAddress:office.address,nativeRoleWorkplace:location,country:'India',method:'exact-role-workplace-to-own-explicit-office-country',cityDictionaryUsed:false,exactCampusEstablished:false}
 return{title,company:COMPANY,sourceUrl:url,applyUrl:null,jobId:null,requisitionId:null,nativePostingID:null,nativeObservationKey:url,nativeObservationKeyIsNotPostingID:true,nativeCMSContentID:cms[0].slice(7),sourceNativeCMSPostId:cms[0].slice(7),nativeCanonicalRoleURL:canonical.length===1?url:null,nativePublishedRoleURL:url,location,city:null,state:null,country,department:null,employmentType:null,sourceEmploymentTypeUnresolved:true,remoteStatus:null,sourceRemoteStatusUnresolved:true,minimumQualification:null,preferredQualification:null,requiredSkills:[],experienceRequired:fields.Experience,numberOfOpenings:Number(fields['No. of Openings']),postingDate:null,closingDate:null,jobDescription:description,sourceDescription:description,nativeWholeCriteriaText:ownText,nativeListingTitle:listing.title,nativeRoleFields:fields,nativeGeographyMetadata,nativeExplicitDeclarations:labels,nativePublishedClosedNotice:closed,nativeRoleIdentityReconciled:true,nativeEmployerReconciled:!foreignEmployer,nativeRoleCriteriaReconciled:country==='India'&&!foreignEmployer&&!closed,sourceCountryScopeUnresolved:country===null,sourceWorksiteCountryProof:country?proof:null,nativeOfficeContext:office,nativeRoleModel:roleModel,nativeListingModel:listing.model,sourceRawNativeRole:html,sourceRawNativeRoleSHA256:sha(html),sourceNativeRoleIdentity:{advertisedURL:url,originalCanonicalClaims:canonical.map(n=>n.attrs.href),originalOpenGraphURLs:og.map(n=>n.attrs.content),CMSPostId:cms[0].slice(7)},sourceDetailComplete:false,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,applicationVisited:false,applicationFormSubmitted:false,activeApplyVerified:false}
}
