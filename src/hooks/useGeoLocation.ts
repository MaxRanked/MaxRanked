// src/hooks/useGeoLocation.ts
import { useState, useEffect } from "react";

export function useGeoLocation() {
  const [geo, setGeo] = useState<{
    country: string | null;
    region: string | null;
  }>({
    country: null,
    region: null,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchGeo(attempt = 1) {
      try {
        const response = await fetch("https://ipapi.co/json/"); // token is optional for free tier
        if (!response.ok) throw new Error("Network response was not ok");
        const data = await response.json();

        setGeo({
          country: data.country_name || null,
          region: data.region || null,
          ip: data.ip || null,
        });
      } catch (error) {
        console.error("Geo lookup failed (attempt " + attempt + "):", error);
        if (attempt < 3) {
          setTimeout(() => fetchGeo(attempt + 1), 2000); // retry after 2s
        }
      } finally {
        setLoading(false);
      }
    }

    fetchGeo();
  }, []);

  return { geo, loading };
}
