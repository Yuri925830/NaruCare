import type { MedicalDocumentCopy } from "../medicalDocumentCopy";
import type { DocumentConversationCopy } from "../documentConversationCopy";
import es from "./es.json";
import fr from "./fr.json";
import de from "./de.json";
import pt_BR from "./pt-BR.json";
import ru from "./ru.json";
import ar from "./ar.json";
import hi from "./hi.json";
import id from "./id.json";
import vi from "./vi.json";
import th from "./th.json";
import tr from "./tr.json";
import it from "./it.json";
import nl from "./nl.json";
import pl from "./pl.json";
import uk from "./uk.json";
import ms from "./ms.json";
import tl from "./tl.json";
import mn from "./mn.json";
import uz from "./uz.json";
import bn from "./bn.json";
import ur from "./ur.json";
import fa from "./fa.json";
import ne from "./ne.json";
import my from "./my.json";

export const documentLocaleBundles = {
  "es": es,
  "fr": fr,
  "de": de,
  "pt-BR": pt_BR,
  "ru": ru,
  "ar": ar,
  "hi": hi,
  "id": id,
  "vi": vi,
  "th": th,
  "tr": tr,
  "it": it,
  "nl": nl,
  "pl": pl,
  "uk": uk,
  "ms": ms,
  "tl": tl,
  "mn": mn,
  "uz": uz,
  "bn": bn,
  "ur": ur,
  "fa": fa,
  "ne": ne,
  "my": my,
} satisfies Record<string, { medical: MedicalDocumentCopy; conversation: DocumentConversationCopy }>;

export const documentFeatureLocales = ["en", "zh-CN", "ko", "ja", ...Object.keys(documentLocaleBundles)];

/** Match configured locales and common browser language tags without losing regional packs. */
export function resolveDocumentLocale(locale: string): string {
  const normalized = locale.trim().replaceAll("_", "-").toLowerCase();
  const exact = documentFeatureLocales.find((code) => code.toLowerCase() === normalized);
  if (exact) return exact;
  const language = normalized.split("-")[0];
  if (language === "zh") return "zh-CN";
  if (language === "pt") return "pt-BR";
  if (language === "fil") return "tl";
  return documentFeatureLocales.includes(language) ? language : "en";
}
