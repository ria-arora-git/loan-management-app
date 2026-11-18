# Pixel Loan - Blockchain Loan Management System (Sepolia)

A smart contract decides each loan and pays it out in real (test) Sepolia ETH.

**Fixed rate:** Rs 1,00,000 = 0.01 ETH (1 rupee = 10^11 wei).

## 1. How it works

```
Website (HTML + JS + ethers.js)  ->  MetaMask  ->  LoanManagement.sol on Sepolia
```

| Who | Wallet | Page | Does |
|---|---|---|---|
| Admin (bank) | wallet that deployed the contract | admin.html | deposit ETH, send ETH to a waiting loan, withdraw ETH, see all loans |
| Borrower | any other wallet | borrower.html, repayment.html | apply, view applications, claim ETH, repay in ETH |

**Loan rules** (first failing rule is the rejection reason)

| Rule | Message |
|---|---|
| Age 21 or more | Age must be at least 21 |
| Employed or self-employed | Applicant must be employed or self-employed |
| Monthly income 20000 or more | Monthly income must be at least 20000 |
| Loan at most 10 x monthly income | Loan amount cannot exceed 10 times monthly income |

Interest is a flat 10%. A loan is decided immediately: approved or rejected.

**Status shown to the borrower** (worked out from the loan data, nothing is stored as "status")

| Status | When |
|---|---|
| Rejected | `approved` is false |
| Awaiting Disbursement | approved, `disbursed` is false (contract had too little ETH) |
| Disbursed | approved and `disbursed` is true |
| Repaid | `amountRepaid` equals loan + interest |

**Files**
```
contracts/LoanManagement.sol
frontend/
  index.html  borrower.html  repayment.html  admin.html
  css/        style.css  borrower.css  repayment.css  admin.css
  js/         common.js  borrower.js  repayment.js  admin.js
```

## 2. Steps to run (in this order)

1. **Install MetaMask**, create two accounts: Account 1 = Admin, Account 2 = Borrower.
2. **Select Sepolia** in MetaMask and get free Sepolia ETH from a faucet. Admin needs about 0.15 ETH, borrower about 0.02 ETH.
3. **Deploy with the Admin account:** open remix.ethereum.org, create `LoanManagement.sol`, paste the contract, compile (any 0.8.x), then Deploy & Run with *Injected Provider - MetaMask*, click Deploy. Copy the contract address.
4. **Paste the address** in `frontend/js/common.js`: `const CONTRACT_ADDRESS = '0x...';`
5. **Run the site:** open a terminal in `frontend` and run `python3 -m http.server 8000`, then open http://localhost:8000
6. **Fund the vault:** admin.html, connect Account 1, enter `0.03`, click Deposit ETH.
7. **Check:** apply Rs 1,00,000 (age 25, Employed, income 50,000) with Account 2. It is approved and 0.01 ETH arrives in Account 2.

The wallet that deploys the contract is the admin. Opening admin.html with any other wallet shows "Access denied".

## 3. Presentation order (10-12 minutes)

1. **Idea (1 min):** loan approval and payout are done by code on the blockchain. Rate is Rs 1,00,000 = 0.01 ETH.
2. **Architecture (1 min):** website -> MetaMask -> contract.
3. **Contract (2 min):** `applyForLoan` (the rules and auto-payment), `disburseLoan`, `repayLoan`, then `fundContract` / `withdraw` with their admin `require`.
4. **Live demo (6 min)**

| # | Who | Action | Result |
|---|---|---|---|
| 1 | Admin | show vault balance 0.03 ETH | admin wallet was debited when depositing |
| 2 | Borrower | apply: Asha, 25, Employed, 50000 income, 100000 loan, 10 months | Approved, borrower +0.01 ETH |
| 3 | Borrower | apply again with age 19 | Rejected: "Age must be at least 21", no ETH moves |
| 4 | Borrower | apply Rs 5,00,000 (needs 0.05 ETH, vault has 0.02) | Awaiting Disbursement |
| 5 | Admin | deposit 0.05, click "Send 0.05 ETH" on that row (or borrower clicks Claim ETH) | borrower +0.05 ETH |
| 6 | Borrower (repayment.html) | pay 50000 (shows 0.005 ETH) | outstanding drops, history row appears |
| 7 | Admin | show "ETH repaid", withdraw a little | ETH returns to admin wallet |

5. **Wrap-up (1 min):** rules enforced by code, real ETH moved, public history. Limits: fixed rate, testnet only, no late fees.

## 4. Smart contract, every line group

`contracts/LoanManagement.sol`

**State**
- `owner`: the admin, set in the constructor to `msg.sender` (the deployer).
- `loanCount`: number of loans so far; loan ids are 1, 2, 3...
- `weiPerRupee = 1e11`: the rate.
- `struct Loan`: all details of one loan. `approved` and `disbursed` are true/false flags; `employment` is a number (0 = unemployed, 1 = employed, 2 = self-employed).
- `struct Repayment`: amount and time of one repayment.
- `mapping loans`: loan id -> Loan. `mapping borrowerLoans`: wallet -> list of its loan ids. `mapping repayments`: loan id -> list of Repayment.

**Functions**

| Function | Who | What it does |
|---|---|---|
| `constructor()` | at deploy | `owner = msg.sender` |
| `applyForLoan(...)` | anyone | `require` name, amount, duration are valid. Checks the 4 rules with if / else if and stores the reason. Increases `loanCount`, saves the loan field by field (`Loan storage loan` points to `loans[loanCount]`). If no reason: `approved = true`, `interest = loanAmount * 10 / 100`, and if the contract has enough ETH it calls `disburseLoan`. |
| `disburseLoan(loanId)` | borrower or admin | Pays an approved loan. `require`: loan exists, caller is the borrower or admin, loan approved, not already disbursed, contract has enough ETH. Sets `disbursed = true` first, then `transfer`s `loanAmount * weiPerRupee` wei to the borrower. |
| `repayLoan(loanId, amount)` payable | borrower | `amount` is in rupees, the ETH sent (`msg.value`) must equal `amount * weiPerRupee`. `require`: loan exists, caller is the borrower, approved, disbursed, amount > 0, ETH matches, not more than the amount still owed. Adds to `amountRepaid` and saves a Repayment. |
| `fundContract()` payable | admin | `require(msg.sender == owner)`, then the ETH sent stays in the contract. |
| `withdraw(amountWei)` | admin | `require(msg.sender == owner)`, valid amount, then `transfer` to the admin. |
| `getLoan(loanId)` view | anyone | Returns the Loan (reverts "Loan not found"). |
| `getBorrowerLoans(address)` view | anyone | Ids of a wallet's loans. |
| `getRepaymentHistory(loanId)` view | anyone | All repayments of a loan. |

**Words your teacher may ask about**
- `require(condition, "message")`: stops and undoes everything if the condition is false. This is the error handling.
- `payable`: the function can receive ETH. `msg.value` is the ETH sent, `msg.sender` is the caller.
- `view`: only reads data, free to call.
- `memory` vs `storage`: `memory` is a temporary copy; `storage` points to the data saved on the blockchain.
- `disbursed = true` is set before `transfer` so the same loan can never be paid twice.
- A contract cannot take ETH from a wallet by itself, so the admin deposits first (`fundContract`) and borrowers are paid from that vault.

## 5. Frontend, every function

Every page loads ethers.js and `common.js` first.

**common.js (shared)**

| Name | Purpose |
|---|---|
| `CONTRACT_ADDRESS`, `ABI`, `WEI_PER_RUPEE` | address of the deployed contract, list of contract functions the site uses, the rate |
| `inr`, `ethOf`, `shortAddr`, `esc` | format rupees, rupees to ETH text, shorten an address, make text safe for HTML |
| `errorText(err)` | shows the contract's `require` message or "You rejected the transaction" |
| `toast`, `loading` | pop-up message and spinner overlay |
| `isSepolia`, `connectWallet`, `getConnectedAccount` | network check, MetaMask connect (switches to Sepolia), already-connected wallet without a pop-up |
| `getContract(withSigner)` | contract object (`true` = can send transactions) |
| `setupTopNav` | connect button and network label of index.html and admin.html |
| `readLoan`, `isRepaid`, `statusOf` | read one loan into a simple object, repaid check, status text |

**borrower.js:** `RetroAudio` (8-bit sounds and the speaker button), `showView`, `connect`, `loadLoans`, `showLoans` (stat cards, recent table, history table with filter and search), `openDetails`, `claimEth` (calls `disburseLoan`), `readForm`, `eligibilityProblem`, `updateCalculator`, `goToStep`, `nextStep`, `showAnimation`, `submitLoan` (calls `applyForLoan`, waits, then reads the new loan to show what the contract decided).

**repayment.js:** `connect`, `loadLoans`, `showLoan`, `showHistory`, `updateSummary`, `quickAmount`, `repay` (calls `repayLoan` with the matching ETH).

**admin.js:** `start` (only the owner continues), `loadLoans` (counts and totals), `showTable`, `fund`, `withdraw`, `sendEth`.

Transaction hash column: the blockchain does not keep it inside the loan, so the page saves the hash in the browser when you apply. Loans applied from another browser show a dash.

## 6. What happens on Submit

1. `submitLoan` asks for confirmation, then `connectWallet()`.
2. `contract.applyForLoan(...)` opens MetaMask.
3. On the blockchain: rules checked, loan saved, and if approved and the vault has ETH, `disburseLoan` sends the ETH.
4. The page waits for mining, reads the newest loan with `getLoan`, and shows approved / waiting / rejected with the reason.
5. Tables reload from the contract.

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| "Contract address is not set" | paste it in `js/common.js` |
| "Access denied" | use the account that deployed the contract |
| Wrong network | click Connect and allow MetaMask to switch to Sepolia |
| Awaiting Disbursement | admin deposits ETH, then admin clicks Send ETH or borrower clicks Claim ETH |
| Cannot repay | only Disbursed loans can be repaid |
| Redeployed the contract | update `CONTRACT_ADDRESS` (old loans stay on the old contract) |
# loan-management-app
