import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

document.addEventListener('DOMContentLoaded', async () => {
    // State Management
    let links = [];

    // DOM Elements
    const linksGrid = document.getElementById('linksGrid');
    const emptyState = document.getElementById('emptyState');
    const searchInput = document.getElementById('searchInput');
    const statsText = document.getElementById('statsText');
    const linkModal = document.getElementById('linkModal');
    const openModalBtn = document.getElementById('openModalBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const linkForm = document.getElementById('linkForm');

    // Initialize
    await fetchLinks();

    // Modal Control
    openModalBtn.addEventListener('click', () => linkModal.classList.add('active'));
    closeModalBtn.addEventListener('click', () => linkModal.classList.remove('active'));
    window.addEventListener('click', (e) => {
        if (e.target === linkModal) linkModal.classList.remove('active');
    });

    // Add Link to Supabase
    linkForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const newLink = {
            title: document.getElementById('linkTitle').value,
            url: formatUrl(document.getElementById('linkUrl').value),
            category: document.getElementById('linkCategory').value || 'Uncategorized'
        };

        const { data, error } = await supabase
            .from('links')
            .insert([newLink])
            .select();

        if (error) {
            console.error('Error inserting link:', error);
            alert('Failed to save link to database');
            return;
        }

        links.unshift(data[0]);
        renderLinks();

        // Reset and Close
        linkForm.reset();
        linkModal.classList.remove('active');
    });

    // Search Logic
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = links.filter(link =>
            link.title.toLowerCase().includes(term) ||
            link.url.toLowerCase().includes(term) ||
            link.category.toLowerCase().includes(term)
        );
        renderLinks(filtered);
    });

    // Functions
    async function fetchLinks() {
        const { data, error } = await supabase
            .from('links')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching links:', error);
            return;
        }

        links = data;
        renderLinks();
    }

    function formatUrl(url) {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            return `https://${url}`;
        }
        return url;
    }

    function updateStats() {
        statsText.textContent = `Storing ${links.length} valuable connection${links.length === 1 ? '' : 's'}`;
    }

    async function deleteLink(id, e) {
        e.stopPropagation();
        if (confirm('Are you sure you want to remove this link?')) {
            const { error } = await supabase
                .from('links')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('Error deleting link:', error);
                alert('Failed to delete link');
                return;
            }

            links = links.filter(link => link.id !== id);
            renderLinks();
        }
    }

    function renderLinks(data = links) {
        linksGrid.innerHTML = '';

        if (data.length === 0) {
            linksGrid.appendChild(emptyState);
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
            data.forEach(link => {
                const card = createLinkCard(link);
                linksGrid.appendChild(card);
            });
        }
        updateStats();
    }

    function createLinkCard(link) {
        const div = document.createElement('div');
        div.className = 'link-card';

        let domain = 'link';
        try {
            domain = new URL(link.url).hostname;
        } catch (e) {
            domain = link.url;
        }

        const faviconUrl = `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;

        div.innerHTML = `
            <div class="link-icon">
                <img src="${faviconUrl}" alt="${link.title}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/1011/1011322.png'">
            </div>
            <div class="link-info">
                <h3>${link.title}</h3>
                <p>${domain}</p>
            </div>
            <div class="card-actions">
                <span class="category-badge">${link.category}</span>
                <button class="delete-btn" title="Delete Link">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;

        // Redirect on click
        div.addEventListener('click', () => {
            window.open(link.url, '_blank', 'noopener,noreferrer');
        });

        // Delete handler
        const delBtn = div.querySelector('.delete-btn');
        delBtn.addEventListener('click', (e) => deleteLink(link.id, e));

        return div;
    }
});
