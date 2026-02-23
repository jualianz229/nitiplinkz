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

    // --- UI Listeners ---
    openModalBtn.addEventListener('click', () => {
        resetModal();
        linkModal.classList.add('active');
    });

    closeModalBtn.addEventListener('click', () => linkModal.classList.remove('active'));

    window.addEventListener('click', (e) => {
        if (e.target === linkModal) linkModal.classList.remove('active');
    });

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = links.filter(link => {
            const matchesSearch = link.title.toLowerCase().includes(term) ||
                link.url.toLowerCase().includes(term) ||
                link.category.toLowerCase().includes(term);
            const matchesCategory = activeCategory === 'Semua' || link.category === activeCategory;
            return matchesSearch && matchesCategory;
        });
        renderLinks(filtered, false);
    });

    if (categoriesContainer) {
        categoriesContainer.addEventListener('scroll', updateArrowVisibility);
        prevCatBtn.addEventListener('click', () => categoriesContainer.scrollBy({ left: -200, behavior: 'smooth' }));
        nextCatBtn.addEventListener('click', () => categoriesContainer.scrollBy({ left: 200, behavior: 'smooth' }));
    }

    function updateArrowVisibility() {
        if (!categoriesContainer) return;
        const { scrollLeft, scrollWidth, clientWidth } = categoriesContainer;
        scrollLeft > 5 ? prevCatBtn.classList.add('visible') : prevCatBtn.classList.remove('visible');
        scrollLeft + clientWidth < scrollWidth - 5 ? nextCatBtn.classList.add('visible') : nextCatBtn.classList.remove('visible');
    }

    // --- Auth Logic ---
    function checkAuth() {
        if (isAuthorized) return true;
        const pwd = prompt('Masukkan password untuk melanjutkan:');
        if (pwd === APP_PASSWORD) {
            isAuthorized = true;
            // Clear authorization after 30 minutes
            if (authTimeout) clearTimeout(authTimeout);
            authTimeout = setTimeout(() => { isAuthorized = false; }, 30 * 60 * 1000);
            return true;
        }
        alert('Password salah atau dibatalkan.');
        return false;
    }

    // --- Form Logic ---
    linkForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!supabase) return alert('Database tidak terhubung.');
        if (!checkAuth()) return;

        const id = document.getElementById('linkId').value;
        const payload = {
            title: document.getElementById('linkTitle').value,
            url: formatUrl(document.getElementById('linkUrl').value),
            category: document.getElementById('linkCategory').value || 'Uncategorized'
        };

        if (id) {
            // Update
            const { data, error } = await supabase.from('links').update(payload).eq('id', id).select();
            if (!error) {
                const index = links.findIndex(l => l.id == id);
                links[index] = data[0];
                showToast('Link updated successfully!');
            }
        } else {
            // Insert
            const { data, error } = await supabase.from('links').insert([payload]).select();
            if (!error) {
                links.unshift(data[0]);
                showToast('Link added successfully!');
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

    // --- Data Management ---
    if (supabase) {
        try {
            const { data } = await supabase.from('links').select('*').order('created_at', { ascending: false });
            links = data || [];
            renderLinks();
        } catch (err) { console.error(err); }
    }

    function renderCategories() {
        if (!categoriesContainer) return;
        const categories = ['Semua', ...new Set(links.map(link => link.category))];
        categoriesContainer.innerHTML = '';
        const colors = ['cat-blue', 'cat-green', 'cat-orange', 'cat-purple', 'cat-rose', 'cat-cyan'];

        categories.forEach((cat, i) => {
            const pill = document.createElement('div');
            pill.className = `category-pill ${cat === activeCategory ? 'active' : ''}`;
            if (cat !== 'Semua') pill.classList.add(colors[i % colors.length]);
            pill.textContent = cat;
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
        linksGrid.innerHTML = '';
        if (renderData.length === 0) {
            linksGrid.appendChild(emptyState);
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
            renderData.forEach(link => linksGrid.appendChild(createLinkCard(link)));
        }
        if (updateCategories) renderCategories();
        updateStats(renderData.length);
    }

    function createLinkCard(link) {
        const div = document.createElement('div');
        div.className = 'link-card';
        let domain = 'link';
        try { domain = new URL(link.url).hostname; } catch (e) { domain = link.url; }
        const faviconUrl = `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;

        div.innerHTML = `
            <div class="link-icon"><img src="${faviconUrl}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/1011/1011322.png'"></div>
            <div class="link-info"><h3>${link.title}</h3><p>${domain}</p></div>
            <div class="card-actions">
                <span class="category-badge">${link.category}</span>
                <div class="action-buttons">
                    <button class="copy-btn" title="Copy URL"><i class="fas fa-copy"></i></button>
                    <button class="edit-btn" title="Edit Link"><i class="fas fa-edit"></i></button>
                    <button class="delete-btn" title="Delete Link"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
        `;

        div.addEventListener('click', (e) => {
            if (!e.target.closest('button')) window.open(link.url, '_blank', 'noopener,noreferrer');
        });

        div.querySelector('.copy-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(link.url);
            showToast('Link copied to clipboard!');
        });

        div.querySelector('.edit-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(link);
        });

        div.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteLink(link.id);
        });

        return div;
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

    async function deleteLink(id) {
        if (!checkAuth()) return;
        const { error } = await supabase.from('links').delete().eq('id', id);
        if (!error) {
            links = links.filter(link => link.id !== id);
            renderLinks();
            showToast('Link deleted successfully!');
        }
    }

    function showToast(msg) {
        document.getElementById('toastMessage').textContent = msg;
        toast.classList.add('active');
        setTimeout(() => toast.classList.remove('active'), 3000);
    }

    function formatUrl(url) {
        return (url.startsWith('http://') || url.startsWith('https://')) ? url : `https://${url}`;
    }

    function updateStats(count) {
        statsText.textContent = `Storing ${count} valuable connections`;
    }
});
