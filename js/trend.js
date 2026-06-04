// js/trend.js - Monthly Trend Area Chart
// All inline styles moved to chart.css

function renderMonthlyTrend() {
    const container = document.getElementById('trendChart');
    if (!container) return;

    container.innerHTML = '';

    const data = monthlyData;

    if (!data || data.length === 0) {
        container.innerHTML = '<div class="loading-state">No data for selected filters</div>';
        return;
    }

    // Build note text showing active filters
    const activeFilters = [];
    if (state.jurisdiction !== 'all') activeFilters.push(state.jurisdiction);
    if (state.age !== 'all') activeFilters.push(state.age);
    if (state.method !== 'all') activeFilters.push(state.method);

    const noteDiv = document.createElement('div');
    noteDiv.className = 'trend-note';
    noteDiv.textContent = activeFilters.length > 0
        ? 'Filtered: ' + activeFilters.join(' / ')
        : '*Note: 2008-2022 are annual January snapshots only.';
    container.style.position = 'relative';
    container.appendChild(noteDiv);

    const rect = container.getBoundingClientRect();
    const width = Math.max(rect.width - 40, 500);
    const height = Math.max(rect.height - 40, 260);

    const margin = { top: 30, right: 30, bottom: 50, left: 70 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(container)
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleTime()
        .domain(d3.extent(data, d => d.date))
        .range([0, innerWidth]);

    const yMax = d3.max(data, d => d.fines) * 1.05 || 1;
    const yScale = d3.scaleLinear()
        .domain([0, yMax])
        .range([innerHeight, 0])
        .nice();

    // Gradient definition
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
        .attr('id', 'areaGradient')
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '0%')
        .attr('y2', '100%');
    gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', '#3b82f6')
        .attr('stop-opacity', 0.25);
    gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', '#3b82f6')
        .attr('stop-opacity', 0.02);

    // Grid lines
    svg.append('g')
        .attr('class', 'grid-lines')
        .call(d3.axisLeft(yScale)
            .ticks(6)
            .tickSize(-innerWidth)
            .tickFormat(''))
        .select('.domain').remove();

    // Area
    const area = d3.area()
        .x(d => xScale(d.date))
        .y0(yScale(0))
        .y1(d => yScale(d.fines))
        .curve(d3.curveMonotoneX);

    svg.append('path')
        .datum(data)
        .attr('class', 'area-path')
        .attr('fill', 'url(#areaGradient)')
        .attr('d', area);

    // Line
    const line = d3.line()
        .x(d => xScale(d.date))
        .y(d => yScale(d.fines))
        .curve(d3.curveMonotoneX);

    svg.append('path')
        .datum(data)
        .attr('class', 'line-path')
        .attr('fill', 'none')
        .attr('stroke', '#3b82f6')
        .attr('stroke-width', 2.5)
        .attr('d', line);

    // X-axis
    svg.append('g')
        .attr('class', 'axis axis-x')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale)
            .ticks(8)
            .tickFormat(d3.timeFormat('%b %Y')));

    // Y-axis
    svg.append('g')
        .attr('class', 'axis axis-y-left')
        .call(d3.axisLeft(yScale)
            .ticks(6)
            .tickFormat(d => d >= 1e6 ? (d / 1e6).toFixed(1) + 'M' : d >= 1e3 ? (d / 1e3).toFixed(0) + 'K' : d));

    // X-axis label
    svg.append('text')
        .attr('class', 'axis-label axis-label-x')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight + 38)
        .attr('text-anchor', 'middle')
        .text('Year');

    // Y-axis label
    svg.append('text')
        .attr('class', 'axis-label axis-label-y')
        .attr('x', -innerHeight / 2)
        .attr('y', -50)
        .attr('text-anchor', 'middle')
        .attr('transform', 'rotate(-90)')
        .text('Total Fines ($)');

    // Data dots
    svg.selectAll('.trend-dot')
        .data(data)
        .enter()
        .append('circle')
        .attr('class', 'trend-dot')
        .attr('cx', d => xScale(d.date))
        .attr('cy', d => yScale(d.fines))
        .attr('r', 4)
        .attr('fill', '#3b82f6')
        .attr('stroke', 'white')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('mouseenter', function (event, d) {
            d3.select(this).attr('r', 7);
            showTooltip(event, `
                <div class="tooltip-title">${d3.timeFormat('%b %Y')(d.date)}</div>
                <div class="tooltip-value">$${d.fines.toLocaleString()}</div>
            `);
        })
        .on('mousemove', function (event, d) {
            showTooltip(event, `
                <div class="tooltip-title">${d3.timeFormat('%b %Y')(d.date)}</div>
                <div class="tooltip-value">$${d.fines.toLocaleString()}</div>
            `);
        })
        .on('mouseleave', function () {
            d3.select(this).attr('r', 4);
            hideTooltip();
        });

    // Transition reference line - only show when no filters active
    const noFilters = state.jurisdiction === 'all' && state.age === 'all' && state.method === 'all';
    if (noFilters) {
        const transitionDate = new Date(2023, 0, 1);
        if (xScale(transitionDate) >= 0 && xScale(transitionDate) <= innerWidth) {
            svg.append('line')
                .attr('class', 'transition-line')
                .attr('x1', xScale(transitionDate))
                .attr('x2', xScale(transitionDate))
                .attr('y1', 0)
                .attr('y2', innerHeight);

            svg.append('text')
                .attr('class', 'transition-label')
                .attr('x', xScale(transitionDate) + 6)
                .attr('y', 12)
                .text('Monthly data starts');
        }
    }
}