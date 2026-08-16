# Signal CSVs

Files in this directory (except `v2/`) are **legacy, untrusted raw inputs**.

They were populated by scraping `details[].label` display strings. Label drift filled some cells with placeholder zeros (for example Stablecoins `30-day Change` vs `Aggregate 30d Growth`, ETF `21-day Sum` vs `21-day Rolling Sum`, Mayer `Mayer Multiple` vs `Price vs 200-day SMA (Mayer)`). Do **not** use these files as calibration truth.

Forward structured series live in `v2/` and are written from `metrics` on factor results. Missing metrics are blank, never coerced to `0`.

`fear_greed.csv` is deprecated. Social no longer uses Fear & Greed; the ETL no longer appends this file and does not invent F&G values.
