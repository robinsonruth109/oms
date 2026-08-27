# Daily Source Status - Ready Split

- Ready: selected import/create-date filter + current READY_TO_SHIP.
- Today Ready: same filtered READY_TO_SHIP orders + Ready To Ship Date = today's Bangladesh date.
- Date Memo: same filtered READY_TO_SHIP orders + Ready To Ship Date > today's Bangladesh date.

The report From/To filter remains based on createdAt/import date. Bangladesh business-date helpers are used for Ready To Ship date comparison. No Prisma migration is required.
