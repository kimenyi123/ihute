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
  email: { en: "Email (login)", rw: "Imeri", fr: "E-mail (connexion)" },
  password: { en: "Password", rw: "Ijambo ry'ibanga", fr: "Mot de passe" },
  tin: { en: "TIN / tax ID", rw: "TIN", fr: "N° contribuable (TIN)" },
  shopNickname: {
    en: "Shop nickname (optional)",
    rw: "Izina ry'iduka (si ngombwa)",
    fr: "Surnom du magasin (optionnel)",
  },
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

/** `/register/umuriro` — Quick Shop UI; Umuriro = flow name (drafts, not direct account_seller). */
export const UMURIRO_UI = {
  pageTitle: {
    en: "Quick Shop",
    rw: "Quick Shop",
    fr: "Quick Shop",
  },
  payWithMomo: {
    en: "Pay with MoMo",
    rw: "Ishyura na MoMo",
    fr: "Payer avec MoMo",
  },
  dialMomo: {
    en: "Dial",
    rw: "Hamagara",
    fr: "Composer",
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
  phoneOptional: {
    en: "Phone (optional)",
    rw: "Telefoni (biteganyijwe)",
    fr: "Téléphone (optionnel)",
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
    en: "Search an item, set price & quantity, tap Add to my list — repeat for soap, salt, bread, etc.",
    rw: "Shakisha igicuruzwa, shyiramo igiciro n’umubare, ukande Ongeraho — kongera ku bindi byose.",
    fr: "Cherchez, prix et quantité, puis Ajouter — répétez pour plusieurs articles.",
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
  addToList: {
    en: "Add to my list",
    rw: "Ongeraho ku rutonde",
    fr: "Ajouter à la liste",
  },
  cartTitle: {
    en: "Your items",
    rw: "Ibicuruzwa byawe",
    fr: "Vos articles",
  },
  cartEmpty: {
    en: "Search and add items above — soap, salt, bread, and more in one order.",
    rw: "Shakisha hejuru wongeraho ibicuruzwa — isabune, umunyu, umugati, n’ibindi mu komande imwe.",
    fr: "Cherchez et ajoutez des articles ci-dessus — tout en une seule commande.",
  },
  cartItemCount: {
    en: "{count} item(s)",
    rw: "Ibicuruzwa {count}",
    fr: "{count} article(s)",
  },
  removeItem: { en: "Remove", rw: "Kuraho", fr: "Retirer" },
  emptyCartError: {
    en: "Add at least one item to your list.",
    rw: "Ongeraho nibura igicuruzwa kimwe ku rutonde.",
    fr: "Ajoutez au moins un article.",
  },
  totalLabel: { en: "Total to pay (RWF)", rw: "Amafaranga yose", fr: "Total (RWF)" },
  ussdLabel: { en: "MTN MoMo USSD", rw: "Kode USSD ya MTN MoMo", fr: "USSD MTN MoMo" },
  sellerSmsPreview: {
    en: "Message to seller (SMS preview)",
    rw: "Ubutumwa kuri mucuruzi (SMS)",
    fr: "Message au vendeur (aperçu SMS)",
  },
  sellerSmsPreviewHint: {
    en: "Add a valid Rwandan shop phone and an item name to preview. After save, the link uses your request id.",
    rw: "Shyiraho telefoni y’u Rwanda n’izina ry’igicuruzwa kugira ngo ubone ubutumwa. Nyuma yo kubika, link ikoresha indangamuntu.",
    fr: "Ajoutez un mobile rwandais et un article pour l’aperçu. Après enregistrement, le lien utilise votre id.",
  },
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
  /** Appended when server saved the draft (dev: shop_onboarding_draft). */
  savedDraftStored: {
    en: "Reference: {rid}.",
    rw: "Nimero y’icyemezo: {rid}.",
    fr: "Référence : {rid}.",
  },
  /** Dev-only hint when draft storage is unavailable (not shown to buyers in Quick Shop success). */
  savedEchoOnly: {
    en: "Order received on this device. The shop will confirm when the system is connected.",
    rw: "Twakiriye komande. Iduka rizasubira vuba.",
    fr: "Commande reçue. Le magasin confirmera dès que possible.",
  },
  loginRequired: {
    en: "Sign in to save shops to your account.",
    rw: "Injira kugira ngo ubike amaduka ku konti yawe.",
    fr: "Connectez-vous pour enregistrer.",
  },
  signIn: { en: "Sign in", rw: "Injira", fr: "Connexion" },
  modeQuick: { en: "Quick", rw: "Byihuse", fr: "Rapide" },
  modeAdvanced: { en: "Advanced", rw: "Buruzuye", fr: "Complet" },
  saveOrder: { en: "Save order", rw: "Bika komande", fr: "Enregistrer la commande" },
  orderSentQuick: {
    en: "Order sent successfully! Pay on your phone with the MoMo code when you are ready.",
    rw: "Komande yoherejwe neza! Ishyura kuri telefoni ukoresheje kode ya MoMo iyo waba witeguye.",
    fr: "Commande envoyée ! Payez sur votre téléphone avec le code MoMo quand vous êtes prêt.",
  },
  orderSentQuickWithRef: {
    en: "Order sent successfully! Reference {rid}. Pay on your phone with MoMo when ready.",
    rw: "Komande yoherejwe neza! Nimero {rid}. Ishyura kuri telefoni ukoresheje MoMo iyo waba witeguye.",
    fr: "Commande envoyée ! Référence {rid}. Payez par MoMo sur votre téléphone quand vous voulez.",
  },
  orderSentQuickPendingShop: {
    en: "Order sent! We received your items — the shop will confirm shortly.",
    rw: "Komande yoherejwe! Twakiriye ibicuruzwa byawe — iduka rizasubira vuba.",
    fr: "Commande envoyée ! Nous avons reçu vos articles — le magasin confirmera bientôt.",
  },
  orderSentAdvanced: {
    en: "Order saved. Track it under My orders.",
    rw: "Komande yabitswe. Ireba mu komande zawe.",
    fr: "Commande enregistrée. Suivez-la dans Mes commandes.",
  },
  trackDialogTitle: { en: "Your order space", rw: "Ahantu hawe", fr: "Espace commande" },
  trackDialogBody: {
    en: "Signed in as your Ihute account. Open My orders to follow status.",
    rw: "Winjiye ku konti yawe ya Ihute. Fungura komande zawe urebe uko bigenda.",
    fr: "Connecté avec votre compte Ihute. Ouvrez Mes commandes pour le suivi.",
  },
  goToMyOrders: { en: "Go to My orders", rw: "Kuri komande zanjye", fr: "Mes commandes" },
  needBuyerAccount: {
    en: "Need a buyer account?",
    rw: "Ukeneye konti y'umuguzi?",
    fr: "Besoin d’un compte acheteur ?",
  },
  createBuyer: { en: "Create buyer account", rw: "Kora konti y'umuguzi", fr: "Créer un compte acheteur" },
  savedEchoShort: {
    en: "The shop will confirm your order shortly.",
    rw: "Iduka rizasubira vuba rihite ibyo wateguye.",
    fr: "Le magasin confirmera votre commande sous peu.",
  },
  payHowTitle: {
    en: "How will you pay?",
    rw: "Uzishyura ate?",
    fr: "Comment payez-vous ?",
  },
  payMomo: { en: "MoMo (USSD)", rw: "MoMo (USSD)", fr: "MoMo (USSD)" },
  payCash: { en: "Cash at shop", rw: "Amafaranga ku iduka", fr: "Espèces au magasin" },
  readMoMoSmsTitle: {
    en: "Paste MoMo SMS (read confirmation)",
    rw: "Shyiraho SMS ya MoMo (somaho kwemeza)",
    fr: "Collez le SMS MoMo (confirmation)",
  },
  readMoMoSmsHint: {
    en: "After paying, copy the MTN message here. We match the RWF amount to your total ({total} RWF).",
    rw: "Nyuma yo kwishyura, kopiye ubutumwa bwa MTN ubushyire hano. Duhuza amafaranga n’itegeko ({total} RWF).",
    fr: "Après paiement, collez le SMS MTN. Nous comparons au total ({total} RWF).",
  },
  verifySms: { en: "Match to my total", rw: "Gereranya n’itegeko", fr: "Comparer au total" },
  paymentPaidMatched: {
    en: "Status: Paid — SMS amount matches your order total.",
    rw: "Uko biri: Byishyuwe — amafaranga muri SMS ahuye n’itegeko.",
    fr: "Statut : payé — le SMS correspond au total.",
  },
  paymentMismatch: {
    en: "Not matched — SMS shows {got} RWF but your total is {expected} RWF.",
    rw: "Ntibihuye — SMS ifite {got} RWF, ariko total ni {expected} RWF.",
    fr: "Écart — SMS {got} RWF, total {expected} RWF.",
  },
  paymentNoAmountInSms: {
    en: "No RWF amount found — paste the full MoMo SMS.",
    rw: "Nta mafranga yabonetse — shyiraho SMS yose.",
    fr: "Aucun montant RWF — collez le SMS complet.",
  },
  paymentCashSkipSms: {
    en: "Cash at shop — no MoMo SMS check. Tell the seller when you pay.",
    rw: "Amafaranga ku iduka — nta SMS ya MoMo. Menyesha mucuruzi.",
    fr: "Espèces au magasin — pas de SMS MoMo.",
  },
  saveOrderLocked: {
    en: "Pay with MoMo, paste the confirmation SMS, then the Save order button will appear.",
    rw: "Wishyure ukoreshe MoMo, shyiraho SMS yo kwemeza, hanyuma buto ya Bika komande izagaragara.",
    fr: "Payez par MoMo, collez le SMS, puis le bouton Enregistrer apparaîtra.",
  },
  saveOrderErrMomoSms: {
    en: "Confirm MoMo payment with the SMS before saving the order.",
    rw: "Emeza kwishyura na SMS ya MoMo mbere yo kubika komande.",
    fr: "Confirmez le paiement MoMo avec le SMS avant d'enregistrer.",
  },
  sellerSmsAfterSave: {
    en: "SMS to {phone} after save (if Twilio / SMS webhook is configured).",
    rw: "SMS kuri {phone} nyuma yo kubika (niba Twilio / webhook byashyizweho).",
    fr: "SMS vers {phone} après enregistrement (si Twilio / webhook est configuré).",
  },
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
  missingEmail: {
    en: "Enter a valid email for your seller account.",
    rw: "Andika imeri y'ukoresha.",
    fr: "Indiquez un e-mail pour le compte vendeur.",
  },
  missingPassword: {
    en: "Choose a password (min. 6 characters).",
    rw: "Hitamo ijambo ry'ibanga.",
    fr: "Choisissez un mot de passe (min. 6 caractères).",
  },
  missingTin: {
    en: "Enter your TIN (tax identification number).",
    rw: "Andika TIN yawe.",
    fr: "Indiquez votre numéro TIN.",
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
