import {parse} from 'acorn'
import {createHash} from 'node:crypto'
import {activeHead,readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
const hash=v=>createHash('sha256').update(v).digest('hex')
const fail=(ok,message)=>{if(!ok)throw new Error('Kidvento publisher: '+message)}
const member=n=>n?.type==='Identifier'?n.name:n?.type==='ThisExpression'?'this':n?.type==='MemberExpression'&&!n.computed?member(n.object)+'.'+n.property.name:null
const nodes=ast=>{const all=[];function walk(n){if(!n||typeof n!=='object')return;if(n.type)all.push(n);for(const v of Object.values(n))if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v)}walk(ast);return all}
// The actual Google Sites chain declares classic scripts. Data blocks, modules,
// nomodule and unreviewed execution attributes cannot establish this bootstrap.
// Inert ancestors are already excluded by the native document's active nodes.
const classicScript=(node,inline=false)=>{
 if(!node||node.tag!=='script'||Object.hasOwn(node.attrs,'nomodule'))return false
 const allowed=new Set(inline?['nonce','type']:['src','id','nonce','type'])
 if(Object.keys(node.attrs).some(key=>!allowed.has(key)))return false
 const type=(node.attrs.type||'').trim().toLowerCase()
 return (!type||/^(?:text|application)\/(?:java|ecma)script$/.test(type))&&Boolean(node.attrs.nonce)
}
export async function verifyGoogleSitesPublisher(request,review){
 const official='https://www.kidvento.com/careers',target='https://kidvento.keka.com/careers',html=await request(official),doc=readNativeDocument(html),visible=readVisibleNativeDocument(html,{strict:true}),head=activeHead(html)
 fail(head.titles.length===1&&head.titles[0]==='Careers'&&head.metas.some(m=>m.property==='og:url'&&m.content===official),'current official page identity changed')
 const candidates=doc.nodes(n=>n.attrs['data-url']===target),shown=visible.nodes(n=>n.attrs['data-url']===target)
 fail(candidates.length===1&&shown.length===1,'active and visible native embed missing')
 const wrapper=candidates[0];fail(wrapper.tag==='div'&&wrapper.attrs.jscontroller==='N0NZx'&&wrapper.attrs.jsname==='jkaScf'&&wrapper.attrs['aria-label']==='Whole page embed, Careers at Kidvento Education and Research','typed embed controller identity changed')
 const script=doc.nodes(n=>n.tag==='script'&&n.attrs.id==='base-js')
 const profiles=[review,...(review.alternatives||[])].filter(profile=>script.length===1&&script[0].attrs.src===profile.baseJs)
 fail(profiles.length===1,'declared classic controller client changed');review=profiles[0]
 const frames=wrapper.children.filter(n=>typeof n==='object'&&n.activeFrame&&n.attrs.jsname==='WMhH6e')
 fail(frames.length===1&&frames[0].attrs.src===review.bridge&&visible.frames().some(n=>n.attrs.src===review.bridge),'active owned bridge frame changed')
 fail(classicScript(script[0])&&review.baseJs.endsWith('/m=view')&&review.controller===review.baseJs.replace('/m=view','/m=N0NZx'),'declared classic controller client changed')
 const gapi=doc.nodes(n=>n.tag==='script'&&n.attrs.src==='https://apis.google.com/js/client.js?onload=gapiLoaded')
 fail(gapi.length===1&&classicScript(gapi[0])&&gapi[0].attrs.nonce===script[0].attrs.nonce,'declared classic GAPI bootstrap missing or inactive')
 const callbacks=[]
 for(const candidate of doc.nodes(n=>n.tag==='script'&&!n.attrs.src&&classicScript(n,true))){
  let program;try{program=parse(candidate.raw,{ecmaVersion:'latest',sourceType:'script'})}catch{continue}
  for(const fn of program.body.filter(n=>n.type==='FunctionDeclaration'&&n.id?.name==='gapiLoaded'))callbacks.push({candidate,fn,body:candidate.raw.slice(fn.start,fn.end)})
 }
 fail(callbacks.length===1&&callbacks[0].candidate.attrs.nonce===script[0].attrs.nonce&&hash(callbacks[0].body)===review.gapiCallbackSha256,'declared active GAPI callback changed')
 const base=await request(review.baseJs),bridge=await request(review.bridge),controller=await request(review.controller)
 fail(hash(base)===review.baseJsSha256&&hash(controller)===review.controllerSha256,'published controller bytes changed')
 fail(hash(bridge)===review.bridgeSha256,'bridge program changed')
 // Parse publisher programs as data; never evaluate or execute website code.
 const cn=nodes(parse(controller,{ecmaVersion:'latest',sourceType:'script'})),bridgeDoc=readNativeDocument(bridge),bs=bridgeDoc.nodes(n=>n.tag==='script'&&!n.attrs.src)
 fail(bs.length===1,'bridge executable program ambiguous');const bn=nodes(parse(bs[0].raw,{ecmaVersion:'latest',sourceType:'script'}))
 const calls=cn.filter(n=>n.type==='CallExpression'),call=(callee,a,b)=>calls.filter(n=>member(n.callee)===callee&&member(n.arguments[0])===a&&member(n.arguments[1])===b)
 const identityMember=review.controllerIdentity||'_.jCa',controllerClass=review.controllerClass||'_.K3'
 const identity=cn.filter(n=>n.type==='AssignmentExpression'&&member(n.left)===identityMember&&n.right.type==='CallExpression'&&member(n.right.callee)==='_.ja'&&n.right.arguments[0]?.value==='N0NZx')
 fail(identity.length===1&&call(review.controllerRegister||'_.Vj',identityMember,controllerClass).length===1&&call('_.I',controllerClass,review.baseClass||'_.hD').length===1,'controller registration/inheritance changed')
 const rpc=calls.filter(n=>member(n.callee)==='gapi.rpc.call'&&n.arguments[1]?.value==='updateInnerFrame');fail(rpc.length===1,'controller URL RPC ambiguous')
 const convert=rpc[0].arguments[3],data=convert?.arguments?.[0]
 fail(member(convert?.callee)===(review.urlConvert||'_.Bo')&&data?.type==='CallExpression'&&data.callee.type==='MemberExpression'&&data.callee.property.name==='getData'&&data.arguments.length===1&&data.arguments[0].value==='url'&&member(data.callee.object?.callee)===(review.viewMethod||'this.V'),'controller does not read its own data-url')
 const register=bn.filter(n=>n.type==='CallExpression'&&member(n.callee)==='gapi.rpc.register'&&n.arguments[0]?.value==='updateInnerFrame')
 const update=bn.filter(n=>n.type==='FunctionDeclaration'&&n.id.name==='updateInnerFrame')
 fail(register.length===1&&register[0].arguments[1]?.name==='updateInnerFrame'&&update.length===1&&update[0].params[0].name==='url','bridge RPC binding changed')
 const assignments=nodes(update[0]).filter(n=>n.type==='AssignmentExpression'&&member(n.left)==='iframe.src')
 fail(assignments.length===1&&assignments[0].right.name==='url'&&nodes(update[0]).some(n=>n.type==='CallExpression'&&member(n.callee)==='document.getElementById'&&n.arguments[0]?.value==='innerFrame'),'bridge inner-frame URL binding changed')
 return {officialUrl:official,nativeShell:target,controllerSha256:hash(controller),bridgeSha256:hash(bridge),websiteJavaScriptExecuted:false}
}

export function nativePortalDocument(shell,review){
 const scripts=readNativeDocument(shell).nodes(n=>n.tag==='script'&&!n.attrs.src).filter(n=>nodes(parse(n.raw,{ecmaVersion:'latest',sourceType:'script'})).some(v=>v.type==='CallExpression'&&v.callee.type==='Identifier'&&v.callee.name==='fetch')),expected='https://kidvento.keka.com/ats/documents/79e3ba6e-9a27-4031-8af7-4c7bca97a921/careerportal/91d1ccc543794d5db2a31ffb2a35a81d.html'
 fail(scripts.length===1&&hash(scripts[0].raw)===review.$shellLoaderSha256,'native publisher loader program changed')
 const program=parse(scripts[0].raw,{ecmaVersion:'latest',sourceType:'script'}),fetches=nodes(program).filter(n=>n.type==='CallExpression'&&n.callee.type==='Identifier'&&n.callee.name==='fetch')
 fail(program.body.length===1&&program.body[0].type==='ExpressionStatement'&&fetches.length===1&&fetches[0].arguments.length===1&&fetches[0].arguments[0].type==='Literal'&&new URL(fetches[0].arguments[0].value,'https://kidvento.keka.com').href===expected,'actual native document fetch changed')
 return expected
}
