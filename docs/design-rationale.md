# TERRAWISE AI — Front Page Redesign Rationale

## Why "A Living Farm Window"?
Generic enterprise and SaaS portals treat the login page as an afterthought: sterile white boxes, cold grey gradients, or uninspired stock photos of glass skyscrapers. 

For a smallholder farmer in Rahuri (Ahilya Nagar) or Niphad (Nashik) logging in at dawn before heading to the field or at dusk after returning from the mandi, technology must feel warm, respectful, and grounded in their daily reality.

"A Living Farm Window" transforms the login screen into a window looking out onto Maharashtra's agricultural landscape:
1. **Time-Aware Familiarity**: When the farmer opens the app at 6:00 AM, the app displays the misty dawn over onion fields and greets them with "शुभ प्रभात". At noon, it shows the bright canopy of sugarcane and grapes with "शुभ दुपार". At midnight, it shifts to the quiet indigo sky with fireflies and "शुभ रात्री".
2. **Real Astronomical Sunlight**: The shadow beneath the login card actually shifts based on the sun's azimuth angle over Maharashtra.
3. **Real-Time Data Trust (Rule R1)**: Before logging in, the farmer sees live temperatures and weather for Nashik and Ahilya Nagar directly from Open-Meteo, establishing immediate credibility.

---

## Clean Card Layout vs. Demo Clutter
In early prototypes, demo buttons cluttered the bottom of the login card. In real-world pilots, real farmers were confused by hardcoded persona buttons ("Is this my account? Do I click Ramesh or Eknath?").

**The Solution**:
- The main card contains **only** what a farmer needs: Farmer ID input (with clear example placeholder `उदा. NSK-001 किंवा AHN-001`), password input, and the primary "लॉगिन करा" action.
- For testers, evaluators, and field officers, an unobtrusive **Evaluator / Demo Drawer** is provided, opened by pressing `D`, adding `?demo=1` to the URL, or clicking the subtle sparkler text. This keeps the farmer's interface clean, respectful, and focused.

---

## Grade-4 Language & Typography
- Sentences are kept to **12 words or fewer** (Rule R5).
- Body text is set to **18px or larger** for effortless readability under direct sunlight on low-resolution mobile displays.
- Marathi is the default language, with Hindi and English available with a single tap.
- Touch targets exceed the **48px minimum** to accommodate rough hands in outdoor farm environments.
