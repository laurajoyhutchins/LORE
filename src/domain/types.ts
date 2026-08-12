export interface ValidationProblem { code:string; message:string; location?:string; record?:string; details?:Record<string,unknown> }
export type ValidationResult<T>={ok:true;value:T;warnings:ValidationProblem[]}|{ok:false;errors:ValidationProblem[]};
export type RecordKind='repository'|'component'|'relationship'|'decision'|'finding'|'constraint'|'procedure';
export type RecordStatus='draft'|'active'|'superseded'|'deprecated'|'resolved'|'withdrawn';
export interface EvidenceReference { revision:string; path:string; symbol?:string; lines?:{start:number;end:number} }
export interface SemanticRecord { schema_version:1; id:string; kind:RecordKind; revision:number; status:RecordStatus; title:string; summary:string; scope:{repository:string;components:string[]}; evidence:EvidenceReference[]; disclosure:{audiences:string[];tags:string[];weight:number}; provenance:{source:'bootstrap'|'proposal';transaction:string|null;producer:string}; supersedes:string|null; payload:Record<string,unknown> }
export type ProjectionId='readme'|'repository-card'|'architecture'|'component-catalog'|'current-decisions'|'maintainer-guide'|'trust-model'|'authority-and-file-ownership'|'adoption-tutorial'|'maintenance-workflow'|'proposal-review'|'cli-reference'|'data-model-reference';
export interface LoreManifest { schema_version:1; repository:{id:string;name:string;root:string}; paths:{extracted:string;records:string;proposals:string;transactions:string;generated_docs:string;skills:string}; extractors:Array<{id:string;enabled:boolean}>; projections:Array<{id:ProjectionId;output:string}>; maintenance:{skill:string;proposal_schema:string}; hydration:{max_records:number;max_characters:number} }
export interface LoreTask { schema_version:1; id:string; title:string; description:string; paths:string[]; components:string[]; tags:string[]; audiences:string[]; history:boolean }
export interface HydratedRecord { reference:string; score:number; reasons:string[]; record:SemanticRecord }
export interface HydrationPacket { schema_version:1; task:LoreTask; repository_revision:string; selected:HydratedRecord[]; evidence:EvidenceReference[]; validation_commands:string[]; omitted_record_count:number }
export type ProposalOperation={operation:'append_record';record:SemanticRecord}|{operation:'transition_record';record_id:string;from:RecordStatus;to:RecordStatus;evidence:EvidenceReference[]};
export interface LoreProposal { protocol:'lore-proposal/v1'; proposal_id:string; base_revision:string; producer?:{type?:string;name?:string;model?:string}; skill:{path:string;digest:string}; result:'changes_proposed'|'no_documentation_change'; reason?:string; operations:ProposalOperation[]; uncertainties:string[] }
export interface TransactionPlan { proposal:LoreProposal; recordsToCreate:Array<{path:string;record:SemanticRecord}>; transactionReceiptPath:string; generatedOutputs:Map<string,string> }
export interface TransactionReceipt { schema_version:1; transaction_id:string; proposal_id:string; base_revision:string; accepted_at:string; records:string[]; outputs:string[] }
export interface ExtractedFacts { repository?:unknown; scripts?:Record<string,string>; components?:unknown[]; relationships?:unknown[]; tests?:unknown[] }
export interface ValidatedRepository { root:string; manifest:LoreManifest; revision:string; records:SemanticRecord[]; effectiveStatus:Map<string,RecordStatus>; extracted:ExtractedFacts }
export interface LoreMaintainerContext { protocol:'lore-maintainer-context/v1'; task:LoreTask; packet:HydrationPacket; skill_path:string; output_schema_path:string; proposal_destination:string }
export interface RecordExplanation { reference:string; record:SemanticRecord; current_status:RecordStatus; predecessors:string[]; successors:string[]; related:string[]; introducing_transaction:string|null; superseding_transaction:string|null }
export interface DemoReport { steps:string[]; clean:boolean }
