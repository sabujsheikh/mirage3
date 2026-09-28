import React, { useEffect, useRef } from 'react';
import { renderBarcodeSvg } from '../../lib/barcode';

interface BarcodeSvgProps {
  value: string;
  className?: string;
  height?: number;
  width?: number;
  displayValue?: boolean;
}

export const BarcodeSvg: React.FC<BarcodeSvgProps> = ({
  value,
  className = '',
  height = 40,
  width = 1.6,
  displayValue = true,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      renderBarcodeSvg(svgRef.current, value, {
        height,
        width,
        displayValue,
      });
    }
  }, [value, height, width, displayValue]);

  return <svg ref={svgRef} className={className} />;
};
