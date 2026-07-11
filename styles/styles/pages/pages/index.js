const stored = localStorage.getItem(STORAGE_KEY);
if (stored) {
  const l = JSON.parse(stored);
localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DATA));
