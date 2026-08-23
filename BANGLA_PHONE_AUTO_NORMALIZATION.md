# Bangla Phone Number Auto-Normalization

This upgrade converts Bangla digits (০১২৩৪৫৬৭৮৯) to English/ASCII digits (0123456789) automatically.

Applied to:
- Calling Panel phone editing
- Calling Panel order detail editing
- Manual Order Entry phone field
- Calling Panel server-side save
- Manual order server-side create
- Pathao validation/submission
- Courier score phone lookup

Examples:
- `০১৯৩৬৩১৩৭২১` -> `01936313721`
- `+৮৮০১৭১২৩৪৫৬৭৮` -> `01712345678`

Important: Pathao dispatch also normalizes existing historical orders at submission time, so old orders already stored with Bangla numerals do not need a database migration before retrying.

No Prisma migration is required.
