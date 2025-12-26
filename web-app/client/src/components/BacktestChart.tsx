import * as d3 from 'd3';
import { useEffect, useRef, useState } from 'react';
import '../styles/BacktestChart.css';
import type { Graph } from '../types';

// Format timestamp string to YYYY-MM-DD HH:mm:ss with 12-hour format
function formatTimestamp(timestamp: string): string {
  try {
    // Parse timestamp - handle both ISO and YYYY-MM-DD HH:mm:ss formats
    let date: Date;
    if (timestamp.includes('T')) {
      date = new Date(timestamp);
    } else {
      // Replace space with T for ISO parsing
      date = new Date(timestamp.replace(' ', 'T'));
    }

    if (isNaN(date.getTime())) {
      return timestamp; // Return as-is if parsing fails
    }

    // Format as YYYY-MM-DD with 12-hour time format
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    // Convert to 12-hour format
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    const hours12 = String(hours);

    return `${year}-${month}-${day} ${hours12}:${minutes}:${seconds} ${ampm}`;
  } catch {
    return timestamp; // Return as-is if parsing fails
  }
}

interface BacktestChartProps {
  data: Graph;
  onResetZoom?: () => void;
}

export function BacktestChart({ data, onResetZoom }: BacktestChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null);
  const isBrushingRef = useRef(false);

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
    const width = dimensions.width ?? container.clientWidth;
    const height = dimensions.height ?? 600;
    const margin = { top: 60, right: 80, bottom: 80, left: 100 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.attr('width', width).attr('height', height);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Prepare data
    const { tickerPlot, algorithmPlot, timestamps } = data;
    const dataPoints = tickerPlot.y.map((y, i) => ({
      timestamp: timestamps[i],
      tickerValue: y,
      algorithmValue: algorithmPlot.y[i],
      index: i,
    }));

    // Original domain for reset
    const originalXDomain: [number, number] = [0, dataPoints.length - 1];
    const currentXDomain = zoomDomain ?? originalXDomain;

    // Get visible data points for y-scale calculation and drawing
    const startIndex = Math.max(0, Math.floor(currentXDomain[0]));
    const endIndex = Math.min(dataPoints.length - 1, Math.ceil(currentXDomain[1]));
    const visibleDataPoints = dataPoints.slice(startIndex, endIndex + 1);

    // Scales
    const xScale = d3.scaleLinear().domain(currentXDomain).range([0, innerWidth]);

    // Calculate y-scale based on visible data points only
    const visibleTickerValues = visibleDataPoints.map((d) => d.tickerValue);
    const visibleAlgorithmValues = visibleDataPoints.map((d) => d.algorithmValue);
    const allVisibleValues = [...visibleTickerValues, ...visibleAlgorithmValues];

    const yMin = d3.min(allVisibleValues)!;
    const yMax = d3.max(allVisibleValues)!;
    const yPadding = (yMax - yMin) * 0.1;

    const yScale = d3
      .scaleLinear()
      .domain([yMin - yPadding, yMax + yPadding])
      .range([innerHeight, 0]);

    // Line generators - use only visible data points to prevent overflow
    const tickerLine = d3
      .line<(typeof dataPoints)[0]>()
      .x((d) => xScale(d.index))
      .y((d) => yScale(d.tickerValue))
      .curve(d3.curveMonotoneX);

    const algorithmLine = d3
      .line<(typeof dataPoints)[0]>()
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
    tickerGradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#3b82f6')
      .attr('stop-opacity', 0.3);
    tickerGradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#3b82f6')
      .attr('stop-opacity', 0);

    // Algorithm gradient
    const algorithmGradient = defs
      .append('linearGradient')
      .attr('id', 'algorithm-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    algorithmGradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#10b981')
      .attr('stop-opacity', 0.3);
    algorithmGradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#10b981')
      .attr('stop-opacity', 0);

    // Grid lines (horizontal only)
    const yAxisGrid = d3
      .axisLeft(yScale)
      .ticks(10)
      .tickSize(-innerWidth)
      .tickFormat(() => '');

    g.append('g')
      .attr('class', 'grid')
      .call(yAxisGrid)
      .attr('stroke', 'rgba(255, 255, 255, 0.1)')
      .attr('stroke-width', 1);

    // Area under curves
    const tickerArea = d3
      .area<(typeof dataPoints)[0]>()
      .x((d) => xScale(d.index))
      .y0(innerHeight)
      .y1((d) => yScale(d.tickerValue))
      .curve(d3.curveMonotoneX);

    const algorithmArea = d3
      .area<(typeof dataPoints)[0]>()
      .x((d) => xScale(d.index))
      .y0(innerHeight)
      .y1((d) => yScale(d.algorithmValue))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(visibleDataPoints)
      .attr('fill', 'url(#ticker-gradient)')
      .attr('d', tickerArea)
      .attr('opacity', 0)
      .transition()
      .duration(300)
      .attr('opacity', 1);

    g.append('path')
      .datum(visibleDataPoints)
      .attr('fill', 'url(#algorithm-gradient)')
      .attr('d', algorithmArea)
      .attr('opacity', 0)
      .transition()
      .duration(300)
      .attr('opacity', 1);

    // Draw lines - use only visible data points to prevent overflow
    g.append('path')
      .datum(visibleDataPoints)
      .attr('fill', 'none')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2.5)
      .attr('d', tickerLine)
      .attr('opacity', 0)
      .transition()
      .duration(350)
      .attr('opacity', 1);

    g.append('path')
      .datum(visibleDataPoints)
      .attr('fill', 'none')
      .attr('stroke', '#10b981')
      .attr('stroke-width', 2.5)
      .attr('d', algorithmLine)
      .attr('opacity', 0)
      .transition()
      .duration(350)
      .delay(50)
      .attr('opacity', 1);

    // Axes
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(10)
      .tickFormat((d) => {
        const index = Math.round(Number(d));
        if (index >= 0 && index < timestamps.length) {
          const timestamp = timestamps[index];
          // Parse YYYY-MM-DD HH:mm:ss format
          try {
            const date = new Date(timestamp.replace(' ', 'T'));
            if (!isNaN(date.getTime())) {
              return d3.timeFormat('%m/%d')(date);
            }
            // If parsing fails, try to extract date part
            const datePart = timestamp.split(' ')[0];
            if (datePart) {
              return datePart.substring(5); // Return MM-DD
            }
          } catch {
            // Fallback to showing part of timestamp
            return timestamp.substring(5, 10); // Return MM-DD if possible
          }
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

    // Legend with background
    const legendItems = [
      { color: '#3b82f6', label: tickerPlot.name },
      { color: '#10b981', label: algorithmPlot.name },
    ];

    // Calculate legend dimensions
    const legendItemHeight = 25;
    const legendPadding = 4;
    const legendLineWidth = 30;
    const legendTextOffset = 40;
    const legendRightMargin = 10; // Margin from right edge

    // Estimate text width (add some buffer for safety)
    const maxLabelWidth = Math.max(
      ...legendItems.map((item) => item.label.length * 9), // Slightly more per character for safety
    );
    const legendWidth = legendTextOffset + maxLabelWidth + legendPadding * 2;
    const legendHeight = legendItems.length * legendItemHeight + legendPadding * 2;

    // Position legend - ensure it doesn't go off screen
    // Position from right edge, but ensure it stays within bounds
    const legendX = innerWidth - legendWidth - legendRightMargin;
    // If legend would be too wide, position from left instead
    const finalLegendX = legendX < legendRightMargin ? legendRightMargin : legendX;
    const legendY = 10;

    // Create background rectangle
    g.append('rect')
      .attr('x', finalLegendX)
      .attr('y', legendY)
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .attr('fill', 'rgba(15, 23, 42, 0.95)')
      .attr('stroke', 'rgba(255, 255, 255, 0.2)')
      .attr('stroke-width', 1)
      .attr('rx', 6);

    const legend = g
      .append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${finalLegendX + legendPadding}, ${legendY + legendPadding})`);

    legendItems.forEach((item, i) => {
      const legendItem = legend
        .append('g')
        .attr('transform', `translate(0, ${i * legendItemHeight})`);

      // Center the line vertically within the item height
      const lineY = legendItemHeight / 2;
      const lineOffset = 4; // Offset to move line to the right

      legendItem
        .append('line')
        .attr('x1', lineOffset)
        .attr('x2', legendLineWidth + lineOffset)
        .attr('y1', lineY)
        .attr('y2', lineY)
        .attr('stroke', item.color)
        .attr('stroke-width', 3);

      // Center text vertically
      // SVG text y position is from baseline, so we need to adjust for vertical centering
      legendItem
        .append('text')
        .attr('x', legendTextOffset)
        .attr('y', lineY)
        .attr('dy', '0.35em') // Adjust for vertical centering (moves text up by ~35% of font size)
        .style('fill', 'rgba(255, 255, 255, 0.95)')
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

    // Hover line (created before brush so brush can be on top)
    const hoverLine = g
      .append('line')
      .attr('class', 'hover-line')
      .attr('stroke', 'rgba(255, 255, 255, 0.5)')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '5,5')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .style('opacity', 0);

    // Brush for zoom selection - using d3's native brush behavior
    const brush = d3
      .brushX()
      .extent([
        [0, 0],
        [innerWidth, innerHeight],
      ])
      .on('start', function () {
        isBrushingRef.current = true;
        // Hide tooltip during brush
        tooltip.style('opacity', 0);
        hoverLine.style('opacity', 0);
        // Show handles when brushing starts
        brushGroup.selectAll('.handle').style('display', null);
      })
      .on('brush', function (event) {
        if (!event.selection) {
          // If no selection, hide handles
          brushGroup.selectAll('.handle').style('display', 'none');
          return;
        }
        // Show handles during brush
        brushGroup.selectAll('.handle').style('display', null);
      })
      .on('end', function (event) {
        isBrushingRef.current = false;

        if (!event.selection) {
          hoverLine.style('opacity', 0);
          // Hide handles when brush ends with no selection
          brushGroup.selectAll('.handle').style('display', 'none');
          return;
        }

        const [x0, x1] = event.selection;
        const startIndex = Math.max(0, Math.floor(xScale.invert(x0)));
        const endIndex = Math.min(dataPoints.length - 1, Math.ceil(xScale.invert(x1)));

        // Only zoom if selection is meaningful (at least 2 data points)
        if (endIndex - startIndex >= 2) {
          setZoomDomain([startIndex, endIndex]);
        }

        // Clear brush selection and hide handles
        d3.select(this).call(brush.move, null);
        brushGroup.selectAll('.handle').style('display', 'none');
        hoverLine.style('opacity', 0);
      });

    const brushGroup = g.append('g').attr('class', 'brush').call(brush);

    // Style the brush
    brushGroup
      .selectAll('.selection')
      .attr('fill', 'rgba(59, 130, 246, 0.2)')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,5');

    brushGroup
      .selectAll('.handle')
      .attr('fill', '#3b82f6')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2)
      .attr('width', 8)
      .attr('height', innerHeight);

    // Hide brush handles by default - only show when actively brushing
    brushGroup.selectAll('.handle').style('display', 'none');

    // Get the brush overlay (d3 creates this automatically)
    const brushOverlay = brushGroup.selectAll('.overlay');

    // Style the brush overlay
    brushOverlay.style('cursor', 'crosshair').style('fill', 'transparent');

    // Add hover functionality to brush overlay - works when not actively brushing
    brushOverlay.on('mousemove', function (event) {
      // Only show hover if not currently brushing
      if (isBrushingRef.current) return;

      const [mouseX] = d3.pointer(event);
      const index = Math.round(xScale.invert(mouseX));
      if (index >= 0 && index < dataPoints.length) {
        const point = dataPoints[index];
        hoverLine.attr('x1', xScale(index)).attr('x2', xScale(index)).style('opacity', 1);

        const tickerReturn =
          ((point.tickerValue - dataPoints[0].tickerValue) / dataPoints[0].tickerValue) * 100;
        const algorithmReturn =
          ((point.algorithmValue - dataPoints[0].algorithmValue) / dataPoints[0].algorithmValue) *
          100;

        tooltip
          .style('opacity', 1)
          .html(
            `
            <div style="font-weight: 600; margin-bottom: 8px; font-size: 14px; color: rgba(255, 255, 255, 0.95);">${formatTimestamp(point.timestamp)}</div>
            <div style="margin-bottom: 4px;">
              <span style="color: #3b82f6; font-weight: 500;">${tickerPlot.name}:</span>
              <span style="margin-left: 8px; color: rgba(255, 255, 255, 0.9);">$${point.tickerValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span style="margin-left: 8px; color: ${tickerReturn >= 0 ? '#10b981' : '#ef4444'}; font-weight: 500;">
                (${tickerReturn >= 0 ? '+' : ''}${tickerReturn.toFixed(2)}%)
              </span>
            </div>
            <div>
              <span style="color: #10b981; font-weight: 500;">${algorithmPlot.name}:</span>
              <span style="margin-left: 8px; color: rgba(255, 255, 255, 0.9);">$${point.algorithmValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span style="margin-left: 8px; color: ${algorithmReturn >= 0 ? '#10b981' : '#ef4444'}; font-weight: 500;">
                (${algorithmReturn >= 0 ? '+' : ''}${algorithmReturn.toFixed(2)}%)
              </span>
            </div>
          `,
          )
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 10}px`);
      }
    });

    brushOverlay.on('mouseleave', () => {
      if (!isBrushingRef.current) {
        hoverLine.style('opacity', 0);
        tooltip.style('opacity', 0);
      }
    });

    // Double-click to reset zoom
    brushOverlay.on('dblclick', () => {
      setZoomDomain(null);
      if (onResetZoom) {
        onResetZoom();
      }
    });

    // Cleanup
    return () => {
      tooltip.remove();
    };
  }, [data, dimensions, zoomDomain, onResetZoom]);

  const handleResetZoom = () => {
    setZoomDomain(null);
    if (onResetZoom) {
      onResetZoom();
    }
  };

  const hasZoom = zoomDomain !== null;

  return (
    <div
      className="backtest-chart-container bg-slate-900/60 rounded-2xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-[10px] animate-[fadeInUp_0.8s_ease-out_0.2s_both] relative overflow-hidden"
      ref={containerRef}
    >
      <div className="flex justify-between items-center mb-4 py-2">
        <button
          className="bg-blue-500/20 border border-blue-500/40 text-blue-400 px-4 py-2 rounded-md text-sm font-medium cursor-pointer transition-all duration-200 font-sans hover:bg-blue-500/30 hover:border-blue-500/60 hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={handleResetZoom}
          disabled={!hasZoom}
        >
          Reset Zoom
        </button>
        <div className="text-xs text-white/50 italic">
          Click and drag to select a range, double-click to reset
        </div>
      </div>
      <svg ref={svgRef} className="w-full h-[600px] block" />
    </div>
  );
}
