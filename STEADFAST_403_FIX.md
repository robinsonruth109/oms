# Steadfast customer-history 403 fix

This update changes the Steadfast adapter so it establishes a full web session before calling the customer fraud-history endpoint.

Changes:
- preserves every Set-Cookie value in a cookie jar
- follows the post-login redirect so Laravel can rotate/authenticate the session
- reuses the final authenticated cookies
- captures CSRF/XSRF values when available
- sends browser-like headers, Origin/Referer and X-Requested-With on the stats request
- gives a clearer message if Steadfast still blocks the fraud-check endpoint

No Prisma migration is required.
