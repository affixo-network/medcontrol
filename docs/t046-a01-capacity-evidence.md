# T-046 / A01 — IndexedDB capacity evidence (Modular-3)

Status: **measured samples; not a verified 500,000,000-event capacity guarantee**.
Scope: branch `modular-3.000`; isolated synthetic encrypted events, no medical records altered.

## Reproducible evidence

GitHub Actions workflow: `T-046 Encrypted Event Sizing`; Chromium / Playwright; all four tests passed in each cited run.

| Run | Events per token variant | Token variants | Result |
| --- | ---: | --- | --- |
| [41938753405](https://github.com/affixo-network/medcontrol/actions/runs/41938753405) | 300 | 0 / 1 / 4 | SUCCESS |
| [41939384766](https://github.com/affixo-network/medcontrol/actions/runs/41939384766) | 3,000 | 0 / 1 / 4 | SUCCESS |
| [41939564768](https://github.com/affixo-network/medcontrol/actions/runs/41939564768) | 10,000 | 0 / 1 / 4 | SUCCESS |

For each variant, the test opens an isolated persistent Chromium profile, writes 60 AES-GCM encrypted events, closes the browser and measures logical file sizes in `Default/IndexedDB`, reopens the **same** profile, writes the remaining events, closes it and measures again. It sums `stat.size`, not actual allocated SSD blocks. One token is an opaque HMAC index value.

| Tokens/event | Files after 60 events (B) | Files after 10,000 events (B) | Incremental B/event over events 61–10,000 |
| ---: | ---: | ---: | ---: |
| 0 | 62,892 | 7,149,676 | 712.956 |
| 1 | 136,173 | 10,163,991 | 1,008.835 |
| 4 | 356,109 | 15,629,336 | 1,536.542 |

## Arithmetic-only extrapolation (not a capacity guarantee)

`estimated logical IndexedDB bytes = measured incremental bytes/event * 500,000,000 events`

| Tokens/event | Decimal GB | GiB |
| ---: | ---: | ---: |
| 0 | 356.48 | 332.00 |
| 1 | 504.42 | 469.78 |
| 4 | 768.27 | 715.51 |

These values are **scenario projections only**. They exclude backups and replicas, operational free-space reserve, temporary compaction and migration space, WAL/LevelDB write amplification, filesystem allocation overhead, OS/browser quotas, other application data, multi-year updates and corruption recovery. They are not upper bounds or hardware minimums. No defensible numerical reserve multiplier has yet been validated; inventing one would misrepresent the evidence.

## Acceptance gaps before final A01 capacity approval

1. Measure actual allocated disk blocks and free-space changes, including Chromium/LevelDB compaction, after multiple write/delete/restart cycles.
2. Test much larger datasets and realistic mixes of intake/correction/course records and changing token distributions, not only synthetic intake events.
3. Test backup/restore and crash/power-loss recovery with temporary-space peaks; measure and bound operational reserve on representative SSDs.
4. Validate automatic capacity management and explicit low-space warnings, without deleting existing medical records.
5. Establish a defensible resource-extension mechanism: finite local SSD capacity cannot guarantee 500 million events on **every** device, regardless of available space.

**Decision:** A01.4 measurements are evidenced at up to 10,000 synthetic events; A01 overall capacity acceptance remains **OPEN**. No production or patient data changes.
