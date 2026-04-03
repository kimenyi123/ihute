import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ 
    message: 'Test API route working',
    timestamp: new Date().toISOString(),
    origin: 'Next.js API route'
  })
}
