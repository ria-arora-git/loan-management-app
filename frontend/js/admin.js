const $ = (id) => document.getElementById(id);
const EMPLOYMENT = ['Unemployed', 'Employed', 'Self-employed'];
let loans = [];

setupTopNav(start);

async function start(account) {
  try {
    if (!(await isSepolia())) {
      $('notice').textContent = 'You are on the wrong network. Click Connect and switch to Sepolia.';
      return;
    }

    const owner = await getContract(false).owner();
    if (owner.toLowerCase() !== account.toLowerCase()) {
      $('notice').textContent = 'Access denied: this wallet is not the admin (contract owner).';
      return;
    }

    $('notice').classList.add('hidden');
    $('adminArea').classList.remove('hidden');
    await loadLoans();
  } catch (err) {
    $('notice').textContent = 'Error: ' + errorText(err);
  }
}

async function loadLoans() {
  const contract = getContract(false);
  const count = (await contract.loanCount()).toNumber();

  const allLoans = [];
  for (let id = 1; id <= count; id++) {
    allLoans.push(await readLoan(contract, id));
  }
  loans = allLoans;

  let approved = 0;
  let rejected = 0;
  let waiting = 0;
  let waitingRupees = 0;
  let disbursedRupees = 0;
  let repaidRupees = 0;

  for (const loan of loans) {
    repaidRupees += loan.repaid;
    if (!loan.approved) {
      rejected++;
    } else {
      approved++;
      if (loan.disbursed) {
        disbursedRupees += loan.amount;
      } else {
        waiting++;
        waitingRupees += loan.amount;
      }
    }
  }

  const balance = await contract.provider.getBalance(CONTRACT_ADDRESS);
  $('sTotal').textContent = loans.length;
  $('sApproved').textContent = approved;
  $('sRejected').textContent = rejected;
  $('sDisbursed').textContent = ethOf(disbursedRupees);
  $('sRepaid').textContent = ethOf(repaidRupees);
  $('sBalance').textContent = Number(ethers.utils.formatEther(balance));
  $('sAwaiting').textContent = waiting;

  if (waiting === 0) {
    $('fundHint').textContent = 'No approved loans are waiting for ETH.';
  } else {
    $('fundHint').textContent = 'Loans waiting for ETH need ' + ethOf(waitingRupees) + ' ETH in total. Deposit ETH above, then click "Send ETH" in the table.';
  }

  showTable();
}

function showTable() {
  const search = $('search').value.trim().toLowerCase();
  let rows = '';

  for (const loan of loans.slice().reverse()) {
    if (search && String(loan.id) !== search && !loan.borrower.toLowerCase().includes(search)) continue;

    let status = 'Approved';
    if (!loan.approved) status = 'Rejected';
    else if (isRepaid(loan)) status = 'Repaid';

    let ethCell = '-';
    if (loan.approved && loan.disbursed) {
      ethCell = 'Yes (' + ethOf(loan.amount) + ' ETH)';
    } else if (loan.approved) {
      ethCell = '<button class="btn" onclick="sendEth(' + loan.id + ')">Send ' + ethOf(loan.amount) + ' ETH</button>';
    }

    rows += `
      <tr>
        <td>#${loan.id}</td>
        <td title="${loan.borrower}">${shortAddr(loan.borrower)}</td>
        <td>${esc(loan.name)}, age ${loan.age}<br>${EMPLOYMENT[loan.employment]}<br>Income: ${inr(loan.income)}</td>
        <td>${inr(loan.amount)}<br>Interest: ${inr(loan.interest)}<br>${loan.duration} months</td>
        <td><span class="tag ${status}">${status}</span></td>
        <td>${esc(loan.reason) || '-'}</td>
        <td>${ethCell}</td>
      </tr>`;
  }

  $('tbody').innerHTML = rows || '<tr><td colspan="7">No applications found.</td></tr>';
}

async function fund() {
  const eth = $('fundAmount').value;
  if (!eth || Number(eth) <= 0) {
    toast('Enter an ETH amount greater than 0.', 'error');
    return;
  }
  try {
    loading(true, 'Confirm in MetaMask...');
    const tx = await getContract(true).fundContract({ value: ethers.utils.parseEther(eth) });
    loading(true, 'Waiting for confirmation...');
    await tx.wait();
    toast('Deposited ' + eth + ' ETH.', 'success');
    await loadLoans();
  } catch (err) {
    toast(errorText(err), 'error');
  }
  loading(false);
}

async function withdraw() {
  const eth = $('withdrawAmount').value;
  if (!eth || Number(eth) <= 0) {
    toast('Enter an ETH amount greater than 0.', 'error');
    return;
  }
  try {
    loading(true, 'Confirm in MetaMask...');
    const tx = await getContract(true).withdraw(ethers.utils.parseEther(eth));
    loading(true, 'Waiting for confirmation...');
    await tx.wait();
    toast('Withdrew ' + eth + ' ETH.', 'success');
    await loadLoans();
  } catch (err) {
    toast(errorText(err), 'error');
  }
  loading(false);
}

async function sendEth(id) {
  try {
    loading(true, 'Confirm in MetaMask...');
    const tx = await getContract(true).disburseLoan(id);
    loading(true, 'Waiting for confirmation...');
    await tx.wait();
    toast('ETH sent to the borrower for loan #' + id + '.', 'success');
    await loadLoans();
  } catch (err) {
    toast(errorText(err), 'error');
  }
  loading(false);
}

$('fundBtn').onclick = fund;
$('withdrawBtn').onclick = withdraw;
$('refreshBtn').onclick = () => loadLoans().catch(err => toast(errorText(err), 'error'));
$('search').oninput = showTable;
