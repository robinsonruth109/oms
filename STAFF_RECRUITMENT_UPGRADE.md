# Staff Recruitment upgrade

Adds an ADMIN-only Staff Recruitment module using the existing OMS User and Salary systems.

## Phase 1
- Create a new AGENT / NOTE_AGENT / PACKAGING_AGENT with full HR details, username/password and proposed basic salary.
- Starts a 15-day preliminary evaluation record.
- Generates a two-page Bangla office-pad PDF: preliminary appointment letter + confidentiality/responsibility agreement.
- NID is encrypted at rest with `SHOP_SETTINGS_ENCRYPTION_KEY`; only a hash and last four digits are kept for lookup/display.
- A SalaryProfile is created but disabled during the preliminary stage.

## Phase 2
- After the 15-day period, ADMIN can recruit permanently or terminate.
- Permanent recruitment enables the salary profile and creates a six-month agreement period.
- Permanent packet PDF contains: joining letter, long-term appointment letter, six-month agreement.
- Termination immediately deactivates the OMS user and disables salary-sheet participation; a termination-letter PDF is available.
- Full HR audit timeline is retained.

## Existing OMS users
Existing active agents without an HR profile can be attached as probationary or permanent staff without changing their password.

## Legal drafting guardrails
The generated documents preserve applicable-law priority for wages/allowances, working hours, deductions, salary changes, termination, and early-exit settlement. The early-exit amount is drafted as a capped, law-dependent settlement based on actual/documented loss or notice obligations—not an automatic penalty.
