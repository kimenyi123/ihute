import { NextRequest, NextResponse } from 'next/server';

/**
 * Redirect to general template. The canonical template is at /supplier/stock/template (general format).
 */
export async function GET(request: NextRequest) {
  const base = new URL(request.url).origin;
  return NextResponse.redirect(new URL('/supplier/stock/template', base), 302);
}
