import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Search, Sprout } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import brandLogo from "./assets/shamba-link-logo.jpg";
import type { KnowledgeGuide } from "./types";

const categoryLabels = {
  crop: { en: "Crops", sw: "Mazao" },
  pest: { en: "Pests", sw: "Wadudu" },
  disease: { en: "Plant health", sw: "Afya ya mimea" },
  soil: { en: "Soil", sw: "Udongo" },
  livestock: { en: "Livestock", sw: "Mifugo" },
  prevention: { en: "Prevention", sw: "Kinga" },
} as const;

type GuideCategory = keyof typeof categoryLabels;

export function KnowledgeLibrary() {
  const [language, setLanguage] = useState<"en" | "sw">("en");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState<GuideCategory | "">("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const query = useQuery({
    queryKey: ["knowledge-guides", debouncedSearch, category],
    queryFn: () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (category) params.set("category", category);
      return api<{ data: KnowledgeGuide[] }>(`/api/guides?${params.toString()}`);
    },
  });

  const selectedCategory = language === "en" ? "All topics" : "Mada zote";
  const categoryLabel = (value: string) => value in categoryLabels
    ? categoryLabels[value as GuideCategory][language]
    : value;

  return <main className="knowledge-page">
    <header className="knowledge-header"><Link className="brand" to="/"><img className="brand-mark" src={brandLogo} alt="" /><span>shamba<span className="brand-link">link</span></span></Link><Link to="/" className="header-link">Home</Link></header>
    <section className="knowledge-content">
      <span className="knowledge-kicker"><BookOpen size={16} /> {language === "en" ? "PRACTICAL FARMING KNOW-HOW" : "ELIMU YA KILIMO KWA VITENDO"}</span>
      <div className="knowledge-title-row"><div><h1>{language === "en" ? "Farming knowledge library" : "Maktaba ya maarifa ya kilimo"}</h1><p>{language === "en" ? "Clear, practical guidance for healthier crops, soil and livestock." : "Mwongozo rahisi na wa vitendo kwa mazao, udongo na mifugo yenye afya."}</p></div><label className="knowledge-language">{language === "en" ? "Language" : "Lugha"}<select value={language} onChange={(event) => setLanguage(event.target.value as "en" | "sw")}><option value="en">English</option><option value="sw">Kiswahili</option></select></label></div>
      <div className="knowledge-filters"><label className="knowledge-search"><Search size={17} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={language === "en" ? "Search guides..." : "Tafuta miongozo..."} /></label><label className="knowledge-category"><span>{language === "en" ? "Topic" : "Mada"}</span><select value={category} onChange={(event) => setCategory(event.target.value as GuideCategory | "")}><option value="">{selectedCategory}</option>{Object.entries(categoryLabels).map(([key, value]) => <option key={key} value={key}>{value[language]}</option>)}</select></label></div>
      {query.isLoading ? <p className="knowledge-status">{language === "en" ? "Loading farming guides..." : "Inapakia miongozo ya kilimo..."}</p>
        : query.isError ? <p className="knowledge-error" role="alert">{language === "en" ? "We couldn't load the guides. Check your connection and try again." : "Miongozo haikupatikana. Angalia mtandao kisha ujaribu tena."}</p>
          : query.data?.data.length ? <div className="knowledge-guides">{query.data.data.map((guide) => <article className="knowledge-guide" key={guide.id}><div className="knowledge-guide-top"><span><Sprout size={15} /> {categoryLabel(guide.category)}</span><small>{language === "en" ? "PRACTICAL GUIDE" : "MWONGOZO WA VITENDO"}</small></div><h2>{language === "en" ? guide.titleEn : guide.titleSw}</h2><p className="knowledge-summary">{language === "en" ? guide.summaryEn : guide.summarySw}</p><details><summary>{language === "en" ? "Read guide" : "Soma mwongozo"}</summary><p className="knowledge-body">{language === "en" ? guide.bodyEn : guide.bodySw}</p></details></article>)}</div>
            : <p className="knowledge-status">{language === "en" ? "No guides match your search yet." : "Hakuna miongozo inayolingana na utafutaji wako."}</p>}
      <p className="knowledge-note">{language === "en" ? "These guides provide general education. For urgent crop or livestock problems, contact a qualified local agricultural professional." : "Miongozo hii ni ya elimu ya jumla. Kwa matatizo ya dharura ya mazao au mifugo, wasiliana na mtaalamu wa kilimo aliyehitimu wa eneo lako."}</p>
    </section>
  </main>;
}
