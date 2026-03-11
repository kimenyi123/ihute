import { NextResponse } from 'next/server';

/**
 * General CSV template for stock import.
 * Columns: CATEGORY, SUBCATEGORY, ITEM, QTE, PRICE (RWF), COST PRICE, FRENCH, KINYARWANDA, IMAGE LINK, KEYWORDS.
 * Required: ITEM, QTE, PRICE. Optional columns can be left empty.
 */
export async function GET() {
  const csvContent = `CATEGORY,SUBCATEGORY,ITEM,QTE,PRICE (RWF),COST PRICE,FRENCH,KINYARWANDA,IMAGE LINK,KEYWORDS
BREAKFAST,,Beef and Mushroom Omelet,1,7000,3500,Omelette au Bœuf et Champignons,Umureti w'inyama z'inka n'ibihumyo,https://example.com/omelet.jpg,
COLD STARTERS,,Burrows Salad,1,1500,800,Salade Burrows,Saladi ya Burrows,https://example.com/salad.jpg,
HOT STARTERS,,Vegetable Soup,1,3500,1800,Soupe aux Légumes,Isosi y'imboga,https://example.com/soup.jpg,
MAIN COURSE,Chicken,Chicken Stew,1,8000,4000,Ragoût de Poulet,Isosi y'inkoko,https://example.com/stew.jpg,
MAIN COURSE,Chicken,Fried Chicken Leg/Breast,1,10000,5000,Amaguru n'agatuza k'inkoko Byokeje,Amaguru n'agatuza k'inkoko,https://example.com/chicken.jpg,`;

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="stock_template_general.csv"',
    },
  });
}
