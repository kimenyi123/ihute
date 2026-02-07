// app/api/reorder/route.ts
// This proxies requests from Next.js to Java backend

import { getBackendBase } from "@/lib/backend-config";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const JAVA_API_URL = process.env.JAVA_API_URL || getBackendBase().replace(/\/Trading\/?$/, "") || "https://ihute.rw";

    console.log('Proxying request to:', `${JAVA_API_URL}/Trading/re_order`);
    console.log('Request body:', body);

    const response = await fetch(`${JAVA_API_URL}/Trading/re_order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Java API returned status ${response.status}`);
    }

    const data = await response.json();
    console.log('Java API response:', data);

    return Response.json(data);

  } catch (error) {
    console.error('Error proxying to Java API:', error);
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      {
        success: false,
        message: 'Failed to connect to backend: ' + message
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS(_request: Request) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}