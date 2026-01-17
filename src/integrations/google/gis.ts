/**
 * Load Google Identity Services script and wait for it to be available
 */
export function loadGIS(): Promise<GoogleAccounts> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.google?.accounts) {
      resolve(window.google);
      return;
    }

    // Check if script is already in the DOM
    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existingScript) {
      // Wait for it to load
      const checkInterval = setInterval(() => {
        if (window.google?.accounts) {
          clearInterval(checkInterval);
          resolve(window.google);
        }
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Google Identity Services failed to load'));
      }, 10000);
      return;
    }

    // Script should be loaded via index.html, but if not, we'll wait for it
    const checkInterval = setInterval(() => {
      if (window.google?.accounts) {
        clearInterval(checkInterval);
        resolve(window.google);
      }
    }, 100);

    // Timeout after 10 seconds
    setTimeout(() => {
      clearInterval(checkInterval);
      reject(new Error('Google Identity Services script not found. Ensure the script tag is in index.html'));
    }, 10000);
  });
}
