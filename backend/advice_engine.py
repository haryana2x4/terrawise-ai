"""
Kshetra - Agronomic Advice & Multi-Factor Crop Recommendation Engine
Deterministic, explainable scoring algorithm mapping crop physiological demands to real environmental telemetry.
"""

import os
import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from utils import safe_value

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CROPS_FILE = os.path.normpath(os.path.join(BASE_DIR, "..", "data", "crops.json"))
RULES_FILE = os.path.normpath(os.path.join(BASE_DIR, "..", "data", "risk-rules.json"))

def load_crops_db() -> List[Dict[str, Any]]:
    if os.path.exists(CROPS_FILE):
        with open(CROPS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

def get_current_season() -> Dict[str, Any]:
    """Determines agricultural season based on current date in Maharashtra."""
    month = datetime.utcnow().month
    if 6 <= month <= 10:
        return {
            "id": "kharif",
            "name_en": "Kharif",
            "name_mr": "खरीप",
            "months_en": "June to October",
            "months_mr": "जून ते ऑक्टोबर",
            "next_season": "rabi"
        }
    elif month in (11, 12, 1, 2, 3):
        return {
            "id": "rabi",
            "name_en": "Rabi",
            "name_mr": "रब्बी",
            "months_en": "October to March",
            "months_mr": "ऑक्टोबर ते मार्च",
            "next_season": "summer"
        }
    else:
        return {
            "id": "summer",
            "name_en": "Summer",
            "name_mr": "उन्हाळी",
            "months_en": "March to June",
            "months_mr": "मार्च ते जून",
            "next_season": "kharif"
        }

def evaluate_crop_suitability(
    crop: Dict[str, Any],
    season_id: str,
    district: str,
    soil_type: str,
    irrigation_source: str,
    current_temp: Optional[float],
    root_moisture_pct: Optional[float],
    priority: str = "balanced"
) -> Dict[str, Any]:
    """
    Computes an explainable Suitability Score (0 to 100) based on 5 transparent pillars:
    1. Seasonal alignment (30 pts)
    2. Soil compatibility (25 pts)
    3. Water need vs availability (20 pts)
    4. Thermal tolerance (15 pts)
    5. Farmer priority bonus (10 pts)
    """
    reasons_mr = []
    reasons_en = []
    actions_mr = []
    actions_en = []

    # 1. Seasonal alignment
    season_str = str(crop.get("season", "")).lower()
    is_perennial = "perennial" in season_str
    is_season_match = (season_id in season_str) or is_perennial

    if is_season_match:
        s_score = 30.0
        reasons_mr.append(f"सध्याच्या {season_id} हंगामासाठी योग्य.")
        reasons_en.append(f"Optimal for current {season_id} season.")
    else:
        s_score = 5.0
        reasons_mr.append("हंगाम संपत आला आहे किंवा अनुकूल नाही.")
        reasons_en.append("Off-season planting window.")

    # 2. Soil compatibility
    soil_pref = str(crop.get("soil_preference", "")).lower()
    soil_current = soil_type.lower()
    
    if any(k in soil_pref for k in ["black", "clay", "vertisol"]) and ("black" in soil_current or "vertisol" in soil_current or "clay" in soil_current):
        soil_score = 25.0
        reasons_mr.append("तुमच्या काळ्या कसदार जमिनीशी पूर्ण जुळणारे.")
        reasons_en.append("Matches your fertile black clay soil.")
    elif "loam" in soil_pref and "loam" in soil_current:
        soil_score = 25.0
        reasons_mr.append("तुमच्या पोयटा जमिनीशी सुसंगत.")
        reasons_en.append("Compatible with your loam soil texture.")
    else:
        soil_score = 15.0

    # 3. Water availability vs requirement
    water_need = crop.get("water_need_mm", 400)
    has_canal = any(w in irrigation_source.lower() for w in ["canal", "drip", "pond"])
    has_well = any(w in irrigation_source.lower() for w in ["well", "borewell"])
    
    if water_need <= 350: # Drought hardy (Bajra, Gram, Moong, Jowar)
        water_score = 20.0
        reasons_mr.append("कमी पाण्यात (३००-३५० मिमी) उत्तम उत्पादन.")
        reasons_en.append("Low water requirement (300-350mm).")
    elif water_need <= 550:
        if has_canal or has_well or (root_moisture_pct and root_moisture_pct > 50):
            water_score = 20.0
            reasons_mr.append("उपलब्ध पाण्यावर व्यवस्थित येते.")
            reasons_en.append("Manageable with current water access.")
        else:
            water_score = 12.0
            reasons_mr.append("मध्यम पाण्याची गरज; संरक्षित ओलिताची सोय हवी.")
            reasons_en.append("Needs protective irrigation cycle.")
    else: # High water (Sugarcane, Grapes)
        if has_canal or (has_well and "over-exploited" not in district.lower()):
            water_score = 18.0
        else:
            water_score = 8.0
            reasons_mr.append("पाण्याची जास्त गरज; दुष्काळात धोका संभवतो.")
            reasons_en.append("High water demand; drought vulnerability.")

    # 4. Temperature tolerance
    temp_range = crop.get("temp_range_c", {"min": 15, "max": 35})
    t_min = temp_range.get("min", 10)
    t_max = temp_range.get("max", 38)

    if current_temp is not None:
        if t_min <= current_temp <= t_max:
            temp_score = 15.0
        else:
            temp_score = 8.0
            reasons_mr.append("सध्याचे तापमान वाढ किंवा घट दर्शवते.")
            reasons_en.append("Sub-optimal ambient temperature.")
    else:
        temp_score = 12.0

    # 5. Priority bonus
    p_score = 8.0
    if priority == "save_water" and water_need <= 350:
        p_score = 10.0
    elif priority == "earn_more" and crop.get("msp_inr_qtl", 0) and crop.get("msp_inr_qtl", 0) > 4000:
        p_score = 10.0
    elif priority == "improve_soil" and crop.get("id") in ("soybean", "gram", "tur", "green_gram", "black_gram"):
        p_score = 10.0
        reasons_mr.append("जमिनीत नत्र (नायट्रोजन) स्थिर करून जमीन सुपीक करते.")
        reasons_en.append("Fixes nitrogen and restores soil fertility.")

    total_score = round(s_score + soil_score + water_score + temp_score + p_score, 1)

    # Classify Fit
    if total_score >= 80:
        fit_en, fit_mr = "Good", "उत्तम (Good)"
    elif total_score >= 60:
        fit_en, fit_mr = "OK", "मध्यम (OK)"
    else:
        fit_en, fit_mr = "Poor", "कमी योग्य (Poor)"

    # Classify Risk
    if water_score >= 18 and temp_score >= 12 and is_season_match:
        risk_en, risk_mr = "Low", "कमी (Low)"
    elif total_score >= 65:
        risk_en, risk_mr = "Medium", "मध्यम (Medium)"
    else:
        risk_en, risk_mr = "High", "जास्त (High)"

    # "First 3 things to do" (पहिल्या ३ गोष्टी)
    if crop["id"] == "onion":
        actions_mr = [
            "१. गादीवाफ्यावर रोपवाटिका तयार करा (ट्रायकोडर्मा ५ ग्रॅम/किलो बीजप्रक्रिया).",
            "२. पुनर्लागवडीवेळी एकरी १० टन चांगले कुजलेले शेणखत टाका.",
            "३. फुलकिडे (थ्रिप्स) नियंत्रणासाठी एकरी २५ पिवळे व निळे चिकट सापळे लावा."
        ]
        actions_en = [
            "1. Prepare raised nursery beds with Trichoderma seed treatment (5g/kg).",
            "2. Incorporate 10 tonnes well-decomposed FYM per acre before transplanting.",
            "3. Install 25 yellow & blue sticky traps per acre for thrips surveillance."
        ]
    elif crop["id"] == "gram":
        actions_mr = [
            "१. विजय किंवा दिग्विजय वाणाची निवड करा; रायझोबियमची बीजप्रक्रिया करा.",
            "२. वाफसा असतानाच पेरणी उरका; जास्त ओलावा असल्यास उबळण्याचा धोका टाळा.",
            "३. घाटे अळीच्या देखरेखीसाठी एकरी ५ कामगंध सापळे (हेलिल्यूर) लावा."
        ]
        actions_en = [
            "1. Choose Vijay or Digvijay variety; treat seed with Rhizobium.",
            "2. Sow at optimal moisture (Vaphsa) condition; avoid excess watering.",
            "3. Install 5 pheromone traps (Helilure) per acre for pod borer monitoring."
        ]
    elif crop["id"] == "wheat":
        actions_mr = [
            "१. २० नोव्हेंबरपूर्वी वेळेवर पेरणी उरका (समाधान किंवा त्र्यंबक वाण).",
            "२. पेरणीनंतर २१ व्या दिवशी मुकुट मुळे फुटण्याच्या वेळी पहिले पाणी द्या.",
            "३. मार्चमधील संभाव्य उष्णतेपासून बचावासाठी सेंद्रिय आच्छादन वापरा."
        ]
        actions_en = [
            "1. Complete sowing before Nov 20 to avoid late heat stress.",
            "2. Provide critical first irrigation at CRI stage (21 days after sowing).",
            "3. Apply surface organic mulch to insulate against March heat."
        ]
    elif crop["id"] in ("green_gram", "black_gram"):
        actions_mr = [
            "१. ६० दिवसांच्या कमी कालावधीच्या प्रमाणित बियाणांची निवड करा.",
            "२. पेरणीपूर्वी ट्रायकोडर्मा आणि फॉस्फोरस विरघळवणाऱ्या जिवाणूंची प्रक्रिया करा.",
            "३. फुलोरा अवस्थेत पाण्याचा ताण पडू देऊ नका."
        ]
        actions_en = [
            "1. Select certified 60-day short-duration seed variety.",
            "2. Seed treatment with Trichoderma and PSB culture.",
            "3. Ensure protective moisture during peak flowering stage."
        ]
    else:
        actions_mr = [
            f"१. {crop.get('marathi_name')} पिकासाठी प्रमाणित बियाणे व जैविक बीजप्रक्रिया वापरा.",
            "२. माती परीक्षणानुसार रासायनिक खतांचा समतोल वापर करा.",
            "३. कीड व रोगांच्या नियंत्रणासाठी IPM पद्धतींचा प्रथम अवलंब करा."
        ]
        actions_en = [
            f"1. Source certified seed and apply biological seed treatment for {crop.get('common_name')}.",
            "2. Apply balanced fertilizers per Soil Health Card recommendations.",
            "3. Deploy IPM cultural and biological practices as first line of defense."
        ]

    # Mandi price / MSP display
    msp = crop.get("msp_inr_qtl")
    price_range = crop.get("price_range_inr_qtl", {})
    mandi_modal = price_range.get("modal")

    return {
        "crop_id": crop["id"],
        "common_name": crop["common_name"],
        "marathi_name": crop["marathi_name"],
        "scientific_name": crop["scientific_name"],
        "score": total_score,
        "fit": {"en": fit_en, "mr": fit_mr},
        "risk": {"en": risk_en, "mr": risk_mr},
        "top_reasons": {
            "mr": reasons_mr[:2],
            "en": reasons_en[:2]
        },
        "first_3_actions": {
            "mr": actions_mr,
            "en": actions_en
        },
        "water_need_mm": water_need,
        "duration_days": crop.get("duration_days", 100),
        "typical_yield_kg_ha": crop.get("typical_yield_kg_ha"),
        "msp_inr_qtl": msp,
        "mandi_price_modal_inr": mandi_modal,
        "sowing_window": crop.get("sowing_window"),
        "source": crop.get("source")
    }

def generate_parcel_advice(
    district: str,
    taluka: str,
    soil_type: str,
    irrigation_source: str,
    current_weather: Dict[str, Any],
    priority: str = "balanced"
) -> Dict[str, Any]:
    """Generates Top 3 crop recommendations and environmental risk diagnostic panel."""
    crops_db = load_crops_db()
    season = get_current_season()

    curr = current_weather.get("current", {})
    temp_val = curr.get("temperature", {}).get("value")
    root_moisture_val = curr.get("soil_root_hydration_pct", {}).get("value")

    # Evaluate each crop
    scored_crops = []
    for crop in crops_db:
        ev = evaluate_crop_suitability(
            crop=crop,
            season_id=season["id"],
            district=district,
            soil_type=soil_type,
            irrigation_source=irrigation_source,
            current_temp=temp_val,
            root_moisture_pct=root_moisture_val,
            priority=priority
        )
        scored_crops.append(ev)

    # Sort descending by score
    scored_crops.sort(key=lambda x: x["score"], reverse=True)
    top_3 = scored_crops[:3]

    # Generate Risk Traffic Light Panel
    # 1. Temperature diagnostic
    if temp_val is None:
        temp_status = {"level": "gray", "label_mr": "माहिती नाही", "label_en": "No data", "text_mr": "तापमान माहिती उपलब्ध नाही."}
    elif temp_val < 15.0:
        temp_status = {"level": "blue", "label_mr": "थंड (Cool)", "label_en": "Cool", "text_mr": f"तापमान {temp_val}°C आहे, रब्बी पिकांना अनुकूल."}
    elif temp_val <= 32.0:
        temp_status = {"level": "green", "label_mr": "उत्तम (Good)", "label_en": "Good", "text_mr": f"तापमान {temp_val}°C पिकांच्या वाढीसाठी पोषक आहे."}
    else:
        temp_status = {"level": "red", "label_mr": "उष्ण (Hot)", "label_en": "Hot", "text_mr": f"तापमान {temp_val}°C जास्त आहे; दुपारचे ओलिताचे नियोजन करा."}

    # 2. Soil Moisture diagnostic
    if root_moisture_val is None:
        soil_status = {"level": "gray", "label_mr": "माहिती नाही", "label_en": "No data", "text_mr": "माती ओलावा माहिती उपलब्ध नाही."}
    elif root_moisture_val < 35.0:
        soil_status = {"level": "red", "label_mr": "कोरडी (Dry)", "label_en": "Dry", "text_mr": f"मुळांखाली ओलावा कमी ({root_moisture_val}%) आहे; पाणी द्यावे."}
    elif root_moisture_val <= 75.0:
        soil_status = {"level": "green", "label_mr": "उत्तम (Good)", "label_en": "Good", "text_mr": f"जमिनीत पुरेसा ओलावा ({root_moisture_val}%) आहे."}
    else:
        soil_status = {"level": "orange", "label_mr": "जास्त ओलावा (Wet)", "label_en": "Too Wet", "text_mr": f"जास्त पाणी ({root_moisture_val}%); पाण्याचा निचरा करा."}

    # 3. Pest Risk diagnostic (Current Season)
    pest_risk = {
        "level": "green",
        "label_mr": "कमी धोका (Low Risk)",
        "label_en": "Low Risk",
        "text_mr": "सध्या हवामान कोरडे असल्याने कीड रोगांचा धोका कमी आहे. चिकट सापळे लावा.",
        "text_en": "Dry microclimate suppresses fungal sporulation. Deploy sticky traps.",
        "action_mr": "रासायनिक फवारणी टाळा; निंबोळी अर्क ५% वापरा.",
        "action_en": "Avoid synthetic sprays; apply 5% NSKE neem spray."
    }
    if temp_val and temp_val > 28.0 and root_moisture_val and root_moisture_val < 45.0:
        pest_risk = {
            "level": "orange",
            "label_mr": "मध्यम धोका: फुलकिडे (Thrips Alert)",
            "label_en": "Medium Risk: Thrips Alert",
            "text_mr": "कोरड्या व उष्ण हवेमुळे कांद्यावर थ्रिप्स (फुलकिडे) वाढण्याची शक्यता आहे.",
            "text_en": "Hot dry weather promotes onion thrips reproduction.",
            "action_mr": "निळ्या व पिवळ्या चिकट सापळ्यांची संख्या वाढवा.",
            "action_en": "Increase blue and yellow sticky cards in field."
        }

    return {
        "season": season,
        "top_crops": top_3,
        "diagnostics": {
            "temperature": temp_status,
            "soil_water": soil_status,
            "pest_risk": pest_risk
        },
        "disclaimer_mr": "टीप: हा सल्ला अधिकृत कृषी विद्यापीठ (MPKV) मानकांवर आधारित आहे. कोणतीही रासायनिक फवारणी करण्यापूर्वी आपल्या स्थानिक KVK शी खात्री करा.",
        "disclaimer_en": "Note: Advisory based on MPKV Rahuri standards. Confirm with your local KVK before chemical applications."
    }
