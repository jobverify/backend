import{readFileSync}from'node:fs'
import{createHash}from'node:crypto'
import{isDeepStrictEqual as equal}from'node:util'
import{readNativeDocument,activeHead}from'../../scraper-support/utils/activeNativeHtml.js'
import{clientScriptDeclarations,hasClientDocumentBase}from'../../scraper-support/utils/reviewedClientProgram.js'
import{currentTransport}from'./currentTransport20261117.js'
const p=JSON.parse(readFileSync(new URL('./currentProfile20261117.json',import.meta.url),'utf8')),sha=s=>createHash('sha256').update(s).digest('hex'),tree=n=>typeof n==='string'?n:{tag:n.tag,attrs:n.attrs,...(n.raw===undefined?{}:{raw:n.raw}),children:n.children.map(tree)},programs=html=>clientScriptDeclarations(html).map(n=>({attrs:n.attrs,...(n.attrs.src?{}:{sha256:sha(n.raw??'')})}))
const check=(ok,message)=>{if(!ok)throw Object.assign(Error('Torrent Gas current native contract: '+message),{abortRetries:true,failureKind:'parser_or_contract_error',sourceScopeComplete:false,lifecycleCleanupAllowed:false})}
export async function runCurrentTorrentGas(options={}){
 options.signal?.throwIfAborted();const io=currentTransport({...options,label:'Torrent Gas',allowedURL:url=>[p.root,p.home,p.login,...p.clients.map(c=>c.url)].includes(url)})
 try{const acquire=async()=>{
   const redirect=await io.read(p.root,'html',{status:302,location:'/User/Home'});check(redirect.status===302,'literal owned current root redirect')
   const home=await io.read(p.home),doc=readNativeDocument(home.text);check(!hasClientDocumentBase(home.text)&&equal(activeHead(home.text).titles,[p.title]),'active current home title/base')
   const loginLinks=doc.nodes(n=>n.tag==='a'&&doc.text(n)==='Log In');check(loginLinks.length===1&&new URL(loginLinks[0].attrs.href,p.home).href===p.login,'unique active exact declared login route');check(equal(programs(home.text),p.homePrograms),'whole current home programme declaration graph')
   const login=await io.read(p.login),gate=readNativeDocument(login.text);check(!hasClientDocumentBase(login.text)&&equal(activeHead(login.text).titles,[p.title])&&equal(programs(login.text),p.loginPrograms),'active current login identity/programmes')
   const forms=gate.nodes(n=>n.tag==='form');check(forms.length===1&&forms[0].attrs.method==='post'&&new URL(forms[0].attrs.action,p.login).href===p.login,'exact own current account form')
   const fields=gate.nodes(n=>n.tag==='input',forms[0]);check(['Email','Password','verifyCode','__RequestVerificationToken'].every(name=>fields.filter(n=>n.attrs.name===name).length===1),'complete account/password/CAPTCHA native controls');check(gate.nodes(n=>n.tag==='img'&&n.attrs.id==='captchaImage'&&n.attrs.src==='/Captcha/Image').length===1,'native CAPTCHA boundary')
   const clients=[];for(const client of p.clients){check(programs(home.text).filter(n=>new URL(n.attrs.src??'',p.home).href===client.url).length===1,'unique current declared programme');const r=await io.read(client.url,'js');check(r.bodyBytes===client.bytes&&r.bodySHA256===client.sha256,'whole reviewed current UI programme');clients.push({...client,body:r.text})}io.checkpoint()
   return{redirect:{url:redirect.url,status:redirect.status,location:redirect.location,text:redirect.text},home:{url:home.url,fullNativeHTML:home.text,programs:programs(home.text)},login:{url:login.url,fullNativeHTML:login.text,fullNativeForm:tree(forms[0]),programs:programs(login.text)},reviewedUIPrograms:clients}
  },opening=await acquire(),closing=await acquire();io.checkpoint()
  throw Object.assign(Error('Torrent Gas current declared ASP.NET careers surface exposes account access and CAPTCHA; the public response does not establish an enumerable vacancy inventory or a company empty count'),{name:'TorrentGasNativeInventoryUnavailableError',abortRetries:true,softFailure:true,failureKind:'source_inventory_unavailable',sourceScopeComplete:false,lifecycleCleanupAllowed:false,nativeCollectionEvidence:{source:'torrentgas',nativeOpeningModel:opening,nativeClosingModel:closing,closingFullNativeModelMatches:equal(opening,closing),closingHomeModelMatches:equal(opening.home,closing.home),closingLoginModelMatches:equal(opening.login,closing.login),unmatchedAccountChallengeContextHeld:!equal(opening.login,closing.login),observedVacancyCount:null,companyIndiaTotal:null,companyGlobalTotal:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,verifiedEmpty:false,applicationSubmitted:false,authenticationAttempted:false,captchaRequestedOrSolved:false,publicEligibility:null,browserEquivalenceComplete:false,retainedResponses:io.receipts}})
 }finally{io.close()}
}
