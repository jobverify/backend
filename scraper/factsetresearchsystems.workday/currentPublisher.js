import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'

export const FACTSET_CAREERS='https://www.factset.com/careers'
export const FACTSET_NATIVE_EMPLOYER='30097 FactSet Systems India Private Limited'
export const FACTSET_WORKDAY={origin:'https://factset.wd108.myworkdayjobs.com',tenant:'factset',site:'FactSetCareers'}
const REVIEWED_RENDERER_SHA256='575b59fa2aaedc23f433c8664241c0535ab087daebb2e261225cb66b1ea4a479'
const sha=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex')
const check=(condition,message)=>{if(!condition)throw Error('FactSet current publisher: '+message)}
const walk=(node,visit)=>{
 if(!node||typeof node!=='object')return
 visit(node)
 for(const value of Object.values(node)){
  if(Array.isArray(value))for(const child of value)walk(child,visit)
  else if(value&&typeof value==='object')walk(value,visit)
 }
}
const member=(node,object,property)=>node?.type==='MemberExpression'&&!node.computed&&node.object?.type==='Identifier'
 &&node.object.name===object&&node.property?.name===property
const workdayReference=node=>member(node,'window','workday')||node?.type==='MemberExpression'&&node.computed
 &&node.object?.type==='Identifier'&&node.object.name==='window'&&node.property?.type==='Literal'&&node.property.value==='workday'
function reviewedPagePrefix(body){
 check(sha(body)===REVIEWED_RENDERER_SHA256,'reviewed active renderer changed')
 const program=parse(body,{ecmaVersion:'latest',sourceType:'module'}),matches=[]
 // The reviewed active Vue route loader fetches this template using the route
 // slug, then assigns its JSON content/SEO to the mounted page. No JS executes.
 walk(program,node=>{
  if(node.type!=='CallExpression'||node.callee?.type!=='Identifier'||node.callee.name!=='fetch'||node.arguments.length!==1)return
  const arg=node.arguments[0]
  if(arg.type==='TemplateLiteral'&&arg.quasis.length===2&&arg.expressions.length===1
   &&arg.expressions[0].type==='Identifier'&&arg.quasis[0].value.cooked==='/api/page/'&&arg.quasis[1].value.cooked==='')matches.push(arg.quasis[0].value.cooked)
 })
 check(matches.length===1,'reviewed current CMS route loader changed')
 return matches[0]
}
const cms=(value,label)=>{
 check(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')==='content,locale,pageType,seo'
  &&value.pageType==='Website Page'&&value.locale==='en-US'&&value.content?.__typename==='PageGeneric'
  &&typeof value.content.name==='string'&&Array.isArray(value.content.sections)&&value.seo?.__typename==='Seo'
  &&value.seo.nofollow===false&&value.seo.noindex===false,label+' CMS schema changed')
 return value
}
const richText=value=>{
 check(value?.nodeType==='document'&&Array.isArray(value.content),'current legal publisher identity changed')
 const texts=[]
 const visit=node=>{if(node?.nodeType==='text'&&typeof node.value==='string')texts.push(node.value)
  else if(Array.isArray(node?.content))for(const child of node.content)visit(child)}
 visit(value);return texts.join(' ').replace(/\s+/g,' ').trim()
}
function workdayConfiguration(page){
 const document=readNativeDocument(page.html),models=[]
 check(!document.nodes(n=>n.tag==='base').length,'native Workday board configuration changed')
 for(const script of document.nodes(n=>n.tag==='script'&&!n.attrs.src&&!Object.hasOwn(n.attrs,'nomodule')
  &&(!n.attrs.type||n.attrs.type==='text/javascript'))){
  const program=parse(script.raw||'',{ecmaVersion:'latest',sourceType:'script'})
  const assignments=[]
  walk(program,node=>{if(node.type==='AssignmentExpression'&&workdayReference(node.left))assignments.push(node)})
  const active=program.body.filter(node=>node.type==='ExpressionStatement'&&node.expression.type==='AssignmentExpression'
   &&member(node.expression.left,'window','workday')).map(node=>node.expression)
  check(assignments.length===active.length,'native Workday board configuration changed')
  for(const node of active){
   check(node.operator==='=','native Workday board configuration changed')
   check(node.right?.type==='LogicalExpression'&&node.right.operator==='||'&&member(node.right.left,'window','workday')
    &&node.right.right?.type==='ObjectExpression','native Workday board configuration changed')
   const fields=new Map()
   for(const property of node.right.right.properties){
    check(property.type==='Property'&&!property.computed&&property.kind==='init'&&!property.method,'native Workday board configuration changed')
    const key=property.key.type==='Identifier'?property.key.name:property.key.value
    check(typeof key==='string'&&!fields.has(key),'native Workday board configuration changed')
    fields.set(key,property.value)
   }
   const expected={tenant:'factset',siteId:'FactSetCareers',locale:'',requestLocale:'en-US',environment:'PROD',isExternal:true,appName:'cxs',clientOrigin:'https://wd108.myworkday.com'}
   for(const[key,value]of Object.entries(expected))check(fields.get(key)?.type==='Literal'&&fields.get(key).value===value,'native Workday board configuration changed')
   models.push(expected)
  }
 }
 check(models.length===1,'native Workday board configuration changed')
 return models[0]
}

// Trusted source configuration only. Every supplied reader is the shared
// bounded authority/MIME/request-budget reader; the callback receives no fetch
// or general authority grant. The CMS/native URLs below come from live data.
export async function readFactSetPublisherDeclaration({page,readRenderer,readJson,readDeclaredBoardPage}){
 check(page.url===FACTSET_CAREERS,'current careers page identity changed')
 const document=readNativeDocument(page.html)
 check(!document.nodes(n=>n.tag==='base').length,'unreviewed current company document base')
 const titles=document.nodes(n=>n.tag==='title').map(n=>decodeNativeEntities(n.raw||''))
 check(titles.length===1&&/\bFactSet\b/.test(titles[0])&&/\bCareer/.test(titles[0]),'current corporate publisher identity changed')
 const canonicals=document.nodes(n=>n.tag==='link'&&(n.attrs.rel||'').toLowerCase()==='canonical')
 check(canonicals.length===1&&canonicals[0].attrs.href===FACTSET_CAREERS,'current careers page identity changed')
 const entries=document.nodes(n=>n.tag==='script'&&n.attrs.type==='module'&&n.attrs.src)
 check(entries.length===1&&/^\/assets\/index-[a-zA-Z0-9_-]+\.js$/.test(entries[0].attrs.src),'reviewed active renderer changed')
 const renderer=await readRenderer(new URL(entries[0].attrs.src,page.url).href),prefix=reviewedPagePrefix(renderer.html)
 const careersURL=new URL(prefix+new URL(page.url).pathname.slice(1),page.url).href
 const careers=cms(await readJson(careersURL),'careers'),sections=careers.content.sections
 check(careers.content.name==='Careers Homepage Page DIY'&&careers.seo.title===titles[0]&&sections.length===13
  &&sections[0]?.__typename==='HomepageHero'&&sections[10]?.__typename==='LeadGenCard','careers CMS schema changed')
 const ctas=[sections[0].cta,sections[10].cta],boardURL=ctas[0]?.href
 for(const cta of ctas)check(cta&&cta.label==='View Open Roles'&&cta.target==='_blank'&&cta.link?.target==='_blank'
  &&cta.href===boardURL&&cta.link.href===boardURL&&boardURL===FACTSET_WORKDAY.origin+'/'+FACTSET_WORKDAY.site,'current careers CTA changed')
 const legalLinks=[]
 const column=sections[12]?.columnOne
 check(sections[12]?.__typename==='FlexibleRichText'&&column?.nodeType==='document','current legal navigation changed')
 const links=node=>{if(node?.nodeType==='hyperlink'&&node.data?.uri==='https://www.factset.com/legal')legalLinks.push(node.data.uri)
  for(const child of Array.isArray(node?.content)?node.content:[])links(child)}
 links(column);check(legalLinks.length===1,'current legal navigation changed')
 const legalURL=new URL(prefix+new URL(legalLinks[0]).pathname.slice(1),page.url).href
 const legal=cms(await readJson(legalURL),'legal'),faq=legal.content.sections.filter(s=>s.__typename==='Faq')
 check(legal.content.name==='Legal Compose Page - Page: DIY'&&faq.length===1&&Array.isArray(faq[0].pairs),'current legal publisher identity changed')
 const privacy=faq[0].pairs.filter(p=>p.question==='Privacy Notice'),terms=faq[0].pairs.filter(p=>p.question==='Terms of Use')
 check(privacy.length===1&&terms.length===1,'current legal publisher identity changed')
 const privacyStatement='FactSet Research Systems (“FactSet,” “we” or “us”) is a provider of integrated financial information and analytical applications to the global investment community.'
 const ownerStatement='The Site is owned and operated by FactSet Research Systems Inc. and its affiliates (together, “FactSet”)'
 check(richText(privacy[0].answer).includes(privacyStatement)&&richText(terms[0].answer).includes(ownerStatement),'current legal publisher identity changed')
 const board=await readDeclaredBoardPage(boardURL),nativeConfig=workdayConfiguration(board)
 const context={publisher:'FactSet Research Systems',brand:'FactSet',rendererURL:renderer.url,rendererSHA256:sha(renderer.html),cmsPrefix:prefix,
  careersURL,pageType:careers.pageType,locale:careers.locale,title:careers.seo.title,ctas:structuredClone(ctas),legalURL,privacyStatement,ownerStatement,nativeConfig}
 return{url:boardURL,context,evidence:{publisherURL:page.url,publisherBodySHA256:sha(page.html),rendererURL:renderer.url,rendererBodySHA256:sha(renderer.html),
  careersURL,careersPayloadSHA256:sha(careers),declaredCTAs:structuredClone(ctas),legalURL,legalPayloadSHA256:sha(legal),privacyStatement,ownerStatement,
  nativeBoardURL:board.url,nativeBoardBodySHA256:sha(board.html),nativeConfig},payloads:{careers,legal,nativeConfig}}
}
