import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {gunzipSync} from 'node:zlib'
import {parse} from 'acorn'
import {readMainRecruitment,readReviewedTensorGoChunks} from './currentChunks.js'
import {readCurrentCareers} from './currentCareers.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261128/current-program.json.gz',import.meta.url))))
const page=fixture.sourcePackets[0]
const main=fixture.sourcePackets.find(row=>/\/static\/js\/main\.[^.]+\.js$/.test(row.requestedUrl))
const programs=fixture.declaredProgramPackets
const source='https://tensorgo.com/careers'
const expected={
  '/careers':{chunks:[375,756,757,985,402],entry:2402},
  '/careers/:slug':{chunks:[985,803],entry:6803},
}
const roleRoute='{path:"/careers/:slug",element:(0,B.jsx)(Nn,{})}'
const roleLoader='Nn=xn(()=>Promise.all([n.e(985),n.e(803)]).then(n.bind(n,6803)))'
const sha=value=>createHash('sha256').update(value).digest('hex')
function inputs(){return {html:page.body,asset:new URL(main.requestedUrl),bundle:main.body,programs:structuredClone(programs)}}
async function contract(change=()=>{}){
  const value=inputs();change(value)
  const calls=[]
  const result=await readReviewedTensorGoChunks({...value,readText:async url=>{
    calls.push(url)
    const packet=value.programs.find(row=>row.requestedUrl===url)
    assert.ok(packet,'No program outside the exact current declarations: '+url)
    return packet.body
  }})
  return {result,calls}
}

test('TensorGo current fixture retains fourteen genuine complete response bodies from two labeled acquisitions',()=>{
  assert.equal(fixture.sourcePackets.length,8);assert.equal(programs.length,6)
  assert.equal(fixture.provenance.separateAcquisitionAttempts,true)
  assert.equal(fixture.provenance.noCurrentNativeAPIInventoryCaptured,true)
  for(const packet of [...fixture.sourcePackets,...programs]){
    assert.equal(packet.status,200);assert.equal(sha(packet.body),packet.sha256)
  }
  assert.equal(page.requestedUrl,source)
  assert.ok(main.body.includes('Nn=n(1947)'))
  assert.ok(main.body.includes(roleLoader))
})

test('TensorGo genuine current routes resolve their lexical loaders despite an unrelated same-name import',()=>{
  assert.deepEqual(readMainRecruitment(main.body).routes,expected)
})

test('TensorGo changing an unrelated scope import cannot choose another careers route loader',()=>{
  const changed=main.body.replace('Nn=n(1947)','Nn=n(29999)')
  assert.notEqual(changed,main.body)
  assert.deepEqual(readMainRecruitment(changed).routes,expected)
})

test('TensorGo current own careers metadata and full declared consumers preserve the closed native read contract',async()=>{
  const {result,calls}=await contract()
  assert.deepEqual(calls,programs.map(row=>row.requestedUrl))
  assert.deepEqual(result.declaredChunkURLs,calls)
  assert.equal(result.semantics.api.apiBase,'https://api.humains.one')
  assert.equal(result.semantics.api.publicMethod,'GET')
  assert.equal(result.semantics.api.defaultQuery,null)
  assert.equal(result.semantics.api.listPath,'/api/jobs')
  assert.equal(result.semantics.api.detailPath,'/api/jobs/{encodeURIComponent(slug)}')
  assert.equal(result.semantics.employer.legalName,'TensorGo Software Private Limited')
  assert.equal(result.semantics.fullCriteriaField,'native detail.description')
  assert.equal(result.semantics.application.nativeRoleSlugBound,true)
  assert.equal(result.semantics.application.submissionPerformed,false)
  assert.equal(result.browserProgramsExecuted,false)
})

test('TensorGo current registered reader reaches only the genuine unacquired native inventory boundary',async()=>{
  const packets=[page,main,...programs],calls=[],boundary=Error('Unacquired genuine current TensorGo native inventory')
  await assert.rejects(readCurrentCareers({fetchImpl:async(url,init)=>{
    assert.equal(init.method,'GET');calls.push(url)
    if(url==='https://api.humains.one/api/jobs')throw boundary
    const packet=packets.find(row=>row.requestedUrl===url)
    assert.ok(packet,'No uncaptured API, fallback or application read: '+url)
    return Object.defineProperty(new Response(packet.body,{status:packet.status,headers:packet.headers}),'url',{value:url})
  }}),error=>error===boundary)
  assert.deepEqual(calls,[source,main.requestedUrl,...programs.map(row=>row.requestedUrl),'https://api.humains.one/api/jobs'])
})

test('TensorGo current title cannot authorize a foreign canonical route',async()=>{
  await assert.rejects(contract(value=>{
    value.html=value.html.replace(/<link\b[^>]*\brel=["']canonical["'][^>]*>/i,'<link rel="canonical" href="https://foreign.example/careers">')
    assert.notEqual(value.html,page.body)
  }),/identity|authority|careers|canonical/i)
})

test('TensorGo current title cannot authorize another legal organization declaration',async()=>{
  await assert.rejects(contract(value=>{
    value.html=value.html.replace(/("legalName"\s*:\s*)"TensorGo Software Private Limited"/,'$1"Foreign Employer"')
    assert.notEqual(value.html,page.body)
  }),/identity|authority|careers|employer/i)
})

test('TensorGo arbitrary current careers titles remain outside the supported metadata binding',async()=>{
  await assert.rejects(contract(value=>{
    value.html=value.html.replace('<title>Careers at TensorGo | Build Pre-AGI Teammates</title>','<title>Unreviewed TensorGo vacancies</title>')
    assert.notEqual(value.html,page.body)
  }),/identity|careers/i)
})

test('TensorGo a parameter-shadowed current role component cannot borrow an enclosing loader',()=>{
  const changed=main.body.replace(roleRoute,'((Nn)=>('+roleRoute+'))(null)')
  assert.notEqual(changed,main.body)
  assert.throws(()=>readMainRecruitment(changed),/route|binding|loader/i)
})

const unsupportedRoleScopes={
  'switch case lexical declaration':route=>'(()=>{switch(0){case 0:let Nn=()=>null;return '+route+';}})()',
  'another switch case lexical declaration':route=>'(()=>{switch(0){case 0:return '+route+';case 1:let Nn=()=>null;}})()',
  'named class expression':route=>'(class Nn {static route='+route+'}).route',
  'named class declaration':route=>'(()=>{class Nn {static route='+route+'}return Nn.route})()',
  'class static block lexical declaration':route=>'(()=>{let result;class Holder {static {let Nn=()=>null;result='+route+'}}return result})()',
}
for(const [scope,wrap]of Object.entries(unsupportedRoleScopes))test('TensorGo a '+scope+' cannot borrow an enclosing route loader',async()=>{
  const changed=main.body.replace(roleRoute,wrap(roleRoute))
  assert.notEqual(changed,main.body)
  assert.doesNotThrow(()=>parse(changed,{ecmaVersion:'latest'}),'The scope control must be valid JavaScript')
  assert.throws(()=>readMainRecruitment(changed),/route|binding|loader|scope/i)
  await assert.rejects(contract(value=>{value.bundle=changed}),/route|binding|loader|scope/i)
})

test('TensorGo a static-block var cannot supply the missing enclosing route loader',async()=>{
  const ast=parse(main.body,{ecmaVersion:'latest'}),declarations=[]
  function visit(node){
    if(!node||typeof node!=='object')return
    if(node.type==='VariableDeclaration'&&node.declarations.some(row=>main.body.slice(row.start,row.end)===roleLoader))declarations.push(node)
    for(const value of Object.values(node))if(value&&typeof value==='object')Array.isArray(value)?value.forEach(visit):visit(value)
  }
  visit(ast);assert.equal(declarations.length,1)
  const end=declarations[0].end
  const changed=(main.body.slice(0,end)+'class IsolatedRole {static {var '+roleLoader+';}}'+main.body.slice(end))
    .replace(roleLoader,'RenamedRole'+roleLoader.slice(2))
  assert.notEqual(changed,main.body)
  assert.doesNotThrow(()=>parse(changed,{ecmaVersion:'latest'}),'The isolated var control must be valid JavaScript')
  assert.throws(()=>readMainRecruitment(changed),/route|binding|loader|scope/i)
  await assert.rejects(contract(value=>{value.bundle=changed}),/route|binding|loader|scope/i)
})

test('TensorGo a reassigned component in the selected lexical scope cannot retain native authority',()=>{
  const declarations=[]
  function visit(node){
    if(!node||typeof node!=='object')return
    if(node.type==='VariableDeclaration'&&node.declarations.some(row=>main.body.slice(row.start,row.end)===roleLoader))declarations.push(node)
    for(const value of Object.values(node))if(value&&typeof value==='object')Array.isArray(value)?value.forEach(visit):visit(value)
  }
  visit(parse(main.body,{ecmaVersion:'latest'}))
  assert.equal(declarations.length,1)
  const end=declarations[0].end
  const changed=main.body.slice(0,end)+'Nn=()=>null;'+main.body.slice(end)
  assert.notEqual(changed,main.body)
  assert.throws(()=>readMainRecruitment(changed),/route|binding|loader|reassign/i)
})

test('TensorGo removing the actual lexical loader cannot borrow the unrelated import',()=>{
  const changed=main.body.replace(roleLoader,'Nn=()=>null')
  assert.notEqual(changed,main.body)
  assert.throws(()=>readMainRecruitment(changed),/route|binding|loader/i)
})

test('TensorGo current native consumers still reject a restricted list request',async()=>{
  await assert.rejects(contract(value=>{
    const packet=value.programs.find(row=>row.body.includes('.get("/api/jobs")'))
    assert.ok(packet,'Synthetic control must modify the genuine native list consumer')
    packet.body=packet.body.replace('.get("/api/jobs")','.get("/api/jobs",{country:"India"})')
  }),/query|options|request/i)
})

test('TensorGo current full description renderer cannot be replaced by a short criteria field',async()=>{
  await assert.rejects(contract(value=>{
    const packet=value.programs.find(row=>row.requestedUrl.includes('/803.'))
    const changed=packet.body.replace(/text:([\w$]+)\.description/g,'text:$1.short')
    assert.notEqual(changed,packet.body)
    packet.body=changed
  }),/description|criteria/i)
})

test('TensorGo current program employer substitution remains fatal',async()=>{
  await assert.rejects(contract(value=>{
    value.bundle=value.bundle.replaceAll('TensorGo Software Private Limited','Foreign Employer')
    assert.notEqual(value.bundle,main.body)
  }),/employer|organization/i)
})
