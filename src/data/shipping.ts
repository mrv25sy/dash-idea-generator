// Shipping companies → governorate → city/area → branches. Edit freely — add companies, areas or branches here.
export const OTHER_BRANCH = "فرع آخر / تفاصيل إضافية";

export type ShippingCompany = { id: string; name: string; branches: Record<string, Record<string, string[]>> };

export const SHIPPING_COMPANIES: ShippingCompany[] = [
  {
    id: "qadmous",
    name: "القدموس",
    branches: {
      "Damascus": { "دمشق": ["الحمراء", "البرامكة", "الحريقة", "شارع بغداد"] },
      "Rif Dimashq": {
        "جرمانا": ["جرمانا"], "حرستا": ["حرستا"], "صحنايا": ["صحنايا"], "عرطوز": ["عرطوز"],
        "النبك": ["النبك"], "يبرود": ["يبرود"], "القطيفة": ["القطيفة"], "دير عطية": ["دير عطية"],
        "قطنا": ["قطنا"], "ضاحية الأسد": ["ضاحية الأسد"],
      },
      "Aleppo": { "حلب": ["الجميلية", "الفرقان"] },
      "Homs": { "حمص": ["الحضارة", "الزهراء"], "ريف حمص - شين": ["شين"], "ريف حمص - الحواش": ["الحواش"] },
      "Hama": { "حماة": ["الكراج", "ساحة العاصي"], "سلمية": ["سلمية"], "السقيلبية": ["السقيلبية"], "محردة": ["محردة"], "مصياف": ["مصياف"] },
      "Latakia": { "اللاذقية": ["العوينة", "شارع بغداد", "حي الزراعة", "الصليبة"], "جبلة": ["الملعب", "سخابة"] },
      "Tartus": {
        "طرطوس": ["بلدية المدينة", "الكراج القديم", "سوق الهال", "المنطقة الصناعية", "المنطار"],
        "مدينة القدموس": ["مدينة القدموس"], "بانياس": ["بانياس"], "الشيخ بدر": ["الشيخ بدر"],
      },
      "As-Suwayda": { "السويداء": ["ساحة تشرين"], "شهبا": ["شهبا"], "صلخد": ["صلخد"] },
      "Quneitra": { "القنيطرة": ["خان أرنبة", "مدينة البعث"] },
      "Deir ez-Zor": { "دير الزور": ["الفرع الرئيسي"] },
      "Al-Hasakah": { "الحسكة": ["وسط المدينة"], "القامشلي": ["شارع القوتلي"] },
      "Raqqa": { "الرقة": ["الفرع الرئيسي"] },
      "Idlib": { "إدلب": ["الفرع الرئيسي"] },
      "Daraa": { "درعا": ["حي القصور"], "الصنمين": ["الصنمين"] },
    },
  },
];

const govOf = (companyId: string, governorate: string) => SHIPPING_COMPANIES.find((c) => c.id === companyId)?.branches[governorate] ?? {};

/** Cities/areas inside a governorate. */
export const areasFor = (companyId: string, governorate: string) => Object.keys(govOf(companyId, governorate));

/** Branches inside an area, always ending with the "other" option. */
export const branchesFor = (companyId: string, governorate: string, area: string) => [...(govOf(companyId, governorate)[area] ?? []), OTHER_BRANCH];

export const companyName = (id: string) => SHIPPING_COMPANIES.find((c) => c.id === id)?.name ?? id;
