"""
Kshetra - Bilingual Credential Card PDF Generator
Generates A6 single cards and A4 batch cards (4 per page) with embedded Noto Sans Devanagari,
QR codes, and natural one-time passwords.
"""

import os
import io
import qrcode
from PIL import Image
from reportlab.lib.pagesizes import letter, A4, A6
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FONTS_DIR = os.path.join(BASE_DIR, "fonts")

REG_FONT = os.path.join(FONTS_DIR, "NotoSansDevanagari-Regular.ttf")
BOLD_FONT = os.path.join(FONTS_DIR, "NotoSansDevanagari-Bold.ttf")

if os.path.exists(REG_FONT):
    try:
        pdfmetrics.registerFont(TTFont("NotoSansDev", REG_FONT))
    except Exception:
        pass
if os.path.exists(BOLD_FONT):
    try:
        pdfmetrics.registerFont(TTFont("NotoSansDev-Bold", BOLD_FONT))
    except Exception:
        pass

def generate_qr_buffer(content: str) -> io.BytesIO:
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=4,
        border=1,
    )
    qr.add_data(content)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#1b4332", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf

def build_single_card_a6(farmer_data: dict, output_path: str, login_url: str = "http://localhost:5173/login"):
    """
    Builds a single A6 printable farmer credential card (105mm x 148mm).
    farmer_data must contain: farmer_id, full_name, village, taluka, district, one_time_password
    """
    # A6 dimensions in points: 297.64 x 419.53
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A6,
        leftMargin=15,
        rightMargin=15,
        topMargin=15,
        bottomMargin=15
    )

    styles = getSampleStyleSheet()
    header_style = ParagraphStyle(
        "CardHeader",
        fontName="NotoSansDev-Bold",
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#1b4332"),
        alignment=1
    )
    subhead_style = ParagraphStyle(
        "CardSubhead",
        fontName="NotoSansDev",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#2d6a4f"),
        alignment=1
    )
    label_style = ParagraphStyle(
        "CardLabel",
        fontName="NotoSansDev-Bold",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#1b4332")
    )
    val_style = ParagraphStyle(
        "CardVal",
        fontName="NotoSansDev",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#2b2b2b")
    )
    cred_id_style = ParagraphStyle(
        "CredID",
        fontName="NotoSansDev-Bold",
        fontSize=14,
        leading=17,
        textColor=colors.HexColor("#1b4332"),
        alignment=1
    )
    cred_pass_style = ParagraphStyle(
        "CredPass",
        fontName="NotoSansDev-Bold",
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#b71c1c"),
        alignment=1
    )
    small_style = ParagraphStyle(
        "CardSmall",
        fontName="NotoSansDev",
        fontSize=7,
        leading=9.5,
        textColor=colors.HexColor("#555555"),
        alignment=1
    )

    elements = []

    # Title
    elements.append(Paragraph("Kshetra • शेतकरी ओळखपत्र", header_style))
    elements.append(Paragraph("Pilot Farmer Credential Card", subhead_style))
    elements.append(Spacer(1, 6))

    # Farmer info table
    info_data = [
        [Paragraph("<b>शेतकऱ्याचे नाव / Name:</b>", label_style), Paragraph(farmer_data.get("full_name", ""), val_style)],
        [Paragraph("<b>गाव / Village:</b>", label_style), Paragraph(farmer_data.get("village", ""), val_style)],
        [Paragraph("<b>तालुका / Taluka:</b>", label_style), Paragraph(farmer_data.get("taluka", ""), val_style)],
        [Paragraph("<b>जिल्हा / District:</b>", label_style), Paragraph(farmer_data.get("district", ""), val_style)]
    ]
    info_table = Table(info_data, colWidths=[110, 150])
    info_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f8e9")),
        ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#81c784")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#c8e6c9")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 8))

    # Credentials Box with QR
    qr_buf = generate_qr_buffer(f"{login_url}?id={farmer_data.get('farmer_id')}")
    qr_img = RLImage(qr_buf, width=70, height=70)

    cred_data = [
        [
            Paragraph(f"<b>शेतकरी आयडी (Farmer ID)</b><br/>{farmer_data.get('farmer_id', '')}", cred_id_style),
            qr_img
        ],
        [
            Paragraph(f"<b>तात्पुरता पासवर्ड (One-Time Password)</b><br/>{farmer_data.get('one_time_password', '********')}", cred_pass_style),
            Paragraph("स्कॅन करून लॉगिन करा<br/>Scan to Login", small_style)
        ]
    ]
    cred_table = Table(cred_data, colWidths=[180, 80])
    cred_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fff9c4")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#fbc02d")),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(cred_table)
    elements.append(Spacer(1, 8))

    # Footer note & helpline
    elements.append(Paragraph("<b>महत्त्वाची सूचना:</b> हा पासवर्ड कोणालाही सांगू नका. पहिल्या लॉगिननंतर नवीन पासवर्ड ठेवा.", small_style))
    elements.append(Paragraph("<b>हेल्पलाइन (Helpline):</b> 1800-123-4567 • कृषी विज्ञान केंद्र (KVK)", small_style))

    doc.build(elements)
    return output_path

def build_batch_cards_a4(farmers_list: list, output_path: str, login_url: str = "http://localhost:5173/login"):
    """
    Builds an A4 sheet containing up to 4 farmer credential cards per page in a 2x2 grid.
    """
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=20,
        rightMargin=20,
        topMargin=20,
        bottomMargin=20
    )

    styles = getSampleStyleSheet()
    header_style = ParagraphStyle("H", fontName="NotoSansDev-Bold", fontSize=11, leading=14, textColor=colors.HexColor("#1b4332"), alignment=1)
    val_style = ParagraphStyle("V", fontName="NotoSansDev", fontSize=8, leading=10.5, textColor=colors.HexColor("#2b2b2b"))
    id_style = ParagraphStyle("I", fontName="NotoSansDev-Bold", fontSize=12, leading=15, textColor=colors.HexColor("#1b4332"), alignment=1)
    pass_style = ParagraphStyle("P", fontName="NotoSansDev-Bold", fontSize=10, leading=13, textColor=colors.HexColor("#b71c1c"), alignment=1)
    small_style = ParagraphStyle("S", fontName="NotoSansDev", fontSize=6.5, leading=8.5, textColor=colors.HexColor("#555555"), alignment=1)

    cards = []
    for f in farmers_list:
        qr_buf = generate_qr_buffer(f"{login_url}?id={f.get('farmer_id')}")
        qr_img = RLImage(qr_buf, width=50, height=50)

        card_content = [
            Paragraph("<b>Kshetra • शेतकरी ओळखपत्र</b>", header_style),
            Paragraph(f"<b>नाव:</b> {f.get('full_name')} | <b>गाव:</b> {f.get('village')}, {f.get('taluka')}", val_style),
            Spacer(1, 3),
            Table([
                [Paragraph(f"<b>ID:</b> {f.get('farmer_id')}", id_style), qr_img],
                [Paragraph(f"<b>Pass:</b> {f.get('one_time_password', '********')}", pass_style), Paragraph("Scan QR", small_style)]
            ], colWidths=[180, 60], style=[
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fff9c4")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#fbc02d")),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE")
            ]),
            Paragraph("हेल्पलाइन: 1800-123-4567 | KVK Support", small_style)
        ]
        
        card_table = Table([[card_content]], colWidths=[265])
        card_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f9fbe7")),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#81c784")),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ]))
        cards.append(card_table)

    # Grid into 2 columns
    grid_rows = []
    for i in range(0, len(cards), 2):
        row = [cards[i]]
        if i + 1 < len(cards):
            row.append(cards[i + 1])
        else:
            row.append(Paragraph("", val_style))
        grid_rows.append(row)

    main_grid = Table(grid_rows, colWidths=[275, 275])
    main_grid.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
    ]))

    doc.build([main_grid])
    return output_path
