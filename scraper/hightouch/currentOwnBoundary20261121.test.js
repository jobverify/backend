import test from 'node:test'
import assert from 'node:assert/strict'
import './currentGlobalStateNeighbor20261121.test.js'
import {empty,held,HOME,FEED,AU,SG,close,exact} from './currentConfiguredBoard20261121.test.js'
import {PAGE} from './currentProgrammeBoundary20261121.test.js'

const ownScript=(code,type)=>close(HOME,html=>exact(html,'</body>','<script'+(type?' type="'+type+'"':'')+'>'+code+'</script></body>'))
const programme=code=>close(PAGE,text=>text+'\n'+code+'\n')
const roleCountry=(id,country)=>(q,url)=>{if(url!==FEED)return;const model=JSON.parse(q.text),row=model.jobs.find(row=>row.id===id);assert(row);assert.equal(row.address.postalAddress.addressCountry,undefined);row.address.postalAddress.addressCountry=country;q.text=JSON.stringify(model)}

const ownNegative=[
 ['unqualified assignment','__NEXT_DATA__={};'],
 ['classic var initializer','var __NEXT_DATA__={};'],
 ['classic global function','function __NEXT_DATA__(){}'],
 ['object destructuring','({current:__NEXT_DATA__}={current:{}});'],
 ['array destructuring','[__NEXT_DATA__]=[{}];'],
 ['for-of identifier target','for(__NEXT_DATA__ of[{}]){}'],
 ['delete identifier','delete __NEXT_DATA__;'],
 ['literal spread Object.assign','Object.assign(...[window,{__NEXT_DATA__:{}}]);'],
 ['immutable tuple Object.assign','const ownArguments=[window,{__NEXT_DATA__:{}}];Object.assign(...ownArguments);'],
 ['bound Reflect.set','const ownReplace=Reflect.set.bind(Reflect);ownReplace(window,"__NEXT_DATA__",{});'],
 ['bound partial argument spread','const ownReplace=Object.assign.bind(Object,...[window]);ownReplace({__NEXT_DATA__:{}});'],
 ['nested apply spread','Object.assign.apply(null,[...[window],{__NEXT_DATA__:{}}]);'],
 ['sparse critical argument tuple','Object.assign(...[window,,{__NEXT_DATA__:{}}]);'],
 ['mixed-case active JavaScript','window.__NEXT_DATA__={};','Text/JavaScript'],
 ['qualified namespace','self.Reflect.deleteProperty(window,"__NEXT_DATA__");']
]
for(const[name,code,type]of ownNegative)test('Own current state: '+name+' holds original JSON authority',async()=>{await held(ownScript(code,type))})

for(const[name,code,type]of[
 ['function-local state','function ownLocal(){var __NEXT_DATA__={ordinary:true};return __NEXT_DATA__;}'],
 ['module-local state','var __NEXT_DATA__={ordinary:true};','module'],
 ['class static local state','class OwnLocal{static{var __NEXT_DATA__={ordinary:true};this.value=__NEXT_DATA__;}}'],
 ['unused bound mutator','const ownUnused=Object.assign.bind(Object,window);'],
 ['unrelated sparse spread','Math.max(...[,1]);'],
 ['unrelated sparse apply','Math.max.apply(null,[,1]);'],
 ['inactive data block','window.__NEXT_DATA__={};','application/json']
])test('Own current state: '+name+' preserves genuine publication',async()=>{await empty(ownScript(code,type))})

for(const[name,code]of[
 ['Turbopack browser assignment','window.TURBOPACK=[];'],
 ['Turbopack classic var initializer','var TURBOPACK=[];'],
 ['Turbopack global function','function TURBOPACK(){}'],
 ['Turbopack destructured member target','({current:window.TURBOPACK}={current:[]});'],
 ['Turbopack Object.assign','Object.assign(window,{TURBOPACK:[]});'],
 ['Turbopack bound Reflect.set','const registryReplace=Reflect.set.bind(Reflect);registryReplace(window,"TURBOPACK",[]);'],
 ['Next route browser assignment','window.__NEXT_P=[];'],
 ['Next route bound Object.assign','const routeReplace=Object.assign.bind(Object,window);routeReplace({__NEXT_P:[]});'],
 ['Next route invoked spread','Object.assign(...[window,{__NEXT_P:[]}]);'],
 ['escaped Turbopack array','const escapedRegistry=window.TURBOPACK;escapedRegistry.length=0;'],
 ['escaped Next route array','const escapedRoutes=window.__NEXT_P;escapedRoutes.splice(0);'],
 ['later disconnected Next registration','window.__NEXT_P.push(["/careers/[slug]",()=>null]);'],
 ['later native settings root replacement','window.__Ashby={settings:{ashbyBaseJobBoardUrl:"https://other.invalid"}};'],
 ['later bound native settings root replacement','const settingsReplace=Object.assign.bind(Object,window);settingsReplace({__Ashby:{settings:{autoLoad:false}}});']
])test('Connected registry: '+name+' cannot reuse disconnected consumer',async()=>{await held(programme(code))})

for(const[name,code]of[
 ['function-local browser alias','function registryLocal(window){window.TURBOPACK=[];window.__NEXT_P=[];}'],
 ['unrelated release analytics','Object.assign(window,{ownReleaseAnalytics:{version:2}});']
])test('Connected registry: '+name+' preserves current consumer',async()=>{await empty(programme(code))})

for(const[name,row,country]of[['Australia',AU,'Australia'],['Singapore',SG,'Singapore']]){
 test('Current exclusive '+name+' criteria contradict a newly typed foreign primary',async()=>{await held(roleCountry(row.id,'United States'))})
 test('Current exclusive '+name+' criteria agree with a newly typed primary',async()=>{const result=await empty(roleCountry(row.id,country));assert.equal(result.audit.observations[1].rows.find(value=>value.id===row.id).primaryCountry,country)})
}
