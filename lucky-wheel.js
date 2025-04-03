import { auth, db } from './firebaseConfig.js';
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// DOM Elements
const wheelInner = document.querySelector('.wheel-inner');
const spinButton = document.getElementById('spinButton');
const betAmountInput = document.getElementById('betAmount');
const quickBetButtons = document.querySelectorAll('.quick-bet');
const lastWinElement = document.getElementById('lastWin');
const totalSpinsElement = document.getElementById('totalSpins');
const winRateElement = document.getElementById('winRate');

// Game State
let isSpinning = false;
let totalSpins = 0;
let wins = 0;
let userBalance = 0;

// Initialize game
async function initGame() {
    const user = auth.currentUser;
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // Load user balance
    await loadUserBalance();

    // Setup event listeners
    setupEventListeners();
}

// Load user balance
async function loadUserBalance() {
    try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        userBalance = userDoc.data()?.balance || 0;
        document.getElementById('balanceInfo').textContent = `NPR ${userBalance}`;
    } catch (error) {
        console.error('Error loading balance:', error);
        showToast('Failed to load balance', 'error');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Quick bet buttons
    quickBetButtons.forEach(button => {
        button.addEventListener('click', () => {
            betAmountInput.value = button.dataset.amount;
        });
    });

    // Spin button
    spinButton.addEventListener('click', handleSpin);

    // Input validation
    betAmountInput.addEventListener('input', () => {
        const value = parseInt(betAmountInput.value);
        if (value < 10) betAmountInput.value = 10;
        if (value > userBalance) betAmountInput.value = userBalance;
    });
}

// Handle spin
async function handleSpin() {
    if (isSpinning) return;
    
    const betAmount = parseFloat(betAmountInput.value);
    if (isNaN(betAmount) || betAmount <= 0) {
        showToast('Please enter a valid bet amount', 'error');
        return;
    }
    
    if (betAmount > userBalance) {
        showToast('Insufficient balance', 'error');
        return;
    }

    // Deduct bet amount
    userBalance -= betAmount;
    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        balance: userBalance
    });
    document.getElementById('balanceInfo').textContent = `NPR ${userBalance}`;

    // Disable controls during spin
    isSpinning = true;
    spinButton.disabled = true;
    betAmountInput.disabled = true;
    quickBetButtons.forEach(btn => btn.disabled = true);

    // Generate random multiplier with weighted probabilities
    const random = Math.random();
    let selectedMultiplier;
    if (random < 0.4) selectedMultiplier = 0.5;      // 40% chance
    else if (random < 0.7) selectedMultiplier = 1;   // 30% chance
    else if (random < 0.85) selectedMultiplier = 2;  // 15% chance
    else if (random < 0.95) selectedMultiplier = 3;  // 10% chance
    else selectedMultiplier = 5;                     // 5% chance

    // Calculate rotation angle
    const segmentAngle = 360 / 8; // 8 segments
    const targetAngle = segmentAngle * (Math.floor(Math.random() * 8));
    const fullRotations = 5; // Number of full rotations
    const totalRotation = (fullRotations * 360) + targetAngle;

    // Animate wheel
    wheelInner.style.transition = 'transform 5s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
    wheelInner.style.transform = `rotate(${totalRotation}deg)`;

    // Wait for animation to complete
    setTimeout(async () => {
        const winAmount = betAmount * selectedMultiplier;
        
        // Update stats
        totalSpins++;
        if (winAmount > betAmount) wins++;
        
        // Update UI
        lastWinElement.textContent = `${selectedMultiplier}x`;
        totalSpinsElement.textContent = totalSpins;
        winRateElement.textContent = `${Math.round((wins / totalSpins) * 100)}%`;

        // Add win to balance
        if (winAmount > 0) {
            userBalance += winAmount;
            await updateDoc(doc(db, 'users', auth.currentUser.uid), {
                balance: userBalance
            });
            document.getElementById('balanceInfo').textContent = `NPR ${userBalance}`;
            showToast(`You won NPR ${winAmount}!`, 'success');
        }

        // Record game result
        await addDoc(collection(db, 'games'), {
            userId: auth.currentUser.uid,
            gameType: 'lucky-wheel',
            betAmount: betAmount,
            result: `${selectedMultiplier}x`,
            profit: winAmount - betAmount,
            timestamp: serverTimestamp()
        });

        // Re-enable controls
        isSpinning = false;
        spinButton.disabled = false;
        betAmountInput.disabled = false;
        quickBetButtons.forEach(btn => btn.disabled = false);
    }, 5000);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged((user) => {
        if (user) {
            initGame();
        } else {
            window.location.href = 'login.html';
        }
    });
}); 