import { ListTodo } from "lucide-react";
import type { MetaData, NotesSection, Pokemon } from "../../types";
import { useSettingsStore } from "../../store/useSettingsStore";
import { PageHeader, PageShell } from "../shared/Page";
import SegmentedControl, { type SegmentOption } from "../shared/SegmentedControl";
import WorkingOnPanel from "./WorkingOnPanel";

interface Props {
  allPokemon: Pokemon[];
  meta: MetaData;
}

const SECTIONS: SegmentOption<NotesSection>[] = [
  { value: "working", label: "Working on", icon: <ListTodo size={14} aria-hidden="true" /> },
];

/** Your own planning: the "Working on" list (more sections follow). */
export default function NotesTab({ allPokemon }: Props) {
  const section = useSettingsStore((s) => s.notesSection);
  const setSection = useSettingsStore((s) => s.setNotesSection);
  const shown = SECTIONS.some((s) => s.value === section) ? section : "working";

  return (
    <div className="flex flex-col h-full">
      <PageShell width="reading">
        <PageHeader
          title="Notes"
          subtitle="Your own planning: what you're working on, kept with your account and synced."
          actions={<SegmentedControl ariaLabel="Notes section" size="sm" value={shown} onChange={setSection} options={SECTIONS} />}
        />
        {shown === "working" && <WorkingOnPanel allPokemon={allPokemon} />}
      </PageShell>
    </div>
  );
}
