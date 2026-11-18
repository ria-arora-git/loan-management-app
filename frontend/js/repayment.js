const $ = (id) => document.getElementById(id);

let account = null;
let loans = [];
let selected = null;

function setNotice(message, type) {
  $('notice').textContent = message;
  $('notice').className = 'notice' + (type ? ' ' + type : '');
}

function left(loan) {
  return loan.amount + loan.interest - loan.repaid;
}

function statusText(loan) {
  if (isRepaid(loan)) return 'Repaid';
  return loan.disbursed ? 'Approved' : 'Awaiting ETH';
}

async function connect(silent) {
  try {
    account = silent ? await getConnectedAccount() : await connectWallet();
    if (!account) return;

    const ok = await isSepolia();
    $('wallet-label').textContent = shortAddr(account);
    $('network-label').textContent = ok ? 'Sepolia Testnet' : 'Wrong network';
    $('network-dot').style.background = ok ? 'var(--mint-dark)' : '#E63946';
    await loadLoans();
  } catch (err) {
    setNotice(errorText(err), 'error');
  }
}

async function loadLoans() {
  setNotice('Loading your loans from Sepolia...');
  const contract = getContract(false);
  const ids = await contract.getBorrowerLoans(account);

  const approvedLoans = [];
  for (const id of ids) {
    const loan = await readLoan(contract, id.toNumber());
    if (loan.approved) approvedLoans.push(loan);
  }
  loans = approvedLoans;

  if (loans.length === 0) {
    $('loan-select').innerHTML = '<option value="">No approved or repaid loans found</option>';
    setNotice('No approved or repaid loans were found for this wallet.');
    await showLoan();
    return;
  }

  const previous = selected ? selected.id : null;
  let options = '';
  for (const loan of loans) {
    options += `<option value="${loan.id}">Loan #${loan.id} — ${statusText(loan)}</option>`;
  }
  $('loan-select').innerHTML = options;
  if (loans.some(loan => loan.id === previous)) $('loan-select').value = previous;
  await showLoan();
}

function updateRepayButton() {
  $('repay-button').disabled = !(selected && selected.disbursed && left(selected) > 0);
}

function showEmpty() {
  selected = null;
  for (const id of ['stat-loan', 'stat-total', 'stat-paid', 'stat-outstanding', 'max-payable']) {
    $(id).textContent = '—';
  }
  $('loan-details').innerHTML = '<div class="empty-state">Select an approved loan to see its details.</div>';
  $('progress-fill').style.width = '0%';
  $('progress-label').textContent = '0%';
  $('summary-amount').textContent = '₹0';
  $('summary-balance').textContent = '—';
  $('history-body').innerHTML = '<tr><td colspan="5" class="empty-cell">No repayment records loaded.</td></tr>';
  $('history-count').textContent = '0 transactions';
  updateRepayButton();
}

async function showLoan() {
  selected = loans.find(loan => loan.id === Number($('loan-select').value));
  if (!selected) {
    showEmpty();
    return;
  }

  const total = selected.amount + selected.interest;
  const percent = Math.min(100, selected.repaid * 100 / total);

  $('stat-loan').textContent = '#' + selected.id;
  $('stat-total').textContent = inr(total);
  $('stat-paid').textContent = inr(selected.repaid);
  $('stat-outstanding').textContent = inr(left(selected));
  $('max-payable').textContent = inr(left(selected));
  $('progress-label').textContent = percent.toFixed(1) + '%';
  $('progress-fill').style.width = percent + '%';

  $('loan-details').innerHTML = `
    <div class="detail-box"><span>Borrower</span><strong>${esc(selected.name)}</strong></div>
    <div class="detail-box"><span>Loan Status</span><strong><span class="status-pill">${statusText(selected)}</span></strong></div>
    <div class="detail-box"><span>Principal</span><strong>${inr(selected.amount)}</strong></div>
    <div class="detail-box"><span>Interest</span><strong>${inr(selected.interest)}</strong></div>
    <div class="detail-box"><span>Duration</span><strong>${selected.duration} months</strong></div>
    <div class="detail-box"><span>Total repayment</span><strong>${inr(total)}</strong></div>`;

  if (selected.disbursed) {
    setNotice('Loaded ' + loans.length + ' loan(s) for ' + shortAddr(account) + '.', 'success');
  } else {
    setNotice('This loan is approved but its ETH has not been sent yet. Open My Applications on the borrower page to claim it (or ask the admin to send it). You can repay after that.', 'error');
  }

  updateRepayButton();
  updateSummary();
  await showHistory();
}

async function showHistory() {
  const records = await getContract(false).getRepaymentHistory(selected.id);
  $('history-count').textContent = records.length + ' transaction' + (records.length === 1 ? '' : 's');

  let rows = '';
  records.forEach((record, i) => {
    rows += `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${inr(record.amount)}</strong></td>
        <td title="${account}">${shortAddr(account)}</td>
        <td>${new Date(record.timestamp.toNumber() * 1000).toLocaleString()}</td>
        <td><span class="status-chip approved">✓ Confirmed</span></td>
      </tr>`;
  });
  $('history-body').innerHTML = rows || '<tr><td colspan="5" class="empty-cell">No repayments yet. Your first repayment will appear here.</td></tr>';
}

function updateSummary() {
  const amount = Number($('repay-amount').value);
  const valid = Number.isInteger(amount) && amount > 0;
  $('summary-amount').textContent = valid ? inr(amount) + ' (' + ethOf(amount) + ' ETH)' : '₹0';

  if (!selected) return;
  if (!valid) $('summary-balance').textContent = inr(left(selected));
  else if (amount > left(selected)) $('summary-balance').textContent = 'Amount exceeds balance';
  else $('summary-balance').textContent = inr(left(selected) - amount);
}

function quickAmount(percent) {
  if (!selected) return;
  $('repay-amount').value = Math.floor(left(selected) * percent / 100);
  updateSummary();
}

async function repay(event) {
  event.preventDefault();
  const amount = Number($('repay-amount').value);

  if (!Number.isInteger(amount) || amount <= 0) {
    setNotice('Enter a valid whole-rupee repayment amount.', 'error');
    return;
  }
  if (amount > left(selected)) {
    setNotice('Your repayment cannot exceed the outstanding balance.', 'error');
    return;
  }

  try {
    $('repay-button').disabled = true;
    $('repay-button').textContent = 'Waiting for MetaMask...';
    setNotice('Confirm the repayment transaction in MetaMask.');

    const value = ethers.BigNumber.from(amount).mul(WEI_PER_RUPEE);
    const tx = await getContract(true).repayLoan(selected.id, amount, { value: value });
    setNotice('Transaction submitted: ' + tx.hash.slice(0, 18) + '… Waiting for confirmation.');
    await tx.wait();

    $('repay-amount').value = '';
    await loadLoans();
    setNotice('Repayment confirmed on Sepolia! Your balance and history have been updated.', 'success');
  } catch (err) {
    setNotice(errorText(err), 'error');
  }

  $('repay-button').textContent = '♡ Confirm Repayment';
  updateRepayButton();
  updateSummary();
}

$('connect-wallet').onclick = () => connect(false);
$('loan-select').onchange = showLoan;
$('repay-amount').oninput = updateSummary;
$('repayment-form').onsubmit = repay;
document.querySelectorAll('.quick-btn').forEach(button => {
  button.onclick = () => quickAmount(Number(button.dataset.part));
});

showEmpty();
connect(true);
