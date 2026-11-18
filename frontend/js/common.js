const CONTRACT_ADDRESS = '0x5Df2348Ca8e83898687D15d2B7f0AFBB6FC62E77';
const SEPOLIA_CHAIN_ID = '0xaa36a7';
const WEI_PER_RUPEE = '100000000000';

const ABI = [
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "name",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "age",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "employment",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "monthlyIncome",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "loanAmount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "duration",
        "type": "uint256"
      }
    ],
    "name": "applyForLoan",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "loanId",
        "type": "uint256"
      }
    ],
    "name": "disburseLoan",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "fundContract",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "loanId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "repayLoan",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "amountWei",
        "type": "uint256"
      }
    ],
    "name": "withdraw",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "borrower",
        "type": "address"
      }
    ],
    "name": "getBorrowerLoans",
    "outputs": [
      {
        "internalType": "uint256[]",
        "name": "",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "loanId",
        "type": "uint256"
      }
    ],
    "name": "getLoan",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "borrower",
            "type": "address"
          },
          {
            "internalType": "string",
            "name": "name",
            "type": "string"
          },
          {
            "internalType": "uint256",
            "name": "age",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "employment",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "monthlyIncome",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "loanAmount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "duration",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "interest",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amountRepaid",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "approved",
            "type": "bool"
          },
          {
            "internalType": "string",
            "name": "rejectionReason",
            "type": "string"
          },
          {
            "internalType": "uint256",
            "name": "appliedAt",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "disbursed",
            "type": "bool"
          }
        ],
        "internalType": "struct LoanManagement.Loan",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "loanId",
        "type": "uint256"
      }
    ],
    "name": "getRepaymentHistory",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "timestamp",
            "type": "uint256"
          }
        ],
        "internalType": "struct LoanManagement.Repayment[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "loanCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

function inr(rupees) {
  return '₹' + Number(rupees).toLocaleString('en-IN');
}

function ethOf(rupees) {
  return ethers.utils.formatEther(ethers.BigNumber.from(String(rupees)).mul(WEI_PER_RUPEE));
}

function shortAddr(address) {
  return address.slice(0, 6) + '...' + address.slice(-4);
}

function esc(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function errorText(err) {
  if (err.code === 4001 || err.code === 'ACTION_REJECTED') return 'You rejected the transaction in MetaMask.';
  const inner = err.error || err;
  const found = (JSON.stringify(inner) + inner.message).match(/(?:execution reverted: |"reason":")([^"\\]*)/);
  return found ? found[1] : err.message;
}

function toast(message, type) {
  let box = document.getElementById('toast-box');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toast-box';
    document.body.appendChild(box);
  }
  const t = document.createElement('div');
  t.className = 'toast ' + (type || '');
  t.textContent = message;
  box.appendChild(t);
  setTimeout(() => t.remove(), 5000);
}

function loading(show, text) {
  let box = document.getElementById('loading-overlay');
  if (!box) {
    box = document.createElement('div');
    box.id = 'loading-overlay';
    box.innerHTML = '<div class="spinner"></div><p id="loading-text"></p>';
    document.body.appendChild(box);
  }
  document.getElementById('loading-text').textContent = text || 'Working...';
  box.style.display = show ? 'flex' : 'none';
}

async function isSepolia() {
  return (await ethereum.request({ method: 'eth_chainId' })) === SEPOLIA_CHAIN_ID;
}

async function connectWallet() {
  if (!window.ethereum) throw new Error('MetaMask is not installed. Get it from metamask.io');
  const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
  if (!(await isSepolia())) {
    await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: SEPOLIA_CHAIN_ID }] });
  }
  return accounts[0];
}

async function getConnectedAccount() {
  if (!window.ethereum) return null;
  const accounts = await ethereum.request({ method: 'eth_accounts' });
  return accounts.length ? accounts[0] : null;
}

function getContract(withSigner) {
  if (!ethers.utils.isAddress(CONTRACT_ADDRESS)) throw new Error('Contract address is not set. Paste it in js/common.js');
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const signerOrProvider = withSigner ? provider.getSigner() : provider;
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, signerOrProvider);
}

async function setupTopNav(onConnected) {
  const pill = document.getElementById('networkPill');
  const button = document.getElementById('connectBtn');

  async function show(account) {
    const ok = await isSepolia();
    button.textContent = shortAddr(account);
    pill.textContent = ok ? 'Sepolia' : 'Wrong network - switch to Sepolia';
    pill.className = 'pill ' + (ok ? 'ok' : 'bad');
    if (onConnected) onConnected(account);
  }

  button.onclick = async () => {
    try {
      show(await connectWallet());
    } catch (err) {
      toast(errorText(err), 'error');
    }
  };

  const account = await getConnectedAccount();
  if (account) show(account);
}

async function readLoan(contract, id) {
  const loan = await contract.getLoan(id);
  return {
    id: id,
    borrower: loan.borrower,
    name: loan.name,
    age: loan.age.toNumber(),
    employment: loan.employment.toNumber(),
    income: loan.monthlyIncome.toNumber(),
    amount: loan.loanAmount.toNumber(),
    duration: loan.duration.toNumber(),
    interest: loan.interest.toNumber(),
    repaid: loan.amountRepaid.toNumber(),
    approved: loan.approved,
    reason: loan.rejectionReason,
    appliedAt: loan.appliedAt.toNumber() * 1000,
    disbursed: loan.disbursed
  };
}

function isRepaid(loan) {
  return loan.repaid === loan.amount + loan.interest;
}

function statusOf(loan) {
  if (!loan.approved) return 'Rejected';
  if (isRepaid(loan)) return 'Repaid';
  if (loan.disbursed) return 'Disbursed';
  return 'Awaiting Disbursement';
}

if (window.ethereum) {
  ethereum.on('accountsChanged', () => location.reload());
  ethereum.on('chainChanged', () => location.reload());
}
