-- Guest pool buyer (matches lib/guest-checkout.ts + lib/mysql-guest-pool.ts).
-- STATUS omitted — use DB default (expected: LIVE).

INSERT INTO account_signup (
  EMAIL,
  ISHYIGA_ACCOUNT,
  TEL,
  TYPE,
  FIRSTNAME,
  LASTNAME,
  OWNER,
  PWD
) VALUES (
  'guest_pool@ihute.rw',
  'IHUTE_GUEST',
  'NA',
  'BUYER',
  'Guest',
  'Checkout',
  'Guest pool',
  ''
)
ON DUPLICATE KEY UPDATE
  ISHYIGA_ACCOUNT = VALUES(ISHYIGA_ACCOUNT),
  TEL = VALUES(TEL);
