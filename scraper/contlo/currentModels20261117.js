import{createHash}from'node:crypto'
import{parse}from'acorn'
import{isDeepStrictEqual as equal}from'node:util'
import{readNativeDocument,extractActiveDescription,activeHead}from'../../scraper-support/utils/activeNativeHtml.js'
import{clientScriptDeclarations,hasClientDocumentBase}from'../../scraper-support/utils/reviewedClientProgram.js'
import{bindNativeFlight}from'./currentFlight20261117.js'
export const sha=s=>createHash('sha256').update(s).digest('hex'),tree=n=>typeof n==='string'?n:{tag:n.tag,attrs:n.attrs,...(n.raw===undefined?{}:{raw:n.raw}),children:n.children.map(tree)}
export const check=(ok,why)=>{if(!ok)throw Object.assign(Error('Contlo current native contract: '+why),{failureKind:'parser_or_contract_error',abortRetries:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false})}
const one=(rows,name)=>{check(rows.length===1,'unique '+name);return rows[0]}
export const schemaShape=value=>Array.isArray(value)?value.map(schemaShape):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,schemaShape(v)])):value===null?'null':typeof value
function flightLiteral(source){
 const ast=parse(source,{ecmaVersion:'latest'});if(ast.body.length!==1)return false;const call=ast.body[0]?.expression,arg=call?.arguments?.[0],callee=call?.callee
 return call?.type==='CallExpression'&&call.arguments.length===1&&callee?.type==='MemberExpression'&&!callee.computed&&callee.property.name==='push'&&callee.object?.type==='MemberExpression'&&!callee.object.computed&&callee.object.object?.name==='self'&&callee.object.property?.name==='__next_f'&&arg?.type==='ArrayExpression'&&arg.elements.length===2&&arg.elements[0]?.type==='Literal'&&arg.elements[0].value===1&&arg.elements[1]?.type==='Literal'&&typeof arg.elements[1].value==='string'
}
export function detailPrograms(html){return clientScriptDeclarations(html).map(n=>({attrs:n.attrs,...(n.attrs.src?{}:flightLiteral(n.raw??'')?{nativeLiteralFlightData:true}:{sha256:sha(n.raw??'')})}))}
export function detailBasis(html,row){
 const doc=readNativeDocument(html);check(!hasClientDocumentBase(html),'unexpected native document base')
 check(equal(activeHead(html).titles,[row.title+' at Contlo | Contlo Careers']),'effective native role title')
 const canonical=one(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'role canonical');check(canonical.attrs.href===row.url,'exact own role canonical')
 const schemaNode=one(doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'),'native role JSONLD'),schema=JSON.parse(schemaNode.raw)
 check(schema['@type']==='JobPosting'&&schema.title===row.title&&schema.url===row.url&&schema.hiringOrganization?.name==='Contlo'&&typeof schema.description==='string'&&schema.datePosted===row.postedAt,'full native schema/employer/title/publication identity')
 check(schema.employmentType==='FULL_TIME'&&row.type==='Full-time'&&schema.occupationalCategory===row.department&&schema.jobLocation?.address?.addressLocality===row.location.split(',')[0].trim()&&schema.jobLocation.address.addressRegion===row.location.split(',')[1]?.trim(),'whole native employment/department/location model agrees')
 const main=one(doc.nodes(n=>n.tag==='main'),'native role main'),criteria=one(doc.nodes(n=>n.tag==='div'&&doc.hasClass(n,'rich-text'),main),'full native rich criteria'),description=extractActiveDescription(schema.description)
 check(typeof description==='string'&&description.length>100&&doc.text(criteria)===description,'complete visible/schema criteria with preserved word boundaries')
 const title=one(doc.nodes(n=>n.tag==='h1',main),'native displayed role title');check(doc.text(title)===row.title,'exact displayed role title')
 const fields=[title,one(doc.nodes(n=>n.tag==='span'&&doc.text(n)===row.department,main),'department badge'),one(doc.nodes(n=>n.tag==='span'&&doc.text(n)===row.type,main),'employment badge'),one(doc.nodes(n=>n.tag==='p'&&n.attrs.class==='mt-3 text-sm text-sw-ink-3'&&doc.text(n)===row.location,main),'explicit location metadata')]
 check(fields.every(n=>n.children.every(c=>typeof c==='string')),'text-only native role data carriers')
 const forms=doc.nodes(n=>n.tag==='form',main);check(forms.length===1,'whole current role application form')
 const socialURLs=doc.nodes(n=>n.tag==='meta'&&n.attrs.property==='og:url');check(socialURLs.length===1&&socialURLs[0].attrs.content===row.url,'row-bound native social URL')
 const titleNodes=doc.nodes(n=>n.tag==='title'),socialTitles=doc.nodes(n=>n.tag==='meta'&&(n.attrs.property==='og:title'||n.attrs.name==='twitter:title'));check(socialTitles.every(n=>n.attrs.content===row.title+' at Contlo'),'row-bound native metadata title')
 const shape=n=>typeof n==='string'?n:{tag:n.tag,attrs:n===canonical?{...n.attrs,href:'<NATIVE-ROLE-URL>'}:socialURLs.includes(n)?{...n.attrs,content:'<NATIVE-ROLE-URL>'}:socialTitles.includes(n)?{...n.attrs,content:'<NATIVE-ROLE-METADATA-TITLE>'}:n.attrs,...(n.raw===undefined?{}:{raw:n===schemaNode?'<NATIVE-WHOLE-JOBPOSTING>':titleNodes.includes(n)?'<NATIVE-ROLE-METADATA-TITLE>':n.tag==='script'&&!n.attrs.src&&flightLiteral(n.raw??'')?'<NATIVE-LITERAL-FLIGHT-DATA>':n.raw}),children:n===criteria?['<FULL-NATIVE-CRITERIA>']:fields.includes(n)?['<NATIVE-TEXT-FIELD:'+fields.indexOf(n)+'>']:n.children.map(shape)}
 const body=one(doc.nodes(n=>n.tag==='body'),'native body'),formats=[];const collect=n=>{if(typeof n==='string')return;const f={tag:n.tag,attrs:n.attrs};if(!formats.some(v=>equal(v,f)))formats.push(f);for(const c of n.children)collect(c)};collect(criteria)
 return{doc,criteria,schema,description,bodyShapeSHA256:sha(JSON.stringify(shape(body))),programs:detailPrograms(html),formats,form:tree(forms[0]),nativeBody:tree(body)}
}
export function detailModel(html,row,profile){
 const basis=detailBasis(html,row);check(basis.bodyShapeSHA256===profile.bodyShapeSHA256&&equal(basis.programs,profile.programs),'whole native body/executable structure changed outside full typed role criteria/metadata/data')
 check(equal(schemaShape(basis.schema),profile.schemaShape),'whole native schema fields/types changed outside reviewed structure')
 const nativeHydrationModel=bindNativeFlight(html,row,basis.schema,profile.hydration)
 const fits=n=>typeof n==='string'||!n.inert&&profile.criteriaFormats.some(f=>f.tag===n.tag&&equal(f.attrs,n.attrs))&&n.children.every(fits)
 const schemaDoc=readNativeDocument(basis.schema.description),schemaRoot=one(schemaDoc.nodes(n=>n.tag==='root'),'schema criteria root'),schemaFits=schemaRoot.children.every(fits)
 return{url:row.url,schema:basis.schema,description:basis.description,descriptionHTML:basis.schema.description,nativeCriteria:tree(basis.criteria),criteriaQualified:fits(basis.criteria)&&schemaFits,nativeBody:basis.nativeBody,nativeApplicationForm:basis.form,nativeHydrationModel,fullNativeHTML:html,programs:basis.programs}
}
