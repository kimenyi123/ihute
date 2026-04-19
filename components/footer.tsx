import Image from "next/image"
import Link from "next/link"
import { Facebook, Twitter, Instagram, Mail, Phone, MapPin } from "lucide-react"
import { APP_VERSION_DISPLAY } from "@/lib/app-version"
import { GRANDMA_TRADING_AI_VERSION } from "@/lib/grandma-trading-apis"

type FooterProps = {
  /** Category AI landing: tagline sits above copyright in the bottom bar (merged, not duplicated at top). */
  showIshyigaIntelligenceTagline?: boolean
}

export function Footer({ showIshyigaIntelligenceTagline = false }: FooterProps) {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-6 md:py-12">
        {/* Mobile: Horizontal scrollable sections */}
        <div className="flex md:hidden overflow-x-auto gap-6 pb-4 scrollbar-hide">
          {/* Brand - Mobile */}
          <div className="flex-shrink-0 w-[200px]">
            <div className="flex items-center gap-2 mb-2">
              <Image
                src="/images/ishyiga-logo.png"
                alt="Ishyiga Software"
                width={32}
                height={32}
                className="h-8 w-auto"
              />
              <div>
                <h3 className="font-bold text-foreground text-sm">ihute.rw</h3>
              </div>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">
              Your trusted marketplace in Rwanda.
            </p>
            <div className="flex gap-2 mt-2">
              <Link href="#" className="text-muted-foreground hover:text-primary transition-colors">
                <Facebook className="h-4 w-4" />
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-primary transition-colors">
                <Twitter className="h-4 w-4" />
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-primary transition-colors">
                <Instagram className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Quick Links - Mobile */}
          <div className="flex-shrink-0 w-[140px]">
            <h4 className="mb-2 text-xs font-semibold text-foreground">Quick Links</h4>
            <ul className="space-y-1 text-xs">
              <li><Link href="/" className="text-muted-foreground hover:text-primary">Home</Link></li>
              <li><Link href="/cart" className="text-muted-foreground hover:text-primary">Cart</Link></li>
              <li><Link href="/orders" className="text-muted-foreground hover:text-primary">Orders</Link></li>
              <li><Link href="/favorites" className="text-muted-foreground hover:text-primary">Favorites</Link></li>
            </ul>
          </div>

          {/* Contact - Mobile */}
          <div className="flex-shrink-0 w-[160px]">
            <h4 className="mb-2 text-xs font-semibold text-foreground">Contact</h4>
            <ul className="space-y-1 text-xs">
              <li className="flex items-center gap-1">
                <Phone className="h-3 w-3 text-muted-foreground" />
                <a href="tel:+250798687932" className="text-muted-foreground hover:text-primary">0798687932</a>
              </li>
              <li className="flex items-center gap-1">
                <Mail className="h-3 w-3 text-muted-foreground" />
                <a href="mailto:info@ihute.rw" className="text-muted-foreground hover:text-primary">info@ihute.rw</a>
              </li>
            </ul>
          </div>
        </div>

        {/* Desktop: Grid layout */}
        <div className="hidden md:grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Social */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground">Follow us</h4>
            <div className="flex gap-3">
              <Link href="#" className="text-muted-foreground hover:text-primary transition-colors">
                <Facebook className="h-5 w-5" />
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-primary transition-colors">
                <Twitter className="h-5 w-5" />
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-primary transition-colors">
                <Instagram className="h-5 w-5" />
              </Link>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="mb-4 text-sm font-semibold text-foreground">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="text-muted-foreground hover:text-primary transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-muted-foreground hover:text-primary transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/categories" className="text-muted-foreground hover:text-primary transition-colors">
                  All Categories
                </Link>
              </li>
              <li>
                <Link href="/cart" className="text-muted-foreground hover:text-primary transition-colors">
                  Shopping Cart
                </Link>
              </li>
              <li>
                <Link href="/orders" className="text-muted-foreground hover:text-primary transition-colors">
                  My Orders
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h4 className="mb-4 text-sm font-semibold text-foreground">Customer Service</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/help" className="text-muted-foreground hover:text-primary transition-colors">
                  Help Center
                </Link>
              </li>
              <li>
                <Link href="/shipping" className="text-muted-foreground hover:text-primary transition-colors">
                  Shipping Information
                </Link>
              </li>
              <li>
                <Link href="/returns" className="text-muted-foreground hover:text-primary transition-colors">
                  Returns & Refunds
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-muted-foreground hover:text-primary transition-colors">
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-muted-foreground hover:text-primary transition-colors">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="mb-4 text-sm font-semibold text-foreground">Contact Us</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">Kigali, Rwanda</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <a href="tel:+250798687932" className="text-muted-foreground hover:text-primary transition-colors">
                  +250 798 687 932
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <a href="mailto:info@ihute.rw" className="text-muted-foreground hover:text-primary transition-colors">
                  info@ihute.rw
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar — optional Category AI tagline merged with copyright */}
        <div
          className={`mt-12 border-t pt-8 text-center text-sm text-muted-foreground ${showIshyigaIntelligenceTagline ? "space-y-4" : ""}`}
        >
          {showIshyigaIntelligenceTagline ? (
            <div className="space-y-1.5">
              <p className="font-medium text-foreground/90">Find anything. Anywhere. Instantly.</p>
              <p className="text-xs text-muted-foreground">Powered by Ishyiga Intelligence</p>
            </div>
          ) : null}
          <p
            className={
              showIshyigaIntelligenceTagline
                ? "border-t border-border/40 pt-4 max-w-lg mx-auto"
                : ""
            }
          >
            &copy; {new Date().getFullYear()} ihute.rw by Ishyiga Software. All rights reserved.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {APP_VERSION_DISPLAY} · Grandma v{GRANDMA_TRADING_AI_VERSION}
            {process.env.NODE_ENV === "development" ? (
              <>
                {" "}
                ·{" "}
                <Link href="/dev/redis" className="underline underline-offset-2 hover:text-foreground">
                  Redis
                </Link>
              </>
            ) : null}
          </p>
        </div>
      </div>
    </footer>
  )
}
