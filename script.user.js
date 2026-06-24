// ==UserScript==
// @name         Кастомный Архив Чатов с Google Поиск и Google Gemini
// @name:en      Custom Chat Archive for Google Search and Google Gemini
// @namespace    http://tampermonkey.net
// @version      3.3
// @description  Сохранение в архиве ваших диалогов с Google Поиск и Google Gemini
// @description:en Save your conversations with Google Search and Google Gemini to a personal archive.
// @author       Digital Dark & AI
// @license      MIT
// @match        *://*.google.com/*
// @match        *://*.google.ru/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    if (window !== window.top) return;

    window.__geminiArchiveBridge = {
        getStorage: (key) => GM_getValue(key, '[]'),
        setStorage: (key, value) => GM_setValue(key, value),
        getLangStorage: (key) => GM_getValue(key, 'ru'),
        setLangStorage: (key, value) => GM_setValue(key, value),
        currentUrl: () => window.location.href,
        currentTitle: () => {
            const url = window.location.href;
            const currentLang = GM_getValue('gemini_archive_lang_global', 'ru');

            const names = {
                ru: { gemini: 'Новый диалог — Google Gemini', search: 'Новый диалог — Поиск Google' },
                en: { gemini: 'New Chat — Google Gemini', search: 'New Chat — Google Search' }
            };

            const L = names[currentLang] || names.ru;

            if (url.includes('gemini.google.com')) {
                return L.gemini;
            } else if (url.includes('/search')) {
                return L.search;
            } else {
                let title = document.title;
                return title.replace(" - Gemini", "").replace(" - Поиск Google", "").replace(" - Google Search", "").trim();
            }
        }
    };

    window.addEventListener('keydown', function(e) {
        if (e.altKey && (e.code === 'KeyA' || e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 'a')) {
            e.preventDefault();
            e.stopPropagation();
            openArchivePopup();
        }
    }, true);

    function openArchivePopup() {
        const width = 390;
        const height = 540;
        const left = (screen.width / 2) - (width / 2);
        const top = (screen.height / 2) - (height / 2);

        const popup = window.open('', 'GeminiArchivePopup', `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes`);

        if (!popup) {
            alert('Браузер заблокировал всплывающее окно! Пожалуйста, разреши всплывающие окна в адресной строке.');
            return;
        }

        if (popup.document.getElementById('archive-root')) {
            popup.focus();
            return;
        }

        const doc = popup.document;
        doc.title = '🔖 Архив чатов Gemini';

        const style = doc.createElement('style');
        style.textContent = `
            body { background: #1e1f20; color: #e3e3e3; font-family: sans-serif; padding: 20px; margin: 0; box-sizing: border-box; user-select: none; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
            h3 { margin: 0; font-size: 18px; font-weight: 500; color: #e3e3e3; }
            button { cursor: pointer; font-family: sans-serif; transition: background 0.2s, opacity 0.2s; border: none; }

            #chat-list::-webkit-scrollbar { width: 6px; }
            #chat-list::-webkit-scrollbar-track { background: transparent; }
            #chat-list::-webkit-scrollbar-thumb { background: #444746; border-radius: 10px; }
            #chat-list::-webkit-scrollbar-thumb:hover { background: #555857; }

            #main-save { width: 100%; background: rgba(255,255,255,0.07); color: #a8c7fa; border: 1px solid #444746; padding: 10px; border-radius: 8px; font-weight: bold; font-size: 13.5px; margin-bottom: 10px; }
            #main-save:hover { background: rgba(255,255,255,0.12); }

            #search-inp { width: 100%; background: #1e1f20; color: #e3e3e3; border: 1px solid #444746; padding: 8px 10px; border-radius: 8px; font-size: 13px; font-family: sans-serif; box-sizing: border-box; margin-bottom: 14px; transition: border-color 0.2s; }
            #search-inp:focus { border-color: #a8c7fa; outline: none; }

            #chat-list { flex-grow: 1; overflow-y: auto; padding-right: 4px; margin-bottom: 14px; }

            .chat-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 13.5px; background: rgba(255,255,255,0.03); padding: 8px 10px; border-radius: 8px; min-height: 24px; transition: background 0.2s, opacity 0.2s, transform 0.2s, max-height 0.2s, padding 0.2s, margin 0.2s; max-height: 80px; opacity: 1; animation: fadeIn 0.25s ease-out; overflow: hidden; }
            .chat-row:hover { background: rgba(255,255,255,0.06); }

            .chat-row.deleting { opacity: 0; transform: scale(0.95); max-height: 0; padding-top: 0; padding-bottom: 0; margin-bottom: 0; }

            @keyframes fadeIn { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }

            /* Контейнер для бегущей строки */
            .marquee-wrapper { flex-grow: 1; overflow: hidden; display: flex; margin-right: 12px; position: relative; mask-image: linear-gradient(90deg, transparent 0%, #000 3%, #000 97%, transparent 100%); -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 3%, #000 97%, transparent 100%); }

            /* Сама ссылка: в обычном состоянии ведет себя как простой текст с троеточием */
            .chat-link { color: #a8c7fa; text-decoration: none; white-space: nowrap; display: inline-block; transition: color 0.2s; cursor: pointer; text-overflow: ellipsis; overflow: hidden; width: 100%; }
            .chat-link:hover { text-decoration: underline; }

            /* Стили для активации анимации табло при наведении на строку */
            .chat-row:hover .chat-link.need-marquee { overflow: visible; text-overflow: clip; width: auto; padding-right: 30px; animation: marqueeScroll 4s linear infinite; }

            @keyframes marqueeScroll {
                0% { transform: translate3d(0, 0, 0); }
                100% { transform: translate3d(-50%, 0, 0); }
            }

            .row-btn-group { display: flex; gap: 12px; align-items: center; flex-shrink: 0; }

            .inline-edit-wrapper { display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 10px; animation: slideIn 0.15s ease-out; }
            @keyframes slideIn { from { opacity: 0; transform: translateX(5px); } to { opacity: 1; transform: translateX(0); } }

            .inline-edit-input { background: #2a2b2d; color: #e3e3e3; border: 1px solid #a8c7fa; padding: 5px 8px; border-radius: 6px; font-size: 13px; flex-grow: 1; font-family: sans-serif; box-sizing: border-box; }
            .inline-edit-input:focus { outline: none; }

            .action-btn { border: none; background: none; cursor: pointer; font-size: 13px; opacity: 0.6; padding: 0; color: #e3e3e3; transition: opacity 0.2s; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
            .action-btn:hover { opacity: 1; }

            .custom-check-btn::before { content: "✓"; color: #2ecc71; font-weight: bold; font-size: 16px; }
            .custom-cancel-btn::before { content: "✕"; color: #e74c3c; font-weight: bold; font-size: 14px; }

            .lang-toggle { cursor: pointer; padding: 2px 5px; transition: color 0.2s, font-weight 0.2s; }
            .lang-toggle.active { color: #a8c7fa; font-weight: bold; }
            .lang-toggle:not(.active) { color: #8e918f; font-weight: normal; }
            .lang-toggle:not(.active):hover { color: #c4c7c5; }

            .footer-btns { display: flex; gap: 8px; border-top: 1px solid #444746; padding-top: 14px; }
            .f-btn { flex: 1; background: none; border: 1px solid #444746; color: #c4c7c5; padding: 8px; border-radius: 8px; font-size: 13px; }
            .f-btn:hover { background: rgba(255,255,255,0.02); }
        `;
        doc.head.appendChild(style);

        const root = doc.createElement('div');
        root.id = 'archive-root';
        root.style.cssText = 'display:flex; flex-direction:column; height:100%;';

        const header = doc.createElement('div');
        header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;';

        const title = doc.createElement('h3');
        title.id = 'title';

        const langBox = doc.createElement('div');
        langBox.style.cssText = 'font-size:11px; color:#8e918f;';

        const lRu = doc.createElement('span');
        lRu.id = 'l-ru';
        lRu.className = 'lang-toggle';
        lRu.textContent = 'RU';

        const lDivider = doc.createTextNode('|');

        const lEn = doc.createElement('span');
        lEn.id = 'l-en';
        lEn.className = 'lang-toggle';
        lEn.textContent = 'EN';

        langBox.appendChild(lRu);
        langBox.appendChild(lDivider);
        langBox.appendChild(lEn);
        header.appendChild(title);
        header.appendChild(langBox);

        const mainSave = doc.createElement('button');
        mainSave.id = 'main-save';

        const searchInp = doc.createElement('input');
        searchInp.type = 'text';
        searchInp.id = 'search-inp';

        const chatList = doc.createElement('div');
        chatList.id = 'chat-list';

        const footer = doc.createElement('div');
        footer.className = 'footer-btns';

        const btnExport = doc.createElement('button');
        btnExport.id = 'btn-export';
        btnExport.className = 'f-btn';
        btnExport.style.color = '#a8c7fa';

        const btnImport = doc.createElement('button');
        btnImport.id = 'btn-import';
        btnImport.className = 'f-btn';

        footer.appendChild(btnExport);
        footer.appendChild(btnImport);

        const fileInp = doc.createElement('input');
        fileInp.type = 'file';
        fileInp.id = 'file-inp';
        fileInp.style.display = 'none';
        fileInp.accept = '.txt';

        root.appendChild(header);
        root.appendChild(mainSave);
        root.appendChild(searchInp);
        root.appendChild(chatList);
        root.appendChild(footer);
        root.appendChild(fileInp);
        doc.body.appendChild(root);

        const bridge = window.__geminiArchiveBridge;
        const storageKey = 'gemini_custom_archive_global';
        const langKey = 'gemini_archive_lang_global';

        const locales = {
            ru: { title: '🔖 Сохраненные чаты', saveBtn: '➕ Сохранить текущий диалог', searchPlaceholder: '🔍 Быстрый поиск по названию...', exportBtn: '💾 Бэкап.txt', importBtn: '📂 Импорт', empty: 'Архив пуст' },
            en: { title: '🔖 Saved chats', saveBtn: '➕ Save current chat', searchPlaceholder: '🔍 Fast search...', exportBtn: '💾 Backup.txt', importBtn: '📂 Import', empty: 'Archive is empty' }
        };

        function getLang() { return bridge.getLangStorage(langKey) || 'ru'; }
        function getTodayDateString() {
            const d = new Date();
            return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
        }

        doc.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                const activeEdit = doc.querySelector('.inline-edit-wrapper[style*="display: flex"]');
                if (activeEdit) {
                    const cancelBtn = activeEdit.querySelector('.custom-cancel-btn');
                    if (cancelBtn) cancelBtn.click();
                } else {
                    popup.close();
                }
            }
        });

        function updateUI() {
            const currentLang = getLang();
            const L = locales[currentLang];

            title.textContent = L.title;
            mainSave.textContent = L.saveBtn;
            searchInp.placeholder = L.searchPlaceholder;
            btnExport.textContent = L.exportBtn;
            btnImport.textContent = L.importBtn;

            if (currentLang === 'ru') {
                lRu.classList.add('active');
                lEn.classList.remove('active');
            } else {
                lEn.classList.add('active');
                lRu.classList.remove('active');
            }

            let list = [];
            try { list = JSON.parse(bridge.getStorage(storageKey)) || []; } catch(e){}

            chatList.textContent = '';

            const query = searchInp.value.toLowerCase().trim();
            const filteredList = list.filter(item => item.name.toLowerCase().includes(query));

            if (filteredList.length === 0) {
                const emptySpan = doc.createElement('span');
                emptySpan.style.cssText = 'color:#8e918f; font-size:13.5px; display:block; text-align:center; padding:40px 20px;';
                emptySpan.textContent = L.empty;
                chatList.appendChild(emptySpan);
                return;
            }

            filteredList.forEach((item) => {
                const row = doc.createElement('div');
                row.className = 'chat-row';

                const viewWrapper = doc.createElement('div');
                viewWrapper.style.cssText = 'display:flex; justify-content:space-between; align-items:center; width:100%; overflow:hidden;';

                const marqueeWrapper = doc.createElement('div');
                marqueeWrapper.className = 'marquee-wrapper';

                const link = doc.createElement('a');
                link.className = 'chat-link';
                link.href = item.url;
                link.target = '_blank';
                link.title = item.name;
                link.textContent = item.name;

                marqueeWrapper.appendChild(link);

                const btnGroup = doc.createElement('div');
                btnGroup.className = 'row-btn-group';

                const editBtn = doc.createElement('button');
                editBtn.className = 'action-btn';
                editBtn.textContent = '✏️';

                const delBtn = doc.createElement('button');
                delBtn.className = 'action-btn';
                delBtn.textContent = '🗑️';

                delBtn.onclick = () => {
                    let freshList = [];
                    try { freshList = JSON.parse(bridge.getStorage(storageKey)) || []; } catch(e){}
                    const realIndex = freshList.findIndex(orig => orig.url === item.url && orig.name === item.name);

                    if (realIndex !== -1) {
                        freshList.splice(realIndex, 1);
                        bridge.setStorage(storageKey, JSON.stringify(freshList));
                        row.classList.add('deleting');
                        setTimeout(() => {
                            row.remove();
                            if (chatList.children.length === 0) {
                                const emptySpan = doc.createElement('span');
                                emptySpan.style.cssText = 'color:#8e918f; font-size:13.5px; display:block; text-align:center; padding:40px 20px;';
                                emptySpan.textContent = locales[getLang()].empty;
                                chatList.appendChild(emptySpan);
                            }
                        }, 200);
                    }
                };

                btnGroup.appendChild(editBtn);
                btnGroup.appendChild(delBtn);
                viewWrapper.appendChild(marqueeWrapper);
                viewWrapper.appendChild(btnGroup);

                const editWrapper = doc.createElement('div');
                editWrapper.className = 'inline-edit-wrapper';
                editWrapper.style.display = 'none';

                const input = doc.createElement('input');
                input.type = 'text';
                input.className = 'inline-edit-input';
                input.value = item.name;

                const inlineBtnGroup = doc.createElement('div');
                inlineBtnGroup.style.cssText = 'display:flex; gap:14px; align-items:center; padding-right: 2px;';

                const saveEditBtn = doc.createElement('button');
                saveEditBtn.className = 'action-btn custom-check-btn';

                const cancelEditBtn = doc.createElement('button');
                cancelEditBtn.className = 'action-btn custom-cancel-btn';

                inlineBtnGroup.appendChild(saveEditBtn);
                inlineBtnGroup.appendChild(cancelEditBtn);
                editWrapper.appendChild(input);
                editWrapper.appendChild(inlineBtnGroup);

                row.appendChild(viewWrapper);
                row.appendChild(editWrapper);

                // ОПРЕДЕЛЕНИЕ: Нужна ли бегущая строка (выходит ли текст за границы контейнера)
                // Запускаем проверку через таймаут, когда нода уже встроена в документ и имеет физическую ширину
                setTimeout(() => {
                    if (link.scrollWidth > marqueeWrapper.clientWidth) {
                        link.classList.add('need-marquee');
                        // Дублируем текст внутри ссылки для бесшовного зацикливания бегущей строки
                        link.innerHTML = `<span>${item.name}</span><span style="padding-left:40px;">${item.name}</span>`;
                    }
                }, 50);

                editBtn.onclick = () => {
                    viewWrapper.style.display = 'none';
                    editWrapper.style.display = 'flex';
                    input.focus();
                    input.select();
                };

                const doSave = () => {
                    let freshList = [];
                    try { freshList = JSON.parse(bridge.getStorage(storageKey)) || []; } catch(e){}
                    const realIndex = freshList.findIndex(orig => orig.url === item.url && orig.name === item.name);

                    const newName = input.value.trim();
                    if (newName !== '' && realIndex !== -1) {
                        freshList[realIndex].name = newName;
                        bridge.setStorage(storageKey, JSON.stringify(freshList));
                        item.name = newName;
                        link.title = newName;

                        // Сбрасываем эффекты и перепроверяем заново для измененного имени
                        link.classList.remove('need-marquee');
                        link.textContent = newName;
                        if (link.scrollWidth > marqueeWrapper.clientWidth) {
                            link.classList.add('need-marquee');
                            link.innerHTML = `<span>${newName}</span><span style="padding-left:40px;">${newName}</span>`;
                        }
                    }
                    editWrapper.style.display = 'none';
                    viewWrapper.style.display = 'flex';
                };

                const doCancel = () => {
                    input.value = item.name;
                    editWrapper.style.display = 'none';
                    viewWrapper.style.display = 'flex';
                };

                saveEditBtn.onclick = doSave;
                cancelEditBtn.onclick = doCancel;

                input.onkeydown = (e) => {
                    if (e.key === 'Enter') doSave();
                    if (e.key === 'Escape') {
                        e.stopPropagation();
                        doCancel();
                    }
                };

                chatList.appendChild(row);
            });
        }

        searchInp.oninput = () => { updateUI(); };
        lRu.onclick = () => { bridge.setLangStorage(langKey, 'ru'); updateUI(); };
        lEn.onclick = () => { bridge.setLangStorage(langKey, 'en'); updateUI(); };

        mainSave.onclick = () => {
            let list = [];
            try { list = JSON.parse(bridge.getStorage(storageKey)) || []; } catch(e){}
            const chatTitle = bridge.currentTitle();
            list.push({ name: `${chatTitle} (${getTodayDateString()})`, url: bridge.currentUrl() });
            bridge.setStorage(storageKey, JSON.stringify(list));
            searchInp.value = '';
            updateUI();
        };

        btnImport.onclick = () => fileInp.click();
        btnExport.onclick = () => {
            let dataStr = '[]';
            try { dataStr = bridge.getStorage(storageKey) || '[]'; } catch(e){}
            const blob = new Blob([dataStr], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = doc.createElement('a');
            a.href = url; a.download = 'gemini_chats_global_backup.txt'; a.click();
        };

        fileInp.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(evt) {
                try {
                    const imported = JSON.parse(evt.target.result);
                    if (Array.isArray(imported)) {
                        bridge.setStorage(storageKey, JSON.stringify(imported));
                        searchInp.value = '';
                        updateUI();
                    }
                } catch (err) {}
            };
            reader.readAsText(file);
        };

        updateUI();
    }
})();
