/** Copy for seller registration — use `pickLang` with `useLanguageStore` / `grandma:lang`. */

import type { Language } from "@/lib/language-store"
import type { Tri } from "@/lib/rwanda-provinces"

export function pickLang(tri: Tri, lang: Language): string {
  return tri[lang] ?? tri.en
}

export const L = {
  companyName: {
    en: "Shop name",
    rw: "Izina ry'iduka",
    fr: "Nom de la boutique",
  },
  phone: { en: "Phone", rw: "Telefoni", fr: "Téléphone" },
  momo: { en: "MoMo code", rw: "Kode ya MoMo", fr: "Code MoMo" },
  owner: { en: "Owner (full name)", rw: "Nyir'iduka (amazina)", fr: "Propriétaire (nom complet)" },
  category: {
    en: "Shop category",
    rw: "Aho Iduka ribarizwa",
    fr: "Catégorie de boutique",
  },
  delivery: { en: "Delivery preference", rw: "Uko ukunda kohereza", fr: "Mode de livraison" },
  province: { en: "Province", rw: "Intara", fr: "Province" },
  district: { en: "District", rw: "Akarere", fr: "District" },
  locationSector: {
    en: "Sector",
    rw: "Umurenge",
    fr: "Secteur",
  },
  cellule: { en: "Cellule", rw: "Akagari", fr: "Cellule" },
  village: { en: "Village (umudugudu)", rw: "Umudugudu", fr: "Village" },
  street: { en: "Street / details", rw: "Umuhanda/Andi makuru", fr: "Rue / détails" },
  logo: { en: "Shop logo (optional)", rw: "Ikirango cy'iduka", fr: "Logo (optionnel)" },
} satisfies Record<string, Tri>

/** Buyer registration at `/register/buyer` (location labels reuse `L` where applicable). */
export const BUYER_UI = {
  pageTitle: { en: "Buyer", rw: "Umuguguzi", fr: "Acheteur" },
  /** Header subtitle — matches seller shell tone */
  pageSubtitle: {
    en: "Register as a buyer",
    rw: "Iyandikishe nk'umuguzi",
    fr: "Inscription acheteur",
  },
  pageDesc: {
    en: "Create your account on ihute.rw",
    rw: "Kwandikisha konti yawe kuri ihute.rw",
    fr: "Créez votre compte sur ihute.rw",
  },
  stepUmuguzi: { en: "Buyer", rw: "Umuguzi", fr: "Acheteur" },
  stepPreferences: { en: "Preferences", rw: "Amahitamo", fr: "Préférences" },
  cardStep1: { en: "1 — Your details", rw: "1 — Amakuru yawe", fr: "1 — Vos informations" },
  cardStep2: {
    en: "2 — Preferences",
    rw: "2 — Amahitamo",
    fr: "2 — Préférences",
  },
  cardStep2Desc: {
    en: "Category, preferred shops, payment, and delivery.",
    rw: "Ubwoko bw'amaduka, amaduka, kwishyura, n'ubwohereza.",
    fr: "Catégorie, magasins, paiement et livraison.",
  },
  /** Searchable combobox placeholders (Umurenge / Akagari / Umudugudu) */
  searchUmurenge: { en: "Search sector…", rw: "Shakisha umurenge…", fr: "Chercher le secteur…" },
  searchAkagari: { en: "Search cell…", rw: "Shakisha akagari…", fr: "Chercher la cellule…" },
  searchUmudugudu: { en: "Search village…", rw: "Shakisha umudugudu…", fr: "Chercher le village…" },
  noMatchLocation: { en: "No match.", rw: "Nta bisubizo.", fr: "Aucun résultat." },
  fullName: { en: "Full name", rw: "Amazina", fr: "Nom complet" },
  email: { en: "Email", rw: "Imeri", fr: "E-mail" },
  password: { en: "Password", rw: "Ijambo ry'ibanga", fr: "Mot de passe" },
  location: { en: "Location", rw: "Aho uherereye", fr: "Localisation" },
  signIn: { en: "Sign in", rw: "Injira", fr: "Connexion" },
  haveAccount: { en: "Already have an account?", rw: "Usanzwe ufite konti?", fr: "Déjà un compte ?" },
  shopSectorLabel: {
    en: "Category",
    rw: "Ubwoko bw'amaduka",
    fr: "Catégorie",
  },
  shopSectorHint: {
    en: "Choose a sector to list shops.",
    rw: "Hitamo ubwoko kugira ngo urebe amaduka.",
    fr: "Choisissez un secteur pour voir les magasins.",
  },
  preferredShops: {
    en: "Preferred shops",
    rw: "Amaduka ukunda",
    fr: "Magasins préférés",
  },
  preferredShopsHint: {
    en: "We show these first in your shop list.",
    rw: "Dutanga mbere mu rutonde rw'amaduka.",
    fr: "Affichés en premier dans votre liste.",
  },
  allShops: { en: "All shops", rw: "Amaduka yose", fr: "Tous les magasins" },
  paymentMode: {
    en: "Preferred payment mode",
    rw: "Uburyo bwo kwishyura",
    fr: "Mode de paiement",
  },
  ridersTitle: {
    en: "Preferred delivery",
    rw: "Uburyo bwo kohereza",
    fr: "Livraison préférée",
  },
  ridersHint: {
    en: "How you usually want orders delivered.",
    rw: "Uko ukunda gutumiza zikagera.",
    fr: "Comment recevoir vos commandes.",
  },
  loadingShops: { en: "Loading shops…", rw: "Gutangiza amaduka…", fr: "Chargement…" },
  noShopsInSector: {
    en: "No shops in this category yet — try another.",
    rw: "Nta maduka muri ubu bwoko — gerageza ubundi.",
    fr: "Aucun magasin dans cette catégorie.",
  },
  payMomo: {
    en: "MTN MoMo (Mokash loan @7%)",
    rw: "MTN MoMo (Mokash loan @7%)",
    fr: "MTN MoMo (Mokash loan @7%)",
  },
  payAirtel: { en: "Airtel Money", rw: "Airtel Money", fr: "Airtel Money" },
  payBk: { en: "BK (QuickLoan @3%)", rw: "BK (QuickLoan @3%)", fr: "BK (QuickLoan @3%)" },
  payCash: { en: "Cash on Delivery", rw: "Amafaranga ku isaha", fr: "Paiement à la livraison" },
  riderWalk: { en: "On foot", rw: "Ku maguru", fr: "À pied" },
  riderBike: { en: "Bike", rw: "Igare", fr: "Vélo" },
  riderMoto: { en: "Moto", rw: "Moto", fr: "Moto" },
} satisfies Record<string, Tri>

/** `/register/umuriro` — quick shop + pay (MoMo USSD) while logged in. */
export const UMURIRO_UI = {
  pageSubtitle: {
    en: "Save a shop & pay (Umuriro)",
    rw: "Bika iduka ukishyure (Umuriro)",
    fr: "Enregistrer une boutique et payer",
  },
  cardTitle: {
    en: "Shop, Save, Pay",
    rw: "Iduka, ubike, ishyure",
    fr: "Boutique, enregistrer, payer",
  },
  shoppingAt: {
    en: "I'm shopping at",
    rw: "Nduka kuri",
    fr: "J’achète chez",
  },
  shopCategory: {
    en: "Shop category",
    rw: "Ubwoko bw'iduka",
    fr: "Catégorie de boutique",
  },
  shopCategoryHint: {
    en: "Same as on the home page — boutique, pharmacy, liquor store, …",
    rw: "Nk'aho ku rubuga — butike, farumasi, liquor store, …",
    fr: "Comme l’accueil — boutique, pharmacie, caviste, …",
  },
  imBuying: { en: "I'm buying", rw: "Nagura", fr: "J’achète" },
  imBuyingHint: {
    en: "Search the catalog in the category above, or type any name.",
    rw: "Shakisha muri ubu bwoko hejuru, cyangwa wandike uko ukeneye.",
    fr: "Cherchez dans cette catégorie, ou saisissez un nom libre.",
  },
  chooseCategory: {
    en: "Choose a shop category first.",
    rw: "Hitamo ubwoko bw'iduka mbere.",
    fr: "Choisissez d'abord une catégorie.",
  },
  noCatalogMatchInCategory: {
    en: "No catalog match in this category — your text is saved as entered.",
    rw: "Nta bisubizo muri ubu bwoko — izina ryawe rirakomeza.",
    fr: "Aucun article dans cette catégorie — votre texte est enregistré.",
  },
  unitPrice: { en: "Price (RWF)", rw: "Igiciro (RWF)", fr: "Prix (RWF)" },
  quantity: { en: "Quantity", rw: "Umubare", fr: "Quantité" },
  totalLabel: { en: "Total to pay (RWF)", rw: "Amafaranga yose", fr: "Total (RWF)" },
  ussdLabel: { en: "MTN MoMo USSD", rw: "Kode USSD ya MTN MoMo", fr: "USSD MTN MoMo" },
  copyUssd: { en: "Copy code", rw: "Kopiya", fr: "Copier" },
  saveAndPay: {
    en: "Save and pay",
    rw: "Bika uhishyure",
    fr: "Enregistrer et payer",
  },
  savedOk: {
    en: "Saved. Dial the code on your phone to pay.",
    rw: "Byabitswe. Hamagara kode kuri telefoni.",
    fr: "Enregistré. Composez le code pour payer.",
  },
  loginRequired: {
    en: "Sign in to save shops to your account.",
    rw: "Injira kugira ngo ubike amaduka ku konti yawe.",
    fr: "Connectez-vous pour enregistrer.",
  },
  signIn: { en: "Sign in", rw: "Injira", fr: "Connexion" },
} satisfies Record<string, Tri>

/** Page chrome (header subtitle + steps). */
export const SELLER_UI = {
  pageSubtitle: {
    en: "Register as a seller",
    rw: "Iyandikishe nk'ucuruzi",
    fr: "Inscription vendeur",
  },
  stepBusiness: { en: "Business", rw: "Ubucuruzi", fr: "Commerce" },
  stepItem: { en: "Items", rw: "Ibicuruzwa", fr: "Articles" },
  /** Step 2 — catalog + prices & stock (single step). Short label in the step pill. */
  stepItemsStock: { en: "Items", rw: "Ibicuruzwa", fr: "Articles" },
  stepPrices: { en: "Prices & qty", rw: "Igiciro n'umubare", fr: "Prix & qté" },
  cardStep1: { en: "1 — Business", rw: "1 — Ubucuruzi", fr: "1 — Commerce" },
  cardStep2Title: { en: "2 — Items", rw: "2 — Ibicuruzwa", fr: "2 — Articles" },
  cardStep2Desc: {
    en: "Add items, then set sale price and quantity on each card (type any amount).",
    rw: "Ongeraho ibicuruzwa, uhite igiciro n'umubare kuri buri karita.",
    fr: "Ajoutez des articles, puis prix et quantité sur chaque carte.",
  },
  categorySuggested: {
    en: "Suggested for your category",
    rw: "Byerekana ku bwoko bwawe",
    fr: "Suggestions pour votre catégorie",
  },
  typeToSearchMore: {
    en: "Type 2+ letters to search the full catalog.",
    rw: "Andika inyuguti 2+ kugira ngo ushakishe urutonde rwose.",
    fr: "Tapez 2 lettres ou plus pour chercher tout le catalogue.",
  },
  cardStep3: { en: "3 — Prices & qty", rw: "3 — Igiciro n'umubare", fr: "3 — Prix & quantités" },
  searchProducts: { en: "Search products", rw: "Shakisha ibicuruzwa", fr: "Rechercher" },
  selected: { en: "Selected", rw: "Byatoranijwe", fr: "Sélection" },
  add: { en: "Add", rw: "Ongeraho", fr: "Ajouter" },
  searching: { en: "Searching…", rw: "Rishakisha…", fr: "Recherche…" },
  noHits: { en: "No results — try another word.", rw: "Nta bisubizo — ongera ugerageze.", fr: "Aucun résultat." },
  addOneItem: { en: "Add at least one item to continue.", rw: "Ongeraho nibura kimwe.", fr: "Ajoutez au moins un article." },
  back: { en: "Back", rw: "Subira inyuma", fr: "Retour" },
  next: { en: "Next", rw: "Komeza", fr: "Suivant" },
  submit: { en: "Submit draft", rw: "Ohereza", fr: "Envoyer" },
  saving: { en: "Saving…", rw: "Biri kubika…", fr: "Enregistrement…" },
  searchProvince: { en: "Search province…", rw: "Shakisha intara…", fr: "Chercher province…" },
  searchDistrict: { en: "Search district…", rw: "Shakisha akarere…", fr: "Chercher district…" },
  selectProvinceFirst: {
    en: "Select province first",
    rw: "Hitamo intara mbere",
    fr: "Choisissez d'abord la province",
  },
  noDistricts: { en: "No districts.", rw: "Nta makere.", fr: "Aucun district." },
  selectCategory: { en: "Select category", rw: "Hitamo aho iduka ribarizwa", fr: "Choisir la catégorie" },
  selectLocationSector: {
    en: "Select sector",
    rw: "Hitamo umurenge",
    fr: "Choisir le secteur",
  },
  selectCellule: { en: "Select cellule", rw: "Hitamo akagari", fr: "Choisir la cellule" },
  selectVillage: { en: "Select village", rw: "Hitamo umudugudu", fr: "Choisir le village" },
  thItem: { en: "Item", rw: "Ikintu", fr: "Article" },
  thNiki: { en: "NIKI", rw: "NIKI", fr: "NIKI" },
  thQty: { en: "Qty", rw: "Umubare", fr: "Qté" },
  thSale: { en: "Sale (RWF)", rw: "Igiciro RWF", fr: "Prix (RWF)" },
  thProfit: {
    en: "Profit (RWF)",
    rw: "Ikiranguzo RWF",
    fr: "Marge (RWF)",
  },
  /** Quantity — Kinyarwanda label for grid */
  thIngano: { en: "Quantity", rw: "Ingano", fr: "Quantité" },
  /** Same NIKI identifier as catalog — not free-text keywords. */
  thKeywords: {
    en: "Code (NIKI)",
    rw: "Kode (NIKI)",
    fr: "Code (NIKI)",
  },
  placeholderNikiCode: {
    en: "NIKI code…",
    rw: "Kode NIKI…",
    fr: "Code NIKI…",
  },
} satisfies Record<string, Tri>

export const ERR = {
  step1: {
    en: "Fill shop name, phone, owner, category, province, district, sector, cellule, and village.",
    rw: "Uzuza izina, telefoni, nyir'iduka, aho iduka ribarizwa, intara, akarere, umurenge, akagari, n'umudugudu.",
    fr: "Remplissez nom, téléphone, catégorie, province, district, secteur, cellule et village.",
  },
  missingCompanyName: {
    en: "Enter the shop name.",
    rw: "Andika izina ry'iduka.",
    fr: "Indiquez le nom de la boutique.",
  },
  missingPhone: {
    en: "Enter a phone number.",
    rw: "Andika nimero ya telefoni.",
    fr: "Indiquez un numéro de téléphone.",
  },
  missingOwner: {
    en: "Enter the owner’s full name.",
    rw: "Andika amazina y'Nyir'iduka.",
    fr: "Indiquez le nom complet du propriétaire.",
  },
  missingCategory: {
    en: "Choose where the shop is listed (category).",
    rw: "Hitamo aho iduka ribarizwa.",
    fr: "Choisissez la catégorie de la boutique.",
  },
  missingProvince: {
    en: "Choose a province.",
    rw: "Hitamo intara.",
    fr: "Choisissez une province.",
  },
  missingDistrict: {
    en: "Choose a district.",
    rw: "Hitamo akarere.",
    fr: "Choisissez un district.",
  },
  missingLocationSector: {
    en: "Choose sector (umurenge).",
    rw: "Hitamo umurenge.",
    fr: "Choisissez le secteur (umurenge).",
  },
  missingCellule: {
    en: "Choose a cellule (akagari).",
    rw: "Hitamo akagari.",
    fr: "Choisissez une cellule.",
  },
  missingVillage: {
    en: "Choose a village (umudugudu).",
    rw: "Hitamo umudugudu.",
    fr: "Choisissez un village.",
  },
  step1ScrollHint: {
    en: "Scroll up — the missing field is highlighted below.",
    rw: "Zamuka — akabanga kari hejuru.",
    fr: "Faites défiler vers le haut — le champ manquant est ci-dessous.",
  },
  step2: {
    en: "Pick at least one item from the catalog.",
    rw: "Hitamo nibura kimwe mu rutonde.",
    fr: "Choisissez au moins un article.",
  },
  step2LineInvalid: {
    en: "Each selected item needs quantity ≥ 1 and sale price ≥ 1 RWF (see the fields under the item).",
    rw: "Buri kintu ukeneye umubare ≥ 1 n'igiciro cy'igurisha ≥ 1 RWF (reba hepfo y'icyo kintu).",
    fr: "Chaque article : quantité ≥ 1 et prix de vente ≥ 1 RWF (voir sous l’article).",
  },
  step3: {
    en: "Each line needs quantity ≥ 1 and sale price ≥ 1 RWF.",
    rw: "Umurongo wose ukeneye umubare ≥ 1 n'igiciro ≥ 1 RWF.",
    fr: "Chaque ligne : quantité ≥ 1 et prix ≥ 1 RWF.",
  },
  logoType: { en: "Please choose an image file.", rw: "Hitamo ifoto.", fr: "Choisissez une image." },
  logoSize: { en: "Logo must be under 2.5 MB.", rw: "Logo ntarengera 2.5 MB.", fr: "Logo maximum 2,5 Mo." },
} satisfies Record<string, Tri>

export const DELIVERY_MODES: {
  id: "delivery" | "pickup" | "both"
  icon: string
  tri: Tri
}[] = [
  {
    id: "delivery",
    icon: "🚶",
    tri: {
      en: "Courier on foot",
      rw: "Amaguru",
      fr: "Livraison à pied",
    },
  },
  {
    id: "pickup",
    icon: "🚲",
    tri: {
      en: "Bike",
      rw: "Igare",
      fr: "Vélo",
    },
  },
  {
    id: "both",
    icon: "🏍",
    tri: {
      en: "Moto",
      rw: "Moto",
      fr: "Moto",
    },
  },
]

export function triLine(t: Tri): string {
  return `${t.en} · ${t.rw} · ${t.fr}`
}
