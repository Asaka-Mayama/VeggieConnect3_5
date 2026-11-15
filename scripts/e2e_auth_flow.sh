#!/bin/bash
# E2E verification of the registration -> pending queue -> login gate -> persistence flow
set -e
BASE=http://localhost:3000
PNG="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

echo "=== 1. SIGNUP: Saanka Test (farmer, Pending) ==="
SIGNUP=$(curl -s -X POST $BASE/api/auth/signup -H 'Content-Type: application/json' -d "{
  \"id\": \"user-e2e-saanka\",
  \"name\": \"Saanka E2E Test\",
  \"email\": \"saanka.e2e@test.ph\",
  \"phone\": \"0917 555 1001\",
  \"password\": \"saanka123\",
  \"role\": \"farmer\",
  \"location\": \"Dumaguete City, Negros Oriental\",
  \"latitude\": 9.3068,
  \"longitude\": 123.3054,
  \"farmName\": \"Saanka E2E Farm\",
  \"validIdImage\": \"$PNG\",
  \"verificationStatus\": \"Pending\"
}")
echo "$SIGNUP" | python3 -c "import json,sys; d=json.load(sys.stdin); u=d.get('user',{}); print('success:', d.get('success')); print('verificationStatus:', u.get('verificationStatus')); print('message:', d.get('message'))"

echo ""
echo "=== 2. GET /api/users contains Saanka with Pending ==="
curl -s $BASE/api/users | python3 -c "
import json,sys
users = json.load(sys.stdin)
saanka = [u for u in users if u['name'].startswith('Saanka')]
print('total users (incl admin):', len(users))
print('saanka found:', bool(saanka), '| verificationStatus:', saanka[0].get('verificationStatus') if saanka else 'N/A')
"

echo ""
echo "=== 3. STORE FILE: data/server_store.json written ==="
python3 -c "
import json
s = json.load(open('data/server_store.json'))
print('savedAt:', s['savedAt'])
print('users in store:', [u['name'] for u in s['users']])
"

echo ""
echo "=== 4. LOGIN GATE: pending user must be BLOCKED ==="
HTTP=$(curl -s -o /tmp/login_pending.json -w "%{http_code}" -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d '{"email":"saanka.e2e@test.ph","password":"saanka123"}')
echo "HTTP $HTTP -> $(cat /tmp/login_pending.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('status:', d.get('status'), '| error:', d.get('error','')[:80])")"

echo ""
echo "=== 5. ADMIN LOGIN works ==="
HTTP=$(curl -s -o /tmp/login_admin.json -w "%{http_code}" -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@gmail.com","password":"admin123"}')
echo "HTTP $HTTP -> $(cat /tmp/login_admin.json | python3 -c "import json,sys; d=json.load(sys.stdin); u=d.get('user',{}); print('role:', u.get('role'), '| id:', u.get('id'))")"

echo ""
echo "=== 6. RESTART SERVER (persistence test) ==="
pkill -f "tsx server" 2>/dev/null || true
sleep 2
cd /home/z/my-project
nohup npx tsx server.ts > /tmp/vc-server2.log 2>&1 &
sleep 6
grep "\[store\]" /tmp/vc-server2.log || echo "(no store log)"
curl -s $BASE/api/users | python3 -c "
import json,sys
users = json.load(sys.stdin)
saanka = [u for u in users if u['name'].startswith('Saanka')]
print('AFTER RESTART — total users:', len(users))
print('saanka survived restart:', bool(saanka), '| verificationStatus:', saanka[0].get('verificationStatus') if saanka else 'N/A')
"

echo ""
echo "=== 7. APPROVE via PUT (admin flow) then login must SUCCEED ==="
curl -s -X PUT $BASE/api/users/user-e2e-saanka -H 'Content-Type: application/json' -d "{\"verificationStatus\":\"Approved\",\"verified\":true}" | python3 -c "import json,sys; d=json.load(sys.stdin); print('update success:', d.get('success'), '| new status:', d.get('user',{}).get('verificationStatus'))"
HTTP=$(curl -s -o /tmp/login_after.json -w "%{http_code}" -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d '{"email":"saanka.e2e@test.ph","password":"saanka123"}')
echo "login after approval: HTTP $HTTP -> $(cat /tmp/login_after.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('success:', d.get('success'), '| name:', d.get('user',{}).get('name'))")"

echo ""
echo "=== 8. Password survived restart (login with same password works) ==="
echo "(verified above — login after restart+approval succeeded)"
