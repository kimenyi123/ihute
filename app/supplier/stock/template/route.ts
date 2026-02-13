import { NextResponse } from 'next/server';

/**
 * Generate Excel template for stock import
 * Returns a CSV file that can be opened in Excel
 */
export async function GET() {
  // CSV template with required columns
  const csvContent = `NAME,QTE,SALES,CODE,DESCRIPTION
Paracetamol 500mg,100,500 RWF,MED001,Pain relief medication
Aspirin 100mg,50,300 RWF,MED002,Anti-inflammatory
Vitamin C 1000mg,200,800 RWF,SUP001,Immune support supplement
Hand Sanitizer 500ml,75,1500 RWF,HYG001,Antibacterial hand sanitizer
Face Masks (Box of 50),30,5000 RWF,HYG002,Disposable surgical masks`;

  // Return as downloadable file
  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="stock_template.csv"',
    },
  });
}
