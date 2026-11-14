import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

def build_prd_pdf():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    font_dir = os.path.join(base_dir, 'fonts')
    reg_font = os.path.join(font_dir, 'NotoSansDevanagari-Regular.ttf')
    bold_font = os.path.join(font_dir, 'NotoSansDevanagari-Bold.ttf')

    pdfmetrics.registerFont(TTFont('NotoSansDev', reg_font))
    pdfmetrics.registerFont(TTFont('NotoSansDev-Bold', bold_font))

    pdf_path = os.path.normpath(os.path.join(base_dir, '..', 'docs', 'PRD.pdf'))
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='NotoSansDev-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#1b4332'),
        alignment=1
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='NotoSansDev',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#2d6a4f'),
        alignment=1
    )
    h1_style = ParagraphStyle(
        'Heading1',
        parent=styles['Normal'],
        fontName='NotoSansDev-Bold',
        fontSize=13,
        leading=17,
        textColor=colors.HexColor('#1b4332'),
        spaceBefore=12,
        spaceAfter=5
    )
    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='NotoSansDev',
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor('#2b2b2b'),
        spaceBefore=3,
        spaceAfter=3
    )
    bullet_style = ParagraphStyle(
        'Bullet',
        parent=styles['Normal'],
        fontName='NotoSansDev',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#2b2b2b'),
        leftIndent=14,
        spaceBefore=2,
        spaceAfter=2
    )

    elements = []

    # Title Section
    elements.append(Paragraph('TERRAWISE AI: Pilot PRD', title_style))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph('अहिल्या नगर आणि नाशिक जिल्हा शेतकरी पथदर्शी प्रकल्प (Ahilya Nagar &amp; Nashik Pilot)', subtitle_style))
    elements.append(Spacer(1, 8))
    elements.append(HRFlowable(width='100%', thickness=2, color=colors.HexColor('#1b4332'), spaceAfter=10))

    # Metadata Table
    meta_data = [
        [Paragraph('<b>प्रकल्प (Project):</b> TERRAWISE AI Pilot', body_style), Paragraph('<b>आवृत्ती (Version):</b> 1.0.0 (Production)', body_style)],
        [Paragraph('<b>जिल्हे (Districts):</b> Ahilya Nagar &amp; Nashik', body_style), Paragraph('<b>कमाल शेतकरी (Cap):</b> 20 Users Max', body_style)],
        [Paragraph('<b>तारीख (Date):</b> November 2026', body_style), Paragraph('<b>दर्जा (Status):</b> Certified PRD', body_style)]
    ]
    meta_table = Table(meta_data, colWidths=[260, 260])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#e8f5e9')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#81c784')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#c8e6c9')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 10))

    # 1. Executive Vision
    elements.append(Paragraph('१. प्रकल्प उद्दिष्ट व दृष्टीकोन (Vision &amp; Problem Statement)', h1_style))
    elements.append(Paragraph(
        'लहान शेतकर्‍यांना दुष्काळ, अवकाळी पाऊस, गारपीट आणि भूजल पातळी घसरणे यांसारख्या गंभीर हवामान संकटांचा सामना करावा लागतो. '
        'TERRAWISE AI द्वारे अहिल्या नगर आणि नाशिक जिल्ह्यातील कमाल २० शेतकर्‍यांना त्यांच्या शेताचा उपग्रह नकाशा, अचूक हवामान अंदाज, '
        'जमिनीतील ओलावा, आणि कीड नियंत्रण सल्ला सोप्या मराठी भाषेत मिळतो. सर्व माहिती १००% खरी व पडताळलेली आहे.', body_style))
    elements.append(Spacer(1, 6))

    # 2. Scope & Districts
    elements.append(Paragraph('२. कार्यक्षेत्र व वैशिष्ट्ये (Scope &amp; District Coverage)', h1_style))
    elements.append(Paragraph('• <b>अहिल्या नगर (Ahilya Nagar / Ahmednagar):</b> १४ तालुके (अहिल्यानगर, राहुरी, कोपरगाव, संगमनेर, अकोले, पारनेर, कर्जत, जामखेड, शेवगाव, पाथर्डी, श्रीरामपूर, राहाता, नेवासा). मुख्य पिके: कांदा, ऊस, बाजरी, ज्वारी, सोयाबीन, हरभरा.', bullet_style))
    elements.append(Paragraph('• <b>नाशिक (Nashik):</b> १५ तालुके (नाशिक, दिंडोरी, निफाड, चांदवड, सिन्नर, येवला, मालेगाव, कळवण, देवळा, बागलाण/सटाणा, नांदगाव, इगतपुरी, त्र्यंबकेश्वर, पेठ, सुरगाणा). मुख्य पिके: द्राक्षे (Grape Capital), कांदा (Lasalgaon Mandi), टोमॅटो, डाळिंब, मका.', bullet_style))
    elements.append(Spacer(1, 6))

    # 3. Core Requirements
    elements.append(Paragraph('३. मुख्य तांत्रिक नियम व निकष (Core Rules &amp; Technical Specifications)', h1_style))
    reqs = [
        '<b>R1 प्रत्यक्ष माहिती (Real Data Only):</b> कोणतीही खोटी किंवा बनावट माहिती नाही. केवळ अधिकृत API (Open-Meteo, NASA POWER, Agmarknet) चा वापर.',
        '<b>R2 माहिती नसणे म्हणजे शून्य नाही (Null != Zero):</b> रिकाम्या मूल्यासाठी "माहिती नाही" (No data) दर्शविणे; नोंदवलेले ० हे ० च दिसणे आवश्यक.',
        '<b>R3 स्रोत व दिनांक (Provenance):</b> प्रत्येक अंकासोबत स्रोत (Source) व अद्ययावत वेळ स्पष्ट असणे बंधनकारक.',
        '<b>R4 शेतकरी मर्यादा (Hard Limit 20):</b> कडक २० शेतकरी मर्यादा (MAX_FARMERS=20) SQLite BEGIN IMMEDIATE द्वारे हमी.',
        '<b>R5 सोपी भाषा (Farmer-Centric UX):</b> एका वाक्यात १२ पेक्षा कमी शब्द, १८px पेक्षा मोठा फॉन्ट, आयकॉन आणि शब्दांची जोडी.',
        '<b>R6 अचूक शेत सीमा (Precision GeoJSON):</b> WGS84 RFC 7946 मानकानुसार भूमापन, ०.५% पेक्षा जास्त त्रुटी तपासणी आणि शेती सीमा ओव्हरलॅप प्रतिबंध.'
    ]
    for r in reqs:
        elements.append(Paragraph(r, bullet_style))
    elements.append(Spacer(1, 8))

    # 4. Success Metrics
    elements.append(Paragraph('४. यशस्विता मापदंड (Success Metrics &amp; DoD)', h1_style))
    elements.append(Paragraph('• सर्व युनिट चाचण्या १००% उत्तीर्ण (GeoJSON, Concurrency, Credentials, Scorer).', bullet_style))
    elements.append(Paragraph('• मोबाईल लाइटहाऊस स्कोअर (Lighthouse Mobile): Performance 85+, Accessibility 95+.', bullet_style))
    elements.append(Paragraph('• ३६०px, ७६८px, १२८०px पडद्यांवर संपूर्ण कार्यक्षमता आणि स्क्रीनशॉट पडताळणी.', bullet_style))

    doc.build(elements)
    print(f'PRD.pdf generated successfully at {pdf_path}, size: {os.path.getsize(pdf_path)} bytes')

if __name__ == '__main__':
    build_prd_pdf()
