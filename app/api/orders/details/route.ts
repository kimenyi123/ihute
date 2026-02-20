import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    
    if (!orderId) {
      return NextResponse.json({ ok: false, error: 'orderId is required' }, { status: 400 });
    }
    
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080/Trading';
    const response = await fetch(
      `${backendUrl}/Kaos/OrdersServlet?action=getOrderDetails&orderId=${orderId}`
    );
    
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Failed to fetch order details:', error);
    return NextResponse.json({ ok: false, error: 'Failed to fetch order details' }, { status: 500 });
  }
}
