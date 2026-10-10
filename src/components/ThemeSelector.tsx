import { themes } from '../themes';
import { useSettingsStore } from '../store/useSettingsStore';

export default function ThemeSelector() {
  const theme = useSettingsStore(s => s.theme);
  const setTheme = useSettingsStore(s => s.setTheme);

  return (
    <select
      value={theme}
      onChange={e => setTheme(e.target.value)}
      aria-label="Colour theme"
      className="rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-2 py-1 cursor-pointer hover:bg-gray-700 transition-colors"
    >
      {themes.map(t => (
        <option key={t.id} value={t.id}>{t.label}</option>
      ))}
    </select>
  );
}
