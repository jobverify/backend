import {parse} from 'acorn'
import {createHash} from 'node:crypto'
import {decodeHTML} from 'entities'
import {readNativeDocument,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {normalizeNativeAttributeBoundaries} from '../../scraper-support/utils/nativeHtmlAttributes.js'
import {activeLeverCareersFeeds} from '../../scraper-support/utils/activeLeverCareersFeed.js'
import {parseEightfoldJson} from '../../scraper-support/utils/recruitmentEightfoldData.js'
import {validatePublicPostingScope} from '../../scraper-support/utils/publishingGapAts.js'

export const CORPORATE='https://cloudinary.com/careers',JOBS='https://cloudinary.com/careers/jobs',API='https://api.lever.co/v0/postings/cloudinary?mode=json'
export const CLIENT='c838d69f95171af41e1e568dc7e90fb01a67117732854e12c22c50444ea3ce57',CF='39a2aba8d50e14ae303a5be75faf626dbd5f50aa3c575ed6c387082c57a44692'
export const sha=x=>createHash('sha256').update(x).digest('hex')
export const failure=message=>Object.assign(new Error('Cloudinary programme: '+message),{softFailure:true,abortRetries:true,upstreamOutage:false,failureKind:'coverage_gap'})
const need=(value,message)=>{if(!value)throw failure(message)}
const CSP='5e689a83f37fc631d27608b4abe4e3d1fbf96c54d5943b0e6b1ccc62db8a616d'
const securityKeys=['content-security-policy','content-security-policy-report-only','x-content-type-options','cross-origin-embedder-policy','cross-origin-resource-policy','cross-origin-opener-policy','x-content-security-policy','x-webkit-csp']
export function readCloudinarySecurity(headers,url){
 const native=url===API,policy=Object.fromEntries(securityKeys.map(key=>[key,headers.get(key)]))
 need(native?policy['content-security-policy']===null:sha(policy['content-security-policy']??'')===CSP,'Enforced CSP security policy changed or absent')
 need(policy['x-content-type-options']===(native?'nosniff':''),'Reviewed nosniff security policy changed')
 for(const key of securityKeys.slice(3))need(policy[key]===null,'Unreviewed response security policy: '+key)
 // The current captured no-Origin API responses have no CORS fields. Preserve
 // that fact; do not infer a successful browser fetch or invent an ACAO value.
 for(const[key,value]of headers)if(key.startsWith('access-control-')){policy[key]=value;throw failure('Unreviewed CORS response security policy: '+key)}
 // Report-only cannot authorize scripts. It is retained separately, does not
 // replace the exact enforced policy, and must reconcile on the closing read.
 return policy
}
const walk=(node,callback)=>{if(!node||typeof node!=='object')return;callback(node);for(const[k,v]of Object.entries(node))if(!['start','end'].includes(k)){if(Array.isArray(v))v.forEach(n=>walk(n,callback));else if(v&&typeof v==='object')walk(v,callback)}}
const member=(node,obj,prop)=>node?.type==='MemberExpression'&&!node.computed&&node.object?.type==='Identifier'&&node.object.name===obj&&node.property?.name===prop
const canonical=(node,replacements=new Map())=>{if(replacements.has(node))return replacements.get(node);if(Array.isArray(node))return node.map(n=>canonical(n,replacements));if(!node||typeof node!=='object')return node;return Object.fromEntries(Object.keys(node).sort().filter(k=>!['start','end','loc','range','raw'].includes(k)).map(k=>[k,canonical(node[k],replacements)]))}
const treeEntries=doc=>{const all=[];const visit=(node,ancestors=[])=>{if(typeof node==='string')return;all.push({node,ancestors});for(const c of node.children||[])if(typeof c!=='string')visit(c,[...ancestors,node])};doc.nodes(n=>n.tag==='root').forEach(n=>visit(n));return all}
const active=({node,ancestors})=>!node.inert&&!ancestors.some(n=>n.inert||['svg','math','template','noscript','object','iframe'].includes(n.tag))&&!['svg','math'].includes(node.tag)

// Comparison only. This exact complete outer and embedded programme is parsed,
// never executed. Three structurally identified opaque CF literals may vary;
// every other executable value/operation and every byte outside this carrier
// stays exact. No challenge endpoint or iframe is requested or activated.
function outsideCF(html,doc,entries){
 const carriers=entries.filter(e=>e.node.tag==='script'&&e.node.raw?.includes('__CF$cv$params'))
 need(carriers.length===1,'CF carrier duplicate/shadow changed');const e=carriers[0],node=e.node
 need(active(e)&&Object.keys(node.attrs).length===0&&e.ancestors.at(-1)?.tag==='body'&&e.ancestors.at(-1).children.filter(n=>typeof n!=='string').at(-1)===node,'CF carrier active HTML context changed')
 let outer,inner;try{outer=parse(node.raw,{ecmaVersion:'latest'})}catch{throw failure('CF outer programme invalid')}
 const embedded=[];walk(outer,n=>{if(n.type==='AssignmentExpression'&&n.operator==='='&&member(n.left,'d','innerHTML')&&n.right?.type==='Literal'&&typeof n.right.value==='string'&&n.right.value.includes('__CF$cv$params'))embedded.push(n.right)})
 need(embedded.length===1,'CF embedded carrier changed');try{inner=parse(embedded[0].value,{ecmaVersion:'latest'})}catch{throw failure('CF embedded programme invalid')}
 const params=[],paths=[];walk(inner,n=>{if(n.type==='AssignmentExpression'&&n.operator==='='&&member(n.left,'window','__CF$cv$params'))params.push(n.right);if(n.type==='VariableDeclarator'&&n.id?.name==='u')paths.push(n.init)})
 need(params.length===1&&paths.length===1&&params[0].type==='ObjectExpression'&&params[0].properties.length===2,'CF parameter shape changed')
 const properties=new Map();for(const p of params[0].properties){const key=p.key.name??p.key.value;need(p.type==='Property'&&!p.computed&&p.kind==='init'&&!p.method&&!p.shorthand&&!properties.has(key),'CF parameter declaration changed');properties.set(key,p.value)}
 need(JSON.stringify([...properties.keys()])==='["r","t"]','CF parameter keys changed');const ray=properties.get('r'),time=properties.get('t'),path=paths[0]
 need(ray?.type==='Literal'&&typeof ray.value==='string'&&/^[a-f0-9]{16}$/.test(ray.value)&&time?.type==='Literal'&&typeof time.value==='string','CF opaque literals changed')
 const decoded=Buffer.from(time.value,'base64').toString('ascii');need(/^\d{10}$/.test(decoded)&&Buffer.from(decoded,'ascii').toString('base64')===time.value,'CF time literal changed')
 need(path?.type==='Literal'&&path.value==='/cdn-cgi/challenge-platform/scripts/jsd/main.js?ray='+ray.value,'CF ray/path binding changed')
 const replacements=new Map([[ray,{type:'Literal',value:'<reviewed-CF-ray>'}],[time,{type:'Literal',value:'<reviewed-CF-time>'}],[path,{type:'Literal',value:'/cdn-cgi/challenge-platform/scripts/jsd/main.js?ray=<reviewed-CF-ray>'}]])
 const innerCanonical=canonical(inner,replacements),profile=sha(JSON.stringify(canonical(outer,new Map([[embedded[0],{type:'Literal',value:{reviewedEmbeddedCloudflareProgram:innerCanonical}}]]))))
 need(profile===CF,'CF whole outer/embedded static profile changed')
 const start=html.indexOf(node.raw);need(start>=8&&html.indexOf(node.raw,start+1)===-1&&html.slice(start-8,start)==='<script>'&&html.slice(start+node.raw.length,start+node.raw.length+9)==='</script>','CF original carrier boundary changed')
 return{outsideSHA256:sha(html.slice(0,start)+'<exact-reviewed-CF-static-profile:'+profile+'>'+html.slice(start+node.raw.length)),CFStaticProfile:profile,CFOriginalScriptSHA256:sha(node.raw),CFOriginalScript:node.raw,CFNativeParameters:{r:ray.value,t:time.value,rayURL:path.value}}
}

export function readCloudinaryHTML(html,kind){
 const normalized=normalizeNativeAttributeBoundaries(html),doc=readNativeDocument(normalized),entries=treeEntries(doc),visible=readVisibleNativeDocument(normalized,{strict:true}),cf=outsideCF(html,readNativeDocument(html),treeEntries(readNativeDocument(html)))
 const expected=kind==='corporate'?'c568ceaff9b7ce86f09a8072623f6747f3366e069a1b6add4fdcf110b4142edf':'d79692eb98d7bc9c8c62c38846056e8d8f3003afad40b2ac68f3618e12f01c03'
 need(cf.outsideSHA256===expected,kind+' whole publisher/programme profile changed outside exact CF carrier')
 const models=entries.filter(e=>active(e)&&e.node.tag==='script'&&e.node.attrs.type==='application/ld+json');need(models.length===1&&!Object.hasOwn(models[0].node.attrs,'src'),'Publisher JSON carrier changed')
 let schema;try{schema=parseEightfoldJson(models[0].node.raw)}catch(error){throw failure('Publisher JSON: '+error.message)}
 const websites=schema?.['@graph']?.filter(n=>n?.['@type']==='WebSite')||[];need(websites.length===1&&websites[0].name==='Cloudinary'&&websites[0].url==='https://cloudinary.com/','Current publisher brand changed')
 if(kind==='corporate')need(visible.nodes(n=>n.tag==='a'&&n.attrs.href).some(n=>{try{return new URL(n.attrs.href,CORPORATE).href===JOBS}catch{return false}}),'Current corporate jobs handoff changed')
 else{
  need(JSON.stringify(activeLeverCareersFeeds(doc))===JSON.stringify([API]),'Current declared whole flat client/feed profile changed')
  const clients=entries.filter(e=>e.node.tag==='script'&&e.node.raw?.includes('api.lever.co/v0/postings/'));need(clients.length===1&&active(clients[0])&&Object.keys(clients[0].node.attrs).length===0&&sha(clients[0].node.raw)===CLIENT,'Current native client carrier/profile changed')
  for(const id of['job-listings','filter-location','filter-team','clear-filters'])need(entries.filter(e=>e.node.attrs.id===id).length===1&&visible.nodes(n=>n.attrs.id===id).length===1,'Unique visible native mount/control changed: '+id)
  for(const id of['filter-location','filter-team']){const select=visible.nodes(n=>n.attrs.id===id)[0],options=select.children.filter(n=>typeof n!=='string');need(options.length===1&&options[0].tag==='option'&&options[0].attrs.value===''&&!Object.hasOwn(options[0].attrs,'selected'),'Current unfiltered native control changed')}
 }
 return{...cf,publisherBrand:websites[0].name,publisherWebSite:structuredClone(websites[0]),clientSHA256:kind==='jobs'?CLIENT:null,declaredAPI:kind==='jobs'?API:null,originalHTML:html,bodySHA256:sha(html),unfiltered:true}
}

const allowed=new Set(['additionalPlain','additional','categories','createdAt','descriptionPlain','description','id','lists','text','country','workplaceType','opening','openingPlain','descriptionBody','descriptionBodyPlain','hostedUrl','applyUrl'])
const fields=['opening','openingPlain','description','descriptionPlain','descriptionBody','descriptionBodyPlain','additional','additionalPlain'],display=new Intl.DisplayNames(['en'],{type:'region'})
const authoredTags=new Set(['root','div','br','p','span','b','ul','li','strong','h3','h2'])
const authoredBlocks=new Set(['div','br','p','ul','li','h3','h2'])
const authoredInline=new Set(['span','b','strong'])
const presentationProperties=new Set(['background-color','line-height','margin-top','margin-bottom','margin-left','padding-top','padding-bottom','padding-inline-start','font-size','font-family','font-weight','color'])
const authoredHTMLText=html=>{
 const document=readNativeDocument(html),roots=document.nodes(node=>node.tag==='root');need(roots.length===1,'Unreviewed authored HTML root')
 const text=node=>{
  need(authoredTags.has(node.tag)&&!node.nativeTagUnqualified&&!node.inert&&Object.keys(node.attrs).every(key=>key==='style'),'Unreviewed authored HTML/carrier/programme or visibility model')
  need(!Object.values(node.attrs).some(value=>/\bindia\b/i.test(value)),'Authored HTML attribute country requires separate qualification')
  const seen=new Set()
  for(const declaration of(node.attrs.style??'').split(';').filter(value=>value.trim())){
   const match=/^\s*([A-Za-z-]+)\s*:\s*([#A-Za-z0-9.,%+\- \t\r\n\f]+)\s*$/.exec(declaration)
   need(match,'Unreviewed authored CSS criterion or text model')
   const property=match[1].toLowerCase(),value=match[2].trim().toLowerCase()
   need(!seen.has(property)&&(presentationProperties.has(property)||(property==='display'&&authoredInline.has(node.tag)&&value==='inline')),'Unreviewed authored CSS criterion or text boundary')
   seen.add(property)
  }
  // Authored API HTML is parsed before decoding each text node once. Inline
  // fragments keep their word boundaries; actual block elements add a boundary.
  // This comparison-only uncertainty guard is not a browser visibility proof.
  const value=node.children.map(child=>typeof child==='string'?decodeHTML(child):text(child)).join('')
  return authoredBlocks.has(node.tag)?' '+value+' ':value
 }
 return text(roots[0])
}
// These are observed publisher-authored label/code pairs in the current full
// programme, including the same native object's explicit London/GB pair. No
// city-to-country inference or additional-location inheritance is introduced.
const nativeCountryLocations=new Map([['United States','US'],['Israel','IL'],['London','GB']])
export function readCloudinaryNative(text){
 let rows;try{rows=parseEightfoldJson(text)}catch(error){throw failure('Native JSON: '+error.message)}
 need(Array.isArray(rows),'Native complete flat array/envelope changed');const seen=new Set()
 for(const row of rows){
  need(row&&typeof row==='object'&&!Array.isArray(row)&&Object.keys(row).every(k=>allowed.has(k)),'Unreviewed native field/schema/criteria or applicant model')
  need(typeof row.id==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(row.id)&&!seen.has(row.id),'Duplicate or invalid native identity');seen.add(row.id)
  need(typeof row.text==='string'&&row.text.trim()&&row.hostedUrl==='https://jobs.lever.co/cloudinary/'+row.id&&row.applyUrl===row.hostedUrl+'/apply','Native account/application URL identity changed')
  need(row.categories&&typeof row.categories==='object'&&!Array.isArray(row.categories)&&Object.keys(row.categories).every(k=>['team','location','allLocations','commitment'].includes(k)),'Unreviewed native location/category field')
  for(const key of['team','location','commitment'])need(typeof row.categories[key]==='string'&&row.categories[key].trim(),'Native category/location missing')
  need(typeof row.country==='string'&&/^[A-Z]{2}$/.test(row.country)&&!['IN','ZZ','EU','UN','QO','XA','XB'].includes(row.country)&&display.of(row.country)!==row.country,'Native country unknown or India; zero withheld')
  need(Array.isArray(row.categories.allLocations)&&row.categories.allLocations.length===1&&row.categories.allLocations[0]===row.categories.location&&!/\bindia\b/i.test(row.categories.location),'Additional/contradictory/India native location country requires separate qualification')
  need(nativeCountryLocations.get(row.categories.location)===row.country,'Current native country/location pair contradictory or unreviewed')
  need(typeof row.createdAt==='number'&&Number.isSafeInteger(row.createdAt)&&row.createdAt>=0&&['remote','hybrid','onsite'].includes(row.workplaceType),'Native date/workplace schema changed')
  for(const field of fields)need(typeof row[field]==='string','Native full criteria field changed: '+field)
  need(Array.isArray(row.lists)&&row.lists.every(list=>list&&typeof list==='object'&&!Array.isArray(list)&&Object.keys(list).every(k=>['text','content'].includes(k))&&typeof list.text==='string'&&typeof list.content==='string'),'Native criteria lists schema changed')
  const contents=[row.text,...fields.map(k=>row[k]),...row.lists.flatMap(s=>[s.text,s.content])]
  const htmlText=[...['opening','description','descriptionBody','additional'].map(key=>authoredHTMLText(row[key])),...row.lists.map(list=>authoredHTMLText(list.content))]
  // Plain originals are never rewritten or reclassified as HTML. A decoded
  // country token is sufficient to hold ambiguous authored encoding, never to
  // infer a worksite or certify an applicant country.
  const plainText=[row.text,...fields.filter(key=>key.endsWith('Plain')).map(key=>row[key]),...row.lists.map(list=>list.text)].map(value=>decodeHTML(value))
  need(contents.some(s=>(extractActiveDescription(s)||'').length>=100),'Complete published native criteria/content missing')
  need(![...contents,...htmlText,...plainText].some(s=>/\bindia\b/i.test(s)),'Authored India/applicant country text requires separate qualification')
 }
 const reasons=validatePublicPostingScope(rows,'lever',{source:'cloudinary',boardToken:'cloudinary',leverRegion:'global'});need(reasons.length===0,'Native country/location scope unresolved: '+reasons.join(';'))
 return rows
}
