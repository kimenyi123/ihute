// app/api/reorder/route.js
// This proxies requests from Next.js to  Java backend

export async function POST(request) {
  try {
    const body = await request.json();
    const JAVA_API_URL = process.env.JAVA_API_URL || 'http://localhost:8081';

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
    return Response.json(
      {
        success: false,
        message: 'Failed to connect to backend: ' + error.message
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}