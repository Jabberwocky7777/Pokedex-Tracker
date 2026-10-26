import { LayoutGrid, BookOpen, Map, Calculator, Wand2, Swords, Search, Zap, Settings, NotebookPen, Gamepad2, type LucideIcon } from "lucide-react";
import type { AppTab } from "../../types";

export interface TabDef {
  id: AppTab;
  label: string;
  /** For the phone's bottom bar, where there is less room */
  shortLabel: string;
  Icon: LucideIcon;
}

/** Every tab in navigation order. Settings comes last: the header shows it as a gear on the right. */
export const TAB_DEFS: TabDef[] = [
  { id: "tracker",        label: "Tracker",     shortLabel: "Tracker",  Icon: LayoutGrid },
  { id: "games",          label: "My games",    shortLabel: "My games", Icon: Gamepad2   },
  { id: "pokedex",        label: "Pokédex",     shortLabel: "Pokédex",  Icon: BookOpen   },
  { id: "attackdex",      label: "Attackdex",   shortLabel: "Attacks",  Icon: Swords     },
  { id: "routes",         label: "Routes",      shortLabel: "Routes",   Icon: Map        },
  { id: "catch-calc",     label: "Catch Calc",  shortLabel: "Catch",    Icon: Calculator },
  { id: "designer",       label: "Designer",    shortLabel: "Designer", Icon: Wand2      },
  { id: "trainer-lookup", label: "Trainer",     shortLabel: "Trainer",  Icon: Search     },
  { id: "damage-calc",    label: "Damage Calc", shortLabel: "Damage",   Icon: Zap        },
  { id: "notes",          label: "Notes",       shortLabel: "Notes",    Icon: NotebookPen },
  { id: "settings",       label: "Settings",    shortLabel: "Settings", Icon: Settings   },
];

export const tabDef = (id: AppTab): TabDef => TAB_DEFS.find((t) => t.id === id)!;

/** The tabs on the phone's bottom bar; the rest are in its More sheet. */
export const MOBILE_PRIMARY_TABS: AppTab[] = ["tracker", "pokedex", "routes", "games"];
