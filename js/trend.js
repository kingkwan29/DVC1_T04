// js/trend.js - Monthly Trend Area Chart
function renderMonthlyTrend() {
    const container = document.getElementById('trendChart');
    if (!container) return;
    container.innerHTML = '';

    const data = monthlyData;
    if (!data || data.length === 0) {
        container.innerHTML = '<div class="loading-state">No data for selected filters</div>';
        return;
    }

    const margin = { top: 30, right: 30, bottom: 50, left: 70 };
    const rect = container.getBoundingClientRect();
    const width = Math.max(rect.width - 40, 500);
    const height = Math.max(rect.height - 40, 260);
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(container)
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleTime().domain(d3.extent(data, d => d.date)).range([0, innerWidth]);
    const yMax = d3.max(data, d => d.fines) * 1.05 || 1;
    const yScale = d3.scaleLinear().domain([0, yMax]).range([innerHeight, 0]).nice();

    // Line generator
    const line = d3.line().x(d => xScale(d.date)).y(d => yScale(d.fines)).curve(d3.curveMonotoneX);

    // Area & Line Path
    svg.append('path').datum(data).attr('fill', '#dbeafe').attr('opacity', 0.5).attr('d', d3.area().x(d => xScale(d.date)).y0(innerHeight).y1(d => yScale(d.fines)).curve(d3.curveMonotoneX));
    svg.append('path').datum(data).attr('fill', 'none').attr('stroke', '#3b82f6').attr('stroke-width', 2.5).attr('d', line);

    // X & Y Axis
    svg.append('g').attr('transform', `translate(0,${innerHeight})`).call(d3.axisBottom(xScale).ticks(d3.timeYear.every(2)).tickFormat(d3.timeFormat('%b %Y')));
    svg.append('g').call(d3.axisLeft(yScale).ticks(6).tickFormat(d => d >= 1e6 ? (d / 1e6).toFixed(1) + 'M' : (d / 1e3).toFixed(0) + 'K'));

    // --- INTERACTIVE VERTICAL RULER ---
    const focus = svg.append('g').attr('class', 'focus').style('display', 'none');

    // Vertical line
    focus.append('line').attr('class', 'hover-line').attr('y1', 0).attr('y2', innerHeight).attr('stroke', '#3b82f6').attr('stroke-width', 1).attr('stroke-dasharray', '3 3');
    // Circle at intersection
    focus.append('circle').attr('r', 5).attr('fill', '#3b82f6').attr('stroke', '#fff');

    // Overlay to capture mouse events
    svg.append('rect')
        .attr('width', innerWidth)
        .attr('height', innerHeight)
        .attr('fill', 'none')
        .attr('pointer-events', 'all')
        .on('mouseover', () => focus.style('display', null))
        .on('mouseout', () => { focus.style('display', 'none'); hideTooltip(); })
        .on('mousemove', function (event) {
            const bisect = d3.bisector(d => d.date).left;
            const x0 = xScale.invert(d3.pointer(event)[0]);
            const i = bisect(data, x0, 1);
            const d = data[i] && data[i - 1] ? (x0 - data[i - 1].date > data[i].date - x0 ? data[i] : data[i - 1]) : data[0];

            focus.attr('transform', `translate(${xScale(d.date)}, 0)`);
            showTooltip(event, `
                <div class="tooltip-title">${d3.timeFormat('%b %Y')(d.date)}</div>
                <div class="tooltip-value">$${d.fines.toLocaleString()}</div>
            `);
        });
}