/** Copy for seller registration \u2014 use `pickLang` with `useLanguageStore` / `grandma:lang`. */

import type { Language } from "@/lib/language-store"
import type { Tri } from "@/lib/rwanda-provinces"

export function pickLang(tri: Tri, lang: Language): string {
  return tri[lang] ?? tri.en
}

export const L = {
  companyName: {
    en: "Shop name",
    rw: "Izina ry\u2019iduka",
    fr: "Nom de la boutique",
  },
  phone: { en: "Phone", rw: "Telefoni", fr: "T\u00e9l\u00e9phone" },
  momo: { en: "MoMo code", rw: "Kode ya MoMo", fr: "Code MoMo" },
  owner: { en: "Owner (full name)", rw: "Nyir\u2019iduka (amazina)", fr: "Propri\u00e9taire (nom complet)" },
  category: {
    en: "Shop category",
    rw: "Aho Iduka ribarizwa",
    fr: "Cat\u00e9gorie de boutique",
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
  street: { en: "Street / details", rw: "Umuhanda/Andi makuru", fr: "Rue / d\u00e9tails" },
  logo: { en: "Shop logo (optional)", rw: "Ikirango cy\u2019iduka", fr: "Logo (optionnel)" },
  email: { en: "Email (login)", rw: "Imeri", fr: "E-mail (connexion)" },
  password: { en: "Password", rw: "Ijambo ry\u2019ibanga", fr: "Mot de passe" },
  tin: { en: "TIN / tax ID", rw: "TIN", fr: "N\u00b0 contribuable (TIN)" },
  shopNickname: {
    en: "Shop nickname (optional)",
    rw: "Izina ry\u2019iduka (si ngombwa)",
    fr: "Surnom du magasin (optionnel)",
  },
} satisfies Record<string, Tri>

/** Buyer registration at `/register/buyer` (location labels reuse `L` where applicable). */
export const BUYER_UI = {
  pageTitle: { en: "Buyer", rw: "Umuguzi", fr: "Acheteur" },
  /** Header subtitle \u2014 matches seller shell tone */
  pageSubtitle: {
    en: "Register as a buyer",
    rw: "Iyandikishe nk\u2019umuguzi",
    fr: "Inscription acheteur",
  },
  pageDesc: {
    en: "Create your account on ihute.rw",
    rw: "Kwandikisha konti yawe kuri ihute.rw",
    fr: "Cr\u00e9ez votre compte sur ihute.rw",
  },
  stepUmuguzi: { en: "Buyer", rw: "Umuguzi", fr: "Acheteur" },
  stepPreferences: { en: "Preferences", rw: "Amahitamo", fr: "Pr\u00e9f\u00e9rences" },
  cardStep1: { en: "1 \u2014 Your details", rw: "1 \u2014 Amakuru yawe", fr: "1 \u2014 Vos informations" },
  cardStep2: {
    en: "2 \u2014 Preferences",
    rw: "2 \u2014 Amahitamo",
    fr: "2 \u2014 Pr\u00e9f\u00e9rences",
  },
  cardStep2Desc: {
    en: "Category, preferred shops, payment, and delivery.",
    rw: "Ubwoko bw\u2019amaduka, amaduka, kwishyura, n\u2019ubwohereza.",
    fr: "Cat\u00e9gorie, magasins, paiement et livraison.",
  },
  /** Searchable combobox placeholders (Umurenge / Akagari / Umudugudu) */
  searchUmurenge: { en: "Search sector\u2026", rw: "Shakisha umurenge\u2026", fr: "Chercher le secteur\u2026" },
  searchAkagari: { en: "Search cell\u2026", rw: "Shakisha akagari\u2026", fr: "Chercher la cellule\u2026" },
  searchUmudugudu: { en: "Search village\u2026", rw: "Shakisha umudugudu\u2026", fr: "Chercher le village\u2026" },
  noMatchLocation: { en: "No match.", rw: "Nta bisubizo.", fr: "Aucun r\u00e9sultat." },
  fullName: { en: "Full name", rw: "Amazina", fr: "Nom complet" },
  email: { en: "Email", rw: "Imeri", fr: "E-mail" },
  password: { en: "Password", rw: "Ijambo ry\u2019ibanga", fr: "Mot de passe" },
  location: { en: "Location", rw: "Aho uherereye", fr: "Localisation" },
  signIn: { en: "Sign in", rw: "Injira", fr: "Connexion" },
  haveAccount: { en: "Already have an account?", rw: "Usanzwe ufite konti?", fr: "D\u00e9j\u00e0 un compte ?" },
  shopSectorLabel: {
    en: "Category",
    rw: "Ubwoko bw\u2019amaduka",
    fr: "Cat\u00e9gorie",
  },
  shopSectorHint: {
    en: "Choose a sector to list shops.",
    rw: "Hitamo ubwoko kugira ngo urebe amaduka.",
    fr: "Choisissez un secteur pour voir les magasins.",
  },
  preferredShops: {
    en: "Preferred shops",
    rw: "Amaduka ukunda",
    fr: "Magasins pr\u00e9f\u00e9r\u00e9s",
  },
  preferredShopsHint: {
    en: "We show these first in your shop list.",
    rw: "Aya ni yo abanza mu rutonde rw\u2019amaduka.",
    fr: "Affich\u00e9s en premier dans votre liste.",
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
    fr: "Livraison pr\u00e9f\u00e9r\u00e9e",
  },
  ridersHint: {
    en: "How you usually want orders delivered.",
    rw: "Uko ukunda gutumiza zikagera.",
    fr: "Comment recevoir vos commandes.",
  },
  loadingShops: { en: "Loading shops\u2026", rw: "Gutangiza amaduka\u2026", fr: "Chargement\u2026" },
  noShopsInSector: {
    en: "No shops in this category yet \u2014 try another.",
    rw: "Nta maduka muri ubu bwoko \u2014 gerageza ubundi.",
    fr: "Aucun magasin dans cette cat\u00e9gorie.",
  },
  payMomo: {
    en: "MTN MoMo (Mokash loan @7%)",
    rw: "MTN MoMo (Mokash loan @7%)",
    fr: "MTN MoMo (Mokash loan @7%)",
  },
  payAirtel: { en: "Airtel Money", rw: "Airtel Money", fr: "Airtel Money" },
  payBk: { en: "BK (QuickLoan @3%)", rw: "BK (QuickLoan @3%)", fr: "BK (QuickLoan @3%)" },
  payCash: { en: "Cash on Delivery", rw: "Amafaranga ku gihe cyo kwakira", fr: "Paiement \u00e0 la livraison" },
  riderWalk: { en: "On foot", rw: "Ku maguru", fr: "\u00c0 pied" },
  riderBike: { en: "Bike", rw: "Igare", fr: "V\u00e9lo" },
  riderMoto: { en: "Moto", rw: "Moto", fr: "Moto" },
} satisfies Record<string, Tri>

/** `/register/umuriro` \u2014 Quick Shop UI; Umuriro = flow name (drafts, not direct account_seller). */
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
    rw: "Gura, ubike, wishyure",
    fr: "Acheter, enregistrer, payer",
  },
  shoppingAt: {
    en: "I'm shopping at",
    rw: "Ndagura kuri",
    fr: "J'ach\u00e8te chez",
  },
  phoneOptional: {
    en: "Phone (optional)",
    rw: "Telefoni (si ngombwa)",
    fr: "T\u00e9l\u00e9phone (optionnel)",
  },
  shopCategory: {
    en: "Shop category",
    rw: "Ubwoko bw\u2019iduka",
    fr: "Cat\u00e9gorie de boutique",
  },
  shopCategoryHint: {
    en: "Same as on the home page \u2014 boutique, pharmacy, liquor store, \u2026",
    rw: "Nk\u2019uko biri ku rupapuro rw\u2019ibanze \u2014 butike, farumasi, iduka ry\u2019inzoga, \u2026",
    fr: "Comme l\u2019accueil \u2014 boutique, pharmacie, caviste, \u2026",
  },
  imBuying: { en: "I'm buying", rw: "Ibyo ndagura", fr: "J'ach\u00e8te" },
  imBuyingHint: {
    en: "Search an item, set price & quantity, tap Add to my list \u2014 repeat for soap, salt, bread, etc.",
    rw: "Shakisha igicuruzwa, shyiramo igiciro n\u2019ingano, ukande Ongeraho ku rutonde \u2014 kongera ku bindi byose.",
    fr: "Cherchez, prix et quantit\u00e9, puis Ajouter \u2014 r\u00e9p\u00e9tez pour plusieurs articles.",
  },
  chooseCategory: {
    en: "Choose a shop category first.",
    rw: "Hitamo ubwoko bw\u2019iduka mbere.",
    fr: "Choisissez d\u2019abord une cat\u00e9gorie.",
  },
  noCatalogMatchInCategory: {
    en: "No catalog match in this category \u2014 your text is saved as entered.",
    rw: "Nta bisubizo muri ubu bwoko \u2014 izina ryawe rirakomeza.",
    fr: "Aucun article dans cette cat\u00e9gorie \u2014 votre texte est enregistr\u00e9.",
  },
  unitPrice: { en: "Price (RWF)", rw: "Igiciro (RWF)", fr: "Prix (RWF)" },
  quantity: { en: "Quantity", rw: "Ingano", fr: "Quantit\u00e9" },
  addToList: {
    en: "Add to my list",
    rw: "Ongeraho ku rutonde",
    fr: "Ajouter \u00e0 la liste",
  },
  cartTitle: {
    en: "Your items",
    rw: "Ibicuruzwa byawe",
    fr: "Vos articles",
  },
  cartEmpty: {
    en: "Search and add items above \u2014 soap, salt, bread, and more in one order.",
    rw: "Shakisha hejuru wongeraho ibicuruzwa \u2014 isabune, umunyu, umugati, n\u2019ibindi mu itumiza rimwe.",
    fr: "Cherchez et ajoutez des articles ci-dessus \u2014 tout en une seule commande.",
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
    rw: "Ubutumwa ku mucuruzi (SMS)",
    fr: "Message au vendeur (aper\u00e7u SMS)",
  },
  sellerSmsPreviewHint: {
    en: "Add a valid Rwandan shop phone and an item name to preview. After save, the link uses your request id.",
    rw: "Shyiraho telefoni y\u2019u Rwanda n\u2019izina ry\u2019igicuruzwa kugira ngo ubone ubutumwa. Nyuma yo kubika, link ikoresha indangamuntu.",
    fr: "Ajoutez un mobile rwandais et un article pour l\u2019aper\u00e7u. Apr\u00e8s enregistrement, le lien utilise votre id.",
  },
  copyUssd: { en: "Copy code", rw: "Koporora", fr: "Copier" },
  saveAndPay: {
    en: "Save and pay",
    rw: "Bika wishyure",
    fr: "Enregistrer et payer",
  },
  savedOk: {
    en: "Saved. Dial the code on your phone to pay.",
    rw: "Byabitswe. Hamagara kode kuri telefoni wishyure.",
    fr: "Enregistr\u00e9. Composez le code pour payer.",
  },
  /** Appended when server saved the draft (dev: shop_onboarding_draft). */
  savedDraftStored: {
    en: "Reference: {rid}.",
    rw: "Nimero y\u2019icyemezo: {rid}.",
    fr: "R\u00e9f\u00e9rence : {rid}.",
  },
  /** Dev-only hint when draft storage is unavailable (not shown to buyers in Quick Shop success). */
  savedEchoOnly: {
    en: "Order received on this device. The shop will confirm when the system is connected.",
    rw: "Twakiriye itumiza. Iduka rizasubiza vuba.",
    fr: "Commande re\u00e7ue. Le magasin confirmera d\u00e8s que possible.",
  },
  loginRequired: {
    en: "Sign in to save shops to your account.",
    rw: "Injira kugira ngo ubike amaduka ku konti yawe.",
    fr: "Connectez-vous pour enregistrer.",
  },
  signIn: { en: "Sign in", rw: "Injira", fr: "Connexion" },
  modeQuick: { en: "Quick", rw: "Byihuse", fr: "Rapide" },
  modeAdvanced: { en: "Advanced", rw: "Byimbitse", fr: "Complet" },
  saveOrder: { en: "Save order", rw: "Bika itumiza", fr: "Enregistrer la commande" },
  orderSentQuick: {
    en: "Order sent successfully! Pay on your phone with the MoMo code when you are ready.",
    rw: "Itumiza yoherejwe neza! Ishyura kuri telefoni ukoresheje kode ya MoMo igihe witeguye.",
    fr: "Commande envoy\u00e9e ! Payez sur votre t\u00e9l\u00e9phone avec le code MoMo quand vous \u00eates pr\u00eat.",
  },
  orderSentQuickWithRef: {
    en: "Order sent successfully! Reference {rid}. Pay on your phone with MoMo when ready.",
    rw: "Itumiza yoherejwe neza! Nimero {rid}. Ishyura kuri telefoni ukoresheje MoMo iyo waba witeguye.",
    fr: "Commande envoy\u00e9e ! R\u00e9f\u00e9rence {rid}. Payez par MoMo sur votre t\u00e9l\u00e9phone quand vous voulez.",
  },
  orderSentQuickPendingShop: {
    en: "Order sent! We received your items \u2014 the shop will confirm shortly.",
    rw: "Itumiza yoherejwe! Twakiriye ibicuruzwa byawe \u2014 iduka rizasubiza vuba.",
    fr: "Commande envoy\u00e9e ! Nous avons re\u00e7u vos articles \u2014 le magasin confirmera bient\u00f4t.",
  },
  orderSentAdvanced: {
    en: "Order saved. Track it under My orders.",
    rw: "Itumiza yabitswe. Irebe mu matumiza yawe.",
    fr: "Commande enregistr\u00e9e. Suivez-la dans Mes commandes.",
  },
  trackDialogTitle: { en: "Your order space", rw: "Aho itumiza yawe iri", fr: "Espace commande" },
  trackDialogBody: {
    en: "Signed in as your Ihute account. Open My orders to follow status.",
    rw: "Winjiye ku konti yawe ya Ihute. Fungura amatumiza yawe urebe uko bigenda.",
    fr: "Connect\u00e9 avec votre compte Ihute. Ouvrez Mes commandes pour le suivi.",
  },
  goToMyOrders: { en: "Go to My orders", rw: "Jya ku matumiza yanjye", fr: "Mes commandes" },
  needBuyerAccount: {
    en: "Need a buyer account?",
    rw: "Ukeneye konti y\u2019umuguzi?",
    fr: "Besoin d\u2019un compte acheteur ?",
  },
  createBuyer: { en: "Create buyer account", rw: "Kora konti y\u2019umuguzi", fr: "Cr\u00e9er un compte acheteur" },
  savedEchoShort: {
    en: "The shop will confirm your order shortly.",
    rw: "Iduka rizakwemeza itumiza yawe vuba.",
    fr: "Le magasin confirmera votre commande sous peu.",
  },
  payHowTitle: {
    en: "How will you pay?",
    rw: "Uzishyura ute?",
    fr: "Comment payez-vous ?",
  },
  payMomo: { en: "MoMo (USSD)", rw: "MoMo (USSD)", fr: "MoMo (USSD)" },
  payCash: { en: "Cash at shop", rw: "Kwishyura mu ntoki ku iduka", fr: "Esp\u00e8ces au magasin" },
  readMoMoSmsTitle: {
    en: "Paste MoMo SMS (read confirmation)",
    rw: "Shyiraho SMS ya MoMo (somaho kwemeza)",
    fr: "Collez le SMS MoMo (confirmation)",
  },
  readMoMoSmsHint: {
    en: "After paying, copy the MTN message here. We verify the amount ({total} RWF), transaction ID, date/time, and merchant code.",
    rw: "Nyuma yo kwishyura, koporora ubutumwa bwa MTN ubushyire hano. Dusuzuma amafaranga ({total} RWF), nimero ya transaction, itariki n\u2019isaha, na kode y\u2019umucuruzi.",
    fr: "Apr\u00e8s paiement, collez le SMS MTN. Nous v\u00e9rifions le montant ({total} RWF), l\u2019identifiant, la date et le code marchand.",
  },
  verifySms: { en: "Match to my total", rw: "Gereranya n\u2019itumiza", fr: "Comparer au total" },
  paymentPaidMatched: {
    en: "Status: Paid \u2014 SMS amount matches your order total.",
    rw: "Uko biri: Byishyuwe \u2014 amafaranga muri SMS ahuye n\u2019itumiza.",
    fr: "Statut : pay\u00e9 \u2014 le SMS correspond au total.",
  },
  paymentPaidMatchedWithTxn: {
    en: "Paid \u2014 amount matches your order. MoMo TxId: {txnId}.",
    rw: "Byishyuwe \u2014 amafaranga ahuye n\u2019itumiza. TxId: {txnId}.",
    fr: "Pay\u00e9 \u2014 montant conforme. TxId MoMo : {txnId}.",
  },
  paymentMismatch: {
    en: "Not matched \u2014 SMS shows {got} RWF but your total is {expected} RWF.",
    rw: "Ntibihuye \u2014 SMS ifite {got} RWF, ariko igiteranyo ni {expected} RWF.",
    fr: "\u00c9cart \u2014 SMS {got} RWF, total {expected} RWF.",
  },
  paymentNoAmountInSms: {
    en: "No RWF amount found \u2014 paste the full MoMo SMS.",
    rw: "Nta mafaranga yabonetse \u2014 shyiraho SMS yose ya MoMo.",
    fr: "Aucun montant RWF \u2014 collez le SMS complet.",
  },
  paymentExpiredSms: {
    en: "This SMS is too old \u2014 the transaction must be from the last 15 minutes. Please make a new payment and paste the fresh SMS.",
    rw: "Iyi SMS ni iy\u2019igihe kirekire \u2014 transaction igomba kuba yarakoretse mu minota 15 ishize. Kora ubwishyu bushya ushyireho SMS nshya.",
    fr: "Ce SMS est trop ancien \u2014 la transaction doit dater des 15 derni\u00e8res minutes. Effectuez un nouveau paiement.",
  },
  paymentWrongMerchant: {
    en: "This SMS is for a different shop \u2014 the merchant code does not match. Please pay the correct shop and paste that SMS.",
    rw: "Iyi SMS ni iy\u2019iduka ritandukanye \u2014 kode y\u2019umucuruzi ntago ihuye. Ishyura iduka ryiza ushyireho iyo SMS.",
    fr: "Ce SMS concerne un autre commerce \u2014 le code marchand ne correspond pas. Payez le bon marchand.",
  },
  paymentNoTxId: {
    en: "No transaction ID (TxId) found in this SMS \u2014 paste the complete MoMo confirmation message that contains the TxId.",
    rw: "Nta nimero ya transaction (TxId) yabonetse \u2014 shyiraho ubutumwa bwose bwa MoMo bwemeza bufite TxId.",
    fr: "Aucun identifiant de transaction (TxId) trouv\u00e9 \u2014 collez le SMS MoMo complet avec le TxId.",
  },
  paymentCashSkipSms: {
    en: "Cash at shop \u2014 no MoMo SMS check. Tell the seller when you pay.",
    rw: "Kwishyura mu ntoki ku iduka \u2014 nta SMS ya MoMo. Menyesha umucuruzi.",
    fr: "Esp\u00e8ces au magasin \u2014 pas de SMS MoMo.",
  },
  saveOrderLocked: {
    en: "Pay with MoMo, paste the confirmation SMS, then the Save order button will appear.",
    rw: "Ishyura ukoresheje MoMo, shyiraho SMS yo kwemeza, hanyuma buto ya Bika itumiza izagaragara.",
    fr: "Payez par MoMo, collez le SMS, puis le bouton Enregistrer appara\u00eetra.",
  },
  saveOrderErrMomoSms: {
    en: "Confirm MoMo payment with the SMS before saving the order.",
    rw: "Emeza kwishyura na SMS ya MoMo mbere yo kubika itumiza.",
    fr: "Confirmez le paiement MoMo avec le SMS avant d\u2019enregistrer.",
  },
  saveOrderDbNotConfigured: {
    en: "Order was not saved to the database. Ask admin to set ONBOARDING_MYSQL_* on the server.",
    rw: "Itumiza ntiyabitswe muri database. Saba admin gushyiraho ONBOARDING_MYSQL_* kuri server.",
    fr: "Commande non enregistr\u00e9e en base. Demandez \u00e0 l\u2019admin de configurer ONBOARDING_MYSQL_*.",
  },
  sellerSmsAfterSave: {
    en: "SMS to {phone} after save (if Twilio / SMS webhook is configured).",
    rw: "SMS kuri {phone} nyuma yo kubika (niba Twilio / webhook byashyizweho).",
    fr: "SMS vers {phone} apr\u00e8s enregistrement (si Twilio / webhook est configur\u00e9).",
  },
} satisfies Record<string, Tri>

/** Page chrome (header subtitle + steps). */
export const SELLER_UI = {
  pageSubtitle: {
    en: "Register as a seller",
    rw: "Iyandikishe nk\u2019umucuruzi",
    fr: "Inscription vendeur",
  },
  stepBusiness: { en: "Business", rw: "Ubucuruzi", fr: "Commerce" },
  stepItem: { en: "Items", rw: "Ibicuruzwa", fr: "Articles" },
  /** Step 2 \u2014 catalog + prices & stock (single step). Short label in the step pill. */
  stepItemsStock: { en: "Items", rw: "Ibicuruzwa", fr: "Articles" },
  stepPrices: { en: "Prices & qty", rw: "Igiciro n\u2019ingano", fr: "Prix & qt\u00e9" },
  cardStep1: { en: "1 \u2014 Business", rw: "1 \u2014 Ubucuruzi", fr: "1 \u2014 Commerce" },
  cardStep2Title: { en: "2 \u2014 Items", rw: "2 \u2014 Ibicuruzwa", fr: "2 \u2014 Articles" },
  cardStep2Desc: {
    en: "Add items, then set sale price and quantity on each card (type any amount).",
    rw: "Ongeraho ibicuruzwa, ushyireho igiciro n\u2019ingano kuri buri karita.",
    fr: "Ajoutez des articles, puis prix et quantit\u00e9 sur chaque carte.",
  },
  categorySuggested: {
    en: "Suggested for your category",
    rw: "Bisabye ku bwoko bwawe",
    fr: "Suggestions pour votre cat\u00e9gorie",
  },
  typeToSearchMore: {
    en: "Type 2+ letters to search the full catalog.",
    rw: "Andika inyuguti 2+ kugira ngo ushakishe urutonde rwose.",
    fr: "Tapez 2 lettres ou plus pour chercher tout le catalogue.",
  },
  cardStep3: { en: "3 \u2014 Prices & qty", rw: "3 \u2014 Igiciro n\u2019ingano", fr: "3 \u2014 Prix & quantit\u00e9s" },
  searchProducts: { en: "Search products", rw: "Shakisha ibicuruzwa", fr: "Rechercher" },
  selected: { en: "Selected", rw: "Byatoranijwe", fr: "S\u00e9lection" },
  add: { en: "Add", rw: "Ongeraho", fr: "Ajouter" },
  searching: { en: "Searching\u2026", rw: "Birimo gushakisha\u2026", fr: "Recherche\u2026" },
  noHits: { en: "No results \u2014 try another word.", rw: "Nta bisubizo \u2014 ongera ugerageze.", fr: "Aucun r\u00e9sultat." },
  addOneItem: { en: "Add at least one item to continue.", rw: "Ongeraho nibura kimwe.", fr: "Ajoutez au moins un article." },
  back: { en: "Back", rw: "Subira inyuma", fr: "Retour" },
  next: { en: "Next", rw: "Komeza", fr: "Suivant" },
  submit: { en: "Submit draft", rw: "Ohereza", fr: "Envoyer" },
  saving: { en: "Saving\u2026", rw: "Birimo kubika\u2026", fr: "Enregistrement\u2026" },
  searchProvince: { en: "Search province\u2026", rw: "Shakisha intara\u2026", fr: "Chercher province\u2026" },
  searchDistrict: { en: "Search district\u2026", rw: "Shakisha akarere\u2026", fr: "Chercher district\u2026" },
  selectProvinceFirst: {
    en: "Select province first",
    rw: "Hitamo intara mbere",
    fr: "Choisissez d\u2019abord la province",
  },
  noDistricts: { en: "No districts.", rw: "Nta uturere.", fr: "Aucun district." },
  selectCategory: { en: "Select category", rw: "Hitamo aho iduka ribarizwa", fr: "Choisir la cat\u00e9gorie" },
  selectLocationSector: {
    en: "Select sector",
    rw: "Hitamo umurenge",
    fr: "Choisir le secteur",
  },
  selectCellule: { en: "Select cellule", rw: "Hitamo akagari", fr: "Choisir la cellule" },
  selectVillage: { en: "Select village", rw: "Hitamo umudugudu", fr: "Choisir le village" },
  thItem: { en: "Item", rw: "Igicuruzwa", fr: "Article" },
  thNiki: { en: "NIKI", rw: "NIKI", fr: "NIKI" },
  thQty: { en: "Qty", rw: "Ingano", fr: "Qt\u00e9" },
  thSale: { en: "Sale (RWF)", rw: "Igiciro RWF", fr: "Prix (RWF)" },
  thProfit: {
    en: "Profit (RWF)",
    rw: "Ikiranguzo RWF",
    fr: "Marge (RWF)",
  },
  /** Quantity \u2014 Kinyarwanda label for grid */
  thIngano: { en: "Quantity", rw: "Ingano", fr: "Quantit\u00e9" },
  /** Same NIKI identifier as catalog \u2014 not free-text keywords. */
  thKeywords: {
    en: "Code (NIKI)",
    rw: "Kode (NIKI)",
    fr: "Code (NIKI)",
  },
  placeholderNikiCode: {
    en: "NIKI code\u2026",
    rw: "Kode NIKI\u2026",
    fr: "Code NIKI\u2026",
  },
} satisfies Record<string, Tri>

export const ERR = {
  step1: {
    en: "Fill shop name, phone, owner, category, province, district, sector, cellule, and village.",
    rw: "Uzuza izina, telefoni, nyir\u2019iduka, aho iduka ribarizwa, intara, akarere, umurenge, akagari, n\u2019umudugudu.",
    fr: "Remplissez nom, t\u00e9l\u00e9phone, cat\u00e9gorie, province, district, secteur, cellule et village.",
  },
  missingCompanyName: {
    en: "Enter the shop name.",
    rw: "Andika izina ry\u2019iduka.",
    fr: "Indiquez le nom de la boutique.",
  },
  missingPhone: {
    en: "Enter a phone number.",
    rw: "Andika nimero ya telefoni.",
    fr: "Indiquez un num\u00e9ro de t\u00e9l\u00e9phone.",
  },
  missingEmail: {
    en: "Enter a valid email for your seller account.",
    rw: "Andika imeri y\u2019ukoresha.",
    fr: "Indiquez un e-mail pour le compte vendeur.",
  },
  missingPassword: {
    en: "Choose a password (min. 6 characters).",
    rw: "Hitamo ijambo ry\u2019ibanga.",
    fr: "Choisissez un mot de passe (min. 6 caract\u00e8res).",
  },
  missingTin: {
    en: "Enter your TIN (tax identification number).",
    rw: "Andika TIN yawe.",
    fr: "Indiquez votre num\u00e9ro TIN.",
  },
  missingOwner: {
    en: "Enter the owner\u2019s full name.",
    rw: "Andika amazina y\u2019Nyir\u2019iduka.",
    fr: "Indiquez le nom complet du propri\u00e9taire.",
  },
  missingCategory: {
    en: "Choose where the shop is listed (category).",
    rw: "Hitamo aho iduka ribarizwa.",
    fr: "Choisissez la cat\u00e9gorie de la boutique.",
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
    en: "Scroll up \u2014 the missing field is highlighted below.",
    rw: "Zamuka \u2014 akabanga kari hejuru.",
    fr: "Faites d\u00e9filer vers le haut \u2014 le champ manquant est ci-dessous.",
  },
  step2: {
    en: "Pick at least one item from the catalog.",
    rw: "Hitamo nibura kimwe mu rutonde.",
    fr: "Choisissez au moins un article.",
  },
  step2LineInvalid: {
    en: "Each selected item needs quantity \u2265 1 and sale price \u2265 1 RWF (see the fields under the item).",
    rw: "Buri gicuruzwa ukeneye ingano \u2265 1 n\u2019igiciro cy\u2019igurisha \u2265 1 RWF (reba hepfo y\u2019icyo gicuruzwa).",
    fr: "Chaque article : quantit\u00e9 \u2265 1 et prix de vente \u2265 1 RWF (voir sous l\u2019article).",
  },
  step3: {
    en: "Each line needs quantity \u2265 1 and sale price \u2265 1 RWF.",
    rw: "Umurongo wose ukeneye ingano \u2265 1 n\u2019igiciro \u2265 1 RWF.",
    fr: "Chaque ligne : quantit\u00e9 \u2265 1 et prix \u2265 1 RWF.",
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
    icon: "\ud83d\udeb6",
    tri: {
      en: "Courier on foot",
      rw: "Ku maguru",
      fr: "Livraison \u00e0 pied",
    },
  },
  {
    id: "pickup",
    icon: "\ud83d\udeb2",
    tri: {
      en: "Bike",
      rw: "Igare",
      fr: "V\u00e9lo",
    },
  },
  {
    id: "both",
    icon: "\ud83c\udfcd",
    tri: {
      en: "Moto",
      rw: "Moto",
      fr: "Moto",
    },
  },
]

export function triLine(t: Tri): string {
  return `${t.en} \u00b7 ${t.rw} \u00b7 ${t.fr}`
}
