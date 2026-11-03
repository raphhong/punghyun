/** Offline proposal validation only. No DB/config mutation or permission to spend.
 * Sum full environment CAPS, not remaining balances. Outstanding UNKNOWN is never refunded.
 * Actual approval must reconcile/freeze each issuer's caps before issuing disjoint allocations. */
export type BudgetAllocationProposal={globalMicrousd:number;globalCalls:number;environments:{id:string;capMicrousd:number;capCalls:number;reservedMicrousd:number;reservedCalls:number;ledgerRef:string}[]};
export function validateBudgetAllocation(p:BudgetAllocationProposal){
 const integer=(n:number)=>Number.isSafeInteger(n)&&n>=0;
 if(!p||!integer(p.globalMicrousd)||!integer(p.globalCalls)||!Array.isArray(p.environments)||!p.environments.length||new Set(p.environments.map(e=>e.id)).size!==p.environments.length)throw Error('allocation_invalid');
 let committedCapacity=0,committedCalls=0,reservedMicrousd=0,reservedCalls=0;
 for(const e of p.environments){if(!e.id||!e.ledgerRef||![e.capMicrousd,e.capCalls,e.reservedMicrousd,e.reservedCalls].every(integer)||e.reservedMicrousd>e.capMicrousd||e.reservedCalls>e.capCalls)throw Error('allocation_invalid');committedCapacity+=e.capMicrousd;if(!Number.isSafeInteger(committedCapacity)||committedCapacity>p.globalMicrousd)throw Error('global_budget_exceeded');committedCalls+=e.capCalls;reservedMicrousd+=e.reservedMicrousd;reservedCalls+=e.reservedCalls;if(![committedCalls,reservedMicrousd,reservedCalls].every(integer)||committedCalls>p.globalCalls)throw Error('global_call_limit_exceeded');}
 return {committedCapacityMicrousd:committedCapacity,committedCalls,reservedMicrousd,reservedCalls,unallocatedCalls:p.globalCalls-committedCalls,unallocatedMicrousd:p.globalMicrousd-committedCapacity,executionAllowed:false as const,billingVerified:false as const,approvalVerified:false as const};
}
