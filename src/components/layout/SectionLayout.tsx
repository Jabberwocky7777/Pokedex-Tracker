import { useCallback, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, PanelLeftClose, PanelLeftOpen, X, type LucideIcon } from "lucide-react";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { useSettingsStore } from "../../store/useSettingsStore";

export interface SectionItem<T extends string> {
  id: T;
  label: string;
  Icon: LucideIcon;
  /** One line under the label in the phone sheet */
  description?: string;
  /** A short count or note beside the label ("2 today"). Keep it cheap to compute. */
  badge?: ReactNode;
}

export interface SectionGroup<T extends string> {
  /** Heading above the group; omit for a single unlabelled group */
  label?: string;
  items: SectionItem<T>[];
}

interface Props<T extends string> {
  /** Names the navigation for screen readers ("Plan sections") */
  ariaLabel: string;
  groups: SectionGroup<T>[];
  active: T;
  onSelect: (id: T) => void;
  /** Shown under the sections in the sidebar only (a tip, a list of recent trips) */
  sidebarFooter?: ReactNode;
  /** Fold the sidebar to icons whatever the setting says — while a side panel needs the room */
  forceRail?: boolean;
  /** On a phone, the tab shows SectionSheetButton in its own toolbar instead of a bar of its own */
  ownPhoneButton?: boolean;
  children: ReactNode;
}

/**
 * A tab made of sections: Plan, the Pokédex, the tracker.
 *
 * - A phone (narrow, or an iPhone on its side): a "Section ▾" button that opens a sheet
 * - From 768 px: underline tabs that scroll sideways (iPad portrait, half a Split View)
 * - From 1024 px: a sidebar, which folds to an icon rail (useSettingsStore.sidebarCollapsed)
 *
 * The content scrolls on its own (each section brings its PageShell).
 */
export default function SectionLayout<T extends string>({
  ariaLabel,
  groups,
  active,
  onSelect,
  sidebarFooter,
  forceRail = false,
  ownPhoneButton = false,
  children,
}: Props<T>) {
  const collapsedSetting = useSettingsStore((s) => s.sidebarCollapsed);
  const collapsed = collapsedSetting || forceRail;
  const setCollapsed = useSettingsStore((s) => s.setSidebarCollapsed);
  const items = groups.flatMap((g) => g.items);
  const current = items.find((i) => i.id === active) ?? items[0];

  return (
    <div className="flex flex-col lg:roomy:flex-row h-full min-h-0">
      {/* Sidebar (1024 px and up) */}
      <nav
        aria-label={ariaLabel}
        className={`hidden lg:roomy:flex flex-col flex-shrink-0 border-r border-gray-800 overflow-y-auto pl-[env(safe-area-inset-left,0px)] ${
          collapsed ? "w-14" : "w-56"
        }`}
      >
        <div className="flex-1 px-2 py-3">
          {groups.map((group, gi) => (
            <div key={group.label ?? gi} className={gi > 0 ? "mt-4" : ""}>
              {group.label &&
                (collapsed ? (
                  gi > 0 && <div className="mx-2 mb-2 h-px bg-gray-800" aria-hidden="true" />
                ) : (
                  <p className="px-2.5 mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    {group.label}
                  </p>
                ))}
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const on = item.id === current.id;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => onSelect(item.id)}
                        aria-current={on ? "page" : undefined}
                        aria-label={collapsed ? item.label : undefined}
                        title={collapsed ? item.label : undefined}
                        className={`w-full flex items-center gap-2.5 rounded-md text-sm transition-colors ${
                          collapsed ? "justify-center h-10" : "h-8 px-2.5 pointer-coarse:h-11"
                        } ${on ? "bg-gray-800 text-white" : "text-gray-400 hover:text-gray-100 hover:bg-gray-800/60"}`}
                      >
                        <item.Icon size={16} className={on ? "text-indigo-300" : ""} aria-hidden="true" />
                        {!collapsed && (
                          <>
                            <span className="truncate">{item.label}</span>
                            {item.badge != null && (
                              <span className="ml-auto text-xs text-gray-500 tabular-nums">{item.badge}</span>
                            )}
                          </>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {!collapsed && sidebarFooter && <div className="mt-6">{sidebarFooter}</div>}
        </div>
        {!forceRail && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Show section names" : "Hide section names"}
            title={collapsed ? "Show section names" : "Hide section names"}
            className={`m-2 h-9 flex items-center gap-2 rounded-md text-xs text-gray-500 hover:text-gray-200 hover:bg-gray-800/60 ${
              collapsed ? "justify-center" : "px-2.5"
            }`}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            {!collapsed && "Hide"}
          </button>
        )}
      </nav>

      {/* Underline tabs (768–1023 px) */}
      <nav
        aria-label={ariaLabel}
        className="hidden roomy:flex lg:roomy:hidden flex-shrink-0 items-end gap-5 px-4 border-b border-gray-800 overflow-x-auto [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const on = item.id === current.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              aria-current={on ? "page" : undefined}
              className={`flex items-center gap-1.5 flex-shrink-0 py-3 pointer-coarse:min-h-11 text-sm border-b-2 -mb-px transition-colors whitespace-nowrap ${
                on ? "border-indigo-400 text-white" : "border-transparent text-gray-400 hover:text-gray-100"
              }`}
            >
              <item.Icon size={15} aria-hidden="true" />
              {item.label}
              {item.badge != null && <span className="text-xs text-gray-500 tabular-nums">{item.badge}</span>}
            </button>
          );
        })}
      </nav>

      {/* Phone: one button naming the open section */}
      <div
        className={`${ownPhoneButton ? "hidden" : "roomy:hidden"} flex-shrink-0 px-3 py-2 border-b border-gray-800 pl-[max(0.75rem,env(safe-area-inset-left,0px))] pr-[max(0.75rem,env(safe-area-inset-right,0px))]`}
      >
        <SectionSheetButton ariaLabel={ariaLabel} groups={groups} current={current} onSelect={onSelect} />
      </div>

      <div className="flex-1 min-w-0 min-h-0 flex flex-col">{children}</div>
    </div>
  );
}

/** One button naming the open section, opening a sheet with all of them (a phone). */
export function SectionSheetButton<T extends string>({
  ariaLabel,
  groups,
  current,
  onSelect,
  iconOnly = false,
}: {
  ariaLabel: string;
  groups: SectionGroup<T>[];
  current: SectionItem<T>;
  onSelect: (id: T) => void;
  /** Just the section's icon and a chevron, for a crowded toolbar */
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDialogFocus(sheetRef, open, close);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        data-testid="section-menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={iconOnly ? `${ariaLabel}: ${current.label}` : undefined}
        className={`${iconOnly ? "flex-shrink-0" : "w-full"} h-11 flex items-center gap-2 px-3 rounded-lg border bg-gray-900 border-gray-700 text-gray-100 text-sm font-medium`}
      >
        <current.Icon size={16} className="text-indigo-300 flex-shrink-0" aria-hidden="true" />
        {!iconOnly && <span className="truncate">{current.label}</span>}
        {!iconOnly && current.badge != null && (
          <span className="text-xs text-gray-400 tabular-nums">{current.badge}</span>
        )}
        <ChevronDown
          size={16}
          className={`${iconOnly ? "" : "ml-auto "}text-gray-400 flex-shrink-0`}
          aria-hidden="true"
        />
      </button>
      {/* In a portal, so no ancestor's transform or blur becomes what "fixed" is relative to */}
      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-50 bg-black/50" onClick={close} aria-hidden="true" />
            <div
              ref={sheetRef}
              role="dialog"
              aria-modal="true"
              aria-label={ariaLabel}
              tabIndex={-1}
              className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 border-t border-gray-800 rounded-t-2xl shadow-2xl max-h-[80vh] overflow-y-auto"
              style={{
                paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)",
                paddingLeft: "env(safe-area-inset-left)",
                paddingRight: "env(safe-area-inset-right)",
              }}
            >
              <div className="flex items-center justify-between px-4 pt-3 pb-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{ariaLabel}</span>
                <button
                  onClick={close}
                  aria-label="Close"
                  className="p-2.5 -mr-2 rounded-full text-gray-400 hover:text-gray-100 hover:bg-gray-800"
                >
                  <X size={18} />
                </button>
              </div>
              {groups.map((group, gi) => (
                <div key={group.label ?? gi} className="px-2 pb-1">
                  {group.label && (
                    <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      {group.label}
                    </p>
                  )}
                  <ul>
                    {group.items.map((item) => {
                      const on = item.id === current.id;
                      return (
                        <li key={item.id}>
                          <button
                            onClick={() => {
                              onSelect(item.id);
                              close();
                            }}
                            aria-current={on ? "page" : undefined}
                            className={`w-full flex items-start gap-3 px-3 py-2.5 min-h-[48px] rounded-xl text-left transition-colors ${
                              on ? "bg-indigo-500/15" : "hover:bg-gray-800"
                            }`}
                          >
                            <item.Icon
                              size={20}
                              aria-hidden="true"
                              className={`mt-0.5 flex-shrink-0 ${on ? "text-indigo-300" : "text-gray-400"}`}
                            />
                            <span className="min-w-0 flex-1">
                              <span
                                className={`flex items-center gap-2 text-sm font-medium ${on ? "text-indigo-200" : "text-gray-100"}`}
                              >
                                {item.label}
                                {item.badge != null && (
                                  <span className="ml-auto text-xs font-normal text-gray-400 tabular-nums">
                                    {item.badge}
                                  </span>
                                )}
                              </span>
                              {item.description && (
                                <span className="block text-xs text-gray-400 mt-0.5">{item.description}</span>
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
