import { auth, db } from "./firebaseConfig.js";
import { 
    collection, 
    query, 
    getDocs, 
    doc, 
    updateDoc, 
    runTransaction, 
    orderBy, 
    serverTimestamp,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { showToast } from "./toast.js";

// Check if user is admin
async function isAdminUser(user) {
    if (!user) {
        console.log("No user provided to isAdminUser");
        return false;
    }
    
    try {
        console.log("Checking admin status for user:", user.uid);
        const adminDoc = await getDoc(doc(db, "admins", user.uid));
        const isAdmin = adminDoc.exists() || user.uid === 'hITbcLdcskRMahSrYm23mUOnPDq1';
        console.log("User admin status:", isAdmin);
        return isAdmin;
    } catch (error) {
        console.error("Error checking admin status:", error);
        return false;
    }
}

// Initialize admin panel
function initAdminPanel() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const isAdmin = await isAdminUser(user);
            if (isAdmin) {
                try {
                    await loadTransactions();
                } catch (error) {
                    console.error("Error initializing admin panel:", error);
                    showToast("Error initializing admin panel: " + error.message, "error");
                }
            } else {
                window.location.href = "index.html";
            }
        } else {
            window.location.href = "login.html";
        }
    });
}

// Load transactions
async function loadTransactions() {
    try {
        const transactionsContainer = document.getElementById('transactions');
        if (!transactionsContainer) {
            console.error("Transactions container not found");
            return;
        }
        
        transactionsContainer.innerHTML = '<h2>Transactions</h2>';

        // Query both collections
        const transactionsRef = collection(db, "transactions");
        const pendingTransactionsRef = collection(db, "pending_transactions");
        
        console.log("Querying transactions collections...");
        
        const q1 = query(transactionsRef, orderBy("createdAt", "desc"));
        const q2 = query(pendingTransactionsRef, orderBy("createdAt", "desc"));
        
        console.log("Executing queries...");
        
        const [transactionsSnapshot, pendingSnapshot] = await Promise.all([
            getDocs(q1).catch(error => {
                console.error("Error fetching transactions:", error);
                return { docs: [] };
            }),
            getDocs(q2).catch(error => {
                console.error("Error fetching pending transactions:", error);
                return { docs: [] };
            })
        ]);

        console.log("Processing results...");
        
        const transactions = [];
        
        // Process regular transactions
        transactionsSnapshot.forEach((doc) => {
            transactions.push({ id: doc.id, ...doc.data() });
        });
        
        // Process pending transactions
        pendingSnapshot.forEach((doc) => {
            transactions.push({ id: doc.id, ...doc.data() });
        });

        console.log(`Found ${transactions.length} total transactions`);

        if (transactions.length === 0) {
            transactionsContainer.innerHTML += '<p>No transactions found.</p>';
            return;
        }

        // Sort all transactions by createdAt
        transactions.sort((a, b) => {
            const dateA = a.createdAt?.seconds || 0;
            const dateB = b.createdAt?.seconds || 0;
            return dateB - dateA;
        });

        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>User ID</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Wallet Type</th>
                    <th>Wallet Details</th>
                    <th>Created At</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

        const tbody = table.querySelector('tbody');
        transactions.forEach(transaction => {
            const tr = document.createElement('tr');
            const createdAt = transaction.createdAt ? new Date(transaction.createdAt.seconds * 1000).toLocaleString() : 'N/A';
            const walletDetails = formatWalletDetails(transaction.walletDetails);
            
            tr.innerHTML = `
                <td>${transaction.userId}</td>
                <td>${transaction.type}</td>
                <td>Rs ${transaction.amount}</td>
                <td>${transaction.status}</td>
                <td>${transaction.walletType}</td>
                <td>${walletDetails}</td>
                <td>${createdAt}</td>
                <td>
                    ${transaction.status === 'pending' ? `
                        <button onclick="verifyTransaction('${transaction.id}', 'approve')" class="verify-btn">
                            Verify
                        </button>
                        <button onclick="verifyTransaction('${transaction.id}', 'reject')" class="reject-btn">
                            Reject
                        </button>
                    ` : transaction.status}
                </td>
            `;
            tbody.appendChild(tr);
        });

        transactionsContainer.appendChild(table);
        console.log("Transactions table created successfully");
    } catch (error) {
        console.error("Error loading transactions:", error);
        showToast("Error loading transactions: " + error.message, "error");
    }
}

// Format wallet details for display
function formatWalletDetails(details) {
    if (!details) return 'N/A';
    
    let formatted = '';
    for (const [key, value] of Object.entries(details)) {
        formatted += `${key}: ${value}<br>`;
    }
    return formatted;
}

// Verify transaction
async function verifyTransaction(transactionId, action) {
    try {
        const transactionRef = doc(db, 'pending_transactions', transactionId);
        const transactionDoc = await getDoc(transactionRef);
        
        if (!transactionDoc.exists()) {
            showToast('Transaction not found', 'error');
            return;
        }

        const transaction = transactionDoc.data();
        const userRef = doc(db, 'users', transaction.userId);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            showToast('User not found', 'error');
            return;
        }

        const userData = userDoc.data();
        let newBalance = userData.money || 0;

        if (action === 'approve') {
            if (transaction.type === 'deposit') {
                newBalance += transaction.amount;
            } else if (transaction.type === 'withdraw') {
                if (newBalance < transaction.amount) {
                    showToast('User has insufficient funds', 'error');
                    return;
                }
                newBalance -= transaction.amount;
            }
        }

        // Update user balance
        await updateDoc(userRef, { money: newBalance });
        
        // Update transaction status
        await updateDoc(transactionRef, { 
            status: action === 'approve' ? 'completed' : 'rejected',
            processedAt: new Date()
        });

        showToast(`Transaction ${action}d successfully`, 'success');
        await loadTransactions();
    } catch (error) {
        console.error('Error verifying transaction:', error);
        showToast('Error verifying transaction: ' + error.message, 'error');
    }
}

// Initialize admin panel when DOM is loaded
document.addEventListener("DOMContentLoaded", initAdminPanel);

// Expose verifyTransaction to window for button onclick handlers
window.verifyTransaction = verifyTransaction; 