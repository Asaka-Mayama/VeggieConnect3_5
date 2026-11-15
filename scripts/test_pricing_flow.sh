#!/usr/bin/env bash
# E2E test of the DA-anchored pricing + multi-farmer split allocation engine.
set -e
B=http://localhost:3000
J='-H Content-Type:application/json'

echo "=== 1. Register accounts ==="
curl -s -X POST $B/api/auth/signup $J -d '{"name":"Pricing Buyer","email":"pbuyer@t.com","phone":"09170000001","password":"x","role":"buyer","location":"Dumaguete"}' | python3 -c "import json,sys;print('buyer:',json.load(sys.stdin)['user']['id'])" || true
curl -s -X POST $B/api/auth/signup $J -d '{"name":"Farmer Alan","email":"falan@t.com","phone":"09170000002","password":"x","role":"farmer","location":"Valencia","farmName":"Alan Farm"}' | python3 -c "import json,sys;print('farmerA:',json.load(sys.stdin)['user']['id'])" || true
curl -s -X POST $B/api/auth/signup $J -d '{"name":"Farmer Beth","email":"fbeth@t.com","phone":"09170000003","password":"x","role":"farmer","location":"Canlaon","farmName":"Beth Farm"}' | python3 -c "import json,sys;print('farmerB:',json.load(sys.stdin)['user']['id'])" || true

echo "=== 2. List farmer harvests (Ampalaya) ==="
NOW=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
PA=$(curl -s -X POST $B/api/products $J -d "{\"id\":\"prod-alan-amp\",\"farmerId\":\"farmer-alan-x\",\"farmerName\":\"Farmer Alan\",\"farmName\":\"Alan Farm\",\"name\":\"Ampalaya\",\"category\":\"Vegetables\",\"pricePerUnit\":65,\"farmgateAskingPrice\":65,\"unit\":\"kg\",\"stockQuantity\":12,\"harvestStatus\":\"Harvested Today\",\"harvestDate\":\"$NOW\",\"imageUrl\":\"\",\"isOrganic\":false,\"description\":\"\",\"location\":\"Valencia\"}" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('product',d).get('id',''))")
PB=$(curl -s -X POST $B/api/products $J -d "{\"id\":\"prod-beth-amp\",\"farmerId\":\"farmer-beth-x\",\"farmerName\":\"Farmer Beth\",\"farmName\":\"Beth Farm\",\"name\":\"Ampalaya\",\"category\":\"Vegetables\",\"pricePerUnit\":67,\"farmgateAskingPrice\":67,\"unit\":\"kg\",\"stockQuantity\":10,\"harvestStatus\":\"Harvested Today\",\"harvestDate\":\"$NOW\",\"imageUrl\":\"\",\"isOrganic\":false,\"description\":\"\",\"location\":\"Canlaon\"}" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('product',d).get('id',''))")
echo "farmerA lot: $PA | farmerB lot: $PB"
curl -s "$B/api/products" | python3 -c "
import json,sys
ps=json.load(sys.stdin)
for p in ps:
  if 'Ampalaya' in p.get('name',''): print('lot:',p['id'],p['farmerName'],'@',p['pricePerUnit'],'x',p['stockQuantity'],'kg')"

echo "=== 3. Buyer places 20kg Ampalaya request (request lot, DA-anchored price 71.50) ==="
OID="VC-REQ-9001"
curl -s -X POST $B/api/orders $J -d "{
  \"id\":\"$OID\",
  \"buyerId\":\"buyer-x\",\"buyerName\":\"Pricing Buyer\",\"buyerPhone\":\"09170000001\",
  \"farmerId\":\"admin-main\",\"farmName\":\"VeggieConnect Central Market\",
  \"sellerStoreName\":\"VeggieConnect Central Market\",
  \"deliveryType\":\"farm_pickup\",\"pickupSlot\":\"Tomorrow 9AM\",
  \"items\":[{\"produceId\":\"req-prod-9001-0\",\"produceName\":\"Ampalaya\",\"unitPrice\":71.50,\"pricePerUnit\":71.50,\"farmgateUnitPrice\":65,\"unit\":\"kg\",\"quantity\":20,\"farmName\":\"VeggieConnect Central Market\",\"farmerId\":\"admin-main\"}],
  \"subtotal\":1430,\"deliveryFee\":0,\"totalAmount\":1430,
  \"farmgateCostTotal\":1300,\"adminCommissionTotal\":130,
  \"status\":\"pending\",\"createdAt\":\"$NOW\",
  \"paymentMethod\":\"Over-the-Counter Cash at Depot\",
  \"notes\":\"test\"}" | python3 -c "import json,sys;d=json.load(sys.stdin);print('order created:',d.get('id'),d.get('status'))"

echo "=== 4. Admin fulfills (expect split allocation A@65 x12 + B@67 x8, weighted 65.80, profit 114) ==="
ORDER=$(curl -s $B/api/orders | python3 -c "
import json,sys
orders=json.load(sys.stdin)
for o in orders:
  if o['id']=='$OID': print(json.dumps(o)); break")
echo "$ORDER" | python3 -c "import json,sys; o=json.load(sys.stdin); print('items:',len(o['items']),'status:',o['status'])"
curl -s -X PUT $B/api/orders/$OID $J -d "$(echo "$ORDER" | python3 -c "import json,sys; o=json.load(sys.stdin); o['status']='confirmed'; print(json.dumps(o))")" > /tmp/fulfill_result.json
python3 - <<'EOF'
import json
d = json.load(open('/tmp/fulfill_result.json'))
if d.get('requiresQuote'):
    print('UNEXPECTED BLOCK:', d['error']); raise SystemExit(1)
allocs = d.get('sourcingAllocations', [])
print('status:', d.get('status'))
for a in allocs:
    print(f"  alloc: {a['quantity']}kg @PHP{a['farmgatePrice']} from {a.get('farmerName')} (warehouse={a.get('isWarehouse')})")
print('sourcingCostTotal:', d.get('sourcingCostTotal'), '(expect 1316.0)')
print('weightedAvgSourcingCost:', d.get('weightedAvgSourcingCost'), '(expect 65.8)')
print('netAdminProfit:', d.get('netAdminProfit'), '(expect 114.0)')
EOF

echo "=== 5. Farmer stocks deducted? ==="
curl -s "$B/api/products" | python3 -c "
import json,sys
ps=json.load(sys.stdin)
for p in ps:
  if p['id'] in ('prod-alan-amp','prod-beth-amp'): print(' ',p['id'],p['farmerName'],'stock:',p['stockQuantity'],'(expect 0 / 2)')"

echo "=== 6. LOSS scenario: farmer D asks 75 (> 71.50 buyer price) ==="
curl -s -X POST $B/api/auth/signup $J -d '{"name":"Farmer Dan","email":"fdan@t.com","phone":"09170000004","password":"x","role":"farmer","location":"Dumaguete","farmName":"Dan Farm"}' > /dev/null || true
PD=$(curl -s -X POST $B/api/products $J -d "{\"id\":\"prod-dan-amp\",\"farmerId\":\"farmer-dan-x\",\"farmerName\":\"Farmer Dan\",\"farmName\":\"Dan Farm\",\"name\":\"Ampalaya\",\"category\":\"Vegetables\",\"pricePerUnit\":75,\"farmgateAskingPrice\":75,\"unit\":\"kg\",\"stockQuantity\":30,\"harvestStatus\":\"Harvested Today\",\"harvestDate\":\"$NOW\",\"imageUrl\":\"\",\"isOrganic\":false,\"description\":\"\",\"location\":\"Dumaguete\"}" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('product',d).get('id',''))")
echo "farmerD lot: $PD @75 x30kg"
OID2="VC-REQ-9002"
curl -s -X POST $B/api/orders $J -d "{
  \"id\":\"$OID2\",
  \"buyerId\":\"buyer-x\",\"buyerName\":\"Pricing Buyer\",\"buyerPhone\":\"09170000001\",
  \"farmerId\":\"admin-main\",\"farmName\":\"VeggieConnect Central Market\",
  \"sellerStoreName\":\"VeggieConnect Central Market\",
  \"deliveryType\":\"farm_pickup\",\"pickupSlot\":\"Tomorrow 10AM\",
  \"items\":[{\"produceId\":\"req-prod-9002-0\",\"produceName\":\"Ampalaya\",\"unitPrice\":71.50,\"pricePerUnit\":71.50,\"farmgateUnitPrice\":65,\"unit\":\"kg\",\"quantity\":25,\"farmName\":\"VeggieConnect Central Market\",\"farmerId\":\"admin-main\"}],
  \"subtotal\":1787.5,\"deliveryFee\":0,\"totalAmount\":1787.5,
  \"farmgateCostTotal\":1625,\"adminCommissionTotal\":162.5,
  \"status\":\"pending\",\"createdAt\":\"$NOW\",
  \"paymentMethod\":\"Over-the-Counter Cash at Depot\",\"notes\":\"loss test\"}" > /dev/null
echo "--- fulfill order 2 (only Dan has stock; expect 409 + quote) ---"
curl -s -w "\nHTTP:%{http_code}\n" -X PUT $B/api/orders/$OID2 $J -d '{"id":"'$OID2'","buyerName":"Pricing Buyer","status":"confirmed","items":[{"produceId":"req-prod-9002-0","produceName":"Ampalaya","unitPrice":71.50,"pricePerUnit":71.50,"farmgateUnitPrice":65,"unit":"kg","quantity":25}]}' | tee /tmp/loss_result.txt | tail -2
python3 - <<'EOF'
import json, re
raw = open('/tmp/loss_result.txt').read()
m = re.search(r'HTTP:(\d+)', raw)
body = raw[:m.start()] if m else raw
d = json.loads(body.strip())
print('HTTP:', m.group(1) if m else '?', '| requiresQuote:', d.get('requiresQuote'))
q = d.get('quote', {})
print('quote crop:', q.get('cropName'), '| current:', q.get('currentBuyerPrice'), '| proposedFarmgate:', q.get('proposedFarmgatePrice'), '| proposedBuyer:', q.get('proposedBuyerPrice'), '(expect 82.50)')
EOF

echo "=== 7. Buyer approves quote -> re-price -> fulfill succeeds ==="
QID=$(python3 -c "import json,re; raw=open('/tmp/loss_result.txt').read(); m=re.search(r'HTTP:(\d+)',raw); d=json.loads(raw[:m.start()].strip()); print(d['quote']['id'])")
curl -s $B/api/orders | python3 -c "
import json,sys
orders=json.load(sys.stdin)
o=[x for x in orders if x['id']=='$OID2'][0]
o['priceQuotes']=[{'id':'$QID','cropName':'Ampalaya','currentBuyerPrice':71.50,'proposedFarmgatePrice':75,'proposedBuyerPrice':82.50,'reason':'t','status':'approved','createdAt':'$NOW','respondedAt':'$NOW'}]
o['items']=[{'produceId':'req-prod-9002-0','produceName':'Ampalaya','unitPrice':82.50,'pricePerUnit':82.50,'farmgateUnitPrice':75,'unit':'kg','quantity':25,'farmName':'VeggieConnect Central Market','farmerId':'admin-main'}]
o['subtotal']=2062.5; o['totalAmount']=2062.5; o['farmgateCostTotal']=1875; o['adminCommissionTotal']=187.5
o['status']='confirmed'
print(json.dumps(o))" > /tmp/order2_approved.json
curl -s -X PUT $B/api/orders/$OID2 $J -d @/tmp/order2_approved.json > /tmp/fulfill2.json
python3 - <<'EOF'
import json
d = json.load(open('/tmp/fulfill2.json'))
if d.get('requiresQuote'):
    print('UNEXPECTED BLOCK:', d['error']); raise SystemExit(1)
print('status:', d.get('status'))
for a in d.get('sourcingAllocations', []):
    print(f"  alloc: {a['quantity']}kg @PHP{a['farmgatePrice']} from {a.get('farmerName')}")
print('weightedAvg:', d.get('weightedAvgSourcingCost'), '(expect 75.0)')
print('netAdminProfit:', d.get('netAdminProfit'), '(expect 187.5)')
EOF
echo "=== DONE ==="
