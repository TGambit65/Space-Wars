# Adversarial Review Template

Use this template when the user wants the full review prompt shell filled in for a specific submission.

```text
Perform a rigorous adversarial review of the work provided below.

Do not behave as the author defending prior choices. Treat the work as a submission from another contributor that you are responsible for auditing. Your job is to find reasons to reject it unless it clearly meets the requirements.

Review inputs:
- Objective: [insert objective]
- Scope to review: [insert exact section, phase, or artifact]
- Requirements/constraints/acceptance criteria: [insert]
- Available source material or evidence for verification: [insert, or state "none"]
- Domain: [code/business/operations/general]

Review protocol:
1. First, restate the objective, scope, requirements, and what can and cannot be verified from the available information.
2. Build a requirement checklist and mark each item as:
   - Met
   - Partially met
   - Not met
   - Cannot verify
3. Review the work in separate passes:
   a. Coverage and completeness
   b. Correctness, logic, calculations, and internal consistency
   c. Security, privacy, compliance, and safety risks, when relevant
   d. Hallucinations, unsupported claims, invented facts, and unverifiable assumptions
   e. Edge cases, failure modes, maintainability, clarity, usability, and business impact
4. For every issue found, report:
   - Severity: Critical / High / Medium / Low
   - Exact location or section
   - Why is it a problem
   - The specific correction
   - Whether the correction is verified or still uncertain
5. Apply all justified fixes that can be made from the available information.
6. Do not silently patch issues. Show what changed.
7. After applying fixes, re-run the review on the revised work.
8. Stop only after one full clean review cycle finds no substantive issues, or after 5 total review cycles, whichever comes first.
9. Never claim a fact, citation, test result, execution result, approval, or verification unless it is actually available in the provided context or was explicitly performed.
10. If something cannot be verified, say so plainly and list the missing evidence needed to verify it.
11. Prefer substantive defects over cosmetic edits. Do not drift the scope while fixing.

Domain-specific rules:
- If this is code, also check syntax, runtime assumptions, error handling, edge cases, dependency assumptions, security exposure, and test coverage. If the code was not executed, explicitly say: "Not executed; suggested tests: ..."
- If this is business, operations, or administrative work, also check assumptions, arithmetic, feasibility, stakeholder impact, compliance exposure, decision risk, and missing operational details.

Required output format:
A. Objective, scope, and verification limits
B. Requirement checklist
C. Issues found by severity
D. Fixes applied
E. Remaining risks/unknowns
F. Final verdict: READY or NOT READY
G. Revised work or patch
```
