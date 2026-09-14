# Staff Recruitment Bangla PDF Shaping Fix

## Problem
Recruitment PDFs were generated with `pdf-lib` using `NotoSansBengali-Regular.ttf`. The font itself contained Bengali glyphs, but the PDF text drawing path did not reliably perform the complex-script shaping required for Bengali. This made valid source text appear visually misspelled: vowel signs, conjuncts and reph/kar placement could be wrong even when the source string was correct.

## Fix
Recruitment/HR PDFs are now rendered as HTML in Chromium using the bundled Noto Sans Bengali font. Chromium performs OpenType Bengali shaping correctly.

Affected documents:
- 15-day preliminary appointment letter
- 15-day confidentiality/responsibility agreement
- permanent joining letter
- long-term appointment letter
- 6-month employment/confidentiality agreement
- termination letter

Additional safeguards:
- Unicode strings are normalized to NFC before rendering.
- The local Bengali font is embedded as a data URI, so PDF rendering does not depend on an external URL.
- PDF work is serialized and a Chromium browser is reused within the recruitment module.
- Railway-friendly Chromium flags and EAGAIN retry logic are included.
