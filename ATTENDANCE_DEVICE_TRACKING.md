# Attendance Device Tracking

This upgrade records the browser device used for each attendance action and shows it in **Attendance Daily Report**.

## What is recorded

For every new attendance event (Attend, Break, Back to Seat, Evening Break, Work Off), OMS stores:

- device type: `MOBILE`, `TABLET`, `DESKTOP`, or `UNKNOWN`
- operating system (for example Android, iOS/iPadOS, Windows, macOS)
- browser (for example Chrome, Safari, Microsoft Edge)
- raw browser User-Agent string for audit/debugging

The main Daily Records table uses the device from the **ATTEND** event. Phone/mobile attendance is displayed with a red badge. Desktop attendance is displayed with a green badge. Expanded attendance history shows the device for every event.

## Existing historical attendance

Device information was not stored before this upgrade, so old AttendanceEvent rows remain `NULL` and appear as **Unknown**. Device tracking starts after this migration is deployed.

## Important limitation

Device classification is based on browser headers/User-Agent. It is useful for office monitoring but is not tamper-proof; a technically advanced user can spoof a User-Agent. If strict office-only attendance is required later, combine this with an office IP/Wi-Fi allow-list or a registered-device policy.
