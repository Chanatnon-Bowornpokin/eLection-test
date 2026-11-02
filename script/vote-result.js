document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchElectionInput');
    const filterChips = document.querySelectorAll('.filter-chip');
    const cards = document.querySelectorAll('.result-election-card');

    let currentFilter = 'all';
    let searchQuery = '';

    function applyFilterAndSearch() {
        const query = searchQuery.trim().toLowerCase();

        cards.forEach(card => {
            const category = card.getAttribute('data-category') || '';
            const title = (card.getAttribute('data-title') || '').toLowerCase();

            const matchFilter = (currentFilter === 'all') || (category === currentFilter);
            const matchSearch = (!query) || title.includes(query);

            if (matchFilter && matchSearch) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    }

    // Filter Chips Click
    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilter = chip.getAttribute('data-filter') || 'all';
            applyFilterAndSearch();
        });
    });

    // Search Input Event
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            applyFilterAndSearch();
        });
    }
});

