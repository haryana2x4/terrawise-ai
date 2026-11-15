import React, { useEffect, useMemo, useRef, useState } from "react";
import { Language, translations } from "../i18n/translations";
import {
  Crosshair,
  X,
  Plus,
  CheckCircle2,
  Trash2,
  Upload,
  ShieldCheck,
  Layers,
  Undo2,
  Square,
  Download,
  Edit3,
  Navigation,
  Ruler
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface TalukaOption {
  name: string;
  district: string;
  center: [number, number];
  bounds: L.LatLngBoundsExpression;
}

interface FarmMapProps {
  parcels: any[];
  activeParcel: any;
  suitability?: any;
  token?: string;
  lang: Language;
  targetFarmerId?: string;
  targetFarmerName?: string;
  defaultDistrict?: string;
  defaultTaluka?: string;
  onClose: () => void;
  onParcelChanged?: () => void;
  onSelectParcel?: (parcel: any) => void;
}

type BasemapMode = "satellite" | "street" | "topo";

const BASEMAP_TILES: Record<
  BasemapMode,
  { url: string; attribution: string; maxZoom: number; labelMr: string; labelEn: string }
> = {
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri World Imagery",
    maxZoom: 19,
    labelMr: "उपग्रह (Satellite)",
    labelEn: "Satellite"
  },
  street: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
    labelMr: "रस्ते (Street)",
    labelEn: "Street"
  },
  topo: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenTopoMap contributors",
    maxZoom: 17,
    labelMr: "भूपृष्ठ (Topo)",
    labelEn: "Terrain"
  }
};

function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6371008.8;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function computePolygonMetrics(vertices: [number, number][]) {
  if (vertices.length < 3) {
    return { areaSqm: 0, acres: 0, gunthas: 0, hectares: 0, perimeterM: 0 };
  }
  const R = 6378137.0;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  let areaSum = 0;
  let perimeter = 0;

  for (let i = 0; i < vertices.length; i++) {
    const p1 = vertices[i];
    const p2 = vertices[(i + 1) % vertices.length];
    perimeter += haversineMeters(p1, p2);
    const lon1 = toRad(p1[1]);
    const lon2 = toRad(p2[1]);
    const lat1 = toRad(p1[0]);
    const lat2 = toRad(p2[0]);
    areaSum += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  const areaSqm = Math.abs((areaSum * R * R) / 2.0);
  const acres = areaSqm / 4046.8564224;
  const gunthas = areaSqm / 101.17141056;
  const hectares = areaSqm / 10000.0;

  return {
    areaSqm: Math.round(areaSqm),
    acres: Math.round(acres * 100) / 100,
    gunthas: Math.round(gunthas * 10) / 10,
    hectares: Math.round(hectares * 100) / 100,
    perimeterM: Math.round(perimeter)
  };
}

function extractGeometryBoundsCenter(geom: any): { center: [number, number]; bounds: L.LatLngBoundsExpression } | null {
  try {
    const layer = L.geoJSON(geom);
    const b = layer.getBounds();
    if (!b.isValid()) return null;
    const c = b.getCenter();
    return {
      center: [c.lat, c.lng],
      bounds: [
        [b.getSouth(), b.getWest()],
        [b.getNorth(), b.getEast()]
      ]
    };
  } catch {
    return null;
  }
}

export const FarmMap: React.FC<FarmMapProps> = ({
  parcels,
  activeParcel,
  suitability,
  token,
  lang,
  targetFarmerId,
  targetFarmerName,
  defaultDistrict,
  defaultTaluka,
  onClose,
  onParcelChanged,
  onSelectParcel
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const savedGroupRef = useRef<L.FeatureGroup | null>(null);
  const drawGroupRef = useRef<L.FeatureGroup | null>(null);
  const gpsMarkerRef = useRef<L.CircleMarker | null>(null);
  const hasAutoFocusedTalukaRef = useRef(false);

  const [basemap, setBasemap] = useState<BasemapMode>("satellite");
  const [talukas, setTalukas] = useState<TalukaOption[]>([]);
  const [selectedTaluka, setSelectedTaluka] = useState<string>(defaultTaluka || "");

  const [selectedParcel, setSelectedParcel] = useState<any>(
    activeParcel || parcels[0] || null
  );
  const [isDrawing, setIsDrawing] = useState<boolean>(parcels.length === 0);
  const isDrawingRef = useRef<boolean>(isDrawing);
  isDrawingRef.current = isDrawing;

  const [drawVertices, setDrawVertices] = useState<[number, number][]>([]);
  const [parcelName, setParcelName] = useState(
    lang === "mr" ? `शेताचा तुकडा ${parcels.length + 1}` : `Field Plot ${parcels.length + 1}`
  );
  const [surveyNum, setSurveyNum] = useState("");
  const [soilType, setSoilType] = useState("medium_black");
  const [irrigationSource, setIrrigationSource] = useState("drip");
  const [statusBanner, setStatusBanner] = useState<{ type: "error" | "ok" | "info"; text: string } | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Inline edit state for existing selected parcel
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSurvey, setEditSurvey] = useState("");
  const [editSoil, setEditSoil] = useState("medium_black");
  const [editIrrigation, setEditIrrigation] = useState("drip");

  const t = translations[lang];
  const liveMetrics = useMemo(() => computePolygonMetrics(drawVertices), [drawVertices]);

  // Keep selectedParcel synchronized when parcels refresh
  useEffect(() => {
    if (parcels.length === 0) {
      setSelectedParcel(null);
      return;
    }
    if (selectedParcel) {
      const updated = parcels.find(p => p.id === selectedParcel.id);
      setSelectedParcel(updated || activeParcel || parcels[0]);
    } else {
      setSelectedParcel(activeParcel || parcels[0]);
    }
  }, [parcels, activeParcel]);

  // 1. Initialize Leaflet Map once cleanly
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    const initialLat = activeParcel?.centroid_lat || parcels[0]?.centroid_lat || (defaultDistrict === "Nashik" ? 20.0 : 19.39);
    const initialLon = activeParcel?.centroid_lon || parcels[0]?.centroid_lon || (defaultDistrict === "Nashik" ? 73.79 : 74.65);

    const map = L.map(container, {
      center: [initialLat, initialLon],
      zoom: parcels.length > 0 ? 16 : 11,
      zoomControl: false
    });

    const initialCfg = BASEMAP_TILES.satellite;
    tileLayerRef.current = L.tileLayer(initialCfg.url, {
      attribution: initialCfg.attribution,
      maxZoom: initialCfg.maxZoom
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    savedGroupRef.current = L.featureGroup().addTo(map);
    drawGroupRef.current = L.featureGroup().addTo(map);
    mapInstanceRef.current = map;

    const handleClick = (e: L.LeafletMouseEvent) => {
      if (!isDrawingRef.current) return;
      setValidationResult(null);
      setStatusBanner(null);
      setDrawVertices(prev => [...prev, [Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))]]);
    };
    map.on("click", handleClick);

    // Fix modal layout size calculation on mount & window resize
    const invalidateTimer = window.setTimeout(() => map.invalidateSize(), 160);
    const resizeObs = new ResizeObserver(() => map.invalidateSize());
    resizeObs.observe(container);

    // Load real District & Taluka GeoJSON boundaries
    fetch("/api/v1/geo/districts")
      .then(r => r.json())
      .then(distData => {
        if (distData.features && mapInstanceRef.current) {
          L.geoJSON(distData, {
            interactive: false,
            style: {
              color: "#34d399",
              weight: 2.5,
              dashArray: "6, 5",
              fillColor: "#065f46",
              fillOpacity: 0.03
            }
          }).addTo(map);
        }
      })
      .catch(() => {});

    fetch("/api/v1/geo/talukas")
      .then(r => r.json())
      .then(talData => {
        if (!talData.features || !mapInstanceRef.current) return;
        const parsedOptions: TalukaOption[] = [];
        L.geoJSON(talData, {
          interactive: false,
          style: {
            color: "#fbbf24",
            weight: 1.2,
            dashArray: "3, 4",
            opacity: 0.6,
            fillOpacity: 0
          }
        }).addTo(map);

        for (const feat of talData.features) {
          const props = feat.properties || {};
          const name = String(props.taluka_name || props.shapeName || "").trim();
          const district = String(props.district_name || "").trim();
          const meta = extractGeometryBoundsCenter(feat);
          if (name && meta) {
            parsedOptions.push({ name, district, center: meta.center, bounds: meta.bounds });
          }
        }
        parsedOptions.sort((a, b) => a.name.localeCompare(b.name));
        setTalukas(parsedOptions);

        // If no saved parcels yet, zoom directly into farmer's default Taluka at field scale!
        if (parcels.length === 0 && !hasAutoFocusedTalukaRef.current) {
          hasAutoFocusedTalukaRef.current = true;
          const match = parsedOptions.find(
            o => defaultTaluka && o.name.toLowerCase() === defaultTaluka.toLowerCase()
          );
          if (match) {
            setSelectedTaluka(match.name);
            map.setView(match.center, 14);
          }
        }
      })
      .catch(() => {});

    return () => {
      window.clearTimeout(invalidateTimer);
      resizeObs.disconnect();
      map.off("click", handleClick);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [targetFarmerId]);

  // 2. Switch Basemap layer without destroying map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    const cfg = BASEMAP_TILES[basemap];
    tileLayerRef.current = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom
    }).addTo(map);
    tileLayerRef.current.bringToBack();
  }, [basemap]);

  // 3. Crosshair cursor visual while drawing
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;
    if (isDrawing) {
      container.classList.add("leaflet-drawing-mode");
    } else {
      container.classList.remove("leaflet-drawing-mode");
    }
  }, [isDrawing]);

  // 4. Render Saved Parcels
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = savedGroupRef.current;
    if (!map || !group) return;
    group.clearLayers();

    parcels.forEach(p => {
      if (!p.geojson) return;
      try {
        const geom = typeof p.geojson === "string" ? JSON.parse(p.geojson) : p.geojson;
        const isSelected = selectedParcel?.id === p.id;
        const layer = L.geoJSON(geom, {
          style: {
            color: isSelected ? "#f59e0b" : p.land_verified ? "#10b981" : "#34d399",
            weight: isSelected ? 4 : 3,
            fillColor: p.land_verified ? "#10b981" : "#34d399",
            fillOpacity: isSelected ? 0.42 : 0.28
          }
        });
        layer.bindTooltip(
          `${p.name} • ${p.area_acres} ac (${p.area_gunthas} गुंठे)`,
          { sticky: true }
        );
        layer.on("click", (evt: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(evt);
          if (isDrawingRef.current) return;
          setSelectedParcel(p);
          setIsEditingMeta(false);
          if (onSelectParcel) onSelectParcel(p);
        });
        layer.addTo(group);
      } catch {
        // Ignore invalid parcel geojson
      }
    });

    if (parcels.length > 0 && group.getBounds().isValid() && !isDrawingRef.current) {
      map.fitBounds(group.getBounds(), { padding: [60, 60], maxZoom: 17 });
    }
  }, [parcels, selectedParcel?.id]);

  // 5. Render Active Drawing Vertices (works even with 1 point!) + Draggable Corner Handles
  useEffect(() => {
    const map = mapInstanceRef.current;
    const drawGroup = drawGroupRef.current;
    if (!map || !drawGroup) return;
    drawGroup.clearLayers();

    if (drawVertices.length >= 2) {
      L.polyline(drawVertices, {
        color: "#fbbf24",
        weight: 3,
        dashArray: drawVertices.length < 3 ? "6, 6" : undefined
      }).addTo(drawGroup);
    }

    if (drawVertices.length >= 3) {
      L.polygon(drawVertices, {
        color: "#f59e0b",
        weight: 3,
        fillColor: "#fbbf24",
        fillOpacity: 0.35
      }).addTo(drawGroup);
    }

    drawVertices.forEach((coord, idx) => {
      const icon = L.divIcon({
        className: "kshetra-vertex-pin",
        html: `<div style="width:26px;height:26px;border-radius:9999px;background:#f59e0b;border:2.5px solid #ffffff;color:#1c1917;font-weight:900;font-size:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.45);cursor:grab;">${
          idx + 1
        }</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });
      const marker = L.marker(coord, { icon, draggable: true });
      marker.on("drag", evt => {
        const pos = (evt.target as L.Marker).getLatLng();
        setDrawVertices(prev =>
          prev.map((pt, i) => (i === idx ? [Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6))] : pt))
        );
      });
      marker.on("dragend", () => setValidationResult(null));
      marker.addTo(drawGroup);
    });
  }, [drawVertices]);

  const handleTalukaJump = (talukaName: string) => {
    setSelectedTaluka(talukaName);
    const match = talukas.find(o => o.name === talukaName);
    if (match && mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(match.bounds, { maxZoom: 14, padding: [20, 20] });
    }
  };

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setStatusBanner({
        type: "error",
        text: lang === "mr" ? "तुमच्या ब्राउझरमध्ये GPS उपलब्ध नाही." : "Geolocation is not supported in this browser."
      });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([lat, lon], 17);
          if (gpsMarkerRef.current) {
            mapInstanceRef.current.removeLayer(gpsMarkerRef.current);
          }
          gpsMarkerRef.current = L.circleMarker([lat, lon], {
            radius: 9,
            color: "#ffffff",
            fillColor: "#2563eb",
            fillOpacity: 1,
            weight: 3
          })
            .addTo(mapInstanceRef.current)
            .bindPopup(lang === "mr" ? "तुमचे GPS स्थान" : "Your GPS Location")
            .openPopup();
        }
      },
      err => {
        setStatusBanner({
          type: "error",
          text:
            lang === "mr"
              ? `GPS स्थान मिळाले नाही (${err.message}). वरील तालुका सूचीतून स्थान निवडा.`
              : `GPS unavailable (${err.message}). Use the Taluka jump menu above.`
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleDropStarterBox = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (map.getZoom() < 14) {
      map.setZoom(16);
    }
    const c = map.getCenter();
    const halfMeters = 32; // ~64m x 64m ≈ 1.01 acres (~40.5 gunthas)
    const dLat = halfMeters / 110540.0;
    const dLon = halfMeters / (111320.0 * Math.cos((c.lat * Math.PI) / 180));
    const box: [number, number][] = [
      [Number((c.lat + dLat).toFixed(6)), Number((c.lng - dLon).toFixed(6))],
      [Number((c.lat + dLat).toFixed(6)), Number((c.lng + dLon).toFixed(6))],
      [Number((c.lat - dLat).toFixed(6)), Number((c.lng + dLon).toFixed(6))],
      [Number((c.lat - dLat).toFixed(6)), Number((c.lng - dLon).toFixed(6))]
    ];
    setIsDrawing(true);
    setDrawVertices(box);
    setValidationResult(null);
    setStatusBanner({
      type: "info",
      text:
        lang === "mr"
          ? "१ एकरचा नमुना चौकोन ठेवला आहे — कोपरे (1–4) ओढून तुमच्या बांधावर बसवा आणि जतन करा!"
          : "Dropped a ~1-acre starter box — drag corners 1–4 onto your field bunds and save."
    });
  };

  const handleValidateBeforeSave = async () => {
    if (!token || drawVertices.length < 3) return;
    setStatusBanner(null);
    const ring = drawVertices.map(([lat, lng]) => [lng, lat]);
    ring.push(ring[0]);

    try {
      const resp = await fetch("/api/v1/parcels/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ geojson: { type: "Polygon", coordinates: [ring] } })
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error?.message || data?.message || "Boundary validation failed");
      }
      setValidationResult(data);
      if (data.has_overlap) {
        setStatusBanner({ type: "error", text: data.overlap_message });
      } else {
        setStatusBanner({
          type: "ok",
          text: `WGS84 Verified: ${data.area_acres} acres (${data.area_gunthas} गुंठे) • UTM-43N Diff ${data.crs_divergence_pct}%`
        });
      }
    } catch (err: any) {
      setStatusBanner({ type: "error", text: err.message });
    }
  };

  const handleSaveDrawnParcel = async () => {
    if (!token || drawVertices.length < 3) {
      setStatusBanner({
        type: "error",
        text:
          lang === "mr"
            ? "किमान ३ कोपरे नकाशावर क्लिक करा किंवा '१-एकर चौकोन ठेवा' वापरा."
            : "Click at least 3 corner points or use 'Drop Quick Plot'."
      });
      return;
    }
    setIsSaving(true);
    setStatusBanner(null);
    const ring = drawVertices.map(([lat, lng]) => [lng, lat]);
    ring.push(ring[0]);

    const bodyPayload: Record<string, any> = {
      name: parcelName.trim() || "शेत तुकडा",
      survey_number: surveyNum.trim(),
      soil_type: soilType,
      irrigation_source: irrigationSource,
      geojson: { type: "Polygon", coordinates: [ring] }
    };
    if (targetFarmerId) {
      bodyPayload.farmer_id = targetFarmerId;
    }

    try {
      const resp = await fetch("/api/v1/parcels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(bodyPayload)
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error?.message || data?.message || "Could not save parcel");
      }
      setIsDrawing(false);
      setDrawVertices([]);
      setValidationResult(null);
      setSelectedParcel(data.parcel);
      setStatusBanner({
        type: "ok",
        text:
          lang === "mr"
            ? `शेत जतन झाले! (${data.parcel.area_acres} एकर / ${data.parcel.area_gunthas} गुंठे)`
            : `Parcel saved! (${data.parcel.area_acres} acres)`
      });
      if (onParcelChanged) onParcelChanged();
    } catch (err: any) {
      setStatusBanner({ type: "error", text: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateSelectedMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedParcel) return;
    try {
      const resp = await fetch(`/api/v1/parcels/${selectedParcel.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editName,
          survey_number: editSurvey,
          soil_type: editSoil,
          irrigation_source: editIrrigation
        })
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error?.message || "Update failed");
      }
      setSelectedParcel(data.parcel);
      setIsEditingMeta(false);
      setStatusBanner({
        type: "ok",
        text: lang === "mr" ? "शेत माहिती अद्ययावत झाली!" : "Parcel updated!"
      });
      if (onParcelChanged) onParcelChanged();
    } catch (err: any) {
      setStatusBanner({ type: "error", text: err.message });
    }
  };

  const handleDeleteSelectedParcel = async () => {
    if (!token || !selectedParcel) return;
    const confirmed = window.confirm(
      lang === "mr"
        ? `'${selectedParcel.name}' हा शेत तुकडा नकाशावरून काढायचा आहे का?`
        : `Delete field parcel '${selectedParcel.name}'?`
    );
    if (!confirmed) return;
    try {
      const resp = await fetch(`/api/v1/parcels/${selectedParcel.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        setSelectedParcel(null);
        setStatusBanner({
          type: "ok",
          text: lang === "mr" ? "शेत तुकडा काढला." : "Parcel deleted."
        });
        if (onParcelChanged) onParcelChanged();
      }
    } catch {
      // Ignore
    }
  };

  const handleDownloadGeoJson = () => {
    if (!selectedParcel?.geojson) return;
    const geom =
      typeof selectedParcel.geojson === "string"
        ? JSON.parse(selectedParcel.geojson)
        : selectedParcel.geojson;
    const fc = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {
            id: selectedParcel.id,
            name: selectedParcel.name,
            survey_number: selectedParcel.survey_number,
            area_acres: selectedParcel.area_acres,
            area_gunthas: selectedParcel.area_gunthas,
            soil_type: selectedParcel.soil_type,
            irrigation_source: selectedParcel.irrigation_source,
            crs: "EPSG:4326"
          },
          geometry: geom
        }
      ]
    };
    const blob = new Blob([JSON.stringify(fc, null, 2)], { type: "application/geo+json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kshetra_parcel_${selectedParcel.id}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setStatusBanner(null);
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
      setValidationResult(data);
      if (mapInstanceRef.current && latlngs.length > 0) {
        mapInstanceRef.current.fitBounds(L.latLngBounds(latlngs), { padding: [50, 50], maxZoom: 17 });
      }
    } catch (err: any) {
      setStatusBanner({ type: "error", text: err.message });
    }
  };

  const topRecCrop = suitability?.recommendations?.[0]?.name || t.no_data;

  return (
    <div className="fixed inset-0 z-50 bg-stone-950 flex flex-col">
      {/* Top Floating GIS Toolbar */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left Action Cluster */}
        <div className="bg-stone-900/90 backdrop-blur-md shadow-xl rounded-2xl p-1.5 border border-white/15 flex flex-wrap items-center gap-1.5 pointer-events-auto text-white">
          {targetFarmerName && (
            <span className="px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-extrabold">
              {targetFarmerName} ({targetFarmerId})
            </span>
          )}

          {parcels.length < 4 && (
            <button
              onClick={() => {
                setIsDrawing(prev => !prev);
                setDrawVertices([]);
                setValidationResult(null);
                setStatusBanner(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center space-x-1 transition-all ${
                isDrawing
                  ? "bg-amber-500 text-stone-950 shadow"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white"
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>
                {isDrawing
                  ? lang === "mr"
                    ? "आखणी बंद करा"
                    : "Exit Draw"
                  : lang === "mr"
                  ? "नवीन शेत आखा (Draw)"
                  : "Mark Land"}
              </span>
            </button>
          )}

          <button
            onClick={handleDropStarterBox}
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-amber-200 flex items-center space-x-1 transition-colors"
            title="Place adjustable 1-acre starter boundary box at screen center"
          >
            <Square className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {lang === "mr" ? "१-एकर चौकोन ठेवा" : "Drop Quick Plot"}
            </span>
          </button>

          <label className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-stone-100 cursor-pointer flex items-center space-x-1">
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">KML / GeoJSON</span>
            <input
              type="file"
              accept=".kml,.geojson,.json"
              onChange={handleFileImport}
              className="hidden"
            />
          </label>
        </div>

        {/* Center/Right: Taluka Jump + Basemap Switcher + Close */}
        <div className="flex flex-wrap items-center gap-1.5 pointer-events-auto">
          {talukas.length > 0 && (
            <div className="bg-stone-900/90 backdrop-blur-md shadow-xl rounded-2xl px-2 py-1 border border-white/15 flex items-center space-x-1.5 text-white">
              <Navigation className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <select
                value={selectedTaluka}
                onChange={e => handleTalukaJump(e.target.value)}
                className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer pr-1"
                aria-label="Jump to Taluka"
              >
                <option value="" className="text-stone-900">
                  {lang === "mr" ? "तालुका निवडा..." : "Jump to Taluka..."}
                </option>
                {talukas.map(opt => (
                  <option key={`${opt.district}-${opt.name}`} value={opt.name} className="text-stone-900">
                    {opt.name} ({opt.district})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Satellite / Street / Topo Switcher */}
          <div className="bg-stone-900/90 backdrop-blur-md shadow-xl rounded-2xl p-1 border border-white/15 flex items-center space-x-0.5 text-[11px] font-bold">
            <Layers className="w-3.5 h-3.5 text-amber-300 mx-1.5 hidden sm:block" />
            {(["satellite", "street", "topo"] as BasemapMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setBasemap(mode)}
                className={`px-2 py-1 rounded-xl transition-colors ${
                  basemap === mode
                    ? "bg-emerald-600 text-white shadow"
                    : "text-stone-300 hover:text-white"
                }`}
              >
                {lang === "mr" ? BASEMAP_TILES[mode].labelMr.split(" ")[0] : BASEMAP_TILES[mode].labelEn}
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            className="bg-stone-900/90 hover:bg-black text-white p-2 rounded-full shadow-xl border border-white/20"
            aria-label="Close map"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Leaflet Canvas */}
      <div ref={mapContainerRef} className="flex-1 w-full h-full relative" />

      {/* Center Reticle Helper while Drawing */}
      {isDrawing && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center z-[500]"
          aria-hidden="true"
        >
          <div className="w-6 h-6 rounded-full border-2 border-amber-300/70 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          </div>
        </div>
      )}

      {/* GPS Locate Me Button */}
      <div className="absolute bottom-52 right-4 z-[1000] flex flex-col space-y-2">
        <button
          onClick={handleUseLocation}
          className="bg-white/95 hover:bg-white text-emerald-900 p-3 rounded-2xl shadow-xl border border-stone-200 flex items-center justify-center transition-transform active:scale-95"
          title="My GPS Location"
        >
          <Crosshair className="w-6 h-6" />
        </button>
      </div>

      {/* Drawing Control Sheet */}
      {isDrawing && (
        <div className="absolute bottom-3 left-3 right-3 z-[1000] bg-white/95 backdrop-blur-md rounded-3xl p-4 shadow-2xl border-2 border-amber-500 max-w-xl mx-auto space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-stone-900">
                {lang === "mr"
                  ? `बांधाचे कोपरे क्लिक करा (${drawVertices.length} बिंदू)`
                  : `Tap field corners (${drawVertices.length} points)`}
              </h3>
              <p className="text-[11px] text-stone-500 font-medium">
                {lang === "mr"
                  ? "पिवळे क्रमांक (1, 2, 3...) ओढून तुमची अचूक सीमा जुळवा"
                  : "Drag numbered pins to align precisely with field bunds"}
              </p>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              {drawVertices.length > 0 && (
                <>
                  <button
                    onClick={() => {
                      setDrawVertices(prev => prev.slice(0, -1));
                      setValidationResult(null);
                    }}
                    className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-xs font-bold text-stone-800 flex items-center space-x-1"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>मागे</span>
                  </button>
                  <button
                    onClick={() => {
                      setDrawVertices([]);
                      setValidationResult(null);
                    }}
                    className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-xs font-bold text-rose-700 flex items-center space-x-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>पुसा</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Live Spherical Geodesic Measurement HUD */}
          <div className="grid grid-cols-4 gap-2 bg-emerald-950 text-white rounded-2xl p-2.5 text-center tabular-nums">
            <div>
              <span className="block text-[10px] text-emerald-300 uppercase font-bold">एकर (Acres)</span>
              <span className="font-black text-sm">{liveMetrics.acres}</span>
            </div>
            <div>
              <span className="block text-[10px] text-emerald-300 uppercase font-bold">गुंठे (Guntha)</span>
              <span className="font-black text-sm">{liveMetrics.gunthas}</span>
            </div>
            <div>
              <span className="block text-[10px] text-emerald-300 uppercase font-bold">हेक्टर (Ha)</span>
              <span className="font-black text-sm">{liveMetrics.hectares}</span>
            </div>
            <div>
              <span className="block text-[10px] text-emerald-300 uppercase font-bold">परीघ (Perim)</span>
              <span className="font-black text-sm">{liveMetrics.perimeterM} m</span>
            </div>
          </div>

          {statusBanner && (
            <div
              className={`p-2 rounded-xl border text-xs font-bold ${
                statusBanner.type === "error"
                  ? "bg-rose-50 border-rose-300 text-rose-900"
                  : statusBanner.type === "ok"
                  ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                  : "bg-amber-50 border-amber-300 text-amber-950"
              }`}
            >
              {statusBanner.text}
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
              <option value="drip">ठिबक सिंचन (Drip)</option>
              <option value="well">विहीर (Well)</option>
              <option value="canal">कालवा (Canal)</option>
              <option value="borewell">बोअरवेल (Borewell)</option>
              <option value="rainfed">कोरडवाहू (Rainfed)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleValidateBeforeSave}
              disabled={drawVertices.length < 3}
              className="px-3 py-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 disabled:opacity-40 text-stone-800 font-bold text-xs flex items-center space-x-1"
            >
              <Ruler className="w-3.5 h-3.5 text-emerald-700" />
              <span>{validationResult ? "✓ WGS84 OK" : "Verify WGS84"}</span>
            </button>
            <button
              onClick={handleSaveDrawnParcel}
              disabled={isSaving || drawVertices.length < 3}
              className="flex-1 py-2.5 rounded-2xl bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-sm shadow"
            >
              {isSaving
                ? "तपासत आहे..."
                : lang === "mr"
                ? "शेत सीमा जतन करा (Save Parcel)"
                : "Validate & Save Parcel"}
            </button>
          </div>
        </div>
      )}

      {/* Selected Saved Parcel Sheet */}
      {!isDrawing && selectedParcel && (
        <div className="absolute bottom-3 left-3 right-3 z-[1000] bg-white/95 backdrop-blur-md rounded-3xl p-4 shadow-2xl border-2 border-emerald-700 max-w-xl mx-auto">
          {statusBanner && (
            <div
              className={`mb-2 p-2 rounded-xl border text-xs font-bold ${
                statusBanner.type === "error"
                  ? "bg-rose-50 border-rose-300 text-rose-900"
                  : "bg-emerald-50 border-emerald-300 text-emerald-900"
              }`}
            >
              {statusBanner.text}
            </div>
          )}

          {isEditingMeta ? (
            <form onSubmit={handleUpdateSelectedMeta} className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-sm text-stone-900">शेत तपशील अद्ययावत करा</h4>
                <button
                  type="button"
                  onClick={() => setIsEditingMeta(false)}
                  className="text-stone-500 font-bold"
                >
                  रद्द करा
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="px-2.5 py-2 rounded-xl border border-stone-300 font-semibold"
                  required
                />
                <input
                  type="text"
                  value={editSurvey}
                  onChange={e => setEditSurvey(e.target.value)}
                  placeholder="गट / सर्व्हे क्र."
                  className="px-2.5 py-2 rounded-xl border border-stone-300 font-semibold"
                />
                <select
                  value={editSoil}
                  onChange={e => setEditSoil(e.target.value)}
                  className="px-2.5 py-2 rounded-xl border border-stone-300 font-semibold"
                >
                  <option value="medium_black">मध्यम काळी (Medium Black)</option>
                  <option value="deep_black">भारी काळी (Deep Black)</option>
                  <option value="shallow_black">हलकी / मुरमाड (Shallow)</option>
                  <option value="red_loamy">तांबडी गाळाची (Red Loamy)</option>
                </select>
                <select
                  value={editIrrigation}
                  onChange={e => setEditIrrigation(e.target.value)}
                  className="px-2.5 py-2 rounded-xl border border-stone-300 font-semibold"
                >
                  <option value="drip">ठिबक (Drip)</option>
                  <option value="well">विहीर (Well)</option>
                  <option value="canal">कालवा (Canal)</option>
                  <option value="borewell">बोअरवेल (Borewell)</option>
                  <option value="rainfed">कोरडवाहू (Rainfed)</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-extrabold"
              >
                जतन करा (Save Changes)
              </button>
            </form>
          ) : (
            <>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center space-x-2 flex-wrap">
                    <span className="w-3 h-3 rounded-full bg-emerald-600" />
                    <h3 className="font-extrabold text-base sm:text-lg text-stone-900">
                      {selectedParcel.name}
                    </h3>
                    {selectedParcel.survey_number && (
                      <span className="text-[11px] font-mono bg-stone-100 text-stone-700 px-2 py-0.5 rounded-lg border border-stone-200">
                        गट क्र. {selectedParcel.survey_number}
                      </span>
                    )}
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

                <div className="text-right tabular-nums">
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
                  <span className="text-stone-500 block text-[11px]">सर्वोत्तम पीक (Best Crop):</span>
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

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => {
                      setEditName(selectedParcel.name || "");
                      setEditSurvey(selectedParcel.survey_number || "");
                      setEditSoil(selectedParcel.soil_type || "medium_black");
                      setEditIrrigation(selectedParcel.irrigation_source || "drip");
                      setIsEditingMeta(true);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold flex items-center space-x-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Info</span>
                  </button>
                  <button
                    onClick={handleDownloadGeoJson}
                    className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold flex items-center space-x-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>GeoJSON</span>
                  </button>
                </div>

                <button
                  onClick={handleDeleteSelectedParcel}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center space-x-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>हटवा</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
