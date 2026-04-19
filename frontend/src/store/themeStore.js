import { create } from 'zustand';

const STORAGE_KEY = 'jurix_theme';

const getInitialTheme = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'dark';
  } catch {
    return 'dark';
  }
};

const applyTheme = (theme) => {
  if (theme === 'light') {
    document.body.classList.add('light');
  } else {
    document.body.classList.remove('light');
  }
};

// Apply on module load (before React renders)
applyTheme(getInitialTheme());

const useThemeStore = create((set) => ({
  theme: getInitialTheme(),
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
      return { theme: next };
    }),
}));

export default useThemeStore;
