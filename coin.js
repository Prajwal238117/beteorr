import { auth, db } from "./firebaseConfig.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, onSnapshot, runTransaction, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", function() {
  // ---------------------
  //  DOM ELEMENTS
  // ---------------------
  const coinFace = document.getElementById("coin-face");
  const headsBtn = document.getElementById("heads-btn");
  const tailsBtn = document.getElementById("tails-btn");
  const resultText = document.getElementById("result");
  const betAmountInput = document.getElementById("bet-amount");
  const placeBetBtn = document.getElementById("place-bet-btn");
  const betMessageEl = document.getElementById("bet-message");
  const balanceSpan = document.getElementById("balance-amount");

  // ---------------------
  //  BALANCE MODAL SETUP
  // ---------------------
  function setupBalanceModal() {
    const balanceInfo = document.getElementById('balance-amount');
    const balanceModal = document.getElementById('balanceModal');
    const closeModalBtn = balanceModal.querySelector('.modal-close');
    const depositOption = document.getElementById('depositOption');
    const withdrawOption = document.getElementById('withdrawOption');

    // Open modal when clicking balance
    balanceInfo.addEventListener('click', (e) => {
      if (!auth.currentUser) return; // Don't show modal if not logged in
      e.stopPropagation();
      balanceModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    });

    // Close modal when clicking close button
    closeModalBtn.addEventListener('click', () => {
      balanceModal.classList.remove('active');
      document.body.style.overflow = '';
    });

    // Close modal when clicking outside
    balanceModal.addEventListener('click', (e) => {
      if (e.target === balanceModal) {
        balanceModal.classList.remove('active');
        document.body.style.overflow = '';
      }
    });

    // Handle deposit option click
    depositOption.addEventListener('click', () => {
      balanceModal.classList.remove('active');
      document.body.style.overflow = '';
      showToast('Opening deposit options...', 'info');
    });

    // Handle withdraw option click
    withdrawOption.addEventListener('click', () => {
      balanceModal.classList.remove('active');
      document.body.style.overflow = '';
      showToast('Opening withdrawal options...', 'info');
    });

    // Close modal on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && balanceModal.classList.contains('active')) {
        balanceModal.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  }

  // Initialize balance modal
  setupBalanceModal();

  // ---------------------
  //  GLOBALS
  // ---------------------
  let userBalance = 0;       // Local cache of the user's money
  let currentBet = 0;        // The current bet amount
  const MIN_BET = 30;        // Minimum bet is Rs 30
  let userDocRef = null;     // Reference to user's document

  // Disable game actions until we know user's status
  headsBtn.disabled = true;
  tailsBtn.disabled = true;
  placeBetBtn.disabled = true;

  // ---------------------
  //  FIREBASE SETUP
  // ---------------------
  // Listen for auth state changes
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // The user is logged in. user.uid is the doc ID in "users" collection
      userDocRef = doc(db, "users", user.uid);
      placeBetBtn.disabled = false; // allow bets if user is logged in
      balanceSpan.classList.add('logged-in');

      // 1. Realtime listener for the user's doc in "users"
      onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          console.log("Doc data:", docSnap.data()); // For debugging
          const data = docSnap.data();
          userBalance = parseFloat(data.money) || 0;
          if (balanceSpan) {
            balanceSpan.innerHTML = `<span>NPR ${userBalance.toFixed(2)}</span>`;
          }
        } else {
          console.error("User document not found in 'users' collection.");
          if (balanceSpan) {
            balanceSpan.innerHTML = `<span>NPR 0.00</span>`;
          }
        }
      });
    } else {
      // No user is logged in
      userDocRef = null;
      userBalance = 0;
      if (balanceSpan) {
        balanceSpan.classList.remove('logged-in');
        balanceSpan.innerHTML = `
          <a href="login.html" class="cta-btn">Sign-In/Sign-Up</a>
        `;
      }
      if (betMessageEl) {
        betMessageEl.textContent = "Please log in to place a bet.";
      }
      // Disable game controls
      headsBtn.disabled = true;
      tailsBtn.disabled = true;
      placeBetBtn.disabled = true;
      betAmountInput.disabled = true;
    }
  });

  // ---------------------
  //  PLACE BET LOGIC
  // ---------------------
  placeBetBtn.addEventListener('click', onPlaceBet);

  function onPlaceBet() {
    if (betMessageEl) {
      betMessageEl.textContent = "";
    }
    const betValue = parseFloat(betAmountInput.value);

    // Validate bet
    if (isNaN(betValue) || betValue <= 0) {
      if (betMessageEl) {
        betMessageEl.textContent = "Please enter a valid bet amount.";
      }
      return;
    }
    if (betValue < MIN_BET) {
      if (betMessageEl) {
        betMessageEl.textContent = "Minimum bet is Rs " + MIN_BET + ".";
      }
      return;
    }
    if (betValue > userBalance) {
      if (betMessageEl) {
        betMessageEl.textContent = "Insufficient funds for this bet.";
      }
      return;
    }

    currentBet = betValue;

    if (userDocRef) {
      // Logged-in user: deduct bet from Firestore
      placeBetBtn.disabled = true;
      runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(userDocRef);
        if (!docSnap.exists()) throw "User doc does not exist!";
        const currentMoney = docSnap.data().money || 0;
        if (currentMoney < betValue) throw "Insufficient funds.";
        transaction.update(userDocRef, { money: currentMoney - betValue });
      })
      .then(() => {
        userBalance -= betValue;
        finalizePlaceBet();
      })
      .catch((error) => {
        console.error("Error placing bet:", error);
        if (betMessageEl) {
          betMessageEl.textContent = "Error placing bet: " + error;
        }
        placeBetBtn.disabled = false;
      });
    } else {
      // No user logged in, fallback to local balance (demo/testing)
      userBalance -= betValue;
      finalizePlaceBet();
    }
  }

  function finalizePlaceBet() {
    updateBalanceDisplay();
    // Enable coin flip buttons
    headsBtn.disabled = false;
    tailsBtn.disabled = false;
    if (resultText) {
      resultText.textContent = "Bet placed! Choose Heads or Tails.";
    }
    placeBetBtn.disabled = false;
  }

  function updateBalanceDisplay() {
    if (balanceSpan) {
      balanceSpan.textContent = userBalance.toFixed(2);
    }
  }

  // ---------------------
  //  COIN FLIP LOGIC
  // ---------------------
  function animateCoinFlip(callback) {
    const flips = Math.floor(Math.random() * 10) + 10;
    const interval = 100;
    let currentFlip = 0;

    coinFace.style.animation = "";
    const flipInterval = setInterval(() => {
      coinFace.style.transform = `rotateX(${currentFlip * 180}deg)`;
      coinFace.src = (currentFlip % 2 === 0) ? "h.png" : "t.png";
      currentFlip++;
      if (currentFlip > flips) {
        clearInterval(flipInterval);
        callback();
      }
    }, interval);
  }

  function flipCoin(choice) {
    headsBtn.disabled = true;
    tailsBtn.disabled = true;
    if (resultText) {
      resultText.textContent = "Flipping...";
    }

    animateCoinFlip(() => {
      const isHeads = Math.random() < 0.5;
      const outcome = isHeads ? "heads" : "tails";
      coinFace.style.transform = "rotateX(0deg)";
      coinFace.src = isHeads ? "h.png" : "t.png";

      if (outcome === choice) {
        // Player wins 1.99×
        const winnings = currentBet * 1.99;

        if (userDocRef) {
          // Logged-in user: add winnings in Firestore
          runTransaction(db, async (transaction) => {
            const docSnap = await transaction.get(userDocRef);
            if (!docSnap.exists()) throw "User doc does not exist!";
            const currentMoney = docSnap.data().money || 0;
            transaction.update(userDocRef, { money: currentMoney + winnings });
          })
          .then(async () => {
            // Record game result
            await addDoc(collection(db, 'games'), {
              userId: auth.currentUser.uid,
              gameType: 'coin',
              betAmount: currentBet,
              result: `${outcome} (${choice})`,
              profit: winnings - currentBet,
              timestamp: serverTimestamp()
            });

            if (resultText) {
              resultText.textContent = "🎉 You win!";
            }
          })
          .catch((error) => {
            console.error("Error updating winnings:", error);
            if (resultText) {
              resultText.textContent = "Error updating winnings: " + error;
            }
          });
        } else {
          // No user logged in, update local balance
          userBalance += winnings;
          updateBalanceDisplay();
          if (resultText) {
            resultText.textContent = " You win!";
          }
        }
      } else {
        if (userDocRef) {
          // Record game result even for losses
          addDoc(collection(db, 'games'), {
            userId: auth.currentUser.uid,
            gameType: 'coin',
            betAmount: currentBet,
            result: `${outcome} (${choice})`,
            profit: -currentBet,
            timestamp: serverTimestamp()
          });
        }
        if (resultText) {
          resultText.textContent = " You lose!";
        }
      }
    });
  }

  headsBtn.addEventListener("click", function() {
    flipCoin("heads");
  });
  tailsBtn.addEventListener("click", function() {
    flipCoin("tails");
  });

  // ---------------------
  //  TOAST NOTIFICATIONS
  // ---------------------
  function showToast(message, type = 'info') {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      document.body.appendChild(toastContainer);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-content">${message}</div>
      <button class="toast-close" aria-label="Close notification">×</button>
    `;

    // Add toast to container
    toastContainer.appendChild(toast);

    // Add close functionality
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
      toast.remove();
    });

    // Auto remove after 3 seconds
    setTimeout(() => {
      if (toast && toast.parentElement) {
        toast.remove();
      }
    }, 3000);
  }
});