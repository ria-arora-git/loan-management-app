const $ = (id) => document.getElementById(id);
const EMPLOYMENT_CODE = { 'Unemployed': 0, 'Employed': 1, 'Self-employed': 2 };
const CHIPS = {
  'Rejected': ['rejected', '💔'],
  'Repaid': ['approved', '🎉'],
  'Disbursed': ['disbursed', '🌸'],
  'Awaiting Disbursement': ['awaiting', '👛']
};

let account = null;
let myLoans = [];
let step = 1;
let filter = 'all';
let openLoan = null;

const RetroAudio = {
  ctx: null,
  enabled: true,

  init() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) this.ctx = new AudioContext();
  },

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  },

  playBlip(freq = 520, type = 'square', duration = 0.08) {
    if (!this.enabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  },

  playCoinChime() {
    if (!this.enabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(987.77, now);
    osc.frequency.setValueAtTime(1318.51, now + 0.08);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  },

  playVictoryJingle() {
    if (!this.enabled || !this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playBlip(freq, 'triangle', 0.12), i * 90);
    });
  },

  playErrorBuzz() {
    if (!this.enabled || !this.ctx) return;
    this.playBlip(180, 'sawtooth', 0.18);
  }
};

RetroAudio.init();

function statusChip(status) {
  return `<span class="status-chip ${CHIPS[status][0]}">${CHIPS[status][1]} ${status}</span>`;
}

function showView(name) {
  RetroAudio.playBlip(600, 'triangle', 0.05);
  for (const view of ['dashboard', 'apply', 'history']) {
    $('view-' + view).style.display = view === name ? 'block' : 'none';
  }
  document.querySelectorAll('.nav-link[data-view]').forEach(link => {
    link.classList.toggle('active', link.dataset.view === name);
  });
}

async function connect(silent) {
  try {
    if (!silent) RetroAudio.playBlip(550, 'triangle', 0.08);
    account = silent ? await getConnectedAccount() : await connectWallet();
    if (!account) return;

    const ok = await isSepolia();
    $('wallet-address-text').textContent = shortAddr(account);
    $('wallet-address-text').title = account;
    $('network-name-text').textContent = ok ? 'Ethereum Sepolia' : 'Wrong network';
    $('network-dot').style.background = ok ? 'var(--mint-dark)' : '#E63946';
    await loadLoans();
  } catch (err) {
    if (!silent) {
      RetroAudio.playErrorBuzz();
      alert('Wallet Connection Error: ' + errorText(err));
    }
  }
}

async function loadLoans() {
  const contract = getContract(false);
  const ids = await contract.getBorrowerLoans(account);

  const allLoans = [];
  for (const id of ids) {
    const loan = await readLoan(contract, id.toNumber());
    loan.txHash = localStorage.getItem('tx-' + CONTRACT_ADDRESS + '-' + loan.id);
    allLoans.push(loan);
  }
  myLoans = allLoans.reverse();

  showLoans();
}

function showLoans() {
  let rejected = 0;
  for (const loan of myLoans) {
    if (!loan.approved) rejected++;
  }
  $('stat-total').textContent = myLoans.length;
  $('stat-approved').textContent = myLoans.length - rejected;
  $('stat-rejected').textContent = rejected;

  let recentRows = '';
  for (const loan of myLoans.slice(0, 5)) {
    recentRows += `
      <tr>
        <td><strong>#LN-${loan.id}</strong></td>
        <td>${inr(loan.amount)}</td>
        <td>${loan.duration} Mo</td>
        <td>${statusChip(statusOf(loan))}</td>
        <td><button class="btn-inspect" onclick="openDetails(${loan.id})">Inspect</button></td>
      </tr>`;
  }
  const emptyText = account ? 'No applications submitted yet.' : 'Connect your wallet to see your applications.';
  $('recent-table-body').innerHTML = recentRows || `<tr><td colspan="5" style="text-align:center; padding:1.5rem;">${emptyText}</td></tr>`;

  const search = $('history-search-input').value.trim().toLowerCase();
  let historyRows = '';
  for (const loan of myLoans) {
    const status = statusOf(loan);
    if (filter === 'Approved' && status === 'Rejected') continue;
    if (filter === 'Disbursed' && status !== 'Disbursed' && status !== 'Repaid') continue;
    if (filter === 'Rejected' && status !== 'Rejected') continue;
    const text = ('#LN-' + loan.id + ' ' + status + ' ' + loan.name).toLowerCase();
    if (search && !text.includes(search)) continue;

    historyRows += `
      <tr>
        <td><strong>#LN-${loan.id}</strong></td>
        <td>${new Date(loan.appliedAt).toLocaleDateString()}</td>
        <td>${inr(loan.amount)}</td>
        <td>${loan.duration} Mo</td>
        <td>${statusChip(status)}</td>
        <td><code>${loan.txHash ? loan.txHash.slice(0, 10) + '...' : '—'}</code></td>
        <td><button class="btn-inspect" onclick="openDetails(${loan.id})">Inspect</button></td>
      </tr>`;
  }
  $('history-table-body').innerHTML = historyRows;
  $('history-empty-state').style.display = historyRows ? 'none' : 'block';
}

function openDetails(id) {
  RetroAudio.playBlip(620, 'square', 0.08);
  openLoan = myLoans.find(loan => loan.id === id);
  const total = openLoan.amount + openLoan.interest;
  const status = statusOf(openLoan);

  $('modal-loan-id').textContent = '#LN-' + openLoan.id;
  $('modal-applicant').textContent = openLoan.name;
  $('modal-wallet').textContent = shortAddr(openLoan.borrower);
  $('modal-principal').textContent = inr(openLoan.amount);
  $('modal-duration').textContent = openLoan.duration + ' Months';
  $('modal-eth').textContent = status === 'Rejected' ? 'None (rejected)' : ethOf(openLoan.amount) + ' ETH';
  $('modal-interest').textContent = inr(openLoan.interest) + ' (10%)';
  $('modal-monthly').textContent = inr(Math.round(total / openLoan.duration)) + ' / mo';
  $('modal-total').textContent = inr(total);
  $('modal-status-chip').innerHTML = statusChip(status);
  $('modal-applied-date').textContent = new Date(openLoan.appliedAt).toLocaleString();
  $('modal-tx-hash').textContent = openLoan.txHash || 'Not available';
  $('modal-tx-hash').title = openLoan.txHash || '';

  $('modal-reason-row').style.display = openLoan.reason ? 'block' : 'none';
  $('modal-reason-msg').textContent = openLoan.reason;

  const canClaim = status === 'Awaiting Disbursement';
  const canRepay = status === 'Disbursed';
  $('modal-claim-btn').style.display = canClaim ? 'inline-flex' : 'none';
  $('modal-claim-btn').disabled = false;
  $('modal-claim-btn').textContent = '🪙 Claim ' + ethOf(openLoan.amount) + ' ETH';
  $('modal-repay-link').style.display = canRepay ? 'inline-flex' : 'none';
  $('modal-actions').style.display = canClaim || canRepay ? 'flex' : 'none';

  $('details-backdrop').style.display = 'flex';
}

async function claimEth() {
  $('modal-claim-btn').disabled = true;
  $('modal-claim-btn').textContent = 'Waiting for MetaMask...';
  try {
    account = await connectWallet();
    const tx = await getContract(true).disburseLoan(openLoan.id);
    $('modal-claim-btn').textContent = 'Confirming on Sepolia...';
    await tx.wait();
    RetroAudio.playVictoryJingle();
    alert('Done! ' + ethOf(openLoan.amount) + ' ETH was sent to your wallet.');
    $('details-backdrop').style.display = 'none';
    await loadLoans();
  } catch (err) {
    RetroAudio.playErrorBuzz();
    alert('Claim failed: ' + errorText(err));
    $('modal-claim-btn').disabled = false;
    $('modal-claim-btn').textContent = '🪙 Claim ' + ethOf(openLoan.amount) + ' ETH';
  }
}

function readForm() {
  return {
    name: $('input-full-name').value.trim(),
    age: Number($('input-age').value),
    employment: $('input-employment').value,
    income: Number($('input-income').value),
    amount: Number($('input-amount').value),
    months: Number($('input-duration').value)
  };
}

function eligibilityProblem(f) {
  if (f.name.length < 2) return 'Please enter your name or handle (min 2 characters).';
  if (!(f.age >= 21)) return 'Borrower must be at least 21 years old.';
  if (f.employment === 'Unemployed') return 'Applicants must be currently Employed or Self-employed to qualify.';
  if (!(f.employment in EMPLOYMENT_CODE)) return 'Please select a valid employment status.';
  if (!(f.income >= 20000)) return 'Minimum monthly income requirement is ₹20,000.';
  if (!(f.amount > 0)) return 'Please enter a valid loan amount above ₹0.';
  if (f.amount > f.income * 10) return 'Requested amount exceeds the maximum eligible limit of ' + inr(f.income * 10) + ' (10× monthly income).';
  return '';
}

function updateCalculator() {
  const f = readForm();
  const amount = f.amount > 0 ? f.amount : 0;
  const interest = Math.floor(amount * 10 / 100);
  const total = amount + interest;
  const problem = eligibilityProblem(f);

  $('calc-principal').textContent = inr(amount);
  $('calc-interest').textContent = inr(interest) + ' (10%)';
  $('calc-total').textContent = inr(total);
  $('calc-eth').textContent = ethOf(amount) + ' ETH';
  $('calc-monthly').textContent = inr(Math.round(total / f.months)) + ' / mo';
  $('calc-duration-notice').textContent = 'Duration: ' + f.months + ' months';
  $('calc-max-limit-notice').textContent = f.income >= 20000 ? 'Max limit: ' + inr(f.income * 10) + ' (10× income)' : 'Min income ₹20,000 required for eligibility';

  $('calc-eligibility-box').className = problem ? 'eligibility-box ineligible' : 'eligibility-box';
  $('calc-eligibility-title').innerHTML = problem ? '<span>💔</span> ATTENTION REQUIRED' : '<span>✨</span> ELIGIBLE FOR LOAN';
  $('calc-eligibility-msg').textContent = problem || 'Awesome! Your parameters meet all smart contract eligibility rules.';
  $('submit-quest-btn').textContent = problem ? '💔 Submit Quest (Test Contract Rejection)' : '🪙 Launch Coin & Submit Quest! (Eligible ✨)';
  $('submit-quest-btn').className = problem ? 'btn-arcade' : 'btn-arcade mint';
}

function goToStep(n) {
  if (n < 1 || n > 4) return;
  RetroAudio.playBlip(480 + n * 60, 'square', 0.06);
  step = n;
  document.querySelectorAll('.step-item').forEach(item => {
    item.classList.toggle('active', Number(item.dataset.step) === n);
    item.classList.toggle('completed', Number(item.dataset.step) < n);
  });
  document.querySelectorAll('.form-step').forEach(form => {
    form.classList.toggle('active', Number(form.dataset.step) === n);
  });
  $('prev-step-btn').style.visibility = n === 1 ? 'hidden' : 'visible';
  $('next-step-btn').style.display = n === 4 ? 'none' : 'inline-flex';
  $('submit-quest-btn').style.display = n === 4 ? 'inline-flex' : 'none';
}

function nextStep() {
  const f = readForm();
  for (const id of ['error-full-name', 'error-age', 'error-employment', 'error-income', 'error-amount']) {
    $(id).textContent = '';
  }

  let ok = true;
  if (step === 1) {
    if (f.name.length < 2) {
      $('error-full-name').textContent = 'Please enter your name or character tag.';
      ok = false;
    }
    if (!(f.age > 0)) {
      $('error-age').textContent = 'Please enter a valid age.';
      ok = false;
    } else if (f.age < 21) {
      $('error-age').textContent = '⚠️ Age < 21: Contract rules will evaluate this as REJECTED.';
    }
  }
  if (step === 2) {
    if (!(f.employment in EMPLOYMENT_CODE)) {
      $('error-employment').textContent = 'Please select an employment status.';
      ok = false;
    } else if (f.employment === 'Unemployed') {
      $('error-employment').textContent = '⚠️ Unemployed: Contract rules will evaluate this as REJECTED.';
    }
  }
  if (step === 3) {
    if (!(f.income > 0)) {
      $('error-income').textContent = 'Please enter a valid monthly income.';
      ok = false;
    } else if (f.income < 20000) {
      $('error-income').textContent = '⚠️ Income < ₹20,000: Contract rules will evaluate this as REJECTED.';
    }
  }

  if (!ok) {
    RetroAudio.playErrorBuzz();
    return;
  }
  goToStep(step + 1);
}

function showAnimation(cardState, title, subtitle, message) {
  $('anim-stage-card').className = 'anim-stage-card state-' + cardState;
  $('anim-title').textContent = title;
  $('anim-subtitle').textContent = subtitle;
  $('anim-progress-msg').textContent = message;
}

async function submitLoan(event) {
  event.preventDefault();
  const f = readForm();

  if (!(f.amount > 0)) {
    $('error-amount').textContent = 'Please enter a valid loan amount above ₹0.';
    RetroAudio.playErrorBuzz();
    return;
  }

  const problem = eligibilityProblem(f);
  const interest = Math.floor(f.amount * 10 / 100);
  const total = f.amount + interest;
  let question = `Ready to submit loan quest?\n\n• Amount: ${inr(f.amount)}\n• 10% Interest: ${inr(interest)}\n• Duration: ${f.months} Months\n• Est. Monthly: ${inr(Math.round(total / f.months))}/mo`;
  if (problem) {
    question = `⚠️ SMART CONTRACT REJECTION NOTICE:\n\nThis application does not satisfy contract rules:\n"${problem}"\n\nPer Solidity logic in LoanManagement.sol, this will be evaluated and recorded as REJECTED.\n\nDo you want to proceed and record this rejection on-chain?`;
  }
  if (!confirm(question)) return;

  $('anim-backdrop').style.display = 'flex';
  $('anim-txhash-link').textContent = '';
  $('anim-close-btn').style.display = 'none';
  showAnimation('submitting', 'Submitting Loan Quest ✨', 'Preparing transaction parameters...', 'Verifying wallet authorization...');
  RetroAudio.playBlip(440, 'triangle', 0.15);

  try {
    account = await connectWallet();
    const contract = getContract(true);

    showAnimation('submitting', 'Submitting Loan Quest ✨', 'Preparing transaction parameters...', 'Please confirm transaction in your MetaMask wallet...');
    RetroAudio.playBlip(580, 'square', 0.1);
    const tx = await contract.applyForLoan(f.name, f.age, EMPLOYMENT_CODE[f.employment], f.income, f.amount, f.months);

    showAnimation('mining', 'Coin in Flight! 🪙', 'Traveling along the blockchain path into the wallet...', 'Transaction sent! Mining block on Sepolia testnet...');
    $('anim-txhash-link').textContent = 'Tx Hash: ' + tx.hash.slice(0, 18) + '...';
    RetroAudio.playCoinChime();
    await tx.wait();

    const ids = await contract.getBorrowerLoans(account);
    const loan = await readLoan(contract, ids[ids.length - 1].toNumber());
    localStorage.setItem('tx-' + CONTRACT_ADDRESS + '-' + loan.id, tx.hash);

    if (!loan.approved) {
      showAnimation('rejected', 'Quest Evaluated: REJECTED 💔', 'Evaluated and recorded as Rejected per smart contract rules.', loan.reason);
      RetroAudio.playErrorBuzz();
    } else if (loan.disbursed) {
      showAnimation('confirmed', 'Quest Recorded! 🌸', 'Coin entered the wallet! ' + ethOf(f.amount) + ' ETH deposited.', ethOf(f.amount) + ' Sepolia ETH was sent from the bank vault to your wallet!');
      RetroAudio.playVictoryJingle();
    } else {
      showAnimation('confirmed', 'Quest Recorded! 🌸', 'Approved by the contract! ETH is waiting for the bank to fund the vault.', 'Approved! The bank vault has too little ETH right now. Open My Applications and claim ' + ethOf(f.amount) + ' ETH once the admin funds it.');
      RetroAudio.playVictoryJingle();
    }
    $('anim-close-btn').style.display = 'inline-flex';
    await loadLoans();
  } catch (err) {
    showAnimation('rejected', 'Transaction Cancelled 💔', 'The loan quest could not be completed.', errorText(err));
    $('anim-close-btn').style.display = 'inline-flex';
    RetroAudio.playErrorBuzz();
  }
}

document.querySelectorAll('[data-view]').forEach(link => {
  link.onclick = () => showView(link.dataset.view);
});
$('quick-apply-btn').onclick = () => showView('apply');
$('connect-wallet-btn').onclick = () => connect(false);
$('history-search-input').oninput = showLoans;
document.querySelectorAll('.filter-btn').forEach(button => {
  button.onclick = () => {
    RetroAudio.playBlip(540, 'triangle', 0.04);
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    button.classList.add('active');
    filter = button.dataset.filter;
    showLoans();
  };
});
$('details-close-btn').onclick = () => { $('details-backdrop').style.display = 'none'; };
$('modal-claim-btn').onclick = claimEth;

$('toggle-audio-btn').onclick = () => {
  const active = RetroAudio.toggle();
  $('toggle-audio-btn').classList.toggle('active', active);
  $('toggle-audio-btn').title = active ? 'Mute 8-bit Sounds' : 'Unmute 8-bit Sounds';
  if (active) RetroAudio.playCoinChime();
};

for (const id of ['input-full-name', 'input-age', 'input-employment', 'input-income', 'input-amount']) {
  $(id).oninput = updateCalculator;
  $(id).onchange = updateCalculator;
}
$('input-duration').oninput = () => {
  $('input-duration-val').textContent = $('input-duration').value + ' Months';
  updateCalculator();
};

$('prev-step-btn').onclick = () => goToStep(step - 1);
$('next-step-btn').onclick = nextStep;
document.querySelectorAll('.step-item').forEach(item => {
  item.style.cursor = 'pointer';
  item.onclick = () => goToStep(Number(item.dataset.step));
});
$('loan-quest-form').onsubmit = submitLoan;
$('anim-close-btn').onclick = () => {
  $('anim-backdrop').style.display = 'none';
  showView('history');
};

updateCalculator();
connect(true);
if (['dashboard', 'apply', 'history'].includes(location.hash.slice(1))) showView(location.hash.slice(1));
