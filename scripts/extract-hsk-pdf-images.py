#!/usr/bin/env python3
"""Crop the approved source PDF directly. Never redraw or generate exam images."""
import argparse
import hashlib
import json
from pathlib import Path
import pdfplumber

repo = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('pdf', type=Path)
args = parser.parse_args()
config = json.loads((repo / 'src/data/hskPdfImageRegions.json').read_text())
source_hash = hashlib.sha256(args.pdf.read_bytes()).hexdigest()
if source_hash != config['sourceSha256']:
    raise SystemExit('Source PDF hash differs; review crop coordinates before changing exam assets.')
asset_dir = f'images/hsk/source-{source_hash[:12]}'
target = repo / 'public' / asset_dir
target.mkdir(parents=True, exist_ok=True)
assets = {}
examples = {}
with pdfplumber.open(args.pdf) as pdf:
    # Render each source page once; the crop includes only source pixels.
    pages = {n: pdf.pages[n-1].to_image(resolution=300).original
             for n in {r['pageIndex'] for r in config['regions']}}
    for region in config['regions']:
        page = pdf.pages[region['pageIndex']-1]
        raster = pages[region['pageIndex']]
        x0, top, x1, bottom = region['bbox']
        box = (round(x0 * raster.width / page.width), round(top * raster.height / page.height),
               round(x1 * raster.width / page.width), round(bottom * raster.height / page.height))
        crop = raster.crop(box)
        path = target / (region['id'] + '.png')
        crop.save(path)
        collection = examples if region.get('exampleOnly') else assets
        collection[region['id']] = {
            'src': f'/{asset_dir}/{path.name}', 'page': region['pageIndex'], 'bbox': region['bbox'],
            'width': crop.width, 'height': crop.height,
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        }
manifest = {'sourceFilename': config['sourceFilename'], 'sourceSha256': source_hash,
            'method': 'direct_pdf_page_crop', 'renderDpi': 300, 'assets': assets}
(repo / 'src/data/hskPdfImages.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
(repo / 'src/data/hskPdfExamples.json').write_text(json.dumps({**manifest, 'assets': examples}, ensure_ascii=False, indent=2)+'\n')
print(f'Cropped {len(assets)} source images into {target}')
