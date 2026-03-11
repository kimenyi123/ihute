// app/api/reorder/route.ts
// This proxies requests from Next.js to Java backend

import { getBackendBase } from "@/lib/backend-config";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // Java servlet is mapped as @WebServlet("/api/reorder")
    // and is deployed under the same base as other Trading endpoints.
    // getBackendBase() already includes the "/Trading" suffix (e.g. http://host:8080/Trading),
    // so the full URL becomes "<base>/api/reorder".
    const JAVA_API_URL =
      process.env.JAVA_API_URL ||
      getBackendBase() ||
      "https://ihute.rw/Trading";

    console.log("Proxying request to:", `${JAVA_API_URL}/api/reorder`);
    console.log('Request body:', body);

    const response = await fetch(`${JAVA_API_URL}/api/reorder`, {
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