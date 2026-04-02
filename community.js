// ── Firebase Imports ──────────────────────────────────────
    import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
    import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendEmailVerification, sendPasswordResetEmail, onAuthStateChanged, setPersistence, inMemoryPersistence } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
    import { getFirestore, collection, addDoc, setDoc, updateDoc, deleteDoc, getDocs, getDoc, doc } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

    // ── Firebase Config ────────────────────────────────────────
    const firebaseConfig = {
        apiKey: 'AIzaSyDL62dbVwFztRKd8I3g6ozbg-wNo4oNwrI',
        authDomain: 'senergy-dcd69.firebaseapp.com',
        projectId: 'senergy-dcd69',
        storageBucket: 'senergy-dcd69.firebasestorage.app',
        messagingSenderId: '727155581900',
        appId: '1:727155581900:web:eb5201a23cc5897241b369'
    };
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    // ── Runtime State ─────────────────────────────────────────
    let currentSession = null;
    const APPROVAL_EMAIL = 'trytrysin000@gmail.com';
    // Replace these EmailJS placeholders with your real values before publishing.
    const EMAILJS_PUBLIC_KEY = '8xXJiWgVM0FnCD-oL';
    const EMAILJS_SERVICE_ID = 'service_u0co3qh';
    const EMAILJS_TEMPLATE_ID = 'template_bp56e0j';
    let emailJsReady = false;

    const COMMUNITY_RUNTIME_TRANSLATIONS = {
        en: {
            welcomePrefix: 'Welcome, {name}',
            statusEmailNotVerified: 'Email not verified',
            statusAwaitingApproval: 'Awaiting Approval',
            statusApproved: 'Approved',
            approvalPendingMessage: 'Your account is pending owner approval. You can request approval again or enter your approval code.',
            sendApprovalRequestBtn: 'Send Approval Request',
            enterApprovalCodeBtn: 'Enter Approval Code',
            dateTbd: 'Date TBD',
            locationTbd: 'Location TBD',
            noDescriptionProvided: 'No description provided.',
            eventDateLabel: 'Event Date:',
            expireDateLabel: 'Expire Date:',
            locationLabel: 'Location:',
            websiteLabel: 'Website:',
            postedAtLabel: 'Posted At:',
            openLink: 'Open Link',
            notProvided: 'Not provided',
            postedByPrefix: 'Posted by',
            visitEventWebsite: 'Visit Event Website',
            openEventDetailAria: 'Open event details for {title}'
        },
        zh: {
            welcomePrefix: '歡迎，{name}',
            statusEmailNotVerified: '電郵尚未驗證',
            statusAwaitingApproval: '等待審核中',
            statusApproved: '已審核',
            approvalPendingMessage: '你的帳戶正等待擁有者審核。你可以再次發送審核請求，或輸入你的審核代碼。',
            sendApprovalRequestBtn: '發送審核請求',
            enterApprovalCodeBtn: '輸入審核代碼',
            dateTbd: '日期待定',
            locationTbd: '地點待定',
            noDescriptionProvided: '暫未提供描述。',
            eventDateLabel: '活動日期：',
            expireDateLabel: '截止日期：',
            locationLabel: '地點：',
            websiteLabel: '網站：',
            postedAtLabel: '發佈時間：',
            openLink: '開啟連結',
            notProvided: '未提供',
            postedByPrefix: '發佈者',
            visitEventWebsite: '前往活動網站',
            openEventDetailAria: '打開「{title}」活動詳情'
        }
    };

    function getCurrentLanguage() {
        return localStorage.getItem('senergy_lang') === 'en' ? 'en' : 'zh';
    }

    function tr(key, params = {}) {
        const lang = getCurrentLanguage();
        const dict = COMMUNITY_RUNTIME_TRANSLATIONS[lang] || COMMUNITY_RUNTIME_TRANSLATIONS.en;
        const fallback = COMMUNITY_RUNTIME_TRANSLATIONS.en[key] || key;
        let value = dict[key] || fallback;

        Object.keys(params).forEach(param => {
            value = value.replace(`{${param}}`, String(params[param]));
        });
        return value;
    }

    // ── Helpers ───────────────────────────────────────────────
    async function getCurrentUserProfile() {
        const currentUser = auth.currentUser;
        if (!currentUser) return null;

        try {
            const userRef = doc(db, 'users', currentUser.uid);
            const snapshot = await getDoc(userRef);
            if (!snapshot.exists()) return null;
            return {
                id: snapshot.id,
                ...snapshot.data(),
                approved: snapshot.data().approved !== false
            };
        } catch (error) {
            console.error('Error fetching current user profile:', error);
            return null;
        }
    }

    function showEmailDebug(msg, level = 'info') {
        return;
    }

    async function ensureUserProfile(currentUser, fallbackName = '') {
        if (!currentUser) return null;

        const userRef = doc(db, 'users', currentUser.uid);
        const existingSnap = await getDoc(userRef);
        if (existingSnap.exists()) {
            const existingData = existingSnap.data();
            const normalizedName = existingData.name || existingData.username || fallbackName || 'Community Centre';
            const normalizedApprovalCode = existingData.approvalCode || generateApprovalCode();
            const needsSync = !existingData.authUid
                || !existingData.name
                || !existingData.approvalCode
                || existingData.email !== (currentUser.email || existingData.email || '');

            if (needsSync) {
                await setDoc(userRef, {
                    authUid: currentUser.uid,
                    name: normalizedName,
                    email: currentUser.email || existingData.email || '',
                    approvalCode: normalizedApprovalCode,
                    emailVerified: currentUser.emailVerified === true
                }, { merge: true });
            }

            return {
                id: existingSnap.id,
                ...existingData,
                authUid: currentUser.uid,
                name: normalizedName,
                email: currentUser.email || existingData.email || '',
                approvalCode: normalizedApprovalCode,
                approved: existingData.approved !== false
            };
        }

        const newProfile = {
            authUid: currentUser.uid,
            name: fallbackName || 'Community Centre',
            email: currentUser.email || '',
            approved: false,
            emailVerified: currentUser.emailVerified === true,
            approvalRequestedAt: null,
            approvalCode: generateApprovalCode(),
            createdAt: new Date().toISOString()
        };

        await setDoc(userRef, newProfile, { merge: true });
        return { id: currentUser.uid, ...newProfile };
    }

    async function getPosts() {
        try {
            const snapshot = await getDocs(collection(db, 'posts'));
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error fetching posts:', error);
            return [];
        }
    }
    function getSession() {
        if (!currentSession) return null;
        return {
            ...currentSession,
            approved: currentSession.approved !== false
        };
    }

    function saveSession(sessionData) {
        if (!sessionData) {
            currentSession = null;
            return;
        }
        currentSession = {
            ...sessionData,
            approved: sessionData.approved !== false
        };
    }

    async function updateUser(userId, updates) {
        try {
            const userRef = doc(db, 'users', userId);
            const payload = { ...updates };
            const currentUser = auth.currentUser;
            if (currentUser && currentUser.uid === userId && !Object.prototype.hasOwnProperty.call(payload, 'authUid')) {
                payload.authUid = currentUser.uid;
            }

            await updateDoc(userRef, payload);
            const updatedSnap = await getDoc(userRef);
            return updatedSnap.exists() ? { id: updatedSnap.id, ...updatedSnap.data() } : null;
        } catch (error) {
            console.error('Error updating user:', error);
            return null;
        }
    }

    function generateApprovalCode() {
        return `SEN-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    }

    function isEmailJsConfigured() {
        return EMAILJS_PUBLIC_KEY !== 'YOUR_EMAILJS_PUBLIC_KEY'
            && EMAILJS_SERVICE_ID !== 'YOUR_EMAILJS_SERVICE_ID'
            && EMAILJS_TEMPLATE_ID !== 'YOUR_EMAILJS_TEMPLATE_ID';
    }

    function ensureEmailJsReady() {
        if (!isEmailJsConfigured()) {
            return { ok: false, message: 'EmailJS is not configured yet. Add your EmailJS keys first.' };
        }
        if (!window.emailjs || typeof emailjs.send !== 'function') {
            return { ok: false, message: 'EmailJS library not loaded. Please refresh and try again.' };
        }
        if (!emailJsReady) {
            try {
                emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
                emailJsReady = true;
            } catch (error) {
                const reason = error && (error.message || error.text) ? String(error.message || error.text) : 'unknown error';
                return { ok: false, message: `EmailJS init failed: ${reason}` };
            }
        }
        return { ok: true, message: '' };
    }

    async function sendEmailWithFallback(templateParams) {
        const state = ensureEmailJsReady();
        if (!state.ok) {
            showEmailDebug(`precheck failed - ${state.message}`, 'error');
            return { ok: false, error: state.message };
        }

        try {
            await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
            showEmailDebug('delivery path = sdk (success)', 'success');
            return { ok: true, via: 'sdk' };
        } catch (sdkError) {
            try {
                const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        service_id: EMAILJS_SERVICE_ID,
                        template_id: EMAILJS_TEMPLATE_ID,
                        user_id: EMAILJS_PUBLIC_KEY,
                        template_params: templateParams
                    })
                });

                if (response.ok) {
                    const sdkMsg = sdkError && (sdkError.text || sdkError.message || sdkError.statusText) ? String(sdkError.text || sdkError.message || sdkError.statusText) : 'unknown sdk error';
                    showEmailDebug(`delivery path = rest (SDK failed first: ${sdkMsg})`, 'success');
                    return { ok: true, via: 'rest' };
                }

                const restText = await response.text();
                showEmailDebug(`both failed: sdk + rest ${response.status} ${restText}`, 'error');
                return { ok: false, error: `SDK failed; REST failed (${response.status}): ${restText}` };
            } catch (restError) {
                const sdkMsg = sdkError && (sdkError.text || sdkError.message || sdkError.statusText) ? String(sdkError.text || sdkError.message || sdkError.statusText) : 'unknown SDK error';
                const restMsg = restError && (restError.message || restError.text) ? String(restError.message || restError.text) : 'unknown REST error';
                showEmailDebug(`both failed: sdk=${sdkMsg}; rest=${restMsg}`, 'error');
                return { ok: false, error: `SDK failed: ${sdkMsg}; REST failed: ${restMsg}` };
            }
        }
    }

    function getAuthErrorMessage(error, mode = 'signup') {
        const code = error && error.code ? String(error.code) : '';
        switch (code) {
            case 'auth/configuration-not-found':
                return 'Firebase Authentication is not configured for this project. Enable Authentication and Email/Password sign-in in Firebase Console.';
            case 'auth/email-already-in-use':
                return 'This email is already registered. Please log in instead.';
            case 'auth/invalid-email':
                return 'Invalid email address format.';
            case 'auth/weak-password':
                return 'Password is too weak. Please use at least 6 characters.';
            case 'auth/operation-not-allowed':
                return 'Email/Password sign-in is not enabled in Firebase Console.';
            case 'auth/unauthorized-domain':
                return 'This website domain is not authorized in Firebase Authentication settings.';
            case 'auth/network-request-failed':
                return 'Network error. Please check your internet and try again.';
            case 'auth/too-many-requests':
                return 'Too many attempts. Please wait a moment and try again.';
            case 'auth/user-not-found':
            case 'auth/wrong-password':
            case 'auth/invalid-credential':
                return mode === 'login'
                    ? 'Incorrect email or password. Please try again.'
                    : 'Authentication failed. Please try again.';
            default:
                return `Authentication failed (${code || 'unknown error'}).`;
        }
    }

    async function issueEmailVerificationCode() {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            return false;
        }

        try {
            await sendEmailVerification(currentUser);
            await updateUser(currentUser.uid, {
                emailVerificationSentAt: new Date().toISOString()
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async function issuePasswordResetCode(email) {
        try {
            await sendPasswordResetEmail(auth, email);
            return true;
        } catch (error) {
            console.error('Error sending password reset email:', error);
            return false;
        }
    }

    function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Unable to read image file.'));
            reader.readAsDataURL(file);
        });
    }

    function normalizeWebsiteUrl(urlValue) {
        if (!urlValue) {
            return '';
        }

        const value = urlValue.trim();
        if (!value) {
            return '';
        }

        try {
            const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
            const parsed = new URL(withProtocol);
            if (!/^https?:$/i.test(parsed.protocol)) {
                return null;
            }
            return parsed.href;
        } catch (error) {
            return null;
        }
    }

    function getTodayYmd() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function isPostExpired(post, todayYmd) {
        if (!post.expireDate) {
            return false;
        }
        return post.expireDate < todayYmd;
    }

    async function pruneExpiredPosts() {
        const posts = await getPosts();
        const todayYmd = getTodayYmd();
        const activePosts = posts.filter(post => !isPostExpired(post, todayYmd));

        // In Firestore, we prune on read, so no need to save back
        // (expired posts stay in database but won't render)

        return activePosts;
    }

    // Sanitise a string to prevent XSS before inserting as text
    function esc(str) {
        const d = document.createElement('div');
        d.appendChild(document.createTextNode(String(str)));
        return d.innerHTML;
    }

    // ── Toast ─────────────────────────────────────────────────
    function showToast(msg) {
        const t = document.getElementById('toast');
        t.textContent = msg;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 2800);
    }

    // ── Modals ────────────────────────────────────────────────
    function openModal(id) {
        if (id === 'post-modal') {
            const session = getSession();
            if (!session || !session.approved) {
                showToast('Your account must be approved before posting events.');
                return;
            }
        }
        document.getElementById(id).classList.add('open');
        clearFormErrors(id);
    }
    function closeModal(id) {
        document.getElementById(id).classList.remove('open');
    }
    function switchModal(from, to) {
        closeModal(from);
        setTimeout(() => openModal(to), 180);
    }
    // Close modal only on true backdrop click (not drag-select from inside modal)
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        let pointerStartedOnBackdrop = false;

        backdrop.addEventListener('pointerdown', e => {
            pointerStartedOnBackdrop = e.target === backdrop;
        });

        backdrop.addEventListener('click', e => {
            if (pointerStartedOnBackdrop && e.target === backdrop) {
                backdrop.classList.remove('open');
            }
            pointerStartedOnBackdrop = false;
        });
    });
    // Close modal with Escape key
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-backdrop.open').forEach(m => m.classList.remove('open'));
        }
    });

    function clearFormErrors(modalId) {
        document.querySelectorAll(`#${modalId} .form-error`).forEach(el => el.textContent = '');
        document.querySelectorAll(`#${modalId} .invalid`).forEach(el => el.classList.remove('invalid'));
        const alert = document.querySelector(`#${modalId} .alert`);
        if (alert) { alert.style.display = 'none'; alert.textContent = ''; }
    }

    function showFieldError(inputId, errId, msg) {
        const input = document.getElementById(inputId);
        const err   = document.getElementById(errId);
        if (input) input.classList.add('invalid');
        if (err)   err.textContent = msg;
        if (input) input.focus();
    }

    function showModalAlert(alertId, msg) {
        const el = document.getElementById(alertId);
        if (!el) return;
        el.textContent = msg;
        el.style.display = 'block';
    }

    async function sendApprovalRequest(userId) {
        showEmailDebug('starting owner approval request send...', 'info');
        try {
            const currentUser = auth.currentUser;
            const session = getSession();
            const targetUserId = userId || (currentUser ? currentUser.uid : '') || (session ? session.id : '');

            if (!targetUserId) {
                showEmailDebug('aborted: no logged-in account id', 'error');
                showToast('Please log in first.');
                return;
            }

            let user = null;
            try {
                const userRef = doc(db, 'users', targetUserId);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    user = { id: userSnap.id, ...userSnap.data() };
                }
            } catch (error) {
                console.error('Error loading account for approval request:', error);
            }

            if (!user && currentUser && targetUserId === currentUser.uid) {
                user = await ensureUserProfile(currentUser);
            }

            if (!user) {
                showEmailDebug('aborted: user profile not found', 'error');
                showToast('Unable to find this account request.');
                return;
            }

            const recipientEmail = String(
                user.email
                || (currentUser && currentUser.email)
                || (session && session.email)
                || ''
            ).trim().toLowerCase();

            if (!recipientEmail) {
                showEmailDebug('aborted: user email missing', 'error');
                showToast('Account email is missing. Please update your account email and try again.');
                return;
            }

            let approvalCode = (user.approvalCode || '').trim();
            if (!approvalCode) {
                approvalCode = generateApprovalCode();
                const patchedUser = await updateUser(user.id, { approvalCode });
                if (!patchedUser) {
                    showEmailDebug('aborted: failed to generate/store approval code', 'error');
                    showToast('Unable to create approval code for this account. Please contact admin.');
                    return;
                }
                user = patchedUser;
            }

            const requestedAt = new Date().toLocaleString('en-GB');

            const ownerMail = await sendEmailWithFallback({
                to_email: APPROVAL_EMAIL,
                name: user.name || user.username || 'Community Centre',
                email: APPROVAL_EMAIL,
                centre_name: user.name || user.username || 'Community Centre',
                centre_email: user.email || recipientEmail,
                approval_code: approvalCode,
                request_id: user.id,
                requested_at: requestedAt,
                message: `New signup pending approval for ${user.name || user.username || 'Community Centre'}. Approval code: ${approvalCode}`
            });

            if (!ownerMail.ok) {
                showEmailDebug(`owner send failed: ${ownerMail.error}`, 'error');
                showToast(`Could not send approval request to owner. ${ownerMail.error}`);
                return;
            }

            showEmailDebug(`owner send success via ${ownerMail.via || 'unknown'} to ${APPROVAL_EMAIL}`, 'success');

            const updatedUser = await updateUser(user.id, { approvalRequestedAt: new Date().toISOString() });

            const activeSession = getSession();
            if (activeSession && activeSession.id === user.id) {
                saveSession({
                    ...activeSession,
                    name: user.name || user.username || activeSession.name,
                    email: recipientEmail || activeSession.email,
                    approvalCode: approvalCode || activeSession.approvalCode || ''
                });
            }

            if (!updatedUser) {
                console.warn('Approval request timestamp update failed for user:', user.id);
            }

            showToast(`Approval request sent to ${APPROVAL_EMAIL}.`);
            refreshAuthUI();
        } catch (error) {
            const reason = error && (error.message || error.text || error.statusText) ? String(error.message || error.text || error.statusText) : 'unknown runtime error';
            console.error('Unhandled sendApprovalRequest error:', error);
            showEmailDebug(`runtime exception: ${reason}`, 'error');
            showToast(`Approval request failed: ${reason}`);
        }
    }

    // ── Auth State ────────────────────────────────────────────
    function refreshAuthUI() {
        const session = getSession();
        const loggedOut = document.getElementById('auth-logged-out');
        const loggedIn  = document.getElementById('auth-logged-in');
        const postBtn   = document.getElementById('post-btn');
        const info      = document.getElementById('logged-in-info');
        const approvalNote = document.getElementById('approval-note');

        if (session) {
            loggedOut.style.display = 'none';
            loggedIn.style.display  = 'flex';
            postBtn.style.display   = session.approved ? 'inline-flex' : 'none';

            const welcomePrefix = tr('welcomePrefix', { name: session.name });
            if (session.emailVerified === false) {
                info.textContent = `${welcomePrefix} (${tr('statusEmailNotVerified')})`;
            } else if (session.approved === false) {
                info.textContent = `${welcomePrefix} (${tr('statusAwaitingApproval')})`;
            } else {
                info.textContent = `${welcomePrefix} (${tr('statusApproved')})`;
            }

            approvalNote.style.display = session.approved === false ? 'block' : 'none';
            if (approvalNote.style.display === 'block') {
                const approvalRow = session.approved === false
                    ? `<div>${tr('approvalPendingMessage')}</div>
                    <div class="approval-note-actions">
                        <button type="button" class="btn btn-outline btn-sm" onclick="sendApprovalRequest('${esc(session.id)}')">${tr('sendApprovalRequestBtn')}</button>
                        <button type="button" class="btn btn-primary btn-sm" onclick="openModal('approval-code-modal')">${tr('enterApprovalCodeBtn')}</button>
                    </div>`
                    : '';

                approvalNote.innerHTML = `
                    ${approvalRow}
                `;
            }
        } else {
            loggedOut.style.display = 'flex';
            loggedIn.style.display  = 'none';
            postBtn.style.display   = 'none';
            approvalNote.style.display = 'none';
            approvalNote.innerHTML = '';
        }
    }

    // ── Sign Up ───────────────────────────────────────────────
    async function handleSignup(e) {
        e.preventDefault();
        clearFormErrors('signup-modal');

        const name     = document.getElementById('signup-name').value.trim();
        const email    = document.getElementById('signup-email').value.trim().toLowerCase();
        const password = document.getElementById('signup-password').value;
        const confirm  = document.getElementById('signup-confirm').value;

        let valid = true;

        if (!name) {
            showFieldError('signup-name', 'signup-name-err', 'Please enter your centre name.');
            valid = false;
        }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showFieldError('signup-email', 'signup-email-err', 'Please enter a valid email address.');
            valid = false;
        }
        if (password.length < 6) {
            showFieldError('signup-password', 'signup-password-err', 'Password must be at least 6 characters.');
            valid = false;
        }
        if (password !== confirm) {
            showFieldError('signup-confirm', 'signup-confirm-err', 'Passwords do not match.');
            valid = false;
        }
        if (!valid) return;

        let authCredential;
        try {
            authCredential = await createUserWithEmailAndPassword(auth, email, password);
        } catch (error) {
            console.error('Error creating auth account:', error);
            showModalAlert('signup-alert', getAuthErrorMessage(error, 'signup'));
            return;
        }

        const newUser = {
            authUid: authCredential.user.uid,
            name,
            email,
            approved: false,
            emailVerified: false,
            emailVerificationSentAt: null,
            approvalRequestedAt: null,
            approvalCode: generateApprovalCode(),
            createdAt: new Date().toISOString()
        };

        try {
            await setDoc(doc(db, 'users', authCredential.user.uid), newUser, { merge: true });
        } catch (error) {
            console.error('Error creating user profile:', error);
            showModalAlert('signup-alert', 'Account created but profile setup failed. Please log in again.');
            return;
        }

        const sent = await issueEmailVerificationCode();
        if (sent) {
            showToast('Verification email sent. Please check your inbox.');
        } else {
            showToast('Could not send verification email. Try again later.');
        }

        saveSession({
            id: authCredential.user.uid,
            name,
            email,
            approved: false,
            emailVerified: false,
            approvalCode: newUser.approvalCode
        });
        closeModal('signup-modal');
        refreshAuthUI();
        showToast('Account created. Please verify your email before posting.');
        await sendApprovalRequest(authCredential.user.uid);
    }

    // ── Log In ────────────────────────────────────────────────
    async function handleLogin(e) {
        e.preventDefault();
        clearFormErrors('login-modal');

        const email    = document.getElementById('login-email').value.trim().toLowerCase();
        const password = document.getElementById('login-password').value;
        let valid = true;

        if (!email) {
            showFieldError('login-email', 'login-email-err', 'Please enter your email address.');
            valid = false;
        }
        if (!password) {
            showFieldError('login-password', 'login-password-err', 'Please enter your password.');
            valid = false;
        }
        if (!valid) return;

        let authCredential;
        try {
            authCredential = await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            console.error('Error signing in:', error);
            showModalAlert('login-alert', getAuthErrorMessage(error, 'login'));
            return;
        }

        const firebaseUser = authCredential.user;
        saveSession({
            id: firebaseUser.uid,
            name: 'Community Centre',
            email: firebaseUser.email || email,
            approved: false,
            emailVerified: firebaseUser.emailVerified === true,
            approvalCode: ''
        });
        refreshAuthUI();
        closeModal('login-modal');

        if (firebaseUser.emailVerified === false) {
            issueEmailVerificationCode().then(sent => {
                if (sent) {
                    showToast('Email not verified yet. Verification email sent.');
                } else {
                    showToast('Email not verified. Could not send verification email.');
                }
            });
            return;
        }

        showToast('Welcome to SENERGY!');

        ensureUserProfile(firebaseUser).then(profile => {
            if (!profile) return;

            saveSession({
                id: firebaseUser.uid,
                name: profile.name || 'Community Centre',
                email: firebaseUser.email || profile.email,
                approved: profile.approved !== false,
                emailVerified: firebaseUser.emailVerified === true,
                approvalCode: profile.approvalCode || ''
            });
            refreshAuthUI();
            showToast(`Welcome, ${profile.name || 'Community Centre'}!`);
        }).catch(error => {
            console.error('Profile sync failed after login:', error);
        });
    }

    // ── Forgot Password ─────────────────────────────────────
    async function handleForgotPassword(e) {
        e.preventDefault();
        clearFormErrors('forgot-password-modal');

        const email = document.getElementById('forgot-email').value.trim().toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showFieldError('forgot-email', 'forgot-email-err', 'Please enter a valid account email.');
            return;
        }

        const sent = await issuePasswordResetCode(email);
        if (!sent) {
            showModalAlert('forgot-password-alert', 'Could not send reset email. Please try again.');
            return;
        }

        document.getElementById('forgot-password-form').reset();
        closeModal('forgot-password-modal');
        openModal('login-modal');
        document.getElementById('login-email').value = email;
        showToast('Password reset email sent. Use the link in your inbox to set a new password.');
    }

    async function sendPasswordResetCode() {
        clearFormErrors('forgot-password-modal');
        const email = document.getElementById('forgot-email').value.trim().toLowerCase();

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showFieldError('forgot-email', 'forgot-email-err', 'Please enter a valid account email.');
            return;
        }

        const sent = await issuePasswordResetCode(email);
        if (sent) {
            showToast('Password reset email sent.');
        } else {
            showToast('Could not send password reset email.');
        }
    }

    // ── Log Out ───────────────────────────────────────────────
    async function logout() {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Error signing out:', error);
        }
        saveSession(null);
        refreshAuthUI();
        showToast('You have been logged out.');
    }

    // ── Post Event ────────────────────────────────────────────
    async function handlePost(e) {
        e.preventDefault();
        clearFormErrors('post-modal');

        const title    = document.getElementById('post-title-input').value.trim();
        const desc     = document.getElementById('post-desc').value.trim();
        const date     = document.getElementById('post-date').value;
        const expireDate = document.getElementById('post-expire-date').value;
        const location = document.getElementById('post-location').value.trim();
        const rawEventLink = document.getElementById('post-link').value.trim();
        const imageInput = document.getElementById('post-image');
        const imageFile = imageInput.files[0];
        const eventLink = normalizeWebsiteUrl(rawEventLink);

        let valid = true;

        if (!title) {
            showFieldError('post-title-input', 'post-title-err', 'Please enter an event title.');
            valid = false;
        }
        if (!expireDate) {
            showFieldError('post-expire-date', 'post-expire-date-err', 'Please enter an expire date.');
            valid = false;
        }
        if (date && expireDate && date > expireDate) {
            showFieldError('post-expire-date', 'post-expire-date-err', 'Expire date must be on or after event date.');
            valid = false;
        }
        if (rawEventLink && !eventLink) {
            showFieldError('post-link', 'post-link-err', 'Please enter a valid website link.');
            valid = false;
        }
        if (imageFile) {
            const allowedTypes = ['image/jpeg', 'image/png'];
            if (!allowedTypes.includes(imageFile.type)) {
                showFieldError('post-image', 'post-image-err', 'Please upload a JPEG or PNG image.');
                valid = false;
            }
            if (imageFile.size > 2 * 1024 * 1024) {
                showFieldError('post-image', 'post-image-err', 'Image must be 2 MB or smaller.');
                valid = false;
            }
        }
        if (!valid) return;

        const session = getSession();
        if (!session || !session.approved) {
            closeModal('post-modal');
            showToast('Posting is disabled until your account is approved.');
            return;
        }

        let imageData = '';

        if (imageFile) {
            try {
                imageData = await readFileAsDataUrl(imageFile);
            } catch (error) {
                showFieldError('post-image', 'post-image-err', 'Unable to read the selected image. Try another file.');
                return;
            }
        }

        const currentUser = auth.currentUser;
        if (!currentUser || currentUser.uid !== session.id) {
            showModalAlert('post-alert', 'Please log in again before posting.');
            return;
        }

        const newPost = {
            authorId:  currentUser.uid,
            authorName:session.name,
            title,
            desc,
            date,
            expireDate,
            location,
            eventLink: eventLink || '',
            imageData,
            createdAt: new Date().toISOString()
        };

        try {
            await addDoc(collection(db, 'posts'), newPost);
        } catch (error) {
            console.error('Error creating post:', error);
            showModalAlert('post-alert', 'Failed to post event. Please try again.');
            return;
        }

        // Reset form
        document.getElementById('post-form').reset();
        closeModal('post-modal');
        await renderFeed();
        showToast('Event posted successfully! 🎉');
    }

    // ── Delete Event ──────────────────────────────────────────
    let pendingDeleteId = null;

    function confirmDelete(postId) {
        pendingDeleteId = postId;
        openModal('delete-modal');
    }

    document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
        if (!pendingDeleteId) return;
        try {
            await deleteDoc(doc(db, 'posts', pendingDeleteId));
        } catch (error) {
            console.error('Error deleting post:', error);
            showToast('Failed to delete event. Please try again.');
            return;
        }
        pendingDeleteId = null;
        closeModal('delete-modal');
        await renderFeed();
        showToast('Event deleted.');
    });

    async function handleApprovalCode(e) {
        e.preventDefault();
        clearFormErrors('approval-code-modal');
        const submitBtn = document.querySelector('#approval-code-form button[type="submit"]');
        const originalBtnText = submitBtn ? submitBtn.textContent : '';
        const currentSession = getSession();
        const enteredCode = document.getElementById('approval-code-input').value.trim().toUpperCase();

        if (!currentSession) {
            showModalAlert('approval-code-alert', 'Please log in first.');
            return;
        }

        if (!enteredCode) {
            showFieldError('approval-code-input', 'approval-code-err', 'Please enter your approval code.');
            return;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Activating...';
        }

        try {
            const currentUser = auth.currentUser;
            let user = null;

            // Primary path: ensure own profile exists at users/{uid}
            if (currentUser) {
                user = await ensureUserProfile(currentUser, currentSession.name || '');
            }

            // Fallback path
            if (!user) {
                user = await getCurrentUserProfile();
            }

            if (!user) {
                showModalAlert('approval-code-alert', 'Account not found. Please sign in again.');
                return;
            }

            if (String(user.approvalCode || '').toUpperCase() !== enteredCode) {
                showModalAlert('approval-code-alert', 'That approval code is not valid for this account.');
                return;
            }

            const updatedUser = await updateUser(user.id, { approved: true, approvedAt: new Date().toISOString() });
            if (!updatedUser) {
                showModalAlert('approval-code-alert', 'Unable to approve account right now. Please try again.');
                return;
            }

            saveSession({ ...currentSession, approved: true });
            document.getElementById('approval-code-form').reset();
            closeModal('approval-code-modal');
            refreshAuthUI();
            showToast('Account approved. You can now post events.');
        } catch (error) {
            console.error('Error activating account:', error);
            const reason = error && (error.message || error.text) ? String(error.message || error.text) : 'unknown error';
            const lowerReason = reason.toLowerCase();
            if (lowerReason.includes('missing or insufficient permissions') || lowerReason.includes('permission-denied')) {
                showModalAlert('approval-code-alert', 'Activation failed: Firestore rules are blocking this update. Please publish the latest firestore.rules in Firebase Console, then try again.');
            } else {
                showModalAlert('approval-code-alert', `Activation failed: ${reason}`);
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText || 'Activate Account';
            }
        }
    }

    // ── Render Feed ───────────────────────────────────────────
    function formatDate(dateStr) {
        if (!dateStr) {
            return tr('dateTbd');
        }
        // dateStr is YYYY-MM-DD from <input type="date">
        const [y, m, d] = dateStr.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        if (Number.isNaN(date.getTime())) {
            return tr('dateTbd');
        }
        return date.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    }

    function formatCreatedAt(dateStr) {
        if (!dateStr) {
            return 'Unknown';
        }
        const date = new Date(dateStr);
        if (Number.isNaN(date.getTime())) {
            return 'Unknown';
        }
        return date.toLocaleString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function openEventDetail(post) {
        const imageSource = post.imageData || post.imageUrl || '';
        const locationText = post.location ? esc(post.location) : tr('locationTbd');
        const descriptionText = post.desc ? esc(post.desc) : tr('noDescriptionProvided');
        const dateText = esc(formatDate(post.date));
        const expireDateText = esc(formatDate(post.expireDate));
        const createdAtText = esc(formatCreatedAt(post.createdAt));
        const eventLink = normalizeWebsiteUrl(post.eventLink || '');

        const mediaHtml = imageSource
            ? `<img src="${esc(imageSource)}" alt="${esc(post.title)}" onerror="this.replaceWith(makePlaceholder())">`
            : `<div class="event-detail-placeholder">🎪</div>`;

        const detail = document.getElementById('event-detail-content');
        detail.innerHTML = `
            <div class="event-detail-media">${mediaHtml}</div>
            <div class="event-detail-panel">
                <h3 class="event-detail-title" id="event-detail-title">${esc(post.title)}</h3>
                <p class="event-detail-author">🏫 ${tr('postedByPrefix')} ${esc(post.authorName || 'Community Centre')}</p>
                <p class="event-detail-description">${descriptionText}</p>
                <div class="event-detail-meta">
                    <div><strong>${tr('eventDateLabel')}</strong> ${dateText}</div>
                    <div><strong>${tr('expireDateLabel')}</strong> ${expireDateText}</div>
                    <div><strong>${tr('locationLabel')}</strong> ${locationText}</div>
                    <div><strong>${tr('websiteLabel')}</strong> ${eventLink ? `<a class="event-link" href="${esc(eventLink)}" target="_blank" rel="noopener noreferrer">${tr('openLink')}</a>` : tr('notProvided')}</div>
                    <div><strong>${tr('postedAtLabel')}</strong> ${createdAtText}</div>
                </div>
            </div>
        `;

        openModal('event-detail-modal');
    }

    async function renderFeed() {
        const posts     = await pruneExpiredPosts();
        const session   = getSession();
        const feed      = document.getElementById('feed');
        const emptyState= document.getElementById('empty-state');

        feed.innerHTML = '';

        if (posts.length === 0) {
            feed.appendChild(emptyState);
            return;
        }

        posts.forEach(post => {
            const canDelete = (session && session.id === post.authorId);
            const card = document.createElement('article');
            card.className = 'event-card';
            card.tabIndex = 0;
            card.setAttribute('role', 'button');
            card.setAttribute('aria-label', tr('openEventDetailAria', { title: post.title }));

            // Image or placeholder
            const imageSource = post.imageData || post.imageUrl || '';
            const imgHtml = imageSource
                ? `<img class="card-img" src="${esc(imageSource)}" alt="${esc(post.title)}" onerror="this.replaceWith(makePlaceholder())">`
                : `<div class="card-img-placeholder">🎪</div>`;

            const locationText = post.location ? esc(post.location) : tr('locationTbd');
            const descriptionText = post.desc ? esc(post.desc) : tr('noDescriptionProvided');
            const dateText = esc(formatDate(post.date));
            const expireDateText = esc(formatDate(post.expireDate));
            const eventLink = normalizeWebsiteUrl(post.eventLink || '');
            const linkMeta = eventLink
                ? `<span>🔗 <a class="event-link" href="${esc(eventLink)}" target="_blank" rel="noopener noreferrer">${tr('visitEventWebsite')}</a></span>`
                : '';

            card.innerHTML = `
                ${imgHtml}
                <div class="card-body">
                    <span class="card-badge">📍 ${locationText}</span>
                    <h3 class="card-title">${esc(post.title)}</h3>
                    <p class="card-desc">${descriptionText}</p>
                    <div class="card-meta">
                        <span>📅 ${dateText}</span>
                        <span>⏳ Expires: ${expireDateText}</span>
                        <span>📌 ${locationText}</span>
                        ${linkMeta}
                    </div>
                </div>
                <div class="card-footer">
                    <span class="card-author">🏫 ${esc(post.authorName)}</span>
                    <div class="card-actions">
                        ${canDelete ? `<button class="btn btn-danger btn-sm" onclick="confirmDelete('${esc(post.id)}')">🗑️ Delete</button>` : ''}
                    </div>
                </div>
            `;

            card.addEventListener('click', (event) => {
                if (event.target.closest('.card-actions') || event.target.closest('a')) {
                    return;
                }
                openEventDetail(post);
            });

            card.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openEventDetail(post);
                }
            });

            feed.appendChild(card);
        });
    }

    // Helper referenced in onerror (needs to be in outer scope)
    function makePlaceholder() {
        const div = document.createElement('div');
        div.className = 'card-img-placeholder';
        div.textContent = '🎪';
        return div;
    }

    function refreshCommunityLanguageView() {
        refreshAuthUI();
        renderFeed().catch(error => console.error('Render feed failed:', error));
    }

    // Expose handlers used by inline HTML attributes.
    Object.assign(window, {
        openModal,
        closeModal,
        switchModal,
        logout,
        sendPasswordResetCode,
        sendApprovalRequest,
        confirmDelete,
        refreshCommunityLanguageView,
        handleApprovalCode,
        handleLogin,
        handleSignup,
        handleForgotPassword,
        handlePost
    });

    // ── Initialise ────────────────────────────────────────────
    (async () => {
        if (window.emailjs && isEmailJsConfigured()) {
            const state = ensureEmailJsReady();
            if (!state.ok) {
                console.error(state.message);
            }
        }

        try {
            await setPersistence(auth, inMemoryPersistence);
        } catch (error) {
            console.error('Failed to configure auth persistence:', error);
        }

        onAuthStateChanged(auth, async (currentUser) => {
            if (!currentUser) {
                saveSession(null);
                refreshAuthUI();
                renderFeed().catch(error => console.error('Render feed failed:', error));
                return;
            }

            const profile = await ensureUserProfile(currentUser);
            if (profile) {
                saveSession({
                    id: currentUser.uid,
                    name: profile.name,
                    email: currentUser.email || profile.email,
                    approved: profile.approved !== false,
                    emailVerified: currentUser.emailVerified === true,
                    approvalCode: profile.approvalCode || ''
                });
            }

            refreshAuthUI();
            renderFeed().catch(error => console.error('Render feed failed:', error));
        });
    })();

