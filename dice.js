import { auth, db } from "./firebaseConfig.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, onSnapshot, runTransaction, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// DOM Elements
const balanceInfo = document.getElementById('balanceInfo');
const betAmount = document.getElementById('betAmount');
const targetNumber = document.getElementById('targetNumber');
const overBtn = document.getElementById('overBtn');
const underBtn = document.getElementById('underBtn');
const dice = document.getElementById('dice');
const resultText = document.getElementById('resultText');
const betMessage = document.getElementById('betMessage');
const potentialWin = document.getElementById('potentialWin');
const multiplierDisplay = document.getElementById('multiplier');

// Game State
let userBalance = 0;
let currentBet = 0;
const MIN_BET = 30;
let userDocRef = null;
let isRolling = false;

// Dice face patterns (dots positions in the 3x3 grid)
const dicePatterns = {
  1: [4], // Center
  2: [0, 8], // Top-left and bottom-right
  3: [0, 4, 8], // Diagonal
  4: [0, 2, 6, 8], // Corners
  5: [0, 2, 4, 6, 8], // Corners + center
  6: [0, 2, 3, 5, 6, 8] // Left and right columns
};

// Setup Balance Modal
function setupBalanceModal() {
  const balanceModal = document.getElementById('balanceModal');
  const closeModalBtn = balanceModal.querySelector('.modal-close');
  const depositOption = document.getElementById('depositOption');
  const withdrawOption = document.getElementById('withdrawOption');

  balanceInfo.addEventListener('click', (e) => {
    if (!auth.currentUser) return;
    e.stopPropagation();
    balanceModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  });

  closeModalBtn.addEventListener('click', () => {
    balanceModal.classList.remove('active');
    document.body.style.overflow = '';
  });

  balanceModal.addEventListener('click', (e) => {
    if (e.target === balanceModal) {
      balanceModal.classList.remove('active');
      document.body.style.overflow = '';
    }
  });

  depositOption.addEventListener('click', () => {
    balanceModal.classList.remove('active');
    document.body.style.overflow = '';
    showToast('Opening deposit options...', 'info');
  });

  withdrawOption.addEventListener('click', () => {
    balanceModal.classList.remove('active');
    document.body.style.overflow = '';
    showToast('Opening withdrawal options...', 'info');
  });
}

// Initialize game
function initGame() {
  setupBalanceModal();
  setupEventListeners();
  createDiceFaces(); // Create dice faces immediately
  updateDiceFace(1);
  updateMultiplier(); // Initialize multiplier display
  
  // Listen for auth state changes
  onAuthStateChanged(auth, (user) => {
    if (user) {
      userDocRef = doc(db, "users", user.uid);
      enableGameControls();

      // Real-time balance updates
      onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          userBalance = parseFloat(data.money) || 0;
          updateBalanceDisplay();
        } else {
          userBalance = 0;
          updateBalanceDisplay();
        }
      });
    } else {
      userDocRef = null;
      userBalance = 0;
      disableGameControls();
      updateBalanceDisplay();
      betMessage.textContent = "Please log in to play.";
    }
  });
}

// Setup Event Listeners
function setupEventListeners() {
  betAmount.addEventListener('input', updatePotentialWin);
  targetNumber.addEventListener('change', updateMultiplier);
  overBtn.addEventListener('click', () => placeBet('over'));
  underBtn.addEventListener('click', () => placeBet('under'));
}

// Update dice face display
function updateDiceFace(number) {
  updateAllFaces(number);
}

// Create all six faces of the dice
function createDiceFaces() {
  dice.innerHTML = '';
  const faces = ['front', 'back', 'right', 'left', 'top', 'bottom'];
  faces.forEach(face => {
    const faceEl = document.createElement('div');
    faceEl.className = `dice-face ${face}`;
    for (let i = 0; i < 9; i++) {
      const dot = document.createElement('span');
      dot.className = 'dot';
      faceEl.appendChild(dot);
    }
    dice.appendChild(faceEl);
  });
}

// Update all faces with appropriate dot patterns
function updateAllFaces(number) {
  const faces = dice.querySelectorAll('.dice-face');
  faces.forEach((face, index) => {
    // Clear existing dots
    face.querySelectorAll('.dot').forEach(dot => {
      dot.style.opacity = '0';
    });
    
    // Get the number for this face
    let faceNumber;
    switch(index) {
      case 0: // front
        faceNumber = number;
        break;
      case 1: // back
        faceNumber = 7 - number; // Opposite face
        break;
      case 2: // right
        faceNumber = ((number + 1) > 6) ? 1 : number + 1;
        break;
      case 3: // left
        faceNumber = ((number - 1) < 1) ? 6 : number - 1;
        break;
      case 4: // top
        faceNumber = ((number + 2) > 6) ? number - 4 : number + 2;
        break;
      case 5: // bottom
        faceNumber = ((number - 2) < 1) ? number + 4 : number - 2;
        break;
    }
    
    // Show dots for this face
    const dots = face.querySelectorAll('.dot');
    dicePatterns[faceNumber].forEach(dotIndex => {
      dots[dotIndex].style.opacity = '1';
    });
  });
}

// Calculate multiplier based on probability
function calculateMultiplier(target, type) {
  const probability = type === 'over' ? 
    (6 - target) / 6 : 
    (target - 1) / 6;
  return (0.95 / probability).toFixed(2); // 95% return to player
}

// Update multiplier display
function updateMultiplier() {
  const target = parseInt(targetNumber.value);
  const overMultiplier = calculateMultiplier(target, 'over');
  const underMultiplier = calculateMultiplier(target, 'under');
  multiplierDisplay.textContent = `Over: ${overMultiplier}x | Under: ${underMultiplier}x`;
  updatePotentialWin();
}

// Update potential win amount
function updatePotentialWin() {
  const bet = parseFloat(betAmount.value) || 0;
  const target = parseInt(targetNumber.value);
  const overWin = (bet * calculateMultiplier(target, 'over')).toFixed(2);
  const underWin = (bet * calculateMultiplier(target, 'under')).toFixed(2);
  potentialWin.textContent = `Over: ${overWin} | Under: ${underWin}`;
}

// Roll the dice with animation
function rollDice() {
  return new Promise(resolve => {
    // Reset result text
    resultText.textContent = '';
    resultText.className = 'result-text';
    
    // Start rolling animation
    dice.classList.remove('rolling');
    void dice.offsetWidth; // Force reflow
    dice.classList.add('rolling');
    
    // Determine final result before animation starts
    const finalResult = Math.floor(Math.random() * 6) + 1;
    
    // Show random faces during roll
    let rollCount = 0;
    const maxRolls = 8;
    const rollInterval = setInterval(() => {
      if (rollCount < maxRolls) {
        const randomFace = Math.floor(Math.random() * 6) + 1;
        updateAllFaces(randomFace);
        rollCount++;
      } else {
        clearInterval(rollInterval);
        updateAllFaces(finalResult);
      }
    }, 200);
    
    // Wait for animation to complete
    setTimeout(() => {
      dice.classList.remove('rolling');
      resolve(finalResult);
    }, 2000); // Match the CSS animation duration
  });
}

// Place bet and roll dice
async function placeBet(type) {
  if (isRolling) return;
  
  betMessage.textContent = "";
  const bet = parseFloat(betAmount.value);
  const target = parseInt(targetNumber.value);
  
  // Validate bet
  if (isNaN(bet) || bet < MIN_BET) {
    betMessage.textContent = `Minimum bet is Rs ${MIN_BET}`;
    return;
  }
  if (bet > userBalance) {
    betMessage.textContent = "Insufficient funds";
    return;
  }

  // Disable controls during roll
  isRolling = true;
  disableGameControls();

  try {
    // Deduct bet amount
    if (userDocRef) {
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(userDocRef);
        if (!docSnap.exists()) throw "User document not found";
        const currentMoney = docSnap.data().money || 0;
        if (currentMoney < bet) throw "Insufficient funds";
        transaction.update(userDocRef, { money: currentMoney - bet });
      });
    }

    // Roll the dice
    const result = await rollDice();
    const won = type === 'over' ? result > target : result < target;
    const multiplier = calculateMultiplier(target, type);
    const winAmount = won ? bet * multiplier : 0;

    // Update balance if won
    if (won && userDocRef) {
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(userDocRef);
        if (!docSnap.exists()) throw "User document not found";
        const currentMoney = docSnap.data().money || 0;
        transaction.update(userDocRef, { money: currentMoney + winAmount });
      });
    }

    // Record game result
    if (userDocRef) {
      await addDoc(collection(db, 'games'), {
        userId: auth.currentUser.uid,
        gameType: 'dice',
        betAmount: bet,
        result: `${result} (${type} ${target})`,
        profit: winAmount - bet,
        timestamp: serverTimestamp()
      });
    }

    // Show result with animation
    setTimeout(() => {
      resultText.textContent = won ? 
        `You won Rs ${winAmount.toFixed(2)}!` : 
        "Better luck next time!";
      resultText.className = `result-text visible ${won ? 'win' : 'lose'}`;
      
      // Show toast notification
      showToast(won ? 'Congratulations! You won!' : 'Better luck next time!', 
                won ? 'success' : 'error');
    }, 2100); // Slightly after dice animation completes

  } catch (error) {
    console.error('Error in placeBet:', error);
    betMessage.textContent = error.message;
  } finally {
    // Re-enable controls
    isRolling = false;
    enableGameControls();
  }
}

// Update balance display
function updateBalanceDisplay() {
  if (!balanceInfo) return;
  
  if (auth.currentUser) {
    balanceInfo.classList.add('logged-in');
    balanceInfo.innerHTML = `<span>NPR ${parseInt(userBalance).toLocaleString()}</span>`;
  } else {
    balanceInfo.classList.remove('logged-in');
    balanceInfo.innerHTML = `
      <a href="login.html" class="cta-btn">Sign-In</a>
      <a href="login.html" class="cta-btn">Sign-Up</a>
    `;
  }
}

// Enable game controls
function enableGameControls() {
  betAmount.disabled = false;
  targetNumber.disabled = false;
  overBtn.disabled = false;
  underBtn.disabled = false;
}

// Disable game controls
function disableGameControls() {
  betAmount.disabled = true;
  targetNumber.disabled = true;
  overBtn.disabled = true;
  underBtn.disabled = true;
}

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', initGame); 