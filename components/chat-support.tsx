"use client"
import React from "react"
import { useState, useEffect, useRef, ReactNode } from "react"
import { 
  MessageCircle, X, Send, ThumbsUp, ThumbsDown, 
  Paperclip, Clock, Bot, Image, Smile, Phone,
  HelpCircle, ShoppingCart, CreditCard, Truck, Bookmark
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { motion, AnimatePresence } from "framer-motion"

interface Message {
  type: "bot" | "user";
  content: string;
  timestamp: Date;
  suggestions?: string[];
  feedback?: "positive" | "negative";
  isTyping?: boolean;
  category?: "order" | "payment" | "delivery" | "loan" | "general";
  icon?: ReactNode;
}

export function ChatSupport() {
  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState<Message[]>([
    { 
      type: "bot", 
      content: "Hello! How can we help you today?",
      timestamp: new Date(),
      suggestions: ["Track my order", "Request a loan", "Delivery info", "Payment methods"]
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

  const handleWhatsApp = () => {
    window.open("https://wa.me/250780125242?text=Hello, I need help with ihute.rw", "_blank")
  }

  const getSmartSuggestions = (context: string) => {
    const lowerContext = context.toLowerCase()
    if (lowerContext.includes("order") || lowerContext.includes("track")) {
      return ["View order status", "Contact delivery team", "Cancel order"]
    }
    if (lowerContext.includes("loan")) {
      return ["View loan rates", "Apply now", "Check eligibility"]
    }
    if (lowerContext.includes("delivery")) {
      return ["Track package", "Change address", "Delivery times"]
    }
    if (lowerContext.includes("payment")) {
      return ["Mobile Money", "Card Payment", "Bank Transfer"]
    }
    return ["Tell me more", "Contact support", "View FAQs"]
  }

  const getBotResponse = (userMessage: string): { content: string; suggestions: string[]; category: Message['category']; icon: ReactNode } => {
    const lowerMessage = userMessage.toLowerCase()
    
    // More sophisticated message understanding
    const patterns = {
      order: /(order|track|status|package|delivery status|where.+my|received)/i,
      payment: /(pay|money|cash|card|mobile|transfer|cost|price)/i,
      delivery: /(deliver|shipping|ship|address|location|when|arrive)/i,
      loan: /(loan|credit|borrow|finance|installment|payment plan)/i,
      help: /(help|support|assist|guide|how|what|why|where)/i
    }

    if (patterns.order.test(lowerMessage)) {
      return {
        content: "📦 Let me help you with your order!\n\n" +
                "I can help you:\n" +
                "• Track your current orders\n" +
                "• View order history\n" +
                "• Get delivery updates\n" +
                "• Modify existing orders\n\n" +
                "What would you like to know about your order?",
        suggestions: ["Track current order", "View order history", "Modify order", "Delivery updates"],
        category: "order",
        icon: <ShoppingCart className="h-4 w-4 text-blue-500" />
      }
    }

    if (patterns.loan.test(lowerMessage)) {
      return {
        content: "💳 Our Flexible Financing Options:\n\n" +
                "Current Offers:\n" +
                "• Interest rates from 5% APR\n" +
                "• Up to 12 months payment plan\n" +
                "• Quick approval process\n" +
                "• No early repayment fees\n\n" +
                "Would you like to explore your options?",
        suggestions: ["Check eligibility", "View rates", "Calculate EMI", "Apply now"],
        category: "loan",
        icon: <CreditCard className="h-4 w-4 text-green-500" />
      }
    }

    if (patterns.delivery.test(lowerMessage)) {
      return {
        content: "🚚 Delivery Information:\n\n" +
                "We offer multiple delivery options:\n" +
                "• Standard (1-3 days): 5,000 RWF\n" +
                "• Express (Next day): 10,000 RWF\n" +
                "• Same Day*: 15,000 RWF\n\n" +
                "* Available in select areas\n" +
                "Free delivery on orders above 50,000 RWF!",
        suggestions: ["Check delivery areas", "Track package", "Delivery times", "Change address"],
        category: "delivery",
        icon: <Truck className="h-4 w-4 text-orange-500" />
      }
    }

    if (patterns.payment.test(lowerMessage)) {
      return {
        content: "💰 Secure Payment Options:\n\n" +
                "Choose your preferred payment method:\n" +
                "• Mobile Money (MTN, Airtel)\n" +
                "• Credit/Debit Cards\n" +
                "• Bank Transfer\n" +
                "• Cash on Delivery*\n\n" +
                "* Available in select areas\n" +
                "All transactions are secured 🔒",
        suggestions: ["Mobile Money", "Card Payment", "Bank Transfer", "Payment Help"],
        category: "payment",
        icon: <CreditCard className="h-4 w-4 text-purple-500" />
      }
    }

    return {
      content: "👋 I'm here to help! I can assist you with:\n\n" +
              "• Order tracking and management\n" +
              "• Flexible loan options\n" +
              "• Delivery services\n" +
              "• Payment methods\n" +
              "• General inquiries\n\n" +
              "What can I help you with today?",
      suggestions: ["Track Order", "Get Loan", "Delivery Info", "Payment Options"],
      category: "general",
      icon: <HelpCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const handleFeedback = (messageIndex: number, feedbackType: "positive" | "negative") => {
    setMessages(prev => 
      prev.map((msg, idx) => 
        idx === messageIndex ? { ...msg, feedback: feedbackType } : msg
      )
    )
  }

  const handleSendMessage = (customMessage?: string) => {
    const messageToSend = customMessage || message
    if (messageToSend.trim()) {
      // Add user message
      setMessages(prev => [...prev, { 
        type: "user", 
        content: messageToSend.trim(),
        timestamp: new Date()
      }])
      
      // Show typing indicator
      setIsTyping(true)
      
      // Get and add bot response with delay
      const response = getBotResponse(messageToSend)
      setTimeout(() => {
        setIsTyping(false)
        setMessages(prev => [...prev, { 
          type: "bot", 
          content: response.content,
          timestamp: new Date(),
          suggestions: response.suggestions
        }])
      }, Math.random() * 1000 + 500) // Random delay between 500-1500ms

      setMessage("")
    }
  }

  return (
    <div>
      {/* Chat Button */}
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
                onClick={handleWhatsApp}
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
            <Card className="fixed bottom-6 right-6 z-50 w-[400px] shadow-2xl border-0">
              <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-slate-800 to-slate-700 text-white rounded-t-lg">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Bot className="h-6 w-6 text-blue-400" />
                    <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white"></span>
                  </div>
                  <div>
                    <CardTitle className="text-base font-medium">AI Assistant</CardTitle>
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
          <CardContent className="p-4 space-y-4">
            <div className="space-y-3 h-[400px] overflow-y-auto px-4 py-2 bg-gray-50/50">
              <div className="flex justify-center">
                <Badge variant="secondary" className="bg-blue-50 text-blue-700 mb-4">
                  Today
                </Badge>
              </div>
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
                          {msg.icon || <Bot className="h-4 w-4 text-blue-500" />}
                          <span className="text-xs font-medium text-gray-600">AI Assistant</span>
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-blue-100">You</span>
                      )}
                      <span className={`text-xs ${msg.type === "user" ? "text-blue-100" : "text-gray-400"}`}>
                        <Clock className="h-3 w-3 inline mr-1" />
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className={`text-sm whitespace-pre-line ${msg.type === "user" ? "text-white" : "text-gray-700"}`}>
                      {msg.content}
                    </p>
                    {msg.type === "bot" && (
                      <div className="flex items-center gap-2 mt-3 border-t border-gray-100 pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`p-0 h-6 hover:text-green-600 ${msg.feedback === "positive" ? "text-green-500" : "text-gray-400"}`}
                          onClick={() => handleFeedback(index, "positive")}
                        >
                          <ThumbsUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`p-0 h-6 hover:text-red-600 ${msg.feedback === "negative" ? "text-red-500" : "text-gray-400"}`}
                          onClick={() => handleFeedback(index, "negative")}
                        >
                          <ThumbsDown className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {msg.suggestions && (
                    <div className="flex flex-wrap gap-2 px-3">
                      {msg.suggestions.map((suggestion, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.2, delay: i * 0.1 }}
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs bg-white hover:bg-gray-50 border-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
                            onClick={() => handleSendMessage(suggestion)}
                          >
                            {suggestion}
                          </Button>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
              {isTyping && (
                <div className="bg-slate-100 rounded-lg p-3 mr-8 flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                  </div>
                  <span className="text-sm text-gray-500">Bot is typing...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="flex gap-2 p-4 bg-white border-t">
              <div className="relative flex-1">
                <Input
                  placeholder="Type your message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  className="pr-20 bg-gray-50 border-gray-200 focus:border-blue-300 focus:ring-blue-200"
                />
                <div className="absolute right-0 top-0 h-full flex items-center gap-1 px-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-gray-100"
                  >
                    <Smile className="h-4 w-4 text-gray-400" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-gray-100"
                  >
                    <Paperclip className="h-4 w-4 text-gray-400" />
                  </Button>
                </div>
              </div>
              <Button 
                size="default" 
                onClick={() => handleSendMessage()}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 h-10"
              >
                <Send className="h-4 w-4 mr-1" />
                Send
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