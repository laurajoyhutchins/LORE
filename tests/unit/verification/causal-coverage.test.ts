import { expect, it } from "vitest";
import type { SemanticRecord, ValidatedRepository } from "../../../src/domain/types.js";
import { verifyCausalCoverage } from "../../../src/verification/causal-coverage.js";
const sha = "0123456789abcdef0123456789abcdef01234567";
const make = (kind: SemanticRecord["kind"], id: string): SemanticRecord => ({ schema_version:1,id,kind,revision:1,status:"active",title:id,summary:id,scope:{repository:"example",components:[]},evidence:[{revision:sha,path:"docs/design.md"}],disclosure:{audiences:[],tags:[],weight:1},provenance:{source:"bootstrap",transaction:null,producer:"test"},supersedes:null,payload:{} });
const repository = (records: SemanticRecord[]): ValidatedRepository => ({ root:".",revision:sha,records,effectiveStatus:new Map(),extracted:{},manifest:{schema_version:1,repository:{id:"example",name:"Example",root:"."},paths:{extracted:".lore/extracted",records:".lore/records",proposals:".lore/proposals",transactions:".lore/transactions",generated_docs:"docs/generated",skills:"skills"},extractors:[],projections:[],maintenance:{skill:"skills/x",proposal_schema:"schemas/x"},hydration:{max_records:20,max_characters:40000},causality:{roots:["lore://example/constraint/constraint.root@1"]}} });
it("passes when every active record is reachable from a configured root", () => {
  const root=make("constraint","constraint.root"), target=make("decision","decision.target"), edge=make("relationship","relationship.root-target");
  edge.payload={from:"lore://example/constraint/constraint.root@1",to:"lore://example/decision/decision.target@1",relation:"leads_to",rationale:"Root leads to target."};
  expect(verifyCausalCoverage(repository([root,target,edge]))).toEqual([]);
});
it("fails for an active semantic record outside every configured root graph", () => {
  const problems=verifyCausalCoverage(repository([make("constraint","constraint.root"),make("decision","decision.orphan")]));
  expect(problems.map(({code})=>code)).toContain("CAUSAL_COVERAGE_MISSING");
});
