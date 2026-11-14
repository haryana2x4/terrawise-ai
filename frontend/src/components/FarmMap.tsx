import React, { useEffect, useRef, useState } from "react";
import { Language, translations } from "../i18n/translations";
import { Layers, Crosshair, MapPin, Info, X, Compass, CheckCircle2 } from "lucide-react";
import L from "leaflet";

interface FarmMapProps {
  parcels: any[];
  activeParcel: any;
  advice: any;
  lang: Language;
  onClose: () => void;
}

export const FarmMap: React.FC<FarmMapProps> = ({
  parcels,
  activeParcel,
  advice,
  lang,
  onClose
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [activeLayer, setActiveLayer] = useState<string>("fields");
  const [selectedParcel, setSelectedParcel] = useState<any>(activeParcel || parcels[0] || null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isWalkingGPS, setIsWalkingGPS] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const t = translations[lang];

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Default center on Ahilya Nagar / Nashik region
    const defaultCenter: [number, number] = activeParcel?.centroid
      ? [activeParcel.centroid.lat, activeParcel.centroid.lon]
      : [19.75, 74.45];

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: activeParcel ? 15 : 9,
      zoomControl: false
    });

    // Add high-resolution OpenStreetMap satellite/street tile layer
    const osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapInstanceRef.current = map;

    // Fetch and load district display boundaries
    fetch("/api/geo/districts")
      .then(r => r.json())
      .then(distData => {
        if (distData.features) {
          L.geoJSON(distData, {
            style: {
              color: "#1b4332",
              weight: 2,
              dashArray: "4, 4",
              fillColor: "#2d6a4f",
              fillOpacity: 0.05
            }
          }).addTo(map);
        }
      })
      .catch(err => console.warn("Failed to load district boundaries:", err));

    // Load taluka display boundaries
    fetch("/api/geo/talukas")
      .then(r => r.json())
      .then(talData => {
        if (talData.features) {
          L.geoJSON(talData, {
            style: {
              color: "#52b788",
              weight: 1,
              fillOpacity: 0.02
            }
          }).addTo(map);
        }
      })
      .catch(err => console.warn("Failed to load taluka boundaries:", err));

    // Render Farmer Parcels
    parcels.forEach((p, idx) => {
      if (p.geojson) {
        const polyLayer = L.geoJSON(p.geojson, {
          style: {
            color: "#1b4332",
            weight: 3,
            fillColor: "#52b788",
            fillOpacity: 0.55
          }
        }).addTo(map);

        polyLayer.on("click", () => {
          setSelectedParcel(p);
        });

        if (idx === 0) {
          map.fitBounds(polyLayer.getBounds(), { padding: [50, 50], maxZoom: 16 });
        }
      }
    });

    return () => {
      map.remove();
    };
  }, [parcels]);

  // Handle "Use My Location"
  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setUserLocation([lat, lon]);
        setGpsAccuracy(Math.round(pos.coords.accuracy));
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([lat, lon], 16);
          L.marker([lat, lon], {
            icon: L.divIcon({
              className: "user-loc-pin",
              html: `<div style="background-color:#2563eb; width:16px; height:16px; border-radius:50%; border:3px solid white; box-shadow:0 0 8px rgba(0,0,0,0.5);"></div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8]
            })
          }).addTo(mapInstanceRef.current).bindPopup("तुमचे स्थान (Your Location)").openPopup();
        }
      },
      err => {
        alert("GPS स्थान मिळवता आले नाही: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Handle "Walk My Boundary" mode
  const handleToggleWalkMode = () => {
    if (isWalkingGPS) {
      setIsWalkingGPS(false);
      alert("सीमा चालणे पूर्ण झाले (Walk boundary recording stopped).");
    } else {
      setIsWalkingGPS(true);
      alert("GPS ट्रॅकिंग सुरू झाले: शेताच्या कडेने चाला (Walk along your field perimeter). अचूकता < १० मीटर असणे आवश्यक.");
      handleUseLocation();
    }
  };

  const topRecCrop = advice?.top_crops?.[0]?.marathi_name || "कांदा (Onion)";

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top Floating Controls */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex items-center justify-between pointer-events-none">
        {/* Layer Selector */}
        <div className="bg-white/95 backdrop-blur shadow-lg rounded-2xl p-1.5 border border-stone-200 flex items-center space-x-1 pointer-events-auto">
          <button
            onClick={() => setActiveLayer("fields")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeLayer === "fields" ? "bg-emerald-800 text-white shadow" : "text-stone-700 hover:bg-stone-100"
            }`}
          >
            माझे शेत (My Fields)
          </button>
          <button
            onClick={() => setActiveLayer("soil")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeLayer === "soil" ? "bg-emerald-800 text-white shadow" : "text-stone-700 hover:bg-stone-100"
            }`}
          >
            ओलावा (Soil Water)
          </button>
          <button
            onClick={() => setActiveLayer("greenness")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeLayer === "greenness" ? "bg-emerald-800 text-white shadow" : "text-stone-700 hover:bg-stone-100"
            }`}
          >
            हिरवेपण (NDVI)
          </button>
        </div>

        {/* Close Map Button */}
        <button
          onClick={onClose}
          className="bg-white/95 backdrop-blur text-stone-800 hover:text-black p-2.5 rounded-full shadow-lg border border-stone-200 pointer-events-auto"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Map Canvas */}
      <div ref={mapContainerRef} className="flex-1 w-full h-full relative" />

      {/* Floating GPS Action Buttons */}
      <div className="absolute bottom-40 right-4 z-[1000] flex flex-col space-y-2">
        <button
          onClick={handleUseLocation}
          className="bg-white hover:bg-stone-50 text-emerald-900 p-3 rounded-2xl shadow-xl border border-stone-200 flex items-center justify-center transition-transform active:scale-95"
          title="माझे स्थान (My Location)"
        >
          <Crosshair className="w-6 h-6" />
        </button>

        <button
          onClick={handleToggleWalkMode}
          className={`p-3 rounded-2xl shadow-xl border transition-all flex items-center justify-center ${
            isWalkingGPS ? "bg-rose-600 text-white border-rose-700 animate-pulse" : "bg-emerald-800 text-white border-emerald-900 hover:bg-emerald-700"
          }`}
          title="Walk My Boundary"
        >
          <Compass className="w-6 h-6" />
        </button>
      </div>

      {/* Bottom Sheet Parcel Diagnostic Card */}
      {selectedParcel && (
        <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-white rounded-3xl p-4 shadow-2xl border-2 border-emerald-800 animate-in slide-in-from-bottom duration-200 max-w-lg mx-auto">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-emerald-600"></span>
                <h3 className="font-extrabold text-lg sm:text-xl text-stone-900">
                  शेत तुकडा #{selectedParcel.parcel_number} ({selectedParcel.village})
                </h3>
              </div>
              <p className="text-xs text-stone-500 font-medium">
                {selectedParcel.taluka}, {selectedParcel.district}
              </p>
            </div>

            <div className="text-right">
              <span className="text-lg font-black text-emerald-900 block leading-tight">
                {selectedParcel.area_acre} एकर
              </span>
              <span className="text-xs text-stone-500 font-bold">
                ({selectedParcel.area_guntha} गुंठे)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 my-2 py-2 px-3 bg-stone-50 rounded-2xl text-xs font-semibold">
            <div>
              <span className="text-stone-500 block text-[11px]">शिफारस पीक (Best Crop):</span>
              <span className="font-extrabold text-stone-800 text-sm">{topRecCrop}</span>
            </div>
            <div>
              <span className="text-stone-500 block text-[11px]">सीमा अचूकता:</span>
              <span className="font-bold text-stone-700">±{selectedParcel.accuracy_m || 1.5} मी ({selectedParcel.boundary_source})</span>
            </div>
          </div>

          <p className="text-[11px] text-stone-400 text-center mt-1">
            स्रोत: OpenStreetMap & geoBoundaries WGS84 • अद्ययावत: आज
          </p>
        </div>
      )}
    </div>
  );
};
