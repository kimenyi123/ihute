"use client"

import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/lib/auth-store"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"

interface LogoutButtonProps {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
  className?: string
  children?: React.ReactNode
}

/**
 * Logout button component that properly clears all user data
 * and redirects to login page
 */
export function LogoutButton({ 
  variant = "outline", 
  size = "default", 
  className,
  children 
}: LogoutButtonProps) {
  const logout = useAuthStore((state) => state.logout)
  const router = useRouter()

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  return (
    <Button 
      variant={variant} 
      size={size} 
      className={className}
      onClick={handleLogout}
    >
      <LogOut className="w-4 h-4 mr-2" />
      {children || "Logout"}
    </Button>
  )
}
