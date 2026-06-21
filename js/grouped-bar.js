// js/grouped-bar.js
// Grouped Bar Chart with Dual Y-Axis - Shows fines (left) and arrests (right) by age group

/**
 * Renders a grouped bar chart with DUAL Y-AXIS
 * 
 * WHAT IT SHOWS:
 * - Fines (blue bars) on LEFT y-axis ($)
 * - Arrests (red bars) on RIGHT y-axis (count)
 * - Grouped by age group (0-16, 17-25, 26-39, 40-64, 65+)
 * 
 * DATA SOURCE: intersectionData filtered for 'All Regions' only
 * 
 * FILTER LOGIC:
 * - ALWAYS uses 'All Regions' (national view) - DOES NOT filter by jurisdiction
 * - Applies method filter (if specific method selected)
 * - Applies age filter (if specific age selected)
 * - Excludes 'All Methods' and 'Camera' aggregates when method = 'all'
 * - Excludes 'All Ages' when method = 'all'
 * 
 * DUAL AXIS IMPLEMENTATION:
 * 1. Two separate y-scales: yScaleFines (left) and yScaleArrests (right)
 * 2. Left axis: d3.axisLeft(yScaleFines) with currency formatting
 * 3. Right axis: d3.axisRight(yScaleArrests) with number formatting
 * 4. Bars use the appropriate y-scale based on their subgroup
 * 5. Both axes have different domains (fines $ vs arrests count)
 * 
 * WHY DUAL AXIS?
 * - Fines and arrests have very different scales (fines are much larger numbers)
 * - Putting them on the same axis would make arrests invisible
 * - Dual axis allows both to be compared visually
 */
function renderGroupedBarChart() {
    const container = document.getElementById('groupedBarChart');
    if (!container) return;

    container.innerHTML = '';

    if (!intersectionData || intersectionData.length === 0) {
        container.innerHTML = '<div class="loading-state">Loading data...</div>';
        return;
    }

    let filtered = [...intersectionData];

    // CRITICAL: ALWAYS use 'All Regions' - this shows NATIONAL age breakdown
    // We DO NOT filter by jurisdiction here (unlike other charts)
    filtered = filtered.filter(d => d.location === 'All Regions');

    // Apply method filter
    if (state.method === 'all') {
        // Exclude aggregate categories when no method selected
        filtered = filtered.filter(d => d.method !== 'All Methods');
        filtered = filtered.filter(d => d.method !== 'Camera');
        filtered = filtered.filter(d => d.ageGroup !== 'All Ages');
    } else {
        filtered = filtered.filter(d => d.method === state.method);
    }

    // Apply age filter if specific age selected
    if (state.age !== 'all') {
        filtered = filtered.filter(d => d.ageGroup === state.age);
    }

    // Define age group order (custom sorting)
    const ageGroupsOrder = ['0-16', '17-25', '26-39', '40-64', '65 and over', 'All Ages'];
    const existingAgeGroups = [...new Set(filtered.map(d => d.ageGroup))];
    const ageGroups = ageGroupsOrder.filter(ag => existingAgeGroups.includes(ag));

    // Short display labels for age groups
    const ageGroupLabels = {
        '0-16': '0-16',
        '17-25': '17-25',
        '26-39': '26-39',
        '40-64': '40-64',
        '65 and over': '65+',
        'All Ages': 'All Ages'
    };

    // Aggregate data by age group
    const data = ageGroups.map(age => {
        const ageData = filtered.filter(d => d.ageGroup === age);
        return {
            ageGroup: age,
            displayLabel: ageGroupLabels[age] || age,
            fines: d3.sum(ageData, d => d.fines),
            arrests: d3.sum(ageData, d => d.arrests),
            charges: d3.sum(ageData, d => d.charges)
        };
    }).filter(d => d.fines > 0 || d.arrests > 0);

    if (!data.length) {
        container.innerHTML = '<div class="no-data-state">No data available for selected filters</div>';
        return;
    }

    // Delay rendering to ensure container dimensions are available
    setTimeout(() => {
        const rect = container.getBoundingClientRect();
        const width = Math.max(rect.width - 40, 550);
        const height = Math.max(rect.height - 40, 400);

        const margin = { top: 95, right: 80, bottom: 70, left: 80 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        // Remove any existing SVG to prevent duplicate renders
        const existingSvg = container.querySelector('svg');
        if (existingSvg) existingSvg.remove();

        const svg = d3.select(container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${width} ${height}`)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Two subgroups: fines and arrests
        const subgroups = ['fines', 'arrests'];
        const colors = { fines: '#2E86AB', arrests: '#E63946' };

        // Calculate max values for y-axis scaling (separate for each axis)
        const maxFines = d3.max(data, d => d.fines);
        const maxArrests = d3.max(data, d => d.arrests);
        const yMaxFines = maxFines * 1.15;    // 15% headroom
        const yMaxArrests = maxArrests * 1.15;

        // X-axis: age groups (categorical)
        const xScale = d3.scaleBand()
            .domain(data.map(d => d.displayLabel))
            .range([0, innerWidth])
            .padding(0.2);

        // Subgroup scale: fines vs arrests within each age group
        const xSubgroup = d3.scaleBand()
            .domain(subgroups)
            .range([0, xScale.bandwidth()])
            .padding(0.1);

        // ============================================================
        // DUAL Y-AXIS IMPLEMENTATION
        // ============================================================
        // Left Y-axis: Fines (dollars) - blue
        const yScaleFines = d3.scaleLinear()
            .domain([0, yMaxFines])
            .range([innerHeight, 0])
            .nice();

        // Right Y-axis: Arrests (count) - red
        const yScaleArrests = d3.scaleLinear()
            .domain([0, yMaxArrests])
            .range([innerHeight, 0])
            .nice();
        // ============================================================

        // Grid lines (using fines scale for consistency)
        svg.append('g')
            .attr('class', 'grid-lines')
            .call(d3.axisLeft(yScaleFines).ticks(5).tickSize(-innerWidth).tickFormat(''))
            .select('.domain').remove();

        // Left Y-axis: Fines (blue) with currency formatting
        svg.append('g')
            .attr('class', 'axis axis-left axis-fines')
            .call(d3.axisLeft(yScaleFines).ticks(5).tickFormat(d => {
                if (d >= 1e6) return (d / 1e6).toFixed(1) + 'M';
                if (d >= 1e3) return (d / 1e3).toFixed(0) + 'K';
                return d;
            }));

        // Right Y-axis: Arrests (red) with number formatting
        svg.append('g')
            .attr('class', 'axis axis-right axis-arrests')
            .attr('transform', `translate(${innerWidth}, 0)`)
            .call(d3.axisRight(yScaleArrests).ticks(5).tickFormat(d => {
                if (d >= 1e6) return (d / 1e6).toFixed(1) + 'M';
                if (d >= 1e3) return (d / 1e3).toFixed(0) + 'K';
                return d;
            }));

        // X-axis
        svg.append('g')
            .attr('class', 'axis axis-bottom')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale));

        // X-axis label
        svg.append('text')
            .attr('class', 'axis-label axis-label-x')
            .attr('x', innerWidth / 2)
            .attr('y', innerHeight + 48)
            .attr('text-anchor', 'middle')
            .text('Age Group');

        // Left Y-axis label (Fines)
        svg.append('text')
            .attr('class', 'axis-label axis-label-y-left')
            .attr('x', -innerHeight / 2)
            .attr('y', -55)
            .attr('text-anchor', 'middle')
            .attr('transform', 'rotate(-90)')
            .style('fill', colors.fines)
            .text('Fines ($)');

        // Right Y-axis label (Arrests)
        svg.append('text')
            .attr('class', 'axis-label axis-label-y-right')
            .attr('x', -innerHeight / 2)
            .attr('y', innerWidth + 68)
            .attr('text-anchor', 'middle')
            .attr('transform', 'rotate(-90)')
            .style('fill', colors.arrests)
            .text('Arrests (count)');

        // Dual axis indicator (title above chart)
        svg.append('text')
            .attr('class', 'dual-axis-indicator')
            .attr('x', innerWidth / 2)
            .attr('y', -45)
            .attr('text-anchor', 'middle')
            .text('← Fines ($) · Arrests (count) →');

        // Legend
        const legend = svg.append('g')
            .attr('class', 'legend-group')
            .attr('transform', `translate(${innerWidth - 10}, -85)`);

        // Fines legend
        legend.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', 16)
            .attr('height', 16)
            .attr('fill', colors.fines)
            .attr('rx', 3);

        legend.append('text')
            .attr('class', 'legend-text legend-text-fines')
            .attr('x', 24)
            .attr('y', 13)
            .style('fill', colors.fines)
            .text('Fines');

        // Arrests legend
        legend.append('rect')
            .attr('x', 0)
            .attr('y', 24)
            .attr('width', 16)
            .attr('height', 16)
            .attr('fill', colors.arrests)
            .attr('rx', 3);

        legend.append('text')
            .attr('class', 'legend-text legend-text-arrests')
            .attr('x', 24)
            .attr('y', 37)
            .style('fill', colors.arrests)
            .text('Arrests');

        // ============================================================
        // DRAW BARS - Each subgroup uses its own y-scale
        // ============================================================
        subgroups.forEach(subgroup => {
            const isFines = subgroup === 'fines';
            const yScale = isFines ? yScaleFines : yScaleArrests;

            svg.selectAll(`.bar-${subgroup}`)
                .data(data)
                .enter()
                .append('rect')
                .attr('class', `bar bar-${subgroup}`)
                .attr('x', d => xScale(d.displayLabel) + xSubgroup(subgroup))
                .attr('y', innerHeight)  // Start from bottom for animation
                .attr('width', xSubgroup.bandwidth())
                .attr('height', 0)       // Start with zero height for animation
                .attr('fill', colors[subgroup])
                .attr('rx', 4)
                .style('cursor', 'pointer')
                .on('mouseenter', function (event, d) {
                    d3.select(this).attr('opacity', 1);
                    const ratio = d.fines > 0 ? (d.arrests / (d.fines / 1000)).toFixed(1) : '0';
                    showTooltip(event, `
                        <div class="tooltip-title">${d.displayLabel}</div>
                        <div class="tooltip-row"><span style="color:${colors.fines};">●</span> Fines: ${formatCurrency(d.fines)}</div>
                        <div class="tooltip-row"><span style="color:${colors.arrests};">●</span> Arrests: ${formatNumber(d.arrests)}</div>
                        <div class="tooltip-row"><span style="color:#6B7280;">◆</span> Charges: ${formatNumber(d.charges)}</div>
                        <div class="tooltip-footer">Ratio: ${ratio} arrests per $1K fines</div>
                    `);
                })
                .on('mousemove', function (event, d) {
                    const ratio = d.fines > 0 ? (d.arrests / (d.fines / 1000)).toFixed(1) : '0';
                    showTooltip(event, `
                        <div class="tooltip-title">${d.displayLabel}</div>
                        <div class="tooltip-row"><span style="color:${colors.fines};">●</span> Fines: ${formatCurrency(d.fines)}</div>
                        <div class="tooltip-row"><span style="color:${colors.arrests};">●</span> Arrests: ${formatNumber(d.arrests)}</div>
                        <div class="tooltip-row"><span style="color:#6B7280;">◆</span> Charges: ${formatNumber(d.charges)}</div>
                        <div class="tooltip-footer">Ratio: ${ratio} arrests per $1K fines</div>
                    `);
                })
                .on('mouseleave', function () {
                    d3.select(this).attr('opacity', 0.85);
                    hideTooltip();
                })
                .transition()
                .duration(500)
                .delay((d, i) => i * 50)  // Stagger animation
                .attr('y', d => yScale(isFines ? d.fines : d.arrests))
                .attr('height', d => innerHeight - yScale(isFines ? d.fines : d.arrests));
        });

        // Data labels above bars
        subgroups.forEach(subgroup => {
            const isFines = subgroup === 'fines';
            const yScale = isFines ? yScaleFines : yScaleArrests;

            svg.selectAll(`.label-${subgroup}`)
                .data(data)
                .enter()
                .append('text')
                .attr('class', `data-label data-label-${subgroup}`)
                .attr('x', d => xScale(d.displayLabel) + xSubgroup(subgroup) + xSubgroup.bandwidth() / 2)
                .attr('y', d => {
                    const value = isFines ? d.fines : d.arrests;
                    return yScale(value) - 6;
                })
                .attr('text-anchor', 'middle')
                .text(d => formatCompact(isFines ? d.fines : d.arrests))
                .style('opacity', 0)
                .transition()
                .duration(550)
                .delay((d, i) => i * 50 + 300)
                .style('opacity', 1);
        });

    }, 50);
}

// ---- FORMATTING HELPERS ----
function formatCurrency(value) {
    if (value === 0) return '$0';
    if (value >= 1e6) return '$' + (value / 1e6).toFixed(1) + 'M';
    if (value >= 1e3) return '$' + (value / 1e3).toFixed(0) + 'K';
    return '$' + value.toLocaleString();
}

function formatNumber(value) {
    if (value === 0) return '0';
    if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M';
    if (value >= 1e3) return (value / 1e3).toFixed(0) + 'K';
    return value.toLocaleString();
}

function formatCompact(value) {
    if (value === 0) return '0';
    if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M';
    if (value >= 1e3) return (value / 1e3).toFixed(0) + 'K';
    return value.toLocaleString();
}