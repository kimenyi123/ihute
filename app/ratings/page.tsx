"use client"

import { useEffect, useState } from "react"
import { useAuthStore } from "@/lib/auth-store"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Star } from "lucide-react"

export default function MyRatingsPage() {
  const { isAuthenticated, user } = useAuthStore()
  const router = useRouter()
  const [ratings, setRatings] = useState([])

  useEffect(() => {
    if (!isAuthenticated) router.push("/login")
  }, [isAuthenticated, router])

  // TODO: Fetch user's ratings from API
  // const fetchRatings = async () => {
  //   const res = await fetch(`/api/ratings?email=${user?.email}`)
  //   const data = await res.json()
  //   setRatings(data.ratings || [])
  // }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">My Ratings</h1>
        {ratings.length === 0 ? (
          <p className="text-muted-foreground">No ratings yet</p>
        ) : (
          <div className="space-y-4">
            {/* Display ratings here */}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
