import React, { useEffect, useRef, useState } from "react";
import { Language, translations } from "../i18n/translations";
import {
  Crosshair,
  X,
  Plus,
  CheckCircle2,
  Trash2,
  Upload,
  ShieldCheck
} from "lucide-react";
import L from "leaflet";

interface FarmMapProps {
  parcels: any[];
  activeParcel: any;
  suitability?: any;
  token?: string;
  lang: Language;
  onClose: () => void;
  onParcelChanged?: () => void;
}

export const FarmMap: React.FC<FarmMapProps> = ({
  parcels,
  activeParcel,
  suitability,
  token,
  lang,
  onClose,
  onParcelChanged
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const drawnLayerRef = useRef<L.Polygon | null>(null);

  const [selectedParcel, setSelectedParcel] = useState<any>(
    activeParcel || parcels[0] || null
  );
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawVertices, setDrawVertices] = useState<[number, number][]>([]);
  const [parcelName, setParcelName] = useState("शेताचा तुकडा १");
  const [surveyNum, setSurveyNum] = useState("");
  const [soilType, setSoilType] = useState("medium_black");
  const [irrigationSource, setIrrigationSource] = useState("rainfed");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const t = translations[lang];

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const defaultCenter: [number, number] = activeParcel?.centroid_lat
      ? [activeParcel.centroid_lat, activeParcel.centroid_lon]
      : [19.39, 74.65];

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: activeParcel ? 15 : 9,
      zoomControl: false
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapInstanceRef.current = map;

    fetch("/api/v1/geo/districts")
      .then(r => r.json())
      .then(distData => {
        if (distData.features) {
          L.geoJSON(distData, {
            style: {
              color: "#1b4332",
              weight: 2,
              dashArray: "4, 4",
              fillColor: "#2d6a4f",
              fillOpacity: 0.04
            }
          }).addTo(map);
        }
      })
      .catch(() => {});

    parcels.forEach((p, idx) => {
      if (p.geojson) {
        const polyLayer = L.geoJSON(p.geojson, {
          style: {
            color: p.land_verified ? "#047857" : "#1b4332",
            weight: 3,
            fillColor: p.land_verified ? "#10b981" : "#52b788",
            fillOpacity: 0.5
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

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const onMapClick = (e: L.LeafletMouseEvent) => {
      if (!isDrawing) return;
      setDrawVertices(prev => [...prev, [e.latlng.lat, e.latlng.lng]]);
    };

    map.on("click", onMapClick);
    return () => {
      map.off("click", onMapClick);
    };
  }, [isDrawing]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (drawnLayerRef.current) {
      map.removeLayer(drawnLayerRef.current);
      drawnLayerRef.current = null;
    }
    if (drawVertices.length >= 2) {
      drawnLayerRef.current = L.polygon(drawVertices, {
        color: "#f59e0b",
        weight: 3,
        fillColor: "#fbbf24",
        fillOpacity: 0.45
      }).addTo(map);
    }
  }, [drawVertices]);

  const handleUseLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([lat, lon], 16);
          L.circleMarker([lat, lon], {
            radius: 8,
            color: "#ffffff",
            fillColor: "#2563eb",
            fillOpacity: 1,
            weight: 3
          })
            .addTo(mapInstanceRef.current)
            .bindPopup("तुमचे GPS स्थान (Your GPS Location)")
            .openPopup();
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSaveDrawnParcel = async () => {
    if (!token || drawVertices.length < 3) {
      setSaveStatus(
        lang === "mr"
          ? "किमान ३ कोपरे नकाशावर क्लिक करून निवडा."
          : "Click at least 3 corner points on the map."
      );
      return;
    }
    setIsSaving(true);
    setSaveStatus(null);
    const ring = drawVertices.map(([lat, lng]) => [lng, lat]);
    ring.push(ring[0]);

    try {
      const resp = await fetch("/api/v1/parcels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: parcelName,
          survey_number: surveyNum,
          soil_type: soilType,
          irrigation_source: irrigationSource,
          geojson: { type: "Polygon", coordinates: [ring] }
        })
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error?.message || data?.message || "Could not save parcel");
      }
      setIsDrawing(false);
      setDrawVertices([]);
      setSelectedParcel(data.parcel);
      if (onParcelChanged) onParcelChanged();
    } catch (err: any) {
      setSaveStatus(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setSaveStatus(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const resp = await fetch("/api/v1/parcels/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error?.message || data?.message || "Import failed");
      }
      const parsedGeom = JSON.parse(data.geojson);
      const coords = parsedGeom.coordinates?.[0] || [];
      const latlngs: [number, number][] = coords
        .slice(0, -1)
        .map((c: number[]) => [c[1], c[0]]);
      setIsDrawing(true);
      setDrawVertices(latlngs);
      if (mapInstanceRef.current && latlngs.length > 0) {
        mapInstanceRef.current.setView(latlngs[0], 16);
      }
    } catch (err: any) {
      setSaveStatus(err.message);
    }
  };

  const topRecCrop =
    suitability?.recommendations?.[0]?.name || t.no_data;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top Floating Controls */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex items-center justify-between pointer-events-none gap-2">
        <div className="bg-white/95 backdrop-blur shadow-lg rounded-2xl p-1.5 border border-stone-200 flex items-center space-x-1.5 pointer-events-auto">
          {parcels.length < 4 && (
            <button
              onClick={() => {
                setIsDrawing(prev => !prev);
                setDrawVertices([]);
                setSaveStatus(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1 transition-all ${
                isDrawing
                  ? "bg-amber-600 text-white shadow"
                  : "bg-emerald-800 text-white hover:bg-emerald-700"
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>
                {isDrawing
                  ? lang === "mr"
                    ? "आखणी रद्द करा"
                    : "Cancel Drawing"
                  : lang === "mr"
                  ? "नवीन शेत जोडा (Draw)"
                  : "Add Parcel"}
              </span>
            </button>
          )}

          <label className="px-3 py-1.5 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-800 cursor-pointer flex items-center space-x-1">
            <Upload className="w-3.5 h-3.5" />
            <span>KML / GeoJSON</span>
            <input
              type="file"
              accept=".kml,.geojson,.json"
              onChange={handleFileImport}
              className="hidden"
            />
          </label>
        </div>

        <button
          onClick={onClose}
          className="bg-white/95 backdrop-blur text-stone-800 hover:text-black p-2.5 rounded-full shadow-lg border border-stone-200 pointer-events-auto"
          aria-label="Close map"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Map Canvas */}
      <div ref={mapContainerRef} className="flex-1 w-full h-full relative" />

      {/* GPS Location Button */}
      <div className="absolute bottom-44 right-4 z-[1000] flex flex-col space-y-2">
        <button
          onClick={handleUseLocation}
          className="bg-white hover:bg-stone-50 text-emerald-900 p-3 rounded-2xl shadow-xl border border-stone-200 flex items-center justify-center"
          title="My GPS Location"
        >
          <Crosshair className="w-6 h-6" />
        </button>
      </div>

      {/* Drawing Panel */}
      {isDrawing && (
        <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-white rounded-3xl p-4 shadow-2xl border-2 border-amber-500 max-w-lg mx-auto space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-sm sm:text-base text-stone-900">
              {lang === "mr"
                ? `नकाशावर शेताचे कोपरे क्लिक करा (${drawVertices.length} बिंदू)`
                : `Click field corners on map (${drawVertices.length} vertices)`}
            </h3>
            {drawVertices.length > 0 && (
              <button
                onClick={() => setDrawVertices([])}
                className="text-xs font-bold text-rose-700 flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>पुसा (Reset)</span>
              </button>
            )}
          </div>

          {saveStatus && (
            <div className="p-2 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-bold">
              {saveStatus}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs">
            <input
              type="text"
              value={parcelName}
              onChange={e => setParcelName(e.target.value)}
              placeholder="शेताचे नाव (Field Name)"
              className="px-2.5 py-2 rounded-xl border border-stone-300 font-semibold"
            />
            <input
              type="text"
              value={surveyNum}
              onChange={e => setSurveyNum(e.target.value)}
              placeholder="गट / सर्व्हे क्र. (७/१२)"
              className="px-2.5 py-2 rounded-xl border border-stone-300 font-semibold"
            />
            <select
              value={soilType}
              onChange={e => setSoilType(e.target.value)}
              className="px-2.5 py-2 rounded-xl border border-stone-300 font-semibold"
            >
              <option value="medium_black">मध्यम काळी (Medium Black)</option>
              <option value="deep_black">भारी काळी (Deep Black)</option>
              <option value="shallow_black">हलकी / मुरमाड (Shallow)</option>
              <option value="red_loamy">तांबडी गाळाची (Red Loamy)</option>
            </select>
            <select
              value={irrigationSource}
              onChange={e => setIrrigationSource(e.target.value)}
              className="px-2.5 py-2 rounded-xl border border-stone-300 font-semibold"
            >
              <option value="rainfed">कोरडवाहू (Rainfed)</option>
              <option value="drip">ठिबक (Drip)</option>
              <option value="well">विहीर (Well)</option>
              <option value="canal">कालवा (Canal)</option>
              <option value="borewell">बोअरवेल (Borewell)</option>
            </select>
          </div>

          <button
            onClick={handleSaveDrawnParcel}
            disabled={isSaving || drawVertices.length < 3}
            className="w-full py-2.5 rounded-2xl bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-sm shadow"
          >
            {isSaving
              ? "तपासत आहे..."
              : lang === "mr"
              ? "शेत सीमा जतन करा (Save Parcel)"
              : "Validate & Save Parcel"}
          </button>
        </div>
      )}

      {/* Selected Parcel Diagnostic Sheet */}
      {!isDrawing && selectedParcel && (
        <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-white rounded-3xl p-4 shadow-2xl border-2 border-emerald-800 max-w-lg mx-auto">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-emerald-600" />
                <h3 className="font-extrabold text-base sm:text-lg text-stone-900">
                  {selectedParcel.name}
                </h3>
                {selectedParcel.land_verified ? (
                  <span className="inline-flex items-center space-x-1 text-[10px] font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full border border-emerald-400">
                    <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                    <span>७/१२ Verified</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300">
                    Pending 7/12 Check
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 font-medium mt-0.5">
                माती: {selectedParcel.soil_type} • सिंचन: {selectedParcel.irrigation_source}
              </p>
            </div>

            <div className="text-right">
              <span className="text-lg font-black text-emerald-900 block leading-tight">
                {selectedParcel.area_acres ?? selectedParcel.area_acre} एकर
              </span>
              <span className="text-xs text-stone-500 font-bold">
                ({selectedParcel.area_gunthas ?? selectedParcel.area_guntha} गुंठे)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 my-2 py-2 px-3 bg-stone-50 rounded-2xl text-xs font-semibold">
            <div>
              <span className="text-stone-500 block text-[11px]">शिफारस पीक (Best Crop):</span>
              <span className="font-extrabold text-stone-800 text-sm">{topRecCrop}</span>
            </div>
            <div>
              <span className="text-stone-500 block text-[11px]">क्षेत्रफळ मानक:</span>
              <span className="font-bold text-stone-700 flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span>WGS84 + UTM 43N</span>
              </span>
            </div>
          </div>

          <p className="text-[11px] text-stone-400 text-center mt-1">
            स्रोत: OpenStreetMap &amp; WGS84 Geodesic Polygon Engine
          </p>
        </div>
      )}
    </div>
  );
};
