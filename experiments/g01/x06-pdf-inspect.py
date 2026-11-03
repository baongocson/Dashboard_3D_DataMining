"""Artifact verifier only; never imported by app/browser/export worker."""
import sys, json
from pathlib import Path
from pypdf import PdfReader
import pdfplumber

pdf, prefix = sys.argv[1:]
reader = PdfReader(pdf)
Path(prefix + '.txt').write_text('\n'.join(p.extract_text() or '' for p in reader.pages), encoding='utf-8')
fonts = []
for page in reader.pages:
    for ref in (page.get('/Resources', {}).get('/Font', {}) or {}).values():
        font = ref.get_object()
        descendants = font.get('/DescendantFonts')
        actual = descendants[0].get_object() if descendants else font
        descriptor = actual.get('/FontDescriptor', {})
        if hasattr(descriptor, 'get_object'):
            descriptor = descriptor.get_object()
        fonts.append({'name': str(font.get('/BaseFont')), 'embedded': any(k in descriptor for k in ['/FontFile', '/FontFile2', '/FontFile3']), 'toUnicode': '/ToUnicode' in font})
chars, images, violations = 0, 0, []
with pdfplumber.open(pdf) as doc:
    for i, page in enumerate(doc.pages):
        chars += len(page.chars)
        images += len(page.images)
        for char in page.chars:
            if char['x0'] < 0 or char['x1'] > page.width or char['top'] < 0 or char['bottom'] > page.height:
                violations.append({'page': i+1, 'text': char['text'], 'x0': char['x0'], 'x1': char['x1'], 'top': char['top'], 'bottom': char['bottom']})
Path(prefix + '-fonts.json').write_text(json.dumps(fonts, ensure_ascii=False, indent=2), encoding='utf-8')
Path(prefix + '-bounds.json').write_text(json.dumps({'charCount': chars, 'imageCount': images, 'boundsPassed': chars > 0 and not violations, 'violations': violations}, ensure_ascii=False, indent=2), encoding='utf-8')
