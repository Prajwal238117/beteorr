import { auth, db } from "./firebaseConfig.js";
import { doc, runTransaction, getDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { showToast } from "./toast.js";

// Constants
const MIN_DEPOSIT = 1000;
const MAX_DEPOSIT = 10000;
const MIN_WITHDRAW = 1000;
const MAX_WITHDRAW = 10000;

const WALLET_TYPES = {
  ESEWA: 'esewa',
  KHALTI: 'khalti',
  BANK: 'bank'
};

// Handle deposit transaction
export async function handleDeposit(amount, walletType, walletDetails) {
  if (!auth.currentUser) {
    showToast('Please login to make a deposit', 'error');
    return false;
  }

  amount = parseFloat(amount);
  if (isNaN(amount) || amount < MIN_DEPOSIT || amount > MAX_DEPOSIT) {
    showToast(`Please enter a valid amount between Rs ${MIN_DEPOSIT} and Rs ${MAX_DEPOSIT}`, 'error');
    return false;
  }

  try {
    // Create transaction record
    const transactionRef = collection(db, "pending_transactions");
    await addDoc(transactionRef, {
      userId: auth.currentUser.uid,
      type: 'deposit',
      amount: amount,
      status: 'pending',
      walletType: walletType,
      walletDetails: walletDetails,
      adminVerified: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    showToast(`Deposit request of Rs ${amount} submitted successfully`, 'success');
    return true;
  } catch (error) {
    console.error("Error processing deposit:", error);
    showToast('Error processing deposit: ' + error.message, 'error');
    return false;
  }
}

// Handle withdraw transaction
export async function handleWithdraw(amount, walletType, walletDetails) {
  if (!auth.currentUser) {
    showToast('Please log in to withdraw funds', 'error');
    return false;
  }

  amount = parseFloat(amount);
  if (isNaN(amount) || amount < MIN_WITHDRAW || amount > MAX_WITHDRAW) {
    showToast(`Please enter an amount between Rs ${MIN_WITHDRAW} and Rs ${MAX_WITHDRAW}`, 'error');
    return false;
  }

  try {
    const userRef = doc(db, "users", auth.currentUser.uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists() || userDoc.data().money < amount) {
      showToast('Insufficient funds', 'error');
      return false;
    }

    // Create transaction record
    const transactionRef = collection(db, "pending_transactions");
    await addDoc(transactionRef, {
      userId: auth.currentUser.uid,
      type: 'withdraw',
      amount: amount,
      status: 'pending',
      walletType: walletType,
      walletDetails: walletDetails,
      adminVerified: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    showToast(`Withdrawal request of Rs ${amount} submitted successfully`, 'success');
    return true;
  } catch (error) {
    console.error("Error processing withdrawal:", error);
    showToast('Failed to process withdrawal', 'error');
    return false;
  }
}

// Show transaction modal
export function showTransactionModal(type) {
  const modalHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">${type === 'deposit' ? 'Deposit' : 'Withdraw'} Funds</h2>
        <button class="modal-close" aria-label="Close modal">×</button>
      </div>
      <div class="modal-body">
        <div class="input-group">
          <label for="transactionAmount">Amount (Rs):</label>
          <input type="number" id="transactionAmount" 
                 min="${type === 'deposit' ? MIN_DEPOSIT : MIN_WITHDRAW}" 
                 max="${type === 'deposit' ? MAX_DEPOSIT : MAX_WITHDRAW}" 
                 placeholder="Enter amount" />
          <div class="input-hint">
            Min: Rs ${type === 'deposit' ? MIN_DEPOSIT : MIN_WITHDRAW} | 
            Max: Rs ${type === 'deposit' ? MAX_DEPOSIT : MAX_WITHDRAW}
          </div>
        </div>
        
        <div class="input-group">
          <label for="walletType">Select Payment Method:</label>
          <select id="walletType">
            <option value="">Choose a payment method</option>
            <option value="${WALLET_TYPES.ESEWA}">Esewa</option>
            <option value="${WALLET_TYPES.KHALTI}">Khalti</option>
            <option value="${WALLET_TYPES.BANK}">Bank Transfer</option>
          </select>
        </div>

        <div class="wallet-details" id="walletDetails">
          <!-- Dynamic wallet details form will be inserted here -->
        </div>

        <button id="confirmTransaction" class="cta-btn">
          Confirm ${type === 'deposit' ? 'Deposit' : 'Withdrawal'}
        </button>
      </div>
    </div>
  `;

  // Create modal overlay
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay active';
  modalOverlay.innerHTML = modalHTML;
  document.body.appendChild(modalOverlay);

  // Get form elements
  const closeBtn = modalOverlay.querySelector('.modal-close');
  const confirmBtn = modalOverlay.querySelector('#confirmTransaction');
  const amountInput = modalOverlay.querySelector('#transactionAmount');
  const walletTypeSelect = modalOverlay.querySelector('#walletType');
  const walletDetailsContainer = modalOverlay.querySelector('#walletDetails');

  // Update wallet details form based on selected wallet type
  function updateWalletDetailsForm(walletType) {
    let formHTML = '';
    switch(walletType) {
      case WALLET_TYPES.ESEWA:
        formHTML = `
          <div class="qr-container">
            <img src="esewa.png" alt="Esewa QR Code" class="qr-code" />
            <p class="qr-instruction">Scan this QR code to pay with Esewa</p>
          </div>
          <div class="input-group">
            <label for="esewaId">Esewa ID:</label>
            <input type="text" id="esewaId" placeholder="Enter your Esewa ID" required />
          </div>
        `;
        break;
      case WALLET_TYPES.KHALTI:
        formHTML = `
          <div class="qr-container">
            <img src="khalti.png" alt="Khalti QR Code" class="qr-code" />
            <p class="qr-instruction">Scan this QR code to pay with Khalti</p>
          </div>
          <div class="input-group">
            <label for="khaltiId">Khalti ID:</label>
            <input type="text" id="khaltiId" placeholder="Enter your Khalti ID" required />
          </div>
        `;
        break;
      case WALLET_TYPES.BANK:
        formHTML = `
          <div class="qr-container">
            <img src="bank.png" alt="Bank QR Code" class="qr-code" />
            <p class="qr-instruction">Scan this QR code for bank transfer</p>
          </div>
          <div class="input-group">
            <label for="bankName">Bank Name:</label>
            <input type="text" id="bankName" placeholder="Enter bank name" required />
          </div>
          <div class="input-group">
            <label for="accountNumber">Account Number:</label>
            <input type="text" id="accountNumber" placeholder="Enter account number" required />
          </div>
        `;
        break;
    }
    walletDetailsContainer.innerHTML = formHTML;
  }

  // Event listeners
  closeBtn.addEventListener('click', () => {
    modalOverlay.remove();
  });

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      modalOverlay.remove();
    }
  });

  walletTypeSelect.addEventListener('change', () => {
    updateWalletDetailsForm(walletTypeSelect.value);
  });

  confirmBtn.addEventListener('click', async () => {
    const amount = parseFloat(amountInput.value);
    const walletType = walletTypeSelect.value;
    
    if (!walletType) {
      showToast('Please select a payment method', 'error');
      return;
    }

    let walletDetails = {};
    switch(walletType) {
      case WALLET_TYPES.ESEWA:
        const esewaId = document.getElementById('esewaId').value;
        if (!esewaId) {
          showToast('Please enter your Esewa ID', 'error');
          return;
        }
        walletDetails = { esewaId };
        break;
      case WALLET_TYPES.KHALTI:
        const khaltiId = document.getElementById('khaltiId').value;
        if (!khaltiId) {
          showToast('Please enter your Khalti ID', 'error');
          return;
        }
        walletDetails = { khaltiId };
        break;
      case WALLET_TYPES.BANK:
        const bankName = document.getElementById('bankName').value;
        const accountNumber = document.getElementById('accountNumber').value;
        if (!bankName || !accountNumber) {
          showToast('Please enter bank details', 'error');
          return;
        }
        walletDetails = { bankName, accountNumber };
        break;
    }

    if (type === 'deposit') {
      const success = await handleDeposit(amount, walletType, walletDetails);
      if (success) modalOverlay.remove();
    } else {
      const success = await handleWithdraw(amount, walletType, walletDetails);
      if (success) modalOverlay.remove();
    }
  });
}

// Expose showTransactionModal to window object for HTML onclick events
window.showTransactionModal = showTransactionModal; 