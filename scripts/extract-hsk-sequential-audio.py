#!/usr/bin/env python3
"""Remove all reviewed spoken-number announcements by copying unchanged MPEG-1 Layer III frames.

The original v2 files are immutable. No repeat, inter-repeat pause, or trailing
answer pause is removed. Boundaries are in the quiet gap after the announcement.
"""
import hashlib, json, math
from pathlib import Path

root = Path(__file__).resolve().parents[1]
old = json.loads((root/'src/data/hskAudioManifest.json').read_text())
# Reviewed 10ms RMS quiet gaps between number and first utterance, decoded locally.
gaps = {1:(1.09,2.11),2:(1.60,2.65),3:(1.76,2.82),4:(1.11,2.15),5:(1.71,2.78),6:(1.46,2.56),7:(1.52,2.58),
        8:(1.36,2.37),9:(1.34,2.40),10:(1.30,2.32),11:(1.52,2.51),
        12:(1.59,2.65),13:(1.50,2.56),14:(1.62,2.67),15:(1.46,2.47),
        16:(1.31,2.35),17:(1.58,2.62),18:(1.63,2.69),19:(1.50,2.72),
        20:(1.75,2.78),21:(1.79,2.93)}
def frames(data):
    pos = 0
    if data[:3] == b'ID3':
        pos = 10 + sum((data[6+i]&127) << (7*(3-i)) for i in range(4))
    result = []
    while pos+4 <= len(data):
        h = int.from_bytes(data[pos:pos+4], 'big')
        assert h>>21 == 2047 and (h>>19)&3 == 3 and (h>>17)&3 == 1
        rate = [44100,48000,32000][(h>>10)&3]
        bitrate = [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320][(h>>12)&15]
        length = 144000*bitrate//rate + ((h>>9)&1)
        assert length>4 and pos+length<=len(data)
        result.append((data[pos:pos+length],1152/rate))
        pos += length
    assert pos == len(data)
    return result

assets = {}
target = root/'public/audio/source-1d13ab138e86-sequential-v3'
target.mkdir(parents=True, exist_ok=True)
for key, asset in old['assets'].items():
    n=int(key)
    if n not in gaps:
        assets[key]={**asset,'removedPrefixSec':0,'spokenRepeats':2}
        continue
    data=(root/'public'/asset['src'].lstrip('/')).read_bytes()
    assert hashlib.sha256(data).hexdigest()==asset['sha256']
    packets=frames(data)
    gap_start,gap_end=gaps[n]
    drop=math.ceil((gap_start+.20)/packets[0][1])
    removed=sum(t for _,t in packets[:drop])
    assert gap_start < removed < gap_end-.20
    output=b''.join(b for b,_ in packets[drop:])
    path=target/f'q{n}.mp3';path.write_bytes(output)
    assert [b for b,_ in frames(output)]==[b for b,_ in packets[drop:]]
    assets[key]={**asset,'src':'/'+str(path.relative_to(root/'public')),
        'durationSec':sum(t for _,t in packets[drop:]),
        'sha256':hashlib.sha256(output).hexdigest(),'removedPrefixSec':removed,
        'sourceFirstPacket':asset['sourceFirstPacket']+drop,
        'sourcePacketCount':len(packets)-drop,'spokenRepeats':2,
        'announcementQuietGapSec':[gap_start,gap_end],
        'tailAndRepeatsUnchanged':True}
answer_pause_start_original = {'1': 7.3, '2': 7.29, '3': 8.14, '4': 9.21, '5': 7.54, '6': 20.41, '7': 21.45, '8': 16.2, '9': 15.83, '10': 14.78, '11': 28.54, '12': 27.02, '13': 24.08, '14': 24.79, '15': 28.8, '16': 24.93, '17': 28.75, '18': 28.44, '19': 33.38, '20': 26.96, '21': 35.08}
for key, asset in assets.items():
    asset["answerPauseStartSec"] = round(answer_pause_start_original[key] - asset["removedPrefixSec"], 2)
manifest={**old,'method':'reviewed_announcement_prefix_frame_removal',
    'recordedNumberPolicy':'Remove all spoken numbers; preserve both utterances and all following pauses.',
    'assets':assets}
(root/'src/data/hskSequentialAudioManifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
archive=json.loads((root/'src/data/hskVersions/pdf-e80a3cbaabc5-audio-1d13ab13-choice-v2.json').read_text())
archive['examVersion']='pdf-e80a3cbaabc5-audio-1d13ab13-sequential-v3'
archive['audioAssets']=assets
archive['administration']='sequential-source-two-readings-v3'
(root/'src/data/hskVersions/pdf-e80a3cbaabc5-audio-1d13ab13-sequential-v3.json').write_text(json.dumps(archive,ensure_ascii=False,indent=2)+'\n')
print(f'21 announcement prefixes removed; all trailing source packets retained; total {sum(a["durationSec"] for a in assets.values()):.2f}s')
