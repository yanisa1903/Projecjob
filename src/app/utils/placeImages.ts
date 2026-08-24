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
      `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(title)}&gsrnamespace=6&gsrlimit=6&prop=imageinfo&iiprop=url&iiurlwidth=900&format=json&origin=*`,
    );
    if (!commonsResponse.ok) return wikipediaImage ? [wikipediaImage] : [];

    const data = await commonsResponse.json() as {
      query?: { pages?: Record<string, { imageinfo?: Array<{ thumburl?: string; url?: string }> }> };
    };
    const nearbyImages = Object.values(data.query?.pages || {})
      .map((page) => page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url || '')
      .filter(Boolean);
    return [...new Set([wikipediaImage, ...nearbyImages].filter(Boolean))].slice(0, 3);
  } catch {
    return [];
  }
}
