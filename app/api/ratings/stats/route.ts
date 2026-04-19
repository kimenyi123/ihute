import { NextRequest, NextResponse } from 'next/server';
import { getServerProxyBackendBase } from "@/lib/backend-config";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sellerAccount = searchParams.get('sellerAccount');
    
    console.log('[Rating Stats API] Requested for seller:', sellerAccount);
    
    if (!sellerAccount) {
      return NextResponse.json({ ok: false, error: 'sellerAccount is required' }, { status: 400 });
    }
    
    const backendUrl = getServerProxyBackendBase();
    const apiUrl = `${backendUrl}/Kaos/RatingServlet?action=getSupplierRatingStats&sellerAccount=${encodeURIComponent(sellerAccount)}`;
    
    console.log('[Rating Stats API] Calling backend URL:', apiUrl);
    
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    console.log('[Rating Stats API] Backend response:', JSON.stringify(data));
    
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('[Rating Stats API] Error:', error);
    return NextResponse.json({ ok: false, error: 'Failed to fetch rating stats' }, { status: 500 });
  }
}
