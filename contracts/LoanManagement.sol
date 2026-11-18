// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract LoanManagement {

    address public owner;
    uint public loanCount;
    uint weiPerRupee = 1e11;

    struct Loan {
        address borrower;
        string name;
        uint age;
        uint employment;
        uint monthlyIncome;
        uint loanAmount;
        uint duration;
        uint interest;
        uint amountRepaid;
        bool approved;
        string rejectionReason;
        uint appliedAt;
        bool disbursed;
    }

    struct Repayment {
        uint amount;
        uint timestamp;
    }

    mapping(uint => Loan) loans;
    mapping(address => uint[]) borrowerLoans;
    mapping(uint => Repayment[]) repayments;

    constructor() {
        owner = msg.sender;
    }

    function applyForLoan(string memory name, uint age, uint employment, uint monthlyIncome, uint loanAmount, uint duration) public {
        require(bytes(name).length > 0, "Enter your name");
        require(loanAmount > 0, "Invalid loan amount");
        require(duration > 0, "Invalid loan duration");

        string memory reason = "";
        if (age < 21) {
            reason = "Age must be at least 21";
        } else if (employment == 0) {
            reason = "Applicant must be employed or self-employed";
        } else if (monthlyIncome < 20000) {
            reason = "Monthly income must be at least 20000";
        } else if (loanAmount > monthlyIncome * 10) {
            reason = "Loan amount cannot exceed 10 times monthly income";
        }

        loanCount++;
        Loan storage loan = loans[loanCount];
        loan.borrower = msg.sender;
        loan.name = name;
        loan.age = age;
        loan.employment = employment;
        loan.monthlyIncome = monthlyIncome;
        loan.loanAmount = loanAmount;
        loan.duration = duration;
        loan.rejectionReason = reason;
        loan.appliedAt = block.timestamp;
        borrowerLoans[msg.sender].push(loanCount);

        if (bytes(reason).length == 0) {
            loan.approved = true;
            loan.interest = loanAmount * 10 / 100;
            if (address(this).balance >= loanAmount * weiPerRupee) {
                disburseLoan(loanCount);
            }
        }
    }

    function disburseLoan(uint loanId) public {
        Loan storage loan = loans[loanId];
        require(loan.borrower != address(0), "Loan not found");
        require(msg.sender == loan.borrower || msg.sender == owner, "Not allowed");
        require(loan.approved, "Loan not approved");
        require(!loan.disbursed, "Already disbursed");

        uint amountWei = loan.loanAmount * weiPerRupee;
        require(address(this).balance >= amountWei, "Insufficient contract funds");

        loan.disbursed = true;
        (bool success, ) = payable(loan.borrower).call{value: amountWei}("");
        require(success, "Loan transfer failed");
    }

    function repayLoan(uint loanId, uint amount) public payable {
        Loan storage loan = loans[loanId];
        require(loan.borrower != address(0), "Loan not found");
        require(msg.sender == loan.borrower, "Not the borrower");
        require(loan.approved, "Loan not approved");
        require(loan.disbursed, "Loan not disbursed yet");
        require(amount > 0, "Invalid repayment amount");
        require(msg.value == amount * weiPerRupee, "ETH sent must match repayment amount");
        require(loan.amountRepaid + amount <= loan.loanAmount + loan.interest, "Exceeds outstanding amount");

        loan.amountRepaid += amount;
        repayments[loanId].push(Repayment(amount, block.timestamp));
    }

    function fundContract() public payable {
        require(msg.sender == owner, "Only admin can do this");
        require(msg.value > 0, "Send some ETH");
    }

    function withdraw(uint amountWei) public {
        require(msg.sender == owner, "Only admin can do this");
        require(amountWei > 0 && amountWei <= address(this).balance, "Invalid amount");
        (bool success, ) = payable(owner).call{value: amountWei}("");
        require(success, "Withdrawal failed");
    }

    function getLoan(uint loanId) public view returns (Loan memory) {
        require(loans[loanId].borrower != address(0), "Loan not found");
        return loans[loanId];
    }

    function getBorrowerLoans(address borrower) public view returns (uint[] memory) {
        return borrowerLoans[borrower];
    }

    function getRepaymentHistory(uint loanId) public view returns (Repayment[] memory) {
        return repayments[loanId];
    }
}
