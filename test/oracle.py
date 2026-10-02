"""Independent Python re-scoring, NOT independent team replication."""
import json
import sys
from pathlib import Path

def oracle(response):
    if not isinstance(response, dict):
        return ""
    direct = response.get("output_text")
    if isinstance(direct, str) and direct.strip():
        return direct.strip()
    texts = []
    output = response.get("output")
    for message in output if isinstance(output, list) else []:
        if not isinstance(message, dict) or message.get("type") != "message":
            continue
        contents = message.get("content")
        for part in contents if isinstance(contents, list) else []:
            if isinstance(part, dict) and part.get("type") == "output_text" and isinstance(part.get("text"), str):
                texts.append(part["text"])
    return "\n".join(texts).strip()

report_path = Path(sys.argv[1] if len(sys.argv) > 1 else "reports/rehearsal.json")
data = json.loads((report_path.parent / "oracle-input.json").read_text())
errors = []
for case, output in zip(data["cases"], data["outputs"], strict=True):
    expected = oracle(case["input"])
    if not output.get("ok") or output.get("value") != expected or expected != case["expected"]:
        errors.append(case["id"])
result = {"status": "PASS" if not errors else "FAIL", "cases": len(data["cases"]), "mismatches": errors,
          "scope": "independent language implementation on same recorded samples; not external replication"}
(report_path.parent / "python-oracle-result.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))
print(json.dumps(result, ensure_ascii=False))
sys.exit(bool(errors))
