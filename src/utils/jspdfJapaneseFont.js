let cachedBase64 = null;
let cachedFontLoadPromise = null;

const arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export const ensureJapaneseFont = async (doc, options = {}) => {
  const {
    fontUrl = '/fonts/NotoSansJP-Regular.ttf',
    fontName = 'NotoSansJP',
    vfsFileName = 'NotoSansJP-Regular.ttf'
  } = options;

  const registerFontToDoc = (base64) => {
    doc.addFileToVFS(vfsFileName, base64);
    doc.addFont(vfsFileName, fontName, 'normal');
    doc.setFont(fontName, 'normal');
  };

  if (cachedBase64) {
    try {
      registerFontToDoc(cachedBase64);
      return { loaded: true, fontName };
    } catch (e) {
      return { loaded: false, fontName: null, error: e };
    }
  }

  if (!cachedFontLoadPromise) {
    cachedFontLoadPromise = (async () => {
      const res = await fetch(fontUrl);
      if (!res.ok) {
        throw new Error(`Failed to load font: ${res.status} ${res.statusText}`);
      }
      const ab = await res.arrayBuffer();
      const base64 = arrayBufferToBase64(ab);
      cachedBase64 = base64;
      return true;
    })();
  }

  try {
    await cachedFontLoadPromise;
    registerFontToDoc(cachedBase64);
    return { loaded: true, fontName };
  } catch (e) {
    cachedBase64 = null;
    cachedFontLoadPromise = null;
    return { loaded: false, fontName: null, error: e };
  }
};
