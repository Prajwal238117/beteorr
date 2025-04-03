import { auth, db } from "./firebaseConfig.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, onSnapshot, runTransaction, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Balance Modal Setup
function setupBalanceModal() {
  const balanceInfo = document.getElementById('balanceInfo');
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

// Initialize balance modal when DOM is loaded
document.addEventListener('DOMContentLoaded', setupBalanceModal);

/************************************************
 * 2) Global Variables & Game Setup
 ***********************************************/
const rows = 5, cols = 5;
let mineCount = 1;
let grid = [];
let gameOver = false;
let revealedCount = 0;
let currentBet = 0;
let canPlay = false;
let userBalance = 0;

// DOM Elements
const balanceInfoEl   = document.getElementById('balanceInfo');
const betAmountInput  = document.getElementById('betAmount');
const mineCountSelect = document.getElementById('mineCountSelect');
const placeBetBtn     = document.getElementById('placeBetBtn');
const betMessageEl    = document.getElementById('betMessage');
const gridElement     = document.getElementById('grid');
const resultOverlay   = document.getElementById('resultOverlay');
const pickRandomBtn   = document.getElementById('pickRandomBtn');

// Populate mineCountSelect options
for (let i = 1; i <= 24; i++) {
  const option = document.createElement('option');
  option.value = i;
  option.textContent = i;
  mineCountSelect.appendChild(option);
}

/************************************************
 * Realtime Balance Listener
 ***********************************************/
// When the user is authenticated, listen for realtime changes to the user document
onAuthStateChanged(auth, (user) => {
  if (user) {
    const userRef = doc(db, "users", user.uid);
    balanceInfoEl.classList.add('logged-in');
    onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        userBalance = docSnap.data().money || 0;
        updateBalanceDisplay();
      }
    }, (error) => {
      console.error("Error with realtime balance:", error);
      balanceInfoEl.classList.remove('logged-in');
      balanceInfoEl.innerHTML = `<a href="login.html" class="cta-btn">Sign-In/Sign-Up</a>`;
    });
  } else {
    userBalance = 0;
    balanceInfoEl.classList.remove('logged-in');
    balanceInfoEl.innerHTML = `<a href="login.html" class="cta-btn">Sign-In/Sign-Up</a>`;
    // Disable game controls
    gridElement.classList.add('disabled');
    betAmountInput.disabled = true;
    mineCountSelect.disabled = true;
    placeBetBtn.disabled = true;
    pickRandomBtn.disabled = true;
  }
});

function updateBalanceDisplay() {
  balanceInfoEl.innerHTML = `<span>NPR ${userBalance.toFixed(2)}</span>`;
}

/************************************************
 * 3) Combination & Multiplier Calculation
 ***********************************************/
function combination(n, r) {
  if (r > n) return 0;
  let result = 1;
  for (let i = 0; i < r; i++) {
    result *= (n - i);
    result /= (i + 1);
  }
  return result;
}

function getMultiplier(m, k) {
  if (k === 0) return 1.0;
  const numerator = combination(25 - m, k);
  const denominator = combination(25, k);
  if (denominator === 0 || numerator === 0) return 0;
  const prob = numerator / denominator;
  const multiplier = 0.97 / prob;
  return parseFloat(multiplier.toFixed(2));
}

/************************************************
 * 4) Single Button Logic (Bet → Cashout)
 ***********************************************/
placeBetBtn.addEventListener('click', onPlaceBet);

function onPlaceBet() {
  betMessageEl.textContent = "";
  const betValue = parseFloat(betAmountInput.value);
  if (isNaN(betValue) || betValue <= 0) {
    betMessageEl.textContent = "Please enter a valid bet amount.";
    return;
  }
  // Minimum bet is Rs 30
  if (betValue < 30) {
    betMessageEl.textContent = "Minimum bet is Rs 30.";
    return;
  }
  if (betValue > userBalance) {
    betMessageEl.textContent = "Insufficient funds for this bet.";
    return;
  }
  
  // Disable bet inputs so the user cannot change them after the bet is placed
  betAmountInput.disabled = true;
  mineCountSelect.disabled = true;
  
  mineCount = parseInt(mineCountSelect.value);
  currentBet = betValue;
  
  // Optimistic UI update: cache current balance and update display immediately
  const previousBalance = userBalance;
  userBalance -= betValue;
  updateBalanceDisplay();
  
  const user = auth.currentUser;
  if (user) {
    placeBetBtn.disabled = true;
    const userRef = doc(db, "users", user.uid);
    runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(userRef);
      if (!docSnap.exists()) throw "User doc does not exist!";
      const currentMoney = docSnap.data().money || 0;
      if (currentMoney < betValue) throw "Insufficient funds.";
      transaction.update(userRef, { money: currentMoney - betValue });
    })
      .then(() => {
        finalizePlaceBet();
      })
      .catch((error) => {
        console.error("Error placing bet:", error);
        betMessageEl.textContent = "Error placing bet: " + error;
        placeBetBtn.disabled = false;
        // Revert optimistic update if error occurs
        userBalance = previousBalance;
        updateBalanceDisplay();
        betAmountInput.disabled = false;
        mineCountSelect.disabled = false;
      });
  } else {
    finalizePlaceBet();
  }
}

function finalizePlaceBet() {
  updateBalanceDisplay();
  canPlay = true;
  gameOver = false;
  gridElement.classList.remove('disabled');
  initGrid();
  // Change button to cashout mode
  placeBetBtn.removeEventListener('click', onPlaceBet);
  placeBetBtn.addEventListener('click', onCashout);
  updateButtonMultiplier();
  placeBetBtn.disabled = false;
}

function onCashout() {
  if (!canPlay || gameOver) return;
  doCashout(false);
}

/************************************************
 * 5) Pick Random Tile Logic
 ***********************************************/
pickRandomBtn.addEventListener('click', () => {
  if (!canPlay || gameOver) return;
  const hiddenCells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c].revealed) {
        hiddenCells.push({ r, c });
      }
    }
  }
  if (hiddenCells.length === 0) return;
  const randomIndex = Math.floor(Math.random() * hiddenCells.length);
  const { r, c } = hiddenCells[randomIndex];
  const cellDiv = gridElement.querySelector(`[data-row="${r}"][data-col="${c}"]`);
  cellDiv.click();
});

/************************************************
 * 6) Initialize & Render the Game Grid
 ***********************************************/
function initGrid() {
  revealedCount = 0;
  resultOverlay.style.display = "none";
  gridElement.innerHTML = "";
  grid = [];
  for (let r = 0; r < rows; r++) {
    let row = [];
    for (let c = 0; c < cols; c++) {
      row.push({ mine: false, revealed: false });
    }
    grid.push(row);
  }
  let minesPlaced = 0;
  while (minesPlaced < mineCount) {
    const rr = Math.floor(Math.random() * rows);
    const cc = Math.floor(Math.random() * cols);
    if (!grid[rr][cc].mine) {
      grid[rr][cc].mine = true;
      minesPlaced++;
    }
  }
  // Use a DocumentFragment for faster rendering
  const frag = document.createDocumentFragment();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellDiv = document.createElement('div');
      cellDiv.classList.add('cell');
      cellDiv.dataset.row = r;
      cellDiv.dataset.col = c;
      cellDiv.addEventListener('click', onCellClick);
      // Add a question mark or cell content to show it's clickable
      cellDiv.innerHTML = '<span class="cell-content">?</span>';
      frag.appendChild(cellDiv);
    }
  }
  gridElement.appendChild(frag);
  
  // Show the grid but keep it disabled until bet is placed
  gridElement.style.opacity = "1";
  gridElement.style.visibility = "visible";
}

/************************************************
 * 7) Handle Cell Click
 ***********************************************/
function onCellClick(e) {
  if (!canPlay || gameOver) return;
  const cellDiv = e.target.closest('.cell');  // Use closest to handle clicks on child elements
  if (!cellDiv) return;
  
  const r = parseInt(cellDiv.dataset.row);
  const c = parseInt(cellDiv.dataset.col);
  if (grid[r][c].revealed) return;
  
  grid[r][c].revealed = true;
  cellDiv.classList.add('revealed');
  
  if (grid[r][c].mine) {
    // Bomb: show bomb image
    cellDiv.classList.add('mine');
    cellDiv.innerHTML = `
      <div class="image-container">
        <img src="bomb.png" class="bomb-img" alt="Bomb" />
      </div>
    `;
    gameOver = true;
    canPlay = false;
    revealAllCells();
    showResultOverlay("You Lost! Better Luck Next Time.");
    placeBetBtn.textContent = "Round Over";
    placeBetBtn.disabled = true;
    setTimeout(resetRound, 3000);
  } else {
    // Safe: show diamond image
    cellDiv.innerHTML = `
      <div class="image-container">
        <img src="di.png" class="diamond-img" alt="Safe Diamond" />
      </div>
    `;
    revealedCount++;
    if (revealedCount === rows * cols - mineCount) {
      doCashout(true);
    } else {
      updateButtonMultiplier();
    }
  }
}

function countAdjacentMines(r, c) {
  let count = 0;
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const rr = r + i;
      const cc = c + j;
      if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) {
        if (grid[rr][cc].mine) {
          count++;
        }
      }
    }
  }
  return count;
}

// Reveal all cells (both mines and safe cells)
function revealAllCells() {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellDiv = gridElement.querySelector(`[data-row="${r}"][data-col="${c}"]`);
      if (!cellDiv.classList.contains('revealed')) {
        cellDiv.classList.add('revealed');
        if (grid[r][c].mine) {
          cellDiv.innerHTML = `
            <div class="image-container">
              <img src="bomb.png" class="bomb-img" alt="Bomb" />
            </div>
          `;
        } else {
          cellDiv.innerHTML = `
            <div class="image-container">
              <img src="di.png" class="diamond-img" alt="Safe Diamond" />
            </div>
          `;
        }
      }
    }
  }
}

/************************************************
 * 8) Update Button Label with Current Multiplier
 ***********************************************/
function updateButtonMultiplier() {
  if (!canPlay || gameOver) return;
  const multiplier = getMultiplier(mineCount, revealedCount);
  placeBetBtn.textContent = `Cashout at x${multiplier}`;
}

/************************************************
 * 9) Cashout & Show Result Overlay
 ***********************************************/
async function doCashout(isWin) {
  gameOver = true;
  canPlay = false;
  // Reveal all cells before cashout
  revealAllCells();
  const multiplier = getMultiplier(mineCount, revealedCount);
  const finalPayout = currentBet * multiplier;
  const user = auth.currentUser;
  if (user) {
    try {
      const userRef = doc(db, "users", user.uid);
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(userRef);
        if (!docSnap.exists()) throw "User doc does not exist!";
        const currentMoney = docSnap.data().money || 0;
        transaction.update(userRef, { money: currentMoney + finalPayout });
      });
      userBalance += finalPayout;

      // Record game result
      await addDoc(collection(db, 'games'), {
        userId: user.uid,
        gameType: 'mines',
        betAmount: currentBet,
        result: `Cashout at ${revealedCount} gems`,
        profit: finalPayout - currentBet,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error("Error in cashout:", error);
    }
  } else {
    userBalance += finalPayout;
  }
  updateBalanceDisplay();
  showResultOverlay(`You cashed out at x${multiplier} and got Rs ${finalPayout.toFixed(2)}.`);
  placeBetBtn.textContent = "Round Over";
  placeBetBtn.disabled = true;
  setTimeout(resetRound, 3000);
}

function showResultOverlay(msg) {
  resultOverlay.innerHTML = msg;
  resultOverlay.style.display = "block";
}

/************************************************
 * 10) Reset Round after 3 seconds (Grid remains visible)
 ***********************************************/
function resetRound() {
  resultOverlay.style.display = "none";
  gridElement.innerHTML = "";
  initGrid();
  canPlay = false;
  gameOver = false;
  revealedCount = 0;
  placeBetBtn.removeEventListener('click', onCashout);
  placeBetBtn.addEventListener('click', onPlaceBet);
  placeBetBtn.textContent = "Place Bet";
  placeBetBtn.disabled = false;
  
  // Re-enable bet amount and mine count inputs for the next round
  betAmountInput.disabled = false;
  mineCountSelect.disabled = false;
}

// Initialize grid on page load
initGrid();
