import {adviseWeaponRoll} from "../core/weapon-roll-advisor.mjs";
import {createPerkChangePlan,confirmPerkChangePlan,applyConfirmedPerkChangePlan} from "../pages/guardian-workspace-v2/guardian-perk-change-plan.mjs";

const fail=message=>{throw new Error(message);};
const intelligence={perks:{"200":{name:"Verified synergy perk",emits:["volatile"],consumes:[],conditions:["weapon-final-blow"],roles:["ability-loop"],strengths:[],limitations:[],evidence:[{source:"curated-test"}]}}};
const weapon={itemHash:10,itemInstanceId:"instance-1",selectedPerkHashes:["100"],selectedPerks:[{hash:"100",socketIndex:3}],perkColumns:[{socketIndex:3,options:[{hash:"100",name:"Current perk",socketIndex:3},{hash:"200",name:"Verified synergy perk",socketIndex:3}]}]};
const context={desiredTokens:["volatile"],emittedTokens:[],preferredRoles:["ability-loop"],activityNeeds:[]};

const recommendationOnly=adviseWeaponRoll({weapon,intelligence,context});
if(!recommendationOnly.hasVerifiedRecommendation)fail("Verified owned perk was not recommended.");
if(recommendationOnly.action.remotePerkMutationSupported)fail("Remote mutation enabled without an explicit capability.");
if(recommendationOnly.stagedChanges?.[0]?.plugHash!=="200")fail("Exact owned plug was not staged.");

const enabled=adviseWeaponRoll({weapon,intelligence,context,capabilities:{insertSocketPlugFree:true}});
if(enabled.action.mode!=="confirm-required")fail("Enabled socket action did not require confirmation.");
const plan=createPerkChangePlan({characterId:"character-1",advice:{...enabled,remotePerkMutationSupported:true}});
if(plan.status!=="staged"||plan.changes.length!==1)fail("Perk change plan was not staged.");
let blocked=false;try{await applyConfirmedPerkChangePlan(plan,{fetchImpl:async()=>({ok:true,json:async()=>({ErrorCode:1})})});}catch{blocked=true;}
if(!blocked)fail("Unconfirmed plan reached the remote action.");
const confirmed=confirmPerkChangePlan(plan);
let request=null;
const applied=await applyConfirmedPerkChangePlan(confirmed,{fetchImpl:async (url,init)=>{request={url,init};return {ok:true,status:200,json:async()=>({ErrorCode:1,Message:"Ok"})};},endpoint:"/test/socket-plug-free"});
if(applied.status!=="applied")fail("Confirmed plan did not return applied status.");
const body=JSON.parse(request.init.body);
if(body.changes[0].itemInstanceId!=="instance-1"||body.changes[0].socketIndex!==3||body.changes[0].plugHash!==200)fail("Remote payload lost exact instance/socket/plug identity.");

console.log("WEAPON PERK APPLY CONTRACT PASSED.");
