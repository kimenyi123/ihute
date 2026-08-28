/**
 * eRx Market copy — Kinyarwanda-first, VERBATIM from the validated UX spec
 * ihute_erx_sample_v4.html (CEO + CTO, 28 Aug 2026). Do not reword without a
 * new signed-off spec; the strings are intentionally not in lib/translations.ts
 * because the flow is Kinyarwanda-first with embedded English hints.
 */

export const ERX_STEP_NAMES = [
  "Fungura urwandiko rw'imiti",
  "Imiti yasabwe",
  "Amafarumasi akwegereye",
  "Ibiciro no kwishyura",
  "Gukurikirana itumiza",
] as const

export const ERX_COPY = {
  brandSub: "eRx ya Minisiteri y'Ubuzima · Powered by Ishyiga",
  hieUp: "HIE: UP",
  stepPill: (n: number) => `Intambwe ${n}/5`,
  backButton: "Subira inyuma",

  // Step 1 — unlock
  unlockTitle: "Fungura urwandiko rw'imiti",
  unlockTitleEn: "· open your e-prescription",
  unlockLead:
    "Andika kode wahawe kuri SMS, hanyuma ufungure ukoresheje kimwe: telefoni, amazina, cyangwa indangamuntu.",
  // Red two-level personal-data block (verbatim; masked patient name mid-sentence)
  privacyBold: "Amakuru bwite arafunze.",
  privacyPre: "Urwandiko ruboneka nka ",
  privacyPost:
    " — amazina, telefoni n'indangamuntu bifungurwa gusa n'urufunguzo rw'umurwayi (two-level access block). Buri gufungura kwandikwa.",
  unlockButton: "Fungura urwandiko",

  // Step 2 — prescription
  rxTitle: "Imiti yasabwe",
  rxUnlockedChip: "BIFUNGUWE",
  rxLead: (patient: string, code: string) => `Urwandiko rw'imiti rwa ${patient} · ${code}`,
  rxAvgLine: (avg: string, total: string) =>
    `Igiciro cy'isoko (average): ${avg} RWF/unité · ≈ ${total} RWF`,
  rxTotal: "Igiteranyo (isoko)",
  rxPriceFromPharmacy: "Igiciro nyakuri kizemejwe n'farumasi nyuma yo kohereza ubusabe.",
  rxFindButton: "Shakisha amafarumasi ankwegereye",

  // Step 3 — candidates
  nearTitle: "Amafarumasi akwegereye",
  nearTitleEn: "· nearest first",
  nearLead:
    "Gusaba kwemeza bijya kuri farumasi zose — uhereye ku ikwegereye. Kuramo iyo udashaka.",
  nearLeadBoldPart: "farumasi zose",
  noteBlueRw:
    "Kode z'imiti za Minisiteri zitandukanye n'iza farumasi — ni yo mpamvu farumasi ikwegereye ari yo yemeza imiti n'igiciro nyakuri mbere yo kwishyura.",
  noteBlueEn: "MoH drug codes differ from pharmacy codes; candidates must confirm item and price.",
  sortChips: [
    ["dist", "Hafi"],
    ["stars", "★ Amanota"],
    ["acc", "Stock ukuri"],
    ["sync", "Sync"],
  ] as const,
  cardEstimate: (total: string, sync: number) =>
    `Igiciro giteganyijwe ≈ ${total} RWF · aheruka kugaragara: iminota ${sync}`,
  sendAll: (n: number) => `Ohereza kuri farumasi zose (${n})`,
  sendSome: (n: number) => `Ohereza kuri farumasi (${n})`,
  selectAll: "Hitamo byose",
  pageOf: (page: number, totalPages: number, total: number) =>
    `${page}/${totalPages} · farumasi ${total}`,
  showingRange: (from: number, to: number, total: number) =>
    `Zerekana ${from}–${to} muri ${total}`,
  prevPage: "Inyuma",
  nextPage: "Komeza",

  // Step 4 — quotes
  quotesTitle: "Ibiciro biraza",
  quotesTitleEn: "· pharmacies are answering",
  quotesLeadReady: "Ushobora guhitamo ako kanya — ntutegereze bose.",
  quotesLeadWaiting: "Ihangane gato…",
  quotesLeadOthers: "Abandi baracyahamagarwa.",
  quotesOrderPrefix: (id: string) => `Itumiza ${id}.`,
  stopCalling: "■ Hagarika guhamagara · Stop calling",
  chipCalling: "ARIMO GUHAMAGARWA…",
  chipInserted: "YASHYIZWE MU POS",
  chipInsertFailed: "NTABWO BYASHOBOKA",
  chipStopped: "BYAHAGARITSWE",
  chipDeclined: "NTABWO BIHARI",
  chipFull: (n: number, total: number) => `YEMEJE ${n}/${total}`,
  chipPartial: (n: number, total: number) => `IGICE ${n}/${total}`,
  waitLine: "Ihangane gato — farumasi irimo kwemeza imiti n'igiciro…",
  declinedLine: "Iyi farumasi ntabwo ifite imiti yose ubu.",
  partialOf: (need: number) => `kuri ${need}`,
  quoteMeta: (deliveryFee: string, etaMin: number) =>
    `harimo delivery ${deliveryFee} · iminota ${etaMin}`,
  chooseButton: "Hitamo wishyure",
  abamakeTitle: "ABAMAKE — igiciro gito kuri buri muti",
  abamakeWaiting: "turacyategereje…",

  // Step 4 — pay
  payTitle: (pharmacy: string) => `Ishyura ${pharmacy}`,
  payLeadFull: "Imiti yose yemejwe.",
  payLeadPartial:
    "Igice cyemejwe — ibisigaye biguma kuri eRx yawe, indi farumasi ishobora kubirangiza.",
  payDiscount: "Igabanywa",
  payDeliveryLabel: "Uburyo bwo kubona imiti · delivery",
  delPharmacyTitle: "🏠 Delivery ya farumasi",
  delPharmacySub: (etaMin: number) => `ku buriri cyangwa mu rugo · iminota ${etaMin}`,
  delRiderTitle: (icon: string, word: string, name: string) => `${icon} ${word} ya ${name}`,
  delRiderSub: (etaMin: number) => `Seller Central rider · iminota ${etaMin}`,
  delPickupTitle: "🚶 Njye kuyifatira",
  delPickupSub: "Kuri farumasi · nta kiguzi",
  delPickupChosen: "🚶 Kuyifatira kuri farumasi",
  delRidersComing:
    "Abamotari bo kuri Seller Central baraza bakagira icyo batanga — nibaboneka bazagaragara hano.",
  payTotal: "Igiteranyo",
  momoLabel: "Numero ya MoMo",
  momoPlaceholder: "07__ ___ ___",
  payButton: (total: string) => `Ishyura ${total} RWF na MoMo`,
  backToQuotes: "Subira ku biciro",

  // Step 5 — track
  holdBanner: (code: string) => ({
    prefix: "✔ Kwishyura byakiriwe. Imiti yawe yabitswe: ",
    bold: `eRx ${code} iri kuri HOLD`,
    suffix: " — isubira ubusa mu masaha 4 itaratangwa.",
  }),
  orderTitle: (id: string) => `Itumiza ${id}`,
  chipHeld: "eRx HELD",
  chipDelivered: "YAFASHWE",
  tlPaid: "Byishyuwe na MoMo",
  tlPaidSub: (time: string, ref: string) => `${time} · ref ${ref}`,
  tlPos: "YASHYIZWE MU POS",
  tlPosSub: "Ishyiga POS · ihute.rw pending orders",
  tlInvoice: "Fagitire ya RRA yasohotse",
  tlInvoiceSub: (inv: string) => `VSDC · ${inv}`,
  tlTransit: "Biri mu nzira",
  tlAwaitPickup: "Bigutegereje kuri farumasi",
  tlTransitSub: (label: string, fee: string) => `${label} · ${fee} RWF`,
  tlAwaitPickupSub: "Uzayifate wenda SMS — nta kiguzi",
  tlDone: "Byatanzwe — eRx yavuguruwe muri eBuzima",
  tlDoneFullSub: "Urwandiko rwuzuye",
  tlDonePartialSub: "Ibisigaye biguma kuri eRx yawe",
  arrivedPickup: "✅ YAFASHWE — kanda hano",
  arrivedDelivery: "✅ YAFASHWE — kanda hano",
  arrivedHintPickup: "Kanda iyo umaze kuyifata kuri farumasi.",
  arrivedHintDelivery: "Kanda igihe uwazanye imiti ahageze.",

  // Step 5 — rate
  rateTitle: "Tanga amanota",
  rateTitleEn: "· rate to finish",
  rateLead:
    "Amanota yawe ni yo abika farumasi ku murongo: aboneka kuri ihute.rw, agafasha abandi barwayi guhitamo.",
  ratePharmacyLabel: (name: string) => `${name} — farumasi`,
  rateRiderLabel: (label: string) => `Uwazanye imiti — ${label}`,
  rateSubmit: "Ohereza amanota urangize",
  doneBanner: (phStars: number, pharmacy: string, rdStars: number) =>
    `🎉 Murakoze! Amanota yawe (★ ${phStars}) yageze kuri ${pharmacy}${rdStars ? ` n'uwazanye imiti (★ ${rdStars})` : ""}. Ni yo ntambwe ituma amafarumasi aguma ari ay'ukuri kandi aboneka.`,
  respondersTitle: "Abamenyeshejwe — bose basubije",
  responderChosen: "YAHISEMO — arategura",
  responderClosed: "IMENYESHEJWE — itumiza ryafunzwe",
  respondersHint: "Farumasi zitatoranyijwe zirekura imiti zari zabitse ako kanya.",
  finishButton: "Byarangiye — urundi rwandiko",
  anotherRx: "Urundi rwandiko",
} as const

/** Formats a number the way the spec does: rounded, en-US thousands separators. */
export function fmtRwf(n: number): string {
  return Math.round(n).toLocaleString("en-US")
}
