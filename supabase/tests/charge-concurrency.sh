#!/usr/bin/env bash
set -euo pipefail
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
charge() {
  local label="$1" request="$2"
  if psql -X -v ON_ERROR_STOP=1 -c "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false); SELECT (public.oficinia_criar_cobranca('33333333-3333-4333-8333-333333333333','$request',60,'Pix')).id;" >"$tmp/$label.log" 2>&1; then
    echo 0 >"$tmp/$label.exit"
  else
    echo 1 >"$tmp/$label.exit"
  fi
}
charge first 99999999-0000-4000-8000-000000000001 &
a=$!
charge second 99999999-0000-4000-8000-000000000002 &
b=$!
wait "$a" "$b"
first="$(cat "$tmp/first.exit")"
second="$(cat "$tmp/second.exit")"
if [[ $((first+second)) -ne 1 ]]; then
  echo "Expected exactly one concurrent R$60 charge on R$100 OS to succeed" >&2
  cat "$tmp/"*.log >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -c "
DO \$\$
DECLARE v_count integer; v_sum numeric;
BEGIN
 SELECT count(*), coalesce(sum(valor),0) INTO v_count,v_sum
 FROM public.cobrancas
 WHERE ordem_id='33333333-3333-4333-8333-333333333333' AND status='aguardando';
 IF v_count <> 1 OR v_sum <> 60 THEN RAISE EXCEPTION 'Concurrent charges exceeded available balance'; END IF;
END \$\$;"
echo ASSISTED_CHARGE_CONCURRENCY_PASSED
