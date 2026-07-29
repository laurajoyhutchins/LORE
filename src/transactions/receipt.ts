import {createHash} from 'node:crypto';import {stableYaml} from '../serialization/yaml.js';import type {LoreProposal,TransactionReceipt} from '../domain/types.js';
export function transactionId(p:LoreProposal){return `tx-${createHash('sha256').update(stableYaml(p)).digest('hex').slice(0,24)}`}
export function createReceipt(p:LoreProposal,accepted_at:string,records:string[],outputs:string[]):TransactionReceipt{return{schema_version:1,transaction_id:transactionId(p),proposal_id:p.proposal_id,base_revision:p.base_revision,accepted_at,records:[...records].sort(),outputs:[...outputs].sort()}}
