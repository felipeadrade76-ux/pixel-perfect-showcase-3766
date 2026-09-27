#!/usr/bin/env bash
set -euo pipefail
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
run_payment() {
  local name="$1" request="$2"
  if psql -X -v ON_ERROR_STOP=1 -c "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false); SELECT (public.oficinia_registrar_pagamento('33333333-3333-4333-8333-333333333333','$request',80,'Pix')).id;" >"$tmp/$name.log" 2>&1; then
    echo 0 >"$tmp/$name.exit"
  else
    echo 1 >"$tmp/$name.exit"
  fi
}
run_payment first 77777777-7777-4777-8777-777777777777 &
a=$!
run_payment second 88888888-8888-4888-8888-888888888888 &
b=$!
wait "$a" "$b"
first="$(cat "$tmp/first.exit")"
second="$(cat "$tmp/second.exit")"
if [[ $((first+second)) -ne 1 ]]; then
  echo "Expected exactly one of two concurrent R$80 payments to be rejected." >&2
  cat "$tmp/"*.log >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -c "
DO \$\$
DECLARE n integer; v numeric;
BEGIN
 SELECT jsonb_array_length(pagamentos), (pagamentos->0->>'valor')::numeric
 INTO n,v FROM public.ordens WHERE id='33333333-3333-4333-8333-333333333333';
 IF n <> 1 OR v <> 80 THEN RAISE EXCEPTION 'Concurrent payments corrupted order'; END IF;
END \$\$;"
echo PHASE2_CONCURRENT_PAYMENT_TEST_PASSED
