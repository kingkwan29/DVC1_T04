// js/trend.js - Monthly Trend Area Chart
// Shows monthly fine trends over time with area fill + line overlay

/**
 * Renders an area chart showing monthly fine trends
 * 
 * HOW IT WORKS:
 * 1. Uses monthlyData (computed by state.js based on current filters)
 * 2. X-axis: time scale (dates)
 * 3. Y-axis: linear scale (fines amount)
 * 4. Area fill: light blue (#dbeafe) with opacity
 * 5. Line overlay: dark blue (#3b82f6) with 2.5px stroke
 * 6. Interaction: hover line + tooltip showing date and fine amount
 * 
 * CURVE TYPE: d3.curveMonotoneX - smooth but preserves monotonicity
 * (doesn't create false oscillations between data points)
 * 
 * TOOLTIP: Shows date (formatted as "Jan 2024") and fine amount
 */
function renderMonthlyTrend() {
    const container = document.getElementById('trendChart');
    if (!container) return;

    container.innerHTML = '';

    const data = monthlyData;
    if (!data || data.length === 0) {
        container.innerHTML = '<div class="loading-state">No data available</div>';
        return;
    }

    // Set up dimensions
    const margin = { top: 30, right: 30, bottom: 60, left: 70 };
    const rect = container.getBoundingClientRect();
    const width = Math.max(rect.width, 500);
    const height = Math.max(rect.height, 260);
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(container)
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // X scale: time-based (dates)
    const xScale = d3.scaleTime()
        .domain(d3.extent(data, d => d.date))
        .range([0, innerWidth]);

    // Y scale: fines amount, with 10% headroom
    const yMax = d3.max(data, d => d.fines) * 1.1 || 1;
    const yScale = d3.scaleLinear()
        .domain([0, yMax])
        .range([innerHeight, 0])
        .nice();

    // Area generator: fills the space between the line and the x-axis
    // y0 = bottom (innerHeight), y1 = data value
    const area = d3.area()
        .x(d => xScale(d.date))
        .y0(innerHeight)
        .y1(d => yScale(d.fines))
        .curve(d3.curveMonotoneX);  // Smooth but monotonic

    // Line generator: draws the actual trend line
    const line = d3.line()
        .x(d => xScale(d.date))
        .y(d => yScale(d.fines))
        .curve(d3.curveMonotoneX);

    // Draw the filled area (light blue)
    svg.append('path')
        .datum(data)
        .attr('fill', '#dbeafe')
        .attr('opacity', 0.6)
        .attr('d', area);

    // Draw the trend line (dark blue)
    svg.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', '#3b82f6')
        .attr('stroke-width', 2.5)
        .attr('class', 'line-path')
        .attr('d', line);

    // X-axis: shows every 2 years
    svg.append('g')
        .attr('class', 'axis axis-x')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale).ticks(d3.timeYear.every(2)).tickFormat(d3.timeFormat('%b %Y')));

    // Y-axis: format large numbers as K/M, small numbers as-is
    // FIXED: Added handling for values < 1000 to avoid "0K" display
    svg.append('g')
        .attr('class', 'axis axis-y-left')
        .call(d3.axisLeft(yScale).ticks(6).tickFormat(d => {
            if (d >= 1e6) {
                return (d / 1e6).toFixed(1) + 'M';
            } else if (d >= 1e3) {
                return (d / 1e3).toFixed(0) + 'K';
            } else if (d >= 1) {
                return d.toLocaleString();
            } else {
                return '0';
            }
        }));

    // X-axis label
    svg.append('text')
        .attr('class', 'axis-label axis-label-x')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight + 45)
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

    // ============================================================
    // INTERACTION LAYER - Hover line + tooltip
    // ============================================================
    // HOW IT WORKS:
    // 1. Invisible overlay rect captures mouse events
    // 2. On mousemove: finds closest data point using d3.bisector
    // 3. Moves a vertical line and circle to that x position
    // 4. Shows tooltip with date and fine amount
    // 5. On mouseout: hides everything

    const focus = svg.append('g').attr('class', 'focus').style('display', 'none');
    focus.append('line').attr('class', 'hover-line').attr('y1', 0).attr('y2', innerHeight);
    focus.append('circle').attr('r', 5).attr('fill', '#3b82f6').attr('stroke', '#fff');

    // Invisible overlay rect to capture mouse events
    svg.append('rect')
        .attr('width', innerWidth)
        .attr('height', innerHeight)
        .attr('fill', 'none')
        .attr('pointer-events', 'all')
        .on('mouseover', () => focus.style('display', null))
        .on('mouseout', () => { focus.style('display', 'none'); hideTooltip(); })
        .on('mousemove', function (event) {
            // Find the closest data point to mouse position
            // d3.bisector: binary search for efficient lookup
            const bisect = d3.bisector(d => d.date).left;
            const x0 = xScale.invert(d3.pointer(event)[0]);  // Convert pixel to date
            const i = bisect(data, x0, 1);

            // Pick the closer of the two surrounding points
            const d = data[i] && data[i - 1] ?
                (x0 - data[i - 1].date > data[i].date - x0 ? data[i] : data[i - 1]) :
                data[0];

            // Move the hover line and dot to that point
            focus.attr('transform', `translate(${xScale(d.date)}, 0)`);
            showTooltip(event, `
                <div class="tooltip-title">${d3.timeFormat('%b %Y')(d.date)}</div>
                <div class="tooltip-value">$${d.fines.toLocaleString()}</div>
            `);
        });
}