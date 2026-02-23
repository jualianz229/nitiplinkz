import { createClient } from '@supabase/supabase-js'

// Environment variables from Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD || 'admin123'

// Initialize Supabase
let supabase = null;
try {
    if (supabaseUrl && supabaseKey && !supabaseUrl.includes('your_supabase')) {
        supabase = createClient(supabaseUrl, supabaseKey)
    }
} catch (e) {
    console.error('Failed to initialize Supabase client:', e);
}

document.addEventListener('DOMContentLoaded', async () => {
    // State Management
    let links = [];
    let activeCategory = 'Semua';
    let isAuthorized = false;
    let authTimeout = null;
    let viewMode = localStorage.getItem('viewMode') || 'grid-mode';
    let selectedIds = new Set();

    // DOM Elements
    const linksGrid = document.getElementById('linksGrid');
    const emptyState = document.getElementById('emptyState');
    const searchInput = document.getElementById('searchInput');
    const statsText = document.getElementById('statsText');
    const linkModal = document.getElementById('linkModal');
    const openModalBtn = document.getElementById('openModalBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const linkForm = document.getElementById('linkForm');
    const categoriesContainer = document.getElementById('categoriesContainer');
    const prevCatBtn = document.getElementById('prevCat');
    const nextCatBtn = document.getElementById('nextCat');
    const toast = document.getElementById('toast');
    const modalTitle = document.getElementById('modalTitle');
    const submitBtn = document.getElementById('submitBtn');
    const viewToggle = document.getElementById('viewToggle');
    const logoutBtn = document.getElementById('logoutBtn');
    const bulkBar = document.getElementById('bulkBar');
    const selectedCountText = document.getElementById('selectedCount');
    const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
    const cancelBulkBtn = document.getElementById('cancelBulkBtn');
    const qrModal = document.getElementById('qrModal');
    const qrImage = document.getElementById('qrImage');
    const qrTitleText = document.getElementById('qrTitle');
    const qrLinkText = document.getElementById('qrLink');
    const closeQrModalBtn = document.getElementById('closeQrModalBtn');
    const clearSearch = document.getElementById('clearSearch');

    // Register PWA Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW registration failed:', err));
        });
    }

    // --- UI Listeners ---
    openModalBtn.addEventListener('click', () => {
        resetModal();
        linkModal.classList.add('active');
    });

    closeModalBtn.addEventListener('click', () => linkModal.classList.remove('active'));
    closeQrModalBtn.addEventListener('click', () => qrModal.classList.remove('active'));

    window.addEventListener('click', (e) => {
        if (e.target === linkModal) linkModal.classList.remove('active');
        if (e.target === qrModal) qrModal.classList.remove('active');
    });

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        clearSearch.style.display = term ? 'flex' : 'none';
        const filtered = links.filter(link => {
            const matchesSearch = link.title.toLowerCase().includes(term) ||
                link.url.toLowerCase().includes(term) ||
                link.category.toLowerCase().includes(term);
            const matchesCategory = activeCategory === 'Semua' || link.category === activeCategory;
            return matchesSearch && matchesCategory;
        });
        renderLinks(filtered, false);
    });

    clearSearch.addEventListener('click', () => {
        searchInput.value = '';
        clearSearch.style.display = 'none';
        searchInput.focus();
        renderLinks();
    });

    viewToggle.addEventListener('click', () => {
        viewMode = viewMode === 'grid-mode' ? 'list-mode' : 'grid-mode';
        localStorage.setItem('viewMode', viewMode);
        updateViewToggleIcon();
        renderLinks(null, false);
    });

    logoutBtn.addEventListener('click', () => {
        isAuthorized = false;
        if (authTimeout) clearTimeout(authTimeout);
        logoutBtn.style.display = 'none';
        showToast('Session locked!');
    });

    cancelBulkBtn.addEventListener('click', clearBulkSelection);

    bulkDeleteBtn.addEventListener('click', async () => {
        if (selectedIds.size === 0) return;
        if (!checkAuth()) return;

        if (confirm(`Are you sure you want to delete ${selectedIds.size} items?`)) {
            const { error } = await supabase.from('links').delete().in('id', Array.from(selectedIds));
            if (!error) {
                links = links.filter(l => !selectedIds.has(l.id));
                showToast(`${selectedIds.size} links deleted!`);
                clearBulkSelection();
                renderLinks();
            }
        }
    });

    if (categoriesContainer) {
        categoriesContainer.addEventListener('scroll', updateArrowVisibility);
        prevCatBtn.addEventListener('click', () => categoriesContainer.scrollBy({ left: -200, behavior: 'smooth' }));
        nextCatBtn.addEventListener('click', () => categoriesContainer.scrollBy({ left: 200, behavior: 'smooth' }));
    }

    // --- Core Functions ---
    function updateViewToggleIcon() {
        const icon = viewToggle.querySelector('i');
        icon.className = viewMode === 'grid-mode' ? 'fas fa-th-large' : 'fas fa-list';
    }

    function updateArrowVisibility() {
        if (!categoriesContainer) return;
        const { scrollLeft, scrollWidth, clientWidth } = categoriesContainer;
        scrollLeft > 5 ? prevCatBtn.classList.add('visible') : prevCatBtn.classList.remove('visible');
        scrollLeft + clientWidth < scrollWidth - 5 ? nextCatBtn.classList.add('visible') : nextCatBtn.classList.remove('visible');
    }

    function checkAuth() {
        if (isAuthorized) return true;
        const pwd = prompt('Enter password to manage links:');
        if (pwd === APP_PASSWORD) {
            isAuthorized = true;
            logoutBtn.style.display = 'flex';
            if (authTimeout) clearTimeout(authTimeout);
            authTimeout = setTimeout(() => {
                isAuthorized = false;
                logoutBtn.style.display = 'none';
            }, 30 * 60 * 1000);
            return true;
        }
        alert('Wrong password!');
        return false;
    }

    linkForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!supabase) return;
        if (!checkAuth()) return;

        const id = document.getElementById('linkId').value;
        const payload = {
            title: document.getElementById('linkTitle').value,
            url: (url => (url.startsWith('http://') || url.startsWith('https://')) ? url : `https://${url}`)(document.getElementById('linkUrl').value),
            category: document.getElementById('linkCategory').value || 'Uncategorized'
        };

        if (id) {
            const { data, error } = await supabase.from('links').update(payload).eq('id', id).select();
            if (!error) {
                links[links.findIndex(l => l.id == id)] = data[0];
                showToast('Link updated!');
            }
        } else {
            const { data, error } = await supabase.from('links').insert([payload]).select();
            if (!error) {
                links.unshift(data[0]);
                showToast('Link added!');
            }
        }

        renderLinks();
        linkModal.classList.remove('active');
        linkForm.reset();
    });

    function resetModal() {
        modalTitle.textContent = 'Add Favorite Link';
        submitBtn.textContent = 'Save Link';
        document.getElementById('linkId').value = '';
        linkForm.reset();
    }

    function renderCategories() {
        if (!categoriesContainer) return;
        const categoryCounts = links.reduce((acc, link) => {
            acc[link.category] = (acc[link.category] || 0) + 1;
            return acc;
        }, {});

        const categories = ['Semua', ...new Set(links.map(link => link.category))];
        categoriesContainer.innerHTML = '';

        categories.forEach((cat) => {
            const pill = document.createElement('div');
            pill.className = `category-pill ${cat === activeCategory ? 'active' : ''}`;

            const nameSpan = document.createElement('span');
            nameSpan.textContent = cat;
            pill.appendChild(nameSpan);

            if (cat !== 'Semua') {
                const countSpan = document.createElement('span');
                countSpan.className = 'cat-count';
                countSpan.textContent = `(${categoryCounts[cat] || 0})`;
                pill.appendChild(countSpan);
            }

            pill.addEventListener('click', () => {
                activeCategory = cat;
                renderLinks();
            });
            categoriesContainer.appendChild(pill);
        });
        setTimeout(updateArrowVisibility, 100);
    }

    function renderLinks(data = null, updateCategories = true) {
        const renderData = data || (activeCategory === 'Semua' ? links : links.filter(l => l.category === activeCategory));

        linksGrid.className = `links-grid ${viewMode}`;
        linksGrid.innerHTML = '';

        if (renderData.length === 0) {
            linksGrid.appendChild(emptyState);
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
            renderData.forEach(link => linksGrid.appendChild(createLinkCard(link)));
        }

        if (updateCategories) renderCategories();
        statsText.textContent = `Storing ${renderData.length} valuable connections`;
    }

    function createLinkCard(link) {
        const div = document.createElement('div');
        div.className = `link-card ${selectedIds.has(link.id) ? 'selected' : ''}`;

        const firstLetter = link.title.charAt(0).toUpperCase();
        let domain = 'link';
        try { domain = new URL(link.url).hostname; } catch (e) { domain = link.url; }

        div.innerHTML = `
            <div class="card-select"></div>
            <div class="link-info">
                <h3>${link.title}</h3>
                <p>${domain}</p>
            </div>
            <div class="card-actions">
                <span class="category-badge">${link.category}</span>
                <div class="action-buttons">
                    <button class="qr-btn" title="Show QR"><i class="fas fa-qrcode"></i></button>
                    <button class="copy-btn" title="Copy URL"><i class="fas fa-copy"></i></button>
                    <button class="edit-btn" title="Edit Link"><i class="fas fa-edit"></i></button>
                    <button class="delete-btn" title="Delete Link"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
        `;

        // Click Logic
        div.addEventListener('click', (e) => {
            if (e.target.closest('.card-select')) {
                toggleSelect(link.id, div);
                return;
            }
            if (!e.target.closest('button')) window.open(link.url, '_blank', 'noopener,noreferrer');
        });

        div.querySelector('.qr-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            showQrModal(link);
        });

        div.querySelector('.copy-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(link.url);
            showToast('Link copied!');
        });

        div.querySelector('.edit-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(link);
        });

        div.querySelector('.delete-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!checkAuth()) return;
            const { error } = await supabase.from('links').delete().eq('id', link.id);
            if (!error) {
                links = links.filter(l => l.id !== link.id);
                renderLinks();
                showToast('Deleted!');
            }
        });

        return div;
    }

    function toggleSelect(id, el) {
        if (selectedIds.has(id)) {
            selectedIds.delete(id);
            el.classList.remove('selected');
        } else {
            selectedIds.add(id);
            el.classList.add('selected');
        }
        updateBulkBar();
    }

    function updateBulkBar() {
        if (selectedIds.size > 0) {
            selectedCountText.textContent = selectedIds.size;
            bulkBar.classList.add('active');
        } else {
            bulkBar.classList.remove('active');
        }
    }

    function clearBulkSelection() {
        selectedIds.clear();
        updateBulkBar();
        document.querySelectorAll('.link-card.selected').forEach(card => card.classList.remove('selected'));
    }

    function showQrModal(link) {
        qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(link.url)}`;
        qrTitleText.textContent = link.title;
        qrLinkText.textContent = link.url;
        qrModal.classList.add('active');
    }

    function openEditModal(link) {
        modalTitle.textContent = 'Edit Link';
        submitBtn.textContent = 'Update Link';
        document.getElementById('linkId').value = link.id;
        document.getElementById('linkTitle').value = link.title;
        document.getElementById('linkUrl').value = link.url;
        document.getElementById('linkCategory').value = link.category === 'Uncategorized' ? '' : link.category;
        linkModal.classList.add('active');
    }

    function showToast(msg) {
        document.getElementById('toastMessage').textContent = msg;
        toast.classList.add('active');
        setTimeout(() => toast.classList.remove('active'), 3000);
    }

    // Init Logic
    updateViewToggleIcon();
    if (supabase) {
        const { data } = await supabase.from('links').select('*').order('created_at', { ascending: false });
        links = data || [];
        renderLinks();
    }
});
