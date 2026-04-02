(() => {
    const introCard = document.querySelector('.intro-card');
    if (!introCard) return;
    if (document.getElementById('memo-list')) return;

    const FIREBASE_CONFIG = {
        apiKey: 'AIzaSyA5VaZ24dujHZvYGwF3kTUrsUVS7a0tCMs',
        projectId: 'senergy-dcd69'
    };

    const FIRESTORE_MEMO_COLLECTION = 'storyMemos';
    const FIRESTORE_API_BASE = 'https://firestore.googleapis.com/v1/projects/' + FIREBASE_CONFIG.projectId + '/databases/(default)/documents';

    const UI_TEXT = {
        en: {
            memoTitle: 'Memo Board',
            memoDesc: '你可以在這裡寫下一些鼓勵他們的話。',
            memoPlaceholder: 'Write your memo here...',
            memoAdd: 'Add Memo',
            memoEmpty: 'No memos yet.',
            memoDelete: 'Delete',
            memoLoading: 'Loading memos...',
            memoLoadFailed: 'Could not load memos.',
            memoSaveFailed: 'Could not save memo.',
            memoDeleteFailed: 'Could not delete memo.'
        },
        zh: {
            memoTitle: '備忘錄',
            memoDesc: '你可以在這裡寫下一些鼓勵他們的話。',
            memoPlaceholder: '在這裡寫下你的備忘...',
            memoAdd: '新增備忘',
            memoEmpty: '尚未有備忘內容。',
            memoDelete: '刪除',
            memoLoading: '正在載入備忘...',
            memoLoadFailed: '無法載入備忘。',
            memoSaveFailed: '無法儲存備忘。',
            memoDeleteFailed: '無法刪除備忘。'
        }
    };

    const styleId = 'senergy-story-memo-style';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .memo-card {
                margin-top: 1.5rem;
                background: #ffffff;
                border-radius: 18px;
                box-shadow: 0 8px 24px rgba(93, 64, 55, 0.12);
                border: 1px solid #f5ddc5;
                padding: 1.2rem 1.3rem;
                text-align: left;
            }
            .memo-card h2 {
                margin: 0 0 0.45rem;
                color: #e67e22;
            }
            .memo-card p {
                margin: 0.2rem 0 0.9rem;
                color: #7a5a4f;
            }
            .memo-input-wrap {
                display: grid;
                gap: 0.7rem;
            }
            .memo-input {
                width: 100%;
                min-height: 120px;
                resize: vertical;
                border: 1px solid #e6c7a8;
                border-radius: 12px;
                padding: 0.75rem 0.85rem;
                font: inherit;
                color: #5d4037;
                background: #fffaf4;
            }
            .memo-input:focus {
                outline: none;
                border-color: #e67e22;
                box-shadow: 0 0 0 3px rgba(230, 126, 34, 0.2);
            }
            .memo-add-btn {
                justify-self: start;
                border: none;
                border-radius: 999px;
                padding: 0.52rem 1rem;
                font: inherit;
                font-weight: 700;
                color: #fff;
                background: linear-gradient(135deg, #f39c3d 0%, #e67e22 100%);
                cursor: pointer;
            }
            .memo-list {
                list-style: none;
                margin: 1rem 0 0;
                padding: 0;
                display: grid;
                grid-template-columns: repeat(12, minmax(0, 1fr));
                gap: 14px;
            }
            .memo-item {
                border: 1px solid rgba(121, 104, 90, 0.16);
                border-radius: 8px;
                padding: 0.75rem 0.85rem;
                display: grid;
                gap: 0.55rem;
                min-height: 150px;
                box-shadow: 0 8px 18px rgba(74, 60, 52, 0.14);
                position: relative;
                grid-column: span 4;
            }
            .memo-item::before {
                content: '';
                position: absolute;
                top: 10px;
                left: 50%;
                width: 42px;
                height: 11px;
                transform: translateX(-50%) rotate(-2deg);
                background: rgba(255, 255, 255, 0.7);
                border: 1px solid rgba(180, 170, 160, 0.35);
                border-radius: 3px;
                pointer-events: none;
            }
            .memo-item.memo-large {
                grid-column: span 8;
                min-height: 210px;
                padding-top: 1.05rem;
            }
            .memo-item.memo-wide {
                grid-column: span 6;
            }
            .memo-item.memo-yellow { background: #fff4a8; }
            .memo-item.memo-cream { background: #f8f0cf; }
            .memo-item.memo-lilac { background: #ece9ff; }
            .memo-item.memo-mint { background: #dff5df; }
            .memo-item.memo-pink { background: #ffdfe4; }
            .memo-item.memo-blue { background: #dcebff; }
            .memo-item.tilt-left { transform: rotate(-1deg); }
            .memo-item.tilt-right { transform: rotate(1.2deg); }
            .memo-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 10px;
            }
            .memo-date {
                font-size: 0.8rem;
                color: rgba(96, 76, 63, 0.82);
                font-weight: 700;
            }
            .memo-text {
                white-space: pre-wrap;
                word-break: break-word;
                color: #5a4137;
                font-weight: 700;
                line-height: 1.5;
                padding-top: 0.2rem;
            }
            .memo-delete-btn {
                border: 1px solid rgba(125, 95, 78, 0.3);
                background: rgba(255, 255, 255, 0.6);
                color: #7d4f37;
                border-radius: 999px;
                padding: 0.18rem 0.62rem;
                font: inherit;
                font-size: 0.8rem;
                font-weight: 700;
                cursor: pointer;
            }
            .memo-empty {
                margin-top: 0.9rem;
                color: #8b6b60;
                font-weight: 600;
            }
            @media (max-width: 768px) {
                .memo-add-btn {
                    width: 100%;
                    justify-self: stretch;
                }
                .memo-list {
                    grid-template-columns: repeat(1, minmax(0, 1fr));
                }
                .memo-item,
                .memo-item.memo-large,
                .memo-item.memo-wide {
                    grid-column: span 1;
                    min-height: 140px;
                    transform: none;
                }
            }
        `;
        document.head.appendChild(style);
    }

    const memoCard = document.createElement('section');
    memoCard.className = 'memo-card';
    memoCard.setAttribute('aria-label', 'Personal memo section');
    memoCard.innerHTML = `
        <h2 id="memo-title">Memo Board</h2>
        <p id="memo-desc">你可以在這裡寫下一些鼓勵他們的話。</p>
        <div class="memo-input-wrap">
            <textarea id="memo-input" class="memo-input" placeholder="在這裡寫下你的備忘..."></textarea>
            <button id="memo-add-btn" class="memo-add-btn" type="button">Add Memo</button>
        </div>
        <p id="memo-empty" class="memo-empty">尚未有備忘內容。</p>
        <ul id="memo-list" class="memo-list" aria-live="polite"></ul>
    `;

    introCard.insertAdjacentElement('afterend', memoCard);

    const memoInput = document.getElementById('memo-input');
    const memoAddBtn = document.getElementById('memo-add-btn');
    const memoList = document.getElementById('memo-list');
    const memoEmpty = document.getElementById('memo-empty');
    const memoTitle = document.getElementById('memo-title');
    const memoDesc = document.getElementById('memo-desc');

    let memoCache = [];

    function getLang() {
        const lang = localStorage.getItem('senergy_lang') || 'zh';
        return lang === 'zh' ? 'zh' : 'en';
    }

    function t(key, fallback) {
        const lang = getLang();
        return (UI_TEXT[lang] && UI_TEXT[lang][key]) || fallback;
    }

    function getStoryKey() {
        const parts = decodeURIComponent(window.location.pathname).split('/').filter(Boolean);
        if (parts.length < 2) return 'story';
        const folderName = parts[parts.length - 2] || 'story';
        return folderName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'story';
    }

    const memoStoryKey = getStoryKey();

    function memoCollectionUrl() {
        return FIRESTORE_API_BASE + '/' + encodeURIComponent(FIRESTORE_MEMO_COLLECTION) + '?key=' + encodeURIComponent(FIREBASE_CONFIG.apiKey);
    }

    function memoDocumentUrl(docId) {
        return FIRESTORE_API_BASE + '/' + encodeURIComponent(FIRESTORE_MEMO_COLLECTION) + '/' + encodeURIComponent(docId) + '?key=' + encodeURIComponent(FIREBASE_CONFIG.apiKey);
    }

    function formatMemoDate(isoString) {
        const date = new Date(isoString);
        if (Number.isNaN(date.getTime())) return '';
        const locale = getLang() === 'zh' ? 'zh-HK' : 'en-US';
        return date.toLocaleString(locale, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function applyUIText() {
        memoTitle.textContent = t('memoTitle', 'Memo Board');
        memoDesc.textContent = t('memoDesc', '你可以在這裡寫下一些鼓勵他們的話。');
        memoInput.setAttribute('placeholder', t('memoPlaceholder', 'Write your memo here...'));
        memoAddBtn.textContent = t('memoAdd', 'Add Memo');
        if (!memoCache.length) {
            memoEmpty.textContent = t('memoEmpty', 'No memos yet.');
        }

        const buttons = memoList.querySelectorAll('.memo-delete-btn');
        buttons.forEach((btn) => {
            btn.textContent = t('memoDelete', 'Delete');
        });

        const dates = memoList.querySelectorAll('.memo-date');
        dates.forEach((dateEl) => {
            const iso = dateEl.getAttribute('data-iso') || '';
            dateEl.textContent = formatMemoDate(iso);
        });
    }

    function firestoreDocToMemo(doc) {
        const fields = doc.fields || {};
        const storyKey = fields.storyKey && fields.storyKey.stringValue ? fields.storyKey.stringValue : '';
        if (storyKey !== memoStoryKey) return null;

        const text = fields.text && fields.text.stringValue ? fields.text.stringValue : '';
        const createdAt = fields.createdAt && fields.createdAt.timestampValue ? fields.createdAt.timestampValue : '';
        const nameParts = (doc.name || '').split('/');
        const id = nameParts[nameParts.length - 1] || '';
        if (!id || !text) return null;

        return { id, text, createdAt };
    }

    async function loadMemosFromFirestore() {
        memoEmpty.textContent = t('memoLoading', 'Loading memos...');
        memoEmpty.style.display = '';
        memoList.innerHTML = '';

        const response = await fetch(memoCollectionUrl(), { method: 'GET' });
        if (!response.ok) throw new Error('Failed to load memos');

        const data = await response.json();
        const docs = Array.isArray(data.documents) ? data.documents : [];
        memoCache = docs
            .map(firestoreDocToMemo)
            .filter(Boolean)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        renderMemos();
    }

    function renderMemos() {
        memoList.innerHTML = '';

        if (!memoCache.length) {
            memoEmpty.textContent = t('memoEmpty', 'No memos yet.');
            memoEmpty.style.display = '';
            return;
        }

        memoEmpty.style.display = 'none';

        memoCache.forEach((memo) => {
            const li = document.createElement('li');
            const colorClasses = ['memo-yellow', 'memo-cream', 'memo-lilac', 'memo-mint', 'memo-pink', 'memo-blue'];
            const tiltClasses = ['tilt-left', 'tilt-right', ''];
            const idScore = (memo.id || '').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
            const colorClass = colorClasses[Math.abs(idScore) % colorClasses.length];
            const tiltClass = tiltClasses[Math.abs((memo.id || '').length) % tiltClasses.length];
            const sizeClass = memo.text.length > 180 ? 'memo-large' : memo.text.length > 90 ? 'memo-wide' : '';
            li.className = 'memo-item ' + colorClass + ' ' + tiltClass + ' ' + sizeClass;

            const row = document.createElement('div');
            row.className = 'memo-row';

            const date = document.createElement('span');
            date.className = 'memo-date';
            date.setAttribute('data-iso', memo.createdAt);
            date.textContent = formatMemoDate(memo.createdAt);

            const del = document.createElement('button');
            del.className = 'memo-delete-btn';
            del.type = 'button';
            del.textContent = t('memoDelete', 'Delete');
            del.addEventListener('click', async () => {
                try {
                    del.disabled = true;
                    const response = await fetch(memoDocumentUrl(memo.id), { method: 'DELETE' });
                    if (!response.ok) throw new Error('Delete failed');
                    await loadMemosFromFirestore();
                } catch (error) {
                    memoEmpty.textContent = t('memoDeleteFailed', 'Could not delete memo.');
                    memoEmpty.style.display = '';
                } finally {
                    del.disabled = false;
                }
            });

            row.appendChild(date);
            row.appendChild(del);

            const text = document.createElement('div');
            text.className = 'memo-text';
            text.textContent = memo.text;

            li.appendChild(row);
            li.appendChild(text);
            memoList.appendChild(li);
        });
    }

    async function addMemo() {
        const text = memoInput.value.trim();
        if (!text) return;

        const body = {
            fields: {
                storyKey: { stringValue: memoStoryKey },
                text: { stringValue: text.slice(0, 2000) },
                createdAt: { timestampValue: new Date().toISOString() }
            }
        };

        memoAddBtn.disabled = true;
        try {
            const response = await fetch(memoCollectionUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!response.ok) throw new Error('Save failed');

            memoInput.value = '';
            await loadMemosFromFirestore();
        } catch (error) {
            memoEmpty.textContent = t('memoSaveFailed', 'Could not save memo.');
            memoEmpty.style.display = '';
        } finally {
            memoAddBtn.disabled = false;
            memoInput.focus();
        }
    }

    memoAddBtn.addEventListener('click', addMemo);
    memoInput.addEventListener('keydown', (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            addMemo();
        }
    });

    const langEnBtn = document.getElementById('lang-en');
    const langZhBtn = document.getElementById('lang-zh');
    if (langEnBtn) langEnBtn.addEventListener('click', () => setTimeout(applyUIText, 0));
    if (langZhBtn) langZhBtn.addEventListener('click', () => setTimeout(applyUIText, 0));

    applyUIText();
    loadMemosFromFirestore().catch(() => {
        memoEmpty.textContent = t('memoLoadFailed', 'Could not load memos.');
        memoEmpty.style.display = '';
    });
})();
