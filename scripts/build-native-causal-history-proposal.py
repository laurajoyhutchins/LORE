#!/usr/bin/env python3
import hashlib
import json
import subprocess
from pathlib import Path

BASE = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
SKILL = "skills/maintain-repository-documentation/SKILL.md"
EVIDENCE_REVISION = "febd06c201868fe16c0ffed3866b5cbf92c37abc"
EVIDENCE_PATH = "docs/superpowers/specs/2026-07-28-lore-design.md"


def evidence():
    return [{"revision": EVIDENCE_REVISION, "path": EVIDENCE_PATH}]


def record(kind, ident, title, summary, payload=None):
    return {
        "schema_version": 1,
        "id": ident,
        "kind": kind,
        "revision": 1,
        "status": "active",
        "title": title,
        "summary": summary,
        "scope": {"repository": "lore", "components": []},
        "evidence": evidence(),
        "disclosure": {
            "audiences": ["maintainer"],
            "tags": ["causal-history", kind],
            "weight": 90,
        },
        "provenance": {
            "source": "proposal",
            "transaction": None,
            "producer": "ChatGPT GPT-5.6 Sol",
        },
        "supersedes": None,
        "payload": payload or {},
    }


def ref(kind, ident):
    return f"lore://lore/{kind}/{ident}@1"


operations = []


def append(value):
    operations.append({"operation": "append_record", "record": value})


for item in [
    ("constraint", "constraint.durable-repository-knowledge", "Durable repository knowledge", "Repository knowledge must persist as reviewable, versioned Git state and remain usable by arbitrary maintainers."),
    ("finding", "finding.git-history-is-not-semantic-knowledge", "Git history is not semantic knowledge", "Git provides durable review and reconstruction, but accepted semantic records are still required to preserve architectural interpretation explicitly."),
    ("finding", "finding.generated-prose-is-not-authority", "Generated prose is not authority", "Human-readable Markdown is a generated view and cannot be the authoritative representation of accepted repository meaning."),
    ("decision", "decision.repository-local-knowledge-protocol", "Repository-local knowledge protocol", "LORE stores reviewed semantic knowledge, evidence, transactions, and deterministic views inside the repository under explicit contracts."),
    ("constraint", "constraint.separate-facts-meaning-and-views", "Separate facts, meaning, and views", "Deterministic observations, reviewed semantic meaning, and generated views must remain distinct authority layers."),
    ("finding", "finding.collapsed-document-authority-is-insufficient", "Collapsed document authority is insufficient", "A single prose document cannot safely distinguish replaceable extracted facts from append-only reviewed semantic meaning."),
    ("decision", "decision.separate-authority-layers", "Separate authority layers", "LORE gives extracted facts, semantic records, proposals, transactions, and projections distinct mutation and authority rules."),
]:
    append(record(*item))


def edge(ident, source, target, relation, rationale):
    append(record(
        "relationship",
        ident,
        ident.removeprefix("relationship.").replace("-", " ").replace(".", " ").title(),
        rationale,
        {"from": source, "to": target, "relation": relation, "rationale": rationale},
    ))


durable = ref("constraint", "constraint.durable-repository-knowledge")
git_finding = ref("finding", "finding.git-history-is-not-semantic-knowledge")
prose_finding = ref("finding", "finding.generated-prose-is-not-authority")
protocol = ref("decision", "decision.repository-local-knowledge-protocol")
separate_constraint = ref("constraint", "constraint.separate-facts-meaning-and-views")
collapsed = ref("finding", "finding.collapsed-document-authority-is-insufficient")
separate = ref("decision", "decision.separate-authority-layers")

for args in [
    ("relationship.durability-to-git-history-finding", durable, git_finding, "leads_to", "Requiring durable repository knowledge exposes the need to represent accepted meaning explicitly rather than rely on Git history alone."),
    ("relationship.durability-to-prose-finding", durable, prose_finding, "leads_to", "Requiring durable repository knowledge exposes generated prose as a view rather than an authority store."),
    ("relationship.git-history-finding-to-protocol", git_finding, protocol, "leads_to", "The gap between Git history and explicit accepted meaning motivates a repository-local semantic knowledge protocol."),
    ("relationship.prose-finding-to-protocol", prose_finding, protocol, "leads_to", "Keeping generated prose non-authoritative requires a repository-local semantic knowledge protocol beneath the views."),
    ("relationship.protocol-enables-lore", protocol, ref("repository", "repository.lore"), "enables", "The repository-local protocol is the accepted design that LORE implements and self-hosts."),
    ("relationship.protocol-requires-git-storage", protocol, ref("decision", "decision.git-backed-storage"), "requires", "A repository-local accepted-knowledge protocol requires durable versioned storage, review, and reconstruction in Git."),
    ("relationship.protocol-requires-agent-neutral-contract", protocol, ref("decision", "decision.agent-neutral-maintainer-contract"), "requires", "The protocol must remain usable by arbitrary maintainers, so maintenance is defined by public context and proposal contracts rather than agent identity."),
    ("relationship.protocol-requires-cli", protocol, ref("component", "component.cli"), "requires", "The repository-local protocol requires an executable public command surface for extraction, validation, context, proposals, transactions, and verification."),
    ("relationship.protocol-requires-bootstrap", protocol, ref("procedure", "procedure.bootstrap-repository"), "requires", "A repository-local self-describing protocol requires an explicit bootstrap procedure to establish and verify its trust root."),
    ("relationship.separation-to-collapse-finding", separate_constraint, collapsed, "leads_to", "The requirement to keep facts, reviewed meaning, and generated views distinct rules out a single collapsed document authority model."),
    ("relationship.collapse-finding-to-layer-decision", collapsed, separate, "leads_to", "The inability of one document layer to preserve distinct authority semantics motivates separate validated layers."),
    ("relationship.layers-require-extraction", separate, ref("component", "component.extraction"), "requires", "Separate authority layers require a deterministic extraction layer for replaceable repository observations."),
    ("relationship.layers-require-transactions", separate, ref("component", "component.transactions"), "requires", "Separate authority layers require transactional application so accepted semantic history changes through a validated boundary."),
    ("relationship.layers-require-validation", separate, ref("component", "component.validation"), "requires", "Separate authority layers require validation of schemas, evidence, records, and repository invariants."),
    ("relationship.layers-require-no-direct-mutation", separate, ref("constraint", "constraint.no-agent-direct-mutation"), "requires", "Append-only accepted meaning and generated views require maintainers to propose changes rather than mutate accepted history directly."),
    ("relationship.bootstrap-exposes-hand-authored-kernel", ref("procedure", "procedure.bootstrap-repository"), ref("finding", "finding.bootstrap-kernel-is-hand-authored"), "leads_to", "Self-hosting begins from an explicit hand-authored bootstrap kernel that must be reviewed before generated self-description can be trusted."),
]:
    edge(*args)

proposal = {
    "protocol": "lore-proposal/v1",
    "proposal_id": "native-causal-history-migration",
    "base_revision": BASE,
    "producer": {
        "type": "llm-maintainer",
        "name": "ChatGPT GPT-5.6 Sol",
        "model": "GPT-5.6 Sol",
    },
    "skill": {
        "path": SKILL,
        "digest": "sha256:" + hashlib.sha256(Path(SKILL).read_bytes()).hexdigest(),
    },
    "result": "changes_proposed",
    "operations": operations,
    "uncertainties": [
        "This transaction captures the two evidence-backed causal arcs and their direct implications for LORE's current accepted records; it does not claim complete archaeology beyond evidence in the approved design specification."
    ],
}

Path(".lore/proposals/native-causal-history-migration.yaml").write_text(
    json.dumps(proposal, indent=2) + "\n",
    encoding="utf-8",
)
