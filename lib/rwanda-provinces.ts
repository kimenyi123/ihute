/** Rwanda administrative provinces and districts (30 districts). Labels in EN / RW / FR. */

export type ProvinceId = "kigali" | "eastern" | "northern" | "southern" | "western"

export type Tri = { en: string; rw: string; fr: string }

export const PROVINCES: { id: ProvinceId; tri: Tri; districts: string[] }[] = [
  {
    id: "kigali",
    tri: { en: "Kigali City", rw: "Umujyi wa Kigali", fr: "Ville de Kigali" },
    districts: ["Gasabo", "Kicukiro", "Nyarugenge"].sort(),
  },
  {
    id: "eastern",
    tri: { en: "Eastern Province", rw: "Intara y'Iburasirasuba", fr: "Province de l'Est" },
    districts: ["Bugesera", "Gatsibo", "Kayonza", "Kirehe", "Ngoma", "Nyagatare", "Rwamagana"].sort(),
  },
  {
    id: "northern",
    tri: { en: "Northern Province", rw: "Intara y'Amajyaruguru", fr: "Province du Nord" },
    districts: ["Burera", "Gakenke", "Gicumbi", "Musanze", "Rulindo"].sort(),
  },
  {
    id: "southern",
    tri: { en: "Southern Province", rw: "Intara y'Amajyepfo", fr: "Province du Sud" },
    districts: ["Gisagara", "Huye", "Kamonyi", "Muhanga", "Nyamagabe", "Nyanza", "Nyaruguru", "Ruhango"].sort(),
  },
  {
    id: "western",
    tri: { en: "Western Province", rw: "Intara y'Iburengerazuba", fr: "Province de l'Ouest" },
    districts: ["Karongi", "Ngororero", "Nyabihu", "Nyamasheke", "Rubavu", "Rusizi", "Rutsiro"].sort(),
  },
]

export const DEFAULT_PROVINCE_ID: ProvinceId = "kigali"

const byId = new Map(PROVINCES.map((p) => [p.id, p]))

export function provinceById(id: string | undefined): (typeof PROVINCES)[number] | undefined {
  if (!id) return undefined
  return byId.get(id as ProvinceId)
}

export function districtsForProvince(provinceId: string | undefined): string[] {
  return provinceById(provinceId)?.districts ?? []
}

export function triLine(t: Tri): string {
  return `${t.en} · ${t.rw} · ${t.fr}`
}
