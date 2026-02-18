import { NextResponse } from "next/server";

/**
 * GET /api/favorites
 * Returns user's favorite products
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId") || "anonymous";

        // TODO: Fetch from database
        // For now, return empty array
        const favorites: any[] = [];

        return NextResponse.json({
            ok: true,
            favorites,
        });
    } catch (error: any) {
        console.error("[Favorites API] Error:", error);
        return NextResponse.json(
            { error: "Failed to load favorites" },
            { status: 500 }
        );
    }
}
