import Link from "next/link"
import { Facebook, Twitter, Instagram, Mail, Phone, MapPin } from "lucide-react"

type FooterProps = {
  /** Category AI landing: tagline sits above copyright in the bottom bar (merged, not duplicated at top). */
  showIshyigaIntelligenceTagline?: boolean
}

export function Footer({ showIshyigaIntelligenceTagline = false }: FooterProps) {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
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
                <a href="tel:+250788000000" className="text-muted-foreground hover:text-primary transition-colors">
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
        </div>
      </div>
    </footer>
  )
}
