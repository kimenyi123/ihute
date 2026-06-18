import type { SellerMoodSector } from "@/lib/seller-mood-options"
import { getProductSearchHaystack } from "@/lib/seller-mood-filter"

export type SurpriseField =
  | { type: "number"; key: string; label: string; placeholder?: string }
  | { type: "toggle"; key: string; label: string }

export type SurpriseDialogSection = {
  title?: string
  fields: SurpriseField[]
}

export type SurpriseDialogConfig = {
  title: string
  description: string
  sections: SurpriseDialogSection[]
  defaultValues: Record<string, number | boolean>
}

export type SurprisePreferences = Record<string, number | boolean>

export const SURPRISE_MOOD_ID = "no-alcohol"

const ALCOHOL_REGEX =
  /wine|beer|spirits|cocktail|whiskey|whisky|vodka|rum|gin|cognac|lager|ale|sparkling/i

function matchHay(hay: string, regex: RegExp): boolean {
  return regex.test(hay)
}

function filterByAnyHay(hay: string, regexes: RegExp[]): boolean {
  return regexes.some((re) => re.test(hay))
}

/** Sector-specific Surprise me :) popup copy and fields. */
export function getSurpriseDialogConfig(
  sector: SellerMoodSector,
  slugs: string[] = []
): SurpriseDialogConfig {
  const isElectronics = slugs.includes("electronics")
  const isBoutique = slugs.includes("boutique")

  switch (sector) {
    case "pharmacy":
      return {
        title: "Surprise me :)",
        description: "Tell us what you need — we’ll surface matching medicines and health products.",
        sections: [
          {
            title: "Who is it for?",
            fields: [
              { type: "toggle", key: "forChild", label: "For my child" },
              { type: "toggle", key: "forAdult", label: "For an adult" },
              { type: "toggle", key: "forFamily", label: "For the family" },
            ],
          },
          {
            title: "What do you need?",
            fields: [
              { type: "toggle", key: "headache", label: "Pain / headache" },
              { type: "toggle", key: "coldFlu", label: "Cold & flu" },
              { type: "toggle", key: "allergy", label: "Allergy" },
              { type: "toggle", key: "stomach", label: "Stomach / digestion" },
              { type: "toggle", key: "vitamins", label: "Vitamins" },
              { type: "toggle", key: "skincare", label: "Skincare" },
            ],
          },
        ],
        defaultValues: {
          forChild: false,
          forAdult: true,
          forFamily: false,
          headache: false,
          coldFlu: false,
          allergy: false,
          stomach: false,
          vitamins: false,
          skincare: false,
        },
      }

    case "liquor":
      return {
        title: "Surprise me :)",
        description: "Pick the vibe — we’ll suggest drinks from this shop.",
        sections: [
          {
            title: "What are you in the mood for?",
            fields: [
              { type: "toggle", key: "beer", label: "Beer" },
              { type: "toggle", key: "wine", label: "Wine" },
              { type: "toggle", key: "spirits", label: "Spirits" },
              { type: "toggle", key: "soft", label: "Non-alcohol" },
            ],
          },
          {
            title: "Occasion",
            fields: [
              { type: "toggle", key: "party", label: "Party" },
              { type: "toggle", key: "dinner", label: "Dinner" },
              { type: "toggle", key: "gift", label: "Gift" },
            ],
          },
        ],
        defaultValues: {
          beer: false,
          wine: false,
          spirits: false,
          soft: false,
          party: false,
          dinner: false,
          gift: false,
        },
      }

    case "food":
      return {
        title: "Surprise me :)",
        description: "How many on the table? Pick how you feel and we’ll suggest products for you.",
        sections: [
          {
            title: "How many on table?",
            fields: [
              { type: "number", key: "males", label: "Males", placeholder: "0" },
              { type: "number", key: "females", label: "Females", placeholder: "0" },
              { type: "number", key: "kids", label: "Kids", placeholder: "0" },
            ],
          },
          {
            title: "I feel…",
            fields: [
              { type: "toggle", key: "hungry", label: "I feel hungry" },
              { type: "toggle", key: "onDiet", label: "I am on diet" },
              { type: "toggle", key: "cold", label: "I'm cold" },
              { type: "toggle", key: "thirsty", label: "I'm thirsty" },
              { type: "toggle", key: "wantAlcohol", label: "I want to get drunk" },
            ],
          },
        ],
        defaultValues: {
          males: 0,
          females: 0,
          kids: 0,
          hungry: false,
          onDiet: false,
          cold: false,
          thirsty: false,
          wantAlcohol: false,
        },
      }

    case "retail":
    default:
      if (isElectronics) {
        return {
          title: "Surprise me :)",
          description: "What are you looking for? We’ll highlight matching electronics.",
          sections: [
            {
              title: "I'm shopping for…",
              fields: [
                { type: "toggle", key: "phones", label: "Phones & tablets" },
                { type: "toggle", key: "laptops", label: "Laptops & PCs" },
                { type: "toggle", key: "tv", label: "TV & audio" },
                { type: "toggle", key: "accessories", label: "Accessories" },
                { type: "toggle", key: "gaming", label: "Gaming" },
                { type: "toggle", key: "homeOffice", label: "Home & office" },
              ],
            },
          ],
          defaultValues: {
            phones: false,
            laptops: false,
            tv: false,
            accessories: false,
            gaming: false,
            homeOffice: false,
          },
        }
      }

      if (isBoutique) {
        return {
          title: "Surprise me :)",
          description: "Who are you shopping for? We’ll pick styles and items that fit.",
          sections: [
            {
              title: "Shopping for…",
              fields: [
                { type: "toggle", key: "forMe", label: "Myself" },
                { type: "toggle", key: "giftHer", label: "Gift for her" },
                { type: "toggle", key: "giftHim", label: "Gift for him" },
                { type: "toggle", key: "forKids", label: "Kids" },
              ],
            },
            {
              title: "Occasion",
              fields: [
                { type: "toggle", key: "everyday", label: "Everyday" },
                { type: "toggle", key: "party", label: "Party / event" },
                { type: "toggle", key: "work", label: "Work / formal" },
              ],
            },
          ],
          defaultValues: {
            forMe: true,
            giftHer: false,
            giftHim: false,
            forKids: false,
            everyday: true,
            party: false,
            work: false,
          },
        }
      }

      return {
        title: "Surprise me :)",
        description: "Pick what you need — we’ll suggest products from this shop.",
        sections: [
          {
            title: "I'm looking for…",
            fields: [
              { type: "toggle", key: "essentials", label: "Daily essentials" },
              { type: "toggle", key: "snacks", label: "Snacks" },
              { type: "toggle", key: "drinks", label: "Drinks" },
              { type: "toggle", key: "household", label: "Household" },
              { type: "toggle", key: "party", label: "Party / guests" },
            ],
          },
        ],
        defaultValues: {
          essentials: false,
          snacks: false,
          drinks: false,
          household: false,
          party: false,
        },
      }
  }
}

/** Apply Surprise popup choices to product list (sector-aware). */
export function filterProductsBySurprisePreferences<T extends Record<string, unknown>>(
  products: T[],
  prefs: SurprisePreferences,
  sector: SellerMoodSector,
  slugs: string[] = []
): T[] {
  const isElectronics = slugs.includes("electronics")
  const isBoutique = slugs.includes("boutique")

  const scored = products.map((p) => {
    const hay = getProductSearchHaystack(p)
    let score = 0

    if (sector === "food") {
      const males = Number(prefs.males) || 0
      const females = Number(prefs.females) || 0
      const kids = Number(prefs.kids) || 0

      if (kids > 0 && matchHay(hay, /milk|milkshake|yogurt|biscuit|juice|kids|child/i)) score += 3
      if (males > 0 && females === 0 && kids === 0 && matchHay(hay, /beer|bbq|barbecue|meat|lager|ale/i))
        score += 3
      if (females > 0 && males === 0 && kids === 0 && matchHay(hay, /wine|salad|dessert|ice cream|smoothie/i))
        score += 3
      if (prefs.wantAlcohol && matchHay(hay, ALCOHOL_REGEX)) score += 4
      if (prefs.hungry && matchHay(hay, /main course|burger|bbq|meat|rice|pasta|pizza|platter|food/i)) score += 2
      if (prefs.onDiet && matchHay(hay, /salad|vegetable|light|diet|vg|vegan/i)) score += 2
      if (prefs.cold && matchHay(hay, /hot coffee|hot tea|tea|coffee|soup|warm/i)) score += 2
      if (prefs.thirsty && matchHay(hay, /juice|drink|soda|water|beverage|soft drink|beer|wine|cocktail/i))
        score += 2
    }

    if (sector === "pharmacy") {
      if (prefs.forChild && matchHay(hay, /child|kids|pediatric|baby|infant|syrup|enfant|pediatri|junior/i))
        score += 4
      if (
        prefs.forAdult &&
        matchHay(hay, /adult|tablet|capsule|medicine|medicament|general|pain|fever|headache/i) &&
        !matchHay(hay, /child|kids|pediatric|baby|infant|enfant|pediatri|junior/i)
      )
        score += 4
      if (prefs.forFamily && matchHay(hay, /family|multivitamin|general|first aid|vitamin/i)) score += 2
      if (prefs.headache && matchHay(hay, /pain|paracetamol|analgesic|ibuprofen|headache|fever|aspirin/i))
        score += 3
      if (prefs.coldFlu && matchHay(hay, /cold|flu|cough|syrup|decongest|rhume|toux|expector/i)) score += 3
      if (prefs.allergy && matchHay(hay, /allergy|antihist|hay fever|allerg|loratadine|cetirizine/i)) score += 3
      if (prefs.stomach && matchHay(hay, /stomach|digest|antacid|diarr|constip|gastro|rehydration|ors/i))
        score += 3
      if (prefs.vitamins && matchHay(hay, /vitamin|supplement|mineral|iron|calcium|multivitamin|omega/i))
        score += 3
      if (prefs.skincare && matchHay(hay, /skin|cream|lotion|cosmetic|beauty|sunscreen|moisturizer|soin/i))
        score += 3
    }

    if (sector === "liquor") {
      if (prefs.beer && matchHay(hay, /beer|lager|ale|stout/i)) score += 3
      if (prefs.wine && matchHay(hay, /wine|sparkling|champagne|prosecco/i)) score += 3
      if (prefs.spirits && matchHay(hay, /whisky|whiskey|vodka|rum|gin|cognac|spirit/i)) score += 3
      if (prefs.soft && matchHay(hay, /juice|water|soft drink|soda|virgin|non-alcohol|malt/i)) score += 3
      if (prefs.party && matchHay(hay, /party|pack|crate|beer|spirit|wine/i)) score += 1
      if (prefs.dinner && matchHay(hay, /wine|red|white|rose|dinner/i)) score += 1
      if (prefs.gift && matchHay(hay, /gift|premium|luxury|box|set/i)) score += 1
    }

    if (sector === "retail") {
      if (isElectronics) {
        if (prefs.phones && matchHay(hay, /phone|mobile|tablet|smartphone|iphone|samsung|charger/i)) score += 3
        if (prefs.laptops && matchHay(hay, /laptop|notebook|pc|computer|desktop|macbook/i)) score += 3
        if (prefs.tv && matchHay(hay, /tv|television|audio|speaker|soundbar|headphone|earphone/i)) score += 3
        if (prefs.accessories && matchHay(hay, /cable|adapter|case|cover|usb|mouse|keyboard|accessory/i))
          score += 3
        if (prefs.gaming && matchHay(hay, /game|gaming|console|controller|playstation|xbox/i)) score += 3
        if (prefs.homeOffice && matchHay(hay, /printer|router|wifi|monitor|office|desk/i)) score += 3
      } else if (isBoutique) {
        if (prefs.forMe && matchHay(hay, /shirt|dress|shoe|bag|belt|fashion|wear|cloth|garment/i)) score += 2
        if (prefs.giftHer && matchHay(hay, /women|lady|dress|bag|perfume|jewelry|scarf|gift/i)) score += 3
        if (prefs.giftHim && matchHay(hay, /men|man|shirt|tie|belt|watch|shoe|gift/i)) score += 3
        if (prefs.forKids && matchHay(hay, /kid|child|boy|girl|school|uniform|baby/i)) score += 3
        if (prefs.everyday && matchHay(hay, /casual|everyday|basic|cotton|t-shirt/i)) score += 1
        if (prefs.party && matchHay(hay, /party|event|evening|formal|celebration/i)) score += 2
        if (prefs.work && matchHay(hay, /work|office|formal|suit|blazer|professional/i)) score += 2
      } else {
        if (prefs.essentials && matchHay(hay, /rice|sugar|salt|oil|flour|soap|toothpaste|bread|milk/i)) score += 2
        if (prefs.snacks && matchHay(hay, /snack|biscuit|chips|cookie|chocolate|candy/i)) score += 2
        if (prefs.drinks && matchHay(hay, /drink|juice|water|soda|beer|wine|tea|coffee/i)) score += 2
        if (prefs.household && matchHay(hay, /clean|detergent|household|kitchen|tissue|bleach/i)) score += 2
        if (prefs.party && matchHay(hay, /party|guest|crate|pack|celebration|beer|wine|snack/i)) score += 2
      }
    }

    return { p, score }
  })

  const withScore = scored.filter((x) => x.score > 0)
  if (withScore.length === 0) return products
  withScore.sort((a, b) => b.score - a.score)
  return withScore.map((x) => x.p)
}
