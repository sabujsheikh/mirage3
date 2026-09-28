import JsBarcode from 'jsbarcode';

export function renderBarcodeSvg(svgElement: SVGSVGElement | null, value: string, options?: JsBarcode.BaseOptions): void {
  if (!svgElement || !value) return;
  try {
    JsBarcode(svgElement, value, {
      format: 'CODE128',
      lineColor: '#16324F',
      width: 1.8,
      height: 48,
      displayValue: true,
      fontSize: 12,
      font: 'sans-serif',
      textMargin: 3,
      background: 'transparent',
      ...options,
    });
  } catch (err) {
    console.error('Barcode rendering error:', err);
  }
}
