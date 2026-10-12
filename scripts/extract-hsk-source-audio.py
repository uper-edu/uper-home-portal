#!/usr/bin/env python3
"""Copy original MP3 frames by reviewed time ranges. No synthesis, speed or pitch changes."""
import argparse, hashlib, json, subprocess
from pathlib import Path
repo=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('source',type=Path)
parser.add_argument('--ffmpeg',required=True)
args=parser.parse_args()
regions=json.loads((repo/'src/data/hskAudioRegions.json').read_text())
source_hash=hashlib.sha256(args.source.read_bytes()).hexdigest()
if source_hash!=regions['sourceSha256']:raise SystemExit('Source hash mismatch; review before replacing audio.')
asset_dir=f'audio/source-{source_hash[:12]}'
target=repo/'public'/asset_dir;target.mkdir(parents=True,exist_ok=True)
assets={}
def packet_hashes(file):
    data=subprocess.check_output([args.ffmpeg,'-v','error','-i',str(file),'-map','0:a:0','-c:a','copy','-f','framehash','-hash','sha256','-'],text=True)
    return [line.rsplit(',',1)[1].strip() for line in data.splitlines() if line and not line.startswith('#')]
source_packets=packet_hashes(args.source)
for r in regions['regions']:
    dest=target/f'q{r["id"]}.mp3'
    subprocess.run([args.ffmpeg,'-v','error','-y','-i',str(args.source),'-ss',str(r['start']),'-to',str(r['end']),'-c:a','copy','-write_xing','0','-map_metadata','-1',str(dest)],check=True)
    # Read the actual duration using ffmpeg, independent of planned ranges.
    info=subprocess.run([args.ffmpeg,'-i',str(dest),'-f','null','-'],capture_output=True,text=True).stderr
    import re
    match=re.search(r'Duration: (\d+):(\d+):([\d.]+)',info)
    duration=int(match[1])*3600+int(match[2])*60+float(match[3])
    assets[str(r['id'])]={'src':f'/{asset_dir}/{dest.name}','startSec':r['start'],'endSec':r['end'],'durationSec':duration,'recordedNumber':r['recordedNumber'],'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()}
    crop_packets=packet_hashes(dest)
    matches=[i for i,h in enumerate(source_packets) if h==crop_packets[0] and source_packets[i:i+len(crop_packets)]==crop_packets]
    if len(matches)!=1:raise SystemExit(f'Q{r["id"]} is not a unique unchanged sequence of source MP3 packets.')
    assets[str(r['id'])].update({'sourceFirstPacket':matches[0],'sourcePacketCount':len(crop_packets)})
manifest={'packetCopyVerified':True,'sourcePacketCount':len(source_packets),'kind':'source_recording_crops','sourceFilename':regions['sourceFilename'],'sourceAudioUsed':True,'sourceAudioSha256':source_hash,'sourceAudioDurationSec':regions['sourceDurationSec'],'method':regions['method'],'verification':'local_ASR_assisted_semantic_comparison_not_publisher_answer_sheet','recordedNumberPolicy':regions['note'],'assets':assets}
(repo/'src/data/hskAudioManifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(f'Copied {len(assets)} original recording segments ({sum(a["durationSec"] for a in assets.values()):.2f}s).')
