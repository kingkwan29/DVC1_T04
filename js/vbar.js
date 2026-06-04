// js/vbar.js - All inline styles moved to chart.css

function renderVBarChart() {
    const container = document.getElementById('vbarChart');
    if (!container) return;

    container.innerHTML = '';

    const noticeDiv = container.querySelector('.vbar-notice');
    if (!noticeDiv) {
        const div = document.createElement('div');
        div.className = 'vbar-notice';
        div.textContent = 'Jurisdiction view currently displays aggregate data across all detection methods.';
        container.appendChild(div);
    }

    if (!geoData || geoData.length === 0) {
        container.innerHTML = '<div class="loading-state">Loading data...</div>';
        return;
    }

    let filtered = applyJurisdictionFilter(geoData);
    const sorted = [...filtered].sort((a, b) => b.fines - a.fines);

    if (!sorted.length) {
        container.innerHTML = '<div class="no-data-state">No data available</div>';
        return;
    }

    setTimeout(() => {
        const rect = container.getBoundingClientRect();
        const width = Math.max(rect.width - 40, 800);
        const height = Math.max(rect.height - 40, 480);

        const margin = { top: 30, right: 100, bottom: 100, left: 70 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        const existingSvg = container.querySelector('svg');
        if (existingSvg) existingSvg.remove();

        const svg = d3.select(container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${width} ${height}`)
            .style('overflow', 'visible')
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const yScale = d3.scaleBand()
            .domain(sorted.map(d => d.jurisdiction))
            .range([0, innerHeight])
            .padding(0.35);

        const bandHeight = yScale.bandwidth();

        const maxFines = d3.max(sorted, d => d.fines);
        const maxArrests = d3.max(sorted, d => d.arrests);

        const halfWidth = innerWidth / 2;

        const xFinesScale = d3.scaleLinear()
            .domain([0, maxFines * 1.1])
            .range([0, halfWidth])
            .nice();

        const xArrestsScale = d3.scaleLinear()
            .domain([0, maxArrests * 1.3])
            .range([0, halfWidth])
            .nice();

        const centerX = halfWidth;

        // Legend Group
        const legendGroup = svg.append('g')
            .attr('class', 'legend-group')
            .attr('transform', `translate(${innerWidth - 140}, -15)`);

        legendGroup.append('rect')
            .attr('x', 0).attr('y', 0).attr('width', 12).attr('height', 12)
            .attr('fill', '#1e40af');

        legendGroup.append('text')
            .attr('x', 16).attr('y', 10)
            .text('Fines (w/ arrests)');

        legendGroup.append('rect')
            .attr('x', 0).attr('y', 18).attr('width', 12).attr('height', 12)
            .attr('fill', '#8B5CF6');

        legendGroup.append('text')
            .attr('x', 16).attr('y', 28)
            .text('Fines (no arrests)');

        legendGroup.append('rect')
            .attr('x', 0).attr('y', 36).attr('width', 12).attr('height', 12)
            .attr('fill', '#b91c1c');

        legendGroup.append('text')
            .attr('x', 16).attr('y', 46)
            .text('Arrests');

        // Grid lines
        svg.append('g')
            .attr('class', 'grid-lines')
            .call(d3.axisTop(xFinesScale).ticks(6).tickSize(-innerHeight).tickFormat(''))
            .select('.domain').remove();

        // Top Axis (Fines)
        const leftAxisGroup = svg.append('g')
            .attr('class', 'axis axis-top-fines')
            .attr('transform', `translate(0, -10)`);

        leftAxisGroup.call(d3.axisTop(xFinesScale).ticks(6)
            .tickFormat(d => {
                if (d >= 1e6) return (d / 1e6).toFixed(1) + 'M';
                if (d >= 1e3) return (d / 1e3).toFixed(0) + 'K';
                return d;
            }));

        // Fines label
        svg.append('text')
            .attr('class', 'axis-label-fines')
            .attr('x', halfWidth / 2)
            .attr('y', -40)
            .text('Fines ($)');

        // Bottom Axis (Arrests)
        const rightAxisGroup = svg.append('g')
            .attr('class', 'axis axis-bottom-arrests')
            .attr('transform', `translate(${centerX}, ${innerHeight + 10})`);

        rightAxisGroup.call(d3.axisBottom(xArrestsScale).ticks(6)
            .tickFormat(d => d.toLocaleString()));

        // Arrests label
        svg.append('text')
            .attr('class', 'axis-label-arrests')
            .attr('x', centerX + halfWidth / 2)
            .attr('y', innerHeight + 50)
            .text('Arrests (count)');

        // Left Axis (Jurisdiction)
        svg.append('g')
            .attr('class', 'axis axis-left-jurisdiction')
            .call(d3.axisLeft(yScale));

        // Center line
        svg.append('line')
            .attr('class', 'center-line')
            .attr('x1', centerX).attr('y1', 0)
            .attr('x2', centerX).attr('y2', innerHeight);

        // Fines bars
        svg.selectAll('.bar-fines')
            .data(sorted)
            .enter()
            .append('rect')
            .attr('class', 'bar-fines')
            .attr('y', d => yScale(d.jurisdiction))
            .attr('x', d => centerX - xFinesScale(d.fines))
            .attr('height', bandHeight)
            .attr('width', 0)
            .attr('fill', d => d.arrests === 0 ? '#8B5CF6' : '#1e40af')
            .attr('data-has-arrests', d => d.arrests !== 0)
            .style('cursor', 'pointer')
            .on('mouseenter', function (event, d) {
                d3.select(this).attr('opacity', 1);
                const ratio = d.arrests === 0 ? 'No arrests' : (d.arrests / (d.fines / 1e6)).toFixed(1) + ' arrests per $1M fine';
                showTooltip(event, `
                    <div class="tooltip-title">${d.jurisdiction}</div>
                    <div class="tooltip-row">Fines: $${d.fines.toLocaleString()}</div>
                    <div class="tooltip-row">Arrests: ${d.arrests === 0 ? '0' : d.arrests.toLocaleString()}</div>
                    <div class="tooltip-row">Charges: ${d.charges.toLocaleString()}</div>
                    <div class="tooltip-footer">Ratio: ${ratio}</div>
                `);
            })
            .on('mousemove', function (event, d) {
                const ratio = d.arrests === 0 ? 'No arrests' : (d.arrests / (d.fines / 1e6)).toFixed(1) + ' arrests per $1M fine';
                showTooltip(event, `
                    <div class="tooltip-title">${d.jurisdiction}</div>
                    <div class="tooltip-row">Fines: $${d.fines.toLocaleString()}</div>
                    <div class="tooltip-row">Arrests: ${d.arrests === 0 ? '0' : d.arrests.toLocaleString()}</div>
                    <div class="tooltip-row">Charges: ${d.charges.toLocaleString()}</div>
                    <div class="tooltip-footer">Ratio: ${ratio}</div>
                `);
            })
            .on('mouseleave', function () {
                d3.select(this).attr('opacity', d => d.arrests === 0 ? 0.7 : 0.85);
                hideTooltip();
            })
            .transition()
            .duration(500)
            .attr('width', d => xFinesScale(d.fines));

        // Fines data labels
        svg.selectAll('.label-fines')
            .data(sorted)
            .enter()
            .append('text')
            .attr('class', 'label-fines')
            .attr('data-has-arrests', d => d.arrests !== 0)
            .attr('x', d => centerX - xFinesScale(d.fines) - 5)
            .attr('y', d => yScale(d.jurisdiction) + bandHeight / 2 + 4)
            .text(d => {
                if (d.fines >= 1e6) return (d.fines / 1e6).toFixed(1) + 'M';
                if (d.fines >= 1e3) return (d.fines / 1e3).toFixed(0) + 'K';
                return d.fines;
            })
            .style('opacity', 0)
            .transition()
            .duration(550)
            .style('opacity', 1);

        // Arrests bars
        svg.selectAll('.bar-arrests')
            .data(sorted)
            .enter()
            .append('rect')
            .attr('class', 'bar-arrests')
            .attr('y', d => yScale(d.jurisdiction))
            .attr('x', centerX)
            .attr('height', bandHeight)
            .attr('width', 0)
            .attr('fill', d => d.arrests === 0 ? '#e2e8f0' : '#b91c1c')
            .attr('data-has-arrests', d => d.arrests !== 0)
            .style('cursor', 'pointer')
            .on('mouseenter', function (event, d) {
                d3.select(this).attr('opacity', 1);
                const ratio = d.arrests === 0 ? 'No arrests' : (d.arrests / (d.fines / 1e6)).toFixed(1) + ' arrests per $1M fine';
                showTooltip(event, `
                    <div class="tooltip-title">${d.jurisdiction}</div>
                    <div class="tooltip-row">Fines: $${d.fines.toLocaleString()}</div>
                    <div class="tooltip-row">Arrests: ${d.arrests === 0 ? '0' : d.arrests.toLocaleString()}</div>
                    <div class="tooltip-row">Charges: ${d.charges.toLocaleString()}</div>
                    <div class="tooltip-footer">Ratio: ${ratio}</div>
                `);
            })
            .on('mousemove', function (event, d) {
                const ratio = d.arrests === 0 ? 'No arrests' : (d.arrests / (d.fines / 1e6)).toFixed(1) + ' arrests per $1M fine';
                showTooltip(event, `
                    <div class="tooltip-title">${d.jurisdiction}</div>
                    <div class="tooltip-row">Fines: $${d.fines.toLocaleString()}</div>
                    <div class="tooltip-row">Arrests: ${d.arrests === 0 ? '0' : d.arrests.toLocaleString()}</div>
                    <div class="tooltip-row">Charges: ${d.charges.toLocaleString()}</div>
                    <div class="tooltip-footer">Ratio: ${ratio}</div>
                `);
            })
            .on('mouseleave', function () {
                d3.select(this).attr('opacity', d => d.arrests === 0 ? 0.6 : 0.85);
                hideTooltip();
            })
            .transition()
            .duration(500)
            .attr('width', d => xArrestsScale(d.arrests));

        // Arrests data labels
        svg.selectAll('.label-arrests')
            .data(sorted.filter(d => d.arrests > 0))
            .enter()
            .append('text')
            .attr('class', 'label-arrests')
            .attr('x', d => centerX + xArrestsScale(d.arrests) + 5)
            .attr('y', d => yScale(d.jurisdiction) + bandHeight / 2 + 4)
            .text(d => d.arrests.toLocaleString())
            .style('opacity', 0)
            .transition()
            .duration(550)
            .style('opacity', 1);

        // Chart notes
        svg.append('text')
            .attr('class', 'chart-note')
            .attr('x', 0)
            .attr('y', innerHeight + 55)
            .text('Note: Fines and arrests use independent scales.');

        svg.append('text')
            .attr('class', 'chart-note')
            .attr('x', 0)
            .attr('y', innerHeight + 70)
            .text('Source: BITRE · Enforcement Statistics Annual Report');

    }, 50);
}