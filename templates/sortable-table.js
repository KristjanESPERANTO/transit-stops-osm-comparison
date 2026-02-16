document.addEventListener('DOMContentLoaded', function() {
    const tables = document.querySelectorAll('table.sortable');

    tables.forEach(table => {
        const headers = table.querySelectorAll('thead th');
        const tbody = table.querySelector('tbody');
        let rowspansExpanded = false;

        // Expand all rowspan cells into individual cells
        function expandRowspans() {
            if (rowspansExpanded) return;

            const rows = Array.from(tbody.querySelectorAll('tr'));

            // Build a grid to track which cells span into which rows
            const grid = [];
            rows.forEach((row, rowIndex) => {
                grid[rowIndex] = grid[rowIndex] || [];
                let colIndex = 0;

                for (let cell of row.cells) {
                    // Find next available column
                    while (grid[rowIndex][colIndex]) {
                        colIndex++;
                    }

                    const rowSpan = cell.rowSpan || 1;
                    const colSpan = cell.colSpan || 1;

                    // Mark cells in grid and store reference
                    for (let r = 0; r < rowSpan; r++) {
                        grid[rowIndex + r] = grid[rowIndex + r] || [];
                        for (let c = 0; c < colSpan; c++) {
                            grid[rowIndex + r][colIndex + c] = {
                                cell: cell,
                                isOrigin: (r === 0 && c === 0)
                            };
                        }
                    }

                    colIndex += colSpan;
                }
            });

            // Now rebuild each row with expanded cells
            rows.forEach((row, rowIndex) => {
                const newCells = [];
                const gridRow = grid[rowIndex] || [];

                for (let colIndex = 0; colIndex < gridRow.length; colIndex++) {
                    const cellInfo = gridRow[colIndex];
                    if (cellInfo) {
                        if (cellInfo.isOrigin) {
                            // This is the original cell - remove rowspan
                            cellInfo.cell.rowSpan = 1;
                            newCells.push(cellInfo.cell);
                        } else {
                            // This cell spans from a previous row - create a copy
                            const clone = cellInfo.cell.cloneNode(true);
                            clone.rowSpan = 1;
                            newCells.push(clone);
                        }
                    }
                }

                // Clear row and add new cells
                while (row.firstChild) {
                    row.removeChild(row.firstChild);
                }
                newCells.forEach(cell => row.appendChild(cell));
            });

            rowspansExpanded = true;
        }

        function parseNumber(cellText) {
            const normalized = cellText.trim().replace(',', '.');
            if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
                return null;
            }
            const value = parseFloat(normalized);
            return Number.isNaN(value) ? null : value;
        }

        function setupRegionReportControls() {
            if (!table.classList.contains('region-report-table')) {
                return;
            }

            expandRowspans();

            const headerTexts = Array.from(headers).map(h => h.textContent.trim());
            const idx = {
                status: headerTexts.indexOf('Abgleich-Status'),
                mode: headerTexts.indexOf('Mode'),
                distance: headerTexts.indexOf('Entfernung'),
                rating: headerTexts.indexOf('Bewertung'),
                suspicious: headerTexts.indexOf('Auffällig')
            };

            if (idx.status === -1 || idx.mode === -1 || idx.distance === -1 || idx.rating === -1 || idx.suspicious === -1) {
                return;
            }

            const controls = document.createElement('div');
            controls.className = 'report-controls';

            const summaryContainer = document.createElement('div');
            summaryContainer.className = 'report-summary';

            const filterBar = document.createElement('div');
            filterBar.className = 'report-filters';

            const textFilter = document.createElement('input');
            textFilter.type = 'text';
            textFilter.placeholder = 'Suche (Name, DHID, Linien, Richtung ...)';

            const modeFilter = document.createElement('select');
            const allModesOption = document.createElement('option');
            allModesOption.value = '';
            allModesOption.textContent = 'Alle Modi';
            modeFilter.appendChild(allModesOption);

            const minDistanceFilter = document.createElement('input');
            minDistanceFilter.type = 'number';
            minDistanceFilter.step = '0.1';
            minDistanceFilter.min = '0';
            minDistanceFilter.placeholder = 'Min Distanz (m)';

            const maxRatingFilter = document.createElement('input');
            maxRatingFilter.type = 'number';
            maxRatingFilter.step = '0.01';
            maxRatingFilter.min = '0';
            maxRatingFilter.max = '1';
            maxRatingFilter.placeholder = 'Max Rating';

            const suspiciousLabel = document.createElement('label');
            suspiciousLabel.className = 'inline-label';
            const suspiciousOnlyFilter = document.createElement('input');
            suspiciousOnlyFilter.type = 'checkbox';
            suspiciousLabel.appendChild(suspiciousOnlyFilter);
            suspiciousLabel.appendChild(document.createTextNode(' nur Auffällige'));

            const resetButton = document.createElement('button');
            resetButton.type = 'button';
            resetButton.textContent = 'Filter zurücksetzen';

            const visibleCounter = document.createElement('span');
            visibleCounter.className = 'visible-counter';

            filterBar.appendChild(textFilter);
            filterBar.appendChild(modeFilter);
            filterBar.appendChild(minDistanceFilter);
            filterBar.appendChild(maxRatingFilter);
            filterBar.appendChild(suspiciousLabel);
            filterBar.appendChild(resetButton);
            filterBar.appendChild(visibleCounter);

            controls.appendChild(summaryContainer);
            controls.appendChild(filterBar);
            table.parentNode.insertBefore(controls, table);

            const rows = Array.from(tbody.querySelectorAll('tr'));
            const modeValues = new Set();
            const statusCounts = {};
            rows.forEach(row => {
                const cells = row.cells;
                const mode = (cells[idx.mode] ? cells[idx.mode].textContent : '').trim();
                const status = (cells[idx.status] ? cells[idx.status].textContent : '').trim();

                if (mode) {
                    modeValues.add(mode);
                }
                if (status) {
                    statusCounts[status] = (statusCounts[status] || 0) + 1;
                }
            });

            Array.from(modeValues).sort((a, b) => a.localeCompare(b, 'de')).forEach(mode => {
                const option = document.createElement('option');
                option.value = mode;
                option.textContent = mode;
                modeFilter.appendChild(option);
            });

            let selectedState = '';
            const stateButtons = [];

            function updateStateButtonStyles() {
                stateButtons.forEach(btn => {
                    const isActive = btn.dataset.state === selectedState || (btn.dataset.state === '__ALL__' && selectedState === '');
                    btn.classList.toggle('active', isActive);
                });
            }

            function createStateButton(stateLabel, stateValue, count) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'summary-chip';
                button.dataset.state = stateValue;
                button.textContent = stateLabel + ' (' + count + ')';
                button.addEventListener('click', function() {
                    selectedState = (stateValue === '__ALL__') ? '' : stateValue;
                    updateStateButtonStyles();
                    applyFilters();
                });
                stateButtons.push(button);
                summaryContainer.appendChild(button);
            }

            createStateButton('Alle', '__ALL__', rows.length);
            Object.keys(statusCounts)
                .sort((a, b) => statusCounts[b] - statusCounts[a])
                .forEach(status => createStateButton(status, status, statusCounts[status]));

            updateStateButtonStyles();

            function applyFilters() {
                const query = textFilter.value.trim().toLowerCase();
                const selectedMode = modeFilter.value;
                const minDistance = minDistanceFilter.value === '' ? null : parseFloat(minDistanceFilter.value);
                const maxRating = maxRatingFilter.value === '' ? null : parseFloat(maxRatingFilter.value);
                const suspiciousOnly = suspiciousOnlyFilter.checked;

                let visibleCount = 0;
                rows.forEach(row => {
                    const cells = row.cells;
                    const status = (cells[idx.status] ? cells[idx.status].textContent : '').trim();
                    const mode = (cells[idx.mode] ? cells[idx.mode].textContent : '').trim();
                    const distance = parseNumber(cells[idx.distance] ? cells[idx.distance].textContent : '');
                    const rating = parseNumber(cells[idx.rating] ? cells[idx.rating].textContent : '');
                    const suspicious = cells[idx.suspicious] && cells[idx.suspicious].querySelectorAll('.suspicious-badge').length > 0;

                    const stateMatch = !selectedState || status === selectedState;
                    const modeMatch = !selectedMode || mode === selectedMode;
                    const distanceMatch = minDistance === null || (distance !== null && distance >= minDistance);
                    const ratingMatch = maxRating === null || (rating !== null && rating <= maxRating);
                    const suspiciousMatch = !suspiciousOnly || suspicious;
                    const textMatch = !query || row.textContent.toLowerCase().includes(query);

                    const visible = stateMatch && modeMatch && distanceMatch && ratingMatch && suspiciousMatch && textMatch;
                    row.style.display = visible ? '' : 'none';
                    if (visible) {
                        visibleCount += 1;
                    }
                });

                visibleCounter.textContent = 'Treffer: ' + visibleCount + ' / ' + rows.length;
            }

            [textFilter, modeFilter, minDistanceFilter, maxRatingFilter, suspiciousOnlyFilter].forEach(control => {
                control.addEventListener('input', applyFilters);
                control.addEventListener('change', applyFilters);
            });

            resetButton.addEventListener('click', function() {
                selectedState = '';
                textFilter.value = '';
                modeFilter.value = '';
                minDistanceFilter.value = '';
                maxRatingFilter.value = '';
                suspiciousOnlyFilter.checked = false;
                updateStateButtonStyles();
                applyFilters();
            });

            applyFilters();
        }

        setupRegionReportControls();

        headers.forEach((header, colIndex) => {
            header.classList.add('sortable');
            header.addEventListener('click', () => {
                // Expand rowspans on first sort
                expandRowspans();

                const rows = Array.from(tbody.querySelectorAll('tr'));
                const isAscending = header.classList.contains('sorted-asc');

                // Remove sorting classes from all headers
                headers.forEach(h => h.classList.remove('sorted-asc', 'sorted-desc'));

                // Add appropriate class to clicked header
                header.classList.add(isAscending ? 'sorted-desc' : 'sorted-asc');

                // Sort rows
                rows.sort((a, b) => {
                    const aCell = a.cells[colIndex];
                    const bCell = b.cells[colIndex];

                    if (!aCell || !bCell) return 0;

                    const aText = aCell.textContent.trim();
                    const bText = bCell.textContent.trim();

                    // Handle empty values
                    if (aText === '' && bText === '') return 0;
                    if (aText === '') return 1;  // Empty values go to the end
                    if (bText === '') return -1;

                    // Try to parse as number (single number only, not comma-separated lists)
                    const aNum = parseFloat(aText.replace(',', '.'));
                    const bNum = parseFloat(bText.replace(',', '.'));

                    let comparison = 0;
                    // Both must be valid numbers AND the original text should look numeric
                    if (!isNaN(aNum) && !isNaN(bNum) && /^-?\d+([.,]\d+)?$/.test(aText) && /^-?\d+([.,]\d+)?$/.test(bText)) {
                        comparison = aNum - bNum;
                    } else {
                        comparison = aText.localeCompare(bText, 'de');
                    }

                    return isAscending ? -comparison : comparison;
                });

                // Re-append sorted rows
                rows.forEach(row => tbody.appendChild(row));
            });
        });
    });
});