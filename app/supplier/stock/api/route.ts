import { NextRequest, NextResponse } from 'next/server';
import { getServerProxyBackendBase } from '@/lib/backend-config';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || getServerProxyBackendBase();

/**
 * Supplier Stock API Proxy
 * Forwards requests to Java backend SupplierStockServlet
 * 
 * Supports:
 * - GET: getStock, searchStock
 * - POST: importExcel (multipart), deleteItem, upsertItem (JSON)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (!action) {
    return NextResponse.json({ ok: false, error: 'Missing action parameter' }, { status: 400 });
  }

  try {
    // Build backend URL with all query params
    const backendUrl = new URL(`${BACKEND_URL}/supplier/stock/api`);
    searchParams.forEach((value, key) => {
      backendUrl.searchParams.append(key, value);
    });

    console.log('[SupplierStock API] GET request to:', backendUrl.toString());
    console.log('[SupplierStock API] Cookies:', request.headers.get('cookie') ? 'Present' : 'Missing');

    const response = await fetch(backendUrl.toString(), {
      method: 'GET',
      headers: {
        'Cookie': request.headers.get('cookie') || '',
        'User-Agent': request.headers.get('user-agent') || '',
      },
      credentials: 'include',
    });

    console.log('[SupplierStock API] Backend response status:', response.status);

    const data = await response.json();
    
    // If backend returns 401, add more context
    if (response.status === 401) {
      console.error('[SupplierStock API] Authentication failed - session may have expired');
      return NextResponse.json(
        { ok: false, error: 'Authentication failed. Please log in again.', needsLogin: true },
        { status: 401 }
      );
    }

    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('[SupplierStock API] GET error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to communicate with backend' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (!action) {
    return NextResponse.json({ ok: false, error: 'Missing action parameter' }, { status: 400 });
  }

  try {
    const backendUrl = new URL(`${BACKEND_URL}/supplier/stock/api`);
    backendUrl.searchParams.set('action', action);

    const contentType = request.headers.get('content-type') || '';

    let body: any;
    const headers: HeadersInit = {
      'Cookie': request.headers.get('cookie') || '',
    };

    // Handle multipart/form-data (Excel upload)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      body = formData;
      // Don't set content-type header - let fetch set it with boundary
    } 
    // Handle JSON body
    else if (contentType.includes('application/json')) {
      const jsonData = await request.json();
      body = JSON.stringify(jsonData);
      headers['Content-Type'] = 'application/json';
    }
    // Handle empty body
    else {
      const text = await request.text();
      body = text || undefined;
      if (body) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }
    }

    const response = await fetch(backendUrl.toString(), {
      method: 'POST',
      headers,
      body,
      credentials: 'include',
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('[SupplierStock API] POST error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to communicate with backend' },
      { status: 500 }
    );
  }
}
