const limits = {
  metro: [[62000, 100000], [55000, 90000], [45000, 80000]],
  gyeonggi: [[62000, 100000], [55000, 90000], [45000, 80000]],
  local: [[55000, 95000], [50000, 85000], [40000, 75000]],
  priority: [[50000, 90000], [45000, 80000], [35000, 70000]],
  special: [[45000, 85000], [40000, 75000], [30000, 65000]],
};
const temporaryLimits = {
  metro: [[30000, 50000], [25000, 45000], [22000, 40000]],
  gyeonggi: [[30000, 50000], [25000, 45000], [22000, 40000]],
  local: [[27000, 47000], [23000, 42000], [20000, 37000]],
  priority: [[25000, 45000], [21000, 40000], [17000, 35000]],
  special: [[22000, 42000], [20000, 37000], [15000, 32000]],
};
const people = { general: [0, .20], youth: [1, .30], three: [2, .50], low: [2, .533] };
const $ = id => document.getElementById(id);
const money = value => `${Math.round(value).toLocaleString('ko-KR')}원`;
let ordinaryManual = false, cardManual = false;

function calculate({ amount, ordinary, cardEligible = ordinary, offpeak = 0, rides, firstMonth, card, tmoney = true, regionalException = false, region, type, month }) {
  amount = Math.max(0, Number(amount) || 0);
  ordinary = Math.min(amount, Math.max(0, Number(ordinary) || 0));
  cardEligible = Math.min(amount, Math.max(0, Number(cardEligible) || 0));
  offpeak = Math.min(amount, Math.max(0, Number(offpeak) || 0));
  const [tier, rate] = people[type];
  const eligible = tmoney && (rides >= 15 || firstMonth);
  const [baseGeneral, basePlus] = (month === 'temporary' ? temporaryLimits : limits)[region][tier];
  // ponytail: Monthly totals cannot identify the highest 60 trips; omit basic above 60 until trip-level data is available.
  const rateBase = Math.min(amount, 200000) + ((region === 'gyeonggi' || regionalException) ? Math.max(0, amount - 200000) : Math.max(0, amount - 200000) * .5);
  const weightedRate = amount ? ((amount - offpeak) * rate + offpeak * Math.min(1, rate + (month === 'early' ? 0 : .3))) / amount : rate;
  const basic = eligible ? (rides > 60 ? null : Math.floor(rateBase * weightedRate)) : 0;
  const general = eligible ? Math.max(0, ordinary - baseGeneral) : 0;
  const plus = eligible ? Math.max(0, amount - basePlus) : 0;
  const refund = Math.max(basic ?? 0, general, plus);
  const winner = rides > 60 && eligible ? (refund === general && refund > 0 ? '일반형 잠정' : refund === plus && refund > 0 ? '플러스형 잠정' : '기본형 미산정') : refund === 0 ? '환급 없음' : refund === general ? '일반형 적용' : refund === plus ? '플러스형 적용' : '기본형 적용';
  const cashback = card ? Math.min(10000, Math.floor(cardEligible * .2)) : 0;
  return { basic, general, plus, refund, winner, cashback, net: Math.max(0, amount - refund - cashback) };
}

function state() { return {
  amount: Number($('amount').value), ordinary: Number($('ordinary').value), cardEligible: Number($('cardEligible').value), offpeak: Number($('offpeak').value), rides: Number($('rides').value),
  firstMonth: $('firstMonth').checked, card: $('card').checked, tmoney: $('tmoney').checked, regionalException: $('regionalException').checked && !['metro', 'gyeonggi'].includes($('region').value),
  region: $('region').value, type: $('type').value, month: $('month').value,
}; }
function setAmount(value) {
  const amount = Math.min(300000, Math.max(0, Math.round((Number(value) || 0) / 1000) * 1000));
  $('amount').value = $('amountNumber').value = amount;
  const ordinary = ordinaryManual ? Math.min(amount, Number($('ordinary').value)) : amount;
  $('ordinary').max = amount;
  $('ordinary').value = $('ordinaryNumber').value = ordinary;
  const cardEligible = cardManual ? Math.min(amount, Number($('cardEligible').value)) : amount;
  $('cardEligible').max = amount;
  $('cardEligible').value = $('cardEligibleNumber').value = cardEligible;
  const offpeak = Math.min(amount, Number($('offpeak').value));
  $('offpeak').max = amount;
  $('offpeak').value = $('offpeakNumber').value = offpeak;
  render();
}
function setOrdinary(value) {
  const ordinary = Math.min(Number($('amount').value), Math.max(0, Math.round((Number(value) || 0) / 1000) * 1000));
  ordinaryManual = ordinary !== Number($('amount').value);
  $('ordinary').value = $('ordinaryNumber').value = ordinary;
  render();
}
function setCardEligible(value) {
  const eligible = Math.min(Number($('amount').value), Math.max(0, Math.round((Number(value) || 0) / 1000) * 1000));
  cardManual = eligible !== Number($('amount').value);
  $('cardEligible').value = $('cardEligibleNumber').value = eligible;
  render();
}
function setOffpeak(value) {
  const offpeak = Math.min(Number($('amount').value), Math.max(0, Math.round((Number(value) || 0) / 1000) * 1000));
  $('offpeak').value = $('offpeakNumber').value = offpeak;
  render();
}
function drawChart(s) {
  const svg = $('chart');
  const maxX = 300000, maxY = 300000, left = 34, right = 585, top = 15, bottom = 215;
  const x = value => left + value / maxX * (right - left);
  const y = value => bottom - value / maxY * (bottom - top);
  const ratio = s.amount ? s.ordinary / s.amount : 1;
  const cardRatio = s.amount ? s.cardEligible / s.amount : 1;
  const offpeakRatio = s.amount ? s.offpeak / s.amount : 0;
  const series = (card, kpass) => Array.from({length: 61}, (_, i) => {
    const amount = i * 5000;
    const result = calculate({...s, amount, ordinary: amount * ratio, cardEligible: amount * cardRatio, offpeak: amount * offpeakRatio, card});
    return `${i ? 'L' : 'M'}${x(amount).toFixed(1)},${y(kpass ? result.net : amount).toFixed(1)}`;
  }).join(' ');
  const kpass = series(false, true), combined = series(s.card, true), none = series(false, false);
  const current = calculate(s);
  svg.innerHTML = `<line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" class="axis"/><line x1="${left}" y1="${top}" x2="${left}" y2="${bottom}" class="axis"/>${[0,100000,200000,300000].map(v => `<text x="${x(v)}" y="246" text-anchor="middle" class="tick">${v/10000}만</text>`).join('')}${[100000,200000,300000].map(v => `<line x1="${left}" y1="${y(v)}" x2="${right}" y2="${y(v)}" class="grid"/>`).join('')}<path d="${none}" class="line none"/><path d="${kpass}" class="line kpass-line"/><path d="${combined}" class="line combined-line"/><line x1="${x(s.amount)}" x2="${x(s.amount)}" y1="${top}" y2="${bottom}" class="cursor"/><circle cx="${x(s.amount)}" cy="${y(current.net)}" r="6" class="point"/>`;
}
function render() {
  const s = state(), r = calculate(s);
  $('amountNumber').value = s.amount;
  $('ordinaryNumber').value = s.ordinary;
  $('cardEligibleNumber').value = s.cardEligible;
  $('offpeakNumber').value = s.offpeak;
  $('offpeakField').hidden = s.month === 'early';
  $('regionalExceptionField').hidden = ['metro', 'gyeonggi'].includes(s.region);
  $('amount').style.setProperty('--progress', `${s.amount / 300000 * 100}%`);
  $('ordinary').style.setProperty('--progress', `${s.amount ? s.ordinary / s.amount * 100 : 0}%`);
  $('cardEligible').style.setProperty('--progress', `${s.amount ? s.cardEligible / s.amount * 100 : 0}%`);
  $('offpeak').style.setProperty('--progress', `${s.amount ? s.offpeak / s.amount * 100 : 0}%`);
  $('fare').textContent = money(s.amount);
  $('net').textContent = money(r.net);
  $('winner').textContent = r.winner;
  $('refundLabel').textContent = s.tmoney ? 'K-패스 환급 · T마일리지' : 'K-패스 환급 · 미등록';
  $('refund').textContent = s.tmoney ? `${r.refund.toLocaleString('ko-KR')}P` : money(r.refund);
  $('cashback').textContent = money(r.cashback);
  $('basic').textContent = r.basic === null ? '상위 60회 자료 필요' : money(r.basic);
  $('general').textContent = money(r.general);
  $('plus').textContent = money(r.plus);
  $('currentAmount').textContent = money(s.amount);
  $('settlement').textContent = s.tmoney ? '교통비는 먼저 결제되고, 하나 캐시백과 K-패스 T마일리지는 별도로 지급됩니다.' : '티머니 K-패스 미등록 상태로 계산해 K-패스 환급을 제외했습니다.';
  const warning = [];
  if (s.tmoney && s.rides < 15 && !s.firstMonth) warning.push('월 15회 미만으로 K-패스 환급이 0원입니다.');
  if (s.tmoney && s.rides > 60) warning.push('60회 초과: 일반형·플러스형은 전체 이용액으로 계산했습니다. 기본형은 금액이 높은 상위 60회 내역이 없어 제외했으므로 최종 적용 방식과 실부담액이 달라질 수 있습니다.');
  if (s.card && s.cardEligible < s.amount) warning.push('하나카드 캐시백은 입력한 버스·지하철 대상 금액에만 적용했습니다.');
  $('warning').hidden = !warning.length;
  $('warning').textContent = warning.join(' ');
  drawChart(s);
}
if (typeof document !== 'undefined') {
  $('amount').addEventListener('input', e => setAmount(e.target.value));
  $('amountNumber').addEventListener('change', e => setAmount(e.target.value));
  $('ordinary').addEventListener('input', e => setOrdinary(e.target.value));
  $('ordinaryNumber').addEventListener('change', e => setOrdinary(e.target.value));
  $('cardEligible').addEventListener('input', e => setCardEligible(e.target.value));
  $('cardEligibleNumber').addEventListener('change', e => setCardEligible(e.target.value));
  $('offpeak').addEventListener('input', e => setOffpeak(e.target.value));
  $('offpeakNumber').addEventListener('change', e => setOffpeak(e.target.value));
  for (const id of ['month','region','type','firstMonth','card','tmoney','regionalException']) $(id).addEventListener('change', render);
  $('rides').addEventListener('change', e => { e.target.value = Math.min(999, Math.max(0, Number(e.target.value) || 0)); render(); });
  render();
}
