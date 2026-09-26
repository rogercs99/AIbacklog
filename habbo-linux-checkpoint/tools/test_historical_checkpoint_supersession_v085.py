#!/usr/bin/env python3
from pathlib import Path
root = Path(__file__).resolve().parents[1]
p = root / 'CHECKPOINT_VERIFIED.txt'
s = p.read_text(encoding='utf-8')
assert s.startswith('HISTÓRICO / SUPERSEDED (2026-09-26)'), 'historical checkpoint lacks superseded banner'
assert 'NO representa el estado operativo actual' in s, 'historical checkpoint lacks current-state warning'
assert 'HABBO_2009_V085_PRODUCTION_FINAL_CONTINUITY_20260926.txt' in s, 'canonical continuity pointer missing'
assert 'V085_PRODUCTION_PROMOTION_20260926.md' in s and 'VPS1_DEPLOYMENT_20260923.md' in s, 'canonical production pointers missing'
assert '\nFinal Habbo gameplay remains pending and must run inside the Linux sandbox.\n' not in s, 'stale gameplay-pending claim remains unqualified'
assert '[HISTORICAL STATUS AS OF 2026-09-21]' in s, 'historical status qualifier missing'
print('PASS: historical checkpoint is explicitly superseded and cannot masquerade as current state')
