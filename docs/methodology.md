# TERRAWISE AI — Agronomic Methodology & Scoring Formulas
*Scientific Reference Documentation for Pilot Districts: Ahilya Nagar & Nashik*

## 1. Overview
The TERRAWISE AI agronomic decision engine replaces black-box heuristics with deterministic, explainable multi-criteria scoring calibrated to the agro-climatic reality of Maharashtra's Western Plain (MH-5), Scarcity Zone (MH-6), and Sub-Mountain Horticultural Zones (MH-3/4).

---

## 2. Mathematical Formulations

### 2.1 Vapor Pressure Deficit (VPD in kPa)
Vapor Pressure Deficit measures the atmospheric drying force driving crop transpiration. Calculated from 2m air temperature ($T$ in °C) and relative humidity ($RH$ in %) via Tetens formulation:
$$e_s = 0.61078 \exp\left(\frac{17.27 \cdot T}{T + 237.3}\right)$$
$$e_a = e_s \cdot \left(\frac{RH}{100.0}\right)$$
$$VPD = \max(0.0, e_s - e_a)$$

**Agronomic Interpretation for Maharashtra:**
- $VPD < 0.8\text{ kPa}$: Low evaporative stress; high fungal sporulation risk (downy mildew in grapes).
- $0.8 \le VPD \le 1.6\text{ kPa}$: Optimal transpiration zone.
- $VPD > 2.0\text{ kPa}$: Acute atmospheric draw; triggers stomatal closure, flower drop in soybean, and thrips escalation on onions.

### 2.2 Growing Degree Days (GDD)
Thermal units accumulated for crop phenological progress:
$$GDD = \max\left(0.0, \frac{T_{max} + T_{min}}{2} - T_{base}\right)$$
Where $T_{base} = 10.0^\circ\text{C}$ for warm Kharif crops (cotton, bajra, soybean) and $5.0^\circ\text{C}$ for winter Rabi crops (chickpea, wheat).

### 2.3 Root-Zone Soil Hydration Index (RSHI %)
Synthesizes volumetric soil water content ($\theta$ in $m^3/m^3$) at 28–100 cm depth relative to field capacity ($\theta_{FC} \approx 0.40\text{ m}^3/\text{m}^3$ for Vertisols):
$$RSHI = \min\left(100.0, \frac{\theta_{28-100\text{cm}}}{\theta_{FC}} \times 100\right)$$
- $RSHI < 35\%$: Acute root-zone deficit (prompts drought-hardy pulses/millets).
- $35\% \le RSHI \le 75\%$: Healthy moisture band.
- $RSHI > 85\%$: Waterlogging threat in Vertisols.

---

## 3. Crop Suitability Scoring Model (0 to 100 Points)

Every candidate crop $C$ is evaluated per parcel $P$ using five transparent pillars:
$$\text{Score}(C, P) = S_{\text{season}} + S_{\text{soil}} + S_{\text{water}} + S_{\text{temp}} + S_{\text{priority}}$$

| Pillar | Weight | Evaluation Logic |
|---|---|---|
| **$S_{\text{season}}$ (Season Match)** | 30 pts | 30 pts if current season aligns with crop calendar; 5 pts if off-season. |
| **$S_{\text{soil}}$ (Soil Compatibility)** | 25 pts | 25 pts if parcel soil texture matches crop preference (e.g. Vertisols for cotton/sugarcane; loam for onion/grapes); 15 pts otherwise. |
| **$S_{\text{water}}$ (Water Balance)** | 20 pts | 20 pts if water demand $\le 350\text{ mm}$ or irrigation source is secure; scaled down to 8 pts for thirsty crops in rainshadow/over-exploited talukas. |
| **$S_{\text{temp}}$ (Thermal Tolerance)** | 15 pts | 15 pts if ambient temperature is within $[T_{min}, T_{max}]$; 8 pts if approaching extreme heat/frost thresholds. |
| **$S_{\text{priority}}$ (Farmer Priority)** | 10 pts | 10 pts bonus for crops aligning with farmer priority (save water $\rightarrow$ millets/pulses; earn more $\rightarrow$ high MSP/mandi crops; improve soil $\rightarrow$ nitrogen-fixing legumes). |

### Score Categorization
- **Good (उत्तम):** Score $\ge 80$
- **OK (मध्यम):** $60 \le \text{Score} < 80$
- **Poor (कमी योग्य):** Score $< 60$

---

## 4. Risk Classification Matrix
Risks are classified into **Low**, **Medium**, and **High** based on verified ICAR-CRIDA and MPKV empirical rules:
- **Dry Spell Risk:** Low ($<7$ days), Medium ($7-14$ days), High ($>14$ days without rain).
- **Vineyard Frost Risk:** Low ($>10^\circ\text{C}$), Medium ($6-10^\circ\text{C}$), High ($<6^\circ\text{C}$).
- **Terminal Heat Risk:** Low ($<32^\circ\text{C}$), Medium ($32-35^\circ\text{C}$), High ($>35^\circ\text{C}$).
