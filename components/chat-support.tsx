"use client"

import React from "react"
import { useState, useEffect, useRef } from "react"
import { 
  MessageCircle, X, Send, Bot, 
  Search, Package, Store, Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { 
  parseUserIntent, 
  callSearchAPI, 
  formatSearchResults,
  type AssistantResponse 
} from "@/lib/shopping-assistant"
import { useCartStore } from "@/lib/cart-store"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface Message {
  type: "bot" | "user"
  content: string
  timestamp: Date
  searchResults?: {
    products: any[]
    suppliers: any[]
  }
  isTyping?: boolean
}

export function ChatSupport() {
  const router = useRouter()
  const addToCart = useCartStore((s) => s.addItem)
  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState<Message[]>([
    { 
      type: "bot", 
      content: "Hello! I'm your shopping assistant. I can help you find products, categories, or suppliers. What are you looking for?",
      timestamp: new Date()
    }
  ])
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async (customMessage?: string) => {
    const messageToSend = customMessage || message
    if (!messageToSend.trim()) return

    // Add user message
    const userMsg: Message = {
      type: "user",
      content: messageToSend.trim(),
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMsg])
    setMessage("")
    setIsTyping(true)

    try {
      // Parse user intent
      const intent: AssistantResponse = parseUserIntent(messageToSend)

      // Handle different intents
      if (intent.intent === "search" && intent.action === "call_api") {
        // Call search API
        const searchQuery = intent.searchQuery || intent.entities.product || messageToSend
        const results = await callSearchAPI(searchQuery, intent.filters)

        // Format results
        const formattedMessage = formatSearchResults(results, searchQuery)

        const botMsg: Message = {
          type: "bot",
          content: formattedMessage,
          timestamp: new Date(),
          searchResults: {
            products: results.products.slice(0, 5),
            suppliers: results.suppliers.slice(0, 3)
          }
        }
        setMessages(prev => [...prev, botMsg])
      } else if (intent.intent === "clarify") {
        // Ask clarification question
        const botMsg: Message = {
          type: "bot",
          content: intent.message,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, botMsg])
      } else {
        // Redirect or fallback
        const botMsg: Message = {
          type: "bot",
          content: intent.message,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, botMsg])
      }
    } catch (error) {
      console.error("[ChatSupport] Error:", error)
      const errorMsg: Message = {
        type: "bot",
        content: "I encountered an error. Please try again or use the search page.",
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setIsTyping(false)
    }
  }

  const handleProductClick = (product: any) => {
    const itemCode = product.item_code || product.ITEM_CODE
    const itemName = product.item_commercial_name || product.ITEM_NAME || "Product"
    const supplierAccount = product.supplier_account || product.item_seller_account
    const supplierName = product.supplier_name || product.item_seller_name || "Supplier"
    const price = parseFloat(product.item_price || product.ITEM_PRICE || product.price || "0")
    const unit = product.item_packet || product.ITEM_PACKET || product.unit || "unit"
    const image = product.image || product.ITEM_IMAGE || ""
    const momo = product.momo || ""
    const supplierLocation = product.supplier_location || product.item_seller_location || ""

    if (itemCode && supplierAccount) {
      // Add to cart
      addToCart({
        id: itemCode,
        name: itemName,
        price: price || 0,
        unit: unit,
        image: image,
        supplierId: supplierAccount,
        supplierName: supplierName,
        supplierLocation: supplierLocation,
        momo: momo,
      }, 1)

      // Show success message
      toast.success(`${itemName} added to cart!`)
      
      // Navigate to cart
      router.push("/cart")
      setIsOpen(false)
    }
  }

  const handleSupplierClick = (supplier: any) => {
    const account = supplier.supplier_account || supplier.seller_account
    const name = supplier.supplier_name || supplier.seller_name || "Supplier"
    
    if (account) {
      // Navigate to search page with supplier filter
      const params = new URLSearchParams({
        q: name,
        supplier: account,
        supplierName: name
      })
      router.push(`/search?${params.toString()}`)
      setIsOpen(false)
    }
  }

  return (
    <div>
      {/* Chat Buttons */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-6 z-50 flex flex-col gap-3"
          >
            {/* WhatsApp Button */}
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={() => {
                  const message = encodeURIComponent(
                    "Hello! I need help with ihute.rw\n\n" +
                    "I'm interested in:\n" +
                    "• Product information\n" +
                    "• Order assistance\n" +
                    "• Payment options\n" +
                    "• Delivery services\n\n" +
                    "Please assist me. Thank you!"
                  )
                  window.open(`https://wa.me/250780125242?text=${message}`, "_blank")
                }}
                className="h-14 w-14 rounded-full bg-green-500 hover:bg-green-600 shadow-lg"
                size="icon"
              >
                <svg className="h-7 w-7" fill="white" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
              </Button>
            </motion.div>

            {/* Chat Button */}
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={() => setIsOpen(true)}
                className="h-14 w-14 rounded-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg"
                size="icon"
              >
                <MessageCircle className="h-6 w-6" />
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="fixed bottom-6 right-6 z-50 w-[420px] shadow-2xl border-0">
              <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-slate-800 to-slate-700 text-white rounded-t-lg">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Bot className="h-6 w-6 text-blue-400" />
                    <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white"></span>
                  </div>
                  <div>
                    <CardTitle className="text-base font-medium">Shopping Assistant</CardTitle>
                    <span className="text-xs text-green-300">Online</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="text-white hover:bg-slate-600/50"
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-3 h-[450px] overflow-y-auto px-4 py-3 bg-gray-50/50">
                  {messages.map((msg, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-2"
                    >
                      <div
                        className={`rounded-lg p-3 shadow-sm ${
                          msg.type === "user" 
                            ? "bg-blue-500 ml-12 text-white" 
                            : "bg-white mr-12 border border-gray-100"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          {msg.type === "bot" ? (
                            <div className="flex items-center gap-2">
                              <Bot className="h-4 w-4 text-blue-500" />
                              <span className="text-xs font-medium text-gray-600">Assistant</span>
                            </div>
                          ) : (
                            <span className="text-xs font-medium text-blue-100">You</span>
                          )}
                        </div>
                        <p className={`text-sm whitespace-pre-line ${msg.type === "user" ? "text-white" : "text-gray-700"}`}>
                          {msg.content}
                        </p>
                      </div>

                      {/* Show search results */}
                      {msg.type === "bot" && msg.searchResults && (
                        <div className="mr-12 space-y-2">
                          {/* Products */}
                          {msg.searchResults.products.length > 0 && (
                            <div className="bg-white border border-gray-200 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Package className="h-4 w-4 text-blue-500" />
                                <span className="text-xs font-semibold text-gray-700">Products</span>
                              </div>
                              <div className="space-y-2">
                                {msg.searchResults.products.map((product, i) => {
                                  const name = product.item_commercial_name || product.ITEM_NAME || "Product"
                                  const supplier = product.supplier_name || product.item_seller_name || "Supplier"
                                  return (
                                    <button
                                      key={i}
                                      onClick={() => handleProductClick(product)}
                                      className="w-full text-left p-2 hover:bg-gray-50 rounded border border-gray-100 transition-colors"
                                    >
                                      <div className="text-sm font-medium text-gray-900">{name}</div>
                                      <div className="text-xs text-gray-500">{supplier}</div>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {/* Suppliers */}
                          {msg.searchResults.suppliers.length > 0 && msg.searchResults.products.length === 0 && (
                            <div className="bg-white border border-gray-200 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Store className="h-4 w-4 text-green-500" />
                                <span className="text-xs font-semibold text-gray-700">Suppliers</span>
                              </div>
                              <div className="space-y-2">
                                {msg.searchResults.suppliers.map((supplier, i) => {
                                  const name = supplier.supplier_name || supplier.seller_name || "Supplier"
                                  return (
                                    <button
                                      key={i}
                                      onClick={() => handleSupplierClick(supplier)}
                                      className="w-full text-left p-2 hover:bg-gray-50 rounded border border-gray-100 transition-colors"
                                    >
                                      <div className="text-sm font-medium text-gray-900">{name}</div>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {/* Link to full search */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs"
                            asChild
                          >
                            <Link href="/search">
                              <Search className="h-3 w-3 mr-1" />
                              View all results
                            </Link>
                          </Button>
                        </div>
                      )}
                    </motion.div>
                  ))}
                  
                  {isTyping && (
                    <div className="bg-slate-100 rounded-lg p-3 mr-8 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                      <span className="text-sm text-gray-500">Searching...</span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <div className="flex gap-2 p-4 bg-white border-t">
                  <div className="relative flex-1">
                    <Input
                      placeholder="Search for products, categories, or suppliers..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && !isTyping && handleSendMessage()}
                      className="pr-12 bg-gray-50 border-gray-200 focus:border-blue-300 focus:ring-blue-200"
                      disabled={isTyping}
                    />
                  </div>
                  <Button 
                    size="default" 
                    onClick={() => handleSendMessage()}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 h-10"
                    disabled={isTyping}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
