import { NextResponse } from 'next/server';

/**
 * Generate CSV template for stock import.
 * Includes required columns (NAME, QTE, SALES, CODE, DESCRIPTION) and
 * scan-menu columns (Category, Subcategory, Item, Price, Currency, Dietary, Image)
 * so files from Scan Menu can be used here.
 */
export async function GET() {
  const csvContent = `NAME,QTE,SALES,CODE,DESCRIPTION,Category,Subcategory,Item,Price,Currency,Dietary,Image
Paracetamol 500mg,100,500 RWF,MED001,Pain relief medication,Medications,Pain Relief,Paracetamol 500mg,500,RWF,,
Aspirin 100mg,50,300 RWF,MED002,Anti-inflammatory,Medications,Pain Relief,Aspirin 100mg,300,RWF,,
Vitamin C 1000mg,200,800 RWF,SUP001,Immune support supplement,Supplements,Vitamins,Vitamin C 1000mg,800,RWF,Vegan,
Hand Sanitizer 500ml,75,1500 RWF,HYG001,Antibacterial hand sanitizer,Personal Care,Hygiene,Hand Sanitizer 500ml,1500,RWF,,
Face Masks (Box of 50),30,5000 RWF,HYG002,Disposable surgical masks,Personal Care,PPE,Face Masks (Box of 50),5000,RWF,,`;

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="stock_template.csv"',
    },
  });
}
