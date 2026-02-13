import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, get, update, push, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// 1. Firebase Config soti nan JSON ou a
const firebaseConfig = {
    apiKey: "AIzaSyCHVG_0BCd0V_lFSmg3_2qyC5rKclG-b0M",
    authDomain: "prime-gaming-ht.firebaseapp.com",
    databaseURL: "https://prime-gaming-ht-default-rtdb.firebaseio.com",
    projectId: "prime-gaming-ht",
    storageBucket: "prime-gaming-ht.firebasestorage.app",
    appId: "1:579566074161:web:e50abea764dd4d37371810"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// 2. EmailJS Config
emailjs.init("81JFBrIYN8rVOGaql");

let isRegisterMode = false;
let generatedOTP = null;

// --- FONKSYON AUTH ---
window.toggleAuthMode = () => {
    isRegisterMode = !isRegisterMode;
    document.getElementById('auth-btn').innerText = isRegisterMode ? "VÈRIFYE EMAIL" : "KONEKTE";
    document.getElementById('otp-section').classList.add('hidden');
    generatedOTP = null;
};

window.handleAuth = async () => {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;

    if (!email || !pass) return alert("Ranpli tout chan yo!");

    if (isRegisterMode) {
        if (!generatedOTP) {
            generatedOTP = Math.floor(100000 + Math.random() * 900000);
            emailjs.send("service_8die49b", "template_otp", {
                to_email: email,
                otp_code: generatedOTP
            }).then(() => {
                document.getElementById('otp-section').classList.remove('hidden');
                document.getElementById('auth-btn').innerText = "KONFIME KREYASYON";
                alert("Kòd voye nan email ou!");
            });
        } else {
            const userOTP = document.getElementById('otp-input').value;
            if (userOTP == generatedOTP) {
                try {
                    const res = await createUserWithEmailAndPassword(auth, email, pass);
                    await set(ref(db, `users/${res.user.uid}`), {
                        username: email.split('@')[0],
                        email: email,
                        balance: 0,
                        role: "player",
                        stats: { wins: 0, losses: 0 },
                        created_at: Date.now()
                    });
                } catch (e) { alert(e.message); }
            } else { alert("Kòd la pa bon!"); }
        }
    } else {
        signInWithEmailAndPassword(auth, email, pass).catch(e => alert("Login echwe: " + e.message));
    }
};

// --- JESTYON PAJ AK NAVIGATION ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        showPage('main-page');
        document.getElementById('bottom-nav').classList.remove('hidden');
        loadUserData(user.uid);
        listenChallenges();
    } else {
        showPage('auth-page');
        document.getElementById('bottom-nav').classList.add('hidden');
    }
});

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active-page'));
    document.getElementById(pageId).classList.add('active-page');
}

window.switchTab = (tab) => {
    if (tab === 'main') showPage('main-page');
    if (tab === 'profile') {
        showPage('profile-page');
        loadProfileData();
    }
};

// --- LOAD DATA ---
function loadUserData(uid) {
    onValue(ref(db, `users/${uid}`), (snap) => {
        const data = snap.val();
        document.getElementById('user-balance').innerText = data.balance.toLocaleString();
    });
}

async function loadProfileData() {
    const user = auth.currentUser;
    const snap = await get(ref(db, `users/${user.uid}`));
    const data = snap.val();
    document.getElementById('prof-name').innerText = data.username;
    document.getElementById('prof-email').innerText = data.email;
    document.getElementById('prof-wins').innerText = data.stats.wins;
    document.getElementById('prof-losses').innerText = data.stats.losses;
    document.getElementById('prof-initial').innerText = data.username[0].toUpperCase();
    
    // Check Escrow
    onValue(ref(db, 'escrow'), (escrowSnap) => {
        let totalEscrow = 0;
        escrowSnap.forEach(item => {
            if (item.val().creator_id === user.uid || item.val().opponent_id === user.uid) {
                totalEscrow += item.val().creator_funds || 0;
            }
        });
        document.getElementById('prof-escrow').innerText = totalEscrow + " HTG";
    });
}

// --- JESTYON PARYAJ (MODAL) ---
window.openModal = () => document.getElementById('modal-pari').classList.remove('hidden');
window.closeModal = () => document.getElementById('modal-pari').classList.add('hidden');

window.confirmSubmitPari = async () => {
    const amount = parseInt(document.getElementById('pari-montan').value);
    const game = document.getElementById('pari-jwet').value;
    const desc = document.getElementById('pari-desc').value;
    const user = auth.currentUser;

    if (amount < 100) return alert("Minimòm se 100 HTG");

    const userRef = ref(db, `users/${user.uid}`);
    const snap = await get(userRef);
    const balance = snap.val().balance;

    if (balance >= amount) {
        const challId = push(ref(db, 'challenges')).key;
        
        // 1. Update Balance & Escrow
        await update(userRef, { balance: balance - amount });
        
        // 2. Create Challenge
        await set(ref(db, `challenges/${challId}`), {
            game, bet_amount: amount, description: desc,
            creator_id: user.uid, creator_name: snap.val().username,
            status: "open", created_at: Date.now()
        });

        // 3. Create Escrow Entry
        await set(ref(db, `escrow/${challId}`), {
            creator_id: user.uid, creator_funds: amount,
            total_amount: amount * 2, status: "held"
        });

        alert("Defi lage!");
        closeModal();
    } else { alert("Kòb ou pa ase!"); }
};

function listenChallenges() {
    onValue(ref(db, 'challenges'), (snap) => {
        const container = document.getElementById('challenges-container');
        container.innerHTML = "";
        snap.forEach(child => {
            const c = child.val();
            if (c.status === "open") {
                container.innerHTML += `
                    <div class="bg-[#161b22] p-5 rounded-2xl border-l-4 border-blue-500 animate__animated animate__fadeInUp">
                        <div class="flex justify-between items-start mb-2">
                            <span class="bg-blue-600/20 text-blue-400 text-[10px] font-bold px-2 py-1 rounded-md uppercase">${c.game}</span>
                            <span class="text-green-400 font-black">${c.bet_amount} HTG</span>
                        </div>
                        <p class="text-sm font-bold">${c.creator_name} lage yon defi!</p>
                        <p class="text-xs text-gray-500 mt-1 italic">"${c.description || 'Pa gen deskripsyon'}"</p>
                        <button class="w-full mt-4 bg-white text-black py-2 rounded-xl font-bold text-xs active:scale-95 transition-all">AKSEPTE DEFI</button>
                    </div>
                `;
            }
        });
    });
}
