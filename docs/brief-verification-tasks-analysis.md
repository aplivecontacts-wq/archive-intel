# Verification Tasks: How It Works and Whether It Blocks the Others

## How Verification Tasks Works

**Prompt:**
- Section 4 "WHAT WOULD DISPROVE (MANDATORY FALSIFICATION TEST)" is long: unacceptable/acceptable examples, "At least one task must…", "verification_tasks must include BOTH: (1) falsification test, (2) other verification tasks."
- In SCHEMA RULES: "REQUIRED: (1) At least one verification_tasks entry MUST be an explicit falsification test… (2) Also include other verification_tasks… Output multiple verification_tasks—both the falsification one and the rest."
- **User message** (sent with every request): "You MUST include at least one verification_task that is an explicit falsification test… Also include other verification_tasks… Output multiple verification_tasks—both the falsification one and the rest—not only one task."

**Validation:**
- verification_tasks must be an array. Each item: task (string), priority (high/medium/low), suggested_queries (array). No reference to evidence_index. So the model can fill verification_tasks with plain text and arrays only—no need to build evidence_index or cite IDs.

**Why it shows:**
- Model gets repeated, explicit "REQUIRED" and "MUST" for verification_tasks in both system prompt and user message.
- Filling it is low-risk: no evidence_index IDs, no cross-references. So the model reliably outputs a non-empty array.

## How Executive Overview Works

- Coerced to string in validation (never throw). Listed first in schema; "ANALYST TONE" describes it. No refs. So it’s easy and always present.

## Why Timeline / Entities / Contradictions Don’t Show

- They **depend on evidence_index**: timeline entries need source_ids, entities need source_refs, and those IDs must exist in evidence_index. So the model must (1) build evidence_index from the payload, (2) then cite those IDs in timeline and entities.
- In the prompt we say "Build evidence_index… Then populate working_timeline…" but we never give them the same **REQUIRED** / **MUST** treatment as verification_tasks. So the model can satisfy the brief by filling executive_overview + verification_tasks and leaving the rest empty.
- **User message** only says "MUST include… verification_task" and says nothing about evidence_index, working_timeline, or key_entities. So at request time the model is steered strongly toward verification_tasks and gets no matching nudge for timeline/entities.

## Is Verification Tasks “Blocking” the Others?

**Not by validation:** Validation doesn’t drop or strip timeline/entities. If the model sent them, they’d be saved. We only throw when structure is invalid (e.g. refs not in evidence_index). So the brief that the user sees has empty arrays because the model **chose** to send empty arrays, not because we threw them away.

**Yes by prompt and request design:**
1. **Imbalance:** verification_tasks gets "REQUIRED" and "MUST" in both system and user message; working_timeline and key_entities get "Then populate… at least 1–5 when evidence exists" but no "REQUIRED" or "MUST" in the schema or in the user message. So the model treats verification_tasks as mandatory and timeline/entities as optional.
2. **User message:** The only "MUST" in the request is about verification_tasks. So the model prioritizes that and can ignore the evidence-mapping and timeline/entities instructions that appear only in the system prompt.
3. **Ease:** verification_tasks doesn’t need evidence_index; timeline/entities do. So even if the model tries to fill timeline/entities, it might skip them to avoid building evidence_index or making ref mistakes.

## Fixes Applied

1. **Schema:** Add an explicit **REQUIRED** line for working_timeline and key_entities (when evidence exists), in the same style as verification_tasks, so they are clearly mandatory too.
2. **User message:** Add a line that asks for evidence_index + working_timeline + key_entities at request time (e.g. "Build evidence_index from the payload and fill working_timeline and key_entities with at least 1 entry each when the payload has evidence.") so the model gets a balanced signal and doesn’t only hear "MUST… verification_task."
