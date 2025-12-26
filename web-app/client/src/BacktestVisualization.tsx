import * as d3 from 'd3';
import { useEffect, useRef, useState } from 'react';
import type { Graph } from './types';
import './BacktestVisualization.css';

interface BacktestVisualizationProps {
  data: Graph;
}

export function BacktestVisualization({ data }: BacktestVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Handle resize
  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: 600,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    if (data.tickerPlot.y.length === 0 || data.algorithmPlot.y.length === 0) return;
    if (dimensions.width === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const container = containerRef.current;
    const width = dimensions.width || container.clientWidth;
    const height = dimensions.height || 600;
    const margin = { top: 60, right: 80, bottom: 80, left: 100 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.attr('width', width).attr('height', height);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Prepare data
    const { tickerPlot, algorithmPlot, timestamps } = data;
    const dataPoints = tickerPlot.y.map((y, i) => ({
      timestamp: timestamps[i],
      tickerValue: y,
      algorithmValue: algorithmPlot.y[i],
      index: i,
    }));

    // Scales
    const xScale = d3
      .scaleLinear()
      .domain([0, dataPoints.length - 1])
      .range([0, innerWidth]);

    const allValues = [
      ...tickerPlot.y,
      ...algorithmPlot.y,
    ];
    const yMin = d3.min(allValues)!;
    const yMax = d3.max(allValues)!;
    const yPadding = (yMax - yMin) * 0.1;

    const yScale = d3
      .scaleLinear()
      .domain([yMin - yPadding, yMax + yPadding])
      .range([innerHeight, 0]);

    // Line generators
    const tickerLine = d3
      .line<typeof dataPoints[0]>()
      .x((d) => xScale(d.index))
      .y((d) => yScale(d.tickerValue))
      .curve(d3.curveMonotoneX);

    const algorithmLine = d3
      .line<typeof dataPoints[0]>()
      .x((d) => xScale(d.index))
      .y((d) => yScale(d.algorithmValue))
      .curve(d3.curveMonotoneX);

    // Create gradient definitions
    const defs = svg.append('defs');

    // Ticker gradient
    const tickerGradient = defs
      .append('linearGradient')
      .attr('id', 'ticker-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    tickerGradient.append('stop').attr('offset', '0%').attr('stop-color', '#3b82f6').attr('stop-opacity', 0.3);
    tickerGradient.append('stop').attr('offset', '100%').attr('stop-color', '#3b82f6').attr('stop-opacity', 0);

    // Algorithm gradient
    const algorithmGradient = defs
      .append('linearGradient')
      .attr('id', 'algorithm-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    algorithmGradient.append('stop').attr('offset', '0%').attr('stop-color', '#10b981').attr('stop-opacity', 0.3);
    algorithmGradient.append('stop').attr('offset', '100%').attr('stop-color', '#10b981').attr('stop-opacity', 0);

    // Grid lines
    const xAxisGrid = d3
      .axisBottom(xScale)
      .ticks(10)
      .tickSize(-innerHeight)
      .tickFormat(() => '');
    const yAxisGrid = d3
      .axisLeft(yScale)
      .ticks(10)
      .tickSize(-innerWidth)
      .tickFormat(() => '');

    g.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxisGrid)
      .attr('stroke', 'rgba(255, 255, 255, 0.1)')
      .attr('stroke-width', 1);

    g.append('g')
      .attr('class', 'grid')
      .call(yAxisGrid)
      .attr('stroke', 'rgba(255, 255, 255, 0.1)')
      .attr('stroke-width', 1);

    // Area under curves
    const tickerArea = d3
      .area<typeof dataPoints[0]>()
      .x((d) => xScale(d.index))
      .y0(innerHeight)
      .y1((d) => yScale(d.tickerValue))
      .curve(d3.curveMonotoneX);

    const algorithmArea = d3
      .area<typeof dataPoints[0]>()
      .x((d) => xScale(d.index))
      .y0(innerHeight)
      .y1((d) => yScale(d.algorithmValue))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(dataPoints)
      .attr('fill', 'url(#ticker-gradient)')
      .attr('d', tickerArea)
      .attr('opacity', 0)
      .transition()
      .duration(1000)
      .attr('opacity', 1);

    g.append('path')
      .datum(dataPoints)
      .attr('fill', 'url(#algorithm-gradient)')
      .attr('d', algorithmArea)
      .attr('opacity', 0)
      .transition()
      .duration(1000)
      .attr('opacity', 1);

    // Draw lines
    g.append('path')
      .datum(dataPoints)
      .attr('fill', 'none')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2.5)
      .attr('d', tickerLine)
      .attr('opacity', 0)
      .transition()
      .duration(1200)
      .attr('opacity', 1);

    g.append('path')
      .datum(dataPoints)
      .attr('fill', 'none')
      .attr('stroke', '#10b981')
      .attr('stroke-width', 2.5)
      .attr('d', algorithmLine)
      .attr('opacity', 0)
      .transition()
      .duration(1200)
      .delay(200)
      .attr('opacity', 1);

    // Axes
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(10)
      .tickFormat((d) => {
        const index = Math.round(Number(d));
        if (index >= 0 && index < timestamps.length) {
          const date = new Date(timestamps[index]);
          return d3.timeFormat('%m/%d')(date);
        }
        return '';
      });

    const yAxis = d3.axisLeft(yScale).ticks(10).tickFormat(d3.format('$,.0f'));

    g.append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .attr('color', 'rgba(255, 255, 255, 0.7)')
      .selectAll('text')
      .attr('fill', 'rgba(255, 255, 255, 0.7)')
      .style('font-size', '12px');

    g.append('g')
      .attr('class', 'axis')
      .call(yAxis)
      .attr('color', 'rgba(255, 255, 255, 0.7)')
      .selectAll('text')
      .attr('fill', 'rgba(255, 255, 255, 0.7)')
      .style('font-size', '12px');

    // Axis labels
    g.append('text')
      .attr('class', 'axis-label')
      .attr('transform', `translate(${innerWidth / 2}, ${innerHeight + 50})`)
      .style('text-anchor', 'middle')
      .style('fill', 'rgba(255, 255, 255, 0.8)')
      .style('font-size', '14px')
      .style('font-weight', '500')
      .text('Time');

    g.append('text')
      .attr('class', 'axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('y', -60)
      .attr('x', -innerHeight / 2)
      .style('text-anchor', 'middle')
      .style('fill', 'rgba(255, 255, 255, 0.8)')
      .style('font-size', '14px')
      .style('font-weight', '500')
      .text('Portfolio Value ($)');

    // Legend
    const legend = g.append('g').attr('class', 'legend').attr('transform', `translate(${innerWidth - 200}, 20)`);

    const legendItems = [
      { color: '#3b82f6', label: tickerPlot.name },
      { color: '#10b981', label: algorithmPlot.name },
    ];

    legendItems.forEach((item, i) => {
      const legendItem = legend.append('g').attr('transform', `translate(0, ${i * 25})`);

      legendItem
        .append('line')
        .attr('x1', 0)
        .attr('x2', 30)
        .attr('y1', 0)
        .attr('y2', 0)
        .attr('stroke', item.color)
        .attr('stroke-width', 3);

      legendItem
        .append('text')
        .attr('x', 40)
        .attr('y', 5)
        .style('fill', 'rgba(255, 255, 255, 0.9)')
        .style('font-size', '13px')
        .style('font-weight', '500')
        .text(item.label);
    });

    // Tooltip
    const tooltip = d3
      .select('body')
      .append('div')
      .attr('class', 'backtest-tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('pointer-events', 'none');

    // Interactive overlay for hover
    const overlay = g
      .append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair');

    // Hover line
    const hoverLine = g
      .append('line')
      .attr('class', 'hover-line')
      .attr('stroke', 'rgba(255, 255, 255, 0.5)')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '5,5')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .style('opacity', 0);

    overlay.on('mousemove', function (event) {
      const [mouseX] = d3.pointer(event);
      const index = Math.round(xScale.invert(mouseX));
      if (index >= 0 && index < dataPoints.length) {
        const point = dataPoints[index];
        hoverLine.attr('x1', xScale(index)).attr('x2', xScale(index)).style('opacity', 1);

        const tickerReturn = ((point.tickerValue - dataPoints[0].tickerValue) / dataPoints[0].tickerValue) * 100;
        const algorithmReturn = ((point.algorithmValue - dataPoints[0].algorithmValue) / dataPoints[0].algorithmValue) * 100;

        tooltip
          .style('opacity', 1)
          .html(`
            <div style="font-weight: 600; margin-bottom: 8px; font-size: 14px;">${new Date(point.timestamp).toLocaleDateString()}</div>
            <div style="margin-bottom: 4px;">
              <span style="color: #3b82f6; font-weight: 500;">${tickerPlot.name}:</span>
              <span style="margin-left: 8px;">$${point.tickerValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span style="margin-left: 8px; color: ${tickerReturn >= 0 ? '#10b981' : '#ef4444'};">
                (${tickerReturn >= 0 ? '+' : ''}${tickerReturn.toFixed(2)}%)
              </span>
            </div>
            <div>
              <span style="color: #10b981; font-weight: 500;">${algorithmPlot.name}:</span>
              <span style="margin-left: 8px;">$${point.algorithmValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span style="margin-left: 8px; color: ${algorithmReturn >= 0 ? '#10b981' : '#ef4444'};">
                (${algorithmReturn >= 0 ? '+' : ''}${algorithmReturn.toFixed(2)}%)
              </span>
            </div>
          `)
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 10}px`);
      }
    });

    overlay.on('mouseleave', () => {
      hoverLine.style('opacity', 0);
      tooltip.style('opacity', 0);
    });

    // Cleanup
    return () => {
      tooltip.remove();
    };
  }, [data, dimensions]);

  // Calculate performance metrics
  const initialTickerValue = data.tickerPlot.y[0];
  const finalTickerValue = data.tickerPlot.y[data.tickerPlot.y.length - 1];
  const tickerReturn = ((finalTickerValue - initialTickerValue) / initialTickerValue) * 100;

  const initialAlgorithmValue = data.algorithmPlot.y[0];
  const finalAlgorithmValue = data.algorithmPlot.y[data.algorithmPlot.y.length - 1];
  const algorithmReturn = ((finalAlgorithmValue - initialAlgorithmValue) / initialAlgorithmValue) * 100;

  const outperformance = algorithmReturn - tickerReturn;

  return (
    <div className="backtest-visualization" ref={containerRef}>
      <div className="backtest-header">
        <h1 className="backtest-title">{data.algorithmName}</h1>
        <div className="backtest-subtitle">Backtesting Performance Analysis</div>
      </div>

      <div className="backtest-content">
        <div className="backtest-chart-container">
          <svg ref={svgRef} className="backtest-chart" />
        </div>

        <div className="backtest-stats">
          <div className="stat-card stat-card-primary">
            <div className="stat-label">Algorithm Return</div>
            <div className={`stat-value ${algorithmReturn >= 0 ? 'stat-positive' : 'stat-negative'}`}>
              {algorithmReturn >= 0 ? '+' : ''}
              {algorithmReturn.toFixed(2)}%
            </div>
            <div className="stat-amount">${finalAlgorithmValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">{data.tickerPlot.name} Return</div>
            <div className={`stat-value ${tickerReturn >= 0 ? 'stat-positive' : 'stat-negative'}`}>
              {tickerReturn >= 0 ? '+' : ''}
              {tickerReturn.toFixed(2)}%
            </div>
            <div className="stat-amount">${finalTickerValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>

          <div className="stat-card stat-card-accent">
            <div className="stat-label">Outperformance</div>
            <div className={`stat-value ${outperformance >= 0 ? 'stat-positive' : 'stat-negative'}`}>
              {outperformance >= 0 ? '+' : ''}
              {outperformance.toFixed(2)}%
            </div>
            <div className="stat-subtext">
              {outperformance >= 0 ? 'Algorithm outperformed' : 'Algorithm underperformed'} benchmark
            </div>
          </div>
        </div>

        <div className="backtest-description">
          <h3 className="description-title">Performance Metrics</h3>
          <div className="description-list">
            {data.description.map((metric, index) => (
              <div key={index} className="description-item">
                {metric}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

