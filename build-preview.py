"""Make preview.html (artifact version) from index.html: keep only the part
between the ARTIFACT markers and drop the head/body wrapper tags."""
import re
from pathlib import Path

src = Path(__file__).with_name("index.html").read_text(encoding="utf-8")
body = src.split("<!--ARTIFACT-START-->", 1)[1].split("<!--ARTIFACT-END-->", 1)[0]
body = re.sub(r"<!--STRIP-->.*?<!--/STRIP-->", "", body, flags=re.S)
js = Path(__file__).with_name("app.js").read_text(encoding="utf-8")
body = body.replace('<script src="app.js"></script>', "<script>\n" + js + "</script>")
Path(__file__).with_name("preview.html").write_text(body.strip() + "\n", encoding="utf-8")
print("preview.html written,", len(body), "chars")
