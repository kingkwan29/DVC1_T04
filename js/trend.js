// js/trend.js
// Monthly Trend Area Chart

function renderMonthlyTrend() {
    const container = document.getElementById('trendChart');
    if (!container) return;

    container.innerHTML = '';

    if (!monthlyData || monthlyData.length === 0) {
        container.innerHTML = '<div class="loading-state">Loading data...</div>';
        return;
    }

    const noteDiv = document.createElement('div');
    noteDiv.className = 'trend-note';
    noteDiv.textContent = '*Note: Data for 2008-2022 represents annual January snapshots only.';
    if (!container.querySelector('.trend-note')) {
        container.style.position = 'relative';
        container.appendChild(noteDiv);
    }

    setTimeout(() => {
        const rect = container.getBoundingClientRect();
        const width = Math.max(rect.width - 40, 500);
        const height = Math.max(rect.height - 40, 260);

        const margin = { top: 30, right: 30, bottom: 50, left: 70 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        const existingSvg = container.querySelector('svg');
        if (existingSvg) existingSvg.remove();

        const svg = d3.select(container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${width} ${height}`)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const xScale = d3.scaleTime()
            .domain(d3.extent(monthlyData, d => d.date))
            .range([0, innerWidth]);

        const yMax = d3.max(monthlyData, d => d.fines) * 1.05;
        const yScale = d3.scaleLinear()
            .domain([0, yMax])
            .range([innerHeight, 0])
            .nice();

        // Grid lines
        svg.append('g')
            .attr('class', 'grid-lines')
            .call(d3.axisLeft(yScale).ticks(6).tickSize(-innerWidth).tickFormat(''))
            .select('.domain').remove();

        // Area
        const area = d3.area()
            .x(d => xScale(d.date))
            .y0(yScale(0))
            .y1(d => yScale(d.fines));

        svg.append('path')
            .datum(monthlyData)
            .attr('class', 'area-path')
            .attr('fill', COLORS.finesLight)
            .attr('d', area);

        // Line
        const line = d3.line()
            .x(d => xScale(d.date))
            .y(d => yScale(d.fines));

        svg.append('path')
            .datum(monthlyData)
            .attr('class', 'line-path')
            .attr('fill', 'none')
            .attr('stroke', COLORS.fines)
            .attr('stroke-width', 2.5)
            .attr('d', line);

        // X-axis
        svg.append('g')
            .attr('class', 'axis axis-x')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale).ticks(8).tickFormat(d3.timeFormat('%b %Y')));

        // Y-axis
        svg.append('g')
            .attr('class', 'axis axis-y-left')
            .call(d3.axisLeft(yScale).ticks(6).tickFormat(d => d >= 1e6 ? (d / 1e6).toFixed(1) + 'M' : d));

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
            .data(monthlyData)
            .enter()
            .append('circle')
            .attr('class', 'trend-dot')
            .attr('cx', d => xScale(d.date))
            .attr('cy', d => yScale(d.fines))
            .attr('r', 5)
            .attr('fill', COLORS.fines)
            .attr('stroke', 'white')
            .attr('stroke-width', 2)
            .style('cursor', 'pointer')
            .on('mouseenter', function (event, d) {
                d3.select(this).attr('r', 8);
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
                d3.select(this).attr('r', 5);
                hideTooltip();
            });

    }, 50);
}