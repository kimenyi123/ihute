import { NextRequest, NextResponse } from 'next/server';
import { getServerProxyBackendBase } from "@/lib/backend-config";
import { sellerAccountFromOrder, sellerNameFromOrder } from "@/lib/order-seller-account";

function normalizeOrderDetailsResponse(data: Record<string, unknown>) {
  if (!data?.ok || !data.order || typeof data.order !== "object") return data
  const order = data.order as Record<string, unknown>
  const seller = (data.seller && typeof data.seller === "object" ? data.seller : {}) as Record<string, unknown>
  return {
    ...data,
    order: {
      ...order,
      sellerAccount: sellerAccountFromOrder(order, seller),
      sellerName: sellerNameFromOrder(order, seller),
    },
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    
    if (!orderId) {
      return NextResponse.json({ ok: false, error: 'orderId is required' }, { status: 400 });
    }
    
    const backendUrl = getServerProxyBackendBase();
    const response = await fetch(
      `${backendUrl}/Kaos/OrdersServlet?action=getOrderDetails&orderId=${orderId}`
    );
    
    const data = await response.json();
    return NextResponse.json(normalizeOrderDetailsResponse(data));
    
  } catch (error) {
    console.error('Failed to fetch order details:', error);
    return NextResponse.json({ ok: false, error: 'Failed to fetch order details' }, { status: 500 });
  }
}
