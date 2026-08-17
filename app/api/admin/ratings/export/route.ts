/**
 * CSV Export Endpoint for Ratings
 * GET /api/admin/ratings/export
 * 
 * Generates CSV file with all rating data
 * Requires admin authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerProxyBackendBase } from "@/lib/backend-config"

const JAVA_BACKEND_BASE = getServerProxyBackendBase()

export async function GET(request: NextRequest) {
    try {
        // Forward request to Java backend
        const url = `${JAVA_BACKEND_BASE}/Kaos/AdminRatingServlet?action=exportCSV`

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Cookie': request.headers.get('cookie') || '',
            },
        })

        if (!response.ok) {
            return NextResponse.json(
                { ok: false, error: 'Failed to export ratings' },
                { status: response.status }
            )
        }

        // Get CSV data
        const csvData = await response.text()

        // Return as downloadable CSV
        return new NextResponse(csvData, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="ratings_export_${new Date().toISOString().split('T')[0]}.csv"`,
            },
        })
    } catch (error) {
        console.error('[CSV Export] Error:', error)
        return NextResponse.json(
            { ok: false, error: 'Internal server error' },
            { status: 500 }
        )
    }
}
