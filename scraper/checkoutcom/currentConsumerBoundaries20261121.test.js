import test from 'node:test'
import assert from 'node:assert/strict'
import {parse} from 'acorn'
import {fixture,body,LISTING,PROXY} from './currentConfiguredProjection20261121.test.js'
import {currentPublisher} from './currentPublisher20261121.js'

const consumer=await import('./currentConsumer20261121.js').catch(error=>error.code==='ERR_MODULE_NOT_FOUND'?{}:Promise.reject(error))
const original=body(fixture.responses.find(row=>row.url===LISTING)),at=fixture.capturedAt
const exact=(text,before,after)=>{assert.equal(text.split(before).length,2,'unique original semantic mutation');assert.notEqual(before,after);return text.replace(before,()=>after)}
const script=[...original.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].find(match=>!match[1].trim()&&match[2].includes(PROXY))
assert(script)
const programme=edit=>{const changed=edit(script[2]);parse(changed,{ecmaVersion:'latest'});return exact(original,script[2],changed)}
const before=source=>exact(original,script[0],'<script>'+source+'</script>'+script[0])
const after=source=>exact(original,script[0],script[0]+'<script>'+source+'</script>')
const qualify=html=>{assert.equal(typeof consumer.qualifyCurrentConsumer,'function','current source-specific static consumer must exist');return consumer.qualifyCurrentConsumer(currentPublisher(html,LISTING,at),at,LISTING,PROXY)}
const refuse=html=>{assert.equal(typeof consumer.qualifyCurrentConsumer,'function','current source-specific static consumer must exist before a negative can qualify');assert.throws(()=>qualify(html),/./)}

test('Configured consumer original declared programme is connected without execution',()=>{const proof=qualify(original);assert.equal(proof.proxyURL,PROXY);assert.equal(proof.defaultUnfiltered,true);assert.equal(proof.nativeProgramsExecuted,false)})

for(const[name,edit]of[
 ['dead top-level initialization',s=>s.replace('(function () {','if(false)(function () {')],
 ['uninvoked initializer',s=>exact(s,'})();','});')],
 ['wrong DOM-ready owner',s=>exact(s,"document.addEventListener('DOMContentLoaded', init)","({addEventListener(){}}).addEventListener('DOMContentLoaded', init)")],
 ['unregistered ready callback',s=>exact(s,"document.addEventListener('DOMContentLoaded', init);","void init;")],
 ['missing already-ready invocation',s=>exact(s,'    init();','    void init;')],
 ['dead fetch',s=>exact(s,'await fetch(API_URL)','await (false && fetch(API_URL))')],
 ['foreign fetch',s=>exact(s,PROXY,'https://other.invalid/jobs')],
 ['shadowed fetch primitive',s=>exact(s,'  async function init() {','  async function init() {const fetch=async()=>({json:async()=>({jobs:[]})});')],
 ['changed response decoder',s=>exact(s,'await res.json()','await res.text()')],
 ['filtered original proxy data',s=>exact(s,'(data.jobs || []).map','(data.jobs || []).slice(1).map')],
 ['record apply URL override',s=>exact(s,'return { ...job, locations };',"return { ...job, locations, applyUrl:'https://other.invalid/apply' };")],
 ['record title override',s=>exact(s,'return { ...job, locations };',"return { ...job, locations, title:'Different' };")],
 ['nonempty initial input',s=>exact(s,"filters: { locations: [], departments: [], input: '' }","filters: { locations: [], departments: [], input: 'restricted' }")],
 ['nonempty URL input fallback',s=>exact(s,"params.get('search') || ''","params.get('search') || 'restricted'")],
 ['forced location selection',s=>exact(s,"state.filters.locations   = params.getAll('location')","state.filters.locations   = ['India']")],
 ['false native filter',s=>exact(s,'return (!locations.length', 'return false && (!locations.length')],
 ['nonempty query replacement',s=>exact(s,'const q = input.toLowerCase();',"const q = 'restricted';")],
 ['missing apply-filter invocation',s=>exact(s,'      applyFilters();\n      renderList();','      void applyFilters;\n      renderList();')],
 ['missing list-render invocation',s=>exact(s,'      applyFilters();\n      renderList();','      applyFilters();\n      void renderList;')],
 ['constant foreign application',s=>exact(s,"a.href = job.applyUrl || '#';","a.href = 'https://other.invalid/apply';")],
 ['wrong record application',s=>exact(s,"a.href = job.applyUrl || '#';","a.href = job.jobUrl || '#';")],
 ['constant role title',s=>exact(s,'titleDiv.textContent = job.title;',"titleDiv.textContent = 'Different';")],
 ['removed title append',s=>exact(s,'a.appendChild(titleDiv);','void titleDiv;')],
 ['removed role append',s=>exact(s,'listEl.appendChild(a);','void a;')],
 ['dead role append',s=>exact(s,'listEl.appendChild(a);','if(false)listEl.appendChild(a);')],
 ['early callback return',s=>exact(s,"const a = document.createElement('a');\n      a.id = job.id;","return;const a = document.createElement('a');\n      a.id = job.id;")],
 ['changed role element type',s=>exact(s,"const a = document.createElement('a');\n      a.id = job.id;","const a = document.createElement('div');\n      a.id = job.id;")],
 ['wrong createElement receiver',s=>exact(s,"const a = document.createElement('a');\n      a.id = job.id;","const a = document.createElement.call({},'a');\n      a.id = job.id;")],
 ['wrong append receiver',s=>exact(s,'listEl.appendChild(a);','listEl.appendChild.call({},a);')],
 ['overwritten same-record title',s=>exact(s,'titleDiv.textContent = job.title;',"titleDiv.textContent = job.title;titleDiv.textContent='Changed';")],
 ['destructured record replacement',s=>exact(s,'titleDiv.textContent = job.title;',"({title:job.title}={title:'Changed'});titleDiv.textContent = job.title;")],
 ['collection replacement after assignment',s=>exact(s,"      // Read initial filters from URL","      state.jobs=[];\n      // Read initial filters from URL")],
 ['invoked state mutator alias',s=>exact(s,"      // Read initial filters from URL","      const rewrite=Object.assign.bind(Object,state);rewrite({jobs:[]});\n      // Read initial filters from URL")],
 ['default filter helper mutates record',s=>exact(s,'return job.addressCountry || job.location || null;',"job.applyUrl='https://other.invalid/apply';return job.addressCountry || job.location || null;")],
 ['render list-selector mismatch',s=>exact(s,"    const listEl = document.querySelector('div.careers-job-list');\n    const emptyEl", "    const listEl = document.querySelector('div.careers-empty-state');\n    const emptyEl")],
 ['initializer return before fetch',s=>exact(s,'      const res = await fetch(API_URL);','      return;const res = await fetch(API_URL);')],
 ['falsey loop fetch',s=>exact(s,'      const res = await fetch(API_URL);','      while(0){const res=await fetch(API_URL);}const res={json:async()=>({jobs:[]})};')]
])test('Configured consumer holds '+name,()=>refuse(programme(edit)))

for(const[name,source]of[
 ['global fetch assignment','window.fetch=()=>null;'],
 ['unqualified fetch assignment','fetch=()=>null;'],
 ['classic global fetch variable','var fetch=()=>null;'],
 ['classic global fetch declaration','function fetch(){return null}'],
 ['global document method assignment','document.createElement=()=>null;'],
 ['global document method destructure','({x:document.createElement}={x:()=>null});'],
 ['global method array target','[document.querySelector]=[()=>null];'],
 ['global method for-of target','for(document.querySelector of [()=>null]){}'],
 ['bound critical method replacement',"const replace=Object.assign.bind(Object,document);replace({createElement:()=>null});"],
 ['spread critical method replacement',"Object.assign(...[document,{querySelector:()=>null}]);"],
 ['Reflect.apply critical method replacement',"Reflect.apply(Reflect.set,Reflect,[document,'createElement',()=>null]);"],
 ['Array primitive method replacement','Array.prototype.forEach=()=>null;'],
 ['String primitive method replacement','String.prototype.includes=()=>true;'],
 ['URLSearchParams method replacement','URLSearchParams.prototype.getAll=()=>["India"];'],
 ['global location query replacement','window.location.search="?location=India";']
]){test('Configured consumer holds before-client '+name,()=>refuse(before(source)));test('Configured consumer holds after-client '+name,()=>refuse(after(source)))}

for(const[name,edit]of[
 ['comments',s=>s+'\n// compatible publisher release\n'],
 ['coherent local renames',s=>s.replace(/\bAPI_URL\b/g,'currentEndpoint').replace(/\bfilteredJobs\b/g,'filteredJobs').replace(/\btitleDiv\b/g,'roleTitleElement')],
 ['finite call syntax',s=>exact(s,'      renderList();\n      initDropdowns();','      renderList.call(null);\n      initDropdowns();')],
 ['finite reflected DOM arguments',s=>exact(s,"const a = document.createElement('a');\n      a.id = job.id;","const a = Reflect.apply(document.createElement,document,['a']);\n      a.id = job.id;")],
 ['finite immutable DOM argument alias',s=>exact(s,"const a = document.createElement('a');\n      a.id = job.id;","const roleArgs=['a'];const a = document.createElement.apply(document,roleArgs);\n      a.id = job.id;")],
 ['unrelated sparse spread',s=>s+'\nMath.max(...[,1]);'],
 ['unrelated sparse apply',s=>s+'\nMath.max.apply(null,[,1]);']
])test('Configured consumer preserves '+name,()=>assert.equal(qualify(programme(edit)).proxyURL,PROXY))

test('Configured consumer preserves unrelated dormant function and scoped browser shadow',()=>assert.equal(qualify(before('function unrelated(){window.fetch=()=>null}function scoped(window){window.fetch=()=>null}')).proxyURL,PROXY))
test('Configured consumer preserves unused bound mutation',()=>assert.equal(qualify(before('const unusedReplace=Object.assign.bind(Object,document,{createElement:()=>null});')).proxyURL,PROXY))
test('Configured consumer ignores actual non-JavaScript data blocks',()=>assert.equal(qualify(exact(original,script[0],'<script type="application/json">{"fetch":"irrelevant"}</script>'+script[0])).proxyURL,PROXY))
test('Configured consumer qualifies mixed-case active classic MIME',()=>assert.equal(qualify(exact(original,script[0],'<script type=" Text/JavaScript ">'+script[2]+'</script>')).proxyURL,PROXY))
test('Configured consumer holds mixed-case active foreign overwrite',()=>refuse(exact(original,script[0],'<script type="Text/JavaScript">fetch=()=>null;</script>'+script[0])))

export{qualify,programme,original,before,after,refuse,exact}
