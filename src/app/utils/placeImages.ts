export const officialTempleImages = [
  'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/201607277_-_Wat_Phra_Kaew_-_Bangkok_-_5340.jpg/960px-201607277_-_Wat_Phra_Kaew_-_Bangkok_-_5340.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/20160727_-_Guardian_-_Wat_Phra_Kaew_-_Bangkok_-_5281.jpg/960px-20160727_-_Guardian_-_Wat_Phra_Kaew_-_Bangkok_-_5281.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/20160727_-_Guardian_-_Wat_Phra_Kaew_-_Bangkok_-_5284.jpg/960px-20160727_-_Guardian_-_Wat_Phra_Kaew_-_Bangkok_-_5284.jpg',
];

export function uniqueImageUrls(images: string[]) {
  const seen = new Set<string>();
  return images.filter((image) => {
    if (!image.trim()) return false;
    const key = image
      .split('?')[0]
      .split('#')[0]
      .replace(/\/thumb\/([^/]+)\/\d+px-[^/]+\//i, '/$1/')
      .split('/').pop()
      ?.replace(/^\d+px-/i, '')
      .toLowerCase() || image.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function lockThreeImages(images: string[]) {
  return uniqueImageUrls(images).slice(0, 3);
}

export async function fetchPlaceImages(title: string, latitude?: string | number, longitude?: string | number) {
  try {
    const wikipediaResponse = await fetch(
      `https://th.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
    );
    let wikipediaImage = '';
    if (wikipediaResponse.ok) {
      const data = await wikipediaResponse.json() as {
        originalimage?: { source?: string };
        thumbnail?: { source?: string };
      };
      wikipediaImage = data.originalimage?.source || data.thumbnail?.source || '';
    }

    if (latitude === undefined || longitude === undefined) {
      return wikipediaImage ? [wikipediaImage] : [];
    }

    const commonsResponse = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&generator=geosearch&ggsprimary=all&ggsnamespace=6&ggsradius=1200&ggscoord=${latitude}|${longitude}&ggslimit=20&prop=imageinfo&iiprop=url&iiurlwidth=900&format=json&origin=*`,
    );
    if (!commonsResponse.ok) return wikipediaImage ? [wikipediaImage] : [];

    const data = await commonsResponse.json() as {
      query?: { pages?: Record<string, { imageinfo?: Array<{ thumburl?: string; url?: string }> }> };
    };
    const nearbyImages = Object.values(data.query?.pages || {})
      .map((page) => page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url || '')
      .filter(Boolean);
    return uniqueImageUrls([wikipediaImage, ...nearbyImages]).slice(0, 3);
  } catch {
    return [];
  }
}
