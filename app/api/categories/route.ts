import { NextResponse } from "next/server";

/**
 * GET /api/categories
 * Returns list of available product categories
 */
export async function GET() {
    try {
        // TODO: Fetch from database or Redis
        // For now, return static categories
        const categories = [
            { id: "1", name: "Groceries" },
            { id: "2", name: "Electronics" },
            { id: "3", name: "Clothing" },
            { id: "4", name: "Home & Garden" },
            { id: "5", name: "Health & Beauty" },
            { id: "6", name: "Sports & Outdoors" },
            { id: "7", name: "Toys & Games" },
            { id: "8", name: "Books & Media" },
            { id: "9", name: "Automotive" },
            { id: "10", name: "Pet Supplies" },
        ];

        return NextResponse.json(categories);
    } catch (error: any) {
        console.error("[Categories API] Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch categories" },
            { status: 500 }
        );
    }
}
