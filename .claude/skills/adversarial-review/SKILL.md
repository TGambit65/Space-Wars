---
name: adversarial-review
description: Perform a rejection-first audit of code, documents, plans, analyses, or operational work against explicit requirements and available evidence. Use when the user wants a rigorous review, red-team critique, acceptance check, or adversarial validation rather than a supportive summary.
---

# Adversarial Review

Use this skill to audit a submission as an independent reviewer. Assume the work came from another contributor. Your job is to find reasons to reject it unless the evidence clearly supports acceptance.

## When To Use

Use this skill when the user asks for:
- a rigorous review, red-team pass, or adversarial audit
- acceptance validation against requirements, scope, or constraints
- defect finding in code, plans, documents, business work, or operations work
- a review that must separate verified facts from assumptions and unknowns

Do not use this skill for casual feedback, friendly rewriting, or brainstorming unless the user explicitly wants a strict audit.

## Inputs

Collect or confirm these inputs before reviewing:
- `Objective`
- `Scope to review`
- `Requirements/constraints/acceptance criteria`
- `Available source material or evidence for verification`
- `Domain`: `code`, `business`, `operations`, or `general`

If the user has not provided enough information, ask only for the missing items needed to perform the review. If they want a reusable prompt shell, use [review-template.md](./references/review-template.md).

## Review Rules

- Do not defend prior decisions or infer intent in the author's favor.
- Distinguish strictly between:
  - verified
  - partly verified
  - unverified
  - unverifiable from current evidence
- Never claim a fact, citation, test result, approval, or execution result unless it is present in the supplied material or you actually performed it.
- Prefer substantive defects over style or wording nits.
- Do not drift outside the provided scope while fixing issues.
- Apply only fixes justified by the evidence.
- Show what changed; do not silently patch.

## Review Workflow

### 1. Establish verification limits

Start by restating:
- the objective
- the exact scope
- the requirements
- what evidence is available
- what cannot be verified from that evidence

If evidence is missing, say so plainly and identify the exact missing material needed.

### 2. Build a requirement checklist

Create a checklist covering every requirement or acceptance criterion. Mark each item as:
- `Met`
- `Partially met`
- `Not met`
- `Cannot verify`

Do not skip implied constraints if they are necessary for acceptance.

### 3. Review in separate passes

Run these passes in order:

1. Coverage and completeness
2. Correctness, logic, calculations, and internal consistency
3. Security, privacy, compliance, and safety risks when relevant
4. Hallucinations, unsupported claims, invented facts, and unverifiable assumptions
5. Edge cases, failure modes, maintainability, clarity, usability, and business impact

### 4. Report issues rigorously

For every issue found, include:
- `Severity`: `Critical`, `High`, `Medium`, or `Low`
- `Exact location or section`
- `Why it is a problem`
- `Specific correction`
- `Verification status`: `verified` or `uncertain`

Order findings by severity, then by impact within the same severity.

### 5. Apply justified fixes

Fix what can be fixed from the available information.

- If the artifact is editable, patch it directly.
- If the artifact is not editable from context, provide a revised version or a precise patch.
- If a correction depends on missing evidence, do not invent the answer. Mark it uncertain.

### 6. Show all changes

After each fix pass:
- summarize the changes made
- show the revised text, patch, or concrete deltas

### 7. Re-review the revised work

After applying fixes, run the review again against the revised version.

Stop only when:
- one full review cycle finds no substantive issues, or
- five total review cycles have been completed

If you stop because the cycle limit is reached, say so explicitly.

## Domain Rules

### Code

Also check:
- syntax
- runtime assumptions
- dependency assumptions
- error handling
- security exposure
- edge cases and failure modes
- test coverage and verification quality

If you did not execute the code, state exactly:

`Not executed; suggested tests: ...`

When possible, run the smallest reliable verification commands that match the scope.

### Business or operations

Also check:
- assumptions and hidden dependencies
- arithmetic and feasibility
- stakeholder impact
- compliance exposure
- decision risk
- missing operational detail

### General

Apply the same adversarial standard and adapt the review passes to the artifact type without inventing domain-specific checks that the evidence cannot support.

## Required Output

Always structure the result as:

- `A. Objective, scope, and verification limits`
- `B. Requirement checklist`
- `C. Issues found by severity`
- `D. Fixes applied`
- `E. Remaining risks/unknowns`
- `F. Final verdict: READY or NOT READY`
- `G. Revised work or patch`

If there are no substantive issues, say so explicitly in section `C` and keep the verdict evidence-based.
