# Local fixture generation only. Pillow is test tooling, not a new runtime dependency.
from PIL import Image,ImageDraw
from pathlib import Path
import random,hashlib,json
out=Path(__file__).parent/'fixtures/ai-large-local';out.mkdir(parents=True,exist_ok=True)
rng=random.Random(20261103)
for filename,shape in [('large-synthetic.png',(1000,600)),('large-synthetic.jpg',(1600,1200))]:
 im=Image.frombytes('RGB',shape,rng.randbytes(shape[0]*shape[1]*3));d=ImageDraw.Draw(im);d.rectangle((10,10,800,150),fill='white');d.text((20,30),'SYNTHETIC ONLY / 700,000 KRW / VAT UNKNOWN / 2026-11',fill='black');im.save(out/filename,**({'quality':75} if filename.endswith('.jpg') else {}))
jpeg=(out/'large-synthetic.jpg').read_bytes();draw=b'q 600 0 0 450 0 0 cm /Im1 Do Q'
objs=[b'<< /Type /Catalog /Pages 2 0 R >>',b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 450] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>',f'<< /Type /XObject /Subtype /Image /Width 1600 /Height 1200 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length {len(jpeg)} >>\nstream\n'.encode()+jpeg+b'\nendstream',f'<< /Length {len(draw)} >>\nstream\n'.encode()+draw+b'\nendstream']
data=b'%PDF-1.4\n';offsets=[]
for i,obj in enumerate(objs):offsets.append(len(data));data+=f'{i+1} 0 obj\n'.encode()+obj+b'\nendobj\n'
xref=len(data);data+=b'xref\n0 6\n0000000000 65535 f \n'+b''.join(f'{o:010d} 00000 n \n'.encode() for o in offsets)+f'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF'.encode();(out/'large-synthetic-scan.pdf').write_bytes(data)
manifest=[{'filename':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(out.iterdir()) if p.suffix in ['.png','.jpg','.pdf']];(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps(manifest))
